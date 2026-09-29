/**
 * Office conversion engine — uses LibreOffice headless.
 * Real conversions via `soffice --headless --convert-to`.
 */
import { runBinary } from "@/lib/utils/server";
import { writeFile, readFile, mkdir, unlink, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export interface OfficeConvertResult {
  buffer: Buffer;
  ext: string;
  mime: string;
}

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  csv: "text/csv",
  html: "text/html",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  odt: "application/vnd.oasis.opendocument.text",
  ods: "application/vnd.oasis.opendocument.spreadsheet",
  odp: "application/vnd.oasis.opendocument.presentation",
  rtf: "application/rtf",
  png: "image/png",
  jpg: "image/jpeg",
};

/**
 * Convert an Office file to the target format using LibreOffice.
 * Writes input to a temp dir, runs soffice, reads the output.
 */
export async function convertOffice(
  buf: Buffer,
  inputName: string,
  targetExt: string
): Promise<OfficeConvertResult> {
  const tmp = path.join(os.tmpdir(), `nextool-office-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  await mkdir(tmp, { recursive: true });
  const inputPath = path.join(tmp, inputName);
  await writeFile(inputPath, buf);

  // LibreOffice uses a filter string: e.g. pdf, csv, xlsx
  const filter = targetExt;

  try {
    // Use --convert-to with explicit output dir. Run with a user profile dir
    // to avoid conflicts with concurrent runs.
    const profileDir = path.join(tmp, "profile");
    await runBinary("soffice", [
      "--headless",
      "--norestore",
      "--nologo",
      "--nolockcheck",
      `-env:UserInstallation=file://${profileDir}`,
      `--convert-to`,
      filter,
      `--outdir`,
      tmp,
      inputPath,
    ], { timeoutMs: 120000 });

    // Find the output file (same base name, new extension)
    const baseName = path.basename(inputName, path.extname(inputName));
    const expectedOutput = path.join(tmp, `${baseName}.${targetExt}`);
    let outputPath = expectedOutput;
    // If not found, look for any file with the target ext in the dir
    try {
      await readFile(outputPath);
    } catch {
      const files = await readdir(tmp);
      const match = files.find((f) => f.endsWith(`.${targetExt}`));
      if (!match) throw new Error(`Conversion produced no ${targetExt} output. LibreOffice may not support this conversion.`);
      outputPath = path.join(tmp, match);
    }

    const outBuf = await readFile(outputPath);
    return {
      buffer: outBuf,
      ext: targetExt,
      mime: MIME_BY_EXT[targetExt] ?? "application/octet-stream",
    };
  } finally {
    // Best-effort cleanup of the whole temp dir
    try {
      const files = await readdir(tmp);
      await Promise.all(files.map((f) => unlink(path.join(tmp, f)).catch(() => {})));
      await unlink(tmp).catch(() => {});
    } catch { /* ignore */ }
  }
}
