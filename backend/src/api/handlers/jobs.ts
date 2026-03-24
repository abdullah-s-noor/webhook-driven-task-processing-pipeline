import type { Request, Response } from "express";
import { BadRequestError } from "../errors/badRequestError.js";
import { UnauthorizedError } from "../errors/unauthorizedError.js";
import {
  createJobService,
  getJobByIdService,
  getJobsByPipelineService,
} from "../services/jobs.js";
import type { JsonValue } from "../../types/pipeline.js";

function getUserId(req: Request): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Unauthorized");
  }

  return req.user.id;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new BadRequestError(`${field} is required`);
  }

  return value.trim();
}

function requirePayload(value: unknown): JsonValue {
  if (value === undefined) {
    throw new BadRequestError("payload is required");
  }

  return value as JsonValue;
}

export async function createJobHandler(req: Request, res: Response): Promise<void> {
  const pipelineId = requireString(req.body?.pipelineId, "pipelineId");
  const payload = requirePayload(req.body?.payload);

  const job = await createJobService(getUserId(req), { pipelineId, payload });

  res.status(201).json({ job });
}

export async function getJobsByPipelineHandler(
  req: Request,
  res: Response
): Promise<void> {
  const pipelineId = requireString(req.params?.pipelineId, "pipelineId");
  const jobs = await getJobsByPipelineService(getUserId(req), pipelineId);

  res.status(200).json({ jobs });
}

export async function getJobByIdHandler(req: Request, res: Response): Promise<void> {
  const id = requireString(req.params?.id, "id");
  const job = await getJobByIdService(getUserId(req), id);

  res.status(200).json({ job });
}
