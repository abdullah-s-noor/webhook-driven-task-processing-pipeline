import type { JsonValue, PayloadObject } from "../types/pipeline.js";
import type { StepExecutionResult } from "./index.js";

interface PickFieldsConfig {
  fields: string[];
}

function isPickFieldsConfig(config: unknown): config is PickFieldsConfig {
  const value = config as Record<string, unknown>;

  return (
    typeof config === "object" &&
    config !== null &&
    !Array.isArray(config) &&
    Array.isArray(value.fields) &&
    value.fields.every((field): field is string => typeof field === "string")
  );
}

export function pickFieldsStep(
  payload: PayloadObject,
  config: JsonValue
): StepExecutionResult {
  if (!isPickFieldsConfig(config)) {
    throw new Error("pick_fields config.fields must be a string array");
  }

  const nextPayload: PayloadObject = {};
  const missingFields = config.fields.filter((field) => !(field in payload));

  if (missingFields.length) {
    throw new Error(`Missing output fields: ${missingFields.join(", ")}`);
  }

  for (const field of config.fields) {
    nextPayload[field] = payload[field];
  }

  return { payload: nextPayload };
}
