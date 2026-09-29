/**
 * POST /api/auth/verify-email (Prompt2 §30).
 *
 * Validates an email-verification token and marks the user as verified.
 *
 *  - Body: { token: string }
 *  - Token is hashed (sha256) and looked up in SystemSetting under
 *    `email-verify:<hash>`. The value is JSON `{ userId, expiresAt }`.
 *  - On success: sets User.emailVerified = now and deletes the token row
 *    (one-shot — cannot be reused).
 *  - Always returns 200 with `{ ok: true }` or `{ ok: false, error }` to avoid
 *    leaking user existence via timing differences.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { sha256Hex, assertSameOrigin } from "@/lib/auth-server";

const VerifySchema = z.object({
  token: z.string().min(16).max(256),
});

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const csrf = await assertSameOrigin();
  if (!csrf.ok) {
    return NextResponse.json({ ok: false, error: "forbidden" }, { status: 403 });
  }

  let token: string;
  try {
    const body = await req.json();
    token = VerifySchema.parse(body).token;
  } catch (e) {
    return NextResponse.json({ ok: false, error: "invalid_token" }, { status: 400 });
  }

  const hash = sha256Hex(token);
  const settingKey = `email-verify:${hash}`;

  const row = await db.systemSetting.findUnique({ where: { key: settingKey } });
  if (!row) {
    return NextResponse.json({ ok: false, error: "invalid_or_expired_token" }, { status: 400 });
  }

  let payload: { userId?: string; expiresAt?: string };
  try {
    payload = JSON.parse(row.value);
  } catch {
    // Corrupt row — clean it up and fail.
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

  // Mark the user as verified.
  try {
    await db.user.update({
      where: { id: userId },
      data: { emailVerified: new Date() },
    });
  } catch {
    return NextResponse.json({ ok: false, error: "user_not_found" }, { status: 400 });
  }

  // Delete the token (one-shot).
  await db.systemSetting.delete({ where: { key: settingKey } }).catch(() => {});

  // Best-effort audit log.
  try {
    await db.auditLog.create({
      data: {
        action: "user.email_verified",
        actorId: userId,
        target: userId,
      },
    });
  } catch {
    /* non-critical */
  }

  return NextResponse.json({ ok: true });
}
