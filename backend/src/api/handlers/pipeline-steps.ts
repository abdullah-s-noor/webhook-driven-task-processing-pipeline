import type { Request, Response } from "express";
import type { JsonValue, StepType } from "../../types/pipeline.js";
import { BadRequestError } from "../errors/badRequestError.js";
import { UnauthorizedError } from "../errors/unauthorizedError.js";
import {
  createPipelineStepService,
  deletePipelineStepService,
  getPipelineStepByIdService,
  getPipelineStepsService,
  updatePipelineStepService,
} from "../services/pipeline-steps.js";

const STEP_TYPES: StepType[] = [
  "require_fields",
  "filter",
  "transform",
  "set_fields",
  "enrich",
  "calculate_field",
  "pick_fields",
  "delay",
  "deliver",
];

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

function requireStepType(value: unknown): StepType {
  const type = requireString(value, "type") as StepType;

  if (!STEP_TYPES.includes(type)) {
    throw new BadRequestError("type is invalid");
  }

  return type;
}

function requireOrder(value: unknown): number {
  if (!Number.isInteger(value) || (value as number) < 0) {
    throw new BadRequestError("order must be a non-negative integer");
  }

  return value as number;
}

export async function createPipelineStepHandler(
  req: Request,
  res: Response
): Promise<void> {
  const pipelineId = requireString(req.body?.pipelineId, "pipelineId");
  const type = requireStepType(req.body?.type);
  const config = (req.body?.config ?? {}) as JsonValue;
  const order = requireOrder(req.body?.order);

  const step = await createPipelineStepService(getUserId(req), {
    pipelineId,
    type,
    config,
    order,
  });

  res.status(201).json({ step });
}

export async function getPipelineStepsHandler(
  req: Request,
  res: Response
): Promise<void> {
  const pipelineId = requireString(req.params?.pipelineId, "pipelineId");
  const steps = await getPipelineStepsService(getUserId(req), pipelineId);

  res.status(200).json({ steps });
}

export async function getPipelineStepByIdHandler(
  req: Request,
  res: Response
): Promise<void> {
  const stepId = requireString(req.params?.id, "id");
  const step = await getPipelineStepByIdService(getUserId(req), stepId);

  res.status(200).json({ step });
}

export async function updatePipelineStepHandler(
  req: Request,
  res: Response
): Promise<void> {
  const stepId = requireString(req.params?.id, "id");
  const payload: { type?: StepType; config?: JsonValue; order?: number } = {};

  if (req.body?.type !== undefined) {
    payload.type = requireStepType(req.body.type);
  }

  if (req.body?.config !== undefined) {
    payload.config = req.body.config as JsonValue;
  }

  if (req.body?.order !== undefined) {
    payload.order = requireOrder(req.body.order);
  }

  if (Object.keys(payload).length === 0) {
    throw new BadRequestError("At least one field is required");
  }

  const step = await updatePipelineStepService(getUserId(req), stepId, payload);

  res.status(200).json({ step });
}

export async function deletePipelineStepHandler(
  req: Request,
  res: Response
): Promise<void> {
  const stepId = requireString(req.params?.id, "id");
  const step = await deletePipelineStepService(getUserId(req), stepId);

  res.status(200).json({ step });
}
