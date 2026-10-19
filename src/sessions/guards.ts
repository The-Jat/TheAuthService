import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { config } from '../config/config';
import { safeEqual } from '../common/crypto';
import { SessionsService } from './sessions.service';

/** Requires a valid browser session cookie; attaches `req.user` and `req.session`. */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionsService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const resolved = await this.sessions.resolve(this.sessions.readCookie(req));
    if (!resolved) throw new UnauthorizedException('Not signed in.');
    req.user = resolved.user;
    req.session = resolved.session;
    return true;
  }
}

/** Use after SessionGuard. */
@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (req.user?.role !== 'admin') throw new ForbiddenException('Administrator access required.');
    return true;
  }
}

/**
 * CSRF defence for cookie-authenticated, state-changing requests: the browser
 * must send an Origin (or Referer) equal to our own origin. SameSite=Lax cookies
 * already block most cross-site POSTs; this closes the remaining gaps.
 */
@Injectable()
export class SameOriginGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>();
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return true;
    const origin = req.header('origin') ?? originOf(req.header('referer'));
    const allowed = [config.publicUrl, ...(config.isProduction ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000'])];
    if (!origin || !allowed.includes(origin)) throw new ForbiddenException('Cross-origin request rejected.');
    return true;
  }
}

/** Service-to-service calls on the private network carry the shared key. */
@Injectable()
export class InternalKeyGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const key = ctx.switchToHttp().getRequest<Request>().header('x-internal-key') ?? '';
    if (!safeEqual(key, config.internalApiKey)) throw new UnauthorizedException();
    return true;
  }
}

function originOf(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    return new URL(url).origin;
  } catch {
    return undefined;
  }
}
