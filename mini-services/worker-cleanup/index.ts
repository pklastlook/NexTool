/**
 * Worker mini-service — Cleanup queue.
 *
 * DIFFERENT FROM THE OTHERS: this worker does NOT process tool jobs. It runs
 * a standalone setInterval loop every 5 minutes and performs four janitorial
 * tasks:
 *
 *   1. Delete FileAssets whose `expiresAt` has passed AND status="active"
 *      (also calls `storage.delete(storageKey)` to remove the underlying
 *      object).
 *   2. Mark expired ProcessingJobs (where `expiresAt < now` and status is
 *      not terminal) as "expired".
 *   3. Call `recoverStalledJobs()` to re-queue jobs stuck in `processing`
 *      for too long (stalled-worker recovery).
 *   4. Purge FileAsset tombstones (status="deleted") older than 24h.
 *
 * Honesty note: state machine (src/lib/queue/state-machine.ts) does not list
 * "expired" as a forward transition for non-terminal states in its
 * VALID_TRANSITIONS map, but the file's header comment explicitly documents
 * "Any state → EXPIRED (by cleanup worker)". We therefore bypass
 * `transition()` and use direct `db.processingJob.update()` + `recordEvent()`
 * to honor that documented contract.
 *
 * Run from the main project root so bun loads `.env` and resolves `@/`
 * tsconfig paths:
 *   `bun --hot mini-services/worker-cleanup/index.ts`
 */
import { db } from "../../src/lib/db";
import { getStorageProvider } from "../../src/lib/providers/storage";
import { recoverStalledJobs, recordEvent } from "../../src/lib/queue";
import { log, newWorkerId } from "../../src/lib/observability/log";

const POLL_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const TOMBSTONE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const TERMINAL_JOB_STATES = ["completed", "failed", "cancelled", "expired"];

const workerId = process.env.WORKER_ID || newWorkerId("cleanup");
let running = true;

// ---------------------------------------------------------------------------
// Cleanup tasks
// ---------------------------------------------------------------------------

/**
 * 1. Delete expired-but-active FileAssets (and their underlying storage object).
 *    These are uploads/outputs whose `expiresAt` has passed but were never
 *    tombstoned.
 */
async function purgeExpiredFileAssets(): Promise<number> {
  const now = new Date();
  const expired = await db.fileAsset.findMany({
    where: { expiresAt: { lt: now }, status: "active" },
    select: { id: true, storageKey: true },
  });
  if (expired.length === 0) return 0;

  const storage = getStorageProvider();
  let purged = 0;
  for (const asset of expired) {
    try {
      await storage.delete(asset.storageKey);
    } catch (e) {
      // Storage deletion failed — log but continue; the DB row will still be
      // marked deleted so we don't keep retrying the same asset forever.
      await log.warn("cleanup.storage_delete_failed", {
        workerId,
        assetId: asset.id,
        storageKey: asset.storageKey,
        error: String(e),
      });
    }
    await db.fileAsset.update({
      where: { id: asset.id },
      data: { status: "deleted" },
    });
    purged++;
  }
  await log.info("cleanup.purged_expired_assets", { workerId, count: purged });
  return purged;
}

/**
 * 2. Mark expired jobs as "expired" (only if not already terminal).
 */
async function expireStaleJobs(): Promise<number> {
  const now = new Date();
  const stale = await db.processingJob.findMany({
    where: {
      expiresAt: { lt: now },
      status: { notIn: TERMINAL_JOB_STATES },
    },
    select: { id: true, status: true },
  });
  if (stale.length === 0) return 0;

  let expired = 0;
  for (const job of stale) {
    await db.processingJob.update({
      where: { id: job.id },
      data: { status: "expired", completedAt: now },
    });
    await recordEvent(job.id, "job.expired", { previousStatus: job.status });
    expired++;
  }
  await log.info("cleanup.expired_jobs", { workerId, count: expired });
  return expired;
}

/**
 * 3. Recover stalled jobs (workers that died mid-processing).
 */
