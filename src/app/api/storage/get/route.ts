import { NextRequest, NextResponse } from "next/server";
import { getStorageProvider } from "@/lib/providers/storage";
import { recordDownload } from "@/lib/analytics";
import crypto from "node:crypto";

/**
 * Secure download proxy (Prompt2 §54).
 *
 * Verifies the HMAC signature + expiry on the signed URL issued by the
 * storage provider. Path-traversal safe (the storage provider resolves keys
 * within its own root).
 *
 * In S3 mode this endpoint isn't used — the S3 provider returns a direct
 * presigned URL. In local mode this is the download gateway.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const key = url.searchParams.get("key");
  const expires = Number(url.searchParams.get("expires") ?? "0");
  const sig = url.searchParams.get("sig");
  const filename = url.searchParams.get("filename") ?? "download";
  const disposition = url.searchParams.get("disposition") ?? `attachment; filename="${filename}"`;

  if (!key || !sig || !expires) {
    return NextResponse.json({ error: "Missing signed-URL parameters." }, { status: 400 });
  }

  // Verify expiry
  const now = Math.floor(Date.now() / 1000);
  if (now > expires) {
    return NextResponse.json({ error: "Download link has expired." }, { status: 410 });
  }

  // Verify HMAC signature
  const SECRET = process.env.AUTH_SECRET || "nextool-dev-storage-secret";
  const expectedSig = crypto.createHmac("sha256", SECRET).update(`${key}:${expires}`).digest("hex");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 403 });
  }

  try {
    const storage = getStorageProvider();
    const buf = await storage.download(key);
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const mimeMap: Record<string, string> = {
      pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", webp: "image/webp",
      gif: "image/gif", mp4: "video/mp4", webm: "video/webm", mp3: "audio/mpeg",
      txt: "text/plain", csv: "text/csv", json: "application/json",
      xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    };
    const mime = mimeMap[ext] ?? "application/octet-stream";

    // Best-effort analytics (never fail the download because logging failed)
    recordDownload(key).catch(() => {});

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(buf.length),
        "Content-Disposition": disposition,
        "Cache-Control": "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found or expired." }, { status: 404 });
  }
}
