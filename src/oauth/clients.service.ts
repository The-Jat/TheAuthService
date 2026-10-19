import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomToken, safeEqual, sha256 } from '../common/crypto';
import { DatabaseService } from '../database/database.service';

export const SUPPORTED_SCOPES = ['openid', 'profile', 'email', 'offline_access'] as const;

export interface OAuthClient {
  id: string;
  client_id: string;
  client_secret_hash: string | null;
  name: string;
  description: string | null;
  homepage_url: string | null;
  logo_url: string | null;
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  allowed_scopes: string[];
  first_party: boolean;
  owner_id: string | null;
  disabled_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

export interface ClientInput {
  name: string;
  description?: string | null;
  homepageUrl?: string | null;
  logoUrl?: string | null;
  redirectUris: string[];
  postLogoutRedirectUris?: string[];
  allowedScopes?: string[];
  firstParty?: boolean;
  confidential?: boolean;
}

export function toPublicClient(c: OAuthClient) {
  return {
    id: c.id,
    clientId: c.client_id,
    name: c.name,
    description: c.description,
    homepageUrl: c.homepage_url,
    logoUrl: c.logo_url,
    redirectUris: c.redirect_uris,
    postLogoutRedirectUris: c.post_logout_redirect_uris,
    allowedScopes: c.allowed_scopes,
    firstParty: c.first_party,
    confidential: !!c.client_secret_hash,
    disabled: !!c.disabled_at,
    createdAt: c.created_at.toISOString(),
    updatedAt: c.updated_at.toISOString(),
  };
}

@Injectable()
export class ClientsService {
  constructor(private readonly db: DatabaseService) {}

  findByClientId(clientId: string) {
    if (!clientId || clientId.length > 100) return Promise.resolve(null);
    return this.db.one<OAuthClient>('SELECT * FROM oauth_clients WHERE client_id = $1', [clientId]);
  }

  findById(id: string) {
    return this.db.one<OAuthClient>('SELECT * FROM oauth_clients WHERE id = $1', [id]);
  }

  list() {
    return this.db.query<OAuthClient & { active_users: string }>(
      `SELECT c.*, (SELECT count(DISTINCT user_id) FROM refresh_tokens r
                     WHERE r.client_id = c.id AND r.revoked_at IS NULL AND r.expires_at > now()) AS active_users
       FROM oauth_clients c ORDER BY c.created_at DESC`,
    );
  }

  /** Client secrets are 256-bit random values, so a fast hash is enough. */
  verifySecret(client: OAuthClient, secret: string | undefined): boolean {
    if (!client.client_secret_hash) return true; // public client; PKCE is the proof
    return !!secret && safeEqual(sha256(secret), client.client_secret_hash);
  }

  async create(input: ClientInput, ownerId: string) {
    const data = this.validate(input);
    const clientId = `tj_${randomToken(12)}`;
    const secret = input.confidential === false ? null : `tjs_${randomToken(32)}`;
    const client = (await this.db.one<OAuthClient>(
      `INSERT INTO oauth_clients (client_id, client_secret_hash, name, description, homepage_url, logo_url,
         redirect_uris, post_logout_redirect_uris, allowed_scopes, first_party, owner_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [
        clientId,
        secret ? sha256(secret) : null,
        data.name,
        data.description,
        data.homepageUrl,
        data.logoUrl,
        data.redirectUris,
        data.postLogoutRedirectUris,
        data.allowedScopes,
        data.firstParty,
        ownerId,
      ],
    ))!;
    return { client, secret };
  }

  async update(id: string, input: ClientInput) {
    const data = this.validate(input);
    const client = await this.db.one<OAuthClient>(
      `UPDATE oauth_clients SET name=$2, description=$3, homepage_url=$4, logo_url=$5, redirect_uris=$6,
         post_logout_redirect_uris=$7, allowed_scopes=$8, first_party=$9, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [
        id,
        data.name,
        data.description,
        data.homepageUrl,
        data.logoUrl,
        data.redirectUris,
        data.postLogoutRedirectUris,
        data.allowedScopes,
        data.firstParty,
      ],
    );
    if (!client) throw new NotFoundException('App not found.');
    return client;
  }

  async rotateSecret(id: string) {
    const secret = `tjs_${randomToken(32)}`;
    const client = await this.db.one<OAuthClient>(
      'UPDATE oauth_clients SET client_secret_hash = $2, updated_at = now() WHERE id = $1 RETURNING *',
      [id, sha256(secret)],
    );
    if (!client) throw new NotFoundException('App not found.');
    return { client, secret };
  }

  async setDisabled(id: string, disabled: boolean) {
    const client = await this.db.one<OAuthClient>(
      `UPDATE oauth_clients SET disabled_at = CASE WHEN $2 THEN now() ELSE NULL END, updated_at = now() WHERE id = $1 RETURNING *`,
      [id, disabled],
    );
    if (!client) throw new NotFoundException('App not found.');
    if (disabled) await this.db.query('UPDATE refresh_tokens SET revoked_at = now() WHERE client_id = $1 AND revoked_at IS NULL', [id]);
    return client;
  }

  async delete(id: string) {
    await this.db.query('DELETE FROM oauth_clients WHERE id = $1', [id]);
  }

  private validate(input: ClientInput) {
    const name = (input.name ?? '').trim();
    if (!name || name.length > 80) throw new BadRequestException('App name must be 1–80 characters.');
    const redirectUris = uniq(input.redirectUris ?? []);
    if (!redirectUris.length) throw new BadRequestException('Add at least one redirect URI.');
    redirectUris.forEach((u) => assertRedirectUri(u));
    const postLogoutRedirectUris = uniq(input.postLogoutRedirectUris ?? []);
    postLogoutRedirectUris.forEach((u) => assertRedirectUri(u));
    const allowedScopes = uniq(input.allowedScopes?.length ? input.allowedScopes : ['openid', 'profile', 'email', 'offline_access']);
    const unknown = allowedScopes.filter((s) => !(SUPPORTED_SCOPES as readonly string[]).includes(s));
    if (unknown.length) throw new BadRequestException(`Unsupported scopes: ${unknown.join(', ')}`);
    return {
      name,
      description: input.description?.trim() || null,
      homepageUrl: input.homepageUrl ? assertHttpUrl(input.homepageUrl) : null,
      logoUrl: input.logoUrl ? assertHttpUrl(input.logoUrl) : null,
      redirectUris,
      postLogoutRedirectUris,
      allowedScopes,
      firstParty: !!input.firstParty,
    };
  }
}

function uniq(values: string[]) {
  return [...new Set(values.map((v) => v.trim()).filter(Boolean))];
}

function assertHttpUrl(value: string) {
  try {
    const u = new URL(value);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error();
    return u.toString();
  } catch {
    throw new BadRequestException(`Not a valid URL: ${value}`);
  }
}

/** Exact-match redirect URIs: https anywhere, plain http only for localhost. */
function assertRedirectUri(value: string) {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    throw new BadRequestException(`Not a valid redirect URI: ${value}`);
  }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(u.hostname);
  if (u.hash) throw new BadRequestException(`Redirect URIs cannot contain a #fragment: ${value}`);
  if (u.protocol !== 'https:' && !(u.protocol === 'http:' && local)) {
    throw new BadRequestException(`Redirect URIs must use https (http is allowed only for localhost): ${value}`);
  }
}
