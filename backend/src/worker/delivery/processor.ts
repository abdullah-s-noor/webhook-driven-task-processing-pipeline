import { eq } from "drizzle-orm";
import { config } from "../../config.js";
import { db } from "../../db/client.js";
import { logAttempt, updateStatus } from "../../db/queries/deliveries.js";
import { deliveries, jobs, subscribers } from "../../db/schema.js";
import type { Delivery } from "../../types/delivery.js";
import type { JsonValue } from "../../types/pipeline.js";
import { fetchWithTimeout } from "../../utils/http.js";
import {
  getNextDeliveryAttempt,
  shouldFailDelivery,
} from "./retry.js";

interface DeliveryContext {
  subscriberUrl: string;
  payload: JsonValue;
}

async function getDeliveryContext(deliveryId: string): Promise<DeliveryContext | null> {
  const records = await db
    .select({
      subscriberUrl: subscribers.url,
      payload: jobs.processedPayload,
      originalPayload: jobs.payload,
    })
    .from(deliveries)
    .innerJoin(subscribers, eq(subscribers.id, deliveries.subscriberId))
    .innerJoin(jobs, eq(jobs.id, deliveries.jobId))
    .where(eq(deliveries.id, deliveryId))
    .limit(1);

  if (!records.length) {
    return null;
  }

  const record = records[0];

  return {
    subscriberUrl: record.subscriberUrl,
    payload: (record.payload ?? record.originalPayload) as JsonValue,
  };
}

async function handleFailure(
  delivery: Delivery,
  attemptNumber: number,
  statusCode: number | null,
  errorMessage: string
): Promise<void> {
  await logAttempt(delivery.id, {
    attemptNumber,
    statusCode,
    error: errorMessage,
  });

  if (shouldFailDelivery(attemptNumber)) {
    await updateStatus(delivery.id, "failed");
    return;
  }

  await updateStatus(delivery.id, "pending");
}

export async function processDelivery(delivery: Delivery): Promise<void> {
  const context = await getDeliveryContext(delivery.id);

  if (!context) {
    await updateStatus(delivery.id, "failed");
    return;
  }

  const attemptNumber = getNextDeliveryAttempt(delivery.attemptCount);

  try {
    const response = await fetchWithTimeout(
      context.subscriberUrl,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(context.payload),
      },
      config.deliveryTimeoutMs
    );

    if (response.status >= 200 && response.status < 300) {
      await logAttempt(delivery.id, {
        attemptNumber,
        statusCode: response.status,
      });
      await updateStatus(delivery.id, "success");
      return;
    }

    await handleFailure(
      delivery,
      attemptNumber,
      response.status,
      `HTTP ${response.status}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Request failed";
    await handleFailure(delivery, attemptNumber, null, message);
  }
}
