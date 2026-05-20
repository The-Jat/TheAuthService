import { Module } from '@nestjs/common';

import { DashboardController }
from './dashboard.controller';

import { UsersModule }
from 'src/users/users.module';

import { AuthModule }
from 'src/core/auth/auth.module';

@Module({
  imports: [
    UsersModule,
    AuthModule,
  ],

  controllers: [
    DashboardController,
  ],
})
export class DashboardModule {}