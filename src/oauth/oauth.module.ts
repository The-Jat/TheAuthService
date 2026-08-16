import { forwardRef, Module } from '@nestjs/common';

import { OAuthController } from './presentation/controllers/oauth.controller';
import { OAuthService } from './application/oauth.service';

import { UsersModule } from 'src/users/users.module';
import { AppsModule } from 'src/apps/apps.module';

import { AuthModule } from '@core/auth/auth.module';
import { AuthenticationModule } from 'src/authentication/authentication.module';
import { OAuthLoginService } from './application/oauth-login.service';

@Module({
  imports: [
    AuthModule,
    AuthenticationModule,
    UsersModule,
    AppsModule,
  ],

  controllers: [OAuthController],

  providers: [
    OAuthService,
    OAuthLoginService,
  ],

  exports: [
    OAuthService,
    OAuthLoginService,
  ],
})
export class OAuthModule {}