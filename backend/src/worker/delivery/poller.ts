import { config } from "../../config.js";
import { findPendingRetryable } from "../../db/queries/deliveries.js";
import type { Delivery } from "../../types/delivery.js";
import { withAdvisoryLock } from "../concurrency/lock.js";
import { processDelivery } from "./processor.js";
import { getDeliveryBackoffDelay } from "./retry.js";

let isPolling = false;

function isReadyForRetry(delivery: Delivery, now = Date.now()): boolean {
  const nextAttempt = delivery.attemptCount + 1;
  const backoffMs = getDeliveryBackoffDelay(nextAttempt);

  if (!delivery.lastAttemptAt) {
    return true;
  }

  return delivery.lastAttemptAt.getTime() + backoffMs <= now;
}

async function pollOnce(): Promise<void> {
  if (isPolling) {
    return;
  }

  isPolling = true;

  try {
    const deliveries = await findPendingRetryable(20);
    const now = Date.now();

    for (const delivery of deliveries) {
      if (!isReadyForRetry(delivery, now)) {
        continue;
      }

      await withAdvisoryLock("delivery", delivery.id, async () => {
        await processDelivery(delivery);
      });
    }
  } catch (error) {
    console.error("Delivery poller error:", error);
  } finally {
    isPolling = false;
  }
}

export function startDeliveryPoller(): void {
  console.log("Delivery poller started");
  void pollOnce();

  setInterval(() => {
    void pollOnce();
  }, config.workerPollIntervalMs);
}
