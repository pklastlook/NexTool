import { NextResponse } from "next/server";
import net from "node:net";
import { env } from "@/lib/env";

/**
 * Redis health probe (Prompt2 §42).
 *
 * Honest behavior:
 *  - If REDIS_URL is not set, returns `not_configured`. We never fake a ping.
 *  - If set, attempts a minimal TCP connect to the parsed host:port
 *    (no Redis protocol — just proves the socket can reach the host).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  if (!env.REDIS_URL) {
    return NextResponse.json({
      status: "not_configured",
      detail: "REDIS_URL not set. In-process DB-backed queue is used in the sandbox.",
      timestamp: new Date().toISOString(),
    });
  }

  let host: string;
  let port: number;
  try {
    const u = new URL(env.REDIS_URL);
    host = u.hostname;
    port = u.port ? parseInt(u.port, 10) : 6379;
  } catch {
    return NextResponse.json(
      {
        status: "unhealthy",
        detail: "REDIS_URL is not a valid URL.",
        timestamp: new Date().toISOString(),
      },
      { status: 503 }
    );
  }

  const t0 = Date.now();

  const result = await new Promise<{ status: "healthy" | "unhealthy"; latencyMs: number; detail: string }>((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve({ status: "unhealthy", latencyMs: Date.now() - t0, detail: `TCP connect to ${host}:${port} timed out after 3s.` });
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

  return NextResponse.json(
    { ...result, host, port, timestamp: new Date().toISOString() },
    { status: result.status === "healthy" ? 200 : 503 }
  );
}
