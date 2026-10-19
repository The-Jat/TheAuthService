# TheJat Accounts — auth service

The identity provider for every TheJat app: accounts, password + passkey sign-in, browser SSO
sessions, and a standards-compliant **OpenID Connect** provider other apps sign in through.

```
                 https://auth.thejat.in
                          │  Caddy (TLS)
          ┌───────────────┴───────────────┐
      /api/*                            /*
   auth-service (this repo)      the-auth-service-frontend
   NestJS · Postgres `auth`      Next.js · login, account, console
          │ publishes domain events
          ▼
   RabbitMQ  topic exchange `domain.events`
     ├─► the-logger-service        (#)      → Postgres `logs`
     └─► the-notification-service  (auth.*) → email, Postgres `notifications`
```

## What it does

| Area | Details |
|---|---|
| Accounts | Sign-up, email verification, password reset, profile, delete account |
| Credentials | Argon2id passwords, passkeys (WebAuthn, discoverable), lockout after repeated failures |
| Sessions | Opaque cookie (`__Host-tj_session`), only a SHA-256 stored, list/revoke per device |
| OIDC | Authorization code + **PKCE S256 (required)**, consent for third-party apps, RS256 ID/access tokens, JWKS, rotating refresh tokens with reuse detection, userinfo, revoke, introspect, RP-initiated logout, discovery |
| Admin | Users, apps (OAuth clients), overview stats; logs and notifications proxied from the other services |
| Hardening | Same-origin check on cookie-authenticated writes, rate limits, Helmet, validated config, no secrets in logs |

## Endpoints (all under `/api`)

- `/.well-known/openid-configuration`, `/oauth/jwks`
- `/oauth/authorize`, `/oauth/token`, `/oauth/userinfo`, `/oauth/revoke`, `/oauth/introspect`, `/oauth/logout`
- `/oauth/consent` (UI), `/auth/*` (sign-in flows), `/account/*` (self-service), `/admin/*` (console)
- `/health`

Scopes: `openid profile email offline_access`. A refresh token is issued only with `offline_access`.
Claims: `sub` (UUID), `name`, `email`, `email_verified`, `role`.

## Events published (`domain.events`, topic)

Envelope: `{ id, event, version: 1, occurredAt, service, correlationId, data }`

`auth.user.registered` · `auth.user.signed_in` · `auth.user.deleted` · `auth.email.verification_requested` ·
`auth.email.verified` · `auth.password.reset_requested` · `auth.password.changed` · `auth.passkey.added` ·
`auth.token.issued` · `system.log.{info,warn,error}`

## Run locally

```bash
npm ci
# needs Postgres; RabbitMQ is optional (events are dropped without it)
PUBLIC_URL=http://localhost:3000 DATABASE_URL=postgres://… INTERNAL_API_KEY=dev npm run start:dev
```

Migrations in `src/database/migrations/*.sql` run automatically at startup.
`scripts/e2e-oidc.mjs` exercises the full OIDC flow (32 checks) against a running instance.

## Deploy

Everything (this service, the frontend, logger, notifier, Postgres, RabbitMQ) is in [`deploy/`](deploy/README.md).
