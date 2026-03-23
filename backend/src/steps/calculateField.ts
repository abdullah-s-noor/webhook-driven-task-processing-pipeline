import type { JsonValue, PayloadObject } from "../types/pipeline.js";
import type { StepExecutionResult } from "./index.js";

type CalculateOperation = "add" | "subtract" | "multiply" | "divide";

interface CalculateFieldConfig {
  field: string;
  op: CalculateOperation;
  value: number;
}

function isCalculateFieldConfig(config: unknown): config is CalculateFieldConfig {
  const value = config as Record<string, unknown>;

  return (
    typeof config === "object" &&
    config !== null &&
    !Array.isArray(config) &&
    typeof value.field === "string" &&
    typeof value.op === "string" &&
    typeof value.value === "number"
  );
}

export function calculateFieldStep(
  payload: PayloadObject,
  config: JsonValue
): StepExecutionResult {
  if (!isCalculateFieldConfig(config)) {
    throw new Error("calculate_field config must include field, op and numeric value");
  }

  if (!(config.field in payload)) {
    throw new Error(`Missing field: ${config.field}`);
  }

  const currentValue = payload[config.field];

  if (typeof currentValue !== "number") {
    throw new Error(`Field is not numeric: ${config.field}`);
  }

  let nextValue: number;

  switch (config.op) {
    case "add":
      nextValue = currentValue + config.value;
      break;
    case "subtract":
      nextValue = currentValue - config.value;
      break;
    case "multiply":
      nextValue = currentValue * config.value;
      break;
    case "divide":
      if (config.value === 0) {
        throw new Error("Cannot divide by zero");
      }
      nextValue = currentValue / config.value;
      break;
    default:
      throw new Error(`Unsupported operation: ${config.op}`);
  }

  return {
    payload: {
      ...payload,
      [config.field]: nextValue,
    },
  };
}
