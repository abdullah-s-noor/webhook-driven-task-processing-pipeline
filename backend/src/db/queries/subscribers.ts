import { and, asc, eq } from "drizzle-orm";
import type { Subscriber } from "../../types/pipeline.js";
import { db } from "../client.js";
import { pipelines, subscribers } from "../schema.js";

interface CreateSubscriberInput {
  pipelineId: string;
  url: string;
}

interface UpdateSubscriberInput {
  url?: string;
}

function toSubscriber(record: typeof subscribers.$inferSelect): Subscriber {
  return {
    id: record.id,
    pipelineId: record.pipelineId,
    url: record.url,
    createdAt: record.createdAt,
  };
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

export async function createSubscriber(
  userId: string,
  input: CreateSubscriberInput
): Promise<Subscriber | null> {
  const owns = await userOwnsPipeline(userId, input.pipelineId);

  if (!owns) {
    return null;
  }

  const [record] = await db
    .insert(subscribers)
    .values({
      pipelineId: input.pipelineId,
      url: input.url,
    })
    .returning();

  return toSubscriber(record);
}

export async function getSubscribersByPipeline(
  userId: string,
  pipelineId: string
): Promise<Subscriber[] | null> {
  const owns = await userOwnsPipeline(userId, pipelineId);

  if (!owns) {
    return null;
  }

  const records = await db
    .select()
    .from(subscribers)
    .where(eq(subscribers.pipelineId, pipelineId))
    .orderBy(asc(subscribers.createdAt));

  return records.map(toSubscriber);
}

export async function getSubscriberById(
  userId: string,
  subscriberId: string
): Promise<Subscriber | null> {
  const records = await db
    .select({ subscriber: subscribers })
    .from(subscribers)
    .innerJoin(pipelines, eq(pipelines.id, subscribers.pipelineId))
    .where(
      and(
        eq(subscribers.id, subscriberId),
        eq(pipelines.userId, userId),
        eq(pipelines.isActive, true)
      )
    )
    .limit(1);

  if (!records.length) {
    return null;
  }

  return toSubscriber(records[0].subscriber);
}

export async function updateSubscriber(
  userId: string,
  subscriberId: string,
  input: UpdateSubscriberInput
): Promise<Subscriber | null> {
  const existing = await getSubscriberById(userId, subscriberId);

  if (!existing) {
    return null;
  }

  const [record] = await db
    .update(subscribers)
    .set({
      url: input.url ?? existing.url,
    })
    .where(eq(subscribers.id, subscriberId))
    .returning();

  return toSubscriber(record);
}

export async function deleteSubscriber(
  userId: string,
  subscriberId: string
): Promise<Subscriber | null> {
  const existing = await getSubscriberById(userId, subscriberId);

  if (!existing) {
    return null;
  }

  const [record] = await db
    .delete(subscribers)
    .where(eq(subscribers.id, subscriberId))
    .returning();

  return toSubscriber(record);
}