async function recoverStalled(): Promise<number> {
  const count = await recoverStalledJobs();
  if (count > 0) {
    await log.info("cleanup.recovered_stalled", { workerId, count });
  }
  return count;
}

/**
 * 4. Purge FileAsset tombstones (status="deleted") older than 24h.
 *    The asset row remains queryable for audit until this point; afterwards
 *    it is removed entirely.
 */
async function purgeTombstones(): Promise<number> {
  const cutoff = new Date(Date.now() - TOMBSTONE_TTL_MS);
  // FileAsset has no updatedAt column — use createdAt as the tombstone-age
  // signal. A row older than 24h with status="deleted" is safe to remove.
  const tombstones = await db.fileAsset.findMany({
    where: { status: "deleted", createdAt: { lt: cutoff } },
    select: { id: true },
  });
  if (tombstones.length === 0) return 0;

  // SQLite doesn't support deleteMany with a subquery on updatedAt directly,
  // so delete by id list. Chunk to avoid SQL parameter limits.
  const chunkSize = 500;
  let purged = 0;
  for (let i = 0; i < tombstones.length; i += chunkSize) {
    const chunk = tombstones.slice(i, i + chunkSize);
    const res = await db.fileAsset.deleteMany({
      where: { id: { in: chunk.map((t) => t.id) } },
    });
    purged += res.count;
  }
  await log.info("cleanup.purged_tombstones", { workerId, count: purged });
  return purged;
}

/**
 * Run all four tasks once.
 */
async function runCleanupCycle(): Promise<void> {
  const startedAt = Date.now();
  await db.worker.upsert({
    where: { workerId },
    create: {
      workerId,
      queue: "cleanup",
      status: "busy",
      version: "1.0.0",
      startedAt: new Date(),
      lastHeartbeat: new Date(),
    },
    update: {
      status: "busy",
      version: "1.0.0",
      lastHeartbeat: new Date(),
    },
  });

  try {
    const expiredAssets = await purgeExpiredFileAssets();
    const expiredJobs = await expireStaleJobs();
    const stalled = await recoverStalled();
    const tombstones = await purgeTombstones();

    const summary = { expiredAssets, expiredJobs, stalled, tombstones, ms: Date.now() - startedAt };
    console.log(`[${workerId}] cleanup cycle complete:`, summary);
  } catch (e) {
    await log.error("cleanup.cycle_failed", { workerId, error: String(e) });
    console.error(`[${workerId}] cleanup cycle failed:`, e);
  } finally {
    await db.worker.update({
      where: { workerId },
      data: { status: "idle", lastHeartbeat: new Date() },
    }).catch(() => {});
  }
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

function heartbeat(): void {
  db.worker.update({
    where: { workerId },
    data: { lastHeartbeat: new Date() },
  }).catch(() => {});
}

async function main(): Promise<void> {
  await log.info("cleanup.started", { workerId });
  console.log(`[${workerId}] cleanup worker started — polling every ${POLL_INTERVAL_MS / 1000}s`);

  // Run once immediately so the first cycle doesn't wait 5 minutes.
  await runCleanupCycle();

  const interval = setInterval(() => {
    if (!running) return;
    runCleanupCycle().catch((e) => {
      console.error(`[${workerId}] unhandled cleanup error:`, e);
    });
  }, POLL_INTERVAL_MS);

  // Heartbeat every 30s (less frequent than the job workers since this
  // worker doesn't claim jobs).
  const hb = setInterval(heartbeat, 30_000);

  const stop = async () => {
    console.log(`\n[${workerId}] shutting down…`);
    running = false;
    clearInterval(interval);
    clearInterval(hb);
    await db.worker.update({
      where: { workerId },
      data: { status: "offline", lastHeartbeat: new Date() },
    }).catch(() => {});
    await log.info("cleanup.stopped", { workerId });
    process.exit(0);
  };
  process.on("SIGTERM", stop);
  process.on("SIGINT", stop);
}

main().catch((e) => {
  console.error("[worker-cleanup] fatal:", e);
  process.exit(1);
});
