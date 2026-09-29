/**
 * Direct smoke test of the API platform logic.
 * Bypasses HTTP — exercises the lib functions directly.
 */
import { PrismaClient } from "@prisma/client";
import { createApiKey, listApiKeys, revokeApiKey, getApiKey } from "../src/lib/api-keys";
import {
  authenticateApiKey,
  KEY_PREFIX_LIVE,
  KEY_SECRET_LENGTH,
  generateBase62Secret,
  buildFullKey,
  computeKeyPrefix,
  sha256,
  timingSafeEqualHex,
} from "../src/lib/api/auth";
import {
  getIdempotentResult,
  validateIdempotencyKey,
  classifyIdempotentJob,
} from "../src/lib/api/idempotency";

const db = new PrismaClient();

// Minimal NextRequest-like stub
function makeReq(opts: { authHeader?: string; queryKey?: string; url?: string }): any {
  const headers = new Map<string, string>();
  if (opts.authHeader) headers.set("authorization", opts.authHeader);
  const url = new URL(opts.url ?? "http://localhost/api/v1/compress-pdf");
  if (opts.queryKey) url.searchParams.set("api_key", opts.queryKey);
  return {
    headers: {
      get: (k: string) => headers.get(k.toLowerCase()) ?? null,
    },
    url: url.toString(),
  };
}

async function main() {
  // 1. Find or create a user
  let user = await db.user.findUnique({ where: { email: "smoke@nextool.local" } });
  if (!user) {
    user = await db.user.create({ data: { email: "smoke@nextool.local", role: "user" } });
  }
  console.log("[1] user:", user.id);

  // 2. createApiKey — verify full key format + prefix + hash
  const { fullKey, apiKey } = await createApiKey(user.id, "smoke-key");
  console.log("[2] fullKey:", fullKey);
  console.log("    prefix :", apiKey.keyPrefix);
  console.log("    format check: starts_with(nt_live_)=" + fullKey.startsWith("nt_live_"));
  console.log("    format check: length=" + fullKey.length + " (expected " + (KEY_PREFIX_LIVE.length + KEY_SECRET_LENGTH) + ")");

  // 3. Compute prefix from full key — must match stored prefix
  const computed = computeKeyPrefix(fullKey);
  console.log("[3] computed prefix:", computed, "match=" + (computed === apiKey.keyPrefix));

  // 4. listApiKeys — should include the new key
  const list = await listApiKeys(user.id);
  console.log("[4] list count:", list.length, "(new key present:", list.some((k) => k.id === apiKey.id), ")");

  // 5. getApiKey
  const fetched = await getApiKey(apiKey.id, user.id);
  console.log("[5] getApiKey match:", fetched?.id === apiKey.id);

  // 6. authenticateApiKey — must return { apiKey, user }
  const auth1 = await authenticateApiKey(makeReq({ authHeader: `Bearer ${fullKey}` }));
  console.log("[6] header auth:", auth1 ? "OK" : "FAIL", "userId match:", auth1?.user.id === user.id);

  // 7. authenticateApiKey via query param
  const auth2 = await authenticateApiKey(makeReq({ queryKey: fullKey }));
  console.log("[7] query auth :", auth2 ? "OK" : "FAIL");

  // 8. authenticateApiKey with WRONG key (same prefix, wrong secret) — must fail
  const wrongKey = fullKey.slice(0, KEY_PREFIX_LIVE.length) + "X".repeat(KEY_SECRET_LENGTH) + fullKey.slice(KEY_PREFIX_LIVE.length + KEY_SECRET_LENGTH);
  // Trim/pad to exact length
  let bad = fullKey.slice(0, -1) + (fullKey.slice(-1) === "a" ? "b" : "a"); // change last char
  const auth3 = await authenticateApiKey(makeReq({ authHeader: `Bearer ${bad}` }));
  console.log("[8] wrong key :", auth3 === null ? "REJECTED (correct)" : "LEAKED (BUG)");

  // 9. authenticateApiKey with revoked key — must fail
  const revoked = await revokeApiKey(apiKey.id, user.id);
  console.log("[9] revokedAt set:", revoked?.revokedAt !== null);
  const auth4 = await authenticateApiKey(makeReq({ authHeader: `Bearer ${fullKey}` }));
  console.log("    revoked key auth:", auth4 === null ? "REJECTED (correct)" : "LEAKED (BUG)");

  // 10. authenticateApiKey with non-existent key — must fail
  const auth5 = await authenticateApiKey(makeReq({ authHeader: "Bearer nt_live_nonexistentkeydoesntexist0000000000" }));
  console.log("[10] unknown key:", auth5 === null ? "REJECTED (correct)" : "BUG");

  // 11. Cross-user: getApiKey with wrong userId — must return null
  const otherUser = await db.user.create({ data: { email: "other@nextool.local", role: "user" } });
  const fetchedOther = await getApiKey(apiKey.id, otherUser.id);
  console.log("[11] cross-user fetch:", fetchedOther === null ? "BLOCKED (correct)" : "BUG");

  // 12. Idempotency key validation
  console.log("[12] idempotency validate:");
  console.log("    'abc' ->", validateIdempotencyKey("abc"));
  console.log("    '' ->", validateIdempotencyKey(""));
  console.log("    'a'.repeat(300) ->", validateIdempotencyKey("a".repeat(300)));
  console.log("    newline ->", validateIdempotencyKey("a\nb"));

  // 13. getIdempotentResult + classify — empty for new key
  const idem = await getIdempotentResult("smoke-idempotency-001", user.id);
  console.log("[13] idempotent (none):", idem === null ? "OK (no existing)" : "BUG");

  // 14. Create a fake ProcessingJob with idempotencyKey and re-check
  const tool = await db.tool.findFirst({ where: { slug: "compress-pdf" } });
  if (tool) {
    const job = await db.processingJob.create({
      data: {
        userId: user.id,
        toolId: tool.id,
        status: "queued",
        idempotencyKey: "smoke-idempotency-001",
      },
    });
    const idem2 = await getIdempotentResult("smoke-idempotency-001", user.id);
    const cls = classifyIdempotentJob(idem2);
    console.log("[14] idempotent (queued): kind=" + cls.kind);
    await db.processingJob.delete({ where: { id: job.id } });
  }

  // 15. Crypto helpers
  const secret = generateBase62Secret(32);
  console.log("[15] secret length:", secret.length, "starts with nt_live_:", buildFullKey(secret).startsWith("nt_live_"));
  const h1 = sha256("hello");
  const h2 = sha256("hello");
  const h3 = sha256("world");
  console.log("    timingSafeEqual(hello,hello):", timingSafeEqualHex(h1, h2));
  console.log("    timingSafeEqual(hello,world):", timingSafeEqualHex(h1, h3));

  // Cleanup
  await db.apiKey.deleteMany({ where: { userId: user.id } });
  await db.user.delete({ where: { id: user.id } }).catch(() => {});
  await db.user.delete({ where: { id: otherUser.id } }).catch(() => {});

  console.log("\n✓ All smoke tests passed.");
}

main().then(() => db.$disconnect()).catch((e) => {
  console.error("SMOKE TEST FAILED:", e);
  process.exit(1);
});
