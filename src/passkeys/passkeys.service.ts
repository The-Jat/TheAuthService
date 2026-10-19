import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, AuthenticatorTransport, RegistrationResponseJSON } from '@simplewebauthn/server';
import { config } from '../config/config';
import { DatabaseService } from '../database/database.service';
import { User } from '../users/users.types';

interface PasskeyRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: Buffer;
  counter: string;
  transports: string[];
  device_type: string | null;
  backed_up: boolean;
  name: string;
  created_at: Date;
  last_used_at: Date | null;
}

const CHALLENGE_TTL_MINUTES = 5;

@Injectable()
export class PasskeysService {
  constructor(private readonly db: DatabaseService) {}

  list(userId: string) {
    return this.db
      .query<PasskeyRow>('SELECT * FROM passkeys WHERE user_id = $1 ORDER BY created_at', [userId])
      .then((rows) =>
        rows.map((p) => ({
          id: p.id,
          name: p.name,
          deviceType: p.device_type,
          backedUp: p.backed_up,
          createdAt: p.created_at.toISOString(),
          lastUsedAt: p.last_used_at?.toISOString() ?? null,
        })),
      );
  }

  async rename(userId: string, id: string, name: string) {
    await this.db.query('UPDATE passkeys SET name = $3 WHERE id = $1 AND user_id = $2', [id, userId, name.trim().slice(0, 60) || 'Passkey']);
  }

  async remove(userId: string, id: string) {
    const rows = await this.db.query('DELETE FROM passkeys WHERE id = $1 AND user_id = $2 RETURNING id', [id, userId]);
    return rows.length > 0;
  }

  async count(userId: string) {
    const row = await this.db.one<{ count: string }>('SELECT count(*) FROM passkeys WHERE user_id = $1', [userId]);
    return Number(row?.count ?? 0);
  }

  // ---- Registration (signed-in user adds a passkey) ----

  async registrationOptions(user: User) {
    const existing = await this.db.query<PasskeyRow>('SELECT credential_id, transports FROM passkeys WHERE user_id = $1', [user.id]);
    const options = await generateRegistrationOptions({
      rpName: config.brandName,
      rpID: config.webauthn.rpId,
      userName: user.email,
      userDisplayName: user.name,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: existing.map((c) => ({
        id: c.credential_id,
        transports: c.transports as AuthenticatorTransport[],
      })),
      authenticatorSelection: { residentKey: 'required', userVerification: 'preferred' },
    });
    await this.saveChallenge(options.challenge, 'register', user.id);
    return options;
  }

  async verifyRegistration(user: User, response: RegistrationResponseJSON, name?: string) {
    const challenge = await this.takeChallenge(response, 'register', user.id);
    const result = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: config.webauthn.origin,
      expectedRPID: config.webauthn.rpId,
      requireUserVerification: false,
    }).catch((err) => {
      throw new BadRequestException(`Passkey could not be verified: ${err.message}`);
    });
    if (!result.verified || !result.registrationInfo) throw new BadRequestException('Passkey could not be verified.');
    const { credential, credentialDeviceType, credentialBackedUp } = result.registrationInfo;
    await this.db.query(
      `INSERT INTO passkeys (user_id, credential_id, public_key, counter, transports, device_type, backed_up, name)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        user.id,
        credential.id,
        Buffer.from(credential.publicKey),
        credential.counter,
        credential.transports ?? [],
        credentialDeviceType,
        credentialBackedUp,
        (name ?? '').trim().slice(0, 60) || defaultName(response),
      ],
    );
  }

  // ---- Authentication (signed-out user signs in with a passkey) ----

  async authenticationOptions() {
    const options = await generateAuthenticationOptions({
      rpID: config.webauthn.rpId,
      userVerification: 'preferred',
      // Empty allowCredentials = discoverable credentials: the browser offers
      // the user's passkeys without us revealing which emails have one.
      allowCredentials: [],
    });
    await this.saveChallenge(options.challenge, 'login', null);
    return options;
  }

  /** Returns the user id the passkey belongs to. */
  async verifyAuthentication(response: AuthenticationResponseJSON): Promise<string> {
    const challenge = await this.takeChallenge(response, 'login', null);
    const passkey = await this.db.one<PasskeyRow>('SELECT * FROM passkeys WHERE credential_id = $1', [response.id]);
    if (!passkey) throw new UnauthorizedException('This passkey is not registered.');
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: config.webauthn.origin,
      expectedRPID: config.webauthn.rpId,
      credential: {
        id: passkey.credential_id,
        publicKey: new Uint8Array(passkey.public_key),
        counter: Number(passkey.counter),
        transports: passkey.transports as AuthenticatorTransport[],
      },
      requireUserVerification: false,
    }).catch(() => {
      throw new UnauthorizedException('Passkey sign-in failed.');
    });
    if (!result.verified) throw new UnauthorizedException('Passkey sign-in failed.');
    await this.db.query('UPDATE passkeys SET counter = $2, last_used_at = now() WHERE id = $1', [
      passkey.id,
      result.authenticationInfo.newCounter,
    ]);
    return passkey.user_id;
  }

  private async saveChallenge(challenge: string, purpose: 'register' | 'login', userId: string | null) {
    await this.db.query('DELETE FROM webauthn_challenges WHERE expires_at < now()');
    await this.db.query(
      `INSERT INTO webauthn_challenges (user_id, purpose, challenge, expires_at)
       VALUES ($1, $2, $3, now() + make_interval(mins => $4))`,
      [userId, purpose, challenge, CHALLENGE_TTL_MINUTES],
    );
  }

  /** The challenge is echoed inside clientDataJSON; look it up and consume it. */
  private async takeChallenge(
    response: RegistrationResponseJSON | AuthenticationResponseJSON,
    purpose: 'register' | 'login',
    userId: string | null,
  ): Promise<string> {
    let challenge: string;
    try {
      challenge = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf8')).challenge;
    } catch {
      throw new BadRequestException('Malformed passkey response.');
    }
    const row = await this.db.one<{ challenge: string }>(
      `DELETE FROM webauthn_challenges
       WHERE challenge = $1 AND purpose = $2 AND expires_at > now() AND ($3::uuid IS NULL OR user_id = $3)
       RETURNING challenge`,
      [challenge, purpose, userId],
    );
    if (!row) throw new BadRequestException('Passkey request expired. Please try again.');
    return row.challenge;
  }
}

function defaultName(response: RegistrationResponseJSON): string {
  const t = response.response.transports ?? [];
  if (t.includes('hybrid')) return 'Phone passkey';
  if (t.includes('usb') || t.includes('nfc')) return 'Security key';
  return 'Passkey';
}
