import { and, asc, eq } from "drizzle-orm";
import type { JsonValue, PipelineStep, StepType } from "../../types/pipeline.js";
import { db } from "../client.js";
import { pipelineSteps, pipelines } from "../schema.js";

interface CreatePipelineStepInput {
  pipelineId: string;
  type: StepType;
  config: JsonValue;
  order: number;
}

interface UpdatePipelineStepInput {
  type?: StepType;
  config?: JsonValue;
  order?: number;
}

function toPipelineStep(record: typeof pipelineSteps.$inferSelect): PipelineStep {
  return {
    id: record.id,
    pipelineId: record.pipelineId,
    type: record.type as StepType,
    config: record.config as JsonValue,
    order: record.order,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

async function userOwnsPipeline(userId: string, pipelineId: string): Promise<boolean> {
  const record = await db.query.pipelines.findFirst({
    where: and(
      eq(pipelines.id, pipelineId),
      eq(pipelines.userId, userId),
      eq(pipelines.isActive, true)
    ),
  });

  return Boolean(record);
}

export async function createPipelineStep(
  userId: string,
  input: CreatePipelineStepInput
): Promise<PipelineStep | null> {
  const ownsPipeline = await userOwnsPipeline(userId, input.pipelineId);

  if (!ownsPipeline) {
    return null;
  }

  const [record] = await db
    .insert(pipelineSteps)
    .values({
      pipelineId: input.pipelineId,
      type: input.type,
      config: input.config,
      order: input.order,
    })
    .returning();

  return toPipelineStep(record);
}

export async function getPipelineStepsByPipeline(
  userId: string,
  pipelineId: string
): Promise<PipelineStep[] | null> {
  const ownsPipeline = await userOwnsPipeline(userId, pipelineId);

  if (!ownsPipeline) {
    return null;
  }

  const records = await db
    .select()
    .from(pipelineSteps)
    .where(eq(pipelineSteps.pipelineId, pipelineId))
    .orderBy(asc(pipelineSteps.order));

  return records.map(toPipelineStep);
}

export async function getPipelineStepById(
  userId: string,
  stepId: string
): Promise<PipelineStep | null> {
  const record = await db
    .select({ step: pipelineSteps })
    .from(pipelineSteps)
    .innerJoin(pipelines, eq(pipelines.id, pipelineSteps.pipelineId))
    .where(
      and(
        eq(pipelineSteps.id, stepId),
        eq(pipelines.userId, userId),
        eq(pipelines.isActive, true)
      )
    )
    .limit(1);

  if (!record.length) {
    return null;
  }

  return toPipelineStep(record[0].step);
}

export async function updatePipelineStep(
  userId: string,
  stepId: string,
  input: UpdatePipelineStepInput
): Promise<PipelineStep | null> {
  const existing = await getPipelineStepById(userId, stepId);

  if (!existing) {
    return null;
  }

  const [record] = await db
    .update(pipelineSteps)
    .set({
      type: input.type ?? existing.type,
      config: input.config ?? existing.config,
      order: input.order ?? existing.order,
      updatedAt: new Date(),
    })
    .where(eq(pipelineSteps.id, stepId))
    .returning();

  return toPipelineStep(record);
}

export async function deletePipelineStep(
  userId: string,
  stepId: string
): Promise<PipelineStep | null> {
  const existing = await getPipelineStepById(userId, stepId);

  if (!existing) {
    return null;
  }

  const [record] = await db
    .delete(pipelineSteps)
    .where(eq(pipelineSteps.id, stepId))
    .returning();

  return toPipelineStep(record);
}
