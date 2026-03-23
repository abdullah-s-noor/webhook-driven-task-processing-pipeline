import type { JsonValue, PayloadObject, StepType } from "../types/pipeline.js";
import { calculateFieldStep } from "./calculateField.js";
import { enrichStep } from "./enrich.js";
import { filterStep } from "./filter.js";
import { pickFieldsStep } from "./pickFields.js";
import { requireFieldsStep } from "./requireFields.js";
import { setFieldsStep } from "./setFields.js";
import { transformStep } from "./transform.js";

export interface StepExecutionResult {
  payload: PayloadObject;
  filtered?: boolean;
  reason?: string;
}

export type StepExecutor = (
  payload: PayloadObject,
  config: JsonValue
) => StepExecutionResult;

export const stepRegistry: Partial<Record<StepType, StepExecutor>> = {
  require_fields: requireFieldsStep,
  filter: filterStep,
  transform: transformStep,
  set_fields: setFieldsStep,
  enrich: enrichStep,
  calculate_field: calculateFieldStep,
  pick_fields: pickFieldsStep,
};

export function executeStep(
  type: StepType,
  payload: PayloadObject,
  config: JsonValue
): StepExecutionResult {
  const executor = stepRegistry[type];

  if (!executor) {
    throw new Error(`Unsupported step type: ${type}`);
  }

  return executor(payload, config);
}
