import { useEffect, useMemo, useState } from "react";
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
  type PipelineStep,
  type StepType,
} from "../services/pipelineSteps";
import {
  createSubscriber,
  deleteSubscriber,
  listSubscribers,
  type Subscriber,
} from "../services/subscribers";
import {
  createJob,
  getJobById,
  listJobsByPipeline,
  type Job,
} from "../services/jobs";
import {
  listDeliveriesByPipeline,
  listDeliveryAttempts,
  type Delivery,
  type DeliveryAttempt,
} from "../services/deliveries";
import "./PipelinePage.css";

interface PipelinePageProps {
  token: string;
  onLogout: () => void;
}

type Section = "pipelines" | "steps" | "subscribers" | "jobs" | "deliveries";

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

export default function PipelinePage({ token, onLogout }: PipelinePageProps) {
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
  const [jobPayloadText, setJobPayloadText] = useState("{\n  \"event\": \"order.created\"\n}");
  const [jobLookupId, setJobLookupId] = useState("");
  const [jobLookupResult, setJobLookupResult] = useState<Job | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [deliveryAttempts, setDeliveryAttempts] = useState<DeliveryAttempt[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("Welcome back.");

  const selectedPipeline = useMemo(
    () => pipelines.find((pipeline) => pipeline.id === selectedId) ?? null,
    [pipelines, selectedId]
  );

  const activePipelinesCount = useMemo(
    () => pipelines.filter((pipeline) => pipeline.isActive).length,
    [pipelines]
  );

  const orderedSteps = useMemo(
    () => [...steps].sort((a, b) => a.order - b.order),
    [steps]
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

  async function handleCreatePipeline() {
    if (!name.trim()) {
      setError("Pipeline name is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const pipeline = await createPipeline(token, name.trim());
      setName("");
      setMessage("Pipeline created successfully");
      await loadPipelines();
      setSelectedId(pipeline.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteSelected() {
    if (!selectedId) {
      return;
    }

    setLoading(true);
    setError("");

    try {
      await deletePipeline(token, selectedId);
      setMessage("Pipeline deleted");
      await loadPipelines();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
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

  async function handleCreateJob() {
    if (!selectedId) {
      setError("Select a pipeline first");
      return;
    }

    let payload: unknown;

    try {
      payload = JSON.parse(jobPayloadText);
    } catch {
      setError("Job payload must be valid JSON");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const job = await createJob(token, {
        pipelineId: selectedId,
        payload,
      });

      setMessage("Job created");
      setJobLookupId(job.id);
      setJobLookupResult(job);
      await loadPipelineJobs(selectedId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create job");
    } finally {
      setLoading(false);
    }
  }

  async function handleLookupJob() {
    if (!jobLookupId.trim()) {
      setError("Job id is required");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const job = await getJobById(token, jobLookupId.trim());
      setJobLookupResult(job);
      setMessage("Job loaded");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get job");
    } finally {
      setLoading(false);
    }
  }

  async function loadPipelineDeliveries(pipelineId: string) {
    if (!pipelineId) {
      setDeliveries([]);
      setSelectedDeliveryId("");
      setDeliveryAttempts([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await listDeliveriesByPipeline(token, pipelineId);
      setDeliveries(data);
      setSelectedDeliveryId((current) => current || data[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deliveries");
    } finally {
      setLoading(false);
    }
  }

  async function loadAttempts(deliveryId: string) {
    if (!deliveryId) {
      setDeliveryAttempts([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await listDeliveryAttempts(token, deliveryId);
      setDeliveryAttempts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load attempts");
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
    if (section === "deliveries") {
      void loadPipelineDeliveries(selectedId);
    }
  }, [section, selectedId]);

  useEffect(() => {
    if (section === "deliveries") {
      void loadAttempts(selectedDeliveryId);
    }
  }, [section, selectedDeliveryId]);

  useEffect(() => {
    resetStepFields();
  }, [stepType]);

  return (
    <main className="pipeline-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-icon">WP</div>
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
            className={section === "steps" ? "active" : ""}
            type="button"
            onClick={() => setSection("steps")}
          >
            Steps
          </button>
          <button
            className={section === "subscribers" ? "active" : ""}
            type="button"
            onClick={() => setSection("subscribers")}
          >
            Subscribers
          </button>
          <button
            className={section === "jobs" ? "active" : ""}
            type="button"
            onClick={() => setSection("jobs")}
          >
            Jobs
          </button>
          <button
            className={section === "deliveries" ? "active" : ""}
            type="button"
            onClick={() => setSection("deliveries")}
          >
            Deliveries
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
                    : section === "jobs"
                      ? "Jobs"
                      : "Deliveries"}
            </h1>
            <p>
              {section === "pipelines"
                ? "Create, browse, and manage your webhook pipelines."
                : section === "steps"
                  ? "Manage step flow for each pipeline."
                  : section === "subscribers"
                    ? "Manage destination URLs for each pipeline."
                    : section === "jobs"
                      ? "Create jobs and track processing status."
                      : "Track delivery status and retry attempts."}
            </p>
          </div>
          <button
            className="refresh-main"
            onClick={() =>
              section === "pipelines"
                ? void loadPipelines()
                : section === "steps"
                  ? void loadSteps(selectedId)
                  : section === "subscribers"
                    ? void loadPipelineSubscribers(selectedId)
                    : section === "jobs"
                      ? void loadPipelineJobs(selectedId)
                      : void loadPipelineDeliveries(selectedId)
            }
            disabled={loading}
          >
            Refresh
          </button>
        </header>

        {section === "pipelines" ? (
          <>
            <section className="overview-grid">
              <article className="overview-card">
                <span>Total pipelines</span>
                <strong>{pipelines.length}</strong>
              </article>
              <article className="overview-card">
                <span>Active pipelines</span>
                <strong>{activePipelinesCount}</strong>
              </article>
              <article className="overview-card">
                <span>Last action</span>
                <strong>{message || "No updates yet"}</strong>
              </article>
            </section>

            <div className="workspace-grid">
              <div className="panel create-panel">
                <h3>Create New Pipeline</h3>
                <div className="create-row">
                  <input
                    type="text"
                    placeholder="Pipeline name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                  <button onClick={() => void handleCreatePipeline()} disabled={loading}>
                    Create
                  </button>
                </div>
              </div>

              <div className="panel list-panel">
                <div className="list-head">
                  <h3>Your Pipelines</h3>
                  <span className="count-pill">{pipelines.length}</span>
                </div>

                {pipelines.length === 0 ? (
                  <p className="empty">No pipelines yet.</p>
                ) : (
                  <div className="pipeline-grid">
                    {pipelines.map((pipeline) => (
                      <button
                        key={pipeline.id}
                        className={pipeline.id === selectedId ? "pipeline-item active" : "pipeline-item"}
                        onClick={() => setSelectedId(pipeline.id)}
                      >
                        <strong>{pipeline.name}</strong>
                        <span>{pipeline.id.slice(0, 8)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="panel details-panel">
                <div className="details-head">
                  <h3>Selected Pipeline</h3>
                  <button
                    className="danger-btn"
                    onClick={() => void handleDeleteSelected()}
                    disabled={!selectedId || loading}
                  >
                    Delete
                  </button>
                </div>

                {selectedPipeline ? (
                  <div className="details-list">
                    <p>
                      <b>Name:</b> {selectedPipeline.name}
                    </p>
                    <p>
                      <b>ID:</b> {selectedPipeline.id}
                    </p>
                    <p>
                      <b>Source URL:</b> {selectedPipeline.sourceUrl}
                    </p>
                    <p>
                      <b>Secret:</b> {selectedPipeline.signingSecret}
                    </p>
                  </div>
                ) : (
                  <p className="empty">Select a pipeline to view details.</p>
                )}

                {message ? <p className="ok-msg">{message}</p> : null}
                {error ? <p className="err-msg">{error}</p> : null}
              </div>
            </div>
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
          <div className="steps-grid">
            <div className="panel create-panel">
              <h3>Create Job</h3>
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

                <label className="field-small">Payload (JSON)</label>
                <textarea
                  className="field-control"
                  rows={8}
                  value={jobPayloadText}
                  onChange={(event) => setJobPayloadText(event.target.value)}
                />

                <div className="step-actions">
                  <button onClick={() => void handleCreateJob()} disabled={loading}>
                    Create Job
                  </button>
                </div>
              </div>
            </div>

            <div className="panel list-panel">
              <div className="list-head">
                <h3>Jobs</h3>
                <span className="count-pill">{jobs.length}</span>
              </div>

              <div className="create-row" style={{ marginBottom: 12 }}>
                <label className="field-small">Get Job By Id</label>
                <input
                  className="field-control"
                  placeholder="job id"
                  value={jobLookupId}
                  onChange={(event) => setJobLookupId(event.target.value)}
                />
                <div className="step-actions">
                  <button onClick={() => void handleLookupJob()} disabled={loading}>
                    Load Job
                  </button>
                </div>
              </div>

              {!selectedId ? (
                <p className="empty">Choose a pipeline first.</p>
              ) : jobs.length === 0 ? (
                <p className="empty">No jobs for this pipeline yet.</p>
              ) : (
                <div className="pipeline-grid">
                  {jobs.map((job) => (
                    <div key={job.id} className="step-item">
                      <div>
                        <strong>{job.status.toUpperCase()}</strong>
                        <span>{job.id.slice(0, 8)}</span>
                      </div>
                      <div>
                        <span>attempts: {job.attemptCount}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {jobLookupResult ? (
                <div className="details-list" style={{ marginTop: 10 }}>
                  <p>
                    <b>Loaded Job:</b> {jobLookupResult.id}
                  </p>
                  <p>
                    <b>Status:</b> {jobLookupResult.status}
                  </p>
                  <p>
                    <b>Attempts:</b> {jobLookupResult.attemptCount}
                  </p>
                  <p>
                    <b>Filter Reason:</b> {jobLookupResult.filterReason ?? "-"}
                  </p>
                </div>
              ) : null}

              {message ? <p className="ok-msg">{message}</p> : null}
              {error ? <p className="err-msg">{error}</p> : null}
            </div>
          </div>
        ) : (
          <div className="steps-grid">
            <div className="panel list-panel">
              <div className="list-head">
                <h3>Deliveries</h3>
                <span className="count-pill">{deliveries.length}</span>
              </div>

              <div className="create-row" style={{ marginBottom: 12 }}>
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

              {!selectedId ? (
                <p className="empty">Choose a pipeline first.</p>
              ) : deliveries.length === 0 ? (
                <p className="empty">No deliveries yet for this pipeline.</p>
              ) : (
                <div className="pipeline-grid">
                  {deliveries.map((delivery) => (
                    <button
                      key={delivery.id}
                      className={
                        delivery.id === selectedDeliveryId
                          ? "pipeline-item active"
                          : "pipeline-item"
                      }
                      onClick={() => setSelectedDeliveryId(delivery.id)}
                    >
                      <strong>{delivery.status.toUpperCase()}</strong>
                      <span>{delivery.id.slice(0, 8)}</span>
                      <span>attempts: {delivery.attemptCount}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="panel list-panel">
              <div className="list-head">
                <h3>Attempts</h3>
                <span className="count-pill">{deliveryAttempts.length}</span>
              </div>

              {!selectedDeliveryId ? (
                <p className="empty">Choose a delivery to see attempts.</p>
              ) : deliveryAttempts.length === 0 ? (
                <p className="empty">No attempts logged yet.</p>
              ) : (
                <div className="pipeline-grid">
                  {deliveryAttempts.map((attempt) => (
                    <div key={attempt.id} className="step-item">
                      <div>
                        <strong>Attempt #{attempt.attemptNumber}</strong>
                        <span>statusCode: {attempt.statusCode ?? "-"}</span>
                        <span>error: {attempt.error ?? "-"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {message ? <p className="ok-msg">{message}</p> : null}
              {error ? <p className="err-msg">{error}</p> : null}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

