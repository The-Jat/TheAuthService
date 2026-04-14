import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { JwtModule } from '@nestjs/jwt';
import { DatabaseModule } from './database/database.module';
import { InternalModule } from './internal/internal.module';

@Module({
  imports: [UsersModule, AuthModule, JwtModule.register({
      secret: 'supersecret', // temporary (we'll upgrade to RSA later)
      signOptions: { expiresIn: '1h' },
    }), DatabaseModule, InternalModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
