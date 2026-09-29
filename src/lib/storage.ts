/**
 * Local filesystem storage provider for the sandbox.
 * In production this would be replaced by S3StorageProvider implementing the
 * same interface. The interface keeps the rest of the app provider-agnostic.
 */
import { mkdir, writeFile, readFile, unlink, stat } from "node:fs/promises";
import path from "node:path";

const UPLOAD_DIR = path.join(process.cwd(), "tmp", "uploads");
const OUTPUT_DIR = path.join(process.cwd(), "tmp", "outputs");

export interface StoredFile {
  key: string; // internal storage key
  absPath: string;
  size: number;
}

export const storage = {
  async saveUpload(buf: Buffer, name: string): Promise<StoredFile> {
    await mkdir(UPLOAD_DIR, { recursive: true });
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name.replace(/[^\w.-]/g, "_")}`;
    const absPath = path.join(UPLOAD_DIR, key);
    await writeFile(absPath, buf);
    const s = await stat(absPath);
    return { key, absPath, size: s.size };
  },
  async saveOutput(buf: Buffer, name: string): Promise<StoredFile> {
    await mkdir(OUTPUT_DIR, { recursive: true });
    const key = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${name.replace(/[^\w.-]/g, "_")}`;
    const absPath = path.join(OUTPUT_DIR, key);
    await writeFile(absPath, buf);
    const s = await stat(absPath);
    return { key, absPath, size: s.size };
  },
  async read(key: string, dir: "uploads" | "outputs"): Promise<Buffer> {
    const base = dir === "uploads" ? UPLOAD_DIR : OUTPUT_DIR;
    return readFile(path.join(base, key));
  },
  async remove(key: string, dir: "uploads" | "outputs"): Promise<void> {
    const base = dir === "uploads" ? UPLOAD_DIR : OUTPUT_DIR;
    try { await unlink(path.join(base, key)); } catch { /* idempotent */ }
  },
  uploadsDir: UPLOAD_DIR,
  outputsDir: OUTPUT_DIR,
};
