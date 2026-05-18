import { Injectable } from '@nestjs/common';

import { BaseConsumer } from 'src/core/events/infrastructure/base.consumer';

import { RabbitMQConnection } from 'src/core/events/infrastructure/rabbitmq.connection';

@Injectable()
export class UserCreatedConsumer
  extends BaseConsumer
{
  protected queue =
    'notification.user.created';

  protected routingKeys = [
    'auth.user.created',
  ];

  protected consumerName =
    'UserCreatedConsumer';

  constructor(
    rabbit: RabbitMQConnection,
  ) {
    super(rabbit);
  }

  protected async handle(
    payload: any,
  ): Promise<void> {
    console.log(
      '📧 SEND WELCOME EMAIL',
    );

    console.log(payload);
  }
}