import {
  BadRequestException,
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import type { Request } from 'express';
import { Meta, type RequestMeta } from '../common/request-context';
import { DatabaseService } from '../database/database.service';
import { AuthService } from '../auth/auth.service';
import { EventBusService } from '../events/event-bus.service';
import { ClientsService, toPublicClient } from '../oauth/clients.service';
import { PasskeysService } from '../passkeys/passkeys.service';
import { AdminGuard, SameOriginGuard, SessionGuard } from '../sessions/guards';
import { SessionsService } from '../sessions/sessions.service';
import { UsersService } from '../users/users.service';
import { toPublicUser } from '../users/users.types';
import { InternalClient } from './internal-client.service';

class UpdateUserDto {
  @IsOptional() @IsString() @Length(1, 80) name?: string;
  @IsOptional() @IsIn(['user', 'admin']) role?: 'user' | 'admin';
  @IsOptional() @IsIn(['active', 'disabled']) status?: 'active' | 'disabled';
}

class ClientDto {
  @IsString() @Length(1, 80) name: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsString() @MaxLength(500) homepageUrl?: string;
  @IsOptional() @IsString() @MaxLength(500) logoUrl?: string;
  @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) redirectUris: string[];
  @IsOptional() @IsArray() @ArrayMaxSize(20) @IsString({ each: true }) postLogoutRedirectUris?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) allowedScopes?: string[];
  @IsOptional() @IsBoolean() firstParty?: boolean;
  @IsOptional() @IsBoolean() confidential?: boolean;
}

class TestEmailDto {
  @IsString() @MaxLength(254) to: string;
}

@Controller('admin')
@UseGuards(SameOriginGuard, SessionGuard, AdminGuard)
export class AdminController {
  constructor(
    private readonly db: DatabaseService,
    private readonly users: UsersService,
    private readonly sessions: SessionsService,
    private readonly passkeys: PasskeysService,
    private readonly clients: ClientsService,
    private readonly auth: AuthService,
    private readonly internal: InternalClient,
    private readonly bus: EventBusService,
  ) {}

  @Get('overview')
  async overview() {
    const [counts, signups, logins] = await Promise.all([
      this.db.one(`SELECT
          (SELECT count(*) FROM users)::int AS users,
          (SELECT count(*) FROM users WHERE email_verified_at IS NOT NULL)::int AS verified,
          (SELECT count(*) FROM users WHERE created_at > now() - interval '7 days')::int AS new_users_7d,
          (SELECT count(*) FROM sessions WHERE revoked_at IS NULL AND expires_at > now())::int AS active_sessions,
          (SELECT count(*) FROM oauth_clients WHERE disabled_at IS NULL)::int AS apps,
          (SELECT count(*) FROM passkeys)::int AS passkeys`),
      this.db.query(`SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(count(u.id), 0)::int AS count
          FROM generate_series(current_date - 13, current_date, interval '1 day') d
          LEFT JOIN users u ON u.created_at::date = d::date GROUP BY d ORDER BY d`),
      this.db.query(`SELECT to_char(d, 'YYYY-MM-DD') AS day, coalesce(count(s.id), 0)::int AS count
          FROM generate_series(current_date - 13, current_date, interval '1 day') d
          LEFT JOIN sessions s ON s.created_at::date = d::date GROUP BY d ORDER BY d`),
    ]);
    const [logs, notifications] = await Promise.all([
      this.internal.get('logger', '/internal/stats').catch(() => null),
      this.internal.get('notifier', '/internal/stats').catch(() => null),
    ]);
    return { counts, signups, logins, logs, notifications };
  }

  // ---------------------------------------------------------------- users

  @Get('users')
  async listUsers(
    @Query('search') search: string | undefined,
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('pageSize', new DefaultValuePipe(25), ParseIntPipe) pageSize: number,
  ) {
    const size = Math.min(Math.max(pageSize, 1), 100);
    const { total, rows } = await this.users.list({ search: search?.trim().slice(0, 100), limit: size, offset: (Math.max(page, 1) - 1) * size });
    return { total, page, pageSize: size, items: rows.map(toPublicUser) };
  }

