import API_BASE_URL from "./apiBaseUrl";

export interface Delivery {
  id: string;
  jobId: string;
  subscriberId: string;
  status: "pending" | "success" | "failed";
  attemptCount: number;
  lastAttemptAt?: string | null;
}

export interface DeliveryAttempt {
  id: string;
  deliveryId: string;
  attemptNumber: number;
  statusCode?: number | null;
  error?: string | null;
  attemptedAt?: string;
}

function buildAuthHeaders(token: string): HeadersInit {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  const data = (await response.json()) as T & { error?: string; message?: string };

  if (!response.ok) {
    throw new Error(data.error ?? data.message ?? "Request failed");
  }

  return data;
}

export async function listDeliveriesByPipeline(
  token: string,
  pipelineId: string
): Promise<Delivery[]> {
  const response = await fetch(`${API_BASE_URL}/deliveries/pipeline/${pipelineId}`, {
    headers: buildAuthHeaders(token),
  });

  const data = await parseJson<{ deliveries: Delivery[] }>(response);
  return data.deliveries;
}

export async function listDeliveryAttempts(
  token: string,
  deliveryId: string
): Promise<DeliveryAttempt[]> {
  const response = await fetch(`${API_BASE_URL}/deliveries/${deliveryId}/attempts`, {
    headers: buildAuthHeaders(token),
  });

  const data = await parseJson<{ attempts: DeliveryAttempt[] }>(response);
  return data.attempts;
}
