import { AuthCode } from './auth-code';

export interface CodeRepository {
  create(
    userId: number,
    clientId: string,
    code: string,
    expiresAt: Date,
    redirectUri: string,
  ): Promise<void>;

  find(code: string): Promise<AuthCode | null>;

  delete(code: string): Promise<void>;
}