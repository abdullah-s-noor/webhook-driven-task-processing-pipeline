import {
  createForUser,
  findByIdForUser,
  findByPipelineForUser,
} from "../../db/queries/jobs.js";
import { NotFoundError } from "../errors/notFoundError.js";
import type { JsonValue } from "../../types/pipeline.js";

interface CreateJobInput {
  pipelineId: string;
  payload: JsonValue;
}

export async function createJobService(userId: string, input: CreateJobInput) {
  const job = await createForUser(userId, input);

  if (!job) {
    throw new NotFoundError("Pipeline not found");
  }

  return job;
}

export async function getJobsByPipelineService(userId: string, pipelineId: string) {
  const jobs = await findByPipelineForUser(userId, pipelineId);

  if (!jobs) {
    throw new NotFoundError("Pipeline not found");
  }

  return jobs;
}

export async function getJobByIdService(userId: string, jobId: string) {
  const job = await findByIdForUser(userId, jobId);

  if (!job) {
    throw new NotFoundError("Job not found");
  }

  return job;
}
