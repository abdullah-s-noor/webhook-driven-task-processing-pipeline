import { useEffect, useMemo, useRef, useState } from "react";
import {
  createPipeline,
  deletePipeline,
  listPipelines,
  type Pipeline,
} from "../services/pipelines";
import {
  createPipelineStep,
  deletePipelineStep,
  listPipelineSteps,
  updatePipelineStep,
  type PipelineStep,
  type StepType,
} from "../services/pipelineSteps";
import {
  createSubscriber,
  deleteSubscriber,
  listSubscribers,
  updateSubscriber,
  type Subscriber,
} from "../services/subscribers";
import {
  createJob,
  listJobsByPipeline,
  type Job,
} from "../services/jobs";
import "./PipelinePage.css";

interface PipelinePageProps {
  token: string;
  onLogout: () => void;
  onNavigateJobs: (pipelineId?: string) => void;
  onNavigateMetrics: () => void;
}

type Section = "pipelines" | "steps" | "subscribers" | "jobs";
type JobsFilter = "all" | "succeeded" | "failed" | "pending";

const STEP_TYPES: StepType[] = [
  "require_fields",
  "filter",
  "transform",
  "set_fields",
  "enrich",
  "calculate_field",
  "pick_fields",
];

const FILTER_OPERATORS: Array<{ label: string; value: string }> = [
  { label: "=", value: "eq" },
  { label: "!=", value: "neq" },
  { label: ">", value: "gt" },
  { label: ">=", value: "gte" },
  { label: "<", value: "lt" },
  { label: "<=", value: "lte" },
  { label: "contains", value: "contains" },
];

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePrimitive(value: string): unknown {
  const trimmed = value.trim();

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;
  if (trimmed === "null") return null;
  if (trimmed !== "" && !Number.isNaN(Number(trimmed))) return Number(trimmed);

  return trimmed;
}

function parseKeyValuePairs(value: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  value.split(",").forEach((chunk) => {
    const [rawKey, ...rest] = chunk.split("=");
    const key = rawKey?.trim() ?? "";
    const rawValue = rest.join("=").trim();

    if (key && rawValue) {
      result[key] = parsePrimitive(rawValue);
    }
  });

  return result;
}

function parseMappingPairs(value: string): Array<{ from: string; to: string }> {
  return value
    .split(",")
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const [from = "", to = ""] = pair.split(":");
      return { from: from.trim(), to: to.trim() };
    })
    .filter((item) => item.from && item.to);
}

