# Deploying TheJat Accounts

One Docker Compose project on the EC2 host, behind the host's Caddy.
Measured footprint: about 300 MB RAM for all six containers.

## 1. DNS

Add an `A` record: `auth` → the server's Elastic IP.

## 2. Code on the server

```bash
mkdir -p ~/thejat && cd ~/thejat
git clone -b v2 git@github.com:The-Jat/TheAuthService.git          the-auth-service
git clone -b v2 git@github.com:The-Jat/TheAuthServiceFrontend.git  the-auth-service-frontend
git clone -b v2 git@github.com:The-Jat/TheLoggerService.git         the-logger-service
git clone -b v2 git@github.com:The-Jat/TheNotificationService.git   the-notification-service
```

(Folder names matter: `docker-compose.yml` builds from the sibling folders.)

## 3. Secrets

```bash
cd ~/thejat/the-auth-service/deploy
cp .env.example .env
for k in POSTGRES_PASSWORD AUTH_DB_PASSWORD LOGGER_DB_PASSWORD NOTIFIER_DB_PASSWORD RABBITMQ_PASSWORD INTERNAL_API_KEY; do
  sed -i "s|^$k=.*|$k=$(openssl rand -hex 32)|" .env
done
nano .env   # set ADMIN_EMAILS and, when ready, SMTP_*
chmod 600 .env
```

## 4. Start

```bash
docker compose up -d --build
docker compose ps        # all should be "healthy"
```

## 5. HTTPS

Append `Caddyfile.auth` to `/etc/caddy/Caddyfile`, then `sudo systemctl reload caddy`.

## 6. First admin

Sign up at `https://auth.thejat.in/signup` with the address in `ADMIN_EMAILS` and verify the email.
Without SMTP, verify from the server instead:

```bash
docker compose exec db psql -U postgres -d auth -c \
  "UPDATE users SET email_verified_at = now(), role = 'admin' WHERE lower(email) = lower('you@example.com');"
```

## Updating

```bash
cd ~/thejat && for d in the-*; do git -C "$d" pull --ff-only; done
cd the-auth-service/deploy && docker compose up -d --build
```

## Backups

```bash
docker compose exec -T db pg_dumpall -U postgres | gzip > ~/backups/accounts-$(date +%F).sql.gz
```

The `auth` database holds the token-signing key (`signing_keys`). Losing it signs everyone out of every app.
