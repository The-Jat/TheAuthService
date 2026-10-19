-- TheJat Accounts: initial schema.
-- IDs are UUIDs so the OIDC `sub` claim never leaks row counts.

CREATE TABLE users (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    email              text        NOT NULL,
    name               text        NOT NULL,
    role               text        NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    status             text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'disabled')),
    email_verified_at  timestamptz,
    failed_logins      integer     NOT NULL DEFAULT 0,
    locked_until       timestamptz,
    last_login_at      timestamptz,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX users_email_lower_idx ON users (lower(email));

CREATE TABLE password_credentials (
    user_id        uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    password_hash  text        NOT NULL,
    updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE passkeys (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id        uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id  text        NOT NULL UNIQUE,
    public_key     bytea       NOT NULL,
    counter        bigint      NOT NULL DEFAULT 0,
    transports     text[]      NOT NULL DEFAULT '{}',
    device_type    text,
    backed_up      boolean     NOT NULL DEFAULT false,
    name           text        NOT NULL DEFAULT 'Passkey',
    created_at     timestamptz NOT NULL DEFAULT now(),
    last_used_at   timestamptz
);
CREATE INDEX passkeys_user_idx ON passkeys (user_id);

CREATE TABLE webauthn_challenges (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid REFERENCES users(id) ON DELETE CASCADE,
    purpose     text        NOT NULL CHECK (purpose IN ('register', 'login')),
    challenge   text        NOT NULL,
    expires_at  timestamptz NOT NULL
);

-- Browser SSO sessions on the accounts domain. Only a SHA-256 of the cookie is stored.
CREATE TABLE sessions (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash    text        NOT NULL UNIQUE,
    ip            text,
    user_agent    text,
    auth_method   text        NOT NULL DEFAULT 'password',
    created_at    timestamptz NOT NULL DEFAULT now(),
    last_used_at  timestamptz NOT NULL DEFAULT now(),
    expires_at    timestamptz NOT NULL,
    revoked_at    timestamptz
);
CREATE INDEX sessions_user_idx ON sessions (user_id);

-- Single-use email links (verification, password reset). Only hashes are stored.
CREATE TABLE email_tokens (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    purpose     text        NOT NULL CHECK (purpose IN ('verify_email', 'reset_password')),
    token_hash  text        NOT NULL UNIQUE,
    expires_at  timestamptz NOT NULL,
    used_at     timestamptz,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- Applications that sign users in through us (OIDC relying parties).
CREATE TABLE oauth_clients (
    id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id                 text        NOT NULL UNIQUE,
    client_secret_hash        text,       -- NULL = public client (PKCE only)
    name                      text        NOT NULL,
    description               text,
    homepage_url              text,
    logo_url                  text,
    redirect_uris             text[]      NOT NULL,
    post_logout_redirect_uris text[]      NOT NULL DEFAULT '{}',
    allowed_scopes            text[]      NOT NULL DEFAULT '{openid,profile,email}',
    first_party               boolean     NOT NULL DEFAULT false,
    owner_id                  uuid REFERENCES users(id) ON DELETE SET NULL,
    disabled_at               timestamptz,
    created_at                timestamptz NOT NULL DEFAULT now(),
    updated_at                timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE oauth_consents (
    user_id     uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    client_id   uuid        NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    scopes      text[]      NOT NULL,
    granted_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, client_id)
);

CREATE TABLE oauth_codes (
    code_hash       text PRIMARY KEY,
    client_id       uuid        NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id      uuid REFERENCES sessions(id) ON DELETE CASCADE,
    redirect_uri    text        NOT NULL,
    scope           text        NOT NULL,
    nonce           text,
    code_challenge  text        NOT NULL,
    auth_time       timestamptz NOT NULL,
    expires_at      timestamptz NOT NULL,
    created_at      timestamptz NOT NULL DEFAULT now()
);

-- Rotating refresh tokens. Reusing a rotated token revokes the whole family.
CREATE TABLE refresh_tokens (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    token_hash   text        NOT NULL UNIQUE,
    family_id    uuid        NOT NULL,
    client_id    uuid        NOT NULL REFERENCES oauth_clients(id) ON DELETE CASCADE,
    user_id      uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_id   uuid REFERENCES sessions(id) ON DELETE SET NULL,
    scope        text        NOT NULL,
    expires_at   timestamptz NOT NULL,
    created_at   timestamptz NOT NULL DEFAULT now(),
    rotated_at   timestamptz,
    revoked_at   timestamptz
);
CREATE INDEX refresh_tokens_family_idx ON refresh_tokens (family_id);
CREATE INDEX refresh_tokens_user_idx ON refresh_tokens (user_id);

-- RS256 signing keys, published at /api/oauth/jwks.
CREATE TABLE signing_keys (
    kid          text PRIMARY KEY,
    private_jwk  jsonb       NOT NULL,
    public_jwk   jsonb       NOT NULL,
    active       boolean     NOT NULL DEFAULT true,
    created_at   timestamptz NOT NULL DEFAULT now()
);
