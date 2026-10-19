import { Global, Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { KeysService } from './keys.service';
import { OAuthController } from './oauth.controller';
import { OAuthService } from './oauth.service';

@Global()
@Module({
  controllers: [OAuthController],
  providers: [OAuthService, ClientsService, KeysService],
  exports: [OAuthService, ClientsService, KeysService],
})
export class OAuthModule {}
