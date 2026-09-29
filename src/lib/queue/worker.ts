/**
 * Worker base class — the universal job-processing loop.
 *
 * Each worker mini-service (worker-pdf, worker-office, etc.) instantiates
 * this with a queue name + processor registry, then calls `.start()`.
 *
 * The loop:
 *   1. Update heartbeat
 *   2. claimNextJob()
 *   3. If job: load inputs from storage, run processor, validate output,
 *      store output, transition job state
 *   4. If no job: sleep briefly, repeat
 *
 * Honors:
 *   - heartbeats (Prompt2 §43, §69)
 *   - job state machine (§15)
 *   - output validation (§53)
 *   - failure handling + retries (§51, §52)
 *   - graceful shutdown (SIGTERM/SIGINT)
 */
import { db } from "@/lib/db";
import {
  claimNextJob, completeJob, failJob, transition, recordEvent,
  type QueueName,
} from "@/lib/queue";
import { getStorageProvider } from "@/lib/providers/storage";
import { getMalwareScanner } from "@/lib/providers/malware";
import { validateOutput } from "@/lib/processors/output-validator";
import { getTool } from "@/lib/tool-registry";
import { log } from "@/lib/observability";

export interface ProcessorResult {
  /** Output buffer + filename + mime for file outputs. */
  buffer?: Buffer;
  filename?: string;
  mime?: string;
  /** OR text output. */
  text?: string;
  textFilename?: string;
  /** Metadata for the job result. */
  meta?: Record<string, string | number>;
}

export type ProcessorFn = (
  input: { buf: Buffer; name: string; mime: string },
  options: Record<string, unknown>,
  ctx: { jobId: string; workerId: string }
) => Promise<ProcessorResult>;

const HEARTBEAT_INTERVAL_MS = 5_000;
const POLL_INTERVAL_MS = 1_000;

export class Worker {
  readonly workerId: string;
  readonly queue: QueueName;
  readonly version: string;
  private processors: Record<string, ProcessorFn>;
  private running = false;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private startedAt: Date | null = null;

  constructor(opts: {
    workerId: string;
    queue: QueueName;
    version?: string;
    processors: Record<string, ProcessorFn>;
  }) {
    this.workerId = opts.workerId;
    this.queue = opts.queue;
    this.version = opts.version ?? "1.0.0";
    this.processors = opts.processors;
  }

  async start(): Promise<void> {
    if (this.running) return;
    this.running = true;
    this.startedAt = new Date();

    // Register worker row
    await db.worker.upsert({
      where: { workerId: this.workerId },
      create: {
        workerId: this.workerId,
        queue: this.queue,
        status: "idle",
        version: this.version,
        startedAt: this.startedAt,
        lastHeartbeat: new Date(),
      },
      update: {
        status: "idle",
        version: this.version,
        startedAt: this.startedAt,
        lastHeartbeat: new Date(),
      },
    });
    await log.info("worker.started", { workerId: this.workerId, queue: this.queue });
    console.log(`[${this.workerId}] worker started on queue "${this.queue}"`);

    // Heartbeat loop
    this.heartbeatTimer = setInterval(() => this.heartbeat(), HEARTBEAT_INTERVAL_MS);

    // Graceful shutdown
    const stop = async () => {
      console.log(`\n[${this.workerId}] shutting down…`);
      await this.stop();
      process.exit(0);
    };
    process.on("SIGTERM", stop);
    process.on("SIGINT", stop);

    // Job loop (non-blocking)
    this.loop().catch((e) => {
      console.error(`[${this.workerId}] fatal loop error:`, e);
      process.exit(1);
    });
  }

  async stop(): Promise<void> {
    this.running = false;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    await db.worker.update({
      where: { workerId: this.workerId },
      data: { status: "offline", lastHeartbeat: new Date() },
    }).catch(() => {});
    await log.info("worker.stopped", { workerId: this.workerId });
  }

  private async heartbeat(): Promise<void> {
    await db.worker.update({
      where: { workerId: this.workerId },
      data: { lastHeartbeat: new Date() },
    }).catch(() => {});
  }

  private async loop(): Promise<void> {
    while (this.running) {
      try {
        const job = await claimNextJob(this.queue, this.workerId);
        if (!job) {
          await sleep(POLL_INTERVAL_MS);
          continue;
        }
        await this.processJob(job);
      } catch (e) {
        await log.error("worker.loop_error", { workerId: this.workerId, error: String(e) });
        await sleep(POLL_INTERVAL_MS);
      }
    }
  }

