const THIRTY_SECONDS_MS = 30_000;
const FIVE_MINUTES_MS = 5 * 60_000;
const MAX_DELIVERY_FAILURES = 3;

export function getDeliveryBackoffDelay(attemptNumber: number): number {
  if (attemptNumber <= 1) {
    return 0;
  }

  if (attemptNumber === 2) {
    return THIRTY_SECONDS_MS;
  }

  return FIVE_MINUTES_MS;
}

export function shouldFailDelivery(attemptNumber: number): boolean {
  return attemptNumber >= MAX_DELIVERY_FAILURES;
}

export function getNextDeliveryAttempt(currentAttemptCount: number): number {
  return currentAttemptCount + 1;
}
