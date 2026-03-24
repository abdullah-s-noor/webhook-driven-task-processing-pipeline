import type { Request, Response } from "express";
import { BadRequestError } from "../errors/badRequestError.js";
import { UnauthorizedError } from "../errors/unauthorizedError.js";
import {
  getDeliveriesByPipelineService,
  getDeliveryAttemptsService,
} from "../services/deliveries.js";

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

export async function getDeliveriesByPipelineHandler(
  req: Request,
  res: Response
): Promise<void> {
  const pipelineId = requireString(req.params?.pipelineId, "pipelineId");
  const deliveries = await getDeliveriesByPipelineService(getUserId(req), pipelineId);

  res.status(200).json({ deliveries });
}

export async function getDeliveryAttemptsHandler(
  req: Request,
  res: Response
): Promise<void> {
  const deliveryId = requireString(req.params?.deliveryId, "deliveryId");
  const attempts = await getDeliveryAttemptsService(getUserId(req), deliveryId);

  res.status(200).json({ attempts });
}
