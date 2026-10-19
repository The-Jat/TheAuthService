import { createHash, randomBytes, timingSafeEqual } from 'crypto';

/** URL-safe random token with `bytes` of entropy. */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

/** Tokens are stored only as SHA-256 digests, so a database leak cannot be replayed. */
export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

export function pkceS256(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}
