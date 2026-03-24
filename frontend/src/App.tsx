import { useMemo, useState } from "react";
import AuthPage from "./pages/AuthPage";
import PipelinePage from "./pages/PipelinePage";

const TOKEN_KEY = "webhookpipe_token";

function App() {
  const [token, setToken] = useState<string>(() => localStorage.getItem(TOKEN_KEY) ?? "");

  const isAuthenticated = useMemo(() => token.length > 0, [token]);

  if (!isAuthenticated) {
    return <AuthPage onAuthenticated={(nextToken) => setToken(nextToken)} />;
  }

  return (
    <PipelinePage
      token={token}
      onLogout={() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken("");
      }}
    />
  );
}

export default App;
