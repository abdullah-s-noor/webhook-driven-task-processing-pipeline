import type { JsonValue, PayloadObject } from "../types/pipeline.js";
import type { StepExecutionResult } from "./index.js";

type FilterOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains";

interface FilterCondition {
  field: string;
  op: FilterOperator;
  value: JsonValue;
}

interface FilterConfig {
  conditions: FilterCondition[];
}

function isFilterConfig(config: unknown): config is FilterConfig {
  const value = config as Record<string, unknown>;

  return (
    typeof config === "object" &&
    config !== null &&
    !Array.isArray(config) &&
    Array.isArray(value.conditions)
  );
}

function formatValue(value: JsonValue | undefined): string {
  return value === undefined ? "undefined" : JSON.stringify(value);
}

function evaluateCondition(actual: JsonValue | undefined, condition: FilterCondition) {
  switch (condition.op) {
    case "eq":
      return actual === condition.value;
    case "neq":
      return actual !== condition.value;
    case "gt":
      return typeof actual === "number" && typeof condition.value === "number" && actual > condition.value;
    case "gte":
      return typeof actual === "number" && typeof condition.value === "number" && actual >= condition.value;
    case "lt":
      return typeof actual === "number" && typeof condition.value === "number" && actual < condition.value;
    case "lte":
      return typeof actual === "number" && typeof condition.value === "number" && actual <= condition.value;
    case "contains":
      return typeof actual === "string" && typeof condition.value === "string" && actual.includes(condition.value);
    default:
      return false;
  }
}

export function filterStep(
  payload: PayloadObject,
  config: JsonValue
): StepExecutionResult {
  if (!isFilterConfig(config)) {
    throw new Error("filter config.conditions must be an array");
  }

  for (const condition of config.conditions) {
    const actual = payload[condition.field];
    const passed = evaluateCondition(actual, condition);

    if (!passed) {
      return {
        payload,
        filtered: true,
        reason: `${condition.field} ${condition.op} ${formatValue(condition.value)} - got: ${formatValue(actual)}`,
      };
    }
  }

  return { payload };
}
