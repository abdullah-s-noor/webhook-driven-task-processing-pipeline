const API_BASE_URL = "http://localhost:3000";

export interface Subscriber {
  id: string;
  pipelineId: string;
  url: string;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
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

export async function listSubscribers(token: string, pipelineId: string): Promise<Subscriber[]> {
  const response = await fetch(`${API_BASE_URL}/subscribers/pipeline/${pipelineId}`, {
    headers: buildAuthHeaders(token),
  });

  const data = await parseJson<{ subscribers: Subscriber[] }>(response);
  return data.subscribers;
}

export async function createSubscriber(
  token: string,
  payload: { pipelineId: string; url: string }
): Promise<Subscriber> {
  const response = await fetch(`${API_BASE_URL}/subscribers`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  const data = await parseJson<{ subscriber: Subscriber }>(response);
  return data.subscriber;
}

export async function deleteSubscriber(token: string, id: string): Promise<Subscriber> {
  const response = await fetch(`${API_BASE_URL}/subscribers/${id}`, {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });

  const data = await parseJson<{ subscriber: Subscriber }>(response);
  return data.subscriber;
}

export async function updateSubscriber(
  token: string,
  id: string,
  payload: { url: string }
): Promise<Subscriber> {
  const response = await fetch(`${API_BASE_URL}/subscribers/${id}`, {
    method: "PUT",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  const data = await parseJson<{ subscriber: Subscriber }>(response);
  return data.subscriber;
}
