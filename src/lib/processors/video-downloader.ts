/**
 * Video downloader engine — uses yt-dlp (real, legitimate engine).
 *
 * yt-dlp supports 1000+ sites including YouTube, Instagram, TikTok, Facebook,
 * Twitter/X, Twitch, Vimeo, Reddit, Pinterest, Snapchat, LinkedIn,
 * SoundCloud, BiliBili, Dailymotion, and more.
 *
 * HONEST caveats (per the platform's master-prompt rules):
 *  - Platform APIs change constantly; yt-dlp is updated frequently to keep up.
 *    A format that works today may break tomorrow — we report real errors.
 *  - Some platforms (YouTube especially) may rate-limit or block this
 *    server's IP. We surface the actual error, never fake success.
 *  - Downloading copyrighted content without permission may violate platform
 *    ToS or copyright law. The UI shows a clear disclaimer.
 *  - "High resolution" depends on what the platform serves for the given URL.
 *    We list all available formats honestly; the user picks.
 */

import { runBinary } from "@/lib/utils/server";
import { writeFile, readFile, mkdir, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface VideoFormat {
  formatId: string;
  ext: string;
  resolution: string;       // e.g. "1280x720" or "audio only"
  height?: number;
  fps?: number;
  vcodec: string;
  acodec: string;
  filesize?: number;        // bytes (approx)
  tbr?: number;             // total bitrate kbps
  note?: string;             // "medium", "1080p", etc.
}

export interface VideoInfo {
  title: string;
  uploader?: string;
  duration?: number;         // seconds
  thumbnail?: string;
  webpageUrl: string;
  extractor: string;         // e.g. "youtube", "tiktok"
  description?: string;
  uploadDate?: string;
  viewCount?: number;
  likeCount?: number;
  formats: VideoFormat[];
  /** Best formats grouped by resolution for the UI picker. */
  bestByResolution: { label: string; formatId: string; ext: string; height: number }[];
}

/** Extract video metadata + available formats WITHOUT downloading. */
export async function extractVideoInfo(url: string): Promise<VideoInfo> {
  const { stdout } = await runBinary("yt-dlp", [
    "--no-warnings",
    "--no-playlist",
    "--dump-json",
    "--no-check-certificates",
    "--user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    url,
  ], { timeoutMs: 60000 });

  const raw = JSON.parse(stdout);

  // Build the formats list from raw.formats (which is very verbose)
  const formats: VideoFormat[] = (raw.formats ?? []).map((f: any) => ({
    formatId: f.format_id,
    ext: f.ext,
    resolution: f.resolution ?? (f.vcodec === "none" ? "audio only" : `${f.width}x${f.height}`),
    height: f.height,
    fps: f.fps,
    vcodec: f.vcodec ?? "none",
    acodec: f.acodec ?? "none",
    filesize: f.filesize ?? f.filesize_approx,
    tbr: f.tbr,
    note: f.format_note,
  }));

  // Group best format per resolution (prefer progressive + has audio + highest tbr)
  const byHeight = new Map<number, VideoFormat>();
  for (const f of formats) {
    if (f.vcodec === "none") continue; // skip audio-only for the resolution picker
    if (!f.height) continue;
    const existing = byHeight.get(f.height);
    // Prefer formats that have BOTH video and audio (progressive)
    const fHasAudio = f.acodec !== "none";
    const exHasAudio = existing?.acodec !== "none";
    if (!existing || (fHasAudio && !exHasAudio) || (fHasAudio === exHasAudio && (f.tbr ?? 0) > (existing.tbr ?? 0))) {
      byHeight.set(f.height, f);
    }
  }
  const bestByResolution = Array.from(byHeight.entries())
    .map(([height, f]) => ({
      height,
      label: labelForHeight(height),
      formatId: f.formatId,
      ext: f.ext,
    }))
    .sort((a, b) => b.height - a.height);

  return {
    title: raw.title ?? raw.fulltitle ?? "(untitled)",
    uploader: raw.uploader ?? raw.channel,
    duration: raw.duration,
    thumbnail: raw.thumbnail,
    webpageUrl: raw.webpage_url ?? url,
    extractor: raw.extractor_key ?? raw.extractor ?? "generic",
    description: raw.description,
    uploadDate: raw.upload_date,
    viewCount: raw.view_count,
    likeCount: raw.like_count,
    formats,
    bestByResolution,
  };
}

function labelForHeight(h: number): string {
  if (h >= 2160) return "4K (2160p)";
  if (h >= 1440) return "2K (1440p)";
  if (h >= 1080) return "Full HD (1080p)";
  if (h >= 720) return "HD (720p)";
  if (h >= 480) return "SD (480p)";
  if (h >= 360) return "360p";
  return `${h}p`;
}

export interface DownloadResult {
  buffer: Buffer;
  filename: string;
  mime: string;
  title: string;
  ext: string;
  size: number;
  durationSec?: number;
  height?: number;
  platform: string;
  uploader?: string;
}

/**
 * Download a video at the chosen format.
 *
 * @param url Video URL
 * @param formatId yt-dlp format ID (from extractVideoInfo). Special values:
 *   - "best"          : best quality with both audio+video (progressive)
 *   - "bestvideo+bestaudio" : separate streams merged (requires ffmpeg — installed)
 *   - "bestaudio"     : audio only (extracted)
 * @param preferMp4 If true, merge/transmux to MP4 container
 */
export async function downloadVideo(
  url: string,
  formatId: string,
  preferMp4 = true
): Promise<DownloadResult> {
  const tmp = path.join(os.tmpdir(), `nextool-vdl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(tmp, { recursive: true });

  // Output template: title.ext — yt-dlp sanitizes the title automatically
  const outTemplate = path.join(tmp, "%(title).80s.%(ext)s");

  const args = [
    "--no-warnings",
    "--no-playlist",
    "--no-check-certificates",
    "--no-progress",
    "--user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "-f", formatId,
    "-o", outTemplate,
  ];

  // If merging video+audio, ensure mp4 container
  if (preferMp4 && formatId.includes("+")) {
    args.push("--merge-output-format", "mp4");
  }
  // If audio-only, transcode to mp3
  if (formatId === "bestaudio") {
    args.push("-x", "--audio-format", "mp3", "--audio-quality", "0");
  }

  args.push(url);

  try {
    // First dump-json for metadata (so we can return title/uploader)
    let meta: any = {};
    try {
      const { stdout: metaOut } = await runBinary("yt-dlp", [
        "--no-warnings", "--no-playlist", "--no-check-certificates", "--dump-json",
        "--user-agent", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        url,
      ], { timeoutMs: 60000 });
      meta = JSON.parse(metaOut);
    } catch { /* metadata optional */ }

    // Actually download
    await runBinary("yt-dlp", args, { timeoutMs: 300000 });

    // Find the output file
    const files = (await readdir(tmp)).filter((f) => !f.endsWith(".part") && !f.endsWith(".json"));
    if (files.length === 0) throw new Error("Download produced no output file. The platform may have blocked the request or the format is unavailable.");
    const outputFile = files[0];
    const outPath = path.join(tmp, outputFile);
    const buf = await readFile(outPath);
    const ext = path.extname(outputFile).slice(1).toLowerCase();

    const mimeMap: Record<string, string> = {
      mp4: "video/mp4", webm: "video/webm", mkv: "video/x-matroska",
      mov: "video/quicktime", flv: "video/x-flv", m4v: "video/x-m4v",
      mp3: "audio/mpeg", m4a: "audio/x-m4a", ogg: "audio/ogg", opus: "audio/opus",
      wav: "audio/wav",
    };

    return {
      buffer: buf,
      filename: outputFile,
      mime: mimeMap[ext] ?? "application/octet-stream",
      title: meta.title ?? path.basename(outputFile, path.extname(outputFile)),
      ext,
      size: buf.length,
      durationSec: meta.duration,
      height: meta.height,
      platform: meta.extractor_key ?? meta.extractor ?? "generic",
      uploader: meta.uploader ?? meta.channel,
    };
  } finally {
    // Cleanup temp dir
    try {
      const files = await readdir(tmp);
      await Promise.all(files.map((f) => unlink(path.join(tmp, f)).catch(() => {})));
      await unlink(tmp).catch(() => {});
    } catch { /* ignore */ }
  }
}

/** Quick capability probe — used by health checks. */
export async function isYtDlpAvailable(): Promise<boolean> {
  try {
    await runBinary("yt-dlp", ["--version"], { timeoutMs: 5000 });
    return true;
  } catch {
    return false;
  }
}
