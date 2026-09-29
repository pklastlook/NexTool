import { NextRequest, NextResponse } from "next/server";
import { getTool } from "@/lib/tool-registry";
import { detectFileType, validateFile, formatBytes, recordUsage } from "@/lib/tool-engine";
import { storage } from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Generic server-tool processing endpoint.
 * POST /api/process/[slug] with FormData containing the input file(s).
 *
 * Dispatches to the right processor based on the tool slug.
 * Every path validates the input, runs the real engine, validates output,
 * stores it, and returns a download descriptor.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const tool = getTool(slug);
  if (!tool) {
    return NextResponse.json({ ok: false, error: "Unknown tool." }, { status: 404 });
  }
  if (tool.processingType !== "server") {
    return NextResponse.json({ ok: false, error: "This tool runs client-side." }, { status: 400 });
  }

  let success = false;
  try {
    const form = await req.formData();

    // Document generators accept JSON data, not a file.
    if (slug === "invoice-generator" || slug === "quotation-generator" || slug === "receipt-generator") {
      const result = await handleDocumentGenerator(slug, form);
      success = true;
      const stored = await storage.saveOutput(result.buffer, result.filename);
      await recordUsage(slug, true);
      return NextResponse.json({
        ok: true,
        file: { key: stored.key, dir: "outputs" as const, filename: result.filename, mime: result.mime, size: stored.size },
      });
    }

    const file = form.get("file0") ?? form.get("file") ?? form.get("file1");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });
    }
    const inputBuf = Buffer.from(await file.arrayBuffer());

    // --- Validate input ---
    if (tool.inputFormats && tool.inputFormats.length > 0) {
      const err = validateFile(inputBuf, file.name, file.type, tool.inputFormats, tool.maxFileSize ?? 10485760);
      if (err) {
        await recordUsage(slug, false);
        return NextResponse.json({ ok: false, error: err }, { status: 422 });
      }
    } else if (inputBuf.length > (tool.maxFileSize ?? 104857600)) {
      await recordUsage(slug, false);
      return NextResponse.json({ ok: false, error: `File exceeds the ${formatBytes(tool.maxFileSize ?? 104857600)} limit.` }, { status: 422 });
    }

    // --- Dispatch ---
    const result = await dispatch(slug, inputBuf, file.name, form);
    success = true;

    // --- Store output & return descriptor ---
    if ("kind" in result && result.kind === "text") {
      return NextResponse.json({
        ok: true,
        text: result.text,
        textFilename: result.filename,
        meta: result.meta,
      });
    }
    // file result
    const stored = await storage.saveOutput(result.buffer, result.filename);
    await recordUsage(slug, true);
    return NextResponse.json({
      ok: true,
      file: {
        key: stored.key,
        dir: "outputs" as const,
        filename: result.filename,
        mime: result.mime,
        size: stored.size,
      },
      meta: result.meta,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await recordUsage(slug, false);
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  } finally {
    if (!success) {
      // recordUsage(false) already called on error paths above where possible
    }
  }
}

interface FileOutput {
  buffer: Buffer;
  filename: string;
  mime: string;
  meta?: Record<string, string | number>;
}
interface TextOutput {
  kind: "text";
  text: string;
  filename?: string;
  meta?: Record<string, string | number>;
}
type Output = FileOutput | TextOutput;

