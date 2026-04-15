import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { AppRepository } from '../interfaces/app.repository';

@Injectable()
export class PostgresAppRepository implements AppRepository {
  constructor(private db: DatabaseService) {}

  async findByClientId(clientId: string) {
    const apps = await this.db.query(
      `SELECT * FROM apps WHERE client_id = $1`,
      [clientId],
    );

    return apps[0];
  }
}