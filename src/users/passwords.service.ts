import { BadRequestException, Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';
import { DatabaseService, Queryable } from '../database/database.service';
import { randomToken } from '../common/crypto';

const HASH_OPTIONS = { algorithm: 2, memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

@Injectable()
export class PasswordsService {
  // A real hash to verify against when the account doesn't exist, so response
  // time doesn't reveal whether an email is registered.
  private readonly dummyHash = hash(randomToken(), HASH_OPTIONS);

  constructor(private readonly db: DatabaseService) {}

  /** Rejects passwords that are too short or too long for argon2 to be sensible. */
  assertAcceptable(password: string, email?: string) {
    if (typeof password !== 'string' || password.length < 10) {
      throw new BadRequestException('Password must be at least 10 characters.');
    }
    if (password.length > 256) {
      throw new BadRequestException('Password must be at most 256 characters.');
    }
    if (email && password.toLowerCase().includes(email.split('@')[0].toLowerCase()) && email.split('@')[0].length >= 4) {
      throw new BadRequestException('Password must not contain your email name.');
    }
  }

  async set(userId: string, password: string, client?: Queryable) {
    const passwordHash = await hash(password, HASH_OPTIONS);
    await this.db.query(
      `INSERT INTO password_credentials (user_id, password_hash) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()`,
      [userId, passwordHash],
      client,
    );
  }

  async has(userId: string) {
    return !!(await this.db.one('SELECT 1 FROM password_credentials WHERE user_id = $1', [userId]));
  }

  /** Returns true when `password` matches; always does the same amount of work. */
  async check(userId: string | null, password: string): Promise<boolean> {
    const row = userId
      ? await this.db.one<{ password_hash: string }>('SELECT password_hash FROM password_credentials WHERE user_id = $1', [userId])
      : null;
    try {
      const ok = await verify(row?.password_hash ?? (await this.dummyHash), password);
      return !!row && ok;
    } catch {
      return false;
    }
  }
}
