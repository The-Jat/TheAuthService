import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import amqp, { AmqpConnectionManager, ChannelWrapper } from 'amqp-connection-manager';
import type { ConfirmChannel } from 'amqplib';
import { randomUUID } from 'crypto';
import { config } from '../config/config';

export const DOMAIN_EXCHANGE = 'domain.events';
export const SERVICE_NAME = 'auth-service';

/** Envelope shared by every service on the bus. */
export interface DomainEvent<T = Record<string, unknown>> {
  id: string;
  event: string;
  version: 1;
  occurredAt: string;
  service: string;
  correlationId?: string;
  data: T;
}

/**
 * Publishes domain events to a durable topic exchange. Publishing never blocks a
 * user-facing request: if RabbitMQ is down, messages buffer in memory and flush
 * on reconnect (amqp-connection-manager), and failures are logged, not thrown.
 */
@Injectable()
export class EventBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventBusService.name);
  private connection?: AmqpConnectionManager;
  private channel?: ChannelWrapper;

  onModuleInit() {
    if (!config.rabbitmqUrl) {
      this.logger.warn('RABBITMQ_URL not set; events will be dropped');
      return;
    }
    this.connection = amqp.connect([config.rabbitmqUrl]);
    this.connection.on('connect', () => this.logger.log('Connected to RabbitMQ'));
    this.connection.on('disconnect', ({ err }) => this.logger.warn(`RabbitMQ disconnected: ${err?.message}`));
    this.channel = this.connection.createChannel({
      json: false,
      setup: (ch: ConfirmChannel) => ch.assertExchange(DOMAIN_EXCHANGE, 'topic', { durable: true }),
    });
  }

  async onModuleDestroy() {
    await this.channel?.close().catch(() => undefined);
    await this.connection?.close().catch(() => undefined);
  }

  publish<T extends Record<string, unknown>>(event: string, data: T, correlationId?: string): void {
    const envelope: DomainEvent<T> = {
      id: randomUUID(),
      event,
      version: 1,
      occurredAt: new Date().toISOString(),
      service: SERVICE_NAME,
      correlationId,
      data,
    };
    if (!this.channel) return;
    this.channel
      .publish(DOMAIN_EXCHANGE, event, Buffer.from(JSON.stringify(envelope)), {
        persistent: true,
        contentType: 'application/json',
        messageId: envelope.id,
        timeout: 5000,
      })
      .catch((err) => this.logger.error(`Failed to publish ${event}: ${err.message}`));
  }
}
