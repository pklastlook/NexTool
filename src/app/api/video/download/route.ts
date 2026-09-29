import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { downloadVideo } from "@/lib/processors/video-downloader";
import { storage } from "@/lib/storage";
import { rateLimitByIp } from "@/lib/security/rate-limit";
import { recordEvent } from "@/lib/analytics";

export const runtime = "nodejs";
export const maxDuration = 300;

const Body = z.object({
  url: z.string().url(),
  formatId: z.string().min(1).max(120),  // yt-dlp format id
  preferMp4: z.boolean().optional().default(true),
});

/**
 * POST /api/video/download
 * Body: { url, formatId, preferMp4? }
 * Downloads the video at the chosen format via yt-dlp, stores the output via
 * the storage provider, and returns a signed download URL.
 *
 * Rate-limited: 10 downloads per hour per IP (heavy operation).
 */
export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const rl = await rateLimitByIp(ip, { windowSec: 3600, limit: 10 });
  if (!rl.allowed) {
    return NextResponse.json(
      { ok: false, error: `Download rate limit exceeded. Try again in ${Math.ceil((rl.resetAt - Date.now()) / 1000)}s.` },
      { status: 429, headers: { "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)) } }
    );
  }

  let body;
  try {
    body = Body.parse(await req.json());
  } catch (e) {
    return NextResponse.json({ ok: false, error: "Invalid request. Send { url, formatId }." }, { status: 400 });
  }

  try {
    const result = await downloadVideo(body.url, body.formatId, body.preferMp4);

    // Hard cap: 500MB output (don't fill the disk)
    if (result.size > 524288000) {
      throw new Error(`Output too large (${(result.size / 1048576).toFixed(0)} MB). Maximum is 500 MB.`);
    }

    // Store the output via the storage provider
    const stored = await storage.saveOutput(result.buffer, result.filename, {
      contentType: result.mime,
      prefix: "outputs",
    });

    await recordEvent("tool_start", undefined, { slug: "video-downloader", platform: result.platform, height: result.height });

    return NextResponse.json({
      ok: true,
      meta: {
        Title: result.title,
        Platform: result.platform,
        Uploader: result.uploader ?? "",
        Format: result.ext.toUpperCase(),
        Resolution: result.height ? `${result.height}p` : "audio",
        Duration: result.durationSec ? `${Math.floor(result.durationSec / 60)}:${String(result.durationSec % 60).padStart(2, "0")}` : "",
        "Output size": result.size,
      },
      file: {
        key: stored.key,
        dir: "outputs" as const,
        filename: result.filename,
        mime: result.mime,
        size: result.size,
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    let hint = "";
    if (/sign in|confirm|bot|captcha|429|rate.?limit/i.test(msg)) {
      hint = " The platform is blocking the download from this server. This is a platform-side restriction.";
    } else if (/unsupported url|no video/i.test(msg)) {
      hint = " This URL is not supported. Check that it points to a real video page.";
    } else if (/format.*not available|requested format not available/i.test(msg)) {
      hint = " That specific format isn't available for this video. Try a different quality or 'best'.";
    }
    return NextResponse.json(
      { ok: false, error: `Download failed: ${msg}.${hint}` },
      { status: 422 }
    );
  }
}
