import { Global, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { PasswordsService } from './passwords.service';

@Global()
@Module({
  providers: [UsersService, PasswordsService],
  exports: [UsersService, PasswordsService],
})
export class UsersModule {}
