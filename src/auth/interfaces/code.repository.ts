export interface CodeRepository {
  create(userId: number, clientId: string, code: string, expiresAt: number, redirectUri): Promise<void>;
  find(code: string): Promise<any>;
  delete(code: string): Promise<void>;
}