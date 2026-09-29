/**
 * Storage provider factory.
 *
 * Selects the active provider based on environment variables.
 * - If S3 env vars are set -> S3StorageProvider (production)
 * - Otherwise              -> LocalStorageProvider (sandbox/dev)
 *
 * The rest of the app talks only to the StorageProvider interface.
 */
import type { StorageProvider } from "./types";
import { LocalStorageProvider } from "./local";
import { S3StorageProvider } from "./s3";

let cached: StorageProvider | null = null;

export function getStorageProvider(): StorageProvider {
  if (cached) return cached;
  const s3 = new S3StorageProvider();
  if (s3.configured) {
    cached = s3;
  } else {
    cached = new LocalStorageProvider();
  }
  return cached;
}

export type { StorageProvider, UploadOptions, StoredObject, SignedUrlOptions } from "./types";
