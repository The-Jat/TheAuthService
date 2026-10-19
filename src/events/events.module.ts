import { Global, Module } from '@nestjs/common';
import { EventBusService } from './event-bus.service';
import { AppLogger } from './app-logger.service';

@Global()
@Module({
  providers: [EventBusService, AppLogger],
  exports: [EventBusService, AppLogger],
})
export class EventsModule {}
