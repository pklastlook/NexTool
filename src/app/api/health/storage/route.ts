import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import { storage } from "@/lib/storage";

/**
 * Object storage health probe (Prompt2 §42).
 *
 * Honest behavior:
 *  - If S3 env vars are present, runs a real HeadBucket against the configured
 *    bucket via the AWS SDK.
 *  - Otherwise, verifies the local tmp/outputs dir is writable by writing,
 *    reading, and removing a probe file.
 *
 * Never returns "ok" without actually exercising the storage path.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  // S3 path
  if (env.STORAGE_ENDPOINT && env.STORAGE_BUCKET && env.STORAGE_ACCESS_KEY && env.STORAGE_SECRET_KEY) {
    const t0 = Date.now();
    try {
      const { S3Client, HeadBucketCommand } = await import("@aws-sdk/client-s3");
      const client = new S3Client({
        region: env.STORAGE_REGION || "us-east-1",
        endpoint: env.STORAGE_ENDPOINT,
        forcePathStyle: env.STORAGE_FORCE_PATH_STYLE,
        credentials: {
          accessKeyId: env.STORAGE_ACCESS_KEY,
          secretAccessKey: env.STORAGE_SECRET_KEY,
        },
      });
      await client.send(new HeadBucketCommand({ Bucket: env.STORAGE_BUCKET }));
      return NextResponse.json({
        status: "healthy",
        provider: "s3",
        bucket: env.STORAGE_BUCKET,
        latencyMs: Date.now() - t0,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      return NextResponse.json(
        {
          status: "unhealthy",
          provider: "s3",
          bucket: env.STORAGE_BUCKET,
          latencyMs: Date.now() - t0,
          error: (e as Error).message,
          timestamp: new Date().toISOString(),
        },
        { status: 503 }
      );
    }
  }

  // Local fallback: prove tmp/ is writable by round-tripping a probe file.
  const t0 = Date.now();
  try {
    const probeName = `__healthcheck__-${Date.now()}`;
    const buf = Buffer.from("nextool-storage-probe", "utf8");
    const stored = await storage.saveOutput(buf, probeName);
    const readBack = await storage.read(stored.key, "outputs");
    await storage.remove(stored.key, "outputs");
    if (readBack.length !== buf.length) {
      throw new Error("Probe round-trip size mismatch");
    }
    return NextResponse.json({
      status: "healthy",
      provider: "local",
      path: storage.outputsDir,
      latencyMs: Date.now() - t0,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "unhealthy",
        provider: "local",
        path: storage.outputsDir,
        latencyMs: Date.now() - t0,
        error: (e as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
