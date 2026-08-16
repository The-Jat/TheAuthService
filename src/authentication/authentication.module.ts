import { Module } from '@nestjs/common';

import { UsersModule } from 'src/users/users.module';

import { AuthenticationService } from './application/authentication.service';
import { PasswordProvider } from './providers/password/password.provider';
import { PasskeyProvider } from './providers/passkey/passkey.provider';
import { AuthenticationRegistry } from './domain/authentication-registry.service';
import { DiscoveryService } from './application/discovery.service';
import { PgCredentialRepository } from './infrastructure/pg-credential.repository';
// import { AuthenticationController } from './presentation/authentication.controller';
import { DatabaseModule } from 'src/database/database.module';
import { AuthenticationController } from './presentation/authentication.controller';
import { SessionService } from './application/session.service';
import { PgSessionRepository } from './infrastructure/pg-session.repository';

@Module({
  imports: [UsersModule, DatabaseModule],

  providers: [
    AuthenticationRegistry,
    DiscoveryService,
    AuthenticationService,
    PasswordProvider,
    PasskeyProvider,

    {
      provide: 'CredentialRepository',
      useClass: PgCredentialRepository,
    },

    SessionService,
    {
      provide: 'SessionRepository',
      useClass: PgSessionRepository,
    }
  ],

  exports: [
    AuthenticationService,
    DiscoveryService,
    SessionService,
  ],
  controllers: [
    AuthenticationController,
  ],
})
export class AuthenticationModule {}