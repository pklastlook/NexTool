/**
 * PDF processing engine — uses pdf-lib + Ghostscript.
 * Real merge, split, rotate, compress, text extraction.
 */
import { PDFDocument, degrees } from "pdf-lib";
import { runBinary } from "@/lib/utils/server";
import { writeFile, readFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/** Merge multiple PDFs into one. */
export async function mergePdfs(buffers: Buffer[]): Promise<Buffer> {
  const out = await PDFDocument.create();
  for (const buf of buffers) {
    const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
    const pages = await out.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => out.addPage(p));
  }
  return Buffer.from(await out.save());
}

/** Split a PDF: either a page range or every page as separate PDFs. */
export async function splitPdf(
  buf: Buffer,
  opts: { mode: "range" | "explode"; from?: number; to?: number }
): Promise<{ buffer: Buffer; filename: string; mime: string } | { buffers: { buffer: Buffer; filename: string }[] }> {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  const total = doc.getPageCount();
  if (opts.mode === "explode") {
    const results: { buffer: Buffer; filename: string }[] = [];
    for (let i = 0; i < total; i++) {
      const single = await PDFDocument.create();
      const [page] = await single.copyPages(doc, [i]);
      single.addPage(page);
      results.push({
        buffer: Buffer.from(await single.save()),
        filename: `page-${i + 1}.pdf`,
      });
    }
    return { buffers: results };
  }
  const from = Math.max(1, opts.from ?? 1);
  const to = Math.min(total, opts.to ?? total);
  const sub = await PDFDocument.create();
  const indices: number[] = [];
  for (let i = from - 1; i < to; i++) indices.push(i);
  const pages = await sub.copyPages(doc, indices);
  pages.forEach((p) => sub.addPage(p));
  return {
    buffer: Buffer.from(await sub.save()),
    filename: `pages-${from}-${to}.pdf`,
    mime: "application/pdf",
  };
}

/** Rotate all pages of a PDF by 90/180/270 degrees. */
export async function rotatePdf(buf: Buffer, angle: 90 | 180 | 270): Promise<Buffer> {
  const doc = await PDFDocument.load(buf, { ignoreEncryption: true });
  for (const page of doc.getPages()) {
    const current = page.getRotation().angle;
    page.setRotation(degrees((current + angle) % 360));
  }
  return Buffer.from(await doc.save());
}

/**
 * Compress a PDF using Ghostscript.
 * Writes to a temp file, runs `gs`, reads back.
 */
export async function compressPdf(buf: Buffer, level: "low" | "medium" | "high" = "medium"): Promise<Buffer> {
  const tmp = path.join(os.tmpdir(), `nextool-pdf-${Date.now()}`);
  await mkdir(tmp, { recursive: true });
  const inputPath = path.join(tmp, "input.pdf");
  const outputPath = path.join(tmp, "output.pdf");
  await writeFile(inputPath, buf);

  const quality = level === "high" ? "/screen" : level === "medium" ? "/ebook" : "/printer";
  try {
    await runBinary("gs", [
      "-sDEVICE=pdfwrite",
      "-dCompatibilityLevel=1.4",
      `-dPDFSETTINGS=${quality}`,
      "-dNOPAUSE",
      "-dQUIET",
      "-dBATCH",
      `-sOutputFile=${outputPath}`,
      inputPath,
    ], { timeoutMs: 120000 });
    return await readFile(outputPath);
  } finally {
    // cleanup
    for (const f of [inputPath, outputPath]) {
      try { await unlink(f); } catch { /* ignore */ }
    }
    try { await unlink(path.join(tmp)); } catch { /* ignore */ }
  }
}

/** Extract selectable text from a PDF using pdf-parse. */
export async function extractPdfText(buf: Buffer): Promise<{ text: string; pages: number }> {
  // Dynamic import — pdf-parse has a side effect that reads test files on import
  const mod = await import("pdf-parse");
  const pdfParse = mod.default;
  const data = await pdfParse(buf);
  return { text: data.text, pages: data.numpages };
}
