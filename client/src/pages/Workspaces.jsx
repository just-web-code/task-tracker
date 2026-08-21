import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api.js'

export default function Workspaces() {
  const [list, setList] = useState(null)
  const [name, setName] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setErr(null)
    try {
      // `GET /workspaces` returns the caller's *memberships*, each carrying
      // the workspace it grants and the role in it. The 0.9.x version
      // unwrapped that in the service with a loop; 1.0 does it in the join,
      // so the role is now available here and the shape is one level deeper.
      const rows = await api.listWorkspaces()
      setList(rows.map((r) => ({ ...r.workspace, role: r.role })))
    } catch (e) {
      setErr(e.message)
    }
  }
  useEffect(() => { load() }, [])

  async function create(e) {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setErr(null)
    try {
      await api.createWorkspace(name.trim())
      setName('')
      await load()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-head">
        <h2>Your workspaces</h2>
      </div>

      <form className="inline-form" onSubmit={create}>
        <input value={name} onChange={(e) => setName(e.target.value)}
          placeholder="New workspace name" maxLength={150} />
        <button className="btn primary" disabled={busy}>Create</button>
      </form>

      {err && <div className="error">{err}</div>}

      {list == null ? (
        <p className="muted">Loading…</p>
      ) : list.length === 0 ? (
        <p className="muted">No workspaces yet. Create one above.</p>
      ) : (
        <div className="grid">
          {list.map((ws) => (
            <Link key={ws.id} to={`/workspaces/${ws.id}`} className="card tile">
              <h3>{ws.name}</h3>
              <p className="muted">workspace #{ws.id} · owner #{ws.owner_id} · you are {ws.role}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
