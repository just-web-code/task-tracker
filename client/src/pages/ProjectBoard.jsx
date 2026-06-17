import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { api } from '../api.js'
import TaskModal from './TaskModal.jsx'

const PRIORITY_CLASS = { low: 'p-low', medium: 'p-med', high: 'p-high', urgent: 'p-urg' }

export default function ProjectBoard() {
  const { pid } = useParams()
  const [project, setProject] = useState(null)
  const [tasks, setTasks] = useState([])
  const [labels, setLabels] = useState([])
  const [members, setMembers] = useState([])
  const [err, setErr] = useState(null)
  const [openTaskId, setOpenTaskId] = useState(null)
  const [dragId, setDragId] = useState(null)

  // per-column "new task" draft + new board/column names
  const [taskDrafts, setTaskDrafts] = useState({})
  const [boardName, setBoardName] = useState('')
  const [colNames, setColNames] = useState({})

  const load = useCallback(async () => {
    setErr(null)
    try {
      const p = await api.getProject(pid)
      setProject(p)
      const [t, l, w] = await Promise.all([
        api.listTasks(pid, { pageSize: 200 }),
        api.listLabels(p.workspaceId),
        api.getWorkspace(p.workspaceId),
      ])
      setTasks(t.items || [])
      setLabels(l)
      setMembers(w.members || [])
    } catch (e) {
      setErr(e.message)
    }
  }, [pid])

  useEffect(() => { load() }, [load])

  async function addBoard(e) {
    e.preventDefault()
    if (!boardName.trim()) return
    try { await api.createBoard(pid, boardName.trim()); setBoardName(''); load() }
    catch (e) { setErr(e.message) }
  }

  async function addColumn(boardId) {
    const name = (colNames[boardId] || '').trim()
    if (!name) return
    try {
      await api.createColumn(boardId, name)
      setColNames((s) => ({ ...s, [boardId]: '' }))
      load()
    } catch (e) { setErr(e.message) }
  }

  async function addTask(columnId) {
    const title = (taskDrafts[columnId] || '').trim()
    if (!title) return
    try {
      await api.createTask(columnId, { title })
      setTaskDrafts((s) => ({ ...s, [columnId]: '' }))
      load()
    } catch (e) { setErr(e.message) }
  }

  async function onDrop(columnId) {
    if (dragId == null) return
    const task = tasks.find((t) => t.id === dragId)
    setDragId(null)
    if (!task || task.columnId === columnId) return
    const position = tasks.filter((t) => t.columnId === columnId).length + 1
    try { await api.moveTask(task.id, columnId, position); load() }
    catch (e) { setErr(e.message) }
  }

  if (!project) return <div className="page">{err ? <div className="error">{err}</div> : <p className="muted">Loading…</p>}</div>

  const tasksByColumn = (cid) =>
    tasks.filter((t) => t.columnId === cid).sort((a, b) => a.position - b.position)

  return (
    <div className="page board-page">
      <div className="breadcrumb">
        <Link to="/">Workspaces</Link> <span>/</span>
        <Link to={`/workspaces/${project.workspaceId}`}>workspace #{project.workspaceId}</Link> <span>/</span>
        <strong>{project.name}</strong>
        <Link className="btn ghost" style={{ marginLeft: 'auto' }} to={`/projects/${pid}/stats`}>📊 Stats</Link>
      </div>

      {err && <div className="error">{err}</div>}

      {(project.boards || []).map((board) => (
        <section key={board.id} className="board">
          <div className="board-head">
            <h3>{board.name}</h3>
            <div className="inline-form">
              <input placeholder="+ column" value={colNames[board.id] || ''}
                onChange={(e) => setColNames((s) => ({ ...s, [board.id]: e.target.value }))}
                onKeyDown={(e) => e.key === 'Enter' && addColumn(board.id)} />
              <button className="btn" onClick={() => addColumn(board.id)}>Add</button>
            </div>
          </div>

          <div className="columns">
            {(board.columns || []).length === 0 && <p className="muted">No columns yet — add one above.</p>}
            {(board.columns || []).sort((a, b) => a.position - b.position).map((col) => (
              <div key={col.id} className="column"
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => onDrop(col.id)}>
                <div className="column-head">
                  <span>{col.name}</span>
                  <span className="count">{tasksByColumn(col.id).length}</span>
                </div>

                <div className="cards">
                  {tasksByColumn(col.id).map((t) => (
                    <div key={t.id} className="task-card" draggable
                      onDragStart={() => setDragId(t.id)}
                      onClick={() => setOpenTaskId(t.id)}>
                      <div className="task-title">{t.title}</div>
                      <div className="task-meta">
                        <span className={'pill ' + (PRIORITY_CLASS[t.priority] || '')}>{t.priority}</span>
                        <span className="pill">{t.status}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="add-task">
                  <input placeholder="+ task" value={taskDrafts[col.id] || ''}
                    onChange={(e) => setTaskDrafts((s) => ({ ...s, [col.id]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && addTask(col.id)} />
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}

      <form className="inline-form new-board" onSubmit={addBoard}>
        <input value={boardName} onChange={(e) => setBoardName(e.target.value)}
          placeholder="+ new board" maxLength={150} />
        <button className="btn primary">Add board</button>
      </form>

      {openTaskId != null && (
        <TaskModal
          taskId={openTaskId}
          labels={labels}
          members={members}
          onClose={() => setOpenTaskId(null)}
          onChanged={load}
        />
      )}
    </div>
  )
}
