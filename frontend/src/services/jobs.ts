const API_BASE_URL = "http://localhost:3000";

export interface Job {
  id: string;
  pipelineId: string;
  payload: unknown;
  stepsSnapshot: unknown;
  processedPayload: unknown;
  status: "pending" | "processing" | "processed" | "failed";
  filterReason?: string | null;
  attemptCount: number;
  createdAt?: string;
  updatedAt?: string;
  processedAt?: string | null;
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

export async function createJob(
  token: string,
  payload: { pipelineId: string; payload: unknown }
): Promise<Job> {
  const response = await fetch(`${API_BASE_URL}/jobs`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  const data = await parseJson<{ job: Job }>(response);
  return data.job;
}

export async function listJobsByPipeline(
  token: string,
  pipelineId: string
): Promise<Job[]> {
  const response = await fetch(`${API_BASE_URL}/jobs/pipeline/${pipelineId}`, {
    headers: buildAuthHeaders(token),
  });

  const data = await parseJson<{ jobs: Job[] }>(response);
  return data.jobs;
}

export async function getJobById(token: string, id: string): Promise<Job> {
  const response = await fetch(`${API_BASE_URL}/jobs/${id}`, {
    headers: buildAuthHeaders(token),
  });

  const data = await parseJson<{ job: Job }>(response);
  return data.job;
}
