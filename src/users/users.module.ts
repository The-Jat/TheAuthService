import { forwardRef, Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { DatabaseModule } from '../database/database.module';
import { PgUserRepository } from './infrastructure/pg-user.repository';
import { AuthModule } from 'src/auth/auth.module';
import { UsersService } from './users.service';

@Module({
  imports: [
    DatabaseModule,
    forwardRef(() => AuthModule),
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