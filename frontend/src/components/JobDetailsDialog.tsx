import { useEffect, useState } from "react";
import type { Delivery, DeliveryAttempt } from "../services/deliveries";
import type { Job } from "../services/jobs";

interface JobDetailsDialogProps {
  job: Job;
  pipelineName: string;
  deliveries: Delivery[];
  attemptsByDelivery: Record<string, DeliveryAttempt[]>;
  subscriberUrls: Record<string, string>;
  onRefreshDeliveries: () => void;
  onClose: () => void;
}

type StepSnapshot = {
  id?: string;
  type?: string;
  order?: number;
  config?: unknown;
};

function formatDate(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(parsed);
}

function formatDuration(createdAt?: string, processedAt?: string | null): string {
  if (!createdAt || !processedAt) return "-";
  const created = new Date(createdAt);
  const processed = new Date(processedAt);
  if (Number.isNaN(created.getTime()) || Number.isNaN(processed.getTime())) return "-";
  return `${(Math.max(0, processed.getTime() - created.getTime()) / 1000).toFixed(1)}s`;
}

function classifyFailure(job: Job): string {
  if (job.status !== "failed") return "";
  if (job.filterReason?.toLowerCase().includes("filter")) return "Filtered by pipeline rule";
  if (job.filterReason?.toLowerCase().includes("timeout")) return "Timeout / retry exhausted";
  return "Processing failure";
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function parseStepsSnapshot(value: unknown): StepSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item) => typeof item === "object" && item !== null && !Array.isArray(item))
    .map((item) => item as StepSnapshot)
    .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0));
}

function summarizeStepConfig(config: unknown): string {
  if (!config || typeof config !== "object") return "No config";
  const record = config as Record<string, unknown>;
  if (Array.isArray(record.conditions) && record.conditions[0] && typeof record.conditions[0] === "object") {
    const first = record.conditions[0] as Record<string, unknown>;
    return `${String(first.field ?? "field")} ${String(first.op ?? "eq")} ${String(first.value ?? "")}`;
  }
  if (Array.isArray(record.mappings) && record.mappings[0] && typeof record.mappings[0] === "object") {
    const first = record.mappings[0] as Record<string, unknown>;
    return `${String(first.from ?? "from")} -> ${String(first.to ?? "to")}`;
  }
  if (Array.isArray(record.fields)) {
    return `fields: ${record.fields.map((item) => String(item)).join(", ")}`;
  }
  if (record.key !== undefined || record.value !== undefined) {
    return `${String(record.key ?? "key")} = ${String(record.value ?? "value")}`;
  }
  if (record.values && typeof record.values === "object") {
    return Object.entries(record.values as Record<string, unknown>)
      .map(([key, value]) => `${key}=${String(value)}`)
      .join(", ");
  }
  return prettyJson(config);
}

function findLikelyFailedStep(steps: StepSnapshot[], errorText: string): StepSnapshot | null {
  const normalizedError = errorText.toLowerCase();
  for (const step of steps) {
    const haystack = `${step.type ?? ""} ${prettyJson(step.config ?? {})}`.toLowerCase();
    if (normalizedError && haystack.includes(normalizedError)) return step;
  }

  // Heuristic: common messages reference a field name; try matching tokens.
  const tokens = normalizedError.split(/[^a-z0-9_]+/).filter((token) => token.length > 2);
  for (const token of tokens) {
    const matched = steps.find((step) =>
      `${step.type ?? ""} ${prettyJson(step.config ?? {})}`.toLowerCase().includes(token)
    );
    if (matched) return matched;
  }

  return steps[steps.length - 1] ?? null;
}

function getDeliveryBackoffMs(nextAttemptNumber: number): number {
  if (nextAttemptNumber <= 1) return 0;
  if (nextAttemptNumber === 2) return 10_000;
  return 20_000;
}

function formatCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export default function JobDetailsDialog({
  job,
  pipelineName,
  deliveries,
  attemptsByDelivery,
  subscriberUrls,
  onRefreshDeliveries,
  onClose,
}: JobDetailsDialogProps) {
  const [now, setNow] = useState(() => Date.now());
  const isSuccess = job.status === "processed";
  const failureType = classifyFailure(job);
  const steps = parseStepsSnapshot(job.stepsSnapshot);
  const likelyFailedStep = findLikelyFailedStep(steps, job.filterReason ?? "");
  const totalAttempts = deliveries.reduce((sum, delivery) => sum + delivery.attemptCount, 0);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <div className="pipeline-modal-overlay" onClick={onClose}>
      <div
        className="pipeline-modal details-modal"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="pipeline-modal-header">
          <h3>Job {job.id.slice(0, 8)}</h3>
          <button type="button" onClick={onClose}>
            x
          </button>
        </div>

        <div className="job-details-body">
          <section className="job-details-section">
            <div className="job-overview-grid">
              <div>
                <span>Pipeline</span>
                <strong>{pipelineName}</strong>
              </div>
              <div>
                <span>Status</span>
                <strong className={`jobs-status-inline ${job.status === "failed" ? "failed" : "ok"}`}>
                  {job.status === "processed"
                    ? "succeeded"
                    : job.status === "pending" || job.status === "processing"
                      ? "pending"
                      : job.status}
                </strong>
              </div>
              <div>
                <span>Created</span>
                <strong>{formatDate(job.createdAt)}</strong>
              </div>
              <div>
                <span>Duration</span>
                <strong>{formatDuration(job.createdAt, job.processedAt)}</strong>
              </div>
              <div>
                <span>Processed at</span>
                <strong>{formatDate(job.processedAt ?? undefined)}</strong>
              </div>
              <div>
                <span>Delivery attempts</span>
                <strong>{totalAttempts}</strong>
              </div>
            </div>
          </section>

          {!isSuccess ? (
            <section className="job-details-section">
              <h4>Failure diagnostics</h4>
              <p className="job-failure-type">{failureType || "Unknown failure"}</p>
              <p className="job-failure-reason">{job.filterReason ?? "No failure reason returned."}</p>
              {likelyFailedStep ? (
                <div className="job-failed-step">
                  <span>Failed step</span>
                  <strong>
                    #{Number(likelyFailedStep.order ?? 0) + 1} {likelyFailedStep.type ?? "-"}
                  </strong>
                  <span>Configured value</span>
                  <strong>{summarizeStepConfig(likelyFailedStep.config)}</strong>
                </div>
              ) : null}
            </section>
          ) : null}

          <section className="job-details-section">
            <h4>Payload</h4>
            <pre className="job-json-view">{prettyJson(job.payload)}</pre>
          </section>

          {isSuccess ? (
            <section className="job-details-section">
              <h4>Processed payload</h4>
              <pre className="job-json-view">{prettyJson(job.processedPayload ?? {})}</pre>
            </section>
          ) : null}

          <section className="job-details-section">
            <div className="job-deliveries-head">
              <h4>Deliveries ({deliveries.length})</h4>
              <button type="button" className="job-deliveries-refresh" onClick={onRefreshDeliveries}>
                Refresh
              </button>
            </div>
            {deliveries.length === 0 ? (
              <p className="empty">No deliveries yet.</p>
            ) : (
              <div className="job-delivery-list">
                {deliveries.map((delivery) => (
                  <div key={delivery.id} className="job-delivery-card">
                    <div className="job-delivery-top">
                      <span className={`job-delivery-status ${delivery.status}`}>{delivery.status}</span>
                      <span>attempts: {delivery.attemptCount}</span>
                    </div>
                    <div className="job-delivery-url">
                      {subscriberUrls[delivery.subscriberId] ?? `subscriber: ${delivery.subscriberId.slice(0, 8)}`}
                    </div>
                    <div className="job-delivery-attempts">
                      {(() => {
                        const nextAttempt = delivery.attemptCount + 1;
                        const backoffMs = getDeliveryBackoffMs(nextAttempt);
                        const lastAttemptAtMs = delivery.lastAttemptAt
                          ? new Date(delivery.lastAttemptAt).getTime()
                          : null;
                        const elapsed = lastAttemptAtMs ? Math.max(0, now - lastAttemptAtMs) : 0;
                        const remaining = Math.max(0, backoffMs - elapsed);

                        return (
                          <>
                            {(attemptsByDelivery[delivery.id] ?? []).length === 0 ? (
                              delivery.status === "pending" ? (
                                <span className="job-attempt-pending">
                                  {remaining > 0
                                    ? `Next attempt #${nextAttempt} in ${formatCountdown(remaining)}`
                                    : `In progress: running attempt #${nextAttempt}...`}
                                </span>
                              ) : (
                                <span className="empty">No attempt details.</span>
                              )
                            ) : (
                              (attemptsByDelivery[delivery.id] ?? []).map((attempt) => (
                                <div key={attempt.id} className="job-attempt-row">
                                  <span>#{attempt.attemptNumber}</span>
                                  <span>code: {attempt.statusCode ?? "-"}</span>
                                  <span>{attempt.error ?? "ok"}</span>
                                </div>
                              ))
                            )}
                            {delivery.status === "pending" && (attemptsByDelivery[delivery.id] ?? []).length > 0 ? (
                              <span className="job-attempt-pending">
                                {remaining > 0
                                  ? `Next attempt #${nextAttempt} in ${formatCountdown(remaining)}`
                                  : `In progress: running attempt #${nextAttempt}...`}
                              </span>
                            ) : null}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
