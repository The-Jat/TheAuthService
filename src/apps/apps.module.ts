import { Module } from '@nestjs/common';
import { AppsService } from './apps.service';
import { DatabaseModule } from '../database/database.module';
import { PostgresAppRepository } from './repositories/postgres-app.repository';

@Module({
  imports: [DatabaseModule],
  providers: [
    AppsService,
    {
        provide: 'AppRepository',
        useClass: PostgresAppRepository,
    }
],
  exports: [AppsService],
})
export class AppsModule {}