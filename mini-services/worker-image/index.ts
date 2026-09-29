/**
 * Worker mini-service — Image queue.
 *
 * Tools routed here (see `queueForTool`):
 *   image-converter, image-compressor, image-resizer, image-cropper,
 *   remove-exif.
 *
 * Real conversions via Sharp (`src/lib/processors/image.ts`). No mocks.
 *
 * Run from the main project root so bun loads `.env` and resolves `@/`
 * tsconfig paths:
 *   `bun --hot mini-services/worker-image/index.ts`
 */
import { Worker, type ProcessorFn } from "../../src/lib/queue/worker";
import { newWorkerId } from "../../src/lib/observability/log";
import {
  convertImage,
  compressImage,
  resizeImage,
  cropImage,
  stripMetadata,
  formatFromMime,
  formatFromExt,
  type ImageFormat,
} from "../../src/lib/processors/image";
import { detectFileType } from "../../src/lib/tool-engine";

const VALID_FORMATS: ImageFormat[] = ["jpeg", "png", "webp", "avif"];

function parseFormat(v: unknown, fallback: ImageFormat = "jpeg"): ImageFormat {
  if (typeof v === "string") {
    const f = v.toLowerCase().replace("jpg", "jpeg");
    if ((VALID_FORMATS as string[]).includes(f)) return f as ImageFormat;
  }
  return fallback;
}

function numberOpt(v: unknown, def?: number): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return def;
}

/** Detect the input image format from magic bytes, falling back to mime/extension. */
function detectFormat(buf: Buffer, mime: string, name: string): ImageFormat {
  const detected = detectFileType(buf);
  if (detected) {
    const f = formatFromMime(detected.mime);
    if (f) return f;
  }
  const fromMime = formatFromMime(mime);
  if (fromMime) return fromMime;
  const fromExt = formatFromExt(name);
  if (fromExt) return fromExt;
  return "jpeg";
}

const processors: Record<string, ProcessorFn> = {
  "image-converter": async (input, options) => {
    const format = parseFormat(options.format);
    const quality = numberOpt(options.quality, 82) ?? 82;
    const r = await convertImage(input.buf, format, quality);
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, r.ext),
      mime: r.mime,
      meta: { format, quality, inputSize: input.buf.length, outputSize: r.buffer.length },
    };
  },

  "image-compressor": async (input, options) => {
    // Detect the actual format from magic bytes (never trust the extension).
    const format = detectFormat(input.buf, input.mime, input.name);
    const quality = numberOpt(options.quality, 70) ?? 70;
    const r = await compressImage(input.buf, format, quality);
    const saved = input.buf.length - r.buffer.length;
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, r.ext),
      mime: r.mime,
      meta: {
        format,
        quality,
        inputSize: input.buf.length,
        outputSize: r.buffer.length,
        savedBytes: saved,
        savedPercent: input.buf.length > 0 ? Math.round((saved / input.buf.length) * 100) : 0,
      },
    };
  },

  "image-resizer": async (input, options) => {
    const format = parseFormat(options.format, detectFormat(input.buf, input.mime, input.name));
    const quality = numberOpt(options.quality, 82) ?? 82;
    const width = numberOpt(options.width);
    const height = numberOpt(options.height);
    const percent = numberOpt(options.percent);
    const fit = (typeof options.fit === "string" ? options.fit : "cover") as "cover" | "contain" | "fill";
    if (!width && !height && !percent) {
      throw new Error("image-resizer requires options.width, options.height, or options.percent.");
    }
    const r = await resizeImage(
      input.buf,
      { width, height, percent, fit },
      format,
      quality
    );
    const meta: Record<string, string | number> = { fit, format, quality };
    if (width != null) meta.width = width;
    if (height != null) meta.height = height;
    if (percent != null) meta.percent = percent;
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, r.ext),
      mime: r.mime,
      meta,
    };
  },

  "image-cropper": async (input, options) => {
    const format = parseFormat(options.format, detectFormat(input.buf, input.mime, input.name));
    const quality = numberOpt(options.quality, 82) ?? 82;
    const left = numberOpt(options.left);
    const top = numberOpt(options.top);
    const width = numberOpt(options.width);
    const height = numberOpt(options.height);
    if (left == null || top == null || width == null || height == null) {
      throw new Error("image-cropper requires options.left, options.top, options.width, options.height.");
    }
    const r = await cropImage(input.buf, { left, top, width, height }, format, quality);
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, r.ext),
      mime: r.mime,
      meta: { left, top, width, height, format },
    };
  },

  "remove-exif": async (input, options) => {
    const format = parseFormat(options.format, detectFormat(input.buf, input.mime, input.name));
    const quality = numberOpt(options.quality, 82) ?? 82;
    const r = await stripMetadata(input.buf, format, quality);
    const saved = input.buf.length - r.buffer.length;
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, r.ext),
      mime: r.mime,
      meta: {
        format,
        inputSize: input.buf.length,
        outputSize: r.buffer.length,
        savedBytes: saved,
        metadataStripped: 1,
      },
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
const workerId = process.env.WORKER_ID || newWorkerId("image");
const worker = new Worker({ workerId, queue: "image", processors });

worker.start().catch((e) => {
  console.error("[worker-image] fatal:", e);
  process.exit(1);
});
