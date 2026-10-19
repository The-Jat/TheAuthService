import { Injectable, Logger } from '@nestjs/common';
import { EventBusService } from './event-bus.service';

type Level = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured application log. Everything goes to stdout; anything that matters
 * operationally is also shipped to the logger service as `system.log.<level>`.
 */
@Injectable()
export class AppLogger {
  private readonly console = new Logger('App');

  constructor(private readonly bus: EventBusService) {}

  info(message: string, meta?: Record<string, unknown>, correlationId?: string) {
    this.write('info', message, meta, correlationId);
  }

  warn(message: string, meta?: Record<string, unknown>, correlationId?: string) {
    this.write('warn', message, meta, correlationId);
  }

  error(message: string, meta?: Record<string, unknown>, correlationId?: string) {
    this.write('error', message, meta, correlationId);
  }

  private write(level: Level, message: string, meta: Record<string, unknown> = {}, correlationId?: string) {
    const line = Object.keys(meta).length ? `${message} ${JSON.stringify(meta)}` : message;
    if (level === 'error') this.console.error(line);
    else if (level === 'warn') this.console.warn(line);
    else this.console.log(line);
    this.bus.publish(`system.log.${level}`, { level, message, meta }, correlationId);
  }
}