  @Get('users/:id')
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found.');
    const apps = await this.db.query(
      `SELECT DISTINCT c.id, c.name FROM refresh_tokens r JOIN oauth_clients c ON c.id = r.client_id
       WHERE r.user_id = $1 AND r.revoked_at IS NULL AND r.expires_at > now()`,
      [id],
    );
    return {
      user: toPublicUser(user),
      locked: !!user.locked_until && user.locked_until > new Date(),
      sessions: await this.sessions.listForUser(id),
      passkeys: await this.passkeys.list(id),
      apps,
    };
  }

  @Patch('users/:id')
  async updateUser(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateUserDto, @Req() req: Request) {
    const target = await this.users.findById(id);
    if (!target) throw new NotFoundException('User not found.');
    const self = target.id === req.user!.id;
    if (self && (dto.role === 'user' || dto.status === 'disabled')) throw new ForbiddenException('You cannot demote or disable yourself.');
    if (target.role === 'admin' && (dto.role === 'user' || dto.status === 'disabled') && (await this.users.countAdmins()) <= 1) {
      throw new ForbiddenException('This is the last administrator.');
    }
    if (dto.name) await this.users.updateName(id, dto.name);
    if (dto.role) await this.users.setRole(id, dto.role);
    if (dto.status) {
      await this.users.setStatus(id, dto.status);
      if (dto.status === 'disabled') await this.sessions.revokeAllForUser(id);
    }
    return { user: toPublicUser((await this.users.findById(id))!) };
  }

  @Post('users/:id/verify-email')
  @HttpCode(200)
  async verifyUser(@Param('id', ParseUUIDPipe) id: string) {
    if (!(await this.users.findById(id))) throw new NotFoundException('User not found.');
    return { user: toPublicUser(await this.users.markEmailVerified(id)) };
  }

  @Post('users/:id/unlock')
  @HttpCode(200)
  async unlock(@Param('id', ParseUUIDPipe) id: string) {
    await this.db.query('UPDATE users SET failed_logins = 0, locked_until = NULL WHERE id = $1', [id]);
    return { ok: true };
  }

  @Post('users/:id/send-reset')
  @HttpCode(200)
  async sendReset(@Param('id', ParseUUIDPipe) id: string, @Meta() meta: RequestMeta) {
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found.');
    await this.auth.forgotPassword(user.email, meta);
    return { ok: true };
  }

  @Post('users/:id/sign-out')
  @HttpCode(200)
  async signOutEverywhere(@Param('id', ParseUUIDPipe) id: string) {
    await this.sessions.revokeAllForUser(id);
    return { ok: true };
  }

  @Delete('users/:id')
  async deleteUser(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request, @Meta() meta: RequestMeta) {
    if (id === req.user!.id) throw new ForbiddenException('Delete your own account from your account settings.');
    const user = await this.users.findById(id);
    if (!user) throw new NotFoundException('User not found.');
    if (user.role === 'admin' && (await this.users.countAdmins()) <= 1) throw new ForbiddenException('This is the last administrator.');
    await this.users.delete(id);
    this.bus.publish('auth.user.deleted', { userId: id, email: user.email, name: user.name, by: req.user!.id }, meta.correlationId);
    return { ok: true };
  }

  // ---------------------------------------------------------------- apps (OAuth clients)

  @Get('apps')
  async listApps() {
    const rows = await this.clients.list();
    return rows.map((c) => ({ ...toPublicClient(c), activeUsers: Number(c.active_users) }));
  }

  @Post('apps')
  async createApp(@Body() dto: ClientDto, @Req() req: Request) {
    const { client, secret } = await this.clients.create(dto, req.user!.id);
    return { app: toPublicClient(client), clientSecret: secret };
  }

  @Patch('apps/:id')
  async updateApp(@Param('id', ParseUUIDPipe) id: string, @Body() dto: ClientDto) {
    return { app: toPublicClient(await this.clients.update(id, dto)) };
  }

  @Post('apps/:id/rotate-secret')
  @HttpCode(200)
  async rotate(@Param('id', ParseUUIDPipe) id: string) {
    const { client, secret } = await this.clients.rotateSecret(id);
    return { app: toPublicClient(client), clientSecret: secret };
  }

  @Post('apps/:id/disable')
  @HttpCode(200)
  async disableApp(@Param('id', ParseUUIDPipe) id: string) {
    return { app: toPublicClient(await this.clients.setDisabled(id, true)) };
  }

  @Post('apps/:id/enable')
  @HttpCode(200)
  async enableApp(@Param('id', ParseUUIDPipe) id: string) {
    return { app: toPublicClient(await this.clients.setDisabled(id, false)) };
  }

  @Delete('apps/:id')
  async deleteApp(@Param('id', ParseUUIDPipe) id: string) {
    await this.clients.delete(id);
    return { ok: true };
  }

  // ---------------------------------------------------------------- logs & notifications (proxied)

  @Get('logs')
  logs(@Query() query: Record<string, string>) {
    return this.internal.get('logger', '/internal/logs', pick(query, ['service', 'level', 'event', 'q', 'correlationId', 'before', 'limit']));
  }

  @Get('logs/facets')
  logFacets() {
    return this.internal.get('logger', '/internal/facets');
  }

  @Get('notifications')
  notifications(@Query() query: Record<string, string>) {
    return this.internal.get('notifier', '/internal/deliveries', pick(query, ['status', 'channel', 'q', 'before', 'limit']));
  }

  @Post('notifications/:id/retry')
  @HttpCode(200)
  retry(@Param('id', ParseUUIDPipe) id: string) {
    return this.internal.post('notifier', `/internal/deliveries/${id}/retry`);
  }

  @Post('notifications/test')
  @HttpCode(200)
  testEmail(@Body() dto: TestEmailDto) {
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(dto.to)) throw new BadRequestException('Enter a valid email address.');
    return this.internal.post('notifier', '/internal/test-email', { to: dto.to });
  }
}

function pick(source: Record<string, string>, keys: string[]) {
  const out: Record<string, string> = {};
  for (const k of keys) if (typeof source[k] === 'string') out[k] = source[k].slice(0, 200);
  return out;
}
