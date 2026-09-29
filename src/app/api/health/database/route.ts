import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Database deep health probe (Prompt2 §42).
 *
 * Runs a raw `SELECT 1` and reports latency. Used for targeted DB health
 * (not the composite /api/health endpoint).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const t0 = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({
      status: "healthy",
      latencyMs: Date.now() - t0,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    return NextResponse.json(
      {
        status: "unhealthy",
        latencyMs: Date.now() - t0,
        error: (e as Error).message,
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }
}
