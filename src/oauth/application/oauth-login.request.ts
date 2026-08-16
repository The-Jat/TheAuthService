// src/oauth/application/oauth-login.request.ts

import { AuthProviderType }
from 'src/authentication/domain/auth-provider.types';

export interface OAuthLoginRequest {
  provider: AuthProviderType;
  payload: any;
  client_id: string;
  redirect_uri: string;
  state: string;
  code_challenge: string;
  code_challenge_method: string;
}