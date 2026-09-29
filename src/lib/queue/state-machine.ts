/**
 * Job state machine (Prompt2 §15, §16, §41, §51-53).
 *
 * Strict states with valid transitions only.
 * COMPLETED → PROCESSING must never happen.
 *
 *   CREATED
 *     ↓
 *   QUEUED
 *     ↓
 *   VALIDATING  ←→  SCANNING
 *     ↓
 *   PROCESSING
 *     ↓
 *   VALIDATING_OUTPUT
 *     ↓
 *   COMPLETED  |  FAILED  |  CANCELLED
 *
 * Any state → EXPIRED (by cleanup worker)
 */

export type JobState =
  | "created"
  | "queued"
  | "validating"
  | "scanning"
  | "processing"
  | "validating_output"
  | "completed"
  | "failed"
  | "cancelled"
  | "expired";

/** Valid forward transitions. Any transition not in this map is illegal. */
const VALID_TRANSITIONS: Record<JobState, JobState[]> = {
  created:           ["queued", "cancelled"],
  queued:            ["validating", "processing", "cancelled", "failed"],
  validating:        ["scanning", "processing", "failed", "cancelled"],
  scanning:          ["processing", "failed", "cancelled"],
  processing:        ["validating_output", "failed", "cancelled"],
  validating_output: ["completed", "failed", "cancelled"],
  completed:         [], // terminal
  failed:            ["queued"], // retry path only
  cancelled:         [], // terminal
  expired:           [], // terminal
};

export function canTransition(from: JobState, to: JobState): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function assertTransition(from: JobState, to: JobState): void {
  if (!canTransition(from, to)) {
    throw new Error(`Illegal job state transition: ${from} → ${to}`);
  }
}

/** Job event types (Prompt2 §16). */
export type JobEventType =
  | "job.created"
  | "job.queued"
  | "job.validating"
  | "job.scanning"
  | "job.started"
  | "job.processing"
  | "job.output_validated"
  | "job.completed"
  | "job.failed"
  | "job.cancelled"
  | "job.expired"
  | "job.retrying"
  | "job.dead_lettered";

export const TERMINAL_STATES: JobState[] = ["completed", "failed", "cancelled", "expired"];

/** Map a JobState to the canonical event name. */
export function eventForState(state: JobState): JobEventType {
  switch (state) {
    case "created": return "job.created";
    case "queued": return "job.queued";
    case "validating": return "job.validating";
    case "scanning": return "job.scanning";
    case "processing": return "job.started";
    case "validating_output": return "job.output_validated";
    case "completed": return "job.completed";
    case "failed": return "job.failed";
    case "cancelled": return "job.cancelled";
    case "expired": return "job.expired";
  }
}
