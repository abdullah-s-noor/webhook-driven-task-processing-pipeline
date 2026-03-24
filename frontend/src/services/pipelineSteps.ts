const API_BASE_URL = "http://localhost:3000";

export type StepType =
  | "require_fields"
  | "filter"
  | "transform"
  | "set_fields"
  | "enrich"
  | "calculate_field"
  | "pick_fields"
  | "delay"
  | "deliver";

export interface PipelineStep {
  id: string;
  pipelineId: string;
  type: StepType;
  order: number;
  config: unknown;
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

export async function listPipelineSteps(token: string, pipelineId: string): Promise<PipelineStep[]> {
  const response = await fetch(`${API_BASE_URL}/pipeline-steps/pipeline/${pipelineId}`, {
    headers: buildAuthHeaders(token),
  });

  const data = await parseJson<{ steps: PipelineStep[] }>(response);
  return data.steps;
}

export async function createPipelineStep(
  token: string,
  payload: {
    pipelineId: string;
    type: StepType;
    order: number;
    config: unknown;
  }
): Promise<PipelineStep> {
  const response = await fetch(`${API_BASE_URL}/pipeline-steps`, {
    method: "POST",
    headers: buildAuthHeaders(token),
    body: JSON.stringify(payload),
  });

  const data = await parseJson<{ step: PipelineStep }>(response);
  return data.step;
}

export async function deletePipelineStep(token: string, stepId: string): Promise<PipelineStep> {
  const response = await fetch(`${API_BASE_URL}/pipeline-steps/${stepId}`, {
    method: "DELETE",
    headers: buildAuthHeaders(token),
  });

  const data = await parseJson<{ step: PipelineStep }>(response);
  return data.step;
}
