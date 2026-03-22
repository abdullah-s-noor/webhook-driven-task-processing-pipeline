import "dotenv/config";

function getEnv(name: string, defaultValue?: string): string {
  const value = process.env[name] ?? defaultValue;

  if (value === undefined) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

export const config = {
  nodeEnv: getEnv("NODE_ENV", "development"),
  port: Number(getEnv("PORT", "8080")),
  databaseUrl: getEnv(
    "DATABASE_URL",
    "postgresql://postgres:postgres@localhost:5432/webhookpipe"
  ),
  jwtSecret: getEnv("JWT_SECRET", "dev-secret"),
  workerPollIntervalMs: Number(getEnv("WORKER_POLL_INTERVAL_MS", "5000")),
  maxDeliveryAttempts: Number(getEnv("MAX_DELIVERY_ATTEMPTS", "3")),
  deliveryTimeoutMs: Number(getEnv("DELIVERY_TIMEOUT_MS", "10000")),
};
