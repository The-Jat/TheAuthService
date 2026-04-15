import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from 'src/users/users.module';
import { AuthCoreModule } from './auth-core.module';
import { AppsModule } from 'src/apps/apps.module';
import { DatabaseModule } from 'src/database/database.module';
import { PostgresBlacklistRepository } from './repositories/postgres-blacklist.repository';
import { TokenModule } from './token.module';
import { BlacklistModule } from './blacklist.module';

@Module({
  providers: [
    AuthService,
    {
      provide: 'BlacklistRepository',
      useClass: PostgresBlacklistRepository,
    }
  ],
  controllers: [AuthController],
  imports: [
    UsersModule,
    AuthCoreModule,
    AppsModule,
    DatabaseModule,
    TokenModule,
    BlacklistModule,
  ],
})
export class AuthModule {}
