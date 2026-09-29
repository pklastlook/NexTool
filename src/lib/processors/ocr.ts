/**
 * OCR engine — uses Tesseract via child_process.
 * Real text extraction from images.
 */
import { runBinary } from "@/lib/utils/server";
import { writeFile, readFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface OcrResult {
  text: string;
  confidence: number;
  language: string;
}

/**
 * Run OCR on an image buffer using Tesseract.
 * @param lang Tesseract language code, e.g. "eng", "urd", "ara".
 */
export async function ocrImage(
  buf: Buffer,
  inputName: string,
  lang = "eng"
): Promise<OcrResult> {
  const tmp = path.join(os.tmpdir(), `nextool-ocr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(tmp, { recursive: true });
  const inputPath = path.join(tmp, inputName || "input.png");
  await writeFile(inputPath, buf);
  const outputPathBase = path.join(tmp, "out");

  try {
    // tesseract writes out.txt
    await runBinary("tesseract", [inputPath, outputPathBase, "-l", lang], { timeoutMs: 180000 });
    const text = await readFile(`${outputPathBase}.txt`, "utf-8");
    return { text: text.trim(), confidence: 0, language: lang };
  } catch (e) {
    // If the requested language isn't installed, retry with English
    if (lang !== "eng") {
      return ocrImage(buf, inputName, "eng");
    }
    throw e;
  } finally {
    for (const f of [inputPath, `${outputPathBase}.txt`]) {
      try { await unlink(f); } catch { /* ignore */ }
    }
    try { await unlink(tmp); } catch { /* ignore */ }
  }
}

/**
 * OCR a PDF: render each page to an image (via `pdftoppm` if available),
 * then OCR each. Falls back to text extraction if the PDF has selectable text.
 */
export async function ocrPdf(
  buf: Buffer,
  lang = "eng"
): Promise<{ text: string; pages: number; ocrUsed: boolean }> {
  // First try direct text extraction — much faster for digital PDFs
  try {
    const { extractPdfText } = await import("@/lib/processors/pdf");
    const { text, pages } = await extractPdfText(buf);
    if (text && text.trim().length > 50) {
      return { text, pages, ocrUsed: false };
    }
  } catch {
    // continue to OCR
  }

  // Render PDF pages to images via pdftoppm (poppler-utils), then OCR
  const tmp = path.join(os.tmpdir(), `nextool-pdfocr-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(tmp, { recursive: true });
  const inputPath = path.join(tmp, "input.pdf");
  await writeFile(inputPath, buf);
  const outPrefix = path.join(tmp, "page");

  try {
    await runBinary("pdftoppm", ["-r", "200", "-png", inputPath, outPrefix], { timeoutMs: 180000 });
    const { readdir } = await import("node:fs/promises");
    const files = (await readdir(tmp)).filter((f) => f.startsWith("page-") && f.endsWith(".png")).sort();
    if (files.length === 0) throw new Error("Could not render PDF pages to images.");
    const parts: string[] = [];
    for (const f of files) {
      const imgBuf = await readFile(path.join(tmp, f));
      const r = await ocrImage(imgBuf, f, lang);
      parts.push(r.text);
    }
    return { text: parts.join("\n\n--- page break ---\n\n"), pages: files.length, ocrUsed: true };
  } finally {
    try {
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(tmp);
      await Promise.all(files.map((f) => unlink(path.join(tmp, f)).catch(() => {})));
      await unlink(tmp).catch(() => {});
    } catch { /* ignore */ }
  }
}
