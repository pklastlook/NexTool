/**
 * Image processing engine — uses Sharp.
 * Real conversions, compression, resizing, cropping, EXIF removal.
 */
import sharp from "sharp";
import { extname } from "path";

export type ImageFormat = "jpeg" | "png" | "webp" | "avif";

export interface ImageInfo {
  format: string;
  width: number;
  height: number;
  size: number;
}

export async function getImageInfo(buf: Buffer): Promise<ImageInfo> {
  const meta = await sharp(buf).metadata();
  return {
    format: meta.format ?? "unknown",
    width: meta.width ?? 0,
    height: meta.height ?? 0,
    size: buf.length,
  };
}

const MIME_BY_FORMAT: Record<ImageFormat, string> = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
};

/** Convert an image buffer to the target format. */
export async function convertImage(
  buf: Buffer,
  format: ImageFormat,
  quality = 82
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  let pipeline = sharp(buf, { failOn: "error" });
  if (format === "jpeg") {
    pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  } else if (format === "png") {
    pipeline = pipeline.png({ compressionLevel: 9, quality });
  } else if (format === "webp") {
    pipeline = pipeline.webp({ quality });
  } else {
    pipeline = pipeline.avif({ quality });
  }
  const out = await pipeline.toBuffer();
  return { buffer: out, mime: MIME_BY_FORMAT[format], ext: format };
}

/** Compress an image (keeps format, lowers quality). */
export async function compressImage(
  buf: Buffer,
  format: ImageFormat,
  quality = 70
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  return convertImage(buf, format, quality);
}

/** Resize an image to target dimensions or by percentage. */
export async function resizeImage(
  buf: Buffer,
  opts: { width?: number; height?: number; percent?: number; fit?: "cover" | "contain" | "fill" },
  format: ImageFormat,
  quality = 82
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  let pipeline = sharp(buf);
  if (opts.percent) {
    const meta = await sharp(buf).metadata();
    const w = Math.max(1, Math.round((meta.width ?? 1) * (opts.percent / 100)));
    const h = Math.max(1, Math.round((meta.height ?? 1) * (opts.percent / 100)));
    pipeline = pipeline.resize(w, h, { fit: opts.fit ?? "cover" });
  } else if (opts.width && opts.height) {
    pipeline = pipeline.resize(opts.width, opts.height, { fit: opts.fit ?? "cover" });
  } else if (opts.width) {
    pipeline = pipeline.resize({ width: opts.width, fit: opts.fit ?? "inside" });
  } else if (opts.height) {
    pipeline = pipeline.resize({ height: opts.height, fit: opts.fit ?? "inside" });
  }
  if (format === "jpeg") pipeline = pipeline.jpeg({ quality });
  else if (format === "png") pipeline = pipeline.png();
  else if (format === "webp") pipeline = pipeline.webp({ quality });
  else pipeline = pipeline.avif({ quality });
  const out = await pipeline.toBuffer();
  return { buffer: out, mime: MIME_BY_FORMAT[format], ext: format };
}

/** Crop an image to a region. */
export async function cropImage(
  buf: Buffer,
  opts: { left: number; top: number; width: number; height: number },
  format: ImageFormat,
  quality = 82
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  let pipeline = sharp(buf).extract({
    left: opts.left,
    top: opts.top,
    width: opts.width,
    height: opts.height,
  });
  if (format === "jpeg") pipeline = pipeline.jpeg({ quality });
  else if (format === "png") pipeline = pipeline.png();
  else if (format === "webp") pipeline = pipeline.webp({ quality });
  else pipeline = pipeline.avif({ quality });
  const out = await pipeline.toBuffer();
  return { buffer: out, mime: MIME_BY_FORMAT[format], ext: format };
}

/** Strip all metadata/EXIF for privacy. */
export async function stripMetadata(
  buf: Buffer,
  format: ImageFormat,
  quality = 82
): Promise<{ buffer: Buffer; mime: string; ext: string }> {
  let pipeline = sharp(buf).rotate(); // auto-rotate from EXIF, then drop the rest
  if (format === "jpeg") pipeline = pipeline.jpeg({ quality, mozjpeg: true });
  else if (format === "png") pipeline = pipeline.png();
  else if (format === "webp") pipeline = pipeline.webp({ quality });
  else pipeline = pipeline.avif({ quality });
  const out = await pipeline.toBuffer();
  return { buffer: out, mime: MIME_BY_FORMAT[format], ext: format };
}

/** Detect the format from a mime string. */
export function formatFromMime(mime: string): ImageFormat | null {
  if (mime === "image/jpeg" || mime === "image/jpg") return "jpeg";
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === "image/avif") return "avif";
  return null;
}

/** Pick a sensible output format from the input. */
export function formatFromExt(name: string): ImageFormat | null {
  const ext = extname(name).slice(1).toLowerCase();
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "png") return "png";
  if (ext === "webp") return "webp";
  if (ext === "avif") return "avif";
  return null;
}
