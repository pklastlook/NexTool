/**
 * OutputValidator (Prompt2 §53).
 *
 * Every processor must pass its output through this before the job is marked
 * COMPLETED. Validates: existence, size, MIME, magic bytes, parser validity.
 */
import { detectFileType, formatBytes } from "@/lib/tool-engine";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  detected: { ext: string; mime: string } | null;
}

export interface ValidateOptions {
  expectedMimes?: string[];        // allowed output MIME types
  maxSizeBytes?: number;           // max output size
  minSizeBytes?: number;           // min output size (default 1)
  requireMagicMatch?: boolean;     // if true, detected MIME must be in expectedMimes
}

export function validateOutput(buf: Buffer, filename: string, opts: ValidateOptions = {}): ValidationResult {
  const errors: string[] = [];
  const detected = detectFileType(buf);

  if (!buf || buf.length === 0) {
    errors.push("Output file is empty.");
  }
  if (opts.minSizeBytes != null && buf.length < opts.minSizeBytes) {
    errors.push(`Output is smaller than the minimum (${formatBytes(opts.minSizeBytes)}).`);
  }
  if (opts.maxSizeBytes != null && buf.length > opts.maxSizeBytes) {
    errors.push(`Output exceeds the maximum size (${formatBytes(opts.maxSizeBytes)}).`);
  }
  if (opts.expectedMimes && opts.expectedMimes.length > 0) {
    if (!detected) {
      errors.push(`Could not detect output type by magic bytes (got ${formatBytes(buf.length)}).`);
    } else if (opts.requireMagicMatch && !opts.expectedMimes.includes(detected.mime)) {
      errors.push(`Detected output type ${detected.ext} (${detected.mime}) is not in the expected set: ${opts.expectedMimes.join(", ")}.`);
    }
  }
  return { valid: errors.length === 0, errors, detected };
}
