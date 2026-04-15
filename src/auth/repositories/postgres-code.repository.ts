import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import { CodeRepository } from "../interfaces/code.repository";

@Injectable()
export class PostgresCodeRepository implements CodeRepository {
  constructor(private db: DatabaseService) {}

  async create(userId: number, clientId: string, code: string, expiresAt: number) {
    await this.db.query(
      `INSERT INTO auth_codes (user_id, client_id, code, expires_at)
       VALUES ($1, $2, $3, to_timestamp($4))`,
      [userId, clientId, code, expiresAt],
    );
  }

  async find(code: string) {
    const res = await this.db.query(
      `SELECT * FROM auth_codes WHERE code = $1`,
      [code],
    );
    return res[0];
  }

  async delete(code: string) {
    await this.db.query(
      `DELETE FROM auth_codes WHERE code = $1`,
      [code],
    );
  }
}