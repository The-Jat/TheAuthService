import { Injectable } from '@nestjs/common';

import { EventBusService } from 'src/core/events/application/event-bus.service';

@Injectable()
export class CentralLoggerService {
  constructor(
    private eventBus: EventBusService,
  ) {}

  async info(
    message: string,
    meta?: Record<string, any>,
  ) {
    await this.publish(
      'info',
      message,
      meta,
    );
  }

  async warn(
    message: string,
    meta?: Record<string, any>,
  ) {
    await this.publish(
      'warn',
      message,
      meta,
    );
  }

  async error(
    message: string,
    meta?: Record<string, any>,
  ) {
    await this.publish(
      'error',
      message,
      meta,
    );
  }

  async debug(
    message: string,
    meta?: Record<string, any>,
  ) {
    await this.publish(
      'debug',
      message,
      meta,
    );
  }

  private async publish(
    level: string,
    message: string,
    meta?: Record<string, any>,
  ) {
    await this.eventBus.publish({
      event: 'system.logs',

      timestamp:
        new Date().toISOString(),

      service: 'auth-service',

      data: {
        level,
        message,
        meta,
      },
    });
  }
}