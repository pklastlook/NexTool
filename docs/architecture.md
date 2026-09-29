# NexTool — Architecture

This document describes the actual architecture of NexTool, the provider-abstraction model, the queue + worker lifecycle, the job state machine, and the security layers. It is intentionally honest about what is built vs. what is configured in the sandbox.

---

## High-level diagram (Prompt2 §3)

```
┌────────────────────────────────────────────────────────────────────────┐
│                              CLIENT (browser)                          │
│  - Next.js App Router (RSC) + Tailwind + shadcn/ui                     │
│  - Client-side tools (no upload): calculators, JSON formatters,        │
│    QR/barcode generators, etc.                                          │
│  - Server-side tools route through /api/process/[slug] (web) or        │
│    /api/v1/[tool] (REST API with API key).                             │
└─────────────┬──────────────────────────────────────────────────────────┘
              │ HTTPS
              │ (optional: Cloudflare CDN/WAF)
              │
              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          NEXT.JS APP (web + API)                        │
│                                                                         │
│  ┌─────────────────────────┐  ┌──────────────────────────────────────┐  │
│  │ Web UI routes           │  │ API routes                           │  │
│  │  /                      │  │  /api/process/[slug]  (web upload)    │  │
│  │  /tools                 │  │  /api/v1/[tool]       (REST API)     │  │
│  │  /tools/[slug]          │  │  /api/v1/jobs/[id]    (job polling)  │  │
│  │  /category/[slug]       │  │  /api/v1/keys         (key mgmt)    │  │
│  │  /api-docs              │  │  /api/health, /ready, /capabilities │  │
│  │  /admin/*               │  │  /api/storage/get    (signed URL)   │  │
│  └─────────────────────────┘  └──────────────────────────────────────┘  │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ Server libs                                                      │   │
│  │  - Prisma ORM (PostgreSQL-ready, SQLite for sandbox)             │   │
│  │  - Auth: NextAuth (sessions) + API key auth (HMAC + sha256)      │   │
│  │  - Rate limit (in-memory or Redis)                               │   │
│  │  - Queue: createJob / claimNextJob / transition / completeJob    │   │
│  │  - Idempotency: keyed on (userId, Idempotency-Key header)         │   │
│  │  - Storage provider: S3 | Local (factory in providers/storage)    │   │
│  │  - Malware provider: ClamAV | Null (factory in providers/malware)│   │
│  │  - Email/SMTP, Payment/Stripe, AI/OpenAI providers (similar)     │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└───────┬───────────────┬────────────────────────────────────┬───────────┘
        │               │                                    │
        ▼               ▼                                    ▼
┌──────────────┐ ┌──────────────┐                ┌─────────────────────────┐
│  PostgreSQL  │ │    Redis     │                │      Storage            │
│  (Prisma)    │ │  (optional)  │                │  S3 | MinIO | R2 | Local│
└──────────────┘ └──────────────┘                └─────────────────────────┘
        ▲                                                 ▲
        │                                                 │
        │             poll + claim                        │
        │                                                 │
┌───────┴─────────────────────────────────────────────────┴───────────────┐
│                           WORKERS                                      │
│                                                                        │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐         │
│  │ worker-pdf │ │worker-     │ │worker-     │ │worker-     │         │
│  │            │ │office      │ │image       │ │media       │         │
│  │ Ghostscript│ │LibreOffice │ │ Sharp      │ │ FFmpeg     │         │
│  │ poppler    │ │            │ │            │ │            │         │
│  └────────────┘ └────────────┘ └────────────┘ └────────────┘         │
│  ┌────────────┐ ┌──────────────────────────────────────────────┐       │
│  │worker-ocr  │ │ worker-cleanup                                │       │
│  │Tesseract   │ │ - purgeExpiredFileAssets                      │       │
│  └────────────┘ │ - expireStaleJobs                             │       │
│                 │ - recoverStalledJobs                          │       │
│                 │ - purgeTombstones (24h)                      │       │
│                 └──────────────────────────────────────────────┘       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Provider abstraction

Every external dependency sits behind a TypeScript interface, selected at runtime by an env-driven factory. The rest of the app talks only to the interface, never to a concrete implementation.

| Provider | Interface file | Implementations | Factory |
|---|---|---|---|
| Storage | `src/lib/providers/storage/types.ts` | `LocalStorageProvider`, `S3StorageProvider` | `getStorageProvider()` |
| Malware scanner | `src/lib/providers/malware/types.ts` | `NullScanner`, `ClamAvScanner` | `getMalwareScanner()` (async) |
| Email | `src/lib/providers/email/types.ts` | `ConsoleEmailProvider`, `SmtpEmailProvider`, `ResendEmailProvider` | `getEmailProvider()` |
| Payment | `src/lib/providers/payment/types.ts` | `NoopPaymentProvider`, `StripePaymentProvider` | `getPaymentProvider()` |
| AI | `src/lib/providers/ai/types.ts` | `NoopAIProvider`, `OpenAIProvider` | `getAIProvider()` |

### Rules

1. **Every provider class has `readonly name: string` + `readonly configured: boolean`.**
2. **Every factory caches its instance** (single shared instance per process).
3. **No constructor ever throws** — it sets `configured = false` and the factory decides whether to use it or fall back.
4. **No secrets are ever logged.** The structured logger (`src/lib/observability/log.ts`) redacts field names matching `/secret|password|token|apikey|authorization/i`.
5. **When credentials are missing, providers honestly report `not_configured`** on the `/api/health` endpoint and the admin Integrations page — never fake "ok".

See [docs/providers.md](./providers.md) for how to add a new provider.

---

## Queue + worker model

The job queue is DB-backed in the sandbox (no Redis required). The public API is identical to a Redis/BullMQ-backed queue, so swapping the backend is a no-op for callers.

### Components

- `src/lib/queue/state-machine.ts` — valid state transitions (`canTransition`, `assertTransition`).
- `src/lib/queue/index.ts` — `createJob`, `claimNextJob`, `transition`, `completeJob`, `failJob`, `cancelJob`, `recoverStalledJobs`, `recordEvent`.
- `src/lib/queue/worker.ts` — the `Worker` base class that each worker mini-service instantiates.

### Job lifecycle

1. **Client** POSTs a file to `/api/v1/[tool]` (or `/api/process/[slug]` from the web UI).
2. The route handler uploads the input to `quarantine/` and creates a `FileAsset` row (`scanStatus="pending"`).
3. The handler calls `createJob({ toolId, userId, options, idempotencyKey })`. This:
   - Checks idempotency: if a non-terminal job with the same `(userId, idempotencyKey)` exists, returns that job instead of creating a new one.
   - Resolves the tool slug → tool ID (DB lookup).
   - Inserts a `ProcessingJob` row with `status="queued"`.
   - Emits a `job.created` + `job.queued` event.
4. A worker polls `claimNextJob(queue, workerId)`:
   - Atomically claims via `UPDATE … WHERE status='queued' AND workerId IS NULL` (SQLite-equivalent of `SELECT FOR UPDATE SKIP LOCKED`).
   - Transitions to `processing`.
5. The worker:
   - Loads input bytes from storage via `storage.download(fileAsset.storageKey)`.
   - Transitions to `scanning`. If a scanner is configured, runs `scanner.scan(buf, name)`. Sets `FileAsset.scanStatus = "clean" | "infected" | "skipped"`. If infected → `failJob` (non-retriable).
   - Transitions to `processing`. Runs the processor.
   - Transitions to `validating_output`. Validates the output buffer against `tool.outputFormats` + magic bytes.
   - Stores the output via `storage.upload(buf, name, { prefix: "outputs" })`. Creates a `FileAsset` row (`role="output"`).
   - Transitions to `completed`. Sets `resultMeta`.
6. The API route polls the DB every 1s for up to 60s. On completion → returns 200 + signed download URL. On timeout → 202 + poll URL.

### State machine

```
CREATED
  ↓
