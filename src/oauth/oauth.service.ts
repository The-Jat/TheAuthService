import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { config } from '../config/config';
import { pkceS256, randomToken, sha256 } from '../common/crypto';
import { RequestMeta } from '../common/request-context';
import { DatabaseService } from '../database/database.service';
import { EventBusService } from '../events/event-bus.service';
import { Session } from '../sessions/sessions.types';
import { UsersService } from '../users/users.service';
import { User } from '../users/users.types';
import { ClientsService, OAuthClient } from './clients.service';
import { KeysService } from './keys.service';
import { OAuthError, UnsafeAuthorizeError } from './oauth.errors';

export interface AuthorizeParams {
  response_type?: string;
  client_id?: string;
  redirect_uri?: string;
  scope?: string;
  state?: string;
  code_challenge?: string;
  code_challenge_method?: string;
  nonce?: string;
  prompt?: string;
  max_age?: string;
}

export interface ValidatedAuthorize {
  client: OAuthClient;
  redirectUri: string;
  scopes: string[];
  state?: string;
  nonce?: string;
  codeChallenge: string;
  prompt: Set<string>;
  maxAge?: number;
}

export const AUTHORIZE_KEYS: (keyof AuthorizeParams)[] = [
  'response_type',
  'client_id',
  'redirect_uri',
  'scope',
  'state',
  'code_challenge',
  'code_challenge_method',
  'nonce',
  'prompt',
  'max_age',
];

interface RefreshRow {
  id: string;
  family_id: string;
  client_id: string;
  user_id: string;
  session_id: string | null;
  scope: string;
  expires_at: Date;
  rotated_at: Date | null;
  revoked_at: Date | null;
}

@Injectable()
export class OAuthService {
  constructor(
    private readonly db: DatabaseService,
    private readonly clients: ClientsService,
    private readonly keys: KeysService,
    private readonly users: UsersService,
    private readonly bus: EventBusService,
  ) {}

  /** Picks only the OIDC parameters out of a query or body object. */
  pickParams(source: Record<string, unknown>): AuthorizeParams {
    const out: AuthorizeParams = {};
    for (const k of AUTHORIZE_KEYS) {
      const v = source[k];
      if (typeof v === 'string' && v.length <= 2048) out[k] = v;
    }
    return out;
  }

  async validateAuthorize(p: AuthorizeParams): Promise<ValidatedAuthorize> {
    const client = await this.clients.findByClientId(p.client_id ?? '');
    if (!client || client.disabled_at) throw new UnsafeAuthorizeError('invalid_client', 'This application is not registered or has been disabled.');
    if (!p.redirect_uri || !client.redirect_uris.includes(p.redirect_uri)) {
      throw new UnsafeAuthorizeError('invalid_redirect_uri', 'The redirect address does not match this application’s registration.');
    }
    const base = { redirectUri: p.redirect_uri, state: p.state };
    if (p.response_type !== 'code') throw this.redirectError(base, 'unsupported_response_type', 'Only response_type=code is supported.');
    if (!p.code_challenge || p.code_challenge_method !== 'S256' || !/^[A-Za-z0-9_-]{43,128}$/.test(p.code_challenge)) {
      throw this.redirectError(base, 'invalid_request', 'PKCE with code_challenge_method=S256 is required.');
    }
    const scopes = [...new Set((p.scope ?? 'openid').split(/\s+/).filter(Boolean))];
    const disallowed = scopes.filter((s) => !client.allowed_scopes.includes(s));
    if (disallowed.length) throw this.redirectError(base, 'invalid_scope', `Scope not allowed: ${disallowed.join(' ')}`);
    const maxAge = p.max_age !== undefined ? Number(p.max_age) : undefined;
    return {
      client,
      redirectUri: p.redirect_uri,
      scopes,
      state: p.state,
      nonce: p.nonce,
      codeChallenge: p.code_challenge,
      prompt: new Set((p.prompt ?? '').split(/\s+/).filter(Boolean)),
      maxAge: Number.isFinite(maxAge) ? maxAge : undefined,
    };
  }

  /** A redirect to the client carrying an OAuth error (only after the redirect URI is validated). */
  redirectError(v: { redirectUri: string; state?: string }, error: string, description: string): URL {
    const url = new URL(v.redirectUri);
    url.searchParams.set('error', error);
    url.searchParams.set('error_description', description);
    if (v.state) url.searchParams.set('state', v.state);
    url.searchParams.set('iss', config.issuer);
    return url;
  }

