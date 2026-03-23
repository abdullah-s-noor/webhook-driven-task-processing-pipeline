import type { JsonValue, StepType } from "../../types/pipeline.js";
import {
  createPipelineStep,
  deletePipelineStep,
  getPipelineStepById,
  getPipelineStepsByPipeline,
  updatePipelineStep,
} from "../../db/queries/pipline-steps.js";
import { NotFoundError } from "../errors/notFoundError.js";

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

export async function createPipelineStepService(
  userId: string,
  input: CreatePipelineStepInput
) {
  const step = await createPipelineStep(userId, input);

  if (!step) {
    throw new NotFoundError("Pipeline not found");
  }

  return step;
}

export async function getPipelineStepsService(userId: string, pipelineId: string) {
  const steps = await getPipelineStepsByPipeline(userId, pipelineId);

  if (!steps) {
    throw new NotFoundError("Pipeline not found");
  }

  return steps;
}

export async function getPipelineStepByIdService(userId: string, stepId: string) {
  const step = await getPipelineStepById(userId, stepId);

  if (!step) {
    throw new NotFoundError("Pipeline step not found");
  }

  return step;
}

export async function updatePipelineStepService(
  userId: string,
  stepId: string,
  input: UpdatePipelineStepInput
) {
  const step = await updatePipelineStep(userId, stepId, input);

  if (!step) {
    throw new NotFoundError("Pipeline step not found");
  }

  return step;
}

export async function deletePipelineStepService(userId: string, stepId: string) {
  const step = await deletePipelineStep(userId, stepId);

  if (!step) {
    throw new NotFoundError("Pipeline step not found");
  }

  return step;
}
