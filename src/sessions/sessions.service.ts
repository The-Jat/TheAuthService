import { Injectable } from '@nestjs/common';
import type { Request, Response } from 'express';
import { config } from '../config/config';
import { randomToken, sha256 } from '../common/crypto';
import { RequestMeta } from '../common/request-context';
import { DatabaseService } from '../database/database.service';
import { User } from '../users/users.types';
import { PublicSession, Session } from './sessions.types';

@Injectable()
export class SessionsService {
  constructor(private readonly db: DatabaseService) {}

  /** Creates a session row and returns the raw cookie value (never stored). */
  async create(userId: string, meta: RequestMeta, authMethod: string): Promise<{ token: string; session: Session }> {
    const token = randomToken(32);
    const session = (await this.db.one<Session>(
      `INSERT INTO sessions (user_id, token_hash, ip, user_agent, auth_method, expires_at)
       VALUES ($1, $2, $3, $4, $5, now() + make_interval(days => $6)) RETURNING *`,
      [userId, sha256(token), meta.ip ?? null, meta.userAgent ?? null, authMethod, config.session.ttlDays],
    )) as Session;
    return { token, session };
  }

  /** Resolves a cookie value to an active session and its (active) user. */
  async resolve(token: string | undefined): Promise<{ session: Session; user: User } | null> {
    if (!token || token.length > 100) return null;
    const row = await this.db.one<Session & { u: User }>(
      `SELECT s.*, row_to_json(u.*) AS u FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1 AND s.revoked_at IS NULL AND s.expires_at > now() AND u.status = 'active'`,
      [sha256(token)],
    );
    if (!row) return null;
    const { u, ...session } = row;
    // Touch at most once a minute to avoid a write on every request.
    if (Date.now() - new Date(session.last_used_at).getTime() > 60_000) {
      await this.db.query('UPDATE sessions SET last_used_at = now() WHERE id = $1', [session.id]);
    }
    const user: User = {
      ...u,
      email_verified_at: u.email_verified_at ? new Date(u.email_verified_at) : null,
      locked_until: u.locked_until ? new Date(u.locked_until) : null,
      last_login_at: u.last_login_at ? new Date(u.last_login_at) : null,
      created_at: new Date(u.created_at),
      updated_at: new Date(u.updated_at),
    };
    return { session, user };
  }

  async listForUser(userId: string, currentId?: string): Promise<PublicSession[]> {
    const rows = await this.db.query<Session>(
      `SELECT * FROM sessions WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > now() ORDER BY last_used_at DESC`,
      [userId],
    );
    return rows.map((s) => ({
      id: s.id,
      ip: s.ip,
      userAgent: s.user_agent,
      authMethod: s.auth_method,
      createdAt: s.created_at.toISOString(),
      lastUsedAt: s.last_used_at.toISOString(),
      current: s.id === currentId,
    }));
  }

  /** Revoking a session also kills refresh tokens issued through it. */
  async revoke(sessionId: string, userId?: string) {
    const params: unknown[] = [sessionId];
    let cond = 'id = $1';
    if (userId) {
      params.push(userId);
      cond += ' AND user_id = $2';
    }
    const rows = await this.db.query(`UPDATE sessions SET revoked_at = now() WHERE ${cond} AND revoked_at IS NULL RETURNING id`, params);
    if (rows.length) {
      await this.db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE session_id = $1 AND revoked_at IS NULL', [sessionId]);
    }
    return rows.length > 0;
  }

  async revokeAllForUser(userId: string, exceptSessionId?: string) {
    await this.db.query(
      `UPDATE sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL AND ($2::uuid IS NULL OR id <> $2)`,
      [userId, exceptSessionId ?? null],
    );
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL
         AND ($2::uuid IS NULL OR session_id IS DISTINCT FROM $2)`,
      [userId, exceptSessionId ?? null],
    );
  }

  readCookie(req: Request): string | undefined {
    return req.cookies?.[config.session.cookieName];
  }

  setCookie(res: Response, token: string) {
    res.cookie(config.session.cookieName, token, {
      httpOnly: true,
      secure: config.isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: config.session.ttlDays * 24 * 60 * 60 * 1000,
    });
  }

  clearCookie(res: Response) {
    res.clearCookie(config.session.cookieName, { httpOnly: true, secure: config.isProduction, sameSite: 'lax', path: '/' });
  }
}
