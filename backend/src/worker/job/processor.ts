import { create as createDeliveries } from "../../db/queries/deliveries.js";
import { updateStatus as updateJobStatus } from "../../db/queries/jobs.js";
import { executeStep } from "../../steps/index.js";
import type { Job } from "../../types/job.js";
import type { JsonValue, PayloadObject, StepType } from "../../types/pipeline.js";

interface JobStepSnapshot {
  type: StepType;
  config: JsonValue;
  order: number;
}

function toPayloadObject(payload: JsonValue): PayloadObject {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new Error("Job payload must be a JSON object");
  }

  return payload as PayloadObject;
}

function toSortedSteps(stepsSnapshot: JsonValue): JobStepSnapshot[] {
  if (!Array.isArray(stepsSnapshot)) {
    throw new Error("steps_snapshot must be an array");
  }

  const parsedSteps = stepsSnapshot.map((step) => {
    if (typeof step !== "object" || step === null || Array.isArray(step)) {
      throw new Error("Invalid step in steps_snapshot");
    }

    const rawStep = step as Record<string, unknown>;

    if (typeof rawStep.type !== "string") {
      throw new Error("Invalid step type in steps_snapshot");
    }

    if (!Number.isInteger(rawStep.order)) {
      throw new Error("Invalid step order in steps_snapshot");
    }

    return {
      type: rawStep.type as StepType,
      config: (rawStep.config as JsonValue) ?? null,
      order: rawStep.order as number,
    };
  });

  return parsedSteps.sort((a, b) => a.order - b.order);
}

async function failJob(job: Job, errorMessage: string): Promise<void> {
  await updateJobStatus(job.id, {
    status: "failed",
    filterReason: errorMessage,
    processedAt: new Date(),
  });
}

export async function processJob(job: Job): Promise<void> {
  await updateJobStatus(job.id, {
    status: "processing",
    filterReason: null,
  });

  try {
    const steps = toSortedSteps(job.stepsSnapshot);
    let currentPayload = toPayloadObject(job.payload);

    for (const step of steps) {
      const result = executeStep(step.type, currentPayload, step.config);

      if (result.filtered) {
        // No dedicated "filtered" status in the current schema, so we store the reason and mark failed.
        await updateJobStatus(job.id, {
          status: "failed",
          processedPayload: currentPayload,
          filterReason: result.reason ?? "Filtered by pipeline rule",
          processedAt: new Date(),
        });
        return;
      }

      currentPayload = result.payload;
    }

    await updateJobStatus(job.id, {
      status: "processed",
      processedPayload: currentPayload,
      filterReason: null,
      processedAt: new Date(),
    });

    await createDeliveries(job.id);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown processing error";
    await failJob(job, message);
  }
}
