import { useEffect, useMemo, useState } from "react";
import { listJobsByPipeline, type Job } from "../services/jobs";
import { listPipelines, type Pipeline } from "../services/pipelines";
import "./PipelinePage.css";

interface MetricsPageProps {
  token: string;
  onLogout: () => void;
  onNavigatePipelines: () => void;
  onNavigateJobs: () => void;
}

type MetricsStatus = "succeeded" | "failed" | "pending";

type PipelineMetrics = {
  pipeline: Pipeline;
  jobs: Job[];
  total: number;
  succeeded: number;
  failed: number;
  pending: number;
  successRate: number;
};

function toMetricsStatus(status: Job["status"]): MetricsStatus {
  if (status === "processed") return "succeeded";
  if (status === "pending" || status === "processing") return "pending";
  return "failed";
}

function percent(part: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((part / total) * 100);
}

export default function MetricsPage({
  token,
  onLogout,
  onNavigatePipelines,
  onNavigateJobs,
}: MetricsPageProps) {
  const [pipelineMetrics, setPipelineMetrics] = useState<PipelineMetrics[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const totals = useMemo(() => {
    const total = pipelineMetrics.reduce((sum, item) => sum + item.total, 0);
    const succeeded = pipelineMetrics.reduce((sum, item) => sum + item.succeeded, 0);
    const failed = pipelineMetrics.reduce((sum, item) => sum + item.failed, 0);
    const pending = pipelineMetrics.reduce((sum, item) => sum + item.pending, 0);
    return {
      total,
      succeeded,
      failed,
      pending,
      successRate: percent(succeeded, total),
    };
  }, [pipelineMetrics]);

  async function loadMetrics() {
    setLoading(true);
    setError("");
    try {
      const pipelines = await listPipelines(token);
      const jobsByPipeline = await Promise.all(
        pipelines.map(async (pipeline) => {
          const jobs = await listJobsByPipeline(token, pipeline.id);
          return { pipeline, jobs };
        })
      );

      const nextMetrics: PipelineMetrics[] = jobsByPipeline.map(({ pipeline, jobs }) => {
        const succeeded = jobs.filter((job) => toMetricsStatus(job.status) === "succeeded").length;
        const failed = jobs.filter((job) => toMetricsStatus(job.status) === "failed").length;
        const pending = jobs.filter((job) => toMetricsStatus(job.status) === "pending").length;
        const total = jobs.length;
        return {
          pipeline,
          jobs,
          total,
          succeeded,
          failed,
          pending,
          successRate: percent(succeeded, total),
        };
      });

      setPipelineMetrics(nextMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load metrics");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadMetrics();
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
          <button type="button" onClick={onNavigatePipelines}>
            Pipelines
          </button>
          <button type="button" onClick={onNavigateJobs}>
            Jobs
          </button>
          <button className="active" type="button">
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
            <h1>Metrics</h1>
            <p>Across all pipelines</p>
          </div>
          <button type="button" className="refresh-main" onClick={() => void loadMetrics()} disabled={loading}>
            Refresh
          </button>
        </header>

        <section className="metrics-summary-grid">
          <article className="jobs-stat-card">
            <strong>{totals.total}</strong>
            <span>Total jobs</span>
          </article>
          <article className="jobs-stat-card succeeded">
            <strong>{totals.succeeded}</strong>
            <span>Succeeded</span>
          </article>
          <article className="jobs-stat-card queued">
            <strong>{totals.pending}</strong>
            <span>Pending</span>
          </article>
          <article className="jobs-stat-card failed">
            <strong>{totals.failed}</strong>
            <span>Failed</span>
          </article>
        </section>

        <section className="metrics-overall-card">
          <div className="metrics-overall-head">
            <h3>Overall success rate</h3>
            <strong>{totals.successRate}%</strong>
          </div>
          <div className="metrics-progress-track">
            <div className="metrics-progress-fill" style={{ width: `${totals.successRate}%` }} />
          </div>
          <div className="metrics-legend-row">
            <span>Succeeded: {percent(totals.succeeded, totals.total)}%</span>
            <span>Failed: {percent(totals.failed, totals.total)}%</span>
            <span>Pending: {percent(totals.pending, totals.total)}%</span>
          </div>
        </section>

        <section className="metrics-pipeline-stack">
          <h3>Per pipeline</h3>
          {pipelineMetrics.length === 0 ? (
            <p className="empty">No pipeline metrics yet.</p>
          ) : (
            pipelineMetrics.map((item) => (
              <article key={item.pipeline.id} className="metrics-pipeline-card">
                <div className="metrics-pipeline-head">
                  <div>
                    <h4>{item.pipeline.name}</h4>
                    <p>{item.total} jobs total</p>
                  </div>
                  <strong>{item.successRate}%</strong>
                </div>

                <div className="metrics-pipeline-bars">
                  <div
                    className="metrics-bar-succeeded"
                    style={{ width: `${percent(item.succeeded, item.total)}%` }}
                  />
                  <div className="metrics-bar-failed" style={{ width: `${percent(item.failed, item.total)}%` }} />
                  <div className="metrics-bar-queued" style={{ width: `${percent(item.pending, item.total)}%` }} />
                </div>

                <div className="metrics-pipeline-legend">
                  <span>Succeeded: {item.succeeded}</span>
                  <span>Failed: {item.failed}</span>
                  <span>Pending: {item.pending}</span>
                </div>
              </article>
            ))
          )}
        </section>

        {error ? <p className="err-msg">{error}</p> : null}
      </section>
    </main>
  );
}
