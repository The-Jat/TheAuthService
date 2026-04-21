import { forwardRef, Module } from '@nestjs/common';
import { AuthService } from './application/auth.service';
import { AuthController } from './presentation/controllers/auth.controller';
import { UsersModule } from 'src/users/users.module';
import { AuthCoreModule } from './auth-core.module';
import { AppsModule } from 'src/apps/apps.module';
import { DatabaseModule } from 'src/database/database.module';
import { OAuthService } from './application/oauth.service';
import { TokenService } from './application/token.service';
import { PgCodeRepository } from './infrastructure/repositories/pg-code.repository';
import { PgTokenRepository } from './infrastructure/repositories/pg-token.repository';
import { PgBlacklistRepository } from './infrastructure/repositories/pg-blacklist.repository';
import { JwtAuthGuard } from './presentation/guards/jwt.guard';

@Module({
  providers: [
    AuthService,
    OAuthService,
    TokenService,
    JwtAuthGuard,
    {
      provide: 'CodeRepository',
      useClass: PgCodeRepository,
    },
    {
      provide: 'TokenRepository',
      useClass: PgTokenRepository,
    },
    {
      provide: 'BlacklistRepository',
      useClass: PgBlacklistRepository,
    }
  ],
  controllers: [AuthController],
  imports: [
    forwardRef(() => UsersModule),
    AuthCoreModule,
    AppsModule,
    DatabaseModule,
  ],
  exports: ['CodeRepository', 'TokenRepository', 'BlacklistRepository', JwtAuthGuard, AuthCoreModule],
})
export class AuthModule {}
