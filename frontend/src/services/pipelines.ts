import API_BASE_URL from "./apiBaseUrl";

export interface Pipeline {
  id: string;
  name: string;
  sourceUrl: string;
  signingSecret: string;
  isActive: boolean;
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

export async function listPipelines(token: string): Promise<Pipeline[]> {
  const response = await fetch(`${API_BASE_URL}/pipelines`, {
    headers: buildAuthHeaders(token),
  });

  const data = await parseJson<{ pipelines: Pipeline[] }>(response);
  return data.pipelines;
}

export async function createPipeline(token: string, name: string): Promise<Pipeline> {
  const response = await fetch(`${API_BASE_URL}/pipelines`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify({ name }),
  });

  const data = await parseJson<{ pipeline: Pipeline }>(response);
  return data.pipeline;
}

export async function deletePipeline(token: string, id: string): Promise<Pipeline> {
  const response = await fetch(`${API_BASE_URL}/pipelines/${id}`, {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });

  const data = await parseJson<{ pipeline: Pipeline }>(response);
  return data.pipeline;
}