function formatShortDate(value?: string): string {
  if (!value) return "-";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function formatStepLabel(type: StepType): string {
  return type.replaceAll("_", " ");
}

function toJobsUiStatus(status: Job["status"]): Exclude<JobsFilter, "all"> {
  if (status === "processed") return "succeeded";
  if (status === "pending" || status === "processing") return "pending";
  return "failed";
}

function formatJobDuration(createdAt?: string, processedAt?: string | null): string {
  if (!createdAt || !processedAt) return "-";

  const created = new Date(createdAt);
  const processed = new Date(processedAt);
  if (Number.isNaN(created.getTime()) || Number.isNaN(processed.getTime())) return "-";

  const diffMs = Math.max(0, processed.getTime() - created.getTime());
  return `${(diffMs / 1000).toFixed(1)}s`;
}

function getDefaultConfigForStep(type: StepType): unknown {
  switch (type) {
    case "require_fields":
      return { fields: ["id"] };
    case "filter":
      return {
        conditions: [{ field: "amount", op: "gt", value: 0 }],
      };
    case "transform":
      return {
        mappings: [{ from: "firstName", to: "first_name" }],
      };
    case "set_fields":
      return {
        values: { source: "webhookpipe" },
      };
    case "enrich":
      return {
        key: "env",
        value: "production",
      };
    case "calculate_field":
      return {
        field: "score",
        op: "add",
        value: 1,
      };
    case "pick_fields":
      return { fields: ["id"] };
    case "delay":
      return { milliseconds: 250 };
    case "deliver":
      return {};
    default:
      return {};
  }
}

function getEmptyConfigForStep(type: StepType): Record<string, unknown> {
  switch (type) {
    case "require_fields":
      return { fields: [] };
    case "filter":
      return {
        conditions: [{ field: "", op: "gt", value: "" }],
      };
    case "transform":
      return {
        mappings: [{ from: "", to: "" }],
      };
    case "set_fields":
      return {
        values: {},
      };
    case "enrich":
      return {
        key: "",
        value: "",
      };
    case "calculate_field":
      return {
        field: "",
        op: "add",
        value: "",
      };
    case "pick_fields":
      return { fields: [] };
    case "delay":
      return { milliseconds: "" };
    case "deliver":
      return {};
    default:
      return {};
  }
}

function summarizeStepConfig(type: StepType, config: unknown): string {
  if (!config || typeof config !== "object") return "No config";

  const value = config as Record<string, unknown>;

  if (type === "filter" && Array.isArray(value.conditions) && value.conditions.length > 0) {
    const condition = value.conditions[0] as Record<string, unknown>;
    return `${String(condition.field ?? "field")} ${String(condition.op ?? "eq")} ${String(condition.value ?? "-")}`;
  }

  if (type === "transform" && Array.isArray(value.mappings) && value.mappings.length > 0) {
    const mapping = value.mappings[0] as Record<string, unknown>;
    return `${String(mapping.from ?? "source")} -> ${String(mapping.to ?? "target")}`;
  }

  if (type === "require_fields" && Array.isArray(value.fields)) {
    return `required: ${value.fields.join(", ")}`;
  }

  if (type === "pick_fields" && Array.isArray(value.fields)) {
    return `pick: ${value.fields.join(", ")}`;
  }

  if (type === "set_fields" && value.values && typeof value.values === "object") {
    return Object.entries(value.values as Record<string, unknown>)
      .slice(0, 2)
      .map(([key, item]) => `${key}=${String(item)}`)
      .join(", ");
  }

  if (type === "enrich") {
    return `${String(value.key ?? "key")} = ${String(value.value ?? "value")}`;
  }

  if (type === "calculate_field") {
    return `${String(value.field ?? "field")} ${String(value.op ?? "add")} ${String(value.value ?? 0)}`;
  }

  return "Configured step";
}

type EditStepDraft = {
  key: string;
  id?: string;
  type: StepType;
  config: Record<string, unknown>;
};

type EditSubscriberDraft = {
  key: string;
  id?: string;
  url: string;
};

function makeEditStepDraft(step: PipelineStep): EditStepDraft {
  return {
    key: step.id,
    id: step.id,
    type: step.type,
    config:
      step.config && typeof step.config === "object" && !Array.isArray(step.config)
        ? ({ ...step.config } as Record<string, unknown>)
        : (getDefaultConfigForStep(step.type) as Record<string, unknown>),
  };
}

function makeNewEditStepDraft(type: StepType, index: number): EditStepDraft {
  return {
    key: `new-${type}-${Date.now()}-${index}`,
    type,
    config: getEmptyConfigForStep(type),
  };
}

function makeEditSubscriberDraft(subscriber: Subscriber): EditSubscriberDraft {
  return {
    key: subscriber.id,
    id: subscriber.id,
    url: subscriber.url,
  };
}

function makeDefaultTestPayload(): string {
  return JSON.stringify(
    {
      firstName: "Ahmed",
      price: 250,
      branch: "main",
      qty: 2,
    },
    null,
    2
  );
}

function makeRandomTestPayload(): string {
  const names = ["Omar", "Lina", "Sara", "Yousef", "Noor"];
  const branches = ["main", "east", "north", "online"];
  const payload = {
    firstName: names[Math.floor(Math.random() * names.length)],
    price: Math.floor(Math.random() * 900) + 100,
    branch: branches[Math.floor(Math.random() * branches.length)],
    qty: Math.floor(Math.random() * 5) + 1,
  };

  return JSON.stringify(payload, null, 2);
}

export default function PipelinePage({
  token,
  onLogout,
  onNavigateJobs,
  onNavigateMetrics,
}: PipelinePageProps) {
  const [section, setSection] = useState<Section>("pipelines");

  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("");

  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [stepType, setStepType] = useState<StepType>("filter");
  const [stepOrder, setStepOrder] = useState(0);
  const [requireFieldsText, setRequireFieldsText] = useState("");
  const [filterField, setFilterField] = useState("");
  const [filterOperator, setFilterOperator] = useState("gt");
  const [filterValue, setFilterValue] = useState("");
  const [transformRenameText, setTransformRenameText] = useState("");
  const [setFieldsText, setSetFieldsText] = useState("");
  const [enrichKey, setEnrichKey] = useState("");
  const [enrichValue, setEnrichValue] = useState("");
  const [calcField, setCalcField] = useState("");
  const [calcOp, setCalcOp] = useState<"add" | "subtract" | "multiply" | "divide">("add");
  const [calcValue, setCalcValue] = useState("");
  const [pickFieldsText, setPickFieldsText] = useState("");
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subscriberUrl, setSubscriberUrl] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [jobsFilter, setJobsFilter] = useState<JobsFilter>("all");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Welcome back.");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [openPipelineId, setOpenPipelineId] = useState("");
  const [revealSecret, setRevealSecret] = useState(false);
  const [createStepsDraft, setCreateStepsDraft] = useState<EditStepDraft[]>([]);
  const [createSubscribersDraft, setCreateSubscribersDraft] = useState<EditSubscriberDraft[]>([]);
  const [createValidationErrors, setCreateValidationErrors] = useState<Record<string, string>>({});
  const suppressAutoOpenRef = useRef(false);
  const [pipelineDetails, setPipelineDetails] = useState<
    Record<string, { steps: PipelineStep[]; subscribers: Subscriber[] }>
  >({});
  const [pipelineDetailsLoading, setPipelineDetailsLoading] = useState<Record<string, boolean>>({});
  const [isEditingPipeline, setIsEditingPipeline] = useState(false);
  const [editPipelineName, setEditPipelineName] = useState("");
  const [editStepsDraft, setEditStepsDraft] = useState<EditStepDraft[]>([]);
  const [editSubscribersDraft, setEditSubscribersDraft] = useState<EditSubscriberDraft[]>([]);
  const [editValidationErrors, setEditValidationErrors] = useState<Record<string, string>>({});
  const [testWebhookPayload, setTestWebhookPayload] = useState(makeDefaultTestPayload());
  const [testWebhookError, setTestWebhookError] = useState("");

  const openPipeline = useMemo(
    () => pipelines.find((pipeline) => pipeline.id === openPipelineId) ?? null,
    [pipelines, openPipelineId]
  );

  const activePipelinesCount = useMemo(
    () => pipelines.filter((pipeline) => pipeline.isActive).length,
    [pipelines]
  );

  const orderedSteps = useMemo(
    () => [...steps].sort((a, b) => a.order - b.order),
    [steps]
  );
  const jobsSorted = useMemo(
    () =>
      [...jobs].sort(
        (a, b) =>
          new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime()
      ),
    [jobs]
  );
  const jobsCounts = useMemo(
    () => ({
      total: jobsSorted.length,
      succeeded: jobsSorted.filter((job) => toJobsUiStatus(job.status) === "succeeded").length,
      failed: jobsSorted.filter((job) => toJobsUiStatus(job.status) === "failed").length,
      pending: jobsSorted.filter((job) => toJobsUiStatus(job.status) === "pending").length,
    }),
    [jobsSorted]
  );
  const jobsFiltered = useMemo(
    () =>
      jobsFilter === "all"
        ? jobsSorted
        : jobsSorted.filter((job) => toJobsUiStatus(job.status) === jobsFilter),
    [jobsFilter, jobsSorted]
  );

  function resetStepFields() {
    setRequireFieldsText("");
    setFilterField("");
    setFilterOperator("gt");
    setFilterValue("");
    setTransformRenameText("");
    setSetFieldsText("");
    setEnrichKey("");
    setEnrichValue("");
    setCalcField("");
    setCalcOp("add");
    setCalcValue("");
    setPickFieldsText("");
  }

  function buildStepConfig(): unknown {
    switch (stepType) {
      case "require_fields": {
        const fields = splitCsv(requireFieldsText);
        if (fields.length === 0) throw new Error("Add required fields");
        return { fields };
      }

      case "filter": {
        if (!filterField.trim() || !filterValue.trim()) {
          throw new Error("Filter field and value are required");
        }
        return {
          conditions: [
            {
              field: filterField.trim(),
              op: filterOperator,
              value: parsePrimitive(filterValue),
            },
          ],
        };
      }

      case "transform": {
        return {
          mappings: parseMappingPairs(transformRenameText),
        };
      }

      case "set_fields": {
        const fields = parseKeyValuePairs(setFieldsText);
        if (Object.keys(fields).length === 0) throw new Error("Add set fields");
        return { values: fields };
      }

      case "enrich": {
        if (!enrichKey.trim() || !enrichValue.trim()) {
          throw new Error("Enrich key and value are required");
        }
        return {
          key: enrichKey.trim(),
          value: parsePrimitive(enrichValue),
        };
      }

      case "calculate_field": {
        if (!calcField.trim() || !calcValue.trim()) {
          throw new Error("Calculate field, op and value are required");
        }
        return { field: calcField.trim(), op: calcOp, value: Number(calcValue) };
      }

      case "pick_fields": {
        const fields = splitCsv(pickFieldsText);
        if (fields.length === 0) throw new Error("Pick fields is required");
        return { fields };
      }

      default:
        return {};
    }
  }

  async function loadPipelines() {
    setLoading(true);
    setError("");

    try {
      const data = await listPipelines(token);
      setPipelines(data);

      if (data.length > 0) {
        setSelectedId((current) => current || data[0].id);
      } else {
        setSelectedId("");
        setSteps([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  }

  async function loadSteps(pipelineId: string) {
    if (!pipelineId) {
      setSteps([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await listPipelineSteps(token, pipelineId);
      setSteps(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load steps");
    } finally {
      setLoading(false);
    }
  }

  async function loadPipelineSubscribers(pipelineId: string) {
    if (!pipelineId) {
      setSubscribers([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await listSubscribers(token, pipelineId);
      setSubscribers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscribers");
    } finally {
      setLoading(false);
    }
  }

  async function loadPipelineDetails(pipelineId: string) {
    if (!pipelineId) return;
    if (pipelineDetailsLoading[pipelineId]) return;

    setPipelineDetailsLoading((current) => ({ ...current, [pipelineId]: true }));

    try {
      const [nextSteps, nextSubscribers] = await Promise.all([
        listPipelineSteps(token, pipelineId),
        listSubscribers(token, pipelineId),
      ]);
      const payload = {
        steps: [...nextSteps].sort((a, b) => a.order - b.order),
        subscribers: nextSubscribers,
      };

      setPipelineDetails((current) => ({
        ...current,
        [pipelineId]: payload,
      }));

      return payload;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipeline details");
    } finally {
      setPipelineDetailsLoading((current) => ({ ...current, [pipelineId]: false }));
    }

    return null;
  }

  async function handleCreatePipelineFromDialog() {
    if (!name.trim()) {
      setError("Pipeline name is required");
      return;
    }

    const nextErrors: Record<string, string> = {};
    const setStepError = (stepKey: string, field: string, messageText: string) => {
      nextErrors[`step:${stepKey}:${field}`] = messageText;
    };

    createStepsDraft.forEach((step) => {
      const conditions = Array.isArray(step.config.conditions)
        ? (step.config.conditions as Array<Record<string, unknown>>)
        : [];
      const firstCondition = conditions[0] ?? {};
      const mappings = Array.isArray(step.config.mappings)
        ? (step.config.mappings as Array<Record<string, unknown>>)
        : [];
      const firstMapping = mappings[0] ?? {};
      const fields = Array.isArray(step.config.fields) ? (step.config.fields as Array<unknown>) : [];
      const values =
        step.config.values && typeof step.config.values === "object"
          ? (step.config.values as Record<string, unknown>)
          : {};

      if (step.type === "filter") {
        if (!String(firstCondition.field ?? "").trim()) setStepError(step.key, "field", "Field is required");
        if (String(firstCondition.value ?? "").trim() === "") setStepError(step.key, "value", "Value is required");
      }

      if (step.type === "transform") {
        if (!String(firstMapping.from ?? "").trim()) setStepError(step.key, "from", "Source is required");
        if (!String(firstMapping.to ?? "").trim()) setStepError(step.key, "to", "Target is required");
      }

      if (step.type === "enrich") {
        if (!String(step.config.key ?? "").trim()) setStepError(step.key, "key", "Key is required");
        if (!String(step.config.value ?? "").trim()) setStepError(step.key, "value", "Value is required");
      }

      if (step.type === "require_fields" || step.type === "pick_fields") {
        if (fields.length === 0) setStepError(step.key, "fields", "At least one field is required");
      }

      if (step.type === "set_fields" && Object.keys(values).length === 0) {
        setStepError(step.key, "values", "Add at least one key=value");
      }

      if (step.type === "calculate_field") {
        const value = Number(step.config.value);
        if (!String(step.config.field ?? "").trim()) setStepError(step.key, "field", "Field is required");
        if (String(step.config.value ?? "").trim() === "" || Number.isNaN(value)) {
          setStepError(step.key, "value", "Numeric value is required");
        }
      }
    });

    createSubscribersDraft.forEach((subscriber) => {
      const nextUrl = subscriber.url.trim();
      if (!nextUrl) {
        nextErrors[`subscriber:${subscriber.key}`] = "Subscriber URL is required";
        return;
      }

      try {
        new URL(nextUrl);
      } catch {
        nextErrors[`subscriber:${subscriber.key}`] = "Invalid URL";
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      setCreateValidationErrors(nextErrors);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const pipeline = await createPipeline(token, name.trim());

      for (const [index, draftStep] of createStepsDraft.entries()) {
        await createPipelineStep(token, {
          pipelineId: pipeline.id,
          type: draftStep.type,
          order: index,
          config: draftStep.config,
        });
      }

      for (const subscriber of createSubscribersDraft) {
        await createSubscriber(token, {
          pipelineId: pipeline.id,
          url: subscriber.url.trim(),
        });
      }

      setMessage("Pipeline created successfully");
      setName("");
      setCreateStepsDraft([]);
      setCreateSubscribersDraft([]);
      setCreateValidationErrors({});
      suppressAutoOpenRef.current = true;
      setShowCreateDialog(false);
      await loadPipelines();
      await loadPipelineDetails(pipeline.id);
      setSelectedId(pipeline.id);
      setOpenPipelineId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePipeline(pipelineId: string) {
    if (!pipelineId) return;

    setLoading(true);
    setError("");

    try {
      await deletePipeline(token, pipelineId);
      setMessage("Pipeline deleted");
      setOpenPipelineId("");
      await loadPipelines();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setLoading(false);
    }
  }

  function appendCreateStep(type: StepType) {
    setCreateStepsDraft((current) => [...current, makeNewEditStepDraft(type, current.length)]);
  }

  function removeCreateStep(key: string) {
    setCreateStepsDraft((current) => current.filter((step) => step.key !== key));
  }

  function updateCreateStepType(key: string, nextType: StepType) {
    setCreateStepsDraft((current) =>
      current.map((step) =>
        step.key === key
          ? {
              ...step,
              type: nextType,
              config: getEmptyConfigForStep(nextType),
            }
          : step
      )
    );
  }

  function updateCreateStepConfig(key: string, field: string, nextValue: unknown) {
    setCreateStepsDraft((current) =>
      current.map((step) =>
        step.key === key
          ? {
              ...step,
              config: {
                ...step.config,
                [field]: nextValue,
              },
            }
          : step
      )
    );
  }

  function addCreateSubscriber() {
    setCreateSubscribersDraft((current) => [
      ...current,
      { key: `create-sub-${Date.now()}-${current.length}`, url: "" },
    ]);
  }

  function removeCreateSubscriber(key: string) {
    setCreateSubscribersDraft((current) => current.filter((subscriber) => subscriber.key !== key));
  }

  function updateCreateSubscriber(key: string, nextUrl: string) {
    setCreateSubscribersDraft((current) =>
      current.map((subscriber) => (subscriber.key === key ? { ...subscriber, url: nextUrl } : subscriber))
    );
  }

  async function copyToClipboard(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setMessage(`${label} copied`);
    } catch {
      setError(`Failed to copy ${label.toLowerCase()}`);
    }
  }

  function fillRandomTestPayload() {
    setTestWebhookError("");
    setTestWebhookPayload(makeRandomTestPayload());
  }

  async function sendTestWebhookToPipeline() {
    if (!openPipeline) return;

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(testWebhookPayload);
    } catch {
      setTestWebhookError("Payload must be valid JSON");
      return;
    }

    setLoading(true);
    setTestWebhookError("");
    setError("");

    try {
      await createJob(token, {
        pipelineId: openPipeline.id,
        payload: parsedPayload,
      });
      setMessage("Test webhook sent");
      onNavigateJobs(openPipeline.id);
    } catch (err) {
      setTestWebhookError(err instanceof Error ? err.message : "Failed to send test webhook");
    } finally {
      setLoading(false);
    }
  }

  function openCreatePipelineDialog() {
    setName("");
    setCreateStepsDraft([]);
    setCreateSubscribersDraft([]);
    setCreateValidationErrors({});
    setShowCreateDialog(true);
  }

  function closeCreatePipelineDialog() {
    setShowCreateDialog(false);
    setCreateValidationErrors({});
  }

  async function startPipelineEdit() {
    if (!openPipeline) return;

    const loaded = await loadPipelineDetails(openPipeline.id);
    const details = loaded ?? pipelineDetails[openPipeline.id];
    if (!details) return;

    setEditPipelineName(openPipeline.name);
    setEditStepsDraft(details.steps.map(makeEditStepDraft));
    setEditSubscribersDraft(details.subscribers.map(makeEditSubscriberDraft));
    setEditValidationErrors({});
    setIsEditingPipeline(true);
  }

  function appendEditStep(type: StepType) {
    setEditStepsDraft((current) => [...current, makeNewEditStepDraft(type, current.length)]);
  }

  function removeEditStep(key: string) {
    setEditStepsDraft((current) => current.filter((step) => step.key !== key));
  }

  function updateEditStepType(key: string, nextType: StepType) {
    setEditStepsDraft((current) =>
      current.map((step) =>
        step.key === key
          ? {
              ...step,
              type: nextType,
              config: getDefaultConfigForStep(nextType) as Record<string, unknown>,
            }
          : step
      )
    );
  }

  function updateEditStepConfig(key: string, field: string, nextValue: unknown) {
    setEditStepsDraft((current) =>
      current.map((step) =>
        step.key === key
          ? {
              ...step,
              config: {
                ...step.config,
                [field]: nextValue,
              },
            }
          : step
      )
    );
  }

  function updateEditSubscriber(key: string, url: string) {
    setEditSubscribersDraft((current) =>
      current.map((subscriber) => (subscriber.key === key ? { ...subscriber, url } : subscriber))
    );
  }

  function addEditSubscriber() {
    setEditSubscribersDraft((current) => [
      ...current,
      { key: `new-sub-${Date.now()}-${current.length}`, url: "" },
    ]);
  }

  function removeEditSubscriber(key: string) {
    setEditSubscribersDraft((current) => current.filter((subscriber) => subscriber.key !== key));
  }

  async function savePipelineChanges() {
    if (!openPipeline) return;

    const nextErrors: Record<string, string> = {};
    const setStepError = (stepKey: string, field: string, messageText: string) => {
      nextErrors[`step:${stepKey}:${field}`] = messageText;
    };

    editStepsDraft.forEach((step) => {
      const conditions = Array.isArray(step.config.conditions)
        ? (step.config.conditions as Array<Record<string, unknown>>)
        : [];
      const firstCondition = conditions[0] ?? {};
      const mappings = Array.isArray(step.config.mappings)
        ? (step.config.mappings as Array<Record<string, unknown>>)
        : [];
      const firstMapping = mappings[0] ?? {};
      const fields = Array.isArray(step.config.fields) ? (step.config.fields as Array<unknown>) : [];
      const values =
        step.config.values && typeof step.config.values === "object"
          ? (step.config.values as Record<string, unknown>)
          : {};

      if (step.type === "filter") {
        if (!String(firstCondition.field ?? "").trim()) setStepError(step.key, "field", "Field is required");
        if (String(firstCondition.value ?? "").trim() === "") setStepError(step.key, "value", "Value is required");
      }

      if (step.type === "transform") {
        if (!String(firstMapping.from ?? "").trim()) setStepError(step.key, "from", "Source is required");
        if (!String(firstMapping.to ?? "").trim()) setStepError(step.key, "to", "Target is required");
      }

      if (step.type === "enrich") {
        if (!String(step.config.key ?? "").trim()) setStepError(step.key, "key", "Key is required");
        if (!String(step.config.value ?? "").trim()) setStepError(step.key, "value", "Value is required");
      }

      if (step.type === "require_fields" || step.type === "pick_fields") {
        if (fields.length === 0) setStepError(step.key, "fields", "At least one field is required");
      }

      if (step.type === "set_fields") {
        if (Object.keys(values).length === 0) {
          setStepError(step.key, "values", "Add at least one key=value");
        }
      }

      if (step.type === "calculate_field") {
        const value = Number(step.config.value);
        if (!String(step.config.field ?? "").trim()) setStepError(step.key, "field", "Field is required");
        if (String(step.config.value ?? "").trim() === "" || Number.isNaN(value)) {
          setStepError(step.key, "value", "Numeric value is required");
        }
      }
    });

    editSubscribersDraft.forEach((subscriber) => {
      const nextUrl = subscriber.url.trim();
      if (!nextUrl) {
        nextErrors[`subscriber:${subscriber.key}`] = "Subscriber URL is required";
        return;
      }

      try {
        new URL(nextUrl);
      } catch {
        nextErrors[`subscriber:${subscriber.key}`] = "Invalid URL";
      }
    });

    if (Object.keys(nextErrors).length > 0) {
      setEditValidationErrors(nextErrors);
      return;
    }

    setEditValidationErrors({});
    setLoading(true);
    setError("");

    try {
      const original = pipelineDetails[openPipeline.id] ?? { steps: [], subscribers: [] };
      const originalSubscribersById = new Map(original.subscribers.map((subscriber) => [subscriber.id, subscriber]));

      const nextStepIds = new Set(editStepsDraft.filter((step) => step.id).map((step) => step.id as string));
      const deletedSteps = original.steps.filter((step) => !nextStepIds.has(step.id));

      for (const step of deletedSteps) {
        await deletePipelineStep(token, step.id);
      }

      for (const [index, draftStep] of editStepsDraft.entries()) {
        const payload = {
          type: draftStep.type,
          order: index,
          config: draftStep.config,
        };

        if (draftStep.id) {
          await updatePipelineStep(token, draftStep.id, payload);
        } else {
          await createPipelineStep(token, {
            pipelineId: openPipeline.id,
            ...payload,
          });
        }
      }

      const nextSubscriberIds = new Set(
        editSubscribersDraft.filter((subscriber) => subscriber.id).map((subscriber) => subscriber.id as string)
      );
      const deletedSubscribers = original.subscribers.filter(
        (subscriber) => !nextSubscriberIds.has(subscriber.id)
      );

      for (const subscriber of deletedSubscribers) {
        await deleteSubscriber(token, subscriber.id);
      }

      for (const draftSubscriber of editSubscribersDraft) {
        const nextUrl = draftSubscriber.url.trim();
        if (!nextUrl) continue;

        if (draftSubscriber.id) {
          const originalSubscriber = originalSubscribersById.get(draftSubscriber.id);
          if (originalSubscriber && originalSubscriber.url !== nextUrl) {
            await updateSubscriber(token, draftSubscriber.id, { url: nextUrl });
          }
        } else {
          await createSubscriber(token, {
            pipelineId: openPipeline.id,
            url: nextUrl,
          });
        }
      }

      setMessage("Pipeline updated");
      setIsEditingPipeline(false);
      await loadPipelineDetails(openPipeline.id);
      await loadPipelines();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateStep() {
    if (!selectedId) {
      setError("Select a pipeline first");
      return;
    }

    let parsedConfig: unknown;

    try {
      parsedConfig = buildStepConfig();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid step config");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createPipelineStep(token, {
        pipelineId: selectedId,
        type: stepType,
        order: stepOrder,
        config: parsedConfig,
      });

      setMessage("Step created");
      resetStepFields();
      await loadSteps(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create step");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteStep(stepId: string) {
    setLoading(true);
    setError("");

    try {
      await deletePipelineStep(token, stepId);
      setMessage("Step deleted");
      await loadSteps(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete step");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateSubscriber() {
    if (!selectedId) {
      setError("Select a pipeline first");
      return;
    }

    if (!subscriberUrl.trim()) {
      setError("Subscriber URL is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createSubscriber(token, {
        pipelineId: selectedId,
        url: subscriberUrl.trim(),
      });
      setSubscriberUrl("");
      setMessage("Subscriber added");
      await loadPipelineSubscribers(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create subscriber");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSubscriber(subscriberId: string) {
    setLoading(true);
    setError("");

    try {
      await deleteSubscriber(token, subscriberId);
      setMessage("Subscriber deleted");
      await loadPipelineSubscribers(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete subscriber");
    } finally {
      setLoading(false);
    }
  }

  async function loadPipelineJobs(pipelineId: string) {
    if (!pipelineId) {
      setJobs([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await listJobsByPipeline(token, pipelineId);
      setJobs(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPipelines();
  }, []);

  useEffect(() => {
    if (section === "steps") {
      void loadSteps(selectedId);
    }
    if (section === "subscribers") {
      void loadPipelineSubscribers(selectedId);
    }
    if (section === "jobs") {
      void loadPipelineJobs(selectedId);
    }
  }, [section, selectedId]);

  useEffect(() => {
    if (section === "jobs") {
      setJobsFilter("all");
    }
  }, [section, selectedId]);

  useEffect(() => {
    resetStepFields();
  }, [stepType]);

  useEffect(() => {
    if (section !== "pipelines") return;

    for (const pipeline of pipelines) {
      if (!pipelineDetails[pipeline.id] && !pipelineDetailsLoading[pipeline.id]) {
        void loadPipelineDetails(pipeline.id);
      }
    }
  }, [section, pipelines, pipelineDetails, pipelineDetailsLoading]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      closeCreatePipelineDialog();
      setOpenPipelineId("");
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!openPipelineId) {
      setIsEditingPipeline(false);
      setEditValidationErrors({});
      setTestWebhookError("");
    }
  }, [openPipelineId]);

  useEffect(() => {
    if (openPipelineId) {
      setTestWebhookPayload(makeDefaultTestPayload());
      setTestWebhookError("");
    }
  }, [openPipelineId]);

  useEffect(() => {
    function handlePointerDown() {
      if (suppressAutoOpenRef.current) {
        suppressAutoOpenRef.current = false;
      }
    }

    window.addEventListener("pointerdown", handlePointerDown, true);
    return () => window.removeEventListener("pointerdown", handlePointerDown, true);
  }, []);

  return (
    <main className="pipeline-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-icon">⚡</div>
          <div>
            <h2>WebhookPipe</h2>
            <p>Workspace</p>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={section === "pipelines" ? "active" : ""}
            type="button"
            onClick={() => setSection("pipelines")}
          >
            Pipelines
          </button>
          <button
            className={section === "jobs" ? "active" : ""}
            type="button"
            onClick={() => onNavigateJobs(selectedId || undefined)}
          >
            Jobs
          </button>
          <button type="button" onClick={onNavigateMetrics}>
            Metrics
          </button>
        </nav>

        <button className="logout-btn" type="button" onClick={onLogout}>
          Logout
        </button>
      </aside>

      <section className="pipeline-content">
        <header className="content-head">
          <div>
            <h1>
              {section === "pipelines"
                ? "Pipelines"
                : section === "steps"
                  ? "Pipeline Steps"
                  : section === "subscribers"
                    ? "Subscribers"
                    : "Jobs"}
            </h1>
            <p>
              {section === "pipelines"
                ? `${activePipelinesCount} active - ${pipelines.length} total`
                : section === "steps"
                  ? "Manage step flow for each pipeline."
                  : section === "subscribers"
                    ? "Manage destination URLs for each pipeline."
                    : "Create jobs and track processing status."}
            </p>
          </div>
          {section === "pipelines" ? (
            <button
              className="new-pipeline-main-btn"
              onClick={openCreatePipelineDialog}
              disabled={loading}
              type="button"
            >
              + New pipeline
            </button>
          ) : (
            <button
              className="refresh-main"
              onClick={() =>
                section === "steps"
                  ? void loadSteps(selectedId)
                  : section === "subscribers"
                    ? void loadPipelineSubscribers(selectedId)
                    : void loadPipelineJobs(selectedId)
              }
              disabled={loading}
              type="button"
            >
              Refresh
            </button>
          )}
        </header>

        {section === "pipelines" ? (
          <>
            {pipelines.length === 0 ? (
              <div className="pipeline-empty-state">
                <h3>No pipelines yet</h3>
                <p>Create your first pipeline to start processing webhook events.</p>
                <button
                  type="button"
                  className="new-pipeline-main-btn"
                  onClick={openCreatePipelineDialog}
                >
                  + New pipeline
                </button>
              </div>
            ) : (
              <div className="pipeline-card-list">
                {pipelines.map((pipeline) => {
                  const details = pipelineDetails[pipeline.id];
                  const stepsPreview = details?.steps ?? [];
                  const subscribersCount = details?.subscribers.length ?? 0;

                  return (
                    <button
                      type="button"
                      key={pipeline.id}
                      className="pipeline-showcase-card"
                      onClick={() => {
                        if (suppressAutoOpenRef.current) return;
                        setSelectedId(pipeline.id);
                        setOpenPipelineId(pipeline.id);
                        void loadPipelineDetails(pipeline.id);
                      }}
                    >
                      <div className="pipeline-showcase-main">
                        <div className="pipeline-showcase-title-row">
                          <h3>{pipeline.name}</h3>
                          <span
                            className={
                              pipeline.isActive ? "pipeline-status-badge active" : "pipeline-status-badge"
                            }
                          >
                            {pipeline.isActive ? "active" : "inactive"}
                          </span>
                        </div>
                        <div className="pipeline-step-row">
                          {stepsPreview.length === 0 ? (
                            <span className="pipeline-step-empty">No steps yet</span>
                          ) : (
                            stepsPreview.map((step) => (
                              <span key={step.id} className={`step-chip step-${step.type}`}>
                                {formatStepLabel(step.type)}
                              </span>
                            ))
                          )}
                        </div>
                        <div className="pipeline-source-pill">POST {pipeline.sourceUrl}</div>
                      </div>
                      <div className="pipeline-showcase-side">
                        <span>
                          {subscribersCount} subscriber{subscribersCount === 1 ? "" : "s"}
                        </span>
                        <span>{formatShortDate(pipeline.createdAt)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {showCreateDialog ? (
              <div className="pipeline-modal-overlay" onClick={closeCreatePipelineDialog}>
                <div
                  className="pipeline-modal create-modal"
                  onClick={(event) => event.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="pipeline-modal-header">
                    <h3>New pipeline</h3>
                    <button type="button" onClick={closeCreatePipelineDialog}>
                      x
                    </button>
                  </div>

                  <div className="pipeline-modal-body">
                    <label className="dialog-field-label">Pipeline name</label>
                    <input
                      className="dialog-input"
                      type="text"
                      placeholder="e.g. Order Validator"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                    />

                    <div className="dialog-steps-head">
                      <label className="dialog-field-label">Steps</label>
                    </div>
                    <div className="step-picker-row">
                      {STEP_TYPES.map((type) => (
                        <button
                          key={type}
                          type="button"
                          className={`step-chip picker step-${type}`}
                          onClick={() => appendCreateStep(type)}
                        >
                          + {formatStepLabel(type)}
                        </button>
                      ))}
                    </div>
                    <div className="edit-steps-stack">
                      {createStepsDraft.length === 0 ? <p className="empty">No steps yet</p> : null}
                      {createStepsDraft.map((step, index) => {
                        const conditions = Array.isArray(step.config.conditions)
                          ? (step.config.conditions as Array<Record<string, unknown>>)
                          : [];
                        const firstCondition = conditions[0] ?? {};
                        const mappings = Array.isArray(step.config.mappings)
                          ? (step.config.mappings as Array<Record<string, unknown>>)
                          : [];
                        const firstMapping = mappings[0] ?? {};
                        const rawValues =
                          step.config.values && typeof step.config.values === "object"
                            ? (step.config.values as Record<string, unknown>)
                            : {};
                        const valuesText = Object.entries(rawValues)
                          .map(([key, value]) => `${key}=${String(value)}`)
                          .join(", ");
                        const fieldsCsv = Array.isArray(step.config.fields)
                          ? (step.config.fields as string[]).join(", ")
                          : "";

                        return (
                          <div className="edit-step-card" key={step.key}>
                            <div className="edit-step-head">
                              <span className="step-order">{index + 1}</span>
                              <select
                                className="edit-step-type-select"
                                value={step.type}
                                onChange={(event) =>
                                  updateCreateStepType(step.key, event.target.value as StepType)
                                }
                              >
                                {STEP_TYPES.map((type) => (
                                  <option key={type} value={type}>
                                    {formatStepLabel(type)}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="edit-step-remove"
                                onClick={() => removeCreateStep(step.key)}
                              >
                                x
                              </button>
                            </div>

                            {step.type === "filter" ? (
                              <>
                                <div className="edit-step-grid filter">
                                  <input
                                    className="dialog-input"
                                    placeholder="field"
                                    value={String(firstCondition.field ?? "")}
                                    onChange={(event) =>
                                      updateCreateStepConfig(step.key, "conditions", [
                                        {
                                          field: event.target.value,
                                          op: String(firstCondition.op ?? "gt"),
                                          value: firstCondition.value ?? "",
                                        },
                                      ])
                                    }
                                  />
                                  <select
                                    className="dialog-input"
                                    value={String(firstCondition.op ?? "gt")}
                                    onChange={(event) =>
                                      updateCreateStepConfig(step.key, "conditions", [
                                        {
                                          field: String(firstCondition.field ?? ""),
                                          op: event.target.value,
                                          value: firstCondition.value ?? "",
                                        },
                                      ])
                                    }
                                  >
                                    {FILTER_OPERATORS.map((operator) => (
                                      <option key={operator.value} value={operator.value}>
                                        {operator.label}
                                      </option>
                                    ))}
                                  </select>
                                  <input
                                    className="dialog-input"
                                    placeholder="value"
                                    value={String(firstCondition.value ?? "")}
                                    onChange={(event) =>
                                      updateCreateStepConfig(step.key, "conditions", [
                                        {
                                          field: String(firstCondition.field ?? ""),
                                          op: String(firstCondition.op ?? "gt"),
                                          value: parsePrimitive(event.target.value),
                                        },
                                      ])
                                    }
                                  />
                                </div>
                                {createValidationErrors[`step:${step.key}:field`] ? (
                                  <p className="edit-field-error">{createValidationErrors[`step:${step.key}:field`]}</p>
                                ) : null}
                                {createValidationErrors[`step:${step.key}:value`] ? (
                                  <p className="edit-field-error">{createValidationErrors[`step:${step.key}:value`]}</p>
                                ) : null}
                              </>
                            ) : null}

                            {step.type === "transform" ? (
                              <>
                                <div className="edit-step-grid pair">
                                  <input
                                    className="dialog-input"
                                    placeholder="from"
                                    value={String(firstMapping.from ?? "")}
                                    onChange={(event) =>
                                      updateCreateStepConfig(step.key, "mappings", [
                                        { from: event.target.value, to: String(firstMapping.to ?? "") },
                                      ])
                                    }
                                  />
                                  <input
                                    className="dialog-input"
                                    placeholder="to"
                                    value={String(firstMapping.to ?? "")}
                                    onChange={(event) =>
                                      updateCreateStepConfig(step.key, "mappings", [
                                        { from: String(firstMapping.from ?? ""), to: event.target.value },
                                      ])
                                    }
                                  />
                                </div>
                                {createValidationErrors[`step:${step.key}:from`] ? (
                                  <p className="edit-field-error">{createValidationErrors[`step:${step.key}:from`]}</p>
                                ) : null}
                                {createValidationErrors[`step:${step.key}:to`] ? (
                                  <p className="edit-field-error">{createValidationErrors[`step:${step.key}:to`]}</p>
                                ) : null}
                              </>
                            ) : null}

                            {step.type === "enrich" ? (
                              <>
                                <div className="edit-step-grid pair">
                                  <input
                                    className="dialog-input"
                                    placeholder="key"
                                    value={String(step.config.key ?? "")}
                                    onChange={(event) => updateCreateStepConfig(step.key, "key", event.target.value)}
                                  />
                                  <input
                                    className="dialog-input"
                                    placeholder="value"
                                    value={String(step.config.value ?? "")}
                                    onChange={(event) => updateCreateStepConfig(step.key, "value", event.target.value)}
                                  />
                                </div>
                                {createValidationErrors[`step:${step.key}:key`] ? (
                                  <p className="edit-field-error">{createValidationErrors[`step:${step.key}:key`]}</p>
                                ) : null}
                                {createValidationErrors[`step:${step.key}:value`] ? (
                                  <p className="edit-field-error">{createValidationErrors[`step:${step.key}:value`]}</p>
                                ) : null}
                              </>
                            ) : null}

                            {step.type === "require_fields" || step.type === "pick_fields" ? (
                              <>
                                <input
                                  className="dialog-input"
                                  placeholder="field1, field2"
                                  value={fieldsCsv}
                                  onChange={(event) =>
                                    updateCreateStepConfig(step.key, "fields", splitCsv(event.target.value))
                                  }
                                />
                                {createValidationErrors[`step:${step.key}:fields`] ? (
                                  <p className="edit-field-error">{createValidationErrors[`step:${step.key}:fields`]}</p>
                                ) : null}
                              </>
                            ) : null}

                            {step.type === "set_fields" ? (
                              <>
                                <input
                                  className="dialog-input"
                                  placeholder="status=paid, currency=USD"
                                  value={valuesText}
                                  onChange={(event) =>
                                    updateCreateStepConfig(step.key, "values", parseKeyValuePairs(event.target.value))
                                  }
                                />
                                {createValidationErrors[`step:${step.key}:values`] ? (
                                  <p className="edit-field-error">{createValidationErrors[`step:${step.key}:values`]}</p>
                                ) : null}
                              </>
                            ) : null}

                            {step.type === "calculate_field" ? (
                              <>
                                <div className="edit-step-grid calc">
                                  <input
                                    className="dialog-input"
                                    placeholder="field"
                                    value={String(step.config.field ?? "")}
                                    onChange={(event) => updateCreateStepConfig(step.key, "field", event.target.value)}
                                  />
                                  <select
                                    className="dialog-input"
                                    value={String(step.config.op ?? "add")}
                                    onChange={(event) => updateCreateStepConfig(step.key, "op", event.target.value)}
                                  >
                                    <option value="add">add</option>
                                    <option value="subtract">subtract</option>
                                    <option value="multiply">multiply</option>
                                    <option value="divide">divide</option>
                                  </select>
                                  <input
                                    className="dialog-input"
                                    placeholder="10"
                                    value={String(step.config.value ?? "")}
                                    onChange={(event) => updateCreateStepConfig(step.key, "value", event.target.value)}
                                  />
                                </div>
                                {createValidationErrors[`step:${step.key}:field`] ? (
                                  <p className="edit-field-error">{createValidationErrors[`step:${step.key}:field`]}</p>
                                ) : null}
                                {createValidationErrors[`step:${step.key}:value`] ? (
                                  <p className="edit-field-error">{createValidationErrors[`step:${step.key}:value`]}</p>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    <div className="dialog-subscriber-head">
                      <label className="dialog-field-label">Subscribers</label>
                      <button type="button" onClick={addCreateSubscriber}>
                        + Add
                      </button>
                    </div>
                    <div className="edit-subscriber-stack">
                      {createSubscribersDraft.length === 0 ? <p className="empty">No subscribers yet</p> : null}
                      {createSubscribersDraft.map((subscriber) => (
                        <div key={subscriber.key}>
                          <div className="edit-subscriber-row">
                            <input
                              className="dialog-input"
                              value={subscriber.url}
                              onChange={(event) => updateCreateSubscriber(subscriber.key, event.target.value)}
                              placeholder="https://hooks.example.com/path"
                            />
                            <button
                              type="button"
                              className="edit-step-remove"
                              onClick={() => removeCreateSubscriber(subscriber.key)}
                            >
                              x
                            </button>
                          </div>
                          {createValidationErrors[`subscriber:${subscriber.key}`] ? (
                            <p className="edit-field-error">{createValidationErrors[`subscriber:${subscriber.key}`]}</p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="pipeline-modal-footer">
                    <button type="button" className="modal-secondary" onClick={closeCreatePipelineDialog}>
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="new-pipeline-main-btn"
                      onClick={() => void handleCreatePipelineFromDialog()}
                      disabled={loading}
                    >
                      Create pipeline
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            {openPipeline ? (
              <div className="pipeline-modal-overlay" onClick={() => setOpenPipelineId("")}>
                <div
                  className="pipeline-modal details-modal"
                  onClick={(event) => event.stopPropagation()}
                  role="dialog"
                  aria-modal="true"
                >
                  <div className="pipeline-modal-header">
                    <h3>{openPipeline.name}</h3>
                    <button type="button" onClick={() => setOpenPipelineId("")}>
                      x
                    </button>
                  </div>

                  {!isEditingPipeline ? (
                    <>
                      <div className="detail-top-actions">
                        <button type="button" className="modal-primary" onClick={() => void startPipelineEdit()}>
                          Edit
                        </button>
                        <button type="button" className="modal-secondary" disabled>
                          {openPipeline.isActive ? "Deactivate" : "Activate"}
                        </button>
                        <button
                          type="button"
                          className="modal-danger"
                          onClick={() => void handleDeletePipeline(openPipeline.id)}
                        >
                          Delete
                        </button>
                      </div>

                      <div className="dialog-field-stack">
                        <label className="dialog-field-label">Source URL</label>
                        <div className="input-action-row">
                          <input className="dialog-input" value={openPipeline.sourceUrl} readOnly />
                          <button
                            type="button"
                            className="modal-secondary"
                            onClick={() => void copyToClipboard(openPipeline.sourceUrl, "Source URL")}
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <div className="dialog-field-stack">
                        <label className="dialog-field-label">Signing secret</label>
                        <div className="input-action-row">
                          <input
                            className="dialog-input"
                            value={revealSecret ? openPipeline.signingSecret : "whsec_**********"}
                            readOnly
                          />
                          <button
                            type="button"
                            className="modal-secondary"
                            onClick={() => setRevealSecret((current) => !current)}
                          >
                            {revealSecret ? "Hide" : "Reveal"}
                          </button>
                          <button
                            type="button"
                            className="modal-secondary"
                            onClick={() => void copyToClipboard(openPipeline.signingSecret, "Signing secret")}
                          >
                            Copy
                          </button>
                        </div>
                      </div>

                      <div className="detail-section">
                        <h4>Steps ({pipelineDetails[openPipeline.id]?.steps.length ?? 0})</h4>
                        <div className="detail-list-stack">
                          {pipelineDetailsLoading[openPipeline.id] ? (
                            <p className="empty">Loading steps...</p>
                          ) : (pipelineDetails[openPipeline.id]?.steps.length ?? 0) === 0 ? (
                            <p className="empty">No steps in this pipeline yet.</p>
                          ) : (
                            (pipelineDetails[openPipeline.id]?.steps ?? []).map((step, index) => (
                              <div className="detail-step-card" key={step.id}>
                                <div className="detail-step-head">
                                  <span className="step-order">{index + 1}</span>
                                  <span className={`step-chip step-${step.type}`}>{formatStepLabel(step.type)}</span>
                                </div>
                                <p>{summarizeStepConfig(step.type, step.config)}</p>
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="detail-section">
                        <h4>Subscribers ({pipelineDetails[openPipeline.id]?.subscribers.length ?? 0})</h4>
                        <div className="detail-list-stack">
                          {(pipelineDetails[openPipeline.id]?.subscribers.length ?? 0) === 0 ? (
                            <p className="empty">No subscribers yet.</p>
                          ) : (
                            (pipelineDetails[openPipeline.id]?.subscribers ?? []).map((subscriber) => (
                              <div className="detail-subscriber-item" key={subscriber.id}>
                                {subscriber.url}
                              </div>
                            ))
                          )}
                        </div>
                      </div>

                      <div className="detail-divider" />

                      <div className="detail-section test-webhook-section">
                        <div className="test-webhook-head">
                          <h4>Send test webhook</h4>
                          <button type="button" className="test-webhook-random" onClick={fillRandomTestPayload}>
                            random payload
                          </button>
                        </div>
                        <textarea
                          className="test-webhook-textarea"
                          rows={7}
                          value={testWebhookPayload}
                          onChange={(event) => {
                            setTestWebhookPayload(event.target.value);
                            setTestWebhookError("");
                          }}
                        />
                        {testWebhookError ? <p className="edit-field-error">{testWebhookError}</p> : null}
                        <div>
                          <button
                            type="button"
                            className="new-pipeline-main-btn"
                            onClick={() => void sendTestWebhookToPipeline()}
                            disabled={loading}
                          >
                            Send to pipeline
                          </button>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="pipeline-modal-body">
                        <label className="dialog-field-label">Pipeline name</label>
                        <input
                          className="dialog-input"
                          value={editPipelineName}
                          onChange={(event) => setEditPipelineName(event.target.value)}
                          readOnly
                        />

                        <div className="dialog-steps-head">
                          <label className="dialog-field-label">Steps</label>
                        </div>
                        <div className="step-picker-row">
                          {STEP_TYPES.map((type) => (
                            <button
                              key={type}
                              type="button"
                              className={`step-chip picker step-${type}`}
                              onClick={() => appendEditStep(type)}
                            >
                              + {formatStepLabel(type)}
                            </button>
                          ))}
                        </div>

                        <div className="edit-steps-stack">
                          {editStepsDraft.map((step, index) => {
                            const conditions = Array.isArray(step.config.conditions)
                              ? (step.config.conditions as Array<Record<string, unknown>>)
                              : [];
                            const firstCondition = conditions[0] ?? {};
                            const mappings = Array.isArray(step.config.mappings)
                              ? (step.config.mappings as Array<Record<string, unknown>>)
                              : [];
                            const firstMapping = mappings[0] ?? {};
                            const rawValues =
                              step.config.values && typeof step.config.values === "object"
                                ? (step.config.values as Record<string, unknown>)
                                : {};
                            const valuesText = Object.entries(rawValues)
                              .map(([key, value]) => `${key}=${String(value)}`)
                              .join(", ");
                            const fieldsCsv = Array.isArray(step.config.fields)
                              ? (step.config.fields as string[]).join(", ")
                              : "";

                            return (
                              <div className="edit-step-card" key={step.key}>
                                <div className="edit-step-head">
                                  <span className="step-order">{index + 1}</span>
                                  <select
                                    className="edit-step-type-select"
                                    value={step.type}
                                    onChange={(event) =>
                                      updateEditStepType(step.key, event.target.value as StepType)
                                    }
                                  >
                                    {STEP_TYPES.map((type) => (
                                      <option key={type} value={type}>
                                        {formatStepLabel(type)}
                                      </option>
                                    ))}
                                  </select>
                                  <button
                                    type="button"
                                    className="edit-step-remove"
                                    onClick={() => removeEditStep(step.key)}
                                  >
                                    x
                                  </button>
                                </div>

                                {step.type === "filter" ? (
                                  <>
                                    <div className="edit-step-grid filter">
                                      <input
                                        className="dialog-input"
                                        placeholder="field"
                                        value={String(firstCondition.field ?? "")}
                                        onChange={(event) =>
                                          updateEditStepConfig(step.key, "conditions", [
                                            {
                                              field: event.target.value,
                                              op: String(firstCondition.op ?? "gt"),
                                              value: firstCondition.value ?? "",
                                            },
                                          ])
                                        }
                                      />
                                      <select
                                        className="dialog-input"
                                        value={String(firstCondition.op ?? "gt")}
                                        onChange={(event) =>
                                          updateEditStepConfig(step.key, "conditions", [
                                            {
                                              field: String(firstCondition.field ?? ""),
                                              op: event.target.value,
                                              value: firstCondition.value ?? "",
                                            },
                                          ])
                                        }
                                      >
                                        {FILTER_OPERATORS.map((operator) => (
                                          <option key={operator.value} value={operator.value}>
                                            {operator.label}
                                          </option>
                                        ))}
                                      </select>
                                      <input
                                        className="dialog-input"
                                        placeholder="value"
                                        value={String(firstCondition.value ?? "")}
                                        onChange={(event) =>
                                          updateEditStepConfig(step.key, "conditions", [
                                            {
                                              field: String(firstCondition.field ?? ""),
                                              op: String(firstCondition.op ?? "gt"),
                                              value: parsePrimitive(event.target.value),
                                            },
                                          ])
                                        }
                                      />
                                    </div>
                                    {editValidationErrors[`step:${step.key}:field`] ? (
                                      <p className="edit-field-error">
                                        {editValidationErrors[`step:${step.key}:field`]}
                                      </p>
                                    ) : null}
                                    {editValidationErrors[`step:${step.key}:value`] ? (
                                      <p className="edit-field-error">
                                        {editValidationErrors[`step:${step.key}:value`]}
                                      </p>
                                    ) : null}
                                  </>
                                ) : null}

                                {step.type === "transform" ? (
                                  <>
                                    <div className="edit-step-grid pair">
                                      <input
                                        className="dialog-input"
                                        placeholder="from"
                                        value={String(firstMapping.from ?? "")}
                                        onChange={(event) =>
                                          updateEditStepConfig(step.key, "mappings", [
                                            { from: event.target.value, to: String(firstMapping.to ?? "") },
                                          ])
                                        }
                                      />
                                      <input
                                        className="dialog-input"
                                        placeholder="to"
                                        value={String(firstMapping.to ?? "")}
                                        onChange={(event) =>
                                          updateEditStepConfig(step.key, "mappings", [
                                            { from: String(firstMapping.from ?? ""), to: event.target.value },
                                          ])
                                        }
                                      />
                                    </div>
                                    {editValidationErrors[`step:${step.key}:from`] ? (
                                      <p className="edit-field-error">
                                        {editValidationErrors[`step:${step.key}:from`]}
                                      </p>
                                    ) : null}
                                    {editValidationErrors[`step:${step.key}:to`] ? (
                                      <p className="edit-field-error">
                                        {editValidationErrors[`step:${step.key}:to`]}
                                      </p>
                                    ) : null}
                                  </>
                                ) : null}

                                {step.type === "enrich" ? (
                                  <>
                                    <div className="edit-step-grid pair">
                                      <input
                                        className="dialog-input"
                                        placeholder="key"
                                        value={String(step.config.key ?? "")}
                                        onChange={(event) =>
                                          updateEditStepConfig(step.key, "key", event.target.value)
                                        }
                                      />
                                      <input
                                        className="dialog-input"
                                        placeholder="value"
                                        value={String(step.config.value ?? "")}
                                        onChange={(event) =>
                                          updateEditStepConfig(step.key, "value", event.target.value)
                                        }
                                      />
                                    </div>
                                    {editValidationErrors[`step:${step.key}:key`] ? (
                                      <p className="edit-field-error">
                                        {editValidationErrors[`step:${step.key}:key`]}
                                      </p>
                                    ) : null}
                                    {editValidationErrors[`step:${step.key}:value`] ? (
                                      <p className="edit-field-error">
                                        {editValidationErrors[`step:${step.key}:value`]}
                                      </p>
                                    ) : null}
                                  </>
                                ) : null}

                                {step.type === "require_fields" || step.type === "pick_fields" ? (
                                  <>
                                    <input
                                      className="dialog-input"
                                      placeholder="field1, field2"
                                      value={fieldsCsv}
                                      onChange={(event) =>
                                        updateEditStepConfig(step.key, "fields", splitCsv(event.target.value))
                                      }
                                    />
                                    {editValidationErrors[`step:${step.key}:fields`] ? (
                                      <p className="edit-field-error">
                                        {editValidationErrors[`step:${step.key}:fields`]}
                                      </p>
                                    ) : null}
                                  </>
                                ) : null}

                                {step.type === "set_fields" ? (
                                  <>
                                    <input
                                      className="dialog-input"
                                      placeholder="status=paid, currency=USD"
                                      value={valuesText}
                                      onChange={(event) =>
                                        updateEditStepConfig(step.key, "values", parseKeyValuePairs(event.target.value))
                                      }
                                    />
                                    {editValidationErrors[`step:${step.key}:values`] ? (
                                      <p className="edit-field-error">
                                        {editValidationErrors[`step:${step.key}:values`]}
                                      </p>
                                    ) : null}
                                  </>
                                ) : null}

                                {step.type === "calculate_field" ? (
                                  <>
                                    <div className="edit-step-grid calc">
                                      <input
                                        className="dialog-input"
                                        placeholder="field"
                                        value={String(step.config.field ?? "")}
                                        onChange={(event) =>
                                          updateEditStepConfig(step.key, "field", event.target.value)
                                        }
                                      />
                                      <select
                                        className="dialog-input"
                                        value={String(step.config.op ?? "add")}
                                        onChange={(event) =>
                                          updateEditStepConfig(step.key, "op", event.target.value)
                                        }
                                      >
                                        <option value="add">add</option>
                                        <option value="subtract">subtract</option>
                                        <option value="multiply">multiply</option>
                                        <option value="divide">divide</option>
                                      </select>
                                      <input
                                        className="dialog-input"
                                        placeholder="10"
                                        value={String(step.config.value ?? "")}
                                        onChange={(event) =>
                                          updateEditStepConfig(step.key, "value", event.target.value)
                                        }
                                      />
                                    </div>
                                    {editValidationErrors[`step:${step.key}:field`] ? (
                                      <p className="edit-field-error">
                                        {editValidationErrors[`step:${step.key}:field`]}
                                      </p>
                                    ) : null}
                                    {editValidationErrors[`step:${step.key}:value`] ? (
                                      <p className="edit-field-error">
                                        {editValidationErrors[`step:${step.key}:value`]}
                                      </p>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>

                        <div className="dialog-subscriber-head">
                          <label className="dialog-field-label">Subscribers</label>
                          <button type="button" onClick={addEditSubscriber}>
                            + Add
                          </button>
                        </div>
                        <div className="edit-subscriber-stack">
                          {editSubscribersDraft.map((subscriber) => (
                            <div key={subscriber.key}>
                              <div className="edit-subscriber-row">
                                <input
                                  className="dialog-input"
                                  value={subscriber.url}
                                  onChange={(event) => updateEditSubscriber(subscriber.key, event.target.value)}
                                  placeholder="https://hooks.example.com/path"
                                />
                                <button
                                  type="button"
                                  className="edit-step-remove"
                                  onClick={() => removeEditSubscriber(subscriber.key)}
                                >
                                  x
                                </button>
                              </div>
                              {editValidationErrors[`subscriber:${subscriber.key}`] ? (
                                <p className="edit-field-error">
                                  {editValidationErrors[`subscriber:${subscriber.key}`]}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="pipeline-modal-footer">
                        <button
                          type="button"
                          className="modal-secondary"
                          onClick={() => setIsEditingPipeline(false)}
                          disabled={loading}
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          className="new-pipeline-main-btn"
                          onClick={() => void savePipelineChanges()}
                          disabled={loading}
                        >
                          Save changes
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {message ? <p className="ok-msg">{message}</p> : null}
            {error ? <p className="err-msg">{error}</p> : null}
          </>
        ) : section === "steps" ? (
          <div className="steps-grid">
            <div className="panel create-panel">
              <h3>Add Step</h3>
              <div className="create-row">
                <label className="field-small">Pipeline</label>
                <select
                  className="field-control"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  <option value="">Select pipeline</option>
                  {pipelines.map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </option>
                  ))}
                </select>

                <label className="field-small">Type</label>
                <select
                  className="field-control"
                  value={stepType}
                  onChange={(event) => setStepType(event.target.value as StepType)}
                >
                  {STEP_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>

                <label className="field-small">Order</label>
                <input
                  className="field-control"
                  type="number"
                  min={0}
                  value={stepOrder}
                  onChange={(event) => setStepOrder(Number(event.target.value))}
                />

                {stepType === "require_fields" ? (
                  <>
                    <label className="field-small">Required Fields (comma separated)</label>
                    <input
                      className="field-control"
                      value={requireFieldsText}
                      onChange={(event) => setRequireFieldsText(event.target.value)}
                      placeholder="email, amount, currency"
                    />
                  </>
                ) : null}

                {stepType === "filter" ? (
                  <div className="triple-grid">
                    <div>
                      <label className="field-small">Field</label>
                      <input
                        className="field-control"
                        value={filterField}
                        onChange={(event) => setFilterField(event.target.value)}
                        placeholder="price"
                      />
                    </div>
                    <div>
                      <label className="field-small">Operator</label>
                      <select
                        className="field-control"
                        value={filterOperator}
                        onChange={(event) => setFilterOperator(event.target.value)}
                      >
                        {FILTER_OPERATORS.map((operator) => (
                          <option key={operator.value} value={operator.value}>
                            {operator.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="field-small">Value</label>
                      <input
                        className="field-control"
                        value={filterValue}
                        onChange={(event) => setFilterValue(event.target.value)}
                        placeholder="20"
                      />
                    </div>
                  </div>
                ) : null}

                {stepType === "transform" ? (
                  <>
                    <label className="field-small">Mappings (source:target, source2:target2)</label>
                    <input
                      className="field-control"
                      value={transformRenameText}
                      onChange={(event) => setTransformRenameText(event.target.value)}
                      placeholder="firstName:name, phone:mobile"
                    />
                  </>
                ) : null}

                {stepType === "set_fields" ? (
                  <>
                    <label className="field-small">Set Fields (key=value, key2=value2)</label>
                    <input
                      className="field-control"
                      value={setFieldsText}
                      onChange={(event) => setSetFieldsText(event.target.value)}
                      placeholder="status=paid, currency=USD"
                    />
                  </>
                ) : null}

                {stepType === "enrich" ? (
                  <>
                    <label className="field-small">Key</label>
                    <input
                      className="field-control"
                      value={enrichKey}
                      onChange={(event) => setEnrichKey(event.target.value)}
                      placeholder="country"
                    />

                    <label className="field-small">Value</label>
                    <input
                      className="field-control"
                      value={enrichValue}
                      onChange={(event) => setEnrichValue(event.target.value)}
                      placeholder="Jordan"
                    />
                  </>
                ) : null}

                {stepType === "calculate_field" ? (
                  <>
                    <label className="field-small">Output Field</label>
                    <input
                      className="field-control"
                      value={calcField}
                      onChange={(event) => setCalcField(event.target.value)}
                      placeholder="total"
                    />

                    <label className="field-small">Operation</label>
                    <select
                      className="field-control"
                      value={calcOp}
                      onChange={(event) =>
                        setCalcOp(
                          event.target.value as "add" | "subtract" | "multiply" | "divide"
                        )
                      }
                    >
                      <option value="add">add</option>
                      <option value="subtract">subtract</option>
                      <option value="multiply">multiply</option>
                      <option value="divide">divide</option>
                    </select>

                    <label className="field-small">Numeric Value</label>
                    <input
                      className="field-control"
                      type="number"
                      value={calcValue}
                      onChange={(event) => setCalcValue(event.target.value)}
                      placeholder="10"
                    />
                  </>
                ) : null}

                {stepType === "pick_fields" ? (
                  <>
                    <label className="field-small">Fields to Keep (comma separated)</label>
                    <input
                      className="field-control"
                      value={pickFieldsText}
                      onChange={(event) => setPickFieldsText(event.target.value)}
                      placeholder="id, amount, currency"
                    />
                  </>
                ) : null}

                <div className="step-actions">
                  <button onClick={() => void handleCreateStep()} disabled={loading}>
                    Add Step
                  </button>
                  <button
                    type="button"
                    className="soft-btn"
                    onClick={resetStepFields}
                    disabled={loading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>

            <div className="panel list-panel">
              <div className="list-head">
                <h3>Steps</h3>
                <span className="count-pill">{orderedSteps.length}</span>
              </div>

              {!selectedId ? (
                <p className="empty">Choose a pipeline first.</p>
              ) : orderedSteps.length === 0 ? (
                <p className="empty">No steps in this pipeline yet.</p>
              ) : (
                <div className="pipeline-grid">
                  {orderedSteps.map((step) => (
                    <div key={step.id} className="step-item">
                      <div>
                        <strong>
                          #{step.order} - {step.type}
                        </strong>
                        <span>{step.id.slice(0, 8)}</span>
                      </div>
                      <button
                        className="danger-btn step-delete"
                        onClick={() => void handleDeleteStep(step.id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {message ? <p className="ok-msg">{message}</p> : null}
              {error ? <p className="err-msg">{error}</p> : null}
            </div>
          </div>
        ) : section === "subscribers" ? (
          <div className="steps-grid">
            <div className="panel create-panel">
              <h3>Add Subscriber</h3>
              <div className="create-row">
                <label className="field-small">Pipeline</label>
                <select
                  className="field-control"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  <option value="">Select pipeline</option>
                  {pipelines.map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </option>
                  ))}
                </select>

                <label className="field-small">Subscriber URL</label>
                <input
                  className="field-control"
                  type="url"
                  placeholder="https://example.com/webhook"
                  value={subscriberUrl}
                  onChange={(event) => setSubscriberUrl(event.target.value)}
                />

                <div className="step-actions">
                  <button onClick={() => void handleCreateSubscriber()} disabled={loading}>
                    Add Subscriber
                  </button>
                </div>
              </div>
            </div>

            <div className="panel list-panel">
              <div className="list-head">
                <h3>Subscribers</h3>
                <span className="count-pill">{subscribers.length}</span>
              </div>

              {!selectedId ? (
                <p className="empty">Choose a pipeline first.</p>
              ) : subscribers.length === 0 ? (
                <p className="empty">No subscribers in this pipeline yet.</p>
              ) : (
                <div className="pipeline-grid">
                  {subscribers.map((subscriber) => (
                    <div key={subscriber.id} className="step-item">
                      <div>
                        <strong>{subscriber.url}</strong>
                        <span>{subscriber.id.slice(0, 8)}</span>
                      </div>
                      <button
                        className="danger-btn step-delete"
                        onClick={() => void handleDeleteSubscriber(subscriber.id)}
                        disabled={loading}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {message ? <p className="ok-msg">{message}</p> : null}
              {error ? <p className="err-msg">{error}</p> : null}
            </div>
          </div>
        ) : section === "jobs" ? (
          <div className="jobs-shell">
            <div className="jobs-toolbar">
              <div className="jobs-toolbar-select">
                <label className="field-small">Pipeline</label>
                <select
                  className="field-control"
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  <option value="">Select pipeline</option>
                  {pipelines.map((pipeline) => (
                    <option key={pipeline.id} value={pipeline.id}>
                      {pipeline.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                className="refresh-main"
                onClick={() => void loadPipelineJobs(selectedId)}
                disabled={loading || !selectedId}
              >
                Refresh jobs
              </button>
            </div>

            {!selectedId ? (
              <p className="empty">Choose a pipeline first.</p>
            ) : (
              <>
                <section className="jobs-summary-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
                  <article className="jobs-stat-card succeeded">
                    <strong>{jobsCounts.succeeded}</strong>
                    <span>Succeeded</span>
                  </article>
                  <article className="jobs-stat-card failed">
                    <strong>{jobsCounts.failed}</strong>
                    <span>Failed</span>
                  </article>
                  <article className="jobs-stat-card pending">
                    <strong>{jobsCounts.pending}</strong>
                    <span>Pending</span>
                  </article>
                </section>

                <div className="jobs-filter-row">
                  <button
                    type="button"
                    className={jobsFilter === "all" ? "jobs-filter-chip active" : "jobs-filter-chip"}
                    onClick={() => setJobsFilter("all")}
                  >
                    All ({jobsCounts.total})
                  </button>
                  <button
                    type="button"
                    className={jobsFilter === "succeeded" ? "jobs-filter-chip active" : "jobs-filter-chip"}
                    onClick={() => setJobsFilter("succeeded")}
                  >
                    succeeded ({jobsCounts.succeeded})
                  </button>
                  <button
                    type="button"
                    className={jobsFilter === "failed" ? "jobs-filter-chip active" : "jobs-filter-chip"}
                    onClick={() => setJobsFilter("failed")}
                  >
                    failed ({jobsCounts.failed})
                  </button>
                  <button
                    type="button"
                    className={jobsFilter === "pending" ? "jobs-filter-chip active" : "jobs-filter-chip"}
                    onClick={() => setJobsFilter("pending")}
                  >
                    pending ({jobsCounts.pending})
                  </button>
                </div>

                <div className="jobs-table-wrap">
                  <table className="jobs-table">
                    <thead>
                      <tr>
                        <th>Job ID</th>
                        <th>Status</th>
                        <th>Attempts</th>
                        <th>Created</th>
                        <th>Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobsFiltered.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="jobs-empty-row">
                            No jobs for this filter.
                          </td>
                        </tr>
                      ) : (
                        jobsFiltered.map((job) => {
                          const uiStatus = toJobsUiStatus(job.status);
                          return (
                            <tr key={job.id}>
                              <td className="jobs-job-id">{job.id.slice(0, 8)}</td>
                              <td>
                                <span className={`jobs-status-badge ${uiStatus}`}>
                                  {uiStatus}
                                </span>
                              </td>
                              <td>{job.attemptCount}</td>
                              <td>{formatShortDate(job.createdAt)}</td>
                              <td>{formatJobDuration(job.createdAt, job.processedAt)}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {message ? <p className="ok-msg">{message}</p> : null}
            {error ? <p className="err-msg">{error}</p> : null}
          </div>
        ) : null}
      </section>
    </main>
  );
}
