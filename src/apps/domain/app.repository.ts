import { App } from "./app";

export interface AppRepository {
  create(data: {
    user_id: number;
    name: string;
    redirect_uri: string;
    scopes: string;
  }): Promise<App>;

  findByClientId(clientId: string): Promise<App | null>;
}