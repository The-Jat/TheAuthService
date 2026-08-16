import { Injectable } from '@nestjs/common';

import { User } from 'src/users/domain/user';

import type { AuthenticationProvider }
from '../../domain/authentication-provider';
import { AuthProviderType } from 'src/authentication/domain/auth-provider.types';

@Injectable()
export class PasskeyProvider implements AuthenticationProvider {

  type(): AuthProviderType {
    return AuthProviderType.PASSKEY;
  }

  async authenticate(): Promise<User | null> {

    throw new Error(
      'Passkey authentication not implemented',
    );
  }
}