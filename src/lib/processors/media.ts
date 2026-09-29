/**
 * Media processing engine — uses FFmpeg via child_process.
 * Real video/audio conversion, compression, GIF, audio extraction.
 */
import { runBinary } from "@/lib/utils/server";
import { writeFile, readFile, mkdir, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface MediaResult {
  buffer: Buffer;
  ext: string;
  mime: string;
}

const MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mkv: "video/x-matroska",
  gif: "image/gif",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  aac: "audio/aac",
  m4a: "audio/x-m4a",
};

async function runFfmpeg(
  inputPath: string,
  outputPath: string,
  args: string[]
): Promise<void> {
  await runBinary("ffmpeg", [
    "-y", // overwrite
    "-i", inputPath,
    ...args,
    outputPath,
  ], { timeoutMs: 300000 });
}

async function withTempDir<T>(inputBuf: Buffer, inputName: string, targetExt: string, fn: (input: string, output: string) => Promise<MediaResult>): Promise<MediaResult> {
  const tmp = path.join(os.tmpdir(), `nextool-media-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(tmp, { recursive: true });
  const inputPath = path.join(tmp, inputName || "input");
  await writeFile(inputPath, inputBuf);
  const baseName = path.basename(inputName, path.extname(inputName)) || "output";
  const outputPath = path.join(tmp, `${baseName}.${targetExt}`);
  try {
    const result = await fn(inputPath, outputPath);
    return result;
  } finally {
    try {
      const files = await readdir(tmp);
      await Promise.all(files.map((f) => unlink(path.join(tmp, f)).catch(() => {})));
      await unlink(tmp).catch(() => {});
    } catch { /* ignore */ }
  }
}

/** Convert video between containers/codecs. */
export async function convertVideo(
  buf: Buffer,
  inputName: string,
  targetExt: string
): Promise<MediaResult> {
  return withTempDir(buf, inputName, targetExt, async (input, output) => {
    const args: string[] = [];
    if (targetExt === "mp4") args.push("-c:v", "libx264", "-preset", "fast", "-crf", "23", "-c:a", "aac");
    else if (targetExt === "webm") args.push("-c:v", "libvpx-vp9", "-b:v", "1M", "-c:a", "libopus");
    else if (targetExt === "mov") args.push("-c:v", "libx264", "-c:a", "aac");
    await runFfmpeg(input, output, args);
    return {
      buffer: await readFile(output),
      ext: targetExt,
      mime: MIME_BY_EXT[targetExt] ?? "video/mp4",
    };
  });
}

/** Compress a video by lowering bitrate/resolution. */
export async function compressVideo(
  buf: Buffer,
  inputName: string,
  crf = 28,
  scale = 720
): Promise<MediaResult> {
  return withTempDir(buf, inputName, "mp4", async (input, output) => {
    await runFfmpeg(input, output, [
      "-vf", `scale=-2:${scale}`,
      "-c:v", "libx264",
      "-preset", "slow",
      "-crf", String(crf),
      "-c:a", "aac",
      "-b:a", "128k",
    ]);
    return { buffer: await readFile(output), ext: "mp4", mime: "video/mp4" };
  });
}

/** Convert a video clip to an animated GIF. */
export async function videoToGif(
  buf: Buffer,
  inputName: string,
  fps = 10,
  width = 480
): Promise<MediaResult> {
  return withTempDir(buf, inputName, "gif", async (input, output) => {
    // Two-pass for better palette quality
    const palettePath = path.join(path.dirname(output), "palette.png");
    await runFfmpeg(input, palettePath, [
      "-vf", `fps=${fps},scale=${width}:-1:flags=lanczos,palettegen`,
    ]);
    await runFfmpeg(input, output, [
      "-i", palettePath,
      "-lavfi", `fps=${fps},scale=${width}:-1:flags=lanczos[x];[x][1:v]paletteuse`,
    ]);
    return { buffer: await readFile(output), ext: "gif", mime: "image/gif" };
  });
}

/** Extract the audio track from a video as MP3. */
export async function extractAudio(
  buf: Buffer,
  inputName: string,
  bitrate = "192k"
): Promise<MediaResult> {
  return withTempDir(buf, inputName, "mp3", async (input, output) => {
    await runFfmpeg(input, output, [
      "-vn", "-ac", "2", "-c:a", "libmp3lame", "-b:a", bitrate,
    ]);
    return { buffer: await readFile(output), ext: "mp3", mime: "audio/mpeg" };
  });
}

/** Convert audio between formats. */
export async function convertAudio(
  buf: Buffer,
  inputName: string,
  targetExt: string,
  bitrate = "192k"
): Promise<MediaResult> {
  return withTempDir(buf, inputName, targetExt, async (input, output) => {
    const args: string[] = [];
    if (targetExt === "mp3") args.push("-c:a", "libmp3lame", "-b:a", bitrate);
    else if (targetExt === "wav") args.push("-c:a", "pcm_s16le");
    else if (targetExt === "aac") args.push("-c:a", "aac", "-b:a", bitrate);
    else if (targetExt === "m4a") args.push("-c:a", "aac", "-b:a", bitrate);
    await runFfmpeg(input, output, args);
    return {
      buffer: await readFile(output),
      ext: targetExt,
      mime: MIME_BY_EXT[targetExt] ?? "audio/mpeg",
    };
  });
}
