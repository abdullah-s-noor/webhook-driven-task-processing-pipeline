import { useState } from 'react'
import type { FormEvent } from 'react'
import './App.css'

type AuthMode = 'login' | 'register'

const API_BASE_URL = 'http://localhost:3000'

interface AuthResponse {
  token?: string
  user?: {
    id: string
    email: string
    createdAt?: string
  }
  message?: string
  error?: string
}

const initialForm = {
  email: '',
  password: '',
}

function App() {
  const [mode, setMode] = useState<AuthMode>('register')
  const [form, setForm] = useState(initialForm)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [token, setToken] = useState('')
  const [userEmail, setUserEmail] = useState('')
  const [serverMessage, setServerMessage] = useState('Create an account to start testing the auth flow.')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/${mode}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(form),
      })

      const data = (await response.json()) as AuthResponse

      if (!response.ok) {
        setError(data.error ?? 'Request failed')
        return
      }

      if (mode === 'register') {
        setServerMessage('Account created. You can log in now or stay here and register another user.')
        setUserEmail(data.user?.email ?? form.email)
      } else {
        setToken(data.token ?? '')
        setUserEmail(data.user?.email ?? form.email)
        setServerMessage('Logged in successfully. Your token is shown below for quick testing.')
      }

      setForm(initialForm)
    } catch {
      setError('Could not reach the API. Make sure the backend is running on port 3000.')
    } finally {
      setLoading(false)
    }
  }

  async function handleLogout() {
    setLoading(true)
    setError('')

    try {
      const response = await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
      })

      const data = (await response.json()) as AuthResponse

      if (!response.ok) {
        setError(data.error ?? 'Logout failed')
        return
      }

      setToken('')
      setServerMessage(data.message ?? 'Logged out')
    } catch {
      setError('Could not reach the API. Make sure the backend is running on port 3000.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-hero">
        <p className="eyebrow">Webhook Pipe</p>
        <h1>Auth Playground</h1>
        <p className="hero-copy">
          A light front end to test registration and login against the backend API before
          we wire the rest of the pipeline product.
        </p>
        <div className="hero-card">
          <span className="hero-label">Backend status</span>
          <strong>POST /auth/register | POST /auth/login | POST /auth/logout</strong>
          <p>{serverMessage}</p>
        </div>
      </section>

      <section className="auth-panel">
        <div className="mode-switch" role="tablist" aria-label="Authentication mode">
          <button
            className={mode === 'register' ? 'active' : ''}
            onClick={() => setMode('register')}
            type="button"
          >
            Register
          </button>
          <button
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
            type="button"
          >
            Login
          </button>
        </div>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              placeholder="name@example.com"
              required
            />
          </label>

          <label>
            <span>Password</span>
            <input
              type="password"
              value={form.password}
              onChange={(event) =>
                setForm((current) => ({ ...current, password: event.target.value }))
              }
              placeholder="At least 8 characters"
              required
            />
          </label>

          <button className="submit-button" disabled={loading} type="submit">
            {loading ? 'Sending...' : mode === 'register' ? 'Create account' : 'Login'}
          </button>
        </form>

        {error ? <p className="feedback error">{error}</p> : null}

        <div className="result-card">
          <div>
            <span className="result-label">Current user</span>
            <strong>{userEmail || 'No active session yet'}</strong>
          </div>

          <div>
            <span className="result-label">JWT token</span>
            <code>{token || 'Login to receive a token here.'}</code>
          </div>

          <button className="ghost-button" onClick={handleLogout} type="button">
            Logout
          </button>
        </div>
      </section>
    </main>
  )
}

export default App
