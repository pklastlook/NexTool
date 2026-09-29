/**
 * StorageProvider interface (Prompt2 §4, §7, §8).
 *
 * Two implementations:
 *  - LocalStorageProvider  — sandbox / dev
 *  - S3StorageProvider     — production (any S3-compatible service)
 *
 * The app talks only to the interface; the active provider is selected in
 * `getStorageProvider()` based on env vars. Switching providers requires NO
 * changes anywhere else in the app.
 */

export interface UploadOptions {
  contentType: string;
  prefix?: "uploads" | "outputs" | "temporary" | "quarantine" | "exports";
  metadata?: Record<string, string>;
}

export interface StoredObject {
  key: string;
  size: number;
  contentType: string;
  etag?: string;
  checksum?: string;
}

export interface SignedUrlOptions {
  expiresIn?: number;
  responseContentType?: string;
  responseContentDisposition?: string;
}

export interface StorageProvider {
  readonly name: string;
  readonly configured: boolean;
  upload(buf: Buffer, name: string, opts: UploadOptions): Promise<StoredObject>;
  download(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  metadata(key: string): Promise<StoredObject | null>;
  createDownloadUrl(key: string, filename: string, opts?: SignedUrlOptions): Promise<string>;
  createUploadUrl(key: string, opts?: SignedUrlOptions): Promise<string>;
}
