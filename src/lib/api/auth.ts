/**
 * API-key authentication (Prompt2 §47, §56, §78).
 *
 * Key format: `nt_live_<base62_32chars>` (total length 40 chars).
 *
 * Storage (Prompt2 §56):
 *   - `keyPrefix` = the first 13 chars of the full key, e.g. "nt_live_ab12cd34"
 *     (used for the indexed lookup — never trust the secret for matching)
 *   - `keyHash`   = sha256(fullKey) as hex (used for constant-time verification)
 *
 * The full key is returned to the caller ONLY at creation time and is NEVER
 * retrievable again. It is NEVER logged.
 *
 * Authentication sources (in priority order):
 *   1. `Authorization: Bearer nt_live_xxx` header (preferred)
 *   2. `?api_key=nt_live_xxx` query param (convenience — less secure, logged
 *      in URLs/proxies; only allow over HTTPS)
 */
import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { log } from "@/lib/observability";

export const KEY_PREFIX_LIVE = "nt_live_";
export const KEY_SECRET_LENGTH = 32; // base62 chars
export const KEY_PREFIX_LENGTH = KEY_PREFIX_LIVE.length + 8; // "nt_live_" + 8 chars of secret

export interface AuthenticatedApi {
  apiKey: {
    id: string;
    userId: string;
    name: string;
    keyPrefix: string;
    lastUsedAt: Date | null;
    createdAt: Date;
  };
  user: {
    id: string;
    email: string;
    name: string | null;
    role: string;
  };
}

/**
 * Extract the API key from a request. Header takes priority; query param is
 * a fallback. Returns null if no key is present or if the format is wrong.
 *
 * SECURITY: never log the full key. We only ever return it to the caller.
 */
export function extractApiKey(req: NextRequest): string | null {
  // 1. Authorization: Bearer <key>
  const authHeader = req.headers.get("authorization") || req.headers.get("Authorization");
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match) {
      const candidate = match[1].trim();
      if (looksLikeApiKey(candidate)) return candidate;
    }
  }
  // 2. ?api_key=<key>
  const url = new URL(req.url);
  const queryKey = url.searchParams.get("api_key");
  if (queryKey && looksLikeApiKey(queryKey)) return queryKey;
  return null;
}

function looksLikeApiKey(s: string): boolean {
  return s.startsWith(KEY_PREFIX_LIVE) && s.length === KEY_PREFIX_LIVE.length + KEY_SECRET_LENGTH;
}

/**
 * Authenticate an API request.
 *
 * Returns the ApiKey + User on success, or null on any failure
 * (missing/invalid/revoked). On success, `lastUsedAt` is updated.
 *
 * The verification flow (Prompt2 §56):
 *   1. Extract the candidate key.
 *   2. Compute `keyPrefix` from the first 13 chars.
 *   3. Look up ApiKey by `keyPrefix` (indexed, fast, never reveals the secret).
 *   4. Compute `sha256(candidateKey)` and timing-safe compare to `keyHash`.
 *   5. Check `revokedAt IS NULL`.
 *   6. Update `lastUsedAt = now()` (best-effort, non-blocking).
 *   7. Return `{ apiKey, user }`.
 */
export async function authenticateApiKey(req: NextRequest): Promise<AuthenticatedApi | null> {
  const candidate = extractApiKey(req);
  if (!candidate) return null;

  // Derive the prefix the same way createApiKey() does
  const keyPrefix = candidate.slice(0, KEY_PREFIX_LENGTH);
  if (!keyPrefix.startsWith(KEY_PREFIX_LIVE)) return null;

  // Indexed lookup
  const apiKey = await db.apiKey.findFirst({
    where: { keyPrefix },
    include: { user: true },
  });
  if (!apiKey) return null;

  // Constant-time hash verification
  const candidateHash = sha256(candidate);
  if (!timingSafeEqualHex(candidateHash, apiKey.keyHash)) {
    // Possible brute-force attempt on a known prefix — log + bail.
    await log.warn("api_auth.hash_mismatch", { apiKeyId: apiKey.id, userId: apiKey.userId });
    return null;
  }

  // Revoked?
  if (apiKey.revokedAt) {
    await log.info("api_auth.revoked_key_used", { apiKeyId: apiKey.id, userId: apiKey.userId });
    return null;
  }

  // Best-effort update of lastUsedAt (non-blocking)
  db.apiKey.update({
    where: { id: apiKey.id },
    data: { lastUsedAt: new Date() },
  }).catch(() => { /* never fail a request because of a timestamp update */ });

  return {
    apiKey: {
      id: apiKey.id,
      userId: apiKey.userId,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      lastUsedAt: apiKey.lastUsedAt,
      createdAt: apiKey.createdAt,
    },
    user: {
      id: apiKey.user.id,
      email: apiKey.user.email,
      name: apiKey.user.name,
      role: apiKey.user.role,
    },
  };
}

// ---------------------------------------------------------------------------
// Crypto helpers
// ---------------------------------------------------------------------------

export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input, "utf-8").digest("hex");
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Generate a base62 secret of the configured length.
 * base62 = [0-9a-zA-Z] (62 chars). 32 chars ≈ 190 bits of entropy.
 */
export function generateBase62Secret(length = KEY_SECRET_LENGTH): string {
  const alphabet = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const bytes = crypto.randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

/**
 * Build the full key string from a secret. Used by createApiKey().
 */
export function buildFullKey(secret: string): string {
  return `${KEY_PREFIX_LIVE}${secret}`;
}

/**
 * Compute the indexed prefix from a full key (or from a secret — caller
 * decides which). Used by createApiKey() and authenticateApiKey().
 */
export function computeKeyPrefix(fullKeyOrSecret: string): string {
  const stripped = fullKeyOrSecret.startsWith(KEY_PREFIX_LIVE)
    ? fullKeyOrSecret.slice(KEY_PREFIX_LIVE.length)
    : fullKeyOrSecret;
  return `${KEY_PREFIX_LIVE}${stripped.slice(0, 8)}`;
}
