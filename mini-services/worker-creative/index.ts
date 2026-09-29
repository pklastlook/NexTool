/**
 * Worker mini-service — Creative queue.
 *
 * HONEST STATUS: no creative-conversion tools are implemented yet.
 *
 * This worker starts up, registers itself with the workers table, emits a
 * heartbeat, and sits idle. If a job is ever routed to the `creative` queue,
 * the Worker base class will throw "No processor registered for tool ..."
 * and the job will fail honestly — no fake success.
 *
 * When creative tools are implemented (e.g. AI image generation, design
 * templates, social media kits), register their processors in the map below.
 *
 * Run from the main project root so bun loads `.env` and resolves `@/`
 * tsconfig paths:
 *   `bun --hot mini-services/worker-creative/index.ts`
 */
import { Worker, type ProcessorFn } from "../../src/lib/queue/worker";
import { newWorkerId } from "../../src/lib/observability/log";

// Intentionally empty — see header comment.
const processors: Record<string, ProcessorFn> = {};

const workerId = process.env.WORKER_ID || newWorkerId("creative");
const worker = new Worker({ workerId, queue: "creative", processors });

worker.start().then(() => {
  console.log(
    `[${workerId}] creative worker is idle — no creative tools are wired yet. ` +
      `Heartbeating every 5s. Jobs routed here will fail honestly until processors are registered.`
  );
}).catch((e) => {
  console.error("[worker-creative] fatal:", e);
  process.exit(1);
});
