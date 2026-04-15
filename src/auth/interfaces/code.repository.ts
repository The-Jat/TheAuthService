export interface CodeRepository {
  create(userId: number, clientId: string, code: string, expiresAt: number): Promise<void>;
  find(code: string): Promise<any>;
  delete(code: string): Promise<void>;
}