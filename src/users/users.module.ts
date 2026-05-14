import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { DatabaseModule } from '../database/database.module';
import { PgUserRepository } from './infrastructure/pg-user.repository';
import { OAuthModule } from 'src/oauth/oauth.module';
import { UsersService } from './users.service';
import { AuthModule } from 'src/core/auth/auth.module';
import { EventsModule } from 'src/core/events/events.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    EventsModule,
  ],
  providers: [
    UsersService,
    {
      provide: 'UserRepository',
      useClass: PgUserRepository,
    }
  ],
  controllers: [UsersController],
  exports: ['UserRepository', UsersService],
})
export class UsersModule {}