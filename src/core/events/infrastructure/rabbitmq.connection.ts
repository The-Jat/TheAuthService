import {
  Injectable,
  OnModuleInit,
} from '@nestjs/common';

import amqp, {
  Channel,
  ChannelModel,
} from 'amqplib';

@Injectable()
export class RabbitMQConnection
  implements OnModuleInit
{
  private connection: ChannelModel;

  private channel: Channel;

  async onModuleInit() {
    this.connection =
      await amqp.connect(
        process.env.RABBITMQ_URL ||
          'amqp://localhost:5672',
      );

    this.channel =
      await this.connection.createChannel();

    await this.channel.assertExchange(
      'domain.events',
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