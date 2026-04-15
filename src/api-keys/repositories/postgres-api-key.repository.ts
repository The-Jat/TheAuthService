import { Injectable } from "@nestjs/common";
import { DatabaseService } from "src/database/database.service";
import type { ApiKeyRepository } from "../interfaces/api-key.repository";

@Injectable()
export class PostgresApiKeyRepository implements ApiKeyRepository {
  constructor(private db: DatabaseService) {}

  async findKey(key: string) {
    const keys = await this.db.query(
      `SELECT * FROM api_keys WHERE key = $1 AND is_active = true`,
      [key],
    );

    return keys[0];
  }
}