import { Module } from '@nestjs/common';

import { EventBusService } from './application/event-bus.service';

import { RabbitMQConnection } from './infrastructure/rabbitmq.connection';

import { RabbitMQEventBus } from './infrastructure/rabbitmq-event-bus';

@Module({
  providers: [
    EventBusService,

    RabbitMQConnection,

    {
      provide: 'EventBus',
      useClass: RabbitMQEventBus,
    },
  ],

  exports: [
    EventBusService,
    RabbitMQConnection,
  ],
})
export class EventsModule {}