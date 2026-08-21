import { useEffect, useState, useCallback } from 'react'
import Modal from '../components/Modal.jsx'
import { api } from '../api.js'

const STATUSES = ['todo', 'in_progress', 'review', 'done']
const PRIORITIES = ['low', 'medium', 'high', 'urgent']

export default function TaskModal({ taskId, labels, members, onClose, onChanged }) {
  const [task, setTask] = useState(null)
  const [comments, setComments] = useState([])
  const [err, setErr] = useState(null)
  const [draft, setDraft] = useState(null)
  const [comment, setComment] = useState('')
  const [addLabelId, setAddLabelId] = useState('')
  const [addUserId, setAddUserId] = useState('')

  const load = useCallback(async () => {
    setErr(null)
    try {
      const [t, c] = await Promise.all([api.getTask(taskId), api.listComments(taskId)])
      setTask(t)
      setComments(c.items || [])
      setDraft({
        title: t.title || '',
        description: t.description || '',
        status: t.status || 'todo',
        priority: t.priority || 'medium',
      })
    } catch (e) { setErr(e.message) }
  }, [taskId])

  useEffect(() => { load() }, [load])

  // refresh both the modal and the board behind it
  async function refresh() { await load(); onChanged && onChanged() }

  async function saveField(patch) {
    try { await api.updateTask(taskId, patch); await refresh() }
    catch (e) { setErr(e.message) }
  }

  async function attachLabel() {
    const id = parseInt(addLabelId, 10)
    if (!id) return
    try { await api.addTaskLabel(taskId, id); setAddLabelId(''); await refresh() }
    catch (e) { setErr(e.message) }
  }
  async function detachLabel(id) {
    try { await api.removeTaskLabel(taskId, id); await refresh() }
    catch (e) { setErr(e.message) }
  }
  async function attachAssignee() {
    const id = parseInt(addUserId, 10)
    if (!id) return
    try { await api.addAssignee(taskId, id); setAddUserId(''); await refresh() }
    catch (e) { setErr(e.message) }
  }
  async function detachAssignee(id) {
    try { await api.removeAssignee(taskId, id); await refresh() }
    catch (e) { setErr(e.message) }
  }
  async function postComment(e) {
    e.preventDefault()
    if (!comment.trim()) return
    try { await api.addComment(taskId, comment.trim()); setComment(''); await load() }
    catch (e) { setErr(e.message) }
  }

  const attachedLabelIds = new Set((task?.labels || []).map((l) => l.id))
  const availableLabels = labels.filter((l) => !attachedLabelIds.has(l.id))
  const assignedIds = new Set((task?.assignees || []).map((u) => u.id))
  const availableMembers = members.filter((m) => !assignedIds.has(m.user_id))

  return (
    <Modal title={task ? `Task #${task.id}` : 'Task'} onClose={onClose} wide>
      {err && <div className="error">{err}</div>}
      {!task || !draft ? <p className="muted">Loading…</p> : (
        <div className="task-detail">
          <div className="task-main">
            <label>Title
              <input value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                onBlur={() => draft.title !== task.title && saveField({ title: draft.title })} />
            </label>
            <label>Description
              <textarea rows={4} value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                onBlur={() => draft.description !== task.description && saveField({ description: draft.description })} />
            </label>

            <section className="comments">
              <h4>Comments ({comments.length})</h4>
              <div className="comment-list">
                {comments.map((c) => (
                  <div key={c.id} className="comment">
                    <div className="comment-head">
                      <strong>{c.author ? c.author.name : `user #${c.author_id}`}</strong>
                      <span className="muted">{fmt(c.created_at)}</span>
                    </div>
                    <div>{c.body}</div>
                  </div>
                ))}
                {comments.length === 0 && <p className="muted">No comments yet.</p>}
              </div>
              <form className="inline-form" onSubmit={postComment}>
                <input value={comment} onChange={(e) => setComment(e.target.value)}
                  placeholder="Write a comment…" maxLength={4000} />
                <button className="btn primary">Send</button>
              </form>
            </section>
          </div>

          <aside className="task-side">
            <label>Status
              <select value={draft.status}
                onChange={(e) => { setDraft({ ...draft, status: e.target.value }); saveField({ status: e.target.value }) }}>
                {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label>Priority
              <select value={draft.priority}
                onChange={(e) => { setDraft({ ...draft, priority: e.target.value }); saveField({ priority: e.target.value }) }}>
                {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            </label>

            <div className="side-block">
              <h4>Labels</h4>
              <div className="label-row">
                {(task.labels || []).map((l) => (
                  <span key={l.id} className="label-chip" style={{ background: l.color }}>
                    {l.name}
                    <button className="chip-x" onClick={() => detachLabel(l.id)}>✕</button>
                  </span>
                ))}
                {(task.labels || []).length === 0 && <span className="muted">None</span>}
              </div>
              {availableLabels.length > 0 && (
                <div className="inline-form">
                  <select value={addLabelId} onChange={(e) => setAddLabelId(e.target.value)}>
                    <option value="">Add label…</option>
                    {availableLabels.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                  </select>
                  <button className="btn" onClick={attachLabel}>Add</button>
                </div>
              )}
            </div>

            <div className="side-block">
              <h4>Assignees</h4>
              <ul className="plain">
                {(task.assignees || []).map((u) => (
                  <li key={u.id}>
                    <span>{u.name} <span className="muted">#{u.id}</span></span>
                    <button className="btn ghost xs" onClick={() => detachAssignee(u.id)}>remove</button>
                  </li>
                ))}
                {(task.assignees || []).length === 0 && <li className="muted">None</li>}
              </ul>
              {availableMembers.length > 0 && (
                <div className="inline-form">
                  <select value={addUserId} onChange={(e) => setAddUserId(e.target.value)}>
                    <option value="">Assign member…</option>
                    {availableMembers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>user #{m.user_id} ({m.role})</option>
                    ))}
                  </select>
                  <button className="btn" onClick={attachAssignee}>Add</button>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}
    </Modal>
  )
}

function fmt(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return isNaN(d) ? String(ts) : d.toLocaleString()
}