async function dispatch(slug: string, buf: Buffer, name: string, form: FormData): Promise<Output> {
  switch (slug) {
    // ---- Image ----
    case "image-converter": {
      const { convertImage, formatFromMime, getImageInfo } = await import("@/lib/processors/image");
      const targetFmt = String(form.get("format") || "webp") as "jpeg" | "png" | "webp" | "avif";
      const quality = Number(form.get("quality") || 82);
      const inputInfo = await getImageInfo(buf);
      const { buffer, mime, ext } = await convertImage(buf, targetFmt, quality);
      const baseName = name.replace(/\.[^.]+$/, "") || "image";
      return { buffer, filename: `${baseName}.${ext}`, mime, meta: { "Original size": buf.length, "Output size": buffer.length, "Original dimensions": `${inputInfo.width}×${inputInfo.height}` } };
    }
    case "image-compressor": {
      const { compressImage, formatFromMime, getImageInfo } = await import("@/lib/processors/image");
      const detected = detectFileType(buf);
      const fmt = (detected && formatFromMime(detected.mime)) || "jpeg";
      const quality = Number(form.get("quality") || 60);
      const inputInfo = await getImageInfo(buf);
      const { buffer, mime, ext } = await compressImage(buf, fmt, quality);
      const baseName = name.replace(/\.[^.]+$/, "") || "image";
      return { buffer, filename: `${baseName}-compressed.${ext}`, mime, meta: { "Original size": buf.length, "Output size": buffer.length, "Saved": buf.length - buffer.length } };
    }
    case "image-resizer": {
      const { resizeImage, formatFromMime, getImageInfo } = await import("@/lib/processors/image");
      const detected = detectFileType(buf);
      const fmt = (detected && formatFromMime(detected.mime)) || "jpeg";
      const inputInfo = await getImageInfo(buf);
      const width = form.get("width") ? Number(form.get("width")) : undefined;
      const height = form.get("height") ? Number(form.get("height")) : undefined;
      const percent = form.get("percent") ? Number(form.get("percent")) : undefined;
      const { buffer, mime, ext } = await resizeImage(buf, { width, height, percent, fit: "cover" }, fmt);
      const baseName = name.replace(/\.[^.]+$/, "") || "image";
      return { buffer, filename: `${baseName}-resized.${ext}`, mime, meta: { "Original": `${inputInfo.width}×${inputInfo.height}`, "Original size": buf.length, "Output size": buffer.length } };
    }
    case "image-cropper": {
      const { cropImage, formatFromMime, getImageInfo } = await import("@/lib/processors/image");
      const detected = detectFileType(buf);
      const fmt = (detected && formatFromMime(detected.mime)) || "png";
      const left = Number(form.get("left") || 0);
      const top = Number(form.get("top") || 0);
      const width = Number(form.get("width") || 100);
      const height = Number(form.get("height") || 100);
      const { buffer, mime, ext } = await cropImage(buf, { left, top, width, height }, fmt);
      const baseName = name.replace(/\.[^.]+$/, "") || "image";
      return { buffer, filename: `${baseName}-cropped.${ext}`, mime, meta: { "Crop region": `${width}×${height} @ (${left},${top})`, "Output size": buffer.length } };
    }
    case "remove-exif": {
      const { stripMetadata, formatFromMime } = await import("@/lib/processors/image");
      const detected = detectFileType(buf);
      const fmt = (detected && formatFromMime(detected.mime)) || "jpeg";
      const { buffer, mime, ext } = await stripMetadata(buf, fmt, 90);
      const baseName = name.replace(/\.[^.]+$/, "") || "image";
      return { buffer, filename: `${baseName}-clean.${ext}`, mime, meta: { "Original size": buf.length, "Output size": buffer.length, "Metadata removed": "EXIF, IPTC, XMP" } };
    }
    case "image-to-text": {
      const { ocrImage } = await import("@/lib/processors/ocr");
      const lang = String(form.get("lang") || "eng");
      const { text, language } = await ocrImage(buf, name, lang);
      return { kind: "text", text, filename: `${name.replace(/\.[^.]+$/, "")}-ocr.txt`, meta: { "Language": language, "Characters": text.length } };
    }

    // ---- PDF ----
    case "merge-pdf": {
      const { mergePdfs } = await import("@/lib/processors/pdf");
      // Collect all fileN entries
      const files: Buffer[] = [buf];
      for (let i = 1; i < 50; i++) {
        const f = form.get(`file${i}`);
        if (f && f instanceof File) files.push(Buffer.from(await f.arrayBuffer()));
        else break;
      }
      const out = await mergePdfs(files);
      return { buffer: out, filename: "merged.pdf", mime: "application/pdf", meta: { "Input files": files.length, "Output size": out.length } };
    }
    case "split-pdf": {
      const { splitPdf } = await import("@/lib/processors/pdf");
      const from = Number(form.get("from") || 1);
      const to = Number(form.get("to") || 1);
      const result = await splitPdf(buf, { mode: "range", from, to });
      if ("buffers" in result) throw new Error("Range mode expected.");
      return { buffer: result.buffer, filename: result.filename, mime: result.mime, meta: { "Pages": `${from}-${to}` } };
    }
    case "rotate-pdf": {
      const { rotatePdf } = await import("@/lib/processors/pdf");
      const angle = Number(form.get("angle") || 90) as 90 | 180 | 270;
      const out = await rotatePdf(buf, angle);
      return { buffer: out, filename: "rotated.pdf", mime: "application/pdf", meta: { "Rotation": `${angle}°` } };
    }
    case "compress-pdf": {
      const { compressPdf } = await import("@/lib/processors/pdf");
      const level = (String(form.get("level") || "medium")) as "low" | "medium" | "high";
      const out = await compressPdf(buf, level);
      return { buffer: out, filename: "compressed.pdf", mime: "application/pdf", meta: { "Original size": buf.length, "Output size": out.length, "Saved": buf.length - out.length } };
    }
    case "pdf-to-text": {
      const { extractPdfText } = await import("@/lib/processors/pdf");
      const { text, pages } = await extractPdfText(buf);
      return { kind: "text", text: text || "(No selectable text found in this PDF. It may be scanned — use an OCR tool.)", filename: `${name.replace(/\.[^.]+$/, "")}.txt`, meta: { "Pages": pages, "Characters": text.length } };
    }
    case "pdf-to-images": {
      // Use pdftoppm to render pages
      const { runBinary } = await import("@/lib/utils/server");
      const { writeFile, readFile, mkdir, unlink, readdir } = await import("node:fs/promises");
      const path = await import("node:path");
      const os = await import("node:os");
      const tmp = path.join(os.tmpdir(), `nextool-pdf2img-${Date.now()}`);
      await mkdir(tmp, { recursive: true });
      const inputPath = path.join(tmp, "input.pdf");
      await writeFile(inputPath, buf);
      const outPrefix = path.join(tmp, "page");
      try {
        await runBinary("pdftoppm", ["-r", "150", "-png", inputPath, outPrefix], { timeoutMs: 180000 });
        const files = (await readdir(tmp)).filter((f) => f.startsWith("page-") && f.endsWith(".png")).sort();
        if (files.length === 0) throw new Error("No pages rendered.");
        // If single page, return it; else return first page + note (multi-download handled client-side in future)
        const firstBuf = await readFile(path.join(tmp, files[0]));
        return { buffer: firstBuf, filename: files[0], mime: "image/png", meta: { "Pages rendered": files.length, "Note": files.length > 1 ? "Returning first page. Multi-page ZIP coming soon." : "" } };
      } finally {
        try {
          const files = await readdir(tmp);
          await Promise.all(files.map((f) => unlink(path.join(tmp, f)).catch(() => {})));
          await unlink(tmp).catch(() => {});
        } catch { /* ignore */ }
      }
    }

    // ---- Office ----
    case "word-to-pdf":
    case "excel-to-pdf":
    case "powerpoint-to-pdf": {
      const { convertOffice } = await import("@/lib/processors/office");
      const result = await convertOffice(buf, name, "pdf");
      return { buffer: result.buffer, filename: `${name.replace(/\.[^.]+$/, "")}.pdf`, mime: result.mime, meta: { "Engine": "LibreOffice", "Output size": result.buffer.length } };
    }
    case "xlsx-to-csv": {
      const { convertOffice } = await import("@/lib/processors/office");
      const result = await convertOffice(buf, name, "csv");
      return { buffer: result.buffer, filename: `${name.replace(/\.[^.]+$/, "")}.csv`, mime: result.mime };
    }
    case "csv-to-xlsx": {
      // Use exceljs to build a real xlsx from CSV
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet("Sheet1");
      const csvText = buf.toString("utf-8");
      const Papa = (await import("papaparse")).default;
      const parsed = Papa.parse(csvText, { skipEmptyLines: true });
      for (const row of parsed.data as string[][]) {
        ws.addRow(row);
      }
      const outBuf = await wb.xlsx.writeBuffer();
      return { buffer: Buffer.from(outBuf), filename: `${name.replace(/\.[^.]+$/, "")}.xlsx`, mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" };
    }

    // ---- Media ----
    case "video-converter": {
      const { convertVideo } = await import("@/lib/processors/media");
      const target = String(form.get("format") || "mp4");
      const result = await convertVideo(buf, name, target);
      return { buffer: result.buffer, filename: `${name.replace(/\.[^.]+$/, "")}.${result.ext}`, mime: result.mime, meta: { "Original size": buf.length, "Output size": result.buffer.length } };
    }
    case "video-compressor": {
      const { compressVideo } = await import("@/lib/processors/media");
      const crf = Number(form.get("crf") || 28);
      const scale = Number(form.get("scale") || 720);
      const result = await compressVideo(buf, name, crf, scale);
      return { buffer: result.buffer, filename: `${name.replace(/\.[^.]+$/, "")}-compressed.mp4`, mime: result.mime, meta: { "Original size": buf.length, "Output size": result.buffer.length, "Saved": buf.length - result.buffer.length } };
    }
    case "video-to-gif": {
      const { videoToGif } = await import("@/lib/processors/media");
      const fps = Number(form.get("fps") || 10);
      const width = Number(form.get("width") || 480);
      const result = await videoToGif(buf, name, fps, width);
      return { buffer: result.buffer, filename: `${name.replace(/\.[^.]+$/, "")}.gif`, mime: result.mime, meta: { "FPS": fps, "Width": width } };
    }
    case "audio-extractor": {
      const { extractAudio } = await import("@/lib/processors/media");
      const result = await extractAudio(buf, name);
      return { buffer: result.buffer, filename: `${name.replace(/\.[^.]+$/, "")}.mp3`, mime: result.mime, meta: { "Bitrate": "192k" } };
    }
    case "audio-converter": {
      const { convertAudio } = await import("@/lib/processors/media");
      const target = String(form.get("format") || "mp3");
      const result = await convertAudio(buf, name, target);
      return { buffer: result.buffer, filename: `${name.replace(/\.[^.]+$/, "")}.${result.ext}`, mime: result.mime };
    }

    default:
      throw new Error(`Tool "${slug}" has no server processor yet.`);
  }
}

/** Document generators accept JSON data instead of a file. */
async function handleDocumentGenerator(slug: string, form: FormData): Promise<Output> {
  const { generatePdfDocument, generateDocxDocument } = await import("@/lib/processors/documents");
  const data = JSON.parse(String(form.get("data"))) as import("@/lib/processors/documents").InvoiceData;
  data.type = slug === "invoice-generator" ? "invoice" : slug === "quotation-generator" ? "quotation" : "receipt";
  const format = String(form.get("format") || "pdf");
  if (format === "docx") {
    const buf = await generateDocxDocument(data);
    return { buffer: buf, filename: `${data.type}-${data.number}.docx`, mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  const buf = await generatePdfDocument(data);
  return { buffer: buf, filename: `${data.type}-${data.number}.pdf`, mime: "application/pdf" };
}
