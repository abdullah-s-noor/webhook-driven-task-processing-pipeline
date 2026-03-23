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

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

export type PayloadObject = { [key: string]: JsonValue };

export interface Pipeline {
  id: string;
  userId: string;
  name: string;
  username: string;
  sourceUrl: string;
  signingSecret: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PipelineStep {
  id: string;
  pipelineId: string;
  type: StepType;
  config: JsonValue;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscriber {
  id: string;
  pipelineId: string;
  url: string;
  createdAt: Date;
}
