/**
 * Worker mini-service — PDF queue.
 *
 * Runs as a standalone bun process. Instantiates the shared `Worker` class
 * and registers processors for every tool that the queue router assigns to
 * the `pdf` queue (see `src/lib/queue/index.ts` -> `queueForTool`):
 *
 *   merge-pdf, split-pdf, rotate-pdf, compress-pdf, pdf-to-text,
 *   pdf-to-images, invoice-generator, quotation-generator, receipt-generator.
 *
 * Each processor calls the REAL engine in `src/lib/processors/{pdf,documents}.ts`.
 * No mocks. Output is validated and stored by the Worker base class.
 *
 * Run from the main project root so bun loads `.env` and resolves `@/`
 * tsconfig paths:
 *   `bun --hot mini-services/worker-pdf/index.ts`
 */
import { Worker, type ProcessorFn, type ProcessorResult } from "../../src/lib/queue/worker";
import { newWorkerId } from "../../src/lib/observability/log";
import { db } from "../../src/lib/db";
import { getStorageProvider } from "../../src/lib/providers/storage";
import {
  mergePdfs,
  splitPdf,
  rotatePdf,
  compressPdf,
  extractPdfText,
} from "../../src/lib/processors/pdf";
import {
  generatePdfDocument,
  generateDocxDocument,
  type InvoiceData,
} from "../../src/lib/processors/documents";
import { runBinary } from "../../src/lib/utils/server";
import { writeFile, readFile, mkdir, unlink } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// ---------------------------------------------------------------------------
// Helper: load ALL input assets for a job (used by merge-pdf).
// ---------------------------------------------------------------------------
async function loadAllInputBuffers(jobId: string): Promise<{ buf: Buffer; name: string }[]> {
  const assets = await db.fileAsset.findMany({
    where: { inputJobId: jobId, role: "input" },
    orderBy: { createdAt: "asc" },
  });
  if (assets.length === 0) throw new Error("No input file assets found for job.");
  const storage = getStorageProvider();
  const out: { buf: Buffer; name: string }[] = [];
  for (const a of assets) {
    const buf = await storage.download(a.storageKey);
    out.push({ buf, name: a.originalName });
  }
  return out;
}

