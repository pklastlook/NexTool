/**
 * Public API v1 — API key management.
 *
 * GET  /api/v1/keys       — list the current user's API keys (secrets redacted)
 * POST /api/v1/keys       — create a new API key (returns the full secret ONCE)
 *
 * These endpoints use SESSION auth (the user must be logged in to the web UI
 * to manage their keys — you can't authenticate via an API key to create an
 * API key, that'd be chicken-and-egg).
 *
 * The full key is returned ONLY in the POST response body. It is never logged
 * and never retrievable again. If lost, the user must revoke + recreate.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-server";
import { createApiKey, listApiKeys } from "@/lib/api-keys";
import { apiError, apiResponse } from "@/lib/api/response";

export const runtime = "nodejs";
export const maxDuration = 30;

const CreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required.").max(80, "Name must be ≤ 80 chars."),
});

export async function GET(req: NextRequest): Promise<Response> {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError(req, 401, "Authentication required. Sign in to the web UI to manage API keys.");
  }
  const keys = await listApiKeys(user.id);
  return apiResponse(req, 200, {
    ok: true,
    keys,
    count: keys.length,
  });
}

export async function POST(req: NextRequest): Promise<Response> {
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError(req, 401, "Authentication required. Sign in to the web UI to manage API keys.");
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return apiError(req, 400, "Invalid JSON body.");
  }
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(req, 400, parsed.error.issues[0]?.message ?? "Invalid request body.");
  }

  try {
    const { fullKey, apiKey } = await createApiKey(user.id, parsed.data.name);
    // The full key is returned ONCE. The frontend MUST persist it locally
    // because it cannot be retrieved again.
    return apiResponse(req, 201, {
      ok: true,
      key: apiKey,
      /** Secret — store securely. Will NOT be shown again. */
      secret: fullKey,
      warning: "Store this secret now. It cannot be retrieved again.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return apiError(req, 500, `Failed to create API key: ${msg}`);
  }
}
