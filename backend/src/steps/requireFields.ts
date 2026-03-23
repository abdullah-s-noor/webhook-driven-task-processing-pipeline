import type { JsonValue, PayloadObject } from "../types/pipeline.js";
import type { StepExecutionResult } from "./index.js";

interface RequireFieldsConfig {
  fields: string[];
}

function isRequireFieldsConfig(config: unknown): config is RequireFieldsConfig {
  const value = config as Record<string, unknown>;

  return (
    typeof config === "object" &&
    config !== null &&
    !Array.isArray(config) &&
    Array.isArray(value.fields) &&
    value.fields.every((field): field is string => typeof field === "string")
  );
}

export function requireFieldsStep(
  payload: PayloadObject,
  config: JsonValue
): StepExecutionResult {
  if (!isRequireFieldsConfig(config)) {
    throw new Error("require_fields config.fields must be a string array");
  }

  const missingFields = config.fields.filter((field) => !(field in payload));

  if (missingFields.length) {
    throw new Error(`Missing required fields: ${missingFields.join(", ")}`);
  }

  return { payload };
}
