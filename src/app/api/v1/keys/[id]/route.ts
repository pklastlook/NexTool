/**
 * Public API v1 — single key management.
 *
 * GET    /api/v1/keys/{id}  — get a single key (no secret, just the prefix)
 * DELETE /api/v1/keys/{id}  — revoke (soft-delete; idempotent)
 *
 * Session-auth required (same as /api/v1/keys). The user can only fetch/revoke
 * their own keys — userId scoping is enforced in the lib functions.
 */
import { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth-server";
import { getApiKey, revokeApiKey } from "@/lib/api-keys";
import { apiError, apiResponse } from "@/lib/api/response";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError(req, 401, "Authentication required.");
  }
  const apiKey = await getApiKey(id, user.id);
  if (!apiKey) {
    return apiError(req, 404, "API key not found.");
  }
  return apiResponse(req, 200, { ok: true, key: apiKey });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const { id } = await params;
  const user = await getCurrentUser(req);
  if (!user) {
    return apiError(req, 401, "Authentication required.");
  }
  const revoked = await revokeApiKey(id, user.id);
  if (!revoked) {
    return apiError(req, 404, "API key not found.");
  }
  return apiResponse(req, 200, {
    ok: true,
    key: revoked,
    message: revoked.revokedAt ? "API key revoked." : "API key was already revoked.",
  });
}
