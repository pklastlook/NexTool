/**
 * API key management (Prompt2 §46, §47, §56).
 *
 * Lifecycle:
 *   - createApiKey(userId, name) → generates a full key, stores keyPrefix +
 *     keyHash, returns the full key ONCE.
 *   - listApiKeys(userId)        → returns all keys (revoked + active) with
 *     secrets redacted (only the keyPrefix is shown, so the user can identify
 *     which key is which).
 *   - revokeApiKey(id, userId)   → soft-deletes by setting revokedAt = now().
 *
 * Security invariants (Prompt2 §56, §78):
 *   - The full key is NEVER stored. Only sha256(fullKey).
 *   - The full key is NEVER logged.
 *   - The full key is returned ONLY in the createApiKey() result.
 *   - Revocation is irreversible (set revokedAt, never delete the row).
 *   - Only the owner can list/revoke their keys (userId scope).
 */
import { db } from "@/lib/db";
import { log } from "@/lib/observability";
import {
  buildFullKey,
  computeKeyPrefix,
  generateBase62Secret,
  sha256,
  KEY_SECRET_LENGTH,
} from "@/lib/api/auth";

export interface ApiKeyCreated {
  /** The full key — return to the caller ONCE, never store, never log. */
  fullKey: string;
  apiKey: ApiKeyPublic;
}

export interface ApiKeyPublic {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

/**
 * Create a new API key for a user.
 *
 * Returns `{ fullKey, apiKey }`. The `fullKey` is the ONLY time the secret is
 * materialized — it is hashed immediately and never persisted.
 */
export async function createApiKey(
  userId: string,
  name: string
): Promise<ApiKeyCreated> {
  const trimmedName = name.trim();
  if (trimmedName.length === 0) throw new Error("API key name is required.");
  if (trimmedName.length > 80) throw new Error("API key name must be ≤ 80 chars.");

  // Generate secret + derive prefix + hash
  const secret = generateBase62Secret(KEY_SECRET_LENGTH);
  const fullKey = buildFullKey(secret);
  const keyPrefix = computeKeyPrefix(fullKey);
  const keyHash = sha256(fullKey);

  const created = await db.apiKey.create({
    data: {
      userId,
      name: trimmedName,
      keyPrefix,
      keyHash,
    },
  });

  await log.info("api_key.created", { apiKeyId: created.id, userId, name: trimmedName });
  // Note: the full key is NEVER logged.

  return {
    fullKey,
    apiKey: toPublic(created),
  };
}

/**
 * List all API keys for a user. Secrets are NEVER included — only the
 * keyPrefix (which is safe to display).
 */
export async function listApiKeys(userId: string): Promise<ApiKeyPublic[]> {
  const rows = await db.apiKey.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toPublic);
}

/**
 * Get a single API key (no secret — only the keyPrefix is shown).
 * Returns null if the key doesn't exist OR doesn't belong to the caller.
 */
export async function getApiKey(id: string, userId: string): Promise<ApiKeyPublic | null> {
  const row = await db.apiKey.findFirst({ where: { id, userId } });
  return row ? toPublic(row) : null;
}

/**
 * Revoke an API key (soft-delete). Idempotent — revoking an already-revoked
 * key is a no-op. Returns the updated key, or null if not found / not owned.
 */
export async function revokeApiKey(id: string, userId: string): Promise<ApiKeyPublic | null> {
  // Scope to userId so users can't revoke each other's keys.
  const row = await db.apiKey.findFirst({ where: { id, userId } });
  if (!row) return null;
  if (row.revokedAt) return toPublic(row); // already revoked — idempotent
  const updated = await db.apiKey.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  await log.info("api_key.revoked", { apiKeyId: id, userId });
  return toPublic(updated);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toPublic(row: {
  id: string;
  userId: string;
  name: string;
  keyPrefix: string;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}): ApiKeyPublic {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    keyPrefix: row.keyPrefix,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    createdAt: row.createdAt,
  };
}
