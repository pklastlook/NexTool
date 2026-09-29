import { NextResponse } from "next/server";
import { db } from "@/lib/db";

/**
 * Kubernetes readiness probe (Prompt2 §42).
 *
 * 200 if the application is ready to serve traffic (DB reachable),
 * 503 otherwise. Used to gate traffic before the app finishes booting
 * or while the DB is unreachable.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { ready: true, timestamp: new Date().toISOString() },
      { status: 200 }
    );
  } catch (e) {
    return NextResponse.json(
      { ready: false, error: (e as Error).message, timestamp: new Date().toISOString() },
      { status: 503 }
    );
  }
}
