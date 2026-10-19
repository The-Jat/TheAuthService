import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';
import type { Request, Response } from 'express';
import { Meta, type RequestMeta } from '../common/request-context';
import { EventBusService } from '../events/event-bus.service';
import { OAuthService } from '../oauth/oauth.service';
import { PasskeysService } from '../passkeys/passkeys.service';
import { PasskeyResponseDto } from '../auth/auth.dto';
import { SameOriginGuard, SessionGuard } from '../sessions/guards';
import { SessionsService } from '../sessions/sessions.service';
import { PasswordsService } from '../users/passwords.service';
import { UsersService } from '../users/users.service';
import { toPublicUser } from '../users/users.types';

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

class ProfileDto {
  @Transform(trim) @IsString() @Length(1, 80, { message: 'Name must be 1–80 characters.' })
  name: string;
}

class ChangePasswordDto {
  @IsOptional() @IsString() @MaxLength(256)
  currentPassword?: string;

  @IsString() @MaxLength(256)
  newPassword: string;
}

class RenameDto {
  @Transform(trim) @IsString() @Length(1, 60)
  name: string;
}

class DeleteAccountDto {
  @IsOptional() @IsString() @MaxLength(256)
  password?: string;

  @IsString()
  confirm: string;
}

@Controller('account')
@UseGuards(SameOriginGuard, SessionGuard)
export class AccountController {
  constructor(
    private readonly users: UsersService,
    private readonly passwords: PasswordsService,
    private readonly sessions: SessionsService,
    private readonly passkeys: PasskeysService,
    private readonly oauth: OAuthService,
    private readonly bus: EventBusService,
  ) {}

  @Patch()
  async updateProfile(@Body() dto: ProfileDto, @Req() req: Request) {
    const user = await this.users.updateName(req.user!.id, dto.name);
    return { user: toPublicUser(user!) };
  }

  @Post('password')
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async changePassword(@Body() dto: ChangePasswordDto, @Req() req: Request, @Meta() meta: RequestMeta) {
    const user = req.user!;
    if (await this.passwords.has(user.id)) {
      if (!dto.currentPassword || !(await this.passwords.check(user.id, dto.currentPassword))) {
        throw new UnauthorizedException('Your current password is incorrect.');
      }
    }
    this.passwords.assertAcceptable(dto.newPassword, user.email);
    await this.passwords.set(user.id, dto.newPassword);
    // Everyone else gets signed out; this device stays signed in.
    await this.sessions.revokeAllForUser(user.id, req.session!.id);
    this.bus.publish('auth.password.changed', { userId: user.id, email: user.email, name: user.name, ip: meta.ip }, meta.correlationId);
    return { ok: true };
  }

  // ---- sessions

  @Get('sessions')
  listSessions(@Req() req: Request) {
    return this.sessions.listForUser(req.user!.id, req.session!.id);
  }

  @Delete('sessions/:id')
  async revokeSession(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    if (!(await this.sessions.revoke(id, req.user!.id))) throw new NotFoundException('Session not found.');
    return { ok: true };
  }

  @Post('sessions/revoke-others')
  @HttpCode(200)
  async revokeOthers(@Req() req: Request) {
    await this.sessions.revokeAllForUser(req.user!.id, req.session!.id);
    return { ok: true };
  }

  // ---- passkeys

  @Get('passkeys')
  listPasskeys(@Req() req: Request) {
    return this.passkeys.list(req.user!.id);
  }

  @Post('passkeys/options')
  @HttpCode(200)
  passkeyOptions(@Req() req: Request) {
    return this.passkeys.registrationOptions(req.user!);
  }

  @Post('passkeys')
  async addPasskey(@Body() dto: PasskeyResponseDto, @Req() req: Request, @Meta() meta: RequestMeta) {
    await this.passkeys.verifyRegistration(req.user!, dto.response, dto.name);
    const u = req.user!;
    this.bus.publish('auth.passkey.added', { userId: u.id, email: u.email, name: u.name }, meta.correlationId);
    return this.passkeys.list(u.id);
  }

  @Patch('passkeys/:id')
  async renamePasskey(@Param('id', ParseUUIDPipe) id: string, @Body() dto: RenameDto, @Req() req: Request) {
    await this.passkeys.rename(req.user!.id, id, dto.name);
    return this.passkeys.list(req.user!.id);
  }

  @Delete('passkeys/:id')
  async removePasskey(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const userId = req.user!.id;
    if (!(await this.passwords.has(userId)) && (await this.passkeys.count(userId)) <= 1) {
      throw new BadRequestException('Set a password before removing your last passkey, or you would be locked out.');
    }
    if (!(await this.passkeys.remove(userId, id))) throw new NotFoundException('Passkey not found.');
    return this.passkeys.list(userId);
  }

  // ---- connected apps

  @Get('apps')
  async apps(@Req() req: Request) {
    const rows = await this.oauth.connectedApps(req.user!.id);
    return rows.map((a) => ({
      id: a.id,
      name: a.name,
      homepageUrl: a.homepage_url,
      logoUrl: a.logo_url,
      scopes: a.scopes,
      grantedAt: a.granted_at ? new Date(a.granted_at).toISOString() : null,
    }));
  }

  @Delete('apps/:id')
  async disconnect(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    await this.oauth.revokeConsent(req.user!.id, id);
    return { ok: true };
  }

  // ---- delete account

  @Delete()
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  async deleteAccount(@Body() dto: DeleteAccountDto, @Req() req: Request, @Res({ passthrough: true }) res: Response, @Meta() meta: RequestMeta) {
    const user = req.user!;
    if (dto.confirm !== user.email) throw new BadRequestException('Type your email address to confirm.');
    if ((await this.passwords.has(user.id)) && !(dto.password && (await this.passwords.check(user.id, dto.password)))) {
      throw new UnauthorizedException('Your password is incorrect.');
    }
    if (user.role === 'admin' && (await this.users.countAdmins()) <= 1) {
      throw new ForbiddenException('You are the only administrator. Promote someone else first.');
    }
    await this.users.delete(user.id);
    this.sessions.clearCookie(res);
    this.bus.publish('auth.user.deleted', { userId: user.id, email: user.email, name: user.name }, meta.correlationId);
    return { ok: true };
  }
}
