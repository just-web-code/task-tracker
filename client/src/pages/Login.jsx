import { useState } from 'react'
import { useAuth } from '../auth.jsx'

export default function Login() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr(null)
    setBusy(true)
    try {
      if (mode === 'login') await login(email, password)
      else await register(email, password, name)
    } catch (e) {
      setErr(e.message || 'Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-wrap">
      <form className="card auth-card" onSubmit={submit}>
        <h1>📋 Task Tracker</h1>
        <div className="tabs">
          <button type="button" className={mode === 'login' ? 'tab active' : 'tab'}
            onClick={() => setMode('login')}>Log in</button>
          <button type="button" className={mode === 'register' ? 'tab active' : 'tab'}
            onClick={() => setMode('register')}>Register</button>
        </div>

        {mode === 'register' && (
          <label>Name
            <input value={name} onChange={(e) => setName(e.target.value)}
              placeholder="Jane Doe" required minLength={1} maxLength={120} />
          </label>
        )}
        <label>Email
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com" required />
        </label>
        <label>Password
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="min 8 characters" required minLength={8} maxLength={200} />
        </label>

        {err && <div className="error">{err}</div>}
        <button className="btn primary" disabled={busy}>
          {busy ? '…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>
    </div>
  )
}
