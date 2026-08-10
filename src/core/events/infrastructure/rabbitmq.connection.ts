import {
  Injectable,
  OnModuleInit,
} from '@nestjs/common';

import amqp, {
  Channel,
  ChannelModel,
} from 'amqplib';
import { DOMAIN_EXCHANGE } from './constants';

@Injectable()
export class RabbitMQConnection
  implements OnModuleInit
{
  private connection: ChannelModel;
  private channel: Channel;

  async onModuleInit() {
    const rabbitMqUrl = process.env.RABBITMQ_URL;

    if (!rabbitMqUrl) {
      console.log('RabbitMQ disabled');
      return;
    }
    this.connection =
      await amqp.connect(
        process.env.RABBITMQ_URL ||
          'amqp://localhost:5672',
      );

    this.channel =
      await this.connection.createChannel();

    await this.channel.assertExchange(
      DOMAIN_EXCHANGE,
      'topic',
      {
        durable: true,
      },
    );

    console.log(
      '✅ RabbitMQ connected',
    );
  }

  getChannel() {
    return this.channel;
  }
}