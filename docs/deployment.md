# NexTool — Deployment Guide

This guide covers everything you need to run NexTool in production. It is honest about what is required vs. optional, and what is NOT configured in the sandbox by default.

> **TL;DR**: `cp .env.example .env`, fill in real values, `docker compose up -d`, then `curl http://localhost:3000/api/ready`.

---

## Table of contents

1. [Architecture overview](#architecture-overview)
2. [Prerequisites](#prerequisites)
3. [Quick start — single host (Docker Compose)](#quick-start--single-host-docker-compose)
4. [Environment variables](#environment-variables)
5. [PostgreSQL setup](#postgresql-setup)
6. [Redis setup](#redis-setup)
7. [Object storage (S3 / MinIO / R2)](#object-storage-s3--minio--r2)
8. [LibreOffice install](#libreoffice-install)
9. [FFmpeg install](#ffmpeg-install)
10. [Tesseract + language packs](#tesseract--language-packs)
11. [Stripe webhook setup](#stripe-webhook-setup)
12. [Email provider setup](#email-provider-setup)
13. [Cloudflare Turnstile](#cloudflare-turnstile)
14. [Sentry](#sentry)
15. [Backup strategy](#backup-strategy)
16. [Migration procedure](#migration-procedure)
17. [Rolling deploy](#rolling-deploy)
18. [Health check verification](#health-check-verification)
19. [Sandbox limitations (honest)](#sandbox-limitations-honest)

---

## Architecture overview

```
                       ┌─────────────┐
                       │  Browser /  │
                       │  API client │
                       └──────┬──────┘
                              │ HTTPS
                       ┌──────▼──────┐
                       │  CDN / WAF  │  (Cloudflare — optional)
                       └──────┬──────┘
                              │
                       ┌──────▼──────┐
                       │  Next.js    │  ← web UI + /api/v1/* REST API
                       │  (app)      │
                       └──┬──┬──┬────┘
            Prisma queries │  │  │ Post jobs
              (read/write) │  │  │
              ┌─────────────┘  │  └──────────┐
              ▼                ▼             ▼
        ┌──────────┐    ┌────────────┐  ┌──────────┐
        │PostgreSQL│    │   Redis    │  │ Workers  │
        │  (DB)    │    │ (queues,  │  │  (6 +    │
        │          │    │  rate-    │  │ cleanup) │
        │          │    │  limits)  │  │          │
        └──────────┘    └────────────┘  └────┬─────┘
                                              │
                                       ┌──────▼──────┐
                                       │  S3 / R2 /  │
                                       │  Local FS   │
                                       │  (storage)  │
                                       └─────────────┘
```

Workers pull jobs from the DB-backed queue (or Redis when `REDIS_URL` is set), process files using LibreOffice / FFmpeg / Tesseract / Ghostscript / Sharp, and store outputs via the storage provider. See [docs/architecture.md](./architecture.md) for the full diagram.

---

## Prerequisites

- Docker 24+ (with BuildKit) and Docker Compose v2
- 2 CPU cores + 2 GB RAM minimum (4+ GB recommended for media workers)
- A TLS-terminating reverse proxy in front of the app (Caddy, Nginx, Cloudflare, AWS ALB). The app listens on plain HTTP on port 3000.
- An SMTP relay or transactional email provider (for verification emails)
- A registered domain (or a localhost tunnel like `cloudflared` for dev)

---

## Quick start — single host (Docker Compose)

```bash
git clone https://github.com/your-org/nextool.git
cd nextool

cp .env.example .env
# Edit .env:
#   - AUTH_SECRET: run `openssl rand -base64 32`
#   - POSTGRES_PASSWORD: run `openssl rand -hex 16`
#   - Set STORAGE_* to your S3 bucket (or leave empty for local FS)
#   - Leave everything else blank to start with sensible defaults

docker compose up -d

# Run Prisma migrations (one-time)
docker compose exec app bunx prisma migrate deploy

# Seed the tool registry (one-time)
docker compose exec app bun run scripts/seed.ts 2>/dev/null || \
  docker compose exec app bunx tsx scripts/seed.ts

# Verify
curl http://localhost:3000/api/ready
# → {"ready":true,...}

curl http://localhost:3000/api/health
# → {"status":"healthy","checks":{...}}
```

The compose file starts:
- `app` (Next.js web + API on port 3000)
- `postgres` (PostgreSQL 17)
- `redis` (Redis 7)
- 6 functional workers: `worker-pdf`, `worker-office`, `worker-image`, `worker-media`, `worker-ocr`, `worker-cleanup`

---

## Environment variables

See `.env.example` for the canonical list. Every variable is optional except:

- `AUTH_SECRET` — required for session/JWT signing. Generate with `openssl rand -base64 32`.
- `DATABASE_URL` — required. SQLite (`file:/path`) works for dev; PostgreSQL in production.

Everything else (storage, redis, email, payment, AI, malware, turnstile, sentry) is optional and gracefully degrades. See [docs/providers.md](./providers.md) for how to configure each.

---

## PostgreSQL setup

**Production**: PostgreSQL 14+ (16 or 17 recommended).

```bash
# In .env:
DATABASE_URL=postgresql://nextool:STRONG_PASSWORD@postgres:5432/nextool?schema=public
```

For a managed Postgres (RDS, Cloud SQL, Neon, Supabase), point `DATABASE_URL` at the managed instance and remove the `postgres` service from docker-compose.yml.

**Schema migrations**:

```bash
# Development (creates + applies migrations):
bunx prisma migrate dev --name init

# Production (applies existing migrations without prompting):
bunx prisma migrate deploy
```

**Connection pooling**: in production with many concurrent API requests, place PgBouncer or Postgres' built-in pooler (Supabase, Neon) in front of the database. Set `?pgbouncer=true&connection_limit=10` on the URL.

---

## Redis setup

Redis is used for:
- Distributed rate limiting (so multiple Next.js instances share counters)
- Future: BullMQ-backed job queue (currently DB-backed; switching is a no-op for callers)

```bash
REDIS_URL=redis://:password@redis:6379/0
# Or with TLS:
REDIS_URL=rediss://:password@redis.example.com:6379/0
```

When `REDIS_URL` is unset, rate limits are per-process (each Next.js instance has its own counter). This is honest and never silently faked — see [docs/security.md](./security.md).

---

## Object storage (S3 / MinIO / R2)

The storage provider is selected by `getStorageProvider()` based on env vars:

```bash
STORAGE_ENDPOINT=https://s3.amazonaws.com        # or https://<account>.r2.cloudflarestorage.com
STORAGE_REGION=us-east-1
STORAGE_BUCKET=nextool-uploads
STORAGE_ACCESS_KEY=...
STORAGE_SECRET_KEY=...
STORAGE_FORCE_PATH_STYLE=false                    # true for MinIO/R2/LocalStack
```

When any of these are missing, the app falls back to local filesystem storage under `tmp/{uploads,outputs,quarantine,exports}/`. **Signed URLs** in local mode are HMAC-tokenized `/api/storage/get` URLs (so the ownership/expiry contract is identical to S3 presigned URLs).

**MinIO quick-start** (for self-hosting):

```bash
# Add to docker-compose.yml:
minio:
  image: minio/minio:latest
  command: server /data --console-address ":9001"
  ports: ["9000:9000", "9001:9001"]
  environment:
    MINIO_ROOT_USER: nextool
    MINIO_ROOT_PASSWORD: STRONG_PASSWORD
  volumes: [minio-data:/data]

# Then in .env:
STORAGE_ENDPOINT=http://minio:9000
STORAGE_BUCKET=nextool
STORAGE_ACCESS_KEY=nextool
STORAGE_SECRET_KEY=STRONG_PASSWORD
STORAGE_FORCE_PATH_STYLE=true
```

---

## LibreOffice install

Used by `worker-office` for: `word-to-pdf`, `excel-to-pdf`, `powerpoint-to-pdf`, `xlsx-to-csv`.

- **Docker**: the `worker-office` image installs LibreOffice automatically (see `Dockerfile.worker`).
- **Bare metal / VM**:
  ```bash
  apt-get install -y libreoffice libreoffice-writer libreoffice-calc libreoffice-impress
  # Verify:
  libreoffice --version
  ```
- **First run is slow**: LibreOffice initializes a user profile (~5s on first invocation). Subsequent runs are faster. Workers reuse the profile across jobs.

---

## FFmpeg install

Used by `worker-media` for: `video-converter`, `video-compressor`, `video-to-gif`, `audio-extractor`, `audio-converter`.

- **Docker**: installed in the `worker-media` image automatically.
- **Bare metal / VM**:
  ```bash
  apt-get install -y ffmpeg
  # Verify:
  ffmpeg -version
  # → ffmpeg 7.x or later recommended
  ```

For ARM hosts, install via your distro's package manager (Ubuntu 24.04 ships FFmpeg 7.x; Debian 12 ships 5.x — both work, but 7.x has better AVIF support).

---

## Tesseract + language packs

Used by `worker-ocr` for `image-to-text` (OCR).

- **Docker**: the `worker-ocr` image installs Tesseract + 11 language packs (eng, deu, fra, spa, ita, por, chi_sim, jpn, rus, ara + the osd traineddata).
- **Bare metal / VM**:
  ```bash
  apt-get install -y tesseract-ocr tesseract-ocr-eng tesseract-ocr-deu tesseract-ocr-fra \
    tesseract-ocr-spa tesseract-ocr-ita tesseract-ocr-por tesseract-ocr-chi-sim \
    tesseract-ocr-jpn tesseract-ocr-rus tesseract-ocr-ara
  # Verify:
  tesseract --version
  tesseract --list-langs
  ```

To add a language not in the default list, install the matching `tesseract-ocr-<lang>` package and rebuild the worker image (or mount the traineddata into `/usr/share/tesseract-ocr/5/tessdata/`).

---

## Stripe webhook setup

Stripe is optional (the app works without it — billing UI is shown but checkout is disabled).

**Setup**:

1. Create a Stripe account → [API keys](https://dashboard.stripe.com/apikeys).
2. In `.env`:
   ```
   PAYMENT_PROVIDER=stripe
   PAYMENT_SECRET=sk_live_...        # or sk_test_...
   PAYMENT_WEBHOOK_SECRET=whsec_...  # from the webhook endpoint
   STRIPE_PRICE_PRO_MONTHLY=price_...
   STRIPE_PRICE_PRO_YEARLY=price_...
   STRIPE_PRICE_BUSINESS_MONTHLY=price_...
   STRIPE_PRICE_BUSINESS_YEARLY=price_...
   ```
3. Create a webhook endpoint pointing to `https://your-nextool-host/api/webhooks/stripe`.
4. Subscribe to: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_succeeded`, `invoice.payment_failed`.
5. The webhook handler verifies the signature with `stripe.webhooks.constructEvent()` — never trusts query params.

**Webhook signature verification is mandatory** (Prompt2 §78). The handler returns 400 if the signature is missing or invalid.

---

## Email provider setup

The email provider is selected by `EMAIL_PROVIDER` env var:

| Provider | Env vars needed |
|---|---|
| `smtp` | `EMAIL_SMTP_HOST`, `EMAIL_SMTP_PORT`, `EMAIL_SMTP_USER`, `EMAIL_SMTP_PASS` |
| `resend` | `EMAIL_API_KEY` |
| `postmark` | `EMAIL_API_KEY` (future) |
| `mailgun` | `EMAIL_API_KEY`, `EMAIL_SMTP_HOST` (future) |
| `ses` | AWS creds in env (future) |

When unset, the app uses a `ConsoleEmailProvider` that logs emails to the server console (dev mode only). This is honestly marked — no fake sending.

```
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_...
EMAIL_FROM=NexTool <no-reply@your-domain.com>
```

> **DNS**: set SPF, DKIM, and DMARC records for `EMAIL_FROM`'s domain. Without these, transactional email will land in spam.

---

## Cloudflare Turnstile

Turnstile is optional (used to protect signup / login forms from bots).

1. Create a widget at <https://dash.cloudflare.com/?to=/:account/turnstile>.
2. In `.env`:
   ```
   TURNSTILE_SITE_KEY=1x...       # public, safe for browser
   TURNSTILE_SECRET_KEY=1x...     # server-only
   ```

When unset, forms still work but have no bot protection. The `/api/auth/*` endpoints will simply skip Turnstile verification.

---

## Sentry

Sentry is optional. When `SENTRY_DSN` is set, errors are forwarded to Sentry automatically. The app's structured logger (`src/lib/observability/log.ts`) redacts fields matching `/secret|password|token|apikey|authorization/i`.

```
SENTRY_DSN=https://<key>@sentry.io/<project>
SENTRY_AUTH_TOKEN=...        # for source-map uploads during build (optional)
```

---

## Backup strategy

**Database**:
- Managed Postgres (RDS, Cloud SQL, Neon, Supabase) — use the provider's automated backups (PITR is recommended).
- Self-hosted — run `pg_dump` nightly + ship to S3:
  ```bash
  pg_dump -U nextool -Fc nextool | \
    aws s3 cp - s3://nextool-backups/$(date +%Y%m%d-%H%M%S).dump
  ```
- Retention: 30 days rolling + monthly snapshots for 1 year.

**Object storage**:
- S3 — enable versioning + a bucket lifecycle policy to retain deleted objects for 30 days.
- R2 / MinIO — same: enable versioning.

**API keys / sessions**: these live in the database — covered by DB backups.

**Secrets** (`.env`):
- Store in a secrets manager (AWS Secrets Manager, Doppler, Vault, 1Password).
- Never commit `.env` to git.
- Rotate `AUTH_SECRET` carefully — rotating it invalidates all sessions.

---

## Migration procedure

When you change the Prisma schema:

1. **Dev**: `bunx prisma migrate dev --name <change_description>`
2. **Production**:
   ```bash
   # 1. Pull the new code
   git pull origin main

   # 2. Apply migrations BEFORE restarting the app
   docker compose exec app bunx prisma migrate deploy

   # 3. Rebuild + restart the app (and workers — they share the schema)
   docker compose build app worker-pdf worker-office worker-image worker-media worker-ocr worker-cleanup
   docker compose up -d
   ```
3. If a migration is destructive (drops a column), back up the DB first.

---

## Rolling deploy

For zero-downtime deploys with multiple app instances:

1. Run migrations against the DB (`prisma migrate deploy`).
2. Start the new app containers (no traffic yet).
3. Wait for `/api/ready` to return 200 on each new instance.
4. Drain traffic from old instances (e.g. via your load balancer).
5. Stop old instances.

Workers can be deployed independently:
- Build the new worker image.
- For each worker type, `docker compose up -d --no-deps --build worker-<name>`.
- Workers complete in-flight jobs before exiting (graceful SIGTERM).

---

## Health check verification

After deploy, verify:

```bash
# Readiness (DB reachable)
curl https://your-nextool-host/api/ready
# → {"ready":true,...}

# Composite health (DB + Redis + Storage)
curl https://your-nextool-host/api/health
# → {"status":"healthy"|"degraded"|"unhealthy", "checks":{...}}

# Individual probes
curl https://your-nextool-host/api/health/database
curl https://your-nextool-host/api/health/redis
curl https://your-nextool-host/api/health/storage

# Provider health (admin UI)
curl https://your-nextool-host/admin/integrations

# Worker heartbeats
curl https://your-nextool-host/admin/workers
```

**Expected**:
- `database` → `healthy` always
- `redis` → `healthy` when `REDIS_URL` is set; `not_configured` otherwise (honest)
- `storage` → `healthy` (local or S3)
- All 6 workers → `idle` or `busy` (not `offline` after 60s of running)

---

## Sandbox limitations (honest)

The sandbox at `/home/z/my-project` differs from production:

| Component | Sandbox | Production |
|---|---|---|
| Database | SQLite (`db/custom.db`) | PostgreSQL 14+ |
| Queue | DB-backed, in-process | Redis + BullMQ (or DB-backed; same public API) |
| Workers | Standalone `bun mini-services/worker-*/index.ts` (must be started manually) | Docker containers (`worker-*` services in compose) |
| Storage | Local FS (`tmp/`) | S3-compatible bucket |
| Redis | Not configured | Configured via `REDIS_URL` |
| Stripe | Not configured | Set `PAYMENT_SECRET` |
| SMTP | Console logger | Set `EMAIL_PROVIDER` + creds |
| ClamAV | Not installed | Install + set `MALWARE_SCANNER` |
| Sentry | Not configured | Set `SENTRY_DSN` |

These gaps are documented at runtime on the `/status` page and never silently faked. The architecture (provider abstractions, env-driven factories, multi-stage Dockerfiles) is identical to production — only the credentials/instances differ.
