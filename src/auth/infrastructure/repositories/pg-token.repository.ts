import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { TokenRepository } from '../../domain/token.repository';

@Injectable()
export class PgTokenRepository implements TokenRepository {
  constructor(private db: DatabaseService) {}

  // async saveRefreshToken(userId: number, token: string): Promise<void> {
  //   await this.db.query(
  //     `INSERT INTO refresh_tokens (user_id, token)
  //      VALUES ($1, $2)`,
  //     [userId, token],
  //   );
  // }
  async saveRefreshToken(data) {
    await this.db.query(
      `INSERT INTO refresh_tokens (token, user_id, expires_at)
     VALUES ($1, $2, $3)`,
      [data.token, data.user_id, data.expires_at],
    );
  }

  async findRefreshToken(token: string) {
    const res = await this.db.query(
      `SELECT * FROM refresh_tokens WHERE token = $1`,
      [token],
    );

    return res[0];
  }

  async deleteRefreshToken(token: string): Promise<void> {
    await this.db.query(
      `DELETE FROM refresh_tokens WHERE token = $1`,
      [token],
    );
  }
}