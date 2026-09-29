/**
 * Worker mini-service — Office queue.
 *
 * Tools routed here (see `queueForTool`):
 *   word-to-pdf, excel-to-pdf, powerpoint-to-pdf, xlsx-to-csv, csv-to-xlsx.
 *
 * Real conversions via LibreOffice (convertOffice) and exceljs + papaparse
 * (csv-to-xlsx). No mocks.
 *
 * Run from the main project root so bun loads `.env` and resolves `@/`
 * tsconfig paths:
 *   `bun --hot mini-services/worker-office/index.ts`
 */
import { Worker, type ProcessorFn } from "../../src/lib/queue/worker";
import { newWorkerId } from "../../src/lib/observability/log";
import { convertOffice } from "../../src/lib/processors/office";
import path from "node:path";

const processors: Record<string, ProcessorFn> = {
  "word-to-pdf": async (input) => {
    const r = await convertOffice(input.buf, input.name, "pdf");
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, "pdf"),
      mime: r.mime,
      meta: { inputExt: path.extname(input.name), outputExt: "pdf" },
    };
  },

  "excel-to-pdf": async (input) => {
    const r = await convertOffice(input.buf, input.name, "pdf");
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, "pdf"),
      mime: r.mime,
      meta: { inputExt: path.extname(input.name), outputExt: "pdf" },
    };
  },

  "powerpoint-to-pdf": async (input) => {
    const r = await convertOffice(input.buf, input.name, "pdf");
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, "pdf"),
      mime: r.mime,
      meta: { inputExt: path.extname(input.name), outputExt: "pdf" },
    };
  },

  "xlsx-to-csv": async (input) => {
    const r = await convertOffice(input.buf, input.name, "csv");
    return {
      buffer: r.buffer,
      filename: swapExt(input.name, "csv"),
      mime: r.mime,
      meta: { inputExt: path.extname(input.name), outputExt: "csv" },
    };
  },

  "csv-to-xlsx": async (input) => {
    // Parse CSV (papaparse) and build an XLSX workbook (exceljs).
    const Papa = (await import("papaparse")).default;
    const ExcelJS = (await import("exceljs")).default;

    const text = input.buf.toString("utf-8");
    const parsed = Papa.parse<string[]>(text, { skipEmptyLines: true });
    if (!parsed.data || parsed.data.length === 0) {
      throw new Error("CSV input is empty or could not be parsed.");
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Sheet1");
    for (const row of parsed.data) {
      sheet.addRow(row);
    }

    const buf = await workbook.xlsx.writeBuffer();
    const out = Buffer.from(buf);
    return {
      buffer: out,
      filename: swapExt(input.name || "input.csv", "xlsx"),
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      meta: { rows: parsed.data.length, outputExt: "xlsx" },
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
const workerId = process.env.WORKER_ID || newWorkerId("office");
const worker = new Worker({ workerId, queue: "office", processors });

worker.start().catch((e) => {
  console.error("[worker-office] fatal:", e);
  process.exit(1);
});
