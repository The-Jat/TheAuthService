import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { DatabaseModule } from '../database/database.module';
import { AuthCoreModule } from 'src/auth/auth-core.module';
import { PostgresUserRepository } from './repositories/postgres-user.repository';
import { BlacklistModule } from 'src/auth/blacklist.module';

@Module({
  imports: [
    DatabaseModule, AuthCoreModule, BlacklistModule
  ],
  providers: [
    UsersService,
    {
      provide: 'UserRepository',
      useClass: PostgresUserRepository,
    }
  ],
  controllers: [UsersController],
  exports: [UsersService],
})
export class UsersModule {}