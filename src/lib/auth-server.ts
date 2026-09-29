/**
 * Server-side auth helpers (Prompt2 §30).
 *
 * NOW FULLY WIRED (P2-5): `getCurrentUser()` calls `getServerSession(authOptions)`
 * against the real NextAuth credentials provider. The previous stub (P2-7) only
 * JWT-decoded without verifying — it was a placeholder awaiting this file. The
 * public `CurrentUser` shape is preserved so existing callers (the
 * `/api/v1/keys/*` endpoints from P2-7) keep working unchanged.
 *
 * Exports:
 *  - hashPassword(p)        bcrypt with 12 rounds (OWASP-recommended 2024+).
 *  - verifyPassword(p, h)    constant-time bcrypt compare.
 *  - getCurrentUser()        wraps getServerSession — returns CurrentUser or null.
 *  - requireUser()           throws AuthRequiredError if no session.
 *  - requireAdmin()          throws AdminRequiredError if not admin.
 *  - assertSameOrigin()      CSRF guard for custom POST route handlers.
 *  - getClientIp()           pulls client IP from Cloudflare / X-Forwarded-For.
 *  - randomToken()           32-byte cryptographic random hex.
 *  - sha256Hex(s)             sha-256 hex digest (used to key tokens in DB).
 */
import bcrypt from "bcryptjs";
import { getServerSession } from "next-auth";
import { headers } from "next/headers";
import type { NextRequest } from "next/server";
import { authOptions } from "@/lib/auth";

const BCRYPT_ROUNDS = 12;

/** Public shape used by existing callers (P2-7's /api/v1/keys/*). */
export interface CurrentUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
}

export async function hashPassword(plain: string): Promise<string> {
  if (!plain || plain.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    // Malformed hash — treat as a failed verification. Don't leak the parse error.
    return false;
  }
}

/**
 * Resolve the currently-authenticated user via NextAuth's real session.
 * Returns null when not signed in. Never throws.
 *
 * NOTE: the optional `req` arg is accepted for backward compatibility with
 * P2-7's `/api/v1/keys/*` callers that pass the NextRequest through. It is
 * NOT used — NextAuth reads its session from cookies via `getServerSession`,
 * which has its own request access through `next/headers`.
 */
export async function getCurrentUser(_req?: NextRequest): Promise<CurrentUser | null> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) return null;
    const u = session.user as { id?: string; email?: string | null; name?: string | null; role?: string };
    if (!u.id || !u.email) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.name ?? null,
      role: u.role ?? "user",
    };
  } catch {
    return null;
  }
}

/** Tagged error so callers can branch on `instanceof AuthRequiredError`. */
export class AuthRequiredError extends Error {
  readonly code = "AUTH_REQUIRED";
  constructor(message = "Sign in required.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class AdminRequiredError extends Error {
  readonly code = "ADMIN_REQUIRED";
  constructor(message = "Admin access required.") {
    super(message);
    this.name = "AdminRequiredError";
  }
}

export async function requireUser(req?: NextRequest): Promise<CurrentUser> {
  const user = await getCurrentUser(req);
  if (!user) throw new AuthRequiredError();
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== "admin") throw new AdminRequiredError();
  return user;
}

/**
 * CSRF guard for custom Route Handler POSTs (Prompt2 §30).
 *
 * NextAuth's own routes (/api/auth/*) have built-in CSRF protection; this is
 * ONLY for our custom endpoints like /api/auth/register, /verify-email, etc.
 *
 * Allows the request if Origin or Referer matches the request Host. Rejects
 * otherwise. Returns `{ok:false, reason}` so the caller can return 403.
 */
export async function assertSameOrigin(): Promise<{ ok: boolean; reason?: string }> {
  const h = await headers();
  const host = h.get("host");
  const origin = h.get("origin");
  const referer = h.get("referer");
  if (!host) return { ok: false, reason: "missing host" };

  const allowed = new Set<string>([host, `https://${host}`, `http://${host}`]);

  if (origin && allowed.has(origin)) return { ok: true };
  if (referer) {
    try {
      const url = new URL(referer);
      if (allowed.has(url.host) || allowed.has(`${url.protocol}//${url.host}`)) {
        return { ok: true };
      }
    } catch {
      /* ignore malformed referer */
    }
  }

  return { ok: false, reason: "origin mismatch" };
}

/**
 * Extract the client IP from request headers. Order of preference:
 *  Cloudflare > standard X-Forwarded-For (first hop) > X-Real-IP > null.
 */
export async function getClientIp(): Promise<string | null> {
  const h = await headers();
  const cf = h.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = h.get("x-real-ip");
  if (real) return real.trim();
  return null;
}

/**
 * Generate a URL-safe random token (32 bytes hex = 64 chars).
 * Used for email-verification and password-reset tokens.
 */
export function randomToken(): string {
  // node:crypto is available in Node 18+/Bun/Edge runtimes.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { randomBytes } = require("node:crypto") as typeof import("node:crypto");
  return randomBytes(32).toString("hex");
}

/** SHA-256 hex digest. Used to key tokens in SystemSetting (never store raw tokens). */
export function sha256Hex(s: string): string {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHash } = require("node:crypto") as typeof import("node:crypto");
  return createHash("sha256").update(s, "utf8").digest("hex");
}
