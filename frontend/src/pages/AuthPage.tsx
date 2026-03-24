import { useState } from "react";
import { login, register } from "../services/auth";
import "./AuthPage.css";

type Mode = "login" | "register";

const TOKEN_KEY = "webhookpipe_token";

interface AuthPageProps {
  onAuthenticated: (token: string) => void;
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function submit() {
    if (!email || !pass) {
      setErr("Email and password are required");
      return;
    }

    setLoading(true);
    setErr("");

    try {
      const data = mode === "login" ? await login(email, pass) : await register(email, pass);

      if (mode === "register") {
        setMode("login");
      } else {
        const token = data.token ?? "";

        if (!token) {
          throw new Error("Missing token in login response");
        }

        localStorage.setItem(TOKEN_KEY, token);
        onAuthenticated(token);
      }

      setEmail("");
      setPass("");
    } catch (error) {
      setErr(error instanceof Error ? error.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-container fade-up">
        <div className="brand-top">
          <div className="brand-inline">
            <div className="brand-icon">⚡</div>
            <span className="brand-name">WebhookPipe</span>
          </div>
          <div className="brand-subtitle">
            {mode === "login" ? "Sign in to your account" : "Create a new account"}
          </div>
        </div>

        <div className="auth-card">
          <label className="field-label">Email</label>
          <input
            className="field-input"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <label className="field-label">Password</label>
          <input
            className="field-input"
            type="password"
            placeholder="••••••••"
            value={pass}
            onChange={(event) => setPass(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                void submit();
              }
            }}
          />

          {err ? <div className="error-text">{err}</div> : null}

          <button className="primary-btn" onClick={() => void submit()} disabled={loading}>
            {loading ? <span className="spinner" /> : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </div>

        <div className="switch-row">
          {mode === "login" ? "No account? " : "Already have one? "}
          <button
            className="switch-btn"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setErr("");
            }}
          >
            {mode === "login" ? "Register" : "Sign in"}
          </button>
        </div>

        <div className="demo-text">Demo: use any email + password</div>
      </div>
    </div>
  );
}
