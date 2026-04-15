export interface TokenRepository {
  saveRefreshToken(userId: number, token: string): Promise<void>;
  findRefreshToken(token: string): Promise<any>;
  deleteRefreshToken(token: string): Promise<void>;
}