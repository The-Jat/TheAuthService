import { Injectable } from '@nestjs/common';

import { AuthenticationProvider } from '../domain/authentication-provider';
import { AuthProviderType } from '../domain/auth-provider.types';

@Injectable()
export class AuthenticationRegistry {

  private providers =
    new Map<
      AuthProviderType,
      AuthenticationProvider
    >();

  register(
    provider: AuthenticationProvider,
  ) {
    this.providers.set(
      provider.type(),
      provider,
    );
  }

  get(
    type: AuthProviderType,
  ): AuthenticationProvider {

    const provider =
      this.providers.get(type);

    if (!provider) {
      throw new Error(
        `Provider ${type} not registered`,
      );
    }

    return provider;
  }
}