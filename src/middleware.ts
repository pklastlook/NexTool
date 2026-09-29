/**
 * Request correlation middleware (Prompt2 §41).
 *
 * Injects a request ID into every request, available to API routes via
 * the `x-request-id` header (set both inbound and outbound).
 */
import { NextResponse, type NextRequest } from "next/server";
import { newRequestId } from "@/lib/observability/log";

export function middleware(req: NextRequest) {
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
