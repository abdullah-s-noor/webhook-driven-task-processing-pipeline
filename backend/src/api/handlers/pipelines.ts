import type { Request, Response } from "express";
import { BadRequestError } from "../errors/badRequestError.js";
import { UnauthorizedError } from "../errors/unauthorizedError.js";
import {
  createPipelineService,
  deletePipelineService,
  getPipelineByIdService,
  getPipelinesService,
} from "../services/pipelines.js";

function getUserId(req: Request): string {
  if (!req.user?.id) {
    throw new UnauthorizedError("Unauthorized");
  }

  return req.user.id;
}

function getPipelineId(req: Request): string {
  const id = req.params.id;
  if (!id || typeof id !== "string") {
    throw new BadRequestError("Pipeline id is required");
  }
  return id;
}

export async function createPipelineHandler(
  req: Request,
  res: Response
): Promise<void> {
  const name = req.body?.name;

  if (typeof name !== "string" || name.trim().length === 0) {
    throw new BadRequestError("name is required");
  }

  const pipeline = await createPipelineService(getUserId(req), name.trim());
  res.status(201).json({ pipeline });
}

export async function getPipelinesHandler(
  req: Request,
  res: Response
): Promise<void> {
  const pipelines = await getPipelinesService(getUserId(req));
  res.status(200).json({ pipelines });
}

export async function getPipelineByIdHandler(
  req: Request,
  res: Response
): Promise<void> {
  const pipeline = await getPipelineByIdService(getPipelineId(req), getUserId(req));
  res.status(200).json({ pipeline });
}

export async function deletePipelineHandler(
  req: Request,
  res: Response
): Promise<void> {
  const pipeline = await deletePipelineService(getPipelineId(req), getUserId(req));
  res.status(200).json({ pipeline });
}
