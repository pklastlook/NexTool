/**
 * First-party analytics event recorder (Prompt2 §38).
 * Best-effort — never blocks the main request flow.
 */
import { db } from "@/lib/db";

export async function recordEvent(name: string, userId?: string, meta?: Record<string, unknown>): Promise<void> {
  try {
    await db.analyticsEvent.create({
      data: {
        eventName: name,
        userId: userId ?? null,
        meta: meta ? JSON.stringify(meta) : null,
      },
    });
  } catch { /* non-critical */ }
}

export async function recordToolView(slug: string, userId?: string): Promise<void> {
  await recordEvent("tool_view", userId, { slug });
}

export async function recordToolStart(slug: string, userId?: string): Promise<void> {
  await recordEvent("tool_start", userId, { slug });
}

export async function recordJobCreated(jobId: string, slug: string, userId?: string): Promise<void> {
  await recordEvent("job_created", userId, { jobId, slug });
}

export async function recordJobCompleted(jobId: string, slug: string, userId?: string): Promise<void> {
  await recordEvent("job_completed", userId, { jobId, slug });
}

export async function recordJobFailed(jobId: string, slug: string, errorCode: string, userId?: string): Promise<void> {
  await recordEvent("job_failed", userId, { jobId, slug, errorCode });
}

export async function recordDownload(key: string): Promise<void> {
  await recordEvent("download", undefined, { key });
}

export async function recordSignup(userId: string): Promise<void> {
  await recordEvent("signup", userId);
}

export async function recordLogin(userId: string): Promise<void> {
  await recordEvent("login", userId);
}

export async function recordApiRequest(apiKeyId: string, endpoint: string, method: string, status: number, durationMs: number): Promise<void> {
  try {
    await db.apiUsage.create({
      data: { apiKeyId, endpoint, method, status, durationMs },
    });
  } catch { /* non-critical */ }
  await recordEvent("api_request", undefined, { apiKeyId, endpoint, method, status, durationMs });
}
