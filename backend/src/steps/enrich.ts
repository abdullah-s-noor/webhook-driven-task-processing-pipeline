import type { JsonValue, PayloadObject } from "../types/pipeline.js";
import type { StepExecutionResult } from "./index.js";

interface EnrichConfig {
  key: string;
  value: JsonValue;
}

function isEnrichConfig(config: unknown): config is EnrichConfig {
  const value = config as Record<string, unknown>;

  return (
    typeof config === "object" &&
    config !== null &&
    !Array.isArray(config) &&
    typeof value.key === "string"
  );
}

export function enrichStep(
  payload: PayloadObject,
  config: JsonValue
): StepExecutionResult {
  if (!isEnrichConfig(config)) {
    throw new Error("enrich config.key must be a string");
  }

  return {
    payload: {
      ...payload,
      [config.key]: config.value,
    },
  };
}
