/**
 * Tool Engine — shared lifecycle abstractions for tools.
 *
 * Per the master prompt, every tool follows:
 *   INPUT -> VALIDATION -> OPTION SELECTION -> PROCESSING ->
 *   OUTPUT VALIDATION -> RESULT -> DOWNLOAD/COPY/SAVE
 *
 * This module provides:
 *  - ToolResult: the canonical result envelope (text or file)
 *  - validators: magic-byte + extension validation helpers
 *  - fileSize: human-readable formatter
 */

import { db } from "@/lib/db";

export interface TextResult {
  kind: "text";
  text: string;
  filename?: string; // suggested download name
  mime?: string;
  meta?: Record<string, string | number>;
}

export interface FileResult {
  kind: "file";
  /** URL-safe path under /api/download?key=...&dir=... */
  key: string;
  dir: "outputs" | "uploads";
  filename: string;
  mime: string;
  size: number;
  meta?: Record<string, string | number>;
}

export type ToolResult = TextResult | FileResult;

export interface ToolError {
  message: string;
  code?: string;
}

// ---------------------------------------------------------------------------
// File validation
// ---------------------------------------------------------------------------

/** Known magic-byte signatures. Extend as needed. */
const SIGNATURES: { ext: string; mime: string; bytes: number[] }[] = [
  { ext: "pdf", mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { ext: "png", mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { ext: "jpg", mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { ext: "gif", mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
  { ext: "webp", mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF (then WEBP at offset 8)
  { ext: "bmp", mime: "image/bmp", bytes: [0x42, 0x4d] },
  { ext: "tiff", mime: "image/tiff", bytes: [0x49, 0x49, 0x2a, 0x00] },
  { ext: "zip", mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] }, // also docx/xlsx/pptx (zip-based)
  { ext: "mp4", mime: "video/mp4", bytes: [0x00, 0x00, 0x00] }, // ftyp box at offset 4
  { ext: "mov", mime: "video/quicktime", bytes: [0x00, 0x00, 0x00, 0x14, 0x66, 0x74, 0x79, 0x70, 0x71, 0x74] },
  { ext: "mp3", mime: "audio/mpeg", bytes: [0x49, 0x44, 0x33] }, // ID3
  { ext: "wav", mime: "audio/wav", bytes: [0x52, 0x49, 0x46, 0x46] },
  { ext: "ogg", mime: "audio/ogg", bytes: [0x4f, 0x67, 0x67, 0x53] },
  { ext: "flac", mime: "audio/flac", bytes: [0x66, 0x4c, 0x61, 0x43] },
];

export interface DetectedFile {
  ext: string;
  mime: string;
}

/** Detect a file's true type from its magic bytes (never trusts the name). */
export function detectFileType(buf: Buffer): DetectedFile | null {
  if (buf.length < 4) return null;
  // Special handling for Office (zip-based) — need to peek inside the zip.
  const isZip = buf.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) ||
    buf.slice(0, 4).equals(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (isZip) {
    // Look for characteristic content-type filenames inside the zip.
    const asText = buf.toString("latin1");
    if (asText.includes("word/")) return { ext: "docx", mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    if (asText.includes("xl/")) return { ext: "xlsx", mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    if (asText.includes("ppt/")) return { ext: "pptx", mime: "application/vnd.openxmlformats-officedocument.presentationml.presentation" };
    return { ext: "zip", mime: "application/zip" };
  }
  // Special: WEBP needs RIFF + WEBP at offset 8
  if (buf.slice(0, 4).equals(Buffer.from([0x52, 0x49, 0x46, 0x46])) &&
      buf.slice(8, 12).equals(Buffer.from([0x57, 0x45, 0x42, 0x50]))) {
    return { ext: "webp", mime: "image/webp" };
  }
  // Special: MP4 ftyp
  if (buf.slice(4, 8).equals(Buffer.from([0x66, 0x74, 0x79, 0x70]))) {
    const brand = buf.slice(8, 12).toString("latin1");
    if (brand.startsWith("qt")) return { ext: "mov", mime: "video/quicktime" };
    if (brand.startsWith("webm")) return { ext: "webm", mime: "video/webm" };
    return { ext: "mp4", mime: "video/mp4" };
  }
  // Match by signature
  for (const sig of SIGNATURES) {
    if (sig.ext === "webp" || sig.ext === "mp4" || sig.ext === "mov") continue; // handled above
    if (buf.slice(0, sig.bytes.length).equals(Buffer.from(sig.bytes))) {
      return { ext: sig.ext, mime: sig.mime };
    }
  }
  return null;
}

/** Validate a file against an allowlist of mimes. Returns error string or null. */
export function validateFile(
  buf: Buffer,
  declaredName: string,
  declaredMime: string,
  allowedMimes: string[],
  maxSize: number
): string | null {
  if (buf.length === 0) return "File is empty.";
  if (buf.length > maxSize) return `File exceeds the ${(maxSize / 1048576).toFixed(0)} MB limit.`;
  const detected = detectFileType(buf);
  if (!detected) return "Could not verify the file type (unknown magic bytes).";
  if (!allowedMimes.some((m) => detected.mime === m || detected.ext === m)) {
    return `File type ${detected.ext} (${detected.mime}) is not supported. Allowed: ${allowedMimes.join(", ")}.`;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(2)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function extOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i + 1).toLowerCase() : "";
}

/** Record a tool usage event (best-effort, never blocks the response). */
export async function recordUsage(slug: string, success: boolean): Promise<void> {
  try {
    const tool = await db.tool.findUnique({ where: { slug } });
    if (!tool) return;
    await db.toolUsage.upsert({
      where: { toolId: tool.id },
      create: {
        toolId: tool.id,
        totalRuns: 1,
        successRuns: success ? 1 : 0,
        failedRuns: success ? 0 : 1,
        lastUsedAt: new Date(),
      },
      update: {
        totalRuns: { increment: 1 },
        successRuns: { increment: success ? 1 : 0 },
        failedRuns: { increment: success ? 0 : 1 },
        lastUsedAt: new Date(),
      },
    });
  } catch {
    // Non-critical — never fail a tool because analytics failed.
  }
}
