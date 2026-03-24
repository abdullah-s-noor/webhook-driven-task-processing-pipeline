import { useMemo, useState } from "react";
import AuthPage from "./pages/AuthPage";
import JobsPage from "./pages/JobsPage";
import MetricsPage from "./pages/MetricsPage";
import PipelinePage from "./pages/PipelinePage";

const TOKEN_KEY = "webhookpipe_token";

function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? "");
  const [page, setPage] = useState<"pipelines" | "jobs" | "metrics">("pipelines");
  const [jobsPipelineId, setJobsPipelineId] = useState<string>("");

  const isAuthenticated = useMemo(() => token.length > 0, [token]);

  if (!isAuthenticated) {
    return <AuthPage onAuthenticated={(nextToken) => setToken(nextToken)} />;
  }

  if (page === "jobs") {
    return (
      <JobsPage
        token={token}
        initialPipelineId={jobsPipelineId || undefined}
        onNavigatePipelines={() => setPage("pipelines")}
        onNavigateMetrics={() => setPage("metrics")}
        onLogout={() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
          setPage("pipelines");
        }}
      />
    );
  }

  if (page === "metrics") {
    return (
      <MetricsPage
        token={token}
        onNavigatePipelines={() => setPage("pipelines")}
        onNavigateJobs={() => setPage("jobs")}
        onLogout={() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
          setPage("pipelines");
        }}
      />
    );
  }

  return (
    <PipelinePage
      token={token}
      onNavigateJobs={(pipelineId) => {
        setJobsPipelineId(pipelineId ?? "");
        setPage("jobs");
      }}
      onNavigateMetrics={() => setPage("metrics")}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
        setPage("pipelines");
      }}
    />
  );
}

export default App;
