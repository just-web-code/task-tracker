import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { api } from '../api.js'

export default function WorkspaceDetail() {
  const { wid } = useParams()
  const navigate = useNavigate()
  const [ws, setWs] = useState(null)
  const [projects, setProjects] = useState(null)
  const [labels, setLabels] = useState(null)
  const [err, setErr] = useState(null)

  // form state
  const [pName, setPName] = useState('')
  const [pDesc, setPDesc] = useState('')
  const [memberId, setMemberId] = useState('')
  const [memberRole, setMemberRole] = useState('member')
  const [labelName, setLabelName] = useState('')
  const [labelColor, setLabelColor] = useState('#4f46e5')

  async function load() {
    setErr(null)
    try {
      const [w, p, l] = await Promise.all([
        api.getWorkspace(wid),
        api.listProjects(wid),
        api.listLabels(wid),
      ])
      setWs(w)
      setProjects(p.items || [])
      setLabels(l)
    } catch (e) {
      setErr(e.message)
    }
  }
  useEffect(() => { load() }, [wid])

  async function createProject(e) {
    e.preventDefault()
    if (!pName.trim()) return
    try {
      await api.createProject(wid, pName.trim(), pDesc.trim())
      setPName(''); setPDesc('')
      load()
    } catch (e) { setErr(e.message) }
  }

  async function addMember(e) {
    e.preventDefault()
    const id = parseInt(memberId, 10)
    if (!id) return
    try {
      await api.addMember(wid, id, memberRole)
      setMemberId('')
      load()
    } catch (e) { setErr(e.message) }
  }

  async function createLabel(e) {
    e.preventDefault()
    if (!labelName.trim()) return
    try {
      await api.createLabel(wid, labelName.trim(), labelColor)
      setLabelName('')
      load()
    } catch (e) { setErr(e.message) }
  }

  async function removeProject(id) {
    if (!confirm('Delete this project and everything in it?')) return
    try {
      await api.deleteProject(id)
      load()
    } catch (e) { setErr(e.message) }
  }

  if (!ws) return <div className="page">{err ? <div className="error">{err}</div> : <p className="muted">Loading…</p>}</div>

  return (
    <div className="page">
      <div className="breadcrumb">
        <Link to="/">Workspaces</Link> <span>/</span> <strong>{ws.name}</strong>
      </div>

      {err && <div className="error">{err}</div>}

      <div className="cols-2">
        <section>
          <h2>Projects</h2>
          <form className="inline-form" onSubmit={createProject}>
            <input value={pName} onChange={(e) => setPName(e.target.value)}
              placeholder="Project name" maxLength={150} />
            <input value={pDesc} onChange={(e) => setPDesc(e.target.value)}
              placeholder="Description (optional)" />
            <button className="btn primary">Add</button>
          </form>
          {projects == null ? <p className="muted">Loading…</p>
            : projects.length === 0 ? <p className="muted">No projects yet.</p>
            : (
              <div className="list">
                {projects.map((p) => (
                  <div key={p.id} className="card row-item">
                    <div>
                      <Link className="strong" to={`/projects/${p.id}`}>{p.name}</Link>
                      {p.description && <p className="muted">{p.description}</p>}
                    </div>
                    <div className="row-actions">
                      <Link className="btn ghost" to={`/projects/${p.id}/stats`}>Stats</Link>
                      <button className="btn danger ghost" onClick={() => removeProject(p.id)}>Delete</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
        </section>

        <aside className="sidecol">
          <section className="card">
            <h3>Members</h3>
            <ul className="plain">
              {(ws.members || []).map((m) => (
                <li key={m.user_id}>
                  <span>user #{m.user_id}</span>
                  <span className={'pill ' + (m.role === 'owner' ? 'pill-owner' : '')}>{m.role}</span>
                </li>
              ))}
            </ul>
            <form className="inline-form" onSubmit={addMember}>
              <input value={memberId} onChange={(e) => setMemberId(e.target.value)}
                placeholder="User id" type="number" />
              <select value={memberRole} onChange={(e) => setMemberRole(e.target.value)}>
                <option value="member">member</option>
                <option value="owner">owner</option>
              </select>
              <button className="btn">Add</button>
            </form>
          </section>

          <section className="card">
            <h3>Labels</h3>
            <div className="label-row">
              {(labels || []).map((l) => (
                <span key={l.id} className="label-chip" style={{ background: l.color }}>{l.name}</span>
              ))}
              {labels && labels.length === 0 && <span className="muted">No labels yet.</span>}
            </div>
            <form className="inline-form" onSubmit={createLabel}>
              <input value={labelName} onChange={(e) => setLabelName(e.target.value)}
                placeholder="Label name" maxLength={80} />
              <input type="color" value={labelColor} onChange={(e) => setLabelColor(e.target.value)} />
              <button className="btn">Add</button>
            </form>
          </section>
        </aside>
      </div>
    </div>
  )
}
