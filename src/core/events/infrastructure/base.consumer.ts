import {
  OnModuleInit,
  Logger,
} from '@nestjs/common';

import { RabbitMQConnection } from './rabbitmq.connection';

export abstract class BaseConsumer
  implements OnModuleInit
{
  protected abstract queue: string;

  protected abstract routingKeys: string[];

  protected abstract consumerName: string;

  protected logger: Logger;

  constructor(
    protected rabbit: RabbitMQConnection,
  ) {
    this.logger = new Logger(
      this.constructor.name,
    );
  }

  async onModuleInit() {
    const channel =
      this.rabbit.getChannel();

    // ASSERT QUEUE
    await channel.assertQueue(
      this.queue,
      {
        durable: true,
      },
    );

    // BIND ROUTING KEYS
    for (const key of this.routingKeys) {
      await channel.bindQueue(
        this.queue,
        'domain.events',
        key,
      );
    }

    // START CONSUMING
    channel.consume(
      this.queue,
      async (msg) => {
        if (!msg) return;

        try {
          const payload = JSON.parse(
            msg.content.toString(),
          );

          this.logger.log(
            `Received event: ${payload.event}`,
          );

          await this.handle(payload);

          channel.ack(msg);
        } catch (err) {
          this.logger.error(
            err.message,
          );

          channel.nack(
            msg,
            false,
            false,
          );
        }
      },
    );

    this.logger.log(
      `Consumer started`,
    );
  }

  protected abstract handle(
    payload: any,
  ): Promise<void>;
}