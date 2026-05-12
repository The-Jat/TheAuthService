import { Module , forwardRef} from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';

import { AuthService } from './application/auth.service';
import { TokenService } from './application/token.service';

import { PgTokenRepository } from './infrastructure/repositories/pg-token.repository';
import { PgCodeRepository } from './infrastructure/repositories/pg-code.repository';
import { PgBlacklistRepository } from './infrastructure/repositories/pg-blacklist.repository';

import { UsersModule } from 'src/users/users.module';
import { DatabaseModule } from 'src/database/database.module';
import { OAuthService } from 'src/oauth/application/oauth.service';
import { JwtAuthGuard } from './presentation/guards/jwt.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secretKey',
      signOptions: {
        expiresIn: '1d',
      },
    }),

    DatabaseModule,
  ],

  providers: [
    AuthService,
    TokenService,
    JwtAuthGuard,

    {
      provide: 'TokenRepository',
      useClass: PgTokenRepository,
    },

    {
      provide: 'CodeRepository',
      useClass: PgCodeRepository,
    },

    {
      provide: 'BlacklistRepository',
      useClass: PgBlacklistRepository,
    },
  ],

  exports: [
    JwtAuthGuard,
    JwtModule,

    AuthService,
    TokenService,

    'TokenRepository',
    'CodeRepository',
    'BlacklistRepository',
  ],
})
export class AuthModule {}