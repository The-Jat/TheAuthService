// authentication/domain/authentication-result.ts

import { AuthProviderType } from './auth-provider.types';

export interface AuthenticationResult {
  userId: number;
  provider: AuthProviderType;
}