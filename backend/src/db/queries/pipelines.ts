import { and, asc, eq } from "drizzle-orm";
import { db } from "../client.js";
import { pipelines, pipelineSteps, subscribers } from "../schema.js";
import type {
  JsonValue,
  Pipeline,
  PipelineStep,
  StepType,
  Subscriber,
} from "../../types/pipeline.js";

interface PipelineStepInput {
  type: StepType;
  config: JsonValue;
  order: number;
}

interface CreatePipelineInput {
  userId: string;
  name: string;
  username: string;
  sourceUrl: string;
  signingSecret: string;
  isActive?: boolean;
  steps?: PipelineStepInput[];
  subscribers?: string[];
}

interface UpdatePipelineInput {
  name?: string;
  username?: string;
  sourceUrl?: string;
  signingSecret?: string;
  isActive?: boolean;
  steps?: PipelineStepInput[];
  subscribers?: string[];
}

export interface PipelineWithRelations {
  pipeline: Pipeline;
  steps: PipelineStep[];
  subscribers: Subscriber[];
}

function toPipeline(record: typeof pipelines.$inferSelect): Pipeline {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    username: record.username,
    sourceUrl: record.sourceUrl,
    signingSecret: record.signingSecret,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
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

function toSubscriber(record: typeof subscribers.$inferSelect): Subscriber {
  return {
    id: record.id,
    pipelineId: record.pipelineId,
    url: record.url,
    createdAt: record.createdAt,
  };
}

async function loadRelations(
  pipelineId: string,
  userId: string
): Promise<PipelineWithRelations | null> {
  const pipelineRecord = await db.query.pipelines.findFirst({
    where: and(eq(pipelines.id, pipelineId), eq(pipelines.userId, userId)),
  });

  if (!pipelineRecord) {
    return null;
  }

  const [stepRecords, subscriberRecords] = await Promise.all([
    db
      .select()
      .from(pipelineSteps)
      .where(eq(pipelineSteps.pipelineId, pipelineId))
      .orderBy(asc(pipelineSteps.order)),
    db
      .select()
      .from(subscribers)
      .where(eq(subscribers.pipelineId, pipelineId))
      .orderBy(asc(subscribers.createdAt)),
  ]);

  return {
    pipeline: toPipeline(pipelineRecord),
    steps: stepRecords.map(toPipelineStep),
    subscribers: subscriberRecords.map(toSubscriber),
  };
}

export async function findById(
  pipelineId: string,
  userId: string
): Promise<PipelineWithRelations | null> {
  return loadRelations(pipelineId, userId);
}

export async function findByUser(userId: string): Promise<PipelineWithRelations[]> {
  const records = await db
    .select({ id: pipelines.id })
    .from(pipelines)
    .where(eq(pipelines.userId, userId))
    .orderBy(asc(pipelines.createdAt));

  const results = await Promise.all(
    records.map((record) => loadRelations(record.id, userId))
  );

  return results.filter(
    (result): result is PipelineWithRelations => result !== null
  );
}

export async function create(
  input: CreatePipelineInput
): Promise<PipelineWithRelations> {
  return db.transaction(async (tx) => {
    const [pipelineRecord] = await tx
      .insert(pipelines)
      .values({
        userId: input.userId,
        name: input.name,
        username: input.username,
        sourceUrl: input.sourceUrl,
        signingSecret: input.signingSecret,
        isActive: input.isActive ?? true,
      })
      .returning();

    if (input.steps?.length) {
      await tx.insert(pipelineSteps).values(
        input.steps.map((step) => ({
          pipelineId: pipelineRecord.id,
          type: step.type,
          config: step.config,
          order: step.order,
        }))
      );
    }

    if (input.subscribers?.length) {
      await tx.insert(subscribers).values(
        input.subscribers.map((url) => ({
          pipelineId: pipelineRecord.id,
          url,
        }))
      );
    }

    const [stepRecords, subscriberRecords] = await Promise.all([
      tx
        .select()
        .from(pipelineSteps)
        .where(eq(pipelineSteps.pipelineId, pipelineRecord.id))
        .orderBy(asc(pipelineSteps.order)),
      tx
        .select()
        .from(subscribers)
        .where(eq(subscribers.pipelineId, pipelineRecord.id))
        .orderBy(asc(subscribers.createdAt)),
    ]);

    return {
      pipeline: toPipeline(pipelineRecord),
      steps: stepRecords.map(toPipelineStep),
      subscribers: subscriberRecords.map(toSubscriber),
    };
  });
}

export async function update(
  pipelineId: string,
  userId: string,
  input: UpdatePipelineInput
): Promise<PipelineWithRelations | null> {
  return db.transaction(async (tx) => {
    const existing = await tx.query.pipelines.findFirst({
      where: and(eq(pipelines.id, pipelineId), eq(pipelines.userId, userId)),
    });

    if (!existing) {
      return null;
    }

    const [pipelineRecord] = await tx
      .update(pipelines)
      .set({
        name: input.name ?? existing.name,
        username: input.username ?? existing.username,
        sourceUrl: input.sourceUrl ?? existing.sourceUrl,
        signingSecret: input.signingSecret ?? existing.signingSecret,
        isActive: input.isActive ?? existing.isActive,
        updatedAt: new Date(),
      })
      .where(and(eq(pipelines.id, pipelineId), eq(pipelines.userId, userId)))
      .returning();

    if (input.steps) {
      await tx.delete(pipelineSteps).where(eq(pipelineSteps.pipelineId, pipelineId));

      if (input.steps.length) {
        await tx.insert(pipelineSteps).values(
          input.steps.map((step) => ({
            pipelineId,
            type: step.type,
            config: step.config,
            order: step.order,
          }))
        );
      }
    }

    if (input.subscribers) {
      await tx.delete(subscribers).where(eq(subscribers.pipelineId, pipelineId));

      if (input.subscribers.length) {
        await tx.insert(subscribers).values(
          input.subscribers.map((url) => ({
            pipelineId,
            url,
          }))
        );
      }
    }

    const [stepRecords, subscriberRecords] = await Promise.all([
      tx
        .select()
        .from(pipelineSteps)
        .where(eq(pipelineSteps.pipelineId, pipelineId))
        .orderBy(asc(pipelineSteps.order)),
      tx
        .select()
        .from(subscribers)
        .where(eq(subscribers.pipelineId, pipelineId))
        .orderBy(asc(subscribers.createdAt)),
    ]);

    return {
      pipeline: toPipeline(pipelineRecord),
      steps: stepRecords.map(toPipelineStep),
      subscribers: subscriberRecords.map(toSubscriber),
    };
  });
}

export async function softDelete(
  pipelineId: string,
  userId: string
): Promise<Pipeline | null> {
  const [record] = await db
    .update(pipelines)
    .set({
      isActive: false,
      updatedAt: new Date(),
    })
    .where(and(eq(pipelines.id, pipelineId), eq(pipelines.userId, userId)))
    .returning();

  return record ? toPipeline(record) : null;
}
