import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { extractVideoInfo } from "@/lib/processors/video-downloader";
import { rateLimitByIp } from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

const Body = z.object({
  url: z.string().url(),
});

/**
 * POST /api/video/info
 * Body: { url }
 * Returns video metadata + available formats (NO download).
 *
 * Rate-limited because each call hits the platform's servers.
 */
export async function POST(req: NextRequest) {
  // Rate limit: 10 info fetches per hour per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const rl = await rateLimitByIp(ip, { windowSec: 3600, limit: 20 });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: `Rate limit exceeded. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Invalid request. Send { url }." }, { status: 400 });
  }

  try {
    const info = await extractVideoInfo(body.url);
    return NextResponse.json({ ok: true, info });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Distinguish common platform errors
    let hint = "";
    if (/sign in|confirm|bot|captcha|429|rate.?limit/i.test(msg)) {
      hint = " The platform may be blocking automated requests from this server, or requires authentication. This is a platform-side restriction, not a bug.";
    } else if (/unsupported url|no video/i.test(msg)) {
      hint = " This URL is not supported by yt-dlp. Check that the URL points to a real video page.";
    }
    return NextResponse.json(
      { ok: false, error: `Could not extract video info: ${msg}.${hint}` },
      { status: 422 }
    );
  }
}
