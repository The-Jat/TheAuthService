import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AppRepository } from '../domain/app.repository';
import { App } from '../domain/app';
import { randomBytes } from 'crypto';
import * as bcrypt from 'bcrypt';


@Injectable()
export class PgAppRepository implements AppRepository {
  constructor(private db: DatabaseService) {}

  // async findByClientId(clientId: string): Promise<App | null> {
  //   const res = await this.db.query(
  //     `SELECT * FROM apps WHERE client_id = $1`,
  //     [clientId],
  //   );

  //   if (!res[0]) return null;

  //   const a = res[0];
  //   return new App(
  //     a.id,
  //     a.client_id,
  //     a.client_secret,
  //     a.redirect_uri,
  //     a.scopes,
  //   );
  // }

  async create(data: {
    user_id: number;
    name: string;
    redirect_uri: string;
    scopes: string;
  }): Promise<App> {

    // PUBLIC ID
    const clientId =
      'app_' + randomBytes(16).toString('hex');

    // RAW SECRET
    const rawSecret =
      randomBytes(32).toString('hex');

    // HASHED SECRET
    const hashedSecret =
      await bcrypt.hash(rawSecret, 10);

    const res = await this.db.query(
      `
      INSERT INTO apps
      (
        user_id,
        name,
        client_id,
        client_secret,
        redirect_uri,
        scopes
      )

      VALUES ($1, $2, $3, $4, $5, $6)

      RETURNING *
      `,
      [
        data.user_id,
        data.name,
        clientId,
        hashedSecret,
        data.redirect_uri,
        data.scopes,
      ],
    );

    const app = res[0];

    // RETURN RAW SECRET ONLY ONCE
    return new App(
      app.id,
      app.user_id,
      app.name,
      app.client_id,
      rawSecret,
      app.redirect_uri,
      app.scopes,
      app.created_at,
    );
  }

  async findByClientId(clientId: string): Promise<App | null> {
    const res = await this.db.query(
      `SELECT * FROM apps WHERE client_id = $1`,
      [clientId],
    );

    if (!res[0]) return null;

    const app = res[0];

    return new App(
      app.id,
      app.user_id,
      app.name,
      app.client_id,
      app.client_secret,
      app.redirect_uri,
      app.scopes,
      app.created_at,
    );
  }
}