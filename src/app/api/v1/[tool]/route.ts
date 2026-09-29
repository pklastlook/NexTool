/**
 * Public API v1 — main tool-processing endpoint (Prompt2 §46, §47, §56, §57).
 *
 * POST /api/v1/{toolSlug}
 *
 * Flow:
 *   1. Authenticate via `Authorization: Bearer nt_live_xxx` (or `?api_key=`).
 *   2. Rate-limit by apiKeyId, using the user's plan's `apiPerMinute`.
 *   3. Validate the tool slug + that it's a server-side tool.
 *   4. Honor `Idempotency-Key`: non-terminal existing → 409; completed →
 *      cached 200; failed → retry (createJob).
 *   5. Read the input file (multipart `file`/`file0`/`file1`/... or, for
 *      document generators, JSON `{ data, format }`).
 *   6. Upload the input to `quarantine/` via the storage provider.
 *   7. Create a FileAsset row (scanStatus="pending").
 *   8. `createJob({ toolId, userId, options, idempotencyKey })`.
 *   9. Poll the DB up to WAIT_TIMEOUT_MS (60s by default).
 *  10. Completed → 200 + signed download URL.
 *      Failed   → 422 + error envelope.
 *      Timeout  → 202 + polling URL `/api/v1/jobs/{id}`.
 *  11. Record analytics (apiKeyId, endpoint, method, status, durationMs).
 *
 * Every response includes `X-Request-Id` (see src/middleware.ts).
 */
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { getTool } from "@/lib/tool-registry";
import { detectFileType, validateFile, formatBytes } from "@/lib/tool-engine";
import { getStorageProvider } from "@/lib/providers/storage";
import { createJob, queueForTool, type QueueName } from "@/lib/queue";
import { recordApiRequest } from "@/lib/analytics";
import { log } from "@/lib/observability";
import { limitsForPlan, rateLimitByApiKey } from "@/lib/security/rate-limit";
import { authenticateApiKey } from "@/lib/api/auth";
import {
  classifyIdempotentJob,
  getIdempotentResult,
  validateIdempotencyKey,
} from "@/lib/api/idempotency";
import { apiError, apiResponse } from "@/lib/api/response";

export const runtime = "nodejs";
export const maxDuration = 300;

/** How long the request handler waits for a job to finish before returning 202. */
const WAIT_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1_000;
const SIGNED_URL_TTL_SEC = 900; // 15 min

// Document generators accept JSON instead of a file upload.
const DOC_GENERATORS = new Set([
  "invoice-generator",
  "quotation-generator",
  "receipt-generator",
]);

