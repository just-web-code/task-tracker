// Thin fetch wrapper around the JWC Task Tracker API. Every call goes to
// `/api/*`, which the Vite dev server proxies to the backend (see vite.config.js).
// The JWT is kept in localStorage and attached as `Authorization: Bearer <token>`.

const TOKEN_KEY = 'tt_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}
export function setToken(t) {
  if (t) localStorage.setItem(TOKEN_KEY, t)
  else localStorage.removeItem(TOKEN_KEY)
}

// Decode the `sub` (user id) out of the JWT payload without a library.
export function decodeUserId(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub
  } catch {
    return null
  }
}

export class ApiError extends Error {
  constructor(status, body) {
    super((body && (body.error || body.message)) || `HTTP ${status}`)
    this.status = status
    this.body = body
  }
}

async function request(method, path, body) {
  const headers = {}
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'

  const res = await fetch('/api' + path, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  // 204 No Content (DELETE / detach) — nothing to parse.
  if (res.status === 204) return null

  const text = await res.text()
  let data = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }

  if (!res.ok) throw new ApiError(res.status, data)
  return data
}

export const api = {
  // ---- auth ----
  register: (b) => request('POST', '/auth/register', b),
  login: (b) => request('POST', '/auth/login', b),

  // ---- workspaces ----
  listWorkspaces: () => request('GET', '/workspaces'),
  createWorkspace: (name) => request('POST', '/workspaces', { name }),
  getWorkspace: (id) => request('GET', `/workspaces/${id}`),
  addMember: (id, userId, role) =>
    request('POST', `/workspaces/${id}/members`, { userId, role }),

  // ---- labels ----
  listLabels: (wid) => request('GET', `/workspaces/${wid}/labels`),
  createLabel: (wid, name, color) =>
    request('POST', `/workspaces/${wid}/labels`, { name, color }),

  // ---- projects ----
  listProjects: (wid) => request('GET', `/workspaces/${wid}/projects`),
  createProject: (wid, name, description) =>
    request('POST', `/workspaces/${wid}/projects`, { name, description }),
  getProject: (id) => request('GET', `/projects/${id}`),
  updateProject: (id, patch) => request('PATCH', `/projects/${id}`, patch),
  deleteProject: (id) => request('DELETE', `/projects/${id}`),

  // ---- boards / columns ----
  createBoard: (pid, name) => request('POST', `/projects/${pid}/boards`, { name }),
  createColumn: (bid, name) => request('POST', `/boards/${bid}/columns`, { name }),
  updateColumn: (id, patch) => request('PATCH', `/columns/${id}`, patch),

  // ---- tasks ----
  listTasks: (pid, params = {}) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== '' && v != null)
    ).toString()
    return request('GET', `/projects/${pid}/tasks${qs ? '?' + qs : ''}`)
  },
  createTask: (cid, body) => request('POST', `/columns/${cid}/tasks`, body),
  getTask: (id) => request('GET', `/tasks/${id}`),
  updateTask: (id, patch) => request('PATCH', `/tasks/${id}`, patch),
  moveTask: (id, columnId, position) =>
    request('POST', `/tasks/${id}/move`, { columnId, position }),
  addTaskLabel: (id, labelId) => request('POST', `/tasks/${id}/labels`, { labelId }),
  removeTaskLabel: (id, labelId) => request('DELETE', `/tasks/${id}/labels/${labelId}`),
  addAssignee: (id, userId) => request('POST', `/tasks/${id}/assignees`, { userId }),
  removeAssignee: (id, userId) => request('DELETE', `/tasks/${id}/assignees/${userId}`),

  // ---- comments ----
  listComments: (tid) => request('GET', `/tasks/${tid}/comments`),
  addComment: (tid, body) => request('POST', `/tasks/${tid}/comments`, { body }),

  // ---- stats / activity ----
  getStats: (pid) => request('GET', `/projects/${pid}/stats`),
  getActivity: (pid) => request('GET', `/projects/${pid}/activity`),
}
