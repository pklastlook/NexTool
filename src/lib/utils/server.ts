/**
 * Server-side utility helpers — only imported by server code.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { access } from "node:fs/promises";

const pexec = promisify(execFile);

/** Extra PATH entries where binaries like yt-dlp, python tools may live. */
const EXTRA_PATH = [
  "/home/z/.venv/bin",
  "/home/z/.local/bin",
  "/usr/local/bin",
].join(":");

/** Resolve a binary to an absolute path, checking PATH + extra dirs. */
export async function resolveBinary(name: string): Promise<string> {
  // If already absolute and exists, return as-is
  if (name.startsWith("/")) {
    try { await access(name); return name; } catch { /* fall through */ }
  }
  // Try `which` first (uses login PATH)
  try {
    const { stdout } = await pexec("which", [name], { env: { ...process.env, PATH: `${process.env.PATH}:${EXTRA_PATH}` } });
    if (stdout.trim()) return stdout.trim();
  } catch { /* fall through */ }
  // Check extra dirs directly
  for (const dir of EXTRA_PATH.split(":")) {
    const candidate = `${dir}/${name}`;
    try { await access(candidate); return candidate; } catch { /* continue */ }
  }
  return name; // last resort — let execFile throw the real error
}

/** Check whether a binary is on PATH. Never throws. */
export async function isBinaryAvailable(name: string): Promise<boolean> {
  return !!(await resolveBinary(name).catch(() => null)) && (await pexec("which", [name], { env: { ...process.env, PATH: `${process.env.PATH}:${EXTRA_PATH}` } }).then(() => true).catch(() => false));
}

/** Run a binary with args, return trimmed stdout. Throws on non-zero exit. */
export async function runBinary(
  cmd: string,
  args: string[],
  opts: { timeoutMs?: number; cwd?: string } = {}
): Promise<{ stdout: string; stderr: string }> {
  const resolved = await resolveBinary(cmd);
  const { stdout, stderr } = await pexec(resolved, args, {
    timeout: opts.timeoutMs ?? 120000,
    maxBuffer: 100 * 1024 * 1024,
    cwd: opts.cwd,
    env: { ...process.env, PATH: `${process.env.PATH ?? ""}:${EXTRA_PATH}` },
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
