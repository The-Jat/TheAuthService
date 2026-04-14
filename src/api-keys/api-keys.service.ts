import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

@Injectable()
export class ApiKeysService {
  constructor(private db: DatabaseService) {}

  async findKey(key: string) {
    const keys = await this.db.query(
      `SELECT * FROM api_keys WHERE key = $1 AND is_active = true`,
      [key],
    );

    return keys[0];
  }
}