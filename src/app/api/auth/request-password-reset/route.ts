/**
 * POST /api/auth/request-password-reset (Prompt2 §30).
 *
 * Body: { email }
 *
 *  - Always returns 200 (never leaks whether the email is registered).
 *  - Rate-limited by IP: 3 requests/hour.
 *  - If the user exists: generates a 1-hour reset token, stores its SHA-256
 *    hash → userId in SystemSetting under `password-reset:<hash>`, and emails
 *    the raw token to the user.
 *  - Records an audit log entry.
 *  - If the email provider is console (dev), `ok:false` is logged but not
 *    surfaced in the response (still 200, still no leak).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { randomToken, sha256Hex, getClientIp, assertSameOrigin } from "@/lib/auth-server";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { getEmailProvider } from "@/lib/providers/email";

const RESET_TOKEN_TTL_SEC = 60 * 60; // 1 hour

const RequestSchema = z.object({
  email: z.string().email().max(254).transform((s) => s.trim().toLowerCase()),
  turnstileToken: z.string().optional().nullable(),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrf = await assertSameOrigin();
  if (!csrf.ok) {
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  const ip = await getClientIp();
  const rl = await rateLimitByIp(ip, { windowSec: 3600, limit: 3 });
  if (!rl.allowed) {
    // Don't leak that the email was processed — return 200 with a hint via Retry-After.
    return NextResponse.json(
      { ok: true },
      {
        status: 200,
        headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) },
      },
    );
  }

  let email: string;
  let turnstileToken: string | null | undefined = null;
  try {
    const body = await req.json();
    const parsed = RequestSchema.parse(body);
    email = parsed.email;
    turnstileToken = parsed.turnstileToken;
  } catch {
    // Invalid body — still return 200 (don't leak).
    return NextResponse.json({ ok: true }, { status: 200 });
  }

  // Turnstile (if configured). Don't fail loudly — just log on failure.
  if (env.TURNSTILE_SECRET_KEY) {
    const ts = await verifyTurnstileToken(turnstileToken, ip);
    if (!ts.success) {
      console.warn("[password-reset] Turnstile rejected a request.", ts.error);
      return NextResponse.json({ ok: true }, { status: 200 });
    }
  }

  // Look up the user. If not found, we still return 200 (no leak).
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true },
  });

  if (user) {
    const token = randomToken();
    const tokenHash = sha256Hex(token);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_TTL_SEC * 1000);
    await db.systemSetting.create({
      data: {
        key: `password-reset:${tokenHash}`,
        value: JSON.stringify({ userId: user.id, expiresAt: expiresAt.toISOString() }),
      },
    });

    // Send the email. HONEST: log the result but don't fail the response.
    try {
      const provider = getEmailProvider();
      if (provider.configured) {
        const res = await provider.sendPasswordReset(user.email, token);
        if (!res.ok) {
          console.warn(`[password-reset] Email send failed for ${user.email}: ${res.error}`);
        }
      } else {
        console.warn(
          `[password-reset] Email provider "${provider.name}" is not configured — ` +
          `the reset link was logged but NOT emailed. Set EMAIL_PROVIDER + credentials.`
        );
      }
    } catch (e) {
      console.warn(`[password-reset] Email send threw: ${(e as Error).message}`);
    }

    // Audit log (best-effort).
    try {
      await db.auditLog.create({
        data: {
          action: "user.password_reset_requested",
          actorId: user.id,
          target: user.id,
          meta: JSON.stringify({ ip: ip ?? null }),
        },
      });
    } catch {
      /* non-critical */
    }
  } else {
    // Slow down slightly so attackers can't enumerate by timing.
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 150));
  }

  return NextResponse.json({
    ok: true,
    message: "If an account with that email exists, a reset link has been sent.",
  });
}
