import {
  findAttemptsByDeliveryForUser,
  findByPipelineForUser,
} from "../../db/queries/deliveries.js";
import { NotFoundError } from "../errors/notFoundError.js";

export async function getDeliveriesByPipelineService(
  userId: string,
  pipelineId: string
) {
  const deliveries = await findByPipelineForUser(userId, pipelineId);

  if (!deliveries) {
    throw new NotFoundError("Pipeline not found");
  }

  return deliveries;
}

export async function getDeliveryAttemptsService(userId: string, deliveryId: string) {
  const attempts = await findAttemptsByDeliveryForUser(userId, deliveryId);

  if (!attempts) {
    throw new NotFoundError("Delivery not found");
  }

  return attempts;
}
