import {
  create,
  findById,
  findByUser,
  softDelete,
} from "../../db/queries/pipelines.js";
import { NotFoundError } from "../errors/notFoundError.js";

export async function createPipelineService(userId: string, name: string) {
  return create({ userId, name });
}

export async function getPipelinesService(userId: string) {
  return findByUser(userId);
}

export async function getPipelineByIdService(pipelineId: string, userId: string) {
  const pipeline = await findById(pipelineId, userId);

  if (!pipeline) {
    throw new NotFoundError("Pipeline not found");
  }

  return pipeline;
}

export async function deletePipelineService(pipelineId: string, userId: string) {
  const pipeline = await softDelete(pipelineId, userId);

  if (!pipeline) {
    throw new NotFoundError("Pipeline not found");
  }

  return pipeline;
}
