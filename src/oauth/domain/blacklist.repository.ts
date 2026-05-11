export interface BlacklistRepository {
  add(token: string, expiresAt: number): Promise<void>;

  exists(token: string): Promise<boolean>;
}