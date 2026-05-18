import { Module } from '@nestjs/common';

import { EventsModule } from 'src/core/events/events.module';

import { CentralLoggerService } from './application/central-logger.service';

@Module({
  imports: [EventsModule],

  providers: [CentralLoggerService],

  exports: [CentralLoggerService],
})
export class LoggerModule {}