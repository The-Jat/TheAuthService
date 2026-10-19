import { Controller, Get, MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { SkipThrottle, ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccountController } from './account/account.controller';
import { AdminController } from './admin/admin.controller';
import { InternalClient } from './admin/internal-client.service';
import { AuthModule } from './auth/auth.module';
import { CorrelationMiddleware } from './common/request-context';
import { DatabaseModule } from './database/database.module';
import { DatabaseService } from './database/database.service';
import { EventsModule } from './events/events.module';
import { OAuthModule } from './oauth/oauth.module';
import { SessionsModule } from './sessions/sessions.module';
import { UsersModule } from './users/users.module';

@Controller('health')
@SkipThrottle()
class HealthController {
  constructor(private readonly db: DatabaseService) {}

  @Get()
  async health() {
    await this.db.query('SELECT 1');
    return { status: 'ok', service: 'auth-service' };
  }
}

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    DatabaseModule,
    EventsModule,
    UsersModule,
    SessionsModule,
    AuthModule,
    OAuthModule,
  ],
  controllers: [HealthController, AccountController, AdminController],
  providers: [InternalClient, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationMiddleware).forRoutes('*');
  }
}
