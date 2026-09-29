# NexTool — Security

This document describes the security controls in NexTool. It covers file validation, malware scanning, signed URLs, rate limiting, bot protection, CSRF, secrets handling, and worker isolation.

> **Threat model**: NexTool accepts untrusted file uploads from authenticated users (web UI) and API clients. The platform must prevent: malicious file execution, path traversal, denial-of-service via large files, credential exfiltration, and cross-tenant data leakage.

---

## Table of contents

1. [File validation](#file-validation)
2. [Malware scanning](#malware-scanning)
3. [Signed URLs](#signed-urls)
4. [Rate limiting](#rate-limiting)
5. [Cloudflare Turnstile (bot protection)](#cloudflare-turnstile-bot-protection)
6. [CSRF protection](#csrf-protection)
7. [Secrets handling](#secrets-handling)
8. [Worker isolation](#worker-isolation)
9. [API key security](#api-key-security)
10. [Idempotency](#idempotency)
11. [Audit logging](#audit-logging)
12. [Sandbox limitations (honest)](#sandbox-limitations-honest)

---

## File validation

Every uploaded file passes through three validation layers before it reaches a processor:

### 1. Magic-byte signature check (never trusts the declared MIME)

`src/lib/tool-engine.ts` → `detectFileType(buf)`:

- Reads the first 4–12 bytes and matches against a known-signature table (`%PDF`, `\x89PNG`, `RIFF...WEBP`, etc.).
- For zip-based Office formats (`.docx`, `.xlsx`, `.pptx`), peeks inside the zip to find the characteristic content-type filenames (`word/`, `xl/`, `ppt/`).
- Returns the detected `{ ext, mime }` — this becomes the **authoritative** type, stored in `FileAsset.detectedMimeType`.

The client-declared `Content-Type` and filename extension are stored for reference (`FileAsset.mimeType`) but are NEVER used to make security decisions.

### 2. Tool allowlist check

`src/lib/tool-engine.ts` → `validateFile(buf, name, declaredMime, allowedMimes, maxSize)`:

- Checks the detected MIME is in the tool's `inputFormats` allowlist (defined in `src/lib/tool-registry.ts`).
- Checks the file size against `tool.maxFileSize`.
- Returns a human-readable error string or `null` (valid).

### 3. Quarantine prefix

The first upload goes to `quarantine/` prefix in storage (not `uploads/`). The `FileAsset.scanStatus` starts as `"pending"` and is updated to `"clean"` (or `"skipped"` when no scanner is configured) before the worker processes the file.

```
POST /api/v1/compress-pdf
  ↓
storage.upload(buf, name, { prefix: "quarantine" })
  ↓
FileAsset.scanStatus = "pending"
  ↓
(worker) → scanner.scan(buf, name)
  ↓
FileAsset.scanStatus = "clean" | "infected" | "skipped"
  ↓ if clean or skipped
(worker) → processor(buf, name, options)
```

### 4. Output validation

Every processor's output is validated by `src/lib/processors/output-validator.ts`:

- Magic-byte check against `tool.outputFormats`.
- Size cap (500 MB hard limit per output).
- Rejects files that don't match the expected type (so a buggy processor can't return garbage labeled as a PDF).

---

## Malware scanning

If `MALWARE_SCANNER` is set (to `clamscan` or `clamdscan`), every uploaded file is scanned by ClamAV before processing.

### Modes

| Mode | Env | Behavior |
|---|---|---|
| `clamscan` | `MALWARE_SCANNER=clamscan` | Invokes the `clamscan` binary on the file. Parses exit codes: 0=clean, 1=infected (extracts virus name), 2+=error. |
| `clamdscan` | `MALWARE_SCANNER=clamdscan` + `CLAMD_HOST` / `CLAMD_PORT` / `CLAMD_SOCKET` | Connects to a running clamd daemon via TCP/Unix socket. Uses the `zINSTREAM\0` protocol with 4-byte big-endian chunk framing (256KB max per chunk). |
| (unset) | — | `NullScanner` returns `{ status: "skipped", detail: "Malware scanning not configured — file passed signature/size validation only." }`. Honest — does NOT claim clean. |

### Implementation

- `src/lib/providers/malware/types.ts` — `MalwareScanner` interface.
- `src/lib/providers/malware/clamav.ts` — `ClamAvScanner` (both modes).
- `src/lib/providers/malware/null.ts` — `NullScanner`.
- `src/lib/providers/malware/index.ts` — `getMalwareScanner()` (async, cached; awaits scanner init before caching).

### Worker integration

`src/lib/queue/worker.ts`:

1. After loading the input from storage, transitions the job to `scanning`.
2. Awaits `getMalwareScanner()`.
3. If `scanner.configured === true`, calls `scanner.scan(buf, name)`.
   - On `infected` or `suspicious` → `failJob(jobId, "malware_detected", detail, retriable=false)` and returns.
   - On `clean` → updates `FileAsset.scanStatus = "clean"` and continues to processing.
4. If `scanner.configured === false`, updates `FileAsset.scanStatus = "skipped"` and continues (honest — never silently claims clean).

---

## Signed URLs

Download URLs for output files are always signed and time-limited.

### S3 mode

`S3StorageProvider.createDownloadUrl(key, filename, opts)` returns a real AWS presigned URL via `@aws-sdk/s3-request-presigner`. Default TTL: 15 minutes.

### Local mode

`LocalStorageProvider.createDownloadUrl(key, filename, opts)` returns an HMAC-tokenized URL:

```
/api/storage/get?key=outputs/...&expires=<unix>&sig=<hmac>&filename=...
```

`/api/storage/get` verifies:

1. The `expires` timestamp is in the future (else 410 Gone).
2. The `sig` matches `HMAC-SHA256(AUTH_SECRET, "${key}:${expires}")` (constant-time compare, else 403).

The HMAC uses `process.env.AUTH_SECRET` — the same secret NextAuth uses for JWT signing. Rotating `AUTH_SECRET` invalidates all signed URLs (and sessions).

---

## Rate limiting

`src/lib/security/rate-limit.ts` provides:

- `rateLimit(key, { windowSec, limit })` — generic token-bucket.
- `rateLimitByIp(ip, opts)` — for anonymous endpoints.
- `rateLimitByApiKey(apiKeyId, opts)` — for `/api/v1/*` endpoints.

### Plan-based limits

`limitsForPlan(slug)` returns:

| Plan | `processPerHour` | `apiPerMinute` |
|---|---|---|
| `free` | 20 | 5 |
| `pro` | 100 | 20 |
| `business` | 500 | 60 |

### Backend

- When `REDIS_URL` is set: distributed rate limit (planned: Lua script for INCR+EXPIRE atomicity; currently falls back to memory).
- When unset: in-memory token-bucket per Next.js process. **Honest**: with multiple app instances, the effective limit is `apiPerMinute × numInstances` (each instance has its own counter). Documented on the `/status` page.

### 429 response

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 47
Content-Type: application/json

{
  "error": {
    "code": "rate_limited",
    "message": "API rate limit exceeded.",
    "limit": 5,
    "retryAfter": 47
  },
  "requestId": "REQ-71F2"
}
```

---

## Cloudflare Turnstile (bot protection)

Optional. When `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` are set:

- The signup / login forms render a Turnstile widget.
- The form submission includes the token.
- The `/api/auth/*` endpoints verify the token by calling `https://challenges.cloudflare.com/turnstile/v0/siteverify` with the secret key.

When unset, forms still work but have no bot protection. Honest — see `getProviderHealth()` in `src/lib/providers/index.ts`.

---

## CSRF protection

- **Web UI**: NextAuth v4's built-in CSRF token (double-submit cookie pattern). Applied to all `POST`/`DELETE`/`PUT` mutations through the NextAuth form handlers.
- **API routes** (`/api/v1/*`): bearer-token auth. CSRF doesn't apply — attackers can't forge `Authorization: Bearer nt_live_...` headers from another origin (CORS preflight would block the request).

---

## Secrets handling

### In code

- The structured logger (`src/lib/observability/log.ts`) redacts log context fields matching `/secret|password|token|apikey|authorization/i` to `"[redacted]"`.
- API key secrets are NEVER logged — `src/lib/api/auth.ts`'s `authenticateApiKey` only logs `apiKeyId` and `userId`, never the key itself.
- The `createApiKey()` function returns the full key ONCE; the function logs only `apiKeyId`, `userId`, and `name` — never the secret.

### In env vars

- `.env` is gitignored and excluded from Docker images via `.dockerignore`.
- `.env.example` contains placeholder values only.
- In production, secrets should live in a secrets manager (AWS Secrets Manager, Doppler, Vault, 1Password) and be injected at container start.

### In storage

- API key secrets are NEVER stored. Only `sha256(fullKey)` is persisted as `ApiKey.keyHash`.
- The `keyPrefix` (first 13 chars) is stored for the indexed lookup — this is safe to display (it's enough to identify a key in the UI but not enough to authenticate).
- Sessions: NextAuth JWT in an HttpOnly cookie. The JWT is signed with `AUTH_SECRET`.

---

## Worker isolation

Each worker runs in its own container:

- Built from `Dockerfile.worker` with the `WORKER_NAME` build arg.
- Runs as non-root user `nextool` (UID 1001).
- Has NO inbound network ports — workers only make outbound calls (DB, storage, optional clamd).
- Uses `tini` as PID 1 for proper signal handling.
- Healthcheck verifies `Worker.lastHeartbeat` is recent (≤30s for processing workers; ≤60s for cleanup).
- Graceful shutdown: SIGTERM → worker stops polling, completes the current job, updates `Worker.status = "offline"`, exits 0.

Worker containers CAN access the DB and storage (shared volumes in compose). They CANNOT access the Next.js app's HTTP port (it's on a separate container).

---

## API key security

### Format

- `nt_live_<base62_32chars>` (40 chars total).
- The `nt_live_` prefix identifies the key type (future: `nt_test_` for sandbox keys, `nt_admin_` for admin keys).
- 32 chars of base62 ≈ 190 bits of entropy.

### Storage

- `ApiKey.keyPrefix` = first 13 chars (`nt_live_` + 8 chars of secret). Indexed for fast lookup.
- `ApiKey.keyHash` = `sha256(fullKey)` as hex. Used for constant-time verification.
- `ApiKey.revokedAt` — set on revocation (soft delete; row is retained for audit).
- `ApiKey.lastUsedAt` — updated on every successful auth (best-effort, non-blocking).

### Auth flow

`authenticateApiKey(req)`:

1. Extracts the candidate key from `Authorization: Bearer` header (preferred) or `?api_key=` query (fallback).
2. Computes `keyPrefix` from the first 13 chars.
3. Looks up `ApiKey` by `keyPrefix` (indexed, fast).
4. Computes `sha256(candidateKey)` and `crypto.timingSafeEqual()` against `keyHash`.
5. Returns null if `revokedAt` is set.
6. Updates `lastUsedAt` (non-blocking).
7. Returns `{ apiKey, user }`.

### Anti-brute-force

- The `keyPrefix` is small (13 chars), so an attacker could theoretically enumerate prefixes. The `keyHash` is the real check — `sha256` of a 40-char input space is infeasible to brute-force.
- On hash mismatch, we log `api_auth.hash_mismatch` (warning) with `apiKeyId` and `userId` so operators can detect enumeration attempts.

### Lifecycle

- **Create**: `createApiKey(userId, name)` — generates secret, hashes, persists. Returns the full key ONCE.
- **List**: `listApiKeys(userId)` — returns all keys (revoked + active) with `keyPrefix` only (no secret).
- **Revoke**: `revokeApiKey(id, userId)` — sets `revokedAt = now()`. Idempotent. Irreversible.

---

## Idempotency

Clients can pass an `Idempotency-Key` header on POST `/api/v1/{tool}` to safely retry after network errors.

- The key is per-user (the same key from two different users creates two jobs).
- The key is opaque to the server — any non-empty string ≤ 256 chars.
- Lookup: `getIdempotentResult(key, userId)` queries `ProcessingJob` by `(idempotencyKey, userId)`.
- Classification:
  - **Non-terminal** (queued, processing, scanning, etc.) → 409 Conflict + polling URL.
  - **Completed** → 200 + cached result (the same output is returned).
  - **Failed/cancelled/expired** → fall through and create a new job (allowing retry).
  - **None** → create a new job.

---

## Audit logging

### Job events

Every state transition records a `JobEvent` row (`src/lib/queue/index.ts` → `recordEvent`):

- `job.created`, `job.queued`, `job.validating`, `job.scanning`, `job.started`, `job.processing`, `job.output_validated`, `job.completed`, `job.failed`, `job.cancelled`, `job.expired`, `job.retrying`, `job.dead_lettered`.
- Each event has `level` (info/warn/error) + optional `meta` JSON.
- Visible in the admin UI: `/admin/jobs/{id}` shows the full timeline.

### API request analytics

Every `/api/v1/*` request records an `ApiUsage` row:

- `apiKeyId`, `endpoint`, `method`, `status`, `durationMs`, `createdAt`.
- Indexed by `apiKeyId` for fast per-key usage queries.
- Best-effort — never fails the request because logging failed.

### Structured logs

`src/lib/observability/log.ts` emits JSON logs to stdout/stderr with:

- `timestamp`, `level`, `service`, `environment`, `message`.
- Plus `requestId`, `userId`, `jobId`, `toolId`, `workerId`, `duration`, `errorCode` as available.
- When `SENTRY_DSN` is set, errors are also forwarded to Sentry (via the Sentry SDK's auto-capture).

---

## Sandbox limitations (honest)

The sandbox at `/home/z/my-project` does NOT have:

- **Redis**: rate limits are per-process. Each Next.js worker instance has its own counter. Documented on `/status`.
- **S3 / MinIO**: files live on local FS. Signed URLs are HMAC-tokenized (same ownership/expiry contract as S3 presigned URLs).
- **Stripe**: no `PAYMENT_SECRET` → no plans seeded → all API keys use `free` plan limits.
- **Email**: `ConsoleEmailProvider` logs to stdout, returns `ok: false` (no fake send).
- **ClamAV**: not installed. `NullScanner` returns `{ status: "skipped" }` honestly.
- **Tesseract language packs**: only English is installed in the sandbox (the worker image installs 11 languages).
- **Sentry**: not configured. Errors go to server stderr only.

These gaps are surfaced on the `/status` page and the admin Integrations page. The architecture (provider interfaces, env-driven factories, multi-stage Dockerfiles) is identical to production — only the credentials/instances differ.
