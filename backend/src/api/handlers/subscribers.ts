import type { Request, Response } from "express";
import { BadRequestError } from "../errors/badRequestError.js";
import { UnauthorizedError } from "../errors/unauthorizedError.js";
import {
  createSubscriberService,
  deleteSubscriberService,
  getSubscriberByIdService,
  getSubscribersService,
  updateSubscriberService,
} from "../services/subscribers.js";

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

function requireUrl(value: unknown, field: string): string {
  const raw = requireString(value, field);

  try {
    return new URL(raw).toString();
  } catch {
    throw new BadRequestError(`${field} must be a valid URL`);
  }
}

export async function createSubscriberHandler(
  req: Request,
  res: Response
): Promise<void> {
  const pipelineId = requireString(req.body?.pipelineId, "pipelineId");
  const url = requireUrl(req.body?.url, "url");

  const subscriber = await createSubscriberService(getUserId(req), {
    pipelineId,
    url,
  });

  res.status(201).json({ subscriber });
}

export async function getSubscribersHandler(
  req: Request,
  res: Response
): Promise<void> {
  const pipelineId = requireString(req.params?.pipelineId, "pipelineId");
  const subscribers = await getSubscribersService(getUserId(req), pipelineId);

  res.status(200).json({ subscribers });
}

export async function getSubscriberByIdHandler(
  req: Request,
  res: Response
): Promise<void> {
  const subscriberId = requireString(req.params?.id, "id");
  const subscriber = await getSubscriberByIdService(getUserId(req), subscriberId);

  res.status(200).json({ subscriber });
}

export async function updateSubscriberHandler(
  req: Request,
  res: Response
): Promise<void> {
  const subscriberId = requireString(req.params?.id, "id");

  if (req.body?.url === undefined) {
    throw new BadRequestError("At least one field is required");
  }

  const payload = {
    url: requireUrl(req.body.url, "url"),
  };

  const subscriber = await updateSubscriberService(
    getUserId(req),
    subscriberId,
    payload
  );

  res.status(200).json({ subscriber });
}

export async function deleteSubscriberHandler(
  req: Request,
  res: Response
): Promise<void> {
  const subscriberId = requireString(req.params?.id, "id");
  const subscriber = await deleteSubscriberService(getUserId(req), subscriberId);

  res.status(200).json({ subscriber });
}
