/**
 * Server-side utility helpers — only imported by server code.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";

const pexec = promisify(execFile);

/** Check whether a binary is on PATH. Never throws. */
export async function isBinaryAvailable(name: string): Promise<boolean> {
  try {
    await pexec("which", [name]);
    return true;
  } catch {
    return false;
  }
}

/** Run a binary with args, return trimmed stdout. Throws on non-zero exit. */
export async function runBinary(
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number; cwd?: string } = {}
): Promise<{ stdout: string; stderr: string }> {
  const { stdout, stderr } = await pexec(cmd, args, {
    timeout: opts.timeoutMs ?? 120000,
    maxBuffer: 50 * 1024 * 1024,
    cwd: opts.cwd,
  });
  return { stdout: stdout.toString().trim(), stderr: stderr.toString().trim() };
}

/** Path exists check. */
export async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}
