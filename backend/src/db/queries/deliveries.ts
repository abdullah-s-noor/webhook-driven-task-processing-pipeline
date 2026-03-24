import { and, asc, eq, lt } from "drizzle-orm";
import { db } from "../client.js";
import { deliveries, deliveryAttempts, jobs, pipelines, subscribers } from "../schema.js";
import type { Delivery, DeliveryAttempt, DeliveryStatus } from "../../types/delivery.js";

interface LogAttemptInput {
  attemptNumber: number;
  statusCode?: number | null;
  error?: string | null;
}

function toDelivery(record: typeof deliveries.$inferSelect): Delivery {
  return {
    id: record.id,
    jobId: record.jobId,
    subscriberId: record.subscriberId,
    status: record.status as DeliveryStatus,
    attemptCount: record.attemptCount,
    lastAttemptAt: record.lastAttemptAt,
  };
}

function toDeliveryAttempt(
  record: typeof deliveryAttempts.$inferSelect
): DeliveryAttempt {
  return {
    id: record.id,
    deliveryId: record.deliveryId,
    attemptNumber: record.attemptNumber,
    statusCode: record.statusCode,
    error: record.error,
    attemptedAt: record.attemptedAt,
  };
}

export async function create(jobId: string): Promise<Delivery[]> {
  return db.transaction(async (tx) => {
    const jobRecord = await tx.query.jobs.findFirst({
      where: eq(jobs.id, jobId),
    });

    if (!jobRecord) {
      return [];
    }

    const subscriberRecords = await tx
      .select()
      .from(subscribers)
      .where(eq(subscribers.pipelineId, jobRecord.pipelineId));

    if (!subscriberRecords.length) {
      return [];
    }

    const records = await tx
      .insert(deliveries)
      .values(
        subscriberRecords.map((subscriber) => ({
          jobId,
          subscriberId: subscriber.id,
        }))
      )
      .returning();

    return records.map(toDelivery);
  });
}

export async function findPending(limit = 10): Promise<Delivery[]> {
  const records = await db
    .select()
    .from(deliveries)
    .where(eq(deliveries.status, "pending"))
    .orderBy(asc(deliveries.id))
    .limit(limit)
    .for("update", { skipLocked: true });

  return records.map(toDelivery);
}

export async function findPendingRetryable(limit = 10): Promise<Delivery[]> {
  const records = await db
    .select()
    .from(deliveries)
    .where(and(eq(deliveries.status, "pending"), lt(deliveries.attemptCount, 3)))
    .orderBy(asc(deliveries.id))
    .limit(limit)
    .for("update", { skipLocked: true });

  return records.map(toDelivery);
}

export async function updateStatus(
  deliveryId: string,
  status: DeliveryStatus
): Promise<Delivery | null> {
  const [record] = await db
    .update(deliveries)
    .set({
      status,
    })
    .where(eq(deliveries.id, deliveryId))
    .returning();

  return record ? toDelivery(record) : null;
}

export async function logAttempt(
  deliveryId: string,
  input: LogAttemptInput
): Promise<DeliveryAttempt | null> {
  return db.transaction(async (tx) => {
    const [attemptRecord] = await tx
      .insert(deliveryAttempts)
      .values({
        deliveryId,
        attemptNumber: input.attemptNumber,
        statusCode: input.statusCode,
        error: input.error,
      })
      .returning();

    await tx
      .update(deliveries)
      .set({
        attemptCount: input.attemptNumber,
        lastAttemptAt: new Date(),
      })
      .where(eq(deliveries.id, deliveryId));

    return attemptRecord ? toDeliveryAttempt(attemptRecord) : null;
  });
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

export async function findByPipelineForUser(
  userId: string,
  pipelineId: string
): Promise<Delivery[] | null> {
  const ownsPipeline = await userOwnsPipeline(userId, pipelineId);

  if (!ownsPipeline) {
    return null;
  }

  const records = await db
    .select({ delivery: deliveries })
    .from(deliveries)
    .innerJoin(jobs, eq(jobs.id, deliveries.jobId))
    .innerJoin(pipelines, eq(pipelines.id, jobs.pipelineId))
    .where(
      and(
        eq(jobs.pipelineId, pipelineId),
        eq(pipelines.userId, userId),
        eq(pipelines.isActive, true)
      )
    )
    .orderBy(asc(deliveries.id));

  return records.map((record) => toDelivery(record.delivery));
}

export async function findAttemptsByDeliveryForUser(
  userId: string,
  deliveryId: string
): Promise<DeliveryAttempt[] | null> {
  const records = await db
    .select({ attempt: deliveryAttempts })
    .from(deliveryAttempts)
    .innerJoin(deliveries, eq(deliveries.id, deliveryAttempts.deliveryId))
    .innerJoin(jobs, eq(jobs.id, deliveries.jobId))
    .innerJoin(pipelines, eq(pipelines.id, jobs.pipelineId))
    .where(
      and(
        eq(deliveryAttempts.deliveryId, deliveryId),
        eq(pipelines.userId, userId),
        eq(pipelines.isActive, true)
      )
    )
    .orderBy(asc(deliveryAttempts.attemptNumber));

  if (!records.length) {
    const deliveryRecord = await db
      .select({ delivery: deliveries })
      .from(deliveries)
      .innerJoin(jobs, eq(jobs.id, deliveries.jobId))
      .innerJoin(pipelines, eq(pipelines.id, jobs.pipelineId))
      .where(
        and(
          eq(deliveries.id, deliveryId),
          eq(pipelines.userId, userId),
          eq(pipelines.isActive, true)
        )
      )
      .limit(1);

    if (!deliveryRecord.length) {
      return null;
    }
  }

  return records.map((record) => toDeliveryAttempt(record.attempt));
}