QUEUED
  ↓
VALIDATING  ←→  SCANNING
  ↓
PROCESSING
  ↓
VALIDATING_OUTPUT
  ↓
COMPLETED  |  FAILED  |  CANCELLED
                            ↓ (retry)
                          QUEUED

Any state → EXPIRED (by cleanup worker)
```

`FAILED → QUEUED` is the only "backward" transition (retry path). All terminal states (`completed`, `cancelled`, `expired`) cannot transition anywhere. See `src/lib/queue/state-machine.ts` for the full transition table.

### Worker heartbeat

Each worker updates its `Worker` row's `lastHeartbeat` every 5s. The admin UI (`/admin/workers`) computes effective status: any heartbeat older than 30s is shown as `degraded` (red badge). Stalled workers are recovered by `worker-cleanup`'s `recoverStalledJobs()` call (re-queues jobs whose `processing` state has been stuck for > 5min).

---

## Security layers

1. **Authentication**:
   - Web UI: NextAuth session cookie (P2-5 wires the full credential/email-verification flow).
   - API: bearer API key (`nt_live_<base62_32>`), looked up by `keyPrefix`, verified by `sha256(fullKey)` timing-safe compare.
2. **Authorization**:
   - `/api/v1/jobs/[id]`: the job's `userId` must match the API key's owning user.
   - `/api/v1/keys/*`: session-auth required; `userId`-scoped queries ensure users can't list/revoke each other's keys.
3. **Rate limiting**:
   - Per API key, per minute. Plan-driven (`limitsForPlan(slug)` returns `{ processPerHour, apiPerMinute }`).
   - 429 response includes `Retry-After` header + JSON body.
4. **File validation**:
   - Magic-byte signature check (never trusts the declared MIME or filename extension).
   - Size limit per tool (`maxFileSize` from the registry).
   - Quarantine prefix on upload (`/quarantine/...`) until scan completes.
5. **Malware scanning**:
   - If `MALWARE_SCANNER=clamscan|clamdscan`, every uploaded file is scanned before processing. Infected files are rejected with `errorCode="malware_detected"`.
   - If unset, files pass signature/size validation only. Honest — see `NullScanner`'s `detail` field.
6. **Signed URLs**:
   - In S3 mode: real AWS presigned URLs (15-min default TTL).
   - In local mode: HMAC-tokenized `/api/storage/get?key=...&expires=...&sig=...` URLs — same ownership/expiry contract.
7. **CSRF**: NextAuth's built-in CSRF token for the web UI. API routes are bearer-token-auth (no CSRF surface).
8. **Turnstile** (optional): bot protection on signup/login forms.
9. **Secrets handling**: never logged; the logger redacts sensitive field names. `.env` is gitignored and excluded from Docker images via `.dockerignore`.
10. **Worker isolation**: each worker runs in its own container as non-root user `nextool`. Workers can only access the DB + storage (no inbound network ports).

See [docs/security.md](./security.md) for the full security model.

---

## What is NOT wired (honest)

- **Creative queue**: `worker-creative` exists and heartbeats, but has no processors registered. Any job routed there will fail honestly with "No processor registered".
- **Stripe plans**: schema has `Plan` + `Subscription` + `Payment` models. Without `PAYMENT_SECRET`, no plans exist — all API keys use the `free` plan limits.
- **Email verification**: the SMTP/Resend provider is wired, but without `EMAIL_*` env vars the console provider logs emails and returns `ok: false` (no fake send).
- **AI tools**: the OpenAI provider is wired, but without `AI_API_KEY` or `ZAI_API_KEY`, AI-assisted features are disabled.
- **Redis-backed BullMQ**: the queue module's Redis branch is stubbed (calls `ioredis` dynamically, falls back to in-memory on error). The DB-backed queue is the real implementation used in production today.

These gaps are surfaced at runtime on the `/status` page and the admin Integrations page — never silently faked.
