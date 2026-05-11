import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service';
import { CodeRepository } from '../../domain/code.repository';
import { AuthCode } from '../../domain/auth-code';

@Injectable()
export class PgCodeRepository implements CodeRepository {
  constructor(private db: DatabaseService) {}

  async create(
    userId: number,
    clientId: string,
    code: string,
    expiresAt: Date,
    redirectUri: string,
    codeChallenge: string,
    codeChallengeMethod: string,
  ): Promise<void> {
    await this.db.query(
      `INSERT INTO auth_codes (user_id, client_id, code, expires_at, redirect_uri, code_challenge, code_challenge_method)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, clientId, code, expiresAt, redirectUri, codeChallenge, codeChallengeMethod],
    );
  }

  async find(code: string): Promise<AuthCode | null> {
    const res = await this.db.query(
      `SELECT * FROM auth_codes WHERE code = $1`,
      [code],
    );

    if (!res[0]) return null;

    const c = res[0];

    return new AuthCode(
      c.code,
      c.user_id,
      c.client_id,
      c.redirect_uri,
      c.expires_at,
      c.code_challenge,
      c.code_challenge_method,
    );
  }

  async delete(code: string): Promise<void> {
    await this.db.query(
      `DELETE FROM auth_codes WHERE code = $1`,
      [code],
    );
  }
}