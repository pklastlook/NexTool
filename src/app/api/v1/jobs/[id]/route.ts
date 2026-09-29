/**
 * Public API v1 — job status / result polling.
 *
 * GET /api/v1/jobs/{id}
 *
 * Returns the job's status, metadata, error (if any), and a signed download
 * URL when the job is completed.
 *
 * Authentication: API key required. The key's owning user must match the
 * job's owning user (we never expose another user's job).
 *
 * Response codes:
 *   200 — job found (any state)
 *   401 — missing/invalid API key
 *   403 — job exists but belongs to another user
 *   404 — job not found
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getStorageProvider } from "@/lib/providers/storage";
import { recordApiRequest } from "@/lib/analytics";
import { authenticateApiKey } from "@/lib/api/auth";
import { apiError, apiResponse } from "@/lib/api/response";

export const runtime = "nodejs";
export const maxDuration = 30;

const SIGNED_URL_TTL_SEC = 900;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const startedAt = Date.now();
  const { id } = await params;
  const endpoint = `/api/v1/jobs/${id}`;
  const method = "GET";

  // ----- Auth -----
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return finish(req, 401, "Missing, invalid, or revoked API key.", startedAt, endpoint, method, null);
  }
  const { apiKey, user } = auth;

  // ----- Load job -----
  const job = await db.processingJob.findUnique({
    where: { id },
    include: { tool: true, inputs: true, outputs: true },
  });
  if (!job) {
    return finish(req, 404, `Job ${id} not found.`, startedAt, endpoint, method, apiKey.id);
  }
  // Ownership check (jobs with no userId can't be queried via the API)
  if (job.userId !== user.id) {
    return finish(req, 403, "Job belongs to another user.", startedAt, endpoint, method, apiKey.id);
  }

  // ----- Build output URL (if completed) -----
  let output: { filename: string; size: number; mime: string; downloadUrl: string } | null = null;
  if (job.status === "completed") {
    const outAsset = job.outputs.find((a) => a.role === "output" && a.status === "active");
    if (outAsset) {
      const storage = getStorageProvider();
      const downloadUrl = await storage.createDownloadUrl(
        outAsset.storageKey,
        outAsset.originalName,
        {
          expiresIn: SIGNED_URL_TTL_SEC,
          responseContentDisposition: `attachment; filename="${outAsset.safeName}"`,
        },
      ).catch(() => null);
      if (downloadUrl) {
        output = {
          filename: outAsset.originalName,
          size: outAsset.size,
          mime: outAsset.detectedMimeType ?? outAsset.mimeType,
          downloadUrl,
        };
      }
    }
  }

  const body = {
    ok: true,
    job: {
      id: job.id,
      status: job.status,
      tool: {
        id: job.tool.id,
        slug: job.tool.slug,
        name: job.tool.name,
      },
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      priority: job.priority,
      errorCode: job.errorCode,
      errorMessage: job.errorMessage,
      meta: job.resultMeta ? safeParse(job.resultMeta) : null,
      inputs: job.inputs
        .filter((a) => a.role === "input")
        .map((a) => ({
          filename: a.originalName,
          size: a.size,
          mime: a.detectedMimeType ?? a.mimeType,
        })),
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
    },
    output,
    pollUrl: isTerminal(job.status) ? null : `/api/v1/jobs/${job.id}`,
  };
  return finish(req, 200, body, startedAt, endpoint, method, apiKey.id);
}

function isTerminal(status: string): boolean {
  return ["completed", "failed", "cancelled", "expired"].includes(status);
}

function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}

async function finish(
  req: NextRequest,
  status: number,
  bodyOrMessage: Record<string, unknown> | string,
  startedAt: number,
  endpoint: string,
  method: string,
  apiKeyId: string | null,
): Promise<Response> {
  const durationMs = Date.now() - startedAt;
  if (apiKeyId) {
    recordApiRequest(apiKeyId, endpoint, method, status, durationMs).catch(() => {});
  }
  if (typeof bodyOrMessage === "string") {
    return apiError(req, status, bodyOrMessage);
  }
  return apiResponse(req, status, bodyOrMessage);
}
