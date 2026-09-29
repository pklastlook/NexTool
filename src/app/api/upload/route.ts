import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

const UPLOAD_DIR = "/home/z/my-project/upload";

function sanitize(name: string): string {
  // Keep it safe but readable. Replace anything that isn't word/space/dot/dash.
  const cleaned = name.replace(/[^\w\s.\-]/g, "_").trim();
  return cleaned.length > 0 ? cleaned : `upload-${Date.now()}.txt`;
}

export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";

    // Ensure upload dir exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    // --- Case 1: multipart file upload ---
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file");

      if (!file || !(file instanceof File)) {
        return NextResponse.json(
          { ok: false, error: "No file field found in form data." },
          { status: 400 }
        );
      }

      const originalName = file.name || `upload-${Date.now()}.txt`;
      const safeName = sanitize(originalName);
      const bytes = Buffer.from(await file.arrayBuffer());
      const dest = path.join(UPLOAD_DIR, safeName);
      await writeFile(dest, bytes);

      const preview = bytes.toString("utf-8").slice(0, 500);
      return NextResponse.json({
        ok: true,
        filename: safeName,
        path: dest,
        size: bytes.length,
        preview,
      });
    }

    // --- Case 2: JSON body with pasted text ---
    if (contentType.includes("application/json")) {
      const body = await req.json().catch(() => null);
      const text = typeof body?.text === "string" ? body.text : "";
      const name = typeof body?.filename === "string" ? body.filename : "";

      if (!text.trim()) {
        return NextResponse.json(
          { ok: false, error: "Empty text received." },
          { status: 400 }
        );
      }

      const base = name ? sanitize(name) : `pasted-${Date.now()}.txt`;
      const safeName = base.endsWith(".txt") ? base : `${base}.txt`;
      const dest = path.join(UPLOAD_DIR, safeName);
      await writeFile(dest, text, "utf-8");

      return NextResponse.json({
        ok: true,
        filename: safeName,
        path: dest,
        size: Buffer.byteLength(text, "utf-8"),
        preview: text.slice(0, 500),
      });
    }

    return NextResponse.json(
      {
        ok: false,
        error:
          "Unsupported content type. Send multipart/form-data with a 'file' field, or application/json with { text, filename }.",
      },
      { status: 415 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    endpoint: "POST /api/upload",
    usage: {
      file: "multipart/form-data with field 'file'",
      text: "application/json with { text: string, filename?: string }",
    },
    targetDir: UPLOAD_DIR,
  });
}
