/**
 * Request correlation proxy (Prompt2 §41).
 *
 * Next.js 16 renamed `middleware.ts` to `proxy.ts`. This runs in the Edge
 * Runtime, so it must NOT import any module that uses Node-only APIs
 * (process.stdout, fs, crypto.subtle from node:crypto, etc.).
 *
 * It injects a request ID into every request via the `x-request-id` header.
 */
import { NextResponse, type NextRequest } from "next/server";

/** Edge-safe request ID generator (no Node deps). */
function newRequestId(): string {
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `REQ-${rand}`;
}

export function proxy(req: NextRequest) {
  // Honor incoming request ID if provided (e.g. from an API client)
  const incoming = req.headers.get("x-request-id");
  const requestId = incoming && /^[A-Z0-9-]{4,32}$/i.test(incoming)
    ? incoming
    : newRequestId();

  const res = NextResponse.next();
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  // Run on all routes except static assets
  matcher: ["/((?!_next/static|_next/image|favicon.ico|logo.svg).*)"],
};
