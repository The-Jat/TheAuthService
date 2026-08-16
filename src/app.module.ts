import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OAuthModule } from './oauth/oauth.module';
import { UsersModule } from './users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from './database/database.module';
import { InternalModule } from './internal/internal.module';
import { CorrelationMiddleware } from './core/logging/correlation.middleware';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthenticationModule } from './authentication/authentication.module';

@Module({
  imports: [AuthenticationModule, UsersModule, OAuthModule, JwtModule.register({
      secret: 'supersecret', // temporary (we'll upgrade to RSA later)
      signOptions: { expiresIn: '1h' },
    }), DatabaseModule, InternalModule, DashboardModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {

  // Correlation Id
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(
      CorrelationMiddleware,
    )
    .forRoutes('*');
  }

}
