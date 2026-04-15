import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import type { BlacklistRepository } from '../interfaces/blacklist.repository';

@Injectable()
export class PostgresBlacklistRepository implements BlacklistRepository {
  constructor(private db: DatabaseService) {}

  async add(token: string, expiresAt: number) {
    await this.db.query(
      `INSERT INTO token_blacklist (token, expires_at)
       VALUES ($1, to_timestamp($2))`,
      [token, expiresAt],
    );
  }

  async exists(token: string): Promise<boolean> {
    const res = await this.db.query(
      `SELECT 1 FROM token_blacklist WHERE token = $1`,
      [token],
    );

    return !!res[0];
  }
}