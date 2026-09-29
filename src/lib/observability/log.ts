/**
 * Structured logging (Prompt2 §40, §41).
 *
 * Emits JSON logs with: timestamp, level, service, environment, requestId,
 * userId, jobId, toolId, duration, errorCode, message.
 *
 * In production with SENTRY_DSN set, errors are also forwarded to Sentry.
 * We NEVER log secrets, passwords, file contents, or full tokens.
 */
import { env } from "@/lib/env";

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  userId?: string;
  jobId?: string;
  toolId?: string;
  workerId?: string;
  duration?: number;
  errorCode?: string;
  [k: string]: unknown;
}

const LEVELS: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };
const MIN_LEVEL: LogLevel = (env.LOG_LEVEL as LogLevel) || "info";

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[MIN_LEVEL];
}

function emit(level: LogLevel, message: string, ctx: LogContext = {}): void {
  if (!shouldLog(level)) return;
  const record = {
    timestamp: new Date().toISOString(),
    level,
    service: "nextool",
    environment: env.NODE_ENV || "development",
    message,
    ...sanitizeContext(ctx),
  };
  const line = JSON.stringify(record);
  if (level === "error") process.stderr.write(line + "\n");
  else process.stdout.write(line + "\n");

  // Sentry forwarding is handled by instrumentation.ts (Sentry SDK auto-captures
  // exceptions and console.error). We don't duplicate that here to avoid
  // leaking secrets via the SDK's default scrubbing gaps.
}

function sanitizeContext(ctx: LogContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (/secret|password|token|apikey|authorization/i.test(k)) {
      out[k] = "[redacted]";
    } else {
      out[k] = v;
    }
  }
  return out;
}

export const log = {
  debug: (msg: string, ctx?: LogContext) => emit("debug", msg, ctx),
  info: (msg: string, ctx?: LogContext) => emit("info", msg, ctx),
  warn: (msg: string, ctx?: LogContext) => emit("warn", msg, ctx),
  error: (msg: string, ctx?: LogContext) => emit("error", msg, ctx),
};

/** Generate a short request ID like REQ-71F2. */
export function newRequestId(): string {
  const rand = Math.random().toString(16).slice(2, 6).toUpperCase();
  return `REQ-${rand}`;
}

/** Generate a short job ID like JOB-82A91. */
export function newJobId(): string {
  const rand = Math.random().toString(16).slice(2, 7).toUpperCase();
  return `JOB-${rand}`;
}

/** Generate a short worker ID like OFFICE-03. */
export function newWorkerId(queue: string): string {
  const rand = Math.floor(Math.random() * 99).toString().padStart(2, "0");
  return `${queue.toUpperCase()}-${rand}`;
}
