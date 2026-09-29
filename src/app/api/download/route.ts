import { NextRequest, NextResponse } from "next/server";
import { storage } from "@/lib/storage";

/**
 * Secure download endpoint.
 * Files are served from the local tmp/outputs or tmp/uploads dir by key.
 * In production this would be a signed S3 URL with expiry.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const dir = (url.searchParams.get("dir") as "outputs" | "uploads") || "outputs";
  const filename = url.searchParams.get("filename") || "download";

  if (!key || !/^[a-zA-Z0-9._-]+$/.test(key)) {
    return NextResponse.json({ error: "Invalid key." }, { status: 400 });
  }
  if (dir !== "outputs" && dir !== "uploads") {
    return NextResponse.json({ error: "Invalid dir." }, { status: 400 });
  }

  try {
    const buf = await storage.read(key, dir);
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg", jpeg: "image/jpeg",
      webp: "image/webp", gif: "image/gif",
      mp4: "video/mp4", webm: "video/webm", mov: "video/quicktime",
      mp3: "audio/mpeg", wav: "audio/wav",
      txt: "text/plain", csv: "text/csv", html: "text/html",
      json: "application/json",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      zip: "application/zip",
    };
    const mime = mimeMap[ext] || "application/octet-stream";

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Content-Disposition": `attachment; filename="${filename.replace(/"/g, "_")}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found or expired." }, { status: 404 });
  }
}
