import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AppRepository } from '../domain/app.repository';
import { App } from '../domain/app';


@Injectable()
export class PgAppRepository implements AppRepository {
  constructor(private db: DatabaseService) {}

  async findByClientId(clientId: string): Promise<App | null> {
    const res = await this.db.query(
      `SELECT * FROM apps WHERE client_id = $1`,
      [clientId],
    );

    if (!res[0]) return null;

    const a = res[0];
    return new App(
      a.id,
      a.client_id,
      a.client_secret,
      a.redirect_uri,
      a.scopes,
    );
  }
}