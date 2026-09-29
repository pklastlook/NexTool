/**
 * POST /api/auth/register (Prompt2 §30).
 *
 * Creates a new user with email + password. Sends a verification email.
 *
 *  - Validates body with zod (email + 8+ char password + optional name).
 *  - Rate-limited by IP: 5 signups/hour (per the task spec).
 *  - Verifies the Turnstile token if TURNSTILE_SECRET_KEY is set (honest skip
 *    otherwise — see src/lib/security/turnstile.ts).
 *  - Hashes password with bcrypt (12 rounds).
 *  - Stores email-verification token hash → userId mapping in SystemSetting
 *    (1 hour expiry). The raw token is sent to the user via email.
 *  - Records the `signup` analytics event.
 *  - Returns 201 with the public user shape (no passwordHash).
 *
 * Errors:
 *  400 — invalid body / weak password.
 *  409 — email already registered.
 *  429 — rate limited.
 *  503 — email provider not configured and we need to send the verification
 *        email (we still create the user but report the email send failure
 *        honestly so the operator can fix the provider config).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { hashPassword, randomToken, sha256Hex, getClientIp, assertSameOrigin } from "@/lib/auth-server";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { getEmailProvider } from "@/lib/providers/email";
import { recordSignup } from "@/lib/analytics";

const VERIFY_TOKEN_TTL_SEC = 60 * 60; // 1 hour

const RegisterSchema = z.object({
  email: z.string().email().max(254).transform((s) => s.trim().toLowerCase()),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(80).optional(),
  turnstileToken: z.string().optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  // CSRF: same-origin check.
  const csrf = await assertSameOrigin();
  if (!csrf.ok) {
    return NextResponse.json({ error: "forbidden", reason: csrf.reason }, { status: 403 });
  }

  // Rate limit (per-IP): 5 signups/hour.
  const ip = await getClientIp();
  const rl = await rateLimitByIp(ip, { windowSec: 3600, limit: 5 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfter: Math.ceil((rl.resetAt - Date.now()) / 1000) },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  // Parse + validate body.
  let parsed: z.infer<typeof RegisterSchema>;
  try {
    const body = await req.json();
    parsed = RegisterSchema.parse(body);
  } catch (e) {
    return NextResponse.json(
      { error: "invalid_body", detail: (e as Error).message },
      { status: 400 },
    );
  }

  // Verify Turnstile token (honest skip when not configured).
  if (env.TURNSTILE_SECRET_KEY) {
    const ts = await verifyTurnstileToken(parsed.turnstileToken, ip);
    if (!ts.success) {
      return NextResponse.json(
        { error: "captcha_failed", detail: ts.error ?? "turnstile rejected" },
        { status: 400 },
      );
    }
  }

  // Email uniqueness check (race-safe: the unique constraint will catch any TOCTOU).
  const existing = await db.user.findUnique({
    where: { email: parsed.email },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "email_taken", message: "An account with this email already exists." },
      { status: 409 },
    );
  }

  // Hash password.
  const passwordHash = await hashPassword(parsed.password);

  // Create the user.
  const user = await db.user.create({
    data: {
      email: parsed.email,
      name: parsed.name ?? null,
      passwordHash,
      role: "user",
    },
    select: { id: true, email: true, name: true, role: true, createdAt: true },
  });

  // Generate verification token. Store the SHA-256 hash → userId mapping in
  // SystemSetting. The raw token is sent via email; we never store it.
  const token = randomToken();
  const tokenHash = sha256Hex(token);
  const expiresAt = new Date(Date.now() + VERIFY_TOKEN_TTL_SEC * 1000);
  await db.systemSetting.create({
    data: {
      key: `email-verify:${tokenHash}`,
      value: JSON.stringify({ userId: user.id, expiresAt: expiresAt.toISOString() }),
    },
  });

  // Send verification email. HONEST: if the provider is console (dev mode),
  // `sendVerification` returns ok:false — we don't fail the signup over this,
  // but we DO surface the status to the client so the operator notices.
  let emailSent = true;
  let emailError: string | undefined;
  try {
    const provider = getEmailProvider();
    if (!provider.configured) {
      emailSent = false;
      emailError = `${provider.name} email provider is not configured`;
    } else {
      const res = await provider.sendVerification(user.email, token);
      if (!res.ok) {
        emailSent = false;
        emailError = res.error ?? "send failed";
      }
    }
  } catch (e) {
    emailSent = false;
    emailError = (e as Error).message;
  }

  // Record analytics (best-effort).
  await recordSignup(user.id);

  // Audit log.
  try {
    await db.auditLog.create({
      data: {
        action: "user.register",
        actorId: user.id,
        target: user.id,
        meta: JSON.stringify({ email: user.email, emailSent, emailError }),
      },
    });
  } catch {
    /* non-critical */
  }

  return NextResponse.json(
    {
      user: { id: user.id, email: user.email, name: user.name, role: user.role, createdAt: user.createdAt },
      emailSent,
      emailError: emailSent ? undefined : emailError,
      message: emailSent
        ? "Account created. Check your email for a verification link."
        : "Account created, but we could not send the verification email. Please request a new one from the dashboard.",
    },
    { status: 201 },
  );
}
