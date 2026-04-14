import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class AppsService {
  constructor(private db: DatabaseService) {}

  async findByClientId(clientId: string) {
    const apps = await this.db.query(
      `SELECT * FROM apps WHERE client_id = $1`,
      [clientId],
    );

    return apps[0];
  }
}