import { useEffect, useMemo, useState } from "react";
import JobDetailsDialog from "../components/JobDetailsDialog";
import {
  listDeliveriesByPipeline,
  listDeliveryAttempts,
  type Delivery,
  type DeliveryAttempt,
} from "../services/deliveries";
import { listPipelines, type Pipeline } from "../services/pipelines";
import { listJobsByPipeline, type Job } from "../services/jobs";
import { listSubscribers, type Subscriber } from "../services/subscribers";
import "./PipelinePage.css";

interface JobsPageProps {
  token: string;
  onLogout: () => void;
  onNavigatePipelines: () => void;
  onNavigateMetrics: () => void;
  initialPipelineId?: string;
}

type JobsFilter = "all" | "succeeded" | "failed" | "pending";

function toJobsUiStatus(status: Job["status"]): Exclude<JobsFilter, "all"> {
  if (status === "processed") return "succeeded";
  if (status === "pending" || status === "processing") return "pending";
  return "failed";
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
    second: "2-digit",
  }).format(parsed);
}

function formatJobDuration(createdAt?: string, processedAt?: string | null): string {
  if (!createdAt || !processedAt) return "-";
  const created = new Date(createdAt);
  const processed = new Date(processedAt);
  if (Number.isNaN(created.getTime()) || Number.isNaN(processed.getTime())) return "-";
  return `${(Math.max(0, processed.getTime() - created.getTime()) / 1000).toFixed(1)}s`;
}

export default function JobsPage({
  token,
  onLogout,
  onNavigatePipelines,
  onNavigateMetrics,
  initialPipelineId,
}: JobsPageProps) {
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [attemptsByDelivery, setAttemptsByDelivery] = useState<Record<string, DeliveryAttempt[]>>({});
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [jobsFilter, setJobsFilter] = useState<JobsFilter>("all");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
  const subscriberUrls = useMemo(
    () => Object.fromEntries(subscribers.map((subscriber) => [subscriber.id, subscriber.url])),
    [subscribers]
  );

  async function fetchPipelineJobsBundle(pipelineId: string) {
    const [jobsData, deliveriesData, subscribersData] = await Promise.all([
      listJobsByPipeline(token, pipelineId),
      listDeliveriesByPipeline(token, pipelineId),
      listSubscribers(token, pipelineId),
    ]);
    return { jobsData, deliveriesData, subscribersData };
  }

  async function loadPipelinesAndSelectFirst() {
    setLoading(true);
    setError("");
    try {
      const data = await listPipelines(token);
      setPipelines(data);
      if (data.length > 0) {
        const preferredId =
          initialPipelineId && data.some((pipeline) => pipeline.id === initialPipelineId)
            ? initialPipelineId
            : data[0].id;
        setSelectedId((current) => current || preferredId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load pipelines");
    } finally {
      setLoading(false);
    }
  }

  async function loadJobs(pipelineId: string) {
    if (!pipelineId) {
      setJobs([]);
      setDeliveries([]);
      setSubscribers([]);
      setAttemptsByDelivery({});
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { jobsData, deliveriesData, subscribersData } = await fetchPipelineJobsBundle(pipelineId);
      setJobs(jobsData);
      setDeliveries(deliveriesData);
      setSubscribers(subscribersData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load jobs");
    } finally {
      setLoading(false);
    }
  }

  async function loadAttemptsForJob(job: Job, deliveriesSource: Delivery[]) {
    const jobDeliveries = deliveriesSource.filter((delivery) => delivery.jobId === job.id);
    if (jobDeliveries.length === 0) {
      setAttemptsByDelivery({});
      return;
    }

    try {
      const attemptsEntries = await Promise.all(
        jobDeliveries.map(async (delivery) => {
          const attempts = await listDeliveryAttempts(token, delivery.id);
          return [delivery.id, attempts] as const;
        })
      );
      setAttemptsByDelivery(Object.fromEntries(attemptsEntries));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load delivery attempts");
    }
  }

  async function openJobDetails(job: Job) {
    setSelectedJob(job);
    await loadAttemptsForJob(job, deliveries);
  }

  async function refreshSelectedJobDetails() {
    if (!selectedId || !selectedJob) return;
    setLoading(true);
    setError("");
    try {
      const { jobsData, deliveriesData, subscribersData } = await fetchPipelineJobsBundle(selectedId);
      setJobs(jobsData);
      setDeliveries(deliveriesData);
      setSubscribers(subscribersData);

      const refreshedJob = jobsData.find((job) => job.id === selectedJob.id);
      if (!refreshedJob) {
        setSelectedJob(null);
        setAttemptsByDelivery({});
        return;
      }

      setSelectedJob(refreshedJob);
      await loadAttemptsForJob(refreshedJob, deliveriesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh deliveries");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPipelinesAndSelectFirst();
  }, []);

  useEffect(() => {
    if (selectedId) {
      void loadJobs(selectedId);
    }
  }, [selectedId]);

  useEffect(() => {
    setSelectedJob(null);
    setAttemptsByDelivery({});
  }, [selectedId]);

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
          <button type="button" onClick={onNavigatePipelines}>
            Pipelines
          </button>
          <button className="active" type="button">
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
            <h1>Jobs</h1>
            <p>{jobsCounts.total} total jobs</p>
          </div>
        </header>

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
              onClick={() => void loadJobs(selectedId)}
              disabled={loading || !selectedId}
            >
              Refresh jobs
            </button>
          </div>

          {!selectedId ? (
            <p className="empty">Choose a pipeline first.</p>
          ) : (
            <>
              {jobsCounts.total === 0 ? (
                <section className="jobs-empty-state">
                  <h3>No jobs yet</h3>
                  <p>Send a test webhook from Pipelines page, then come back here to track it.</p>
                </section>
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
                          <th>Created</th>
                          <th>Processed</th>
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
                              <tr key={job.id} className="jobs-row-clickable" onClick={() => void openJobDetails(job)}>
                                <td className="jobs-job-id">{job.id.slice(0, 8)}</td>
                                <td>
                                  <span className={`jobs-status-badge ${uiStatus}`}>{uiStatus}</span>
                                </td>
                                <td>{formatShortDate(job.createdAt)}</td>
                                <td>{formatShortDate(job.processedAt ?? undefined)}</td>
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
            </>
          )}

          {error ? <p className="err-msg">{error}</p> : null}
        </div>
      </section>

      {selectedJob ? (
        <JobDetailsDialog
          job={selectedJob}
          pipelineName={pipelines.find((pipeline) => pipeline.id === selectedJob.pipelineId)?.name ?? "Pipeline"}
          deliveries={deliveries.filter((delivery) => delivery.jobId === selectedJob.id)}
          attemptsByDelivery={attemptsByDelivery}
          subscriberUrls={subscriberUrls}
          onRefreshDeliveries={() => void refreshSelectedJobDetails()}
          onClose={() => setSelectedJob(null)}
        />
      ) : null}
    </main>
  );
}
