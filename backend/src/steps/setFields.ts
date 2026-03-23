import type { JsonValue, PayloadObject } from "../types/pipeline.js";
import type { StepExecutionResult } from "./index.js";

interface SetFieldsConfig {
  values: PayloadObject;
}

function isSetFieldsConfig(config: unknown): config is SetFieldsConfig {
  const value = config as Record<string, unknown>;

  return (
    typeof config === "object" &&
    config !== null &&
    !Array.isArray(config) &&
    typeof value.values === "object" &&
    value.values !== null &&
    !Array.isArray(value.values)
  );
}

export function setFieldsStep(
  payload: PayloadObject,
  config: JsonValue
): StepExecutionResult {
  if (!isSetFieldsConfig(config)) {
    throw new Error("set_fields config.values must be an object");
  }

  return {
    payload: {
      ...payload,
      ...config.values,
    },
  };
}
