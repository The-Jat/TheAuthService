import { Injectable, NestMiddleware, createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'crypto';

/** Per-request metadata attached by the middleware below. */
export interface RequestMeta {
  correlationId: string;
  ip?: string;
  userAgent?: string;
}

declare module 'express-serve-static-core' {
  interface Request {
    correlationId: string;
    user?: import('../users/users.types').User;
    session?: import('../sessions/sessions.types').Session;
  }
}

@Injectable()
export class CorrelationMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.header('x-request-id');
    req.correlationId = incoming && /^[\w-]{8,64}$/.test(incoming) ? incoming : randomUUID();
    res.setHeader('X-Request-Id', req.correlationId);
    next();
  }
}

export function metaOf(req: Request): RequestMeta {
  return {
    correlationId: req.correlationId,
    ip: req.ip,
    userAgent: req.header('user-agent')?.slice(0, 300),
  };
}

export const Meta = createParamDecorator((_: unknown, ctx: ExecutionContext): RequestMeta =>
  metaOf(ctx.switchToHttp().getRequest<Request>()),
);
