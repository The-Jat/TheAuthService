import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { DatabaseModule } from '../database/database.module';
import { PgUserRepository } from './infrastructure/pg-user.repository';
import { OAuthModule } from 'src/oauth/oauth.module';
import { UsersService } from './users.service';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => OAuthModule),
  ],
  providers: [
    UsersService,
    {
      provide: 'UserRepository',
      useClass: PgUserRepository,
    }
  ],
  controllers: [UsersController],
  exports: ['UserRepository'],
})
export class UsersModule {}