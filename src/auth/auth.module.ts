import { Global, Module } from '@nestjs/common';
import { PasskeysService } from '../passkeys/passkeys.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailTokensService } from './email-tokens.service';

@Global()
@Module({
  controllers: [AuthController],
  providers: [AuthService, EmailTokensService, PasskeysService],
  exports: [AuthService, EmailTokensService, PasskeysService],
})
export class AuthModule {}