/** Render the first page of a PDF to a PNG via `pdftoppm` (poppler-utils). */
async function pdfFirstPageToPng(buf: Buffer): Promise<Buffer> {
  const tmp = path.join(os.tmpdir(), `nextool-pdfimg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(tmp, { recursive: true });
  const inputPath = path.join(tmp, "input.pdf");
  const outPrefix = path.join(tmp, "page");
  await writeFile(inputPath, buf);
  try {
    await runBinary("pdftoppm", ["-r", "150", "-png", "-f", "1", "-l", "1", inputPath, outPrefix], {
      timeoutMs: 120_000,
    });
    // pdftoppm writes page-1.png (or page-01.png / page-001.png depending on count)
    const { readdir } = await import("node:fs/promises");
    const files = await readdir(tmp);
    const png = files.find((f) => f.startsWith("page-") && f.endsWith(".png"));
    if (!png) throw new Error("pdftoppm produced no PNG output for the first page.");
    return await readFile(path.join(tmp, png));
  } finally {
    try {
      const { readdir } = await import("node:fs/promises");
      const files = await readdir(tmp);
      await Promise.all(files.map((f) => unlink(path.join(tmp, f)).catch(() => {})));
      await unlink(tmp).catch(() => {});
    } catch { /* ignore */ }
  }
}

// ---------------------------------------------------------------------------
// Processors
// ---------------------------------------------------------------------------
const processors: Record<string, ProcessorFn> = {
  "merge-pdf": async (_input, _options, ctx) => {
    const inputs = await loadAllInputBuffers(ctx.jobId);
    if (inputs.length < 2) throw new Error("Merge requires at least 2 input PDFs.");
    const merged = await mergePdfs(inputs.map((i) => i.buf));
    return {
      buffer: merged,
      filename: "merged.pdf",
      mime: "application/pdf",
      meta: { inputCount: inputs.length, outputSize: merged.length },
    };
  },

  "split-pdf": async (input, options) => {
    const from = numberOpt(options.from) ?? 1;
    const to = numberOpt(options.to);
    const explode = options.explode === true || options.mode === "explode";
    const result = await splitPdf(input.buf, { mode: explode ? "explode" : "range", from, to });
    if ("buffers" in result) {
      // The worker only stores a single output. Return the first page and
      // record the limitation in meta — full explode support requires a
      // multi-output job model that the current Worker doesn't expose.
      const first = result.buffers[0];
      if (!first) throw new Error("Split produced no pages.");
      const meta: Record<string, string | number> = {
        pagesGenerated: result.buffers.length,
        note: "Only the first page is returned via the worker. Use the in-band /api/process route for full explode output.",
      };
      return {
        buffer: first.buffer,
        filename: first.filename,
        mime: "application/pdf",
        meta,
      };
    }
    const meta: Record<string, string | number> = { from, to: to ?? "end" };
    return {
      buffer: result.buffer,
      filename: result.filename,
      mime: result.mime,
      meta,
    };
  },

  "rotate-pdf": async (input, options) => {
    const angleRaw = numberOpt(options.angle) ?? 90;
    const angle = ([90, 180, 270].includes(angleRaw) ? angleRaw : 90) as 90 | 180 | 270;
    const out = await rotatePdf(input.buf, angle);
    return {
      buffer: out,
      filename: "rotated.pdf",
      mime: "application/pdf",
      meta: { angle },
    };
  },

  "compress-pdf": async (input, options) => {
    const levelRaw = typeof options.level === "string" ? options.level : undefined;
    const level = (["low", "medium", "high"].includes(levelRaw ?? "") ? levelRaw : "medium") as
      | "low" | "medium" | "high";
    const out = await compressPdf(input.buf, level);
    const saved = input.buf.length - out.length;
    return {
      buffer: out,
      filename: "compressed.pdf",
      mime: "application/pdf",
      meta: {
        inputSize: input.buf.length,
        outputSize: out.length,
        savedBytes: saved,
        savedPercent: input.buf.length > 0 ? Math.round((saved / input.buf.length) * 100) : 0,
        level,
      },
    };
  },

  "pdf-to-text": async (input) => {
    const { text, pages } = await extractPdfText(input.buf);
    if (!text || text.trim().length === 0) {
      // The PDF likely contains scanned images. Caller should route to OCR.
      throw new Error(
        "No selectable text found in PDF. The file appears to be scanned — use the OCR engine instead."
      );
    }
    return {
      text,
      textFilename: "extracted.txt",
      meta: { pages, characters: text.length },
    };
  },

  "pdf-to-images": async (input, options) => {
    // Render the first page as PNG. Multi-page rendering returns only the
    // first via the worker; documented honestly in meta.
    const page = numberOpt(options.page) ?? 1;
    const png = await pdfFirstPageToPng(input.buf);
    return {
      buffer: png,
      filename: `page-${page}.png`,
      mime: "image/png",
      meta: {
        page,
        note: "Worker returns only the first page. Full page-list output is available via the in-band API.",
      },
    };
  },

  "invoice-generator": async (_input, options) => {
    return await runDocumentGenerator(options, "invoice");
  },
  "quotation-generator": async (_input, options) => {
    return await runDocumentGenerator(options, "quotation");
  },
  "receipt-generator": async (_input, options) => {
    return await runDocumentGenerator(options, "receipt");
  },
};

/** Shared invoice/quotation/receipt processor — reads InvoiceData from options. */
async function runDocumentGenerator(
  options: Record<string, unknown>,
  type: "invoice" | "quotation" | "receipt"
): Promise<ProcessorResult> {
  const data = options.data as InvoiceData | undefined;
  if (!data) throw new Error("Missing options.data (InvoiceData JSON).");
  if (!data.items || data.items.length === 0) throw new Error("InvoiceData must include at least one line item.");
  // Force the document type to match the tool, ignoring whatever the client sent.
  const normalized: InvoiceData = { ...data, type };
  const format = options.format === "docx" ? "docx" : "pdf";
  if (format === "docx") {
    const buf = await generateDocxDocument(normalized);
    return {
      buffer: buf,
      filename: `${type}-${normalized.number || "document"}.docx`,
      mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      meta: { format: "docx", type, number: normalized.number ?? "" },
    };
  }
  const buf = await generatePdfDocument(normalized);
  return {
    buffer: buf,
    filename: `${type}-${normalized.number || "document"}.pdf`,
    mime: "application/pdf",
    meta: { format: "pdf", type, number: normalized.number ?? "" },
  };
}

function numberOpt(v: unknown): number | undefined {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
  return undefined;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------
const workerId = process.env.WORKER_ID || newWorkerId("pdf");
const worker = new Worker({ workerId, queue: "pdf", processors });

worker.start().catch((e) => {
  console.error("[worker-pdf] fatal:", e);
  process.exit(1);
});
