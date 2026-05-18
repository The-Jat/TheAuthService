import { Module } from '@nestjs/common';

import { EventsModule } from 'src/core/events/events.module';

// import { UserCreatedConsumer } from './consumers/user-created.consumer';

@Module({
  imports: [EventsModule],

  providers: [
    // UserCreatedConsumer,
  ],
})
export class NotificationsModule {}