/**
 * Worker mini-service — Media queue.
 *
 * Tools routed here (see `queueForTool`):
 *   video-converter, video-compressor, video-to-gif,
 *   audio-extractor, audio-converter.
 *
 * Real conversions via FFmpeg (`src/lib/processors/media.ts`). No mocks.
 *
 * Run from the main project root so bun loads `.env` and resolves `@/`
 * tsconfig paths:
 *   `bun --hot mini-services/worker-media/index.ts`
 */
import { Worker, type ProcessorFn } from "../../src/lib/queue/worker";
import { newWorkerId } from "../../src/lib/observability/log";
import {
  convertVideo,
  compressVideo,
  videoToGif,
  extractAudio,
  convertAudio,
} from "../../src/lib/processors/media";

function stringOpt(v: unknown, def?: string): string | undefined {
  if (typeof v === "string" && v.trim() !== "") return v.trim().toLowerCase();
  return def;
}

function numberOpt(v: unknown, def?: number): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return def;
}

const processors: Record<string, ProcessorFn> = {
  "video-converter": async (input, options) => {
    const targetExt = stringOpt(options.format, "mp4") ?? "mp4";
    if (!["mp4", "webm", "mov", "mkv"].includes(targetExt)) {
      throw new Error(`Unsupported video target format: ${targetExt}`);
    }
    const r = await convertVideo(input.buf, input.name, targetExt);
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, r.ext),
      mime: r.mime,
      meta: { inputSize: input.buf.length, outputSize: r.buffer.length, targetExt: r.ext },
    };
  },

  "video-compressor": async (input, options) => {
    const crf = numberOpt(options.crf, 28) ?? 28;
    const scale = numberOpt(options.scale, 720) ?? 720;
    if (crf < 0 || crf > 51) throw new Error(`Invalid CRF ${crf} (must be 0-51).`);
    if (scale < 1) throw new Error(`Invalid scale ${scale}.`);
    const r = await compressVideo(input.buf, input.name, crf, scale);
    const saved = input.buf.length - r.buffer.length;
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, r.ext),
      mime: r.mime,
      meta: {
        crf,
        scale,
        inputSize: input.buf.length,
        outputSize: r.buffer.length,
        savedBytes: saved,
        savedPercent: input.buf.length > 0 ? Math.round((saved / input.buf.length) * 100) : 0,
      },
    };
  },

  "video-to-gif": async (input, options) => {
    const fps = numberOpt(options.fps, 10) ?? 10;
    const width = numberOpt(options.width, 480) ?? 480;
    if (fps < 1 || fps > 30) throw new Error(`Invalid fps ${fps} (must be 1-30).`);
    if (width < 1) throw new Error(`Invalid width ${width}.`);
    const r = await videoToGif(input.buf, input.name, fps, width);
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, "gif"),
      mime: r.mime,
      meta: { fps, width, inputSize: input.buf.length, outputSize: r.buffer.length },
    };
  },

  "audio-extractor": async (input, options) => {
    const bitrate = stringOpt(options.bitrate, "192k") ?? "192k";
    const r = await extractAudio(input.buf, input.name, bitrate);
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, "mp3"),
      mime: r.mime,
      meta: { bitrate, inputSize: input.buf.length, outputSize: r.buffer.length },
    };
  },

  "audio-converter": async (input, options) => {
    const targetExt = stringOpt(options.format, "mp3") ?? "mp3";
    if (!["mp3", "wav", "aac", "m4a"].includes(targetExt)) {
      throw new Error(`Unsupported audio target format: ${targetExt}`);
    }
    const bitrate = stringOpt(options.bitrate, "192k") ?? "192k";
    const r = await convertAudio(input.buf, input.name, targetExt, bitrate);
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, r.ext),
      mime: r.mime,
      meta: { targetExt: r.ext, bitrate, inputSize: input.buf.length, outputSize: r.buffer.length },
    };
  },
};

function swapExt(name: string, ext: string): string {
  const base = name.replace(/\.[^.]+$/, "");
  return `${base || "output"}.${ext}`;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const workerId = process.env.WORKER_ID || newWorkerId("media");
const worker = new Worker({ workerId, queue: "media", processors });

worker.start().catch((e) => {
  console.error("[worker-media] fatal:", e);
  process.exit(1);
});