  private async processJob(job: { id: string; toolId: string; options: Record<string, unknown> | null; userId: string | null }): Promise<void> {
    await db.worker.update({ where: { workerId: this.workerId }, data: { status: "busy", currentJobId: job.id } });
    await log.info("worker.job_started", { workerId: this.workerId, jobId: job.id, toolId: job.toolId });
    console.log(`[${this.workerId}] processing job ${job.id} (tool: ${job.toolId})`);

    try {
      // Resolve tool slug from id
      const toolRow = await db.tool.findUnique({ where: { id: job.toolId } });
      if (!toolRow) throw new Error(`Tool ${job.toolId} not found in registry.`);
      const tool = getTool(toolRow.slug);
      if (!tool) throw new Error(`Tool ${toolRow.slug} not in tool registry.`);

      // Find processor
      const processor = this.processors[toolRow.slug];
      if (!processor) throw new Error(`No processor registered for tool "${toolRow.slug}" on queue "${this.queue}".`);

      // Load the input file from storage
      const inputAsset = await db.fileAsset.findFirst({
        where: { inputJobId: job.id, role: "input" },
        orderBy: { createdAt: "asc" },
      });
      if (!inputAsset) throw new Error("No input file asset found for job.");
      const storage = getStorageProvider();
      const inputBuf = await storage.download(inputAsset.storageKey);

      // Optional malware scan (only if configured — honest skip otherwise)
      await transition(job.id, "scanning");
      const scanner = await getMalwareScanner();
      if (scanner.configured) {
        const scan = await scanner.scan(inputBuf, inputAsset.originalName);
        await db.fileAsset.update({ where: { id: inputAsset.id }, data: { scanStatus: scan.status } });
        if (scan.status === "infected" || scan.status === "suspicious") {
          await failJob(job.id, "malware_detected", `File flagged as ${scan.status}: ${scan.detail}`, false);
          return;
        }
      } else {
        await db.fileAsset.update({ where: { id: inputAsset.id }, data: { scanStatus: "skipped" } });
      }

      // Process
      await transition(job.id, "processing");
      const result = await processor(
        { buf: inputBuf, name: inputAsset.originalName, mime: inputAsset.detectedMimeType ?? inputAsset.mimeType },
        job.options ?? {},
        { jobId: job.id, workerId: this.workerId }
      );

      // Validate output
      await transition(job.id, "validating_output");
      if (result.buffer) {
        const validation = validateOutput(result.buffer, result.filename ?? "output", {
          expectedMimes: tool.outputFormats,
          requireMagicMatch: false,
          maxSizeBytes: 524288000, // 500MB hard cap
        });
        if (!validation.valid) {
          await failJob(job.id, "output_validation_failed", validation.errors.join("; "), false);
          return;
        }
        // Store output
        const stored = await storage.upload(result.buffer, result.filename ?? "output", {
          contentType: result.mime ?? "application/octet-stream",
          prefix: "outputs",
        });
        await db.fileAsset.create({
          data: {
            userId: job.userId,
            originalName: result.filename ?? "output",
            safeName: (result.filename ?? "output").replace(/[^\w.-]/g, "_"),
            mimeType: result.mime ?? "application/octet-stream",
            detectedMimeType: validation.detected?.mime,
            extension: (result.filename ?? "output").split(".").pop() ?? "",
            size: result.buffer.length,
            checksum: stored.checksum,
            storageKey: stored.key,
            storagePath: stored.key,
            role: "output",
            outputJobId: job.id,
            scanStatus: "skipped", // outputs are trusted — generated by us
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h
            status: "active",
          },
        });
        await completeJob(job.id, { ...result.meta, outputKey: stored.key, outputSize: result.buffer.length });
      } else if (result.text != null) {
        const textBuf = Buffer.from(result.text, "utf-8");
        const stored = await storage.upload(textBuf, result.textFilename ?? "output.txt", {
          contentType: "text/plain",
          prefix: "outputs",
        });
        await db.fileAsset.create({
          data: {
            userId: job.userId,
            originalName: result.textFilename ?? "output.txt",
            safeName: (result.textFilename ?? "output.txt").replace(/[^\w.-]/g, "_"),
            mimeType: "text/plain",
            detectedMimeType: "text/plain",
            extension: "txt",
            size: textBuf.length,
            checksum: stored.checksum,
            storageKey: stored.key,
            storagePath: stored.key,
            role: "output",
            outputJobId: job.id,
            scanStatus: "skipped",
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            status: "active",
          },
        });
        await completeJob(job.id, { ...result.meta, outputKey: stored.key, outputSize: textBuf.length });
      } else {
        await failJob(job.id, "no_output", "Processor returned no output buffer or text.", false);
      }

      await log.info("worker.job_completed", { workerId: this.workerId, jobId: job.id });
      console.log(`[${this.workerId}] ✓ job ${job.id} completed`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const retriable = !isNonRetriable(msg);
      await failJob(job.id, "processing_error", msg, retriable);
      await log.error("worker.job_failed", { workerId: this.workerId, jobId: job.id, error: msg, retriable });
      console.error(`[${this.workerId}] ✗ job ${job.id} failed: ${msg}`);
    } finally {
      await db.worker.update({
        where: { workerId: this.workerId },
        data: { status: "idle", currentJobId: null },
      }).catch(() => {});
    }
  }
}

function isNonRetriable(msg: string): boolean {
  const patterns = [
    /unsupported.*format/i,
    /corrupt/i,
    /invalid.*file/i,
    /malware/i,
    /infected/i,
    /invalid.*parameter/i,
    /illegal.*state/i,
    /output.*validation/i,
    /magic bytes/i,
  ];
  return patterns.some((p) => p.test(msg));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
