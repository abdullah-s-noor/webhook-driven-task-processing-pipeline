const THIRTY_SECONDS_MS = 30_000;
const FIVE_MINUTES_MS = 5 * 60_000;

export function getBackoffDelay(attemptNumber: number): number {
  if (attemptNumber <= 1) {
    return 0;
  }

  if (attemptNumber === 2) {
    return THIRTY_SECONDS_MS;
  }

  return FIVE_MINUTES_MS;
}
