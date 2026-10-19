import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import { AppLogger } from '../events/app-logger.service';

/**
 * Consistent JSON errors: { statusCode, message, error } for the app, and the
 * RFC 6749 shape for OAuth errors (passed through untouched). Unexpected
 * errors are logged with the correlation id and never leak internals.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  constructor(private readonly appLog: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body && 'error_description' in body) {
        return res.status(status).json(body);
      }
      const raw = typeof body === 'string' ? body : (body as any).message;
      const message =
        status === 429 ? 'Too many attempts. Please wait a minute and try again.' : Array.isArray(raw) ? raw[0] : raw;
      if (status === 401 && req.path.includes('/oauth/userinfo')) res.setHeader('WWW-Authenticate', 'Bearer error="invalid_token"');
      return res.status(status).json({ statusCode: status, message, error: (body as any)?.error ?? exception.name });
    }

    const err = exception as Error;
    this.logger.error(err?.stack ?? String(exception));
    this.appLog.error('Unhandled error', { path: req.path, method: req.method, error: err?.message }, req.correlationId);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: 500,
      message: 'Something went wrong on our side. Please try again.',
      error: 'InternalServerError',
      requestId: req.correlationId,
    });
  }
}
