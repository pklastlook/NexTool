import { NextResponse } from "next/server";
import net from "node:net";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";

/**
 * Overall application health (Prompt2 §42).
 *
 * Performs REAL dependency checks — never returns "ok" without verifying.
 *  - database: Prisma SELECT 1
 *  - redis:    TCP connect to REDIS_URL host:port (or "not_configured")
 *  - storage:  S3 HeadBucket if configured, else local tmp/ writability probe
 *
 * Aggregate status:
 *  - unhealthy: any critical (db) check failed
 *  - degraded:  db ok but an optional dep failed/not configured
 *  - healthy:   all checks pass
 */
export const dynamic = "force-dynamic";

type CheckStatus = "healthy" | "degraded" | "unhealthy" | "not_configured";

interface Check {
  status: CheckStatus;
  latencyMs?: number;
  detail: string;
}

async function checkDatabase(): Promise<Check> {
  const t0 = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return { status: "healthy", latencyMs: Date.now() - t0, detail: "Prisma SELECT 1 succeeded." };
  } catch (e) {
    return { status: "unhealthy", latencyMs: Date.now() - t0, detail: (e as Error).message };
  }
}

async function checkRedis(): Promise<Check> {
  if (!env.REDIS_URL) {
    return { status: "not_configured", detail: "REDIS_URL not set — in-process DB-backed queue used in sandbox." };
  }
  let host: string;
  let port: number;
  try {
    const u = new URL(env.REDIS_URL);
    host = u.hostname;
    port = u.port ? parseInt(u.port, 10) : 6379;
  } catch {
    return { status: "unhealthy", detail: "REDIS_URL is not a valid URL." };
  }
  const t0 = Date.now();
  return new Promise<Check>((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ status: "unhealthy", latencyMs: Date.now() - t0, detail: `TCP connect to ${host}:${port} timed out.` });
    }, 3000);
    socket.setTimeout(3000);
    socket.once("connect", () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve({ status: "healthy", latencyMs: Date.now() - t0, detail: `TCP connected to ${host}:${port}.` });
    });
    socket.once("error", (err) => {
      clearTimeout(timeout);
      resolve({ status: "unhealthy", latencyMs: Date.now() - t0, detail: `TCP connect to ${host}:${port} failed: ${err.message}` });
    });
    socket.connect(port, host);
  });
}

async function checkStorage(): Promise<Check> {
  if (env.STORAGE_ENDPOINT && env.STORAGE_BUCKET && env.STORAGE_ACCESS_KEY && env.STORAGE_SECRET_KEY) {
    const t0 = Date.now();
    try {
      const { S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: env.STORAGE_REGION || "us-east-1",
        endpoint: env.STORAGE_ENDPOINT,
        forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
        credentials: { accessKeyId: env.STORAGE_ACCESS_KEY, secretAccessKey: env.STORAGE_SECRET_KEY },
      });
      await client.send(new HeadBucketCommand({ Bucket: env.STORAGE_BUCKET }));
      return { status: "healthy", latencyMs: Date.now() - t0, detail: `HeadBucket ${env.STORAGE_BUCKET} succeeded.` };
    } catch (e) {
      return { status: "unhealthy", latencyMs: Date.now() - t0, detail: `HeadBucket failed: ${(e as Error).message}` };
    }
  }
  const t0 = Date.now();
  try {
    const probeName = `__healthcheck__-${Date.now()}`;
    const stored = await storage.saveOutput(Buffer.from("ok"), probeName);
    const readBack = await storage.read(stored.key, "outputs");
    await storage.remove(stored.key, "outputs");
    if (readBack.length !== 2) throw new Error("Probe round-trip size mismatch");
    return { status: "healthy", latencyMs: Date.now() - t0, detail: "Local tmp/outputs directory is writable (S3 not configured)." };
  } catch (e) {
    return { status: "unhealthy", latencyMs: Date.now() - t0, detail: `Local storage write probe failed: ${(e as Error).message}` };
  }
}

export async function GET() {
  const [dbCheck, redisCheck, storageCheck] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkStorage(),
  ]);

  const checks = { database: dbCheck, redis: redisCheck, storage: storageCheck };

  let status: "healthy" | "degraded" | "unhealthy" = "healthy";
  if (dbCheck.status === "unhealthy") status = "unhealthy";
  else if (redisCheck.status === "unhealthy" || storageCheck.status === "unhealthy") {
    status = "degraded";
  }

  const httpStatus = status === "unhealthy" ? 503 : 200;

  return NextResponse.json(
    {
      status,
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: httpStatus }
  );
}
