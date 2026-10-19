import 'dotenv/config';

/**
 * Typed, validated configuration. The process refuses to start with a missing
 * or unsafe value instead of failing later on the first request that needs it.
 */
function required(name: string): string {
  const value = process.env[name];
  if (!value || !value.trim()) {
    throw new Error(`Missing required environment variable ${name}`);
  }
  return value.trim();
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function list(name: string): string[] {
  return (process.env[name] ?? '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

const nodeEnv = optional('NODE_ENV', 'development');
const publicUrl = required('PUBLIC_URL').replace(/\/+$/, '');

export const config = {
  nodeEnv,
  isProduction: nodeEnv === 'production',
  port: Number(optional('PORT', '4000')),

  /** Public origin of the accounts site, e.g. https://auth.thejat.in */
  publicUrl,
  /** OIDC issuer. Clients compare this string exactly. */
  issuer: `${publicUrl}/api`,
  /** Name shown in emails, passkey prompts and the UI. */
  brandName: optional('BRAND_NAME', 'TheJat Accounts'),

  databaseUrl: required('DATABASE_URL'),
  rabbitmqUrl: optional('RABBITMQ_URL', ''),

  /** Shared secret for service-to-service calls on the private network. */
  internalApiKey: required('INTERNAL_API_KEY'),
  loggerUrl: optional('LOGGER_URL', 'http://logger:4010'),
  notifierUrl: optional('NOTIFIER_URL', 'http://notifier:4020'),

  allowSignup: bool('ALLOW_SIGNUP', true),
  /** Accounts with these emails become admins once their email is verified. */
  adminEmails: list('ADMIN_EMAILS').map((e) => e.toLowerCase()),
  /** Extra origins allowed to call the API from a browser (SPAs using userinfo). */
  corsOrigins: list('CORS_ORIGINS'),
  /** Trust X-Forwarded-For from this many proxies (Caddy on the host = 1). */
  trustProxy: Number(optional('TRUST_PROXY', '1')),

  session: {
    cookieName: nodeEnv === 'production' ? '__Host-tj_session' : 'tj_session',
    ttlDays: Number(optional('SESSION_TTL_DAYS', '30')),
  },
  tokens: {
    accessTtlSeconds: Number(optional('ACCESS_TOKEN_TTL_SECONDS', '900')),
    refreshTtlDays: Number(optional('REFRESH_TOKEN_TTL_DAYS', '30')),
    codeTtlSeconds: 120,
  },
  security: {
    maxFailedLogins: Number(optional('MAX_FAILED_LOGINS', '8')),
    lockMinutes: Number(optional('LOCK_MINUTES', '15')),
    requireVerifiedEmail: bool('REQUIRE_VERIFIED_EMAIL', true),
  },
  webauthn: {
    rpId: optional('WEBAUTHN_RP_ID', new URL(publicUrl).hostname),
    origin: optional('WEBAUTHN_ORIGIN', publicUrl),
  },
} as const;

export type AppConfig = typeof config;
