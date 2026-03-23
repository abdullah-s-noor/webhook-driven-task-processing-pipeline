import { randomBytes } from "crypto";
import { and, asc, eq } from "drizzle-orm";
import type { Pipeline } from "../../types/pipeline.js";
import { db } from "../client.js";
import { pipelines } from "../schema.js";

interface CreatePipelineInput {
  userId: string;
  name: string;
}

function generateSigningSecret(): string {
  return randomBytes(32).toString("hex");
}

function generateSourceUrl(): string {
  return `https://webhook.local/${randomBytes(8).toString("hex")}`;
}

function toPipeline(record: typeof pipelines.$inferSelect): Pipeline {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    sourceUrl: record.sourceUrl,
    signingSecret: record.signingSecret,
    isActive: record.isActive,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

export async function create(input: CreatePipelineInput): Promise<Pipeline> {
  const [record] = await db
    .insert(pipelines)
    .values({
      userId: input.userId,
      name: input.name,
      sourceUrl: generateSourceUrl(),
      signingSecret: generateSigningSecret(),
      isActive: true,
    })
    .returning();

  return toPipeline(record);
}

export async function findByUser(userId: string): Promise<Pipeline[]> {
  const records = await db
    .select()
    .from(pipelines)
    .where(and(eq(pipelines.userId, userId), eq(pipelines.isActive, true)))
    .orderBy(asc(pipelines.createdAt));

  return records.map(toPipeline);
}

export async function findById(
  pipelineId: string,
  userId: string
): Promise<Pipeline | null> {
  const record = await db.query.pipelines.findFirst({
    where: and(
      eq(pipelines.id, pipelineId),
      eq(pipelines.userId, userId),
      eq(pipelines.isActive, true)
    ),
  });

  return record ? toPipeline(record) : null;
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
    .where(
      and(
        eq(pipelines.id, pipelineId),
        eq(pipelines.userId, userId),
        eq(pipelines.isActive, true)
      )
    )
    .returning();

  return record ? toPipeline(record) : null;
}
