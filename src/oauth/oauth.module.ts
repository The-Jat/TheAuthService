import { forwardRef, Module } from '@nestjs/common';

import { OAuthController } from './presentation/controllers/oauth.controller';
import { OAuthService } from './application/oauth.service';

import { UsersModule } from 'src/users/users.module';
import { AppsModule } from 'src/apps/apps.module';

import { AuthModule } from '@core/auth/auth.module';

@Module({
  imports: [
    AuthModule,
    UsersModule,
    AppsModule,
  ],

  controllers: [OAuthController],

  providers: [
    OAuthService,
  ],

  exports: [
  ],
})
export class OAuthModule {}