// import { forwardRef, Module } from '@nestjs/common';
// import { AuthService } from '@core/auth/application/auth.service';
// import { OAuthController } from './presentation/controllers/oauth.controller';
// import { UsersModule } from 'src/users/users.module';
// import { AuthModule } from '@core/auth/auth.module';
// import { AppsModule } from 'src/apps/apps.module';
// import { DatabaseModule } from 'src/database/database.module';
// import { OAuthService } from './application/oauth.service';
// import { TokenService } from '@core/auth/application/token.service';
// import { PgCodeRepository } from '@core/auth/infrastructure/repositories/pg-code.repository';
// import { PgTokenRepository } from '@core/auth/infrastructure/repositories/pg-token.repository';
// import { PgBlacklistRepository } from '@core/auth/infrastructure/repositories/pg-blacklist.repository';
// import { JwtAuthGuard } from '@core/auth/presentation/guards/jwt.guard';

// @Module({
//   providers: [
//     AuthService,
//     OAuthService,
//     TokenService,
//     JwtAuthGuard,
//     {
//       provide: 'CodeRepository',
//       useClass: PgCodeRepository,
//     },
//     {
//       provide: 'TokenRepository',
//       useClass: PgTokenRepository,
//     },
//     {
//       provide: 'BlacklistRepository',
//       useClass: PgBlacklistRepository,
//     }
//   ],
//   controllers: [OAuthController],
//   imports: [
//     forwardRef(() => UsersModule),
//     AuthModule,
//     AppsModule,
//     DatabaseModule,
//   ],
//   exports: ['CodeRepository', 'TokenRepository', 'BlacklistRepository', JwtAuthGuard, AuthModule],
// })
// export class OAuthModule {}


import { forwardRef, Module } from '@nestjs/common';

import { OAuthController } from './presentation/controllers/oauth.controller';
import { OAuthService } from './application/oauth.service';

import { UsersModule } from 'src/users/users.module';
import { AppsModule } from 'src/apps/apps.module';

import { AuthModule } from '@core/auth/auth.module';

@Module({
  imports: [
    // forwardRef(() => UsersModule),
    AuthModule,
    UsersModule,
    AppsModule,
  ],

  controllers: [OAuthController],

  providers: [
    OAuthService,
  ],

  exports: [
    // OAuthService,
  ],
})
export class OAuthModule {}