/**
 * S3StorageProvider — production implementation using any S3-compatible
 * service (AWS S3, Cloudflare R2, MinIO, Backblaze B2, Wasabi).
 *
 * Uses the AWS SDK v3 with presigned URLs.
 *
 * NOTE: this implementation is the real architecture. It will be marked
 * NOT_CONFIGURED until STORAGE_ENDPOINT/BUCKET/ACCESS_KEY/SECRET_KEY are set.
 * We never fake a connection.
 */
import {
  S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type {
  StorageProvider, UploadOptions, StoredObject, SignedUrlOptions,
} from "./types";
import crypto from "node:crypto";

const BUCKET = process.env.STORAGE_BUCKET ?? "";
const REGION = process.env.STORAGE_REGION ?? "auto";
const ENDPOINT = process.env.STORAGE_ENDPOINT ?? "";
const ACCESS_KEY = process.env.STORAGE_ACCESS_KEY ?? "";
const SECRET_KEY = process.env.STORAGE_SECRET_KEY ?? "";
const FORCE_PATH_STYLE = process.env.STORAGE_FORCE_PATH_STYLE === "true";

export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  readonly configured: boolean;
  private client: S3Client | null = null;

  constructor() {
    this.configured = !!(BUCKET && ACCESS_KEY && SECRET_KEY);
    if (this.configured) {
      this.client = new S3Client({
        region: REGION,
        endpoint: ENDPOINT || undefined,
        forcePathStyle: FORCE_PATH_STYLE,
        credentials: { accessKeyId: ACCESS_KEY, secretAccessKey: SECRET_KEY },
      });
    }
  }

  private requireClient(): S3Client {
    if (!this.client) {
      throw new Error(
        "S3 storage is not configured. Set STORAGE_ENDPOINT, STORAGE_BUCKET, " +
        "STORAGE_ACCESS_KEY, STORAGE_SECRET_KEY in .env."
      );
    }
    return this.client;
  }

  async upload(buf: Buffer, name: string, opts: UploadOptions): Promise<StoredObject> {
    const client = this.requireClient();
    const prefix = opts.prefix ?? "uploads";
    const safeName = name.replace(/[^\w.-]/g, "_");
    const key = `${prefix}/${new Date().toISOString().slice(0, 10)}/${crypto.randomBytes(4).toString("hex")}-${safeName}`;
    await client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: buf,
      ContentType: opts.contentType,
      Metadata: opts.metadata,
    }));
    const checksum = crypto.createHash("sha256").update(buf).digest("hex");
    return { key, size: buf.length, contentType: opts.contentType, checksum, etag: checksum.slice(0, 32) };
  }

  async download(key: string): Promise<Buffer> {
    const client = this.requireClient();
    const res = await client.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
    if (!res.Body) throw new Error(`Empty body for key: ${key}`);
    // Body is a Readable stream in Node
    const chunks: Buffer[] = [];
    for await (const chunk of res.Body as AsyncIterable<Buffer>) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }

  async delete(key: string): Promise<void> {
    const client = this.requireClient();
    try {
      await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
    } catch { /* idempotent */ }
  }

  async exists(key: string): Promise<boolean> {
    const client = this.requireClient();
    try {
      await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      return true;
    } catch { return false; }
  }

  async metadata(key: string): Promise<StoredObject | null> {
    const client = this.requireClient();
    try {
      const res = await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
      return {
        key, size: res.ContentLength ?? 0,
        contentType: res.ContentType ?? "application/octet-stream",
        etag: res.ETag?.replace(/"/g, ""),
      };
    } catch { return null; }
  }

  async createDownloadUrl(key: string, filename: string, opts?: SignedUrlOptions): Promise<string> {
    const client = this.requireClient();
    return getSignedUrl(
      client,
      new GetObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ResponseContentDisposition: `attachment; filename="${filename}"`,
        ResponseContentType: opts?.responseContentType,
      }),
      { expiresIn: opts?.expiresIn ?? 900 }
    );
  }

  async createUploadUrl(key: string, opts?: SignedUrlOptions): Promise<string> {
    const client = this.requireClient();
    return getSignedUrl(
      client,
      new PutObjectCommand({ Bucket: BUCKET, Key: key }),
      { expiresIn: opts?.expiresIn ?? 900 }
    );
  }
}
