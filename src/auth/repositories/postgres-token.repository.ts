import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { TokenRepository } from "../interfaces/token.repository";

@Injectable()
export class PostgresTokenRepository implements TokenRepository {
  constructor(private db: DatabaseService) {}

  async saveRefreshToken(userId: number, token: string) {
    await this.db.query(
      `INSERT INTO refresh_tokens (user_id, token)
       VALUES ($1, $2)`,
      [userId, token],
    );
  }

  async findRefreshToken(token: string) {
    const res = await this.db.query(
      `SELECT * FROM refresh_tokens WHERE token = $1`,
      [token],
    );
    return res[0];
  }

  async deleteRefreshToken(token: string) {
    let res = await this.db.query(
      `DELETE FROM refresh_tokens WHERE token = $1`,
      [token],
    );
    console.log(res);
  }
}