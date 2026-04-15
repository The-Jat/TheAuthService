export interface AppRepository {
  findByClientId(clientId: string): Promise<any>;
}