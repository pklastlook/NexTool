/**
 * Barrel re-export so callers can `import { log, newWorkerId } from "@/lib/observability"`.
 *
 * The implementations live in `./log.ts`. This file exists because several
 * already-written modules (notably `src/lib/queue/worker.ts`) use the
 * `@/lib/observability` path — without a barrel here bun cannot resolve
 * the import at runtime.
 */
export { log, newRequestId, newJobId, newWorkerId } from "./log";
export type { LogLevel, LogContext } from "./log";
