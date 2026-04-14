import { Module } from '@nestjs/common';
import { AppsService } from './apps.service';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [AppsService],
  exports: [AppsService],
})
export class AppsModule {}