import {
  createSubscriber,
  deleteSubscriber,
  getSubscriberById,
  getSubscribersByPipeline,
  updateSubscriber,
} from "../../db/queries/subscribers.js";
import { NotFoundError } from "../errors/notFoundError.js";

interface CreateSubscriberInput {
  pipelineId: string;
  url: string;
}

interface UpdateSubscriberInput {
  url?: string;
}

export async function createSubscriberService(
  userId: string,
  input: CreateSubscriberInput
) {
  const subscriber = await createSubscriber(userId, input);

  if (!subscriber) {
    throw new NotFoundError("Pipeline not found");
  }

  return subscriber;
}

export async function getSubscribersService(userId: string, pipelineId: string) {
  const subscribers = await getSubscribersByPipeline(userId, pipelineId);

  if (!subscribers) {
    throw new NotFoundError("Pipeline not found");
  }

  return subscribers;
}

export async function getSubscriberByIdService(
  userId: string,
  subscriberId: string
) {
  const subscriber = await getSubscriberById(userId, subscriberId);

  if (!subscriber) {
    throw new NotFoundError("Subscriber not found");
  }

  return subscriber;
}

export async function updateSubscriberService(
  userId: string,
  subscriberId: string,
  input: UpdateSubscriberInput
) {
  const subscriber = await updateSubscriber(userId, subscriberId, input);

  if (!subscriber) {
    throw new NotFoundError("Subscriber not found");
  }

  return subscriber;
}

export async function deleteSubscriberService(userId: string, subscriberId: string) {
  const subscriber = await deleteSubscriber(userId, subscriberId);

  if (!subscriber) {
    throw new NotFoundError("Subscriber not found");
  }

  return subscriber;
}
