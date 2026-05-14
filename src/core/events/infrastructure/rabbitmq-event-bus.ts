import { Injectable } from '@nestjs/common';

import { EventBus } from '../domain/event-bus';

import { DomainEvent } from '../domain/domain-event';

import { RabbitMQConnection } from './rabbitmq.connection';

@Injectable()
export class RabbitMQEventBus
  implements EventBus
{
  constructor(
    private rabbit: RabbitMQConnection,
  ) {}

  async publish<T>(
    event: DomainEvent<T>,
  ): Promise<void> {
    const channel =
      this.rabbit.getChannel();

    channel.publish(
      'domain.events',
      event.event,
      Buffer.from(
        JSON.stringify(event),
      ),
      {
        persistent: true,
      },
    );

    console.log(
      `📨 Event published: ${event.event}`,
    );
  }
}