import { Injectable } from '@nestjs/common';
import { randomToken, sha256 } from '../common/crypto';
import { DatabaseService, Queryable } from '../database/database.service';

export type EmailTokenPurpose = 'verify_email' | 'reset_password';

const TTL_MINUTES: Record<EmailTokenPurpose, number> = {
  verify_email: 24 * 60,
  reset_password: 30,
};

@Injectable()
export class EmailTokensService {
  constructor(private readonly db: DatabaseService) {}

  /** Issues a new link token, invalidating earlier unused ones for the same purpose. */
  async issue(userId: string, purpose: EmailTokenPurpose): Promise<{ token: string; expiresAt: Date }> {
    const token = randomToken(32);
    await this.db.query(`UPDATE email_tokens SET used_at = now() WHERE user_id = $1 AND purpose = $2 AND used_at IS NULL`, [
      userId,
      purpose,
    ]);
    const row = await this.db.one<{ expires_at: Date }>(
      `INSERT INTO email_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(mins => $4)) RETURNING expires_at`,
      [userId, purpose, sha256(token), TTL_MINUTES[purpose]],
    );
    return { token, expiresAt: row!.expires_at };
  }

  /** Atomically marks the token used and returns its user, or null if invalid/expired/used. */
  async consume(token: string, purpose: EmailTokenPurpose, client?: Queryable): Promise<string | null> {
    if (!token || token.length > 100) return null;
    const row = await this.db.one<{ user_id: string }>(
      `UPDATE email_tokens SET used_at = now()
       WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()
       RETURNING user_id`,
      [sha256(token), purpose],
      client,
    );
    return row?.user_id ?? null;
  }

  /** Read-only check used by the reset page to show "link expired" before asking for a password. */
  async peek(token: string, purpose: EmailTokenPurpose): Promise<boolean> {
    if (!token || token.length > 100) return false;
    return !!(await this.db.one(
      `SELECT 1 FROM email_tokens WHERE token_hash = $1 AND purpose = $2 AND used_at IS NULL AND expires_at > now()`,
      [sha256(token), purpose],
    ));
  }
}