interface JobSummary {
  id: string;
  status: string;
  toolId: string;
  errorCode: string | null;
  errorMessage: string | null;
  resultMeta: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ tool: string }> }
): Promise<Response> {
  const startedAt = Date.now();
  const { tool: slug } = await params;
  const endpoint = `/api/v1/${slug}`;
  const method = "POST";

  // ----- 1. Authenticate -----
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return finish(req, 401, "Missing, invalid, or revoked API key.", startedAt, endpoint, method, null);
  }
  const { apiKey, user } = auth;

  // ----- 2. Resolve plan + rate-limit -----
  const planSlug = await getPlanSlug(user.id);
  const limits = limitsForPlan(planSlug);
  const rl = await rateLimitByApiKey(apiKey.id, {
    windowSec: 60,
    limit: limits.apiPerMinute,
  });
  if (!rl.allowed) {
    const retryAfter = Math.max(1, Math.ceil((rl.resetAt - Date.now()) / 1000));
    recordApiRequest(apiKey.id, endpoint, method, 429, Date.now() - startedAt).catch(() => {});
    return apiError(req, 429, "API rate limit exceeded.", {
      code: "rate_limited",
      retryAfter,
      details: { limit: limits.apiPerMinute, remaining: 0, resetAt: rl.resetAt },
    });
  }

  // ----- 3. Validate tool -----
  const toolDef = getTool(slug);
  if (!toolDef) {
    return finish(req, 404, `Unknown tool: ${slug}.`, startedAt, endpoint, method, apiKey.id);
  }
  if (toolDef.processingType !== "server") {
    return finish(
      req,
      400,
      `Tool "${slug}" runs client-side and is not exposed via the API.`,
      startedAt,
      endpoint,
      method,
      apiKey.id,
    );
  }

  // ----- 4. Idempotency -----
  const idempotencyRaw = req.headers.get("idempotency-key");
  const idempotencyKey = validateIdempotencyKey(idempotencyRaw);
  if (idempotencyRaw && !idempotencyKey) {
    return finish(
      req,
      400,
      "Invalid Idempotency-Key header (must be 1–256 chars, no newlines).",
      startedAt,
      endpoint,
      method,
      apiKey.id,
    );
  }
  if (idempotencyKey) {
    const existing = await getIdempotentResult(idempotencyKey, user.id);
    const classification = classifyIdempotentJob(existing);
    if (classification.kind === "non_terminal") {
      // Same key, job in flight → 409 + polling URL
      const body = {
        ok: false,
        status: "in_progress",
        job: serializeJobSummary(toSummary(classification.job)),
        pollUrl: `/api/v1/jobs/${classification.job.id}`,
        message: "A job with this Idempotency-Key is already in progress.",
      };
      return finish(req, 409, body, startedAt, endpoint, method, apiKey.id);
    }
    if (classification.kind === "completed") {
      // Cached result — return the prior output again (200)
      const cached = await fetchCachedOutput(classification.job.id);
      if (cached) {
        const body = {
          ok: true,
          status: "completed",
          job: serializeJobSummary(toSummary(classification.job)),
          result: cached,
          cached: true,
        };
        return finish(req, 200, body, startedAt, endpoint, method, apiKey.id);
      }
      // Fall through if cached output is missing (shouldn't happen)
    }
    // terminal_fail → fall through and create a new job
  }

  // ----- 5. Read input -----
  let inputFiles: { buf: Buffer; name: string; mime: string }[] = [];
  let options: Record<string, unknown> = {};

  try {
    const parsed = await parseRequestBody(req, slug);
    inputFiles = parsed.files;
    options = parsed.options;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return finish(req, 400, msg, startedAt, endpoint, method, apiKey.id);
  }

  if (inputFiles.length === 0 && !DOC_GENERATORS.has(slug)) {
    return finish(
      req,
      400,
      "No file uploaded. Send multipart/form-data with a 'file' field.",
      startedAt,
      endpoint,
      method,
      apiKey.id,
    );
  }

  // ----- 6. Validate file(s) against tool's allowlist -----
  const maxFileSize = toolDef.maxFileSize ?? 10485760;
  for (const f of inputFiles) {
    if (f.buf.length > maxFileSize) {
      return finish(
        req,
        413,
        `File "${f.name}" exceeds the ${formatBytes(maxFileSize)} limit.`,
        startedAt,
        endpoint,
        method,
        apiKey.id,
      );
    }
    if (toolDef.inputFormats && toolDef.inputFormats.length > 0) {
      const err = validateFile(f.buf, f.name, f.mime, toolDef.inputFormats, maxFileSize);
      if (err) {
        return finish(req, 422, err, startedAt, endpoint, method, apiKey.id);
      }
    }
  }

  // ----- 7. Upload inputs to quarantine + create FileAsset rows -----
  const storage = getStorageProvider();
  const createdAssetIds: string[] = [];
  try {
    for (const f of inputFiles) {
      const stored = await storage.upload(f.buf, f.name, {
        contentType: f.mime,
        prefix: "quarantine",
        metadata: { userId: user.id, tool: slug },
      });
      const detected = detectFileType(f.buf);
      const asset = await db.fileAsset.create({
        data: {
          userId: user.id,
          originalName: f.name,
          safeName: f.name.replace(/[^\w.-]/g, "_"),
          mimeType: f.mime,
          detectedMimeType: detected?.mime ?? null,
          extension: f.name.split(".").pop() ?? "",
          size: f.buf.length,
          checksum: stored.checksum,
          storageKey: stored.key,
          storagePath: stored.key,
          role: "input",
          scanStatus: "pending",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: "active",
        },
      });
      createdAssetIds.push(asset.id);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await log.error("api.upload_failed", { userId: user.id, slug, error: msg });
    return finish(req, 500, "Failed to store input file.", startedAt, endpoint, method, apiKey.id);
  }

  // ----- 8. Create job -----
  let job;
  try {
    job = await createJob({
      toolId: slug,
      userId: user.id,
      options,
      idempotencyKey: idempotencyKey ?? undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return finish(req, 500, `Failed to create job: ${msg}`, startedAt, endpoint, method, apiKey.id);
  }

  // Link the FileAsset rows to the job (worker.ts reads FileAsset.inputJobId).
  if (createdAssetIds.length > 0) {
    await db.fileAsset.updateMany({
      where: { id: { in: createdAssetIds } },
      data: { inputJobId: job.id },
    });
  }

  await log.info("api.job_created", {
    userId: user.id,
    apiKeyId: apiKey.id,
    jobId: job.id,
    slug,
    queue: queueForTool(slug) as QueueName,
    idempotencyKey: idempotencyKey ?? null,
  });

  // ----- 9. Poll for completion -----
  const deadline = Date.now() + WAIT_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const fresh = await db.processingJob.findUnique({ where: { id: job.id } });
    if (!fresh) break;
    if (fresh.status === "completed") {
      const result = await fetchCachedOutput(fresh.id);
      const body = {
        ok: true,
        status: "completed",
        job: serializeJobSummary(toSummaryFromRow(fresh)),
        result,
      };
      return finish(req, 200, body, startedAt, endpoint, method, apiKey.id);
    }
    if (fresh.status === "failed" || fresh.status === "cancelled" || fresh.status === "expired") {
      const body = {
        ok: false,
        status: fresh.status,
        job: serializeJobSummary(toSummaryFromRow(fresh)),
        error: {
          code: fresh.status === "failed" ? "job_failed" : `job_${fresh.status}`,
          message: fresh.errorMessage ?? `Job ${fresh.status}.`,
        },
      };
      return finish(req, 422, body, startedAt, endpoint, method, apiKey.id);
    }
    await sleep(POLL_INTERVAL_MS);
  }

  // ----- 10. Timeout → 202 + poll URL -----
  const pollUrl = `/api/v1/jobs/${job.id}`;
  const body = {
    ok: true,
    status: "processing",
    job: { id: job.id, status: "processing", tool: slug },
    pollUrl,
    message: `Job is still processing. Poll ${pollUrl} in a few seconds.`,
  };
  return finish(req, 202, body, startedAt, endpoint, method, apiKey.id);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function safeParse(s: string): Record<string, unknown> {
  try { return JSON.parse(s) as Record<string, unknown>; } catch { return {}; }
}

/** Resolve the user's active plan slug (defaults to "free"). */
async function getPlanSlug(userId: string): Promise<string> {
  try {
    const sub = await db.subscription.findFirst({
      where: { userId, status: "active" },
      include: { plan: true },
      orderBy: { createdAt: "desc" },
    });
    return sub?.plan?.slug ?? "free";
  } catch {
    return "free";
  }
}

/** Parse the request body into { files, options }. */
async function parseRequestBody(
  req: NextRequest,
  slug: string
): Promise<{ files: { buf: Buffer; name: string; mime: string }[]; options: Record<string, unknown> }> {
  const contentType = req.headers.get("content-type") ?? "";
  const files: { buf: Buffer; name: string; mime: string }[] = [];
  let options: Record<string, unknown> = {};

  if (contentType.includes("multipart/form-data")) {
    const form = await req.formData();
    const keys = Array.from(form.keys());
    const fileKeys = keys.filter((k) => k === "file" || /^file\d+$/.test(k));
    for (const k of fileKeys) {
      const v = form.get(k);
      if (v && v instanceof File) {
        files.push({
          buf: Buffer.from(await v.arrayBuffer()),
          name: v.name || `upload-${Date.now()}`,
          mime: v.type || "application/octet-stream",
        });
      }
    }
    for (const k of keys) {
      if (k === "file" || /^file\d+$/.test(k)) continue;
      const v = form.get(k);
      if (v === null) continue;
      if (typeof v === "string") {
        if (k === "options") {
          try { options = { ...options, ...JSON.parse(v) }; continue; } catch { /* fallthrough */ }
        }
        options[k] = v;
      }
    }
    return { files, options };
  }

  if (contentType.includes("application/json")) {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") {
      throw new Error("Invalid JSON body.");
    }
    if (DOC_GENERATORS.has(slug)) {
      options = body as Record<string, unknown>;
      return { files, options };
    }
    const f = (body as Record<string, unknown>).file as
      | { name: string; base64: string; mime?: string }
      | undefined;
    if (f && typeof f.base64 === "string" && typeof f.name === "string") {
      const buf = Buffer.from(f.base64, "base64");
      files.push({ buf, name: f.name, mime: f.mime ?? "application/octet-stream" });
    }
    const opts = (body as Record<string, unknown>).options;
    if (opts && typeof opts === "object") {
      options = opts as Record<string, unknown>;
    } else {
      const { file: _file, ...rest } = body as Record<string, unknown>;
      options = rest;
    }
    return { files, options };
  }

  throw new Error("Unsupported Content-Type. Use multipart/form-data or application/json.");
}

/** Build a signed download URL for the job's output FileAsset (if any). */
async function fetchCachedOutput(jobId: string): Promise<{
  output: { filename: string; size: number; mime: string; downloadUrl: string } | null;
  meta: Record<string, unknown> | null;
} | null> {
  const job = await db.processingJob.findUnique({ where: { id: jobId } });
  if (!job) return null;
  const outputAsset = await db.fileAsset.findFirst({
    where: { outputJobId: jobId, role: "output", status: "active" },
    orderBy: { createdAt: "asc" },
  });
  let downloadUrl: string | null = null;
  if (outputAsset) {
    const storage = getStorageProvider();
    downloadUrl = await storage.createDownloadUrl(
      outputAsset.storageKey,
      outputAsset.originalName,
      {
        expiresIn: SIGNED_URL_TTL_SEC,
        responseContentDisposition: `attachment; filename="${outputAsset.safeName}"`,
      },
    ).catch(() => null);
  }
  return {
    output: outputAsset && downloadUrl
      ? {
          filename: outputAsset.originalName,
          size: outputAsset.size,
          mime: outputAsset.detectedMimeType ?? outputAsset.mimeType,
          downloadUrl,
        }
      : null,
    meta: job.resultMeta ? safeParse(job.resultMeta) : null,
  };
}

function toSummary(j: {
  id: string;
  status: string;
  toolId: string;
  errorCode: string | null;
  errorMessage: string | null;
  resultMeta: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): JobSummary {
  return { ...j };
}

function toSummaryFromRow(row: {
  id: string;
  status: string;
  toolId: string;
  errorCode: string | null;
  errorMessage: string | null;
  resultMeta: string | null;
  createdAt: Date;
  updatedAt: Date;
  completedAt: Date | null;
}): JobSummary {
  return {
    id: row.id,
    status: row.status,
    toolId: row.toolId,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    resultMeta: row.resultMeta ? safeParse(row.resultMeta) : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

function serializeJobSummary(job: JobSummary): Record<string, unknown> {
  return {
    id: job.id,
    status: job.status,
    toolId: job.toolId,
    errorCode: job.errorCode,
    errorMessage: job.errorMessage,
    meta: job.resultMeta,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    completedAt: job.completedAt?.toISOString() ?? null,
  };
}

/**
 * Final response wrapper. Records analytics (best-effort) and returns the
 * appropriate response envelope.
 *
 * - When `bodyOrMessage` is a string, builds an `apiError` envelope.
 * - When `bodyOrMessage` is an object, builds an `apiResponse` envelope.
 */
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
