import { asc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { jobs, pipelines, pipelineSteps } from "../schema.js";
import type { Job, JobStatus } from "../../types/job.js";
import type { JsonValue } from "../../types/pipeline.js";

interface CreateJobInput {
  pipelineId: string;
  payload: JsonValue;
}

interface UpdateJobStatusInput {
  status: JobStatus;
  processedPayload?: JsonValue | null;
  filterReason?: string | null;
  attemptCount?: number;
  processedAt?: Date | null;
}

function toJob(record: typeof jobs.$inferSelect): Job {
  return {
    id: record.id,
    pipelineId: record.pipelineId,
    payload: record.payload as JsonValue,
    stepsSnapshot: record.stepsSnapshot as JsonValue,
    processedPayload: (record.processedPayload as JsonValue | null) ?? null,
    status: record.status as JobStatus,
    filterReason: record.filterReason,
    attemptCount: record.attemptCount,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    processedAt: record.processedAt,
  };
}

export async function create(input: CreateJobInput): Promise<Job> {
  return db.transaction(async (tx) => {
    const steps = await tx
      .select()
      .from(pipelineSteps)
      .where(eq(pipelineSteps.pipelineId, input.pipelineId))
      .orderBy(asc(pipelineSteps.order));

    const [record] = await tx
      .insert(jobs)
      .values({
        pipelineId: input.pipelineId,
        payload: input.payload,
        stepsSnapshot: steps.map((step) => ({
          id: step.id,
          type: step.type,
          config: step.config,
          order: step.order,
        })),
      })
      .returning();

    return toJob(record);
  });
}

export async function findPending(limit = 10): Promise<Job[]> {
  const records = await db
    .select()
    .from(jobs)
    .where(eq(jobs.status, "pending"))
    .orderBy(asc(jobs.createdAt))
    .limit(limit)
    .for("update", { skipLocked: true });

  return records.map(toJob);
}

export async function updateStatus(
  jobId: string,
  input: UpdateJobStatusInput
): Promise<Job | null> {
  const [record] = await db
    .update(jobs)
    .set({
      status: input.status,
      processedPayload: input.processedPayload,
      filterReason: input.filterReason,
      attemptCount: input.attemptCount,
      processedAt: input.processedAt,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId))
    .returning();

  return record ? toJob(record) : null;
}

export async function findByPipelineUsername(username: string): Promise<Job[]> {
  const records = await db
    .select({ job: jobs })
    .from(jobs)
    .innerJoin(pipelines, eq(jobs.pipelineId, pipelines.id))
    .where(eq(pipelines.username, username))
    .orderBy(asc(jobs.createdAt));

  return records.map((record) => toJob(record.job));
}
