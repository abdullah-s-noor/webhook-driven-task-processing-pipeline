export type StepType = "filter" | "transform" | "delay" | "deliver";

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[];

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
