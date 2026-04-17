import { App } from "./app";

export interface AppRepository {
  findByClientId(clientId: string): Promise<App | null>;
}