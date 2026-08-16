// src/authentication/domain/credential.repository.ts

import { AuthProviderType } from './auth-provider.types';

export interface CredentialRepository {
  findMethodsByEmail(
    email: string,
  ): Promise<AuthProviderType[]>;

  findPasswordCredentialByEmail(
    email: string,
  ): Promise<{
    user_id: number;
    password_hash: string;
  } | null>;
}