  async hasConsent(userId: string, client: OAuthClient, scopes: string[]) {
    if (client.first_party) return true;
    const row = await this.db.one<{ scopes: string[] }>('SELECT scopes FROM oauth_consents WHERE user_id = $1 AND client_id = $2', [
      userId,
      client.id,
    ]);
    return !!row && scopes.every((s) => row.scopes.includes(s));
  }

  async grantConsent(userId: string, client: OAuthClient, scopes: string[]) {
    await this.db.query(
      `INSERT INTO oauth_consents (user_id, client_id, scopes) VALUES ($1, $2, $3)
       ON CONFLICT (user_id, client_id) DO UPDATE
         SET scopes = (SELECT array_agg(DISTINCT s) FROM unnest(oauth_consents.scopes || EXCLUDED.scopes) s), granted_at = now()`,
      [userId, client.id, scopes],
    );
  }

  async revokeConsent(userId: string, clientUuid: string) {
    await this.db.query('DELETE FROM oauth_consents WHERE user_id = $1 AND client_id = $2', [userId, clientUuid]);
    await this.db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND client_id = $2 AND revoked_at IS NULL', [
      userId,
      clientUuid,
    ]);
  }

  /** Apps the user has connected (consented to or holds live tokens for). */
  connectedApps(userId: string) {
    return this.db.query<{ id: string; name: string; homepage_url: string | null; logo_url: string | null; scopes: string[]; granted_at: Date }>(
      `SELECT c.id, c.name, c.homepage_url, c.logo_url, coalesce(k.scopes, '{}') AS scopes,
              coalesce(k.granted_at, max(r.created_at)) AS granted_at
       FROM oauth_clients c
       LEFT JOIN oauth_consents k ON k.client_id = c.id AND k.user_id = $1
       LEFT JOIN refresh_tokens r ON r.client_id = c.id AND r.user_id = $1 AND r.revoked_at IS NULL AND r.expires_at > now()
       WHERE k.user_id IS NOT NULL OR r.id IS NOT NULL
       GROUP BY c.id, k.scopes, k.granted_at ORDER BY 6 DESC`,
      [userId],
    );
  }

  async issueCode(v: ValidatedAuthorize, user: User, session: Session): Promise<URL> {
    const code = randomToken(32);
    await this.db.query(
      `INSERT INTO oauth_codes (code_hash, client_id, user_id, session_id, redirect_uri, scope, nonce, code_challenge, auth_time, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now() + make_interval(secs => $10))`,
      [sha256(code), v.client.id, user.id, session.id, v.redirectUri, v.scopes.join(' '), v.nonce ?? null, v.codeChallenge, session.created_at, config.tokens.codeTtlSeconds],
    );
    const url = new URL(v.redirectUri);
    url.searchParams.set('code', code);
    if (v.state) url.searchParams.set('state', v.state);
    url.searchParams.set('iss', config.issuer);
    return url;
  }

  // ---------------------------------------------------------------- token endpoint

  async authenticateClient(authHeader: string | undefined, body: Record<string, string>): Promise<OAuthClient> {
    let clientId = body.client_id;
    let secret = body.client_secret;
    if (authHeader?.startsWith('Basic ')) {
      const decoded = Buffer.from(authHeader.slice(6), 'base64').toString('utf8');
      const i = decoded.indexOf(':');
      if (i > 0) {
        clientId = decodeURIComponent(decoded.slice(0, i));
        secret = decodeURIComponent(decoded.slice(i + 1));
      }
    }
    const client = await this.clients.findByClientId(clientId ?? '');
    if (!client || client.disabled_at || !this.clients.verifySecret(client, secret)) {
      throw new OAuthError('invalid_client', 'Client authentication failed.', 401);
    }
    return client;
  }

  async exchangeCode(client: OAuthClient, body: Record<string, string>, meta: RequestMeta) {
    const { code, redirect_uri, code_verifier } = body;
    if (!code || !code_verifier) throw new OAuthError('invalid_request', 'code and code_verifier are required.');
    // DELETE ... RETURNING makes the code single-use even under concurrent requests.
    const row = await this.db.one<{
      client_id: string;
      user_id: string;
      session_id: string | null;
      redirect_uri: string;
      scope: string;
      nonce: string | null;
      code_challenge: string;
      auth_time: Date;
      expires_at: Date;
    }>('DELETE FROM oauth_codes WHERE code_hash = $1 RETURNING *', [sha256(code)]);
    if (!row || row.expires_at < new Date()) throw new OAuthError('invalid_grant', 'The authorization code is invalid or expired.');
    if (row.client_id !== client.id) throw new OAuthError('invalid_grant', 'The code was issued to another client.');
    if (row.redirect_uri !== redirect_uri) throw new OAuthError('invalid_grant', 'redirect_uri does not match the authorization request.');
    if (pkceS256(code_verifier) !== row.code_challenge) throw new OAuthError('invalid_grant', 'PKCE verification failed.');
    const user = await this.users.findById(row.user_id);
    if (!user || user.status !== 'active') throw new OAuthError('invalid_grant', 'The user account is not active.');

    const scopes = row.scope.split(' ');
    const result = await this.mintTokens(client, user, scopes, row.session_id, { nonce: row.nonce, authTime: row.auth_time });
    if (scopes.includes('offline_access')) {
      result.refresh_token = await this.createRefreshToken(client, user.id, row.scope, row.session_id, randomUUID());
    }
    this.bus.publish('auth.token.issued', { userId: user.id, clientId: client.client_id, clientName: client.name, scope: row.scope }, meta.correlationId);
    return result;
  }

  async refresh(client: OAuthClient, body: Record<string, string>) {
    const token = body.refresh_token;
    if (!token) throw new OAuthError('invalid_request', 'refresh_token is required.');
    const row = await this.db.one<RefreshRow>('SELECT * FROM refresh_tokens WHERE token_hash = $1', [sha256(token)]);
    if (!row || row.client_id !== client.id) throw new OAuthError('invalid_grant', 'Invalid refresh token.');
    if (row.rotated_at || row.revoked_at) {
      // A rotated token came back: it was stolen or replayed. Kill the whole chain.
      await this.db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = $1 AND revoked_at IS NULL', [row.family_id]);
      throw new OAuthError('invalid_grant', 'Refresh token was already used; please sign in again.');
    }
    if (row.expires_at < new Date()) throw new OAuthError('invalid_grant', 'Refresh token expired.');
    const user = await this.users.findById(row.user_id);
    if (!user || user.status !== 'active') throw new OAuthError('invalid_grant', 'The user account is not active.');

    let scope = row.scope;
    if (body.scope) {
      const requested = body.scope.split(/\s+/).filter(Boolean);
      if (requested.some((s) => !row.scope.split(' ').includes(s))) throw new OAuthError('invalid_scope', 'Cannot widen scope on refresh.');
      scope = requested.join(' ');
    }
    const rotated = await this.db.one('UPDATE refresh_tokens SET rotated_at = now() WHERE id = $1 AND rotated_at IS NULL RETURNING id', [row.id]);
    if (!rotated) throw new OAuthError('invalid_grant', 'Refresh token was already used.');
    const result = await this.mintTokens(client, user, scope.split(' '), row.session_id, {});
    result.refresh_token = await this.createRefreshToken(client, user.id, row.scope, row.session_id, row.family_id);
    return result;
  }

  private async mintTokens(
    client: OAuthClient,
    user: User,
    scopes: string[],
    sessionId: string | null,
    extra: { nonce?: string | null; authTime?: Date },
  ): Promise<Record<string, any>> {
    const ttl = config.tokens.accessTtlSeconds;
    const access_token = await this.keys.sign(
      { sub: user.id, client_id: client.client_id, scope: scopes.join(' '), ...(sessionId ? { sid: sessionId } : {}) },
      { audience: client.client_id, expiresInSeconds: ttl, type: 'at+jwt' },
    );
    const out: Record<string, any> = { access_token, token_type: 'Bearer', expires_in: ttl, scope: scopes.join(' ') };
    if (scopes.includes('openid')) {
      out.id_token = await this.keys.sign(
        {
          sub: user.id,
          ...(extra.nonce ? { nonce: extra.nonce } : {}),
          ...(extra.authTime ? { auth_time: Math.floor(new Date(extra.authTime).getTime() / 1000) } : {}),
          ...(sessionId ? { sid: sessionId } : {}),
          ...this.claims(user, scopes),
        },
        { audience: client.client_id, expiresInSeconds: 3600 },
      );
    }
    return out;
  }

  private async createRefreshToken(client: OAuthClient, userId: string, scope: string, sessionId: string | null, familyId: string) {
    const token = `tjr_${randomToken(32)}`;
    await this.db.query(
      `INSERT INTO refresh_tokens (token_hash, family_id, client_id, user_id, session_id, scope, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6, now() + make_interval(days => $7))`,
      [sha256(token), familyId, client.id, userId, sessionId, scope, config.tokens.refreshTtlDays],
    );
    return token;
  }

  /** Standard claims released per scope. `role` is a TheJat extension for admin mapping. */
  claims(user: User, scopes: string[]) {
    return {
      ...(scopes.includes('profile') ? { name: user.name, role: user.role, updated_at: Math.floor(user.updated_at.getTime() / 1000) } : {}),
      ...(scopes.includes('email') ? { email: user.email, email_verified: !!user.email_verified_at } : {}),
    };
  }

  // ---------------------------------------------------------------- resource-side

  /** Validates a bearer access token and returns its user + scopes. */
  async readAccessToken(authHeader?: string) {
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (!token) throw new OAuthError('invalid_token', 'Missing bearer token.', 401);
    let payload: Record<string, any>;
    try {
      payload = await this.keys.verify(token, { type: 'at+jwt' });
    } catch {
      throw new OAuthError('invalid_token', 'The access token is invalid or expired.', 401);
    }
    if (payload.sid) {
      const live = await this.db.one('SELECT 1 FROM sessions WHERE id = $1 AND revoked_at IS NULL', [payload.sid]);
      if (!live) throw new OAuthError('invalid_token', 'The session behind this token has ended.', 401);
    }
    const user = await this.users.findById(String(payload.sub));
    if (!user || user.status !== 'active') throw new OAuthError('invalid_token', 'The user account is not active.', 401);
    return { user, scopes: String(payload.scope ?? '').split(' '), payload };
  }

  async introspect(client: OAuthClient, token: string) {
    if (!token) return { active: false };
    if (token.startsWith('tjr_')) {
      const row = await this.db.one<RefreshRow>('SELECT * FROM refresh_tokens WHERE token_hash = $1', [sha256(token)]);
      if (!row || row.client_id !== client.id || row.revoked_at || row.rotated_at || row.expires_at < new Date()) return { active: false };
      return { active: true, token_type: 'refresh_token', sub: row.user_id, client_id: client.client_id, scope: row.scope, exp: Math.floor(row.expires_at.getTime() / 1000) };
    }
    try {
      const { payload } = await this.readAccessToken(`Bearer ${token}`);
      if (payload.client_id !== client.client_id) return { active: false };
      return { active: true, token_type: 'access_token', sub: payload.sub, client_id: payload.client_id, scope: payload.scope, exp: payload.exp, iat: payload.iat, iss: config.issuer };
    } catch {
      return { active: false };
    }
  }

  /** RFC 7009: always 200, even for unknown tokens. Revoking a refresh token kills its family. */
  async revoke(client: OAuthClient, token: string) {
    if (!token?.startsWith('tjr_')) return;
    await this.db.query(
      `UPDATE refresh_tokens SET revoked_at = now()
       WHERE family_id = (SELECT family_id FROM refresh_tokens WHERE token_hash = $1 AND client_id = $2) AND revoked_at IS NULL`,
      [sha256(token), client.id],
    );
  }

  /** Reads the client an id_token_hint was issued to, tolerating expiry. */
  async clientFromIdTokenHint(hint?: string): Promise<OAuthClient | null> {
    if (!hint) return null;
    try {
      const payload = await this.keys.verify(hint);
      return this.clients.findByClientId(String(Array.isArray(payload.aud) ? payload.aud[0] : payload.aud));
    } catch (err) {
      if (err?.code !== 'ERR_JWT_EXPIRED' || !err.payload) return null;
      const aud = err.payload.aud;
      return this.clients.findByClientId(String(Array.isArray(aud) ? aud[0] : aud));
    }
  }

  discovery() {
    const base = config.issuer;
    return {
      issuer: base,
      authorization_endpoint: `${base}/oauth/authorize`,
      token_endpoint: `${base}/oauth/token`,
      userinfo_endpoint: `${base}/oauth/userinfo`,
      jwks_uri: `${base}/oauth/jwks`,
      revocation_endpoint: `${base}/oauth/revoke`,
      introspection_endpoint: `${base}/oauth/introspect`,
      end_session_endpoint: `${base}/oauth/logout`,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
      token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
      code_challenge_methods_supported: ['S256'],
      scopes_supported: ['openid', 'profile', 'email', 'offline_access'],
      claims_supported: ['sub', 'name', 'email', 'email_verified', 'role', 'updated_at', 'auth_time', 'nonce', 'sid'],
      prompt_values_supported: ['none', 'login', 'consent'],
    };
  }
}
