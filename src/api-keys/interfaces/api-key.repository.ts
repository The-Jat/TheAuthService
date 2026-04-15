export interface ApiKeyRepository {
  findKey(key: string): Promise<any>;
}