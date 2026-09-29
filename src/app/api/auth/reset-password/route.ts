/**
 * POST /api/auth/reset-password (Prompt2 §30).
 *
 * Body: { token, newPassword }
 *
 *  - Hashes the token (sha256), looks up `password-reset:<hash>` in
 *    SystemSetting. Value is JSON `{ userId, expiresAt }`.
 *  - Validates new password (8+ chars).
 *  - Updates User.passwordHash, deletes the token (one-shot).
 *  - Records an audit log.
 *
 * Errors:
 *  400 — invalid/expired token or weak password.
 *  429 — rate limited (we apply a global limit here too, to bound brute force).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { hashPassword, sha256Hex, getClientIp, assertSameOrigin } from "@/lib/auth-server";
import { rateLimitByIp } from "@/lib/security/rate-limit";

const ResetSchema = z.object({
  token: z.string().min(16).max(256),
  newPassword: z.string().min(8).max(128),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrf = await assertSameOrigin();
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  const ip = await getClientIp();
  // 10 attempts/hour per IP — bounds brute-force without blocking real users
  // who fat-finger the new password a few times.
  const rl = await rateLimitByIp(ip, { windowSec: 3600, limit: 10 });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: "rate_limited" },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } },
    );
  }

  let parsed: z.infer<typeof ResetSchema>;
  try {
    const body = await req.json();
    parsed = ResetSchema.parse(body);
  } catch (e) {
    return NextResponse.json({ ok: false, error: "invalid_body", detail: (e as Error).message }, { status: 400 });
  }

  const hash = sha256Hex(parsed.token);
  const settingKey = `password-reset:${hash}`;

  const row = await db.systemSetting.findUnique({ where: { key: settingKey } });
  if (!row) {
    return NextResponse.json({ ok: false, error: "invalid_or_expired_token" }, { status: 400 });
  }

  let payload: { userId?: string; expiresAt?: string };
  try {
    payload = JSON.parse(row.value);
  } catch {
    await db.systemSetting.delete({ where: { key: settingKey } }).catch(() => {});
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }

  const userId = payload.userId;
  const expiresAt = payload.expiresAt ? new Date(payload.expiresAt) : null;
  if (!userId || !expiresAt) {
    await db.systemSetting.delete({ where: { key: settingKey } }).catch(() => {});
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }
  if (expiresAt.getTime() < Date.now()) {
    await db.systemSetting.delete({ where: { key: settingKey } }).catch(() => {});
    return NextResponse.json({ ok: false, error: "token_expired" }, { status: 400 });
  }

  // Verify the user still exists.
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    await db.systemSetting.delete({ where: { key: settingKey } }).catch(() => {});
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 400 });
  }

  // Update password.
  const passwordHash = await hashPassword(parsed.newPassword);
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, updatedAt: new Date() },
  });

  // Delete the token (one-shot).
  await db.systemSetting.delete({ where: { key: settingKey } }).catch(() => {});

  // Audit log.
  try {
    await db.auditLog.create({
      data: {
        action: "user.password_reset",
        actorId: userId,
        target: userId,
        meta: JSON.stringify({ ip: ip ?? null }),
      },
    });
  } catch {
    /* non-critical */
  }

  return NextResponse.json({ ok: true });
}
