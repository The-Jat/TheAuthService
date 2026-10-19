import { Body, Controller, Get, HttpCode, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { config } from '../config/config';
import { Meta, type RequestMeta } from '../common/request-context';
import { PasskeysService } from '../passkeys/passkeys.service';
import { SameOriginGuard, SessionGuard } from '../sessions/guards';
import { SessionsService } from '../sessions/sessions.service';
import { PasswordsService } from '../users/passwords.service';
import { toPublicUser } from '../users/users.types';
import { EmailDto, LoginDto, PasskeyResponseDto, ResetPasswordDto, SignupDto, TokenDto } from './auth.dto';
import { AuthService } from './auth.service';
import { EmailTokensService } from './email-tokens.service';

const STRICT = { default: { limit: 10, ttl: 60_000 } };

@Controller('auth')
@UseGuards(SameOriginGuard)
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionsService,
    private readonly passkeys: PasskeysService,
    private readonly passwords: PasswordsService,
    private readonly emailTokens: EmailTokensService,
  ) {}

  /** Lets the UI decide which screens to show before anyone signs in. */
  @Get('config')
  publicConfig() {
    return {
      brandName: config.brandName,
      allowSignup: config.allowSignup,
      requireVerifiedEmail: config.security.requireVerifiedEmail,
    };
  }

  @Get('me')
  @UseGuards(SessionGuard)
  async me(@Req() req: Request) {
    const user = req.user!;
    return {
      user: toPublicUser(user),
      hasPassword: await this.passwords.has(user.id),
      passkeyCount: await this.passkeys.count(user.id),
      sessionId: req.session!.id,
    };
  }

  @Post('signup')
  @Throttle(STRICT)
  async signup(@Body() dto: SignupDto, @Meta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.signup(dto.email, dto.name, dto.password, meta);
    this.sessions.setCookie(res, token);
    return { user: toPublicUser(user) };
  }

  @Post('login')
  @HttpCode(200)
  @Throttle(STRICT)
  async login(@Body() dto: LoginDto, @Meta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const { token, user } = await this.auth.loginWithPassword(dto.email, dto.password, meta);
    this.sessions.setCookie(res, token);
    return { user: toPublicUser(user) };
  }

  @Post('passkey/options')
  @HttpCode(200)
  @Throttle(STRICT)
  passkeyOptions() {
    return this.passkeys.authenticationOptions();
  }

  @Post('passkey/verify')
  @HttpCode(200)
  @Throttle(STRICT)
  async passkeyVerify(@Body() dto: PasskeyResponseDto, @Meta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    const userId = await this.passkeys.verifyAuthentication(dto.response);
    const { token, user } = await this.auth.loginWithPasskey(userId, meta);
    this.sessions.setCookie(res, token);
    return { user: toPublicUser(user) };
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const resolved = await this.sessions.resolve(this.sessions.readCookie(req));
    if (resolved) await this.sessions.revoke(resolved.session.id);
    this.sessions.clearCookie(res);
    return { ok: true };
  }

  @Post('verify-email')
  @HttpCode(200)
  @Throttle(STRICT)
  async verifyEmail(@Body() dto: TokenDto, @Meta() meta: RequestMeta) {
    const user = await this.auth.verifyEmail(dto.token, meta);
    return { user: toPublicUser(user) };
  }

  @Post('resend-verification')
  @HttpCode(200)
  @Throttle({ default: { limit: 3, ttl: 600_000 } })
  @UseGuards(SessionGuard)
  async resend(@Req() req: Request, @Meta() meta: RequestMeta) {
    await this.auth.sendVerification(req.user!, meta);
    return { ok: true };
  }

  @Post('forgot-password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 600_000 } })
  async forgot(@Body() dto: EmailDto, @Meta() meta: RequestMeta) {
    await this.auth.forgotPassword(dto.email, meta);
    return { ok: true };
  }

  @Get('reset-password/check')
  async checkReset(@Query('token') token: string) {
    return { valid: await this.emailTokens.peek(token, 'reset_password') };
  }

  @Post('reset-password')
  @HttpCode(200)
  @Throttle(STRICT)
  async reset(@Body() dto: ResetPasswordDto, @Meta() meta: RequestMeta, @Res({ passthrough: true }) res: Response) {
    await this.auth.resetPassword(dto.token, dto.password, meta);
    this.sessions.clearCookie(res);
    return { ok: true };
  }
}
