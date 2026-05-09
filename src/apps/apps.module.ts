import { forwardRef, Module } from '@nestjs/common';
import { AppsService } from './apps.service';
import { DatabaseModule } from '../database/database.module';
// import { PostgresAppRepository } from './repositories/postgres-app.repository';
import { PgAppRepository } from './infrastructure/pg-app.repository';
import { AppsController } from './presentation/apps.controller';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => AuthModule),
  ],
  providers: [
    AppsService,
    {
        provide: 'AppRepository',
        useClass: PgAppRepository,
    }
],
  controllers: [AppsController],
  exports: ['AppRepository'],
})
export class AppsModule {}