import { Module } from '@nestjs/common';

import { DashboardController }
from './dashboard.controller';

import { AuthenticationModule } from 'src/authentication/authentication.module';

import { AuthModule }
from 'src/core/auth/auth.module';

@Module({
  imports: [
    AuthenticationModule,
    AuthModule,
  ],

  controllers: [
    DashboardController,
  ],
})
export class DashboardModule {}