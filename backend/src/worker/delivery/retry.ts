const TEN_SECONDS_MS = 10_000;
const TWENTY_SECONDS_MS = 20_000;
const MAX_DELIVERY_FAILURES = 3;

export function getDeliveryBackoffDelay(attemptNumber: number): number {
  if (attemptNumber <= 1) {
    return 0;
  }

  if (attemptNumber === 2) {
    return TEN_SECONDS_MS;
  }

  return TWENTY_SECONDS_MS;
}

export function shouldFailDelivery(attemptNumber: number): boolean {
  return attemptNumber >= MAX_DELIVERY_FAILURES;
}

export function getNextDeliveryAttempt(currentAttemptCount: number): number {
  return currentAttemptCount + 1;
}
