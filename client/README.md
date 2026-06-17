# Task Tracker — React client

A full SPA client for the JWC Task Tracker API: auth, workspaces, members,
projects, a drag-and-drop Kanban board (boards → columns → tasks), task detail
(labels, assignees, comments) and a stats / activity view.

Stack: React 18 + React Router + Vite. No backend CORS needed — the Vite dev
server proxies `/api/*` to the JWC backend (see `vite.config.js`).

## Run

1. Start the backend first (from the repo root), with Postgres up and migrated:
   ```bash
   jwc migrate up
   jwc run          # serves on http://localhost:8080
   ```
2. Start the client:
   ```bash
   cd client
   npm install
   npm run dev      # http://localhost:5173
   ```

If the backend runs somewhere other than `http://localhost:8080`, set the proxy
target before `npm run dev`:
```bash
# PowerShell
$env:VITE_API_TARGET = 'http://localhost:9000'; npm run dev
```

## Flow

Register → you're logged in automatically (the API has no token on register, so
the client logs in right after) → create a workspace → open it → add a project →
open the project board → add a board, columns, and tasks → drag cards between
columns → click a card to edit it, attach labels/assignees, and comment →
**Stats** shows task counts by status / column / assignee plus the activity feed.

## Notes

- The JWT is stored in `localStorage` and sent as `Authorization: Bearer <token>`.
  The current user id is read from the token's `sub` claim (no `/me` endpoint).
- Workspace membership only exposes user ids (the API returns no names there), so
  members and the assignee picker show `user #id`. Assignee names *do* appear on a
  task once assigned, because the task detail endpoint projects them.
- The API docs (Swagger UI) live on the backend itself at
  http://localhost:8080/docs.
