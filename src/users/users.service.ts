import { Injectable } from '@nestjs/common';
import { config } from '../config/config';
import { DatabaseService, Queryable } from '../database/database.service';
import { Role, User, UserStatus } from './users.types';

@Injectable()
export class UsersService {
  constructor(private readonly db: DatabaseService) {}

  findById(id: string, client?: Queryable) {
    return this.db.one<User>('SELECT * FROM users WHERE id = $1', [id], client);
  }

  findByEmail(email: string, client?: Queryable) {
    return this.db.one<User>('SELECT * FROM users WHERE lower(email) = lower($1)', [email], client);
  }

  create(email: string, name: string, client?: Queryable) {
    return this.db.one<User>(
      'INSERT INTO users (email, name) VALUES ($1, $2) RETURNING *',
      [email.trim(), name.trim()],
      client,
    ) as Promise<User>;
  }

  /** Marks the email verified and grants admin to addresses listed in ADMIN_EMAILS. */
  async markEmailVerified(userId: string, client?: Queryable): Promise<User> {
    const user = (await this.db.one<User>(
      `UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()), updated_at = now()
       WHERE id = $1 RETURNING *`,
      [userId],
      client,
    )) as User;
    if (user.role !== 'admin' && config.adminEmails.includes(user.email.toLowerCase())) {
      return this.setRole(user.id, 'admin', client) as Promise<User>;
    }
    return user;
  }

  async recordFailedLogin(userId: string) {
    await this.db.query(
      `UPDATE users SET failed_logins = failed_logins + 1,
         locked_until = CASE WHEN failed_logins + 1 >= $2 THEN now() + make_interval(mins => $3) ELSE locked_until END
       WHERE id = $1`,
      [userId, config.security.maxFailedLogins, config.security.lockMinutes],
    );
  }

  async recordSuccessfulLogin(userId: string) {
    await this.db.query(
      'UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1',
      [userId],
    );
  }

  updateName(userId: string, name: string) {
    return this.db.one<User>('UPDATE users SET name = $2, updated_at = now() WHERE id = $1 RETURNING *', [userId, name.trim()]);
  }

  setRole(userId: string, role: Role, client?: Queryable) {
    return this.db.one<User>('UPDATE users SET role = $2, updated_at = now() WHERE id = $1 RETURNING *', [userId, role], client);
  }

  setStatus(userId: string, status: UserStatus) {
    return this.db.one<User>(
      `UPDATE users SET status = $2, updated_at = now(),
         failed_logins = CASE WHEN $2 = 'active' THEN 0 ELSE failed_logins END,
         locked_until = CASE WHEN $2 = 'active' THEN NULL ELSE locked_until END
       WHERE id = $1 RETURNING *`,
      [userId, status],
    );
  }

  async delete(userId: string) {
    await this.db.query('DELETE FROM users WHERE id = $1', [userId]);
  }

  async list(opts: { search?: string; limit: number; offset: number }) {
    const params: unknown[] = [];
    let where = '';
    if (opts.search) {
      params.push(`%${opts.search.toLowerCase()}%`);
      where = `WHERE lower(email) LIKE $1 OR lower(name) LIKE $1`;
    }
    const total = await this.db.one<{ count: string }>(`SELECT count(*) FROM users ${where}`, params);
    params.push(opts.limit, opts.offset);
    const rows = await this.db.query<User>(
      `SELECT * FROM users ${where} ORDER BY created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    return { total: Number(total?.count ?? 0), rows };
  }

  async countAdmins() {
    const row = await this.db.one<{ count: string }>(`SELECT count(*) FROM users WHERE role = 'admin' AND status = 'active'`);
    return Number(row?.count ?? 0);
  }
}
