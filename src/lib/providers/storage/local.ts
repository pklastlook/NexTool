/**
 * LocalStorageProvider — sandbox/dev implementation.
 *
 * Files live on the local filesystem under tmp/{prefix}/.
 * "Signed URLs" are tokenized /api/download URLs with HMAC signing
 * (so the local mode exercises the same ownership/expiry contract as S3).
 *
 * In production this is replaced by S3StorageProvider — same interface.
 */
import { mkdir, writeFile, readFile, unlink, stat } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import type {
  StorageProvider, UploadOptions, StoredObject, SignedUrlOptions,
} from "./types";

const ROOT = path.join(process.cwd(), "tmp");
const PREFIXES = ["uploads", "outputs", "temporary", "quarantine", "exports"] as const;
const SECRET = process.env.AUTH_SECRET || "nextool-dev-storage-secret";

function signedToken(key: string, expiresAt: number): string {
  return crypto
    .createHmac("sha256", SECRET)
    .update(`${key}:${expiresAt}`)
    .digest("hex");
}

export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  readonly configured = true;

  private resolve(key: string): string {
    // Prevent path traversal — key must be a relative path within ROOT
    const resolved = path.resolve(ROOT, key);
    if (!resolved.startsWith(ROOT + path.sep) && resolved !== ROOT) {
      throw new Error("Path traversal attempt blocked.");
    }
    return resolved;
  }

  async upload(buf: Buffer, name: string, opts: UploadOptions): Promise<StoredObject> {
    const prefix = opts.prefix ?? "uploads";
    if (!PREFIXES.includes(prefix)) throw new Error(`Unknown prefix: ${prefix}`);
    const dir = path.join(ROOT, prefix);
    await mkdir(dir, { recursive: true });
    const safeName = name.replace(/[^\w.-]/g, "_");
    const key = path.join(prefix, `${Date.now()}-${crypto.randomBytes(4).toString("hex")}-${safeName}`);
    const abs = this.resolve(key);
    await writeFile(abs, buf);
    const s = await stat(abs);
    const checksum = crypto.createHash("sha256").update(buf).digest("hex");
    return {
      key,
      size: s.size,
      contentType: opts.contentType,
      checksum,
      etag: checksum.slice(0, 32),
    };
  }

  async download(key: string): Promise<Buffer> {
    return readFile(this.resolve(key));
  }

  async delete(key: string): Promise<void> {
    try { await unlink(this.resolve(key)); } catch { /* idempotent */ }
  }

  async exists(key: string): Promise<boolean> {
    try { await stat(this.resolve(key)); return true; } catch { return false; }
  }

  async metadata(key: string): Promise<StoredObject | null> {
    try {
      const s = await stat(this.resolve(key));
      return { key, size: s.size, contentType: "application/octet-stream" };
    } catch { return null; }
  }

  /**
   * Tokenized signed URL: /api/storage/get?key=...&expires=...&sig=...
   * The /api/storage/get endpoint verifies the HMAC signature and expiry.
   */
  async createDownloadUrl(key: string, filename: string, opts?: SignedUrlOptions): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + (opts?.expiresIn ?? 900);
    const sig = signedToken(key, expiresAt);
    const params = new URLSearchParams({
      key,
      expires: String(expiresAt),
      sig,
      filename,
    });
    if (opts?.responseContentDisposition) {
      params.set("disposition", opts.responseContentDisposition);
    }
    return `/api/storage/get?${params.toString()}`;
  }

  /**
   * In local mode, uploads go through our own /api/storage/put endpoint
   * (which calls this provider's upload()). For S3 mode this would return a
   * real presigned PUT URL.
   */
  async createUploadUrl(key: string, opts?: SignedUrlOptions): Promise<string> {
    const expiresAt = Math.floor(Date.now() / 1000) + (opts?.expiresIn ?? 900);
    const sig = signedToken(key, expiresAt);
    return `/api/storage/put?key=${encodeURIComponent(key)}&expires=${expiresAt}&sig=${sig}`;
  }
}
