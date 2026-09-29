/**
 * Idempotency for API requests (Prompt2 §57).
 *
 * The contract:
 *   - Clients may pass an `Idempotency-Key` header on POST /api/v1/{tool}.
 *   - If we already have a ProcessingJob for the same (userId, idempotencyKey),
 *     we DON'T create a new one — we return the existing one.
 *   - If the existing job is non-terminal (queued/processing/scanning/...),
 *     the API returns 409 Conflict with the job's polling URL.
 *   - If the existing job is completed, the API returns the cached result
 *     (200) so clients can retry safely after a network blip.
 *   - If the existing job is failed/cancelled/expired, the API treats it as a
 *     fresh request and creates a new job (allowing retry after failure).
 *
 * Key rules (Prompt2 §57):
 *   - Idempotency-Key is PER USER: the same key used by two different users
 *     creates two different jobs.
 *   - The key is opaque to the server — any non-empty string ≤ 256 chars.
 *   - Keys are NOT rotated automatically — clients should generate UUIDs.
 */
import { db } from "@/lib/db";
import type { JobState } from "@/lib/queue/state-machine";

export const IDEMPOTENCY_KEY_MAX_LENGTH = 256;

export interface IdempotentJob {
  id: string;
  status: JobState;
  toolId: string;
  errorCode: string | null;
  errorMessage: string | null;
  resultMeta: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export const TERMINAL_STATES: JobState[] = ["completed", "failed", "cancelled", "expired"];
export const NON_TERMINAL_STATES: JobState[] = [
  "created", "queued", "validating", "scanning", "processing", "validating_output",
];

/**
 * Validate an idempotency key. Returns the cleaned key, or null if invalid.
 */
export function validateIdempotencyKey(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0 || trimmed.length > IDEMPOTENCY_KEY_MAX_LENGTH) return null;
  // Reject keys containing newlines/control chars — they shouldn't appear in headers.
  if (/[\r\n\x00-\x1f]/.test(trimmed)) return null;
  return trimmed;
}

/**
 * Look up an existing job by (idempotencyKey, userId).
 *
 * Returns the most recent job (terminal or non-terminal), or null if none.
 * The caller decides what to do based on the job's status.
 *
 * NOTE: this returns ALL matching jobs' latest one — we sort by createdAt desc
 * so a failed-then-retried job will return the retry, not the original failure.
 */
export async function getIdempotentResult(
  key: string,
  userId: string
): Promise<IdempotentJob | null> {
  const job = await db.processingJob.findFirst({
    where: { idempotencyKey: key, userId },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return null;
  return {
    id: job.id,
    status: job.status as JobState,
    toolId: job.toolId,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    resultMeta: job.resultMeta ? safeParse(job.resultMeta) : null,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    completedAt: job.completedAt,
  };
}

/**
 * Convenience: classify an existing idempotent job.
 *   - "non_terminal" → caller should return 409
 *   - "completed"    → caller should return cached result (200)
 *   - "terminal_fail"→ caller should create a new job (retry)
 *   - null           → no existing job, create a new one
 */
export function classifyIdempotentJob(job: IdempotentJob | null):
  | { kind: "none" }
  | { kind: "non_terminal"; job: IdempotentJob }
  | { kind: "completed"; job: IdempotentJob }
  | { kind: "terminal_fail"; job: IdempotentJob } {
  if (!job) return { kind: "none" };
  if (job.status === "completed") return { kind: "completed", job };
  if (NON_TERMINAL_STATES.includes(job.status)) return { kind: "non_terminal", job };
  // failed, cancelled, expired → caller may retry
  return { kind: "terminal_fail", job };
}

function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}
