import { and, asc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { jobs, pipelineSteps, pipelines } from "../schema.js";
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

async function userOwnsPipeline(userId: string, pipelineId: string): Promise<boolean> {
  const pipeline = await db.query.pipelines.findFirst({
    where: and(
      eq(pipelines.id, pipelineId),
      eq(pipelines.userId, userId),
      eq(pipelines.isActive, true)
    ),
  });

  return Boolean(pipeline);
}

export async function createForUser(
  userId: string,
  input: CreateJobInput
): Promise<Job | null> {
  const ownsPipeline = await userOwnsPipeline(userId, input.pipelineId);

  if (!ownsPipeline) {
    return null;
  }

  return create(input);
}

export async function findByPipelineForUser(
  userId: string,
  pipelineId: string
): Promise<Job[] | null> {
  const ownsPipeline = await userOwnsPipeline(userId, pipelineId);

  if (!ownsPipeline) {
    return null;
  }

  const records = await db
    .select({ job: jobs })
    .from(jobs)
    .innerJoin(pipelines, eq(pipelines.id, jobs.pipelineId))
    .where(
      and(
        eq(jobs.pipelineId, pipelineId),
        eq(pipelines.userId, userId),
        eq(pipelines.isActive, true)
      )
    )
    .orderBy(asc(jobs.createdAt));

  return records.map((record) => toJob(record.job));
}

export async function findByIdForUser(
  userId: string,
  jobId: string
): Promise<Job | null> {
  const records = await db
    .select({ job: jobs })
    .from(jobs)
    .innerJoin(pipelines, eq(pipelines.id, jobs.pipelineId))
    .where(
      and(
        eq(jobs.id, jobId),
        eq(pipelines.userId, userId),
        eq(pipelines.isActive, true)
      )
    )
    .limit(1);

  if (!records.length) {
    return null;
  }

  return toJob(records[0].job);
}
