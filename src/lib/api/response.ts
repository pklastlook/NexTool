/**
 * API response helpers (Prompt2 §47, §57, §78).
 *
 * Every /api/v1/* response:
 *   - Includes `X-Request-Id` header (echoed from the inbound request, or
 *     generated if missing — see src/middleware.ts).
 *   - Includes `X-Request-Id` in the JSON body too (so log correlation works
 *     even when clients only read the body).
 *   - Includes `Content-Type: application/json`.
 *
 * Errors use a consistent envelope:
 *   { error: { code: string, message: string }, requestId: string, ... }
 */
import { NextResponse, type NextRequest } from "next/server";
import { newRequestId } from "@/lib/observability/log";

const REQUEST_ID_HEADER = "x-request-id";

/** Extract the request ID from the inbound request, generating one if missing. */
export function getRequestId(req: NextRequest): string {
  const incoming = req.headers.get(REQUEST_ID_HEADER);
  if (incoming && /^[A-Za-z0-9-]{4,32}$/.test(incoming)) return incoming;
  return newRequestId();
}

interface ApiEnvelope {
  [k: string]: unknown;
  requestId: string;
}

/** Build a successful JSON response. */
export function apiResponse<T extends Record<string, unknown>>(
  req: NextRequest,
  status: number,
  body: T,
  extraHeaders?: Record<string, string>
): NextResponse {
  const requestId = getRequestId(req);
  const envelope: ApiEnvelope = { ...body, requestId };
  return NextResponse.json(envelope, {
    status,
    headers: {
      [REQUEST_ID_HEADER]: requestId,
      ...(extraHeaders ?? {}),
    },
  });
}

/** Build an error JSON response with the standard envelope. */
export function apiError(
  req: NextRequest,
  status: number,
  message: string,
  opts: { code?: string; retryAfter?: number; details?: Record<string, unknown> } = {}
): NextResponse {
  const requestId = getRequestId(req);
  const body: ApiEnvelope = {
    error: {
      code: opts.code ?? defaultCodeForStatus(status),
      message,
      ...(opts.details ?? {}),
    },
    requestId,
  };
  const headers: Record<string, string> = { [REQUEST_ID_HEADER]: requestId };
  if (typeof opts.retryAfter === "number") {
    headers["Retry-After"] = String(Math.max(1, Math.ceil(opts.retryAfter)));
  }
  return NextResponse.json(body, { status, headers });
}

/** Build a 429 Too Many Requests response with Retry-After header. */
export function rateLimitedResponse(
  req: NextRequest,
  retryAfterSec: number,
  limit: number
): NextResponse {
  return apiError(req, 429, "Rate limit exceeded.", {
    code: "rate_limited",
    retryAfter: retryAfterSec,
    details: { limit, retryAfter: retryAfterSec },
  });
}

function defaultCodeForStatus(status: number): string {
  switch (status) {
    case 400: return "bad_request";
    case 401: return "unauthorized";
    case 403: return "forbidden";
    case 404: return "not_found";
    case 405: return "method_not_allowed";
    case 409: return "conflict";
    case 413: return "payload_too_large";
    case 415: return "unsupported_media_type";
    case 422: return "unprocessable";
    case 429: return "rate_limited";
    case 500: return "internal_error";
    case 503: return "unavailable";
    default: return "error";
  }
}
