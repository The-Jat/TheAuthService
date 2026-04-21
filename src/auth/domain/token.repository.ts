export interface TokenRepository {
  // saveRefreshToken(userId: number, token: string): Promise<void>;
  saveRefreshToken(data: {
    token: string;
    user_id: number;
    expires_at: Date;
  });

  findRefreshToken(token: string): Promise<any>;

  deleteRefreshToken(token: string): Promise<void>;
}