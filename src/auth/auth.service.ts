import { ConflictException, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { config } from '../config/config';
import { RequestMeta } from '../common/request-context';
import { DatabaseService } from '../database/database.service';
import { AppLogger } from '../events/app-logger.service';
import { EventBusService } from '../events/event-bus.service';
import { SessionsService } from '../sessions/sessions.service';
import { PasswordsService } from '../users/passwords.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/users.types';
import { EmailTokensService } from './email-tokens.service';

const GENERIC_LOGIN_ERROR = 'Incorrect email or password.';

@Injectable()
export class AuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly users: UsersService,
    private readonly passwords: PasswordsService,
    private readonly sessions: SessionsService,
    private readonly emailTokens: EmailTokensService,
    private readonly bus: EventBusService,
    private readonly log: AppLogger,
  ) {}

  async signup(email: string, name: string, password: string, meta: RequestMeta) {
    if (!config.allowSignup) throw new ForbiddenException('Sign-ups are currently closed.');
    this.passwords.assertAcceptable(password, email);
    const user = await this.db.transaction(async (tx) => {
      if (await this.users.findByEmail(email, tx)) {
        throw new ConflictException('An account with this email already exists. Try signing in instead.');
      }
      const created = await this.users.create(email, name, tx);
      await this.passwords.set(created.id, password, tx);
      return created;
    });
    this.bus.publish('auth.user.registered', { userId: user.id, email: user.email, name: user.name }, meta.correlationId);
    this.log.info('User registered', { userId: user.id }, meta.correlationId);
    await this.sendVerification(user, meta);
    return this.startSession(user, meta, 'password');
  }

  async loginWithPassword(email: string, password: string, meta: RequestMeta) {
    const user = await this.users.findByEmail(email);
    if (user?.locked_until && user.locked_until > new Date()) {
      throw new UnauthorizedException('Too many failed attempts. Try again in a few minutes or reset your password.');
    }
    const ok = await this.passwords.check(user?.id ?? null, password);
    if (!user || !ok) {
      if (user) {
        await this.users.recordFailedLogin(user.id);
        this.log.warn('Failed password login', { userId: user.id, ip: meta.ip }, meta.correlationId);
      }
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }
    if (user.status !== 'active') throw new ForbiddenException('This account has been disabled.');
    return this.startSession(user, meta, 'password');
  }

  async loginWithPasskey(userId: string, meta: RequestMeta) {
    const user = await this.users.findById(userId);
    if (!user || user.status !== 'active') throw new ForbiddenException('This account has been disabled.');
    return this.startSession(user, meta, 'passkey');
  }

  async startSession(user: User, meta: RequestMeta, method: string) {
    await this.users.recordSuccessfulLogin(user.id);
    const { token, session } = await this.sessions.create(user.id, meta, method);
    this.bus.publish(
      'auth.user.signed_in',
      { userId: user.id, email: user.email, name: user.name, method, ip: meta.ip, userAgent: meta.userAgent, sessionId: session.id },
      meta.correlationId,
    );
    return { token, session, user: (await this.users.findById(user.id))! };
  }

  async sendVerification(user: User, meta: RequestMeta) {
    if (user.email_verified_at) return;
    const { token, expiresAt } = await this.emailTokens.issue(user.id, 'verify_email');
    this.bus.publish(
      'auth.email.verification_requested',
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        verifyUrl: `${config.publicUrl}/verify-email?token=${encodeURIComponent(token)}`,
        expiresAt: expiresAt.toISOString(),
      },
      meta.correlationId,
    );
  }

  async verifyEmail(token: string, meta: RequestMeta) {
    const userId = await this.emailTokens.consume(token, 'verify_email');
    if (!userId) throw new UnauthorizedException('This verification link is invalid or has expired.');
    const user = await this.users.markEmailVerified(userId);
    this.bus.publish('auth.email.verified', { userId, email: user.email, name: user.name }, meta.correlationId);
    return user;
  }

  /** Always succeeds so the endpoint can't be used to test which emails exist. */
  async forgotPassword(email: string, meta: RequestMeta) {
    const user = await this.users.findByEmail(email);
    if (!user || user.status !== 'active') return;
    const { token, expiresAt } = await this.emailTokens.issue(user.id, 'reset_password');
    this.bus.publish(
      'auth.password.reset_requested',
      {
        userId: user.id,
        email: user.email,
        name: user.name,
        resetUrl: `${config.publicUrl}/reset-password?token=${encodeURIComponent(token)}`,
        expiresAt: expiresAt.toISOString(),
        ip: meta.ip,
      },
      meta.correlationId,
    );
  }

  async resetPassword(token: string, password: string, meta: RequestMeta) {
    const user = await this.db.transaction(async (tx) => {
      const userId = await this.emailTokens.consume(token, 'reset_password', tx);
      if (!userId) throw new UnauthorizedException('This reset link is invalid or has expired.');
      const u = (await this.users.findById(userId, tx))!;
      this.passwords.assertAcceptable(password, u.email);
      await this.passwords.set(userId, password, tx);
      // Receiving the email proves ownership of the inbox.
      await this.users.markEmailVerified(userId, tx);
      return u;
    });
    await this.users.recordSuccessfulLogin(user.id);
    await this.sessions.revokeAllForUser(user.id);
    this.bus.publish('auth.password.changed', { userId: user.id, email: user.email, name: user.name, ip: meta.ip }, meta.correlationId);
    this.log.info('Password reset', { userId: user.id }, meta.correlationId);
  }
}
