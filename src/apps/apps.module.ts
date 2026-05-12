import { forwardRef, Module } from '@nestjs/common';
import { AppsService } from './apps.service';
import { DatabaseModule } from '../database/database.module';
// import { PostgresAppRepository } from './repositories/postgres-app.repository';
import { PgAppRepository } from './infrastructure/pg-app.repository';
import { AppsController } from './presentation/apps.controller';
import { OAuthModule } from 'src/oauth/oauth.module';
import { AuthModule } from 'src/core/auth/auth.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
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