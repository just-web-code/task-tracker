import { Link } from 'react-router-dom'
import { useAuth } from '../auth.jsx'

export default function Layout({ children }) {
  const { userId, logout } = useAuth()
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">📋 Task Tracker</Link>
        <div className="topbar-right">
          <span className="muted">user #{userId}</span>
          <button className="btn ghost" onClick={logout}>Log out</button>
        </div>
      </header>
      <main className="content">{children}</main>
    </div>
  )
}
