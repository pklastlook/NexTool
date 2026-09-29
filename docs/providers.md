# NexTool — How to add a new provider

This document walks through adding a new external provider (storage, email, payment, AI, malware, etc.) to NexTool. Every provider sits behind a TypeScript interface and is selected at runtime by an env-driven factory.

## Steps

### 1. Define the interface

Create `src/lib/providers/<category>/types.ts`:

```typescript
export interface MyProvider {
  /** Static identifier — used in logs + admin UI */
  readonly name: string;
  /** True when credentials/settings are present AND a connection probe succeeded */
  readonly configured: boolean;
  /** The actual operation(s) this provider performs */
  doSomething(input: string): Promise<{ ok: boolean; data?: unknown; error?: string }>;
}
```

### Rules (Prompt2 §10–§12, §60):

1. Every provider class has `readonly name: string` + `readonly configured: boolean`.
2. The constructor MUST NOT throw — set `configured = false` on missing creds, the factory decides what to do.
3. Never log secrets. The structured logger redacts fields matching `/secret|password|token|apikey|authorization/i`, but you should ALSO avoid passing secret values into log contexts.
4. When credentials are missing, honestly return `ok: false` from operations (or throw a clear actionable error). Never return fake success.

### 2. Implement at least two concrete classes

- A real implementation (e.g. `MyRealProvider`).
- A `NullProvider` / `NoopProvider` that returns honest "not configured" responses.

### 3. Create a factory with caching

Create `src/lib/providers/<category>/index.ts`:

```typescript
import type { MyProvider } from "./types";
import { MyRealProvider } from "./my-real";
import { NullProvider } from "./null";

let cached: MyProvider | null = null;

export function getMyProvider(): MyProvider {
  if (cached) return cached;
  const real = new MyRealProvider();
  cached = real.configured ? real : new NullProvider();
  return cached;
}

export type { MyProvider } from "./types";
```

### 4. Register the provider in the health system

Add an entry to `getProviderHealth()` in `src/lib/providers/index.ts`:

```typescript
const hasMyProvider = !!env("MY_PROVIDER_KEY");
list.push({
  id: "my-provider",
  name: "My Provider",
  category: "<one of: storage | database | queue | pdf | office | image | media | ocr | email | payment | ai | analytics | monitoring | malware>",
  status: hasMyProvider ? "configured" : "not_configured",
  detail: hasMyProvider ? "Configured." : "Not configured. Set MY_PROVIDER_KEY in .env.",
  lastChecked: now,
});
```

This makes the provider visible on:
- `/api/health`
- `/admin/integrations`
- `/status` (public status page)

### 5. Add env vars to `.env.example`

Document every var the provider reads. Use comments to explain what each does, where to get the value, and what the default is.

### 6. Add a status check (if the provider exposes one)

If the provider exposes a "ping" or "list accounts" endpoint, call it lazily (on first use) and cache the result. The factory's `getMyProvider()` should await `real.ready()` before caching — see `src/lib/providers/malware/clamav.ts` for an example with async init.

### 7. Add env vars to `src/lib/env.ts`

If you want strongly-typed env access via the `env` object:

```typescript
export const env = {
  // ... existing keys
  MY_PROVIDER_KEY: read("MY_PROVIDER_KEY"),
} as const;
```

This is optional — most providers read `process.env` directly via the `env()` helper in `src/lib/providers/index.ts`.

### 8. Wire the provider into callers

Replace any inline `if (process.env.MY_PROVIDER_KEY) { ... }` checks in route handlers / workers with a call to `getMyProvider()`. The factory handles all the env-driven selection logic.

### 9. Document the provider

Add a section to `docs/deployment.md` explaining how to set it up.

## Example: storage providers

The storage provider is the canonical example:

| File | Purpose |
|---|---|
| `src/lib/providers/storage/types.ts` | `StorageProvider` interface (upload/download/delete/exists/metadata/createDownloadUrl/createUploadUrl). |
| `src/lib/providers/storage/local.ts` | `LocalStorageProvider` — sandbox/dev. Files on local FS, HMAC-tokenized signed URLs. |
| `src/lib/providers/storage/s3.ts` | `S3StorageProvider` — production. AWS SDK v3 with presigned URLs. |
| `src/lib/providers/storage/index.ts` | `getStorageProvider()` factory. Selects S3 if `STORAGE_*` env vars are present; else Local. |

Switching from local to S3 requires **zero changes** anywhere else in the app — every caller goes through `getStorageProvider()`.

## Example: email providers

The email provider shows how to support multiple real providers behind one interface:

| File | Purpose |
|---|---|
| `src/lib/providers/email/types.ts` | `EmailProvider` interface (sendVerification, sendPasswordReset, etc.). |
| `src/lib/providers/email/console.ts` | `ConsoleEmailProvider` — dev only, logs to stdout. |
| `src/lib/providers/email/smtp.ts` | `SmtpEmailProvider` — production via nodemailer. |
| `src/lib/providers/email/resend.ts` | `ResendEmailProvider` — production via Resend's API. |
| `src/lib/providers/email/templates.ts` | HTML email templates (verification, reset). |
| `src/lib/providers/email/index.ts` | `getEmailProvider()` factory. Selects based on `EMAIL_PROVIDER` env. |

## What NOT to do

- ❌ Don't read `process.env` in route handlers — always go through the factory.
- ❌ Don't bake credentials into the image — read from env at runtime.
- ❌ Don't return fake "ok" when credentials are missing — throw or return `ok: false` with a clear actionable message.
- ❌ Don't construct the provider in a hot path — always use the cached factory instance.
- ❌ Don't log secrets — the structured logger does some redaction, but you should also avoid passing secrets into contexts.
- ❌ Don't fake the "configured" check — if `STORAGE_BUCKET` is missing, `S3StorageProvider.configured` MUST be `false`, not `true`.
