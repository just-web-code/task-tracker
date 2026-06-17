import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'

export default function ProjectStats() {
  const { pid } = useParams()
  const [stats, setStats] = useState(null)
  const [activity, setActivity] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const [s, a] = await Promise.all([api.getStats(pid), api.getActivity(pid)])
        setStats(s)
        setActivity(a)
      } catch (e) { setErr(e.message) }
    })()
  }, [pid])

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to={`/projects/${pid}`}>← Board</Link> <span>/</span> <strong>Stats</strong>
      </div>
      {err && <div className="error">{err}</div>}
      {!stats ? <p className="muted">Loading…</p> : (
        <div className="cols-3">
          <StatCard title="By status" rows={stats.byStatus} k="status" />
          <StatCard title="By column" rows={stats.byColumn} k="columnName" />
          <StatCard title="By assignee" rows={stats.byAssignee} k="userName" />
        </div>
      )}

      <section style={{ marginTop: 24 }}>
        <h3>Recent activity</h3>
        {!activity ? <p className="muted">Loading…</p>
          : activity.length === 0 ? <p className="muted">No activity yet.</p>
          : (
            <ul className="activity">
              {activity.map((a) => (
                <li key={a.id}>
                  <span className="pill">{a.type}</span>
                  <span>{a.actor ? a.actor.name : `user #${a.actorId}`}</span>
                  <span className="muted">{fmt(a.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  )
}

function StatCard({ title, rows, k }) {
  const data = Array.isArray(rows) ? rows : []
  const max = data.reduce((m, r) => Math.max(m, r.total), 0) || 1
  return (
    <div className="card">
      <h3>{title}</h3>
      {data.length === 0 ? <p className="muted">No data.</p> : (
        <ul className="bars">
          {data.map((r, i) => (
            <li key={i}>
              <span className="bar-label">{r[k] ?? '—'}</span>
              <span className="bar"><span className="bar-fill" style={{ width: `${(r.total / max) * 100}%` }} /></span>
              <span className="bar-val">{r.total}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function fmt(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return isNaN(d) ? String(ts) : d.toLocaleString()
}
