import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { exportJWK, generateKeyPair, importJWK, jwtVerify, SignJWT } from 'jose';
import type { JWK, JWTPayload, CryptoKey } from 'jose';
import { randomUUID } from 'crypto';
import { config } from '../config/config';
import { DatabaseService } from '../database/database.service';

/**
 * RS256 signing keys. Generated on first boot and stored in the database, so
 * every replica and restart signs with the same key. Clients verify tokens
 * with the public half published at /api/oauth/jwks.
 */
@Injectable()
export class KeysService implements OnModuleInit {
  private readonly logger = new Logger(KeysService.name);
  private kid: string;
  private privateKey: CryptoKey;
  private publicKeys = new Map<string, CryptoKey>();
  private jwks: { keys: JWK[] } = { keys: [] };

  constructor(private readonly db: DatabaseService) {}

  async onModuleInit() {
    let rows = await this.db.query<{ kid: string; private_jwk: JWK; public_jwk: JWK; active: boolean }>(
      'SELECT * FROM signing_keys ORDER BY created_at DESC',
    );
    if (!rows.some((r) => r.active)) {
      const { privateKey, publicKey } = await generateKeyPair('RS256', { modulusLength: 2048, extractable: true });
      const kid = randomUUID();
      const privateJwk = { ...(await exportJWK(privateKey)), kid, alg: 'RS256', use: 'sig' };
      const publicJwk = { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' };
      await this.db.query('INSERT INTO signing_keys (kid, private_jwk, public_jwk) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [
        kid,
        privateJwk,
        publicJwk,
      ]);
      this.logger.log(`Generated signing key ${kid}`);
      rows = await this.db.query('SELECT * FROM signing_keys ORDER BY created_at DESC');
    }
    const active = rows.find((r) => r.active)!;
    this.kid = active.kid;
    this.privateKey = (await importJWK(active.private_jwk, 'RS256')) as CryptoKey;
    for (const r of rows) this.publicKeys.set(r.kid, (await importJWK(r.public_jwk, 'RS256')) as CryptoKey);
    this.jwks = { keys: rows.map((r) => r.public_jwk) };
  }

  getJwks() {
    return this.jwks;
  }

  sign(payload: JWTPayload, opts: { audience: string | string[]; expiresInSeconds: number; type?: string }) {
    return new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', kid: this.kid, typ: opts.type ?? 'JWT' })
      .setIssuer(config.issuer)
      .setAudience(opts.audience)
      .setIssuedAt()
      .setExpirationTime(`${opts.expiresInSeconds}s`)
      .sign(this.privateKey);
  }

  async verify(token: string, opts: { audience?: string; type?: string } = {}) {
    const { payload } = await jwtVerify(
      token,
      async (header) => {
        const key = this.publicKeys.get(header.kid ?? '');
        if (!key) throw new Error('Unknown key');
        return key;
      },
      { issuer: config.issuer, audience: opts.audience, typ: opts.type, algorithms: ['RS256'] },
    );
    return payload;
  }
}
