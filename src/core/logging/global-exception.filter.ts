import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';

import { Request, Response }
from 'express';

import { EventBusService }
from '../events/application/event-bus.service';

@Catch()
export class GlobalExceptionFilter
  implements ExceptionFilter {

  constructor(
    private eventBus:
      EventBusService,
  ) {}

  async catch(
    exception: unknown,

    host: ArgumentsHost,
  ) {
    console.log('GLOBAL FILTER CAUGHT ERROR',);

    const ctx =
      host.switchToHttp();

    const request =
      ctx.getRequest<Request>();

    const response =
      ctx.getResponse<Response>();

    const correlationId =
      request['correlationId'];

    let status =
      HttpStatus.INTERNAL_SERVER_ERROR;

    let message =
      'Internal server error';

    let stack: string | undefined;

    if (
      exception instanceof HttpException
    ) {

      status =
        exception.getStatus();

      const res =
        exception.getResponse();

      message =
        typeof res === 'string'
          ? res
          : (res as any).message;

      stack =
        exception.stack;

    } else if (
      exception instanceof Error
    ) {

      message =
        exception.message;

      stack =
        exception.stack;
    }

    await this.eventBus.publish({
      event: 'system.error',

      correlationId,

      timestamp:
        new Date().toISOString(),

      service:
        'auth-service',

      data: {
        level: 'error',

        message,

        meta: {
          statusCode: status,

          method:
            request.method,

          path:
            request.url,

          correlationId,

          stack,
        },
      },
    });

    response.status(status).json({
      statusCode: status,
      message,
      correlationId,
    });
  }
}