import type { JsonValue, PayloadObject } from "../types/pipeline.js";
import type { StepExecutionResult } from "./index.js";

interface RenameMapping {
  from: string;
  to: string;
}

interface TransformConfig {
  mappings: RenameMapping[];
}

function isTransformConfig(config: unknown): config is TransformConfig {
  const value = config as Record<string, unknown>;

  return (
    typeof config === "object" &&
    config !== null &&
    !Array.isArray(config) &&
    Array.isArray(value.mappings)
  );
}

export function transformStep(
  payload: PayloadObject,
  config: JsonValue
): StepExecutionResult {
  if (!isTransformConfig(config)) {
    throw new Error("transform config.mappings must be an array");
  }

  const nextPayload: PayloadObject = { ...payload };

  for (const mapping of config.mappings) {
    if (!(mapping.from in nextPayload)) {
      throw new Error(`Source field not found: ${mapping.from}`);
    }

    nextPayload[mapping.to] = nextPayload[mapping.from];
    delete nextPayload[mapping.from];
  }

  return { payload: nextPayload };
}
