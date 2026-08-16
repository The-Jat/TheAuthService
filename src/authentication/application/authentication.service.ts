import {
  Injectable,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';

import { PasswordProvider } from '../providers/password/password.provider';
import { PasskeyProvider } from '../providers/passkey/passkey.provider';

import { AuthenticationRegistry } from '../domain/authentication-registry.service';

import { AuthProviderType } from '../domain/auth-provider.types';
import { User } from 'src/users/domain/user';
import { AuthenticationResult } from '../domain/authentication-result';

@Injectable()
export class AuthenticationService
  implements OnModuleInit {

  constructor(
    private registry:
      AuthenticationRegistry,

    private passwordProvider:
      PasswordProvider,

    private passkeyProvider:
      PasskeyProvider,
  ) { }

  onModuleInit() {

    this.registry.register(
      this.passwordProvider,
    );

    this.registry.register(
      this.passkeyProvider,
    );
  }

  async authenticate(
    provider: AuthProviderType,
    request: any,
  ): Promise<AuthenticationResult> {
    const user = await this.registry
      .get(provider)
      .authenticate(request);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials',);
    }

    return {
      userId: user.id,
      provider,
    };
  }
}