import type { JsonValue } from "./pipeline.js";

export type JobStatus =
  | "pending"
  | "processing"
  | "processed"
  | "failed";

export interface Job {
  id: string;
  pipelineId: string;
  payload: JsonValue;
  stepsSnapshot: JsonValue;
  processedPayload: JsonValue | null;
  status: JobStatus;
  filterReason: string | null;
  attemptCount: number;
  createdAt: Date;
  updatedAt: Date;
  processedAt: Date | null;
}
