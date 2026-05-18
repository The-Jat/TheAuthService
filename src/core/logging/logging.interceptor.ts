import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';

import { Observable, tap }
from 'rxjs';

import { EventBusService }
from 'src/core/events/application/event-bus.service';

@Injectable()
export class LoggingInterceptor
  implements NestInterceptor {

  constructor(
    private eventBus:
      EventBusService,
  ) {}

  intercept(
    context: ExecutionContext,

    next: CallHandler,
  ): Observable<any> {

    const request =
      context
        .switchToHttp()
        .getRequest();

    const start =
      Date.now();

    return next.handle().pipe(

      tap(async () => {

        const duration =
          Date.now() - start;

        await this.eventBus.publish({
          event: 'system.logs',

          timestamp:
            new Date()
              .toISOString(),

          service:
            'auth-service',

          data: {
            level: 'info',

            message:
              'HTTP Request',

            meta: {
              method:
                request.method,

              url:
                request.url,

              duration,

              userAgent:
                request.headers[
                  'user-agent'
                ],

              ip:
                request.ip,
            },
          },
        });
      }),
    );
  }
}