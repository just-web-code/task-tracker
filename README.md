# task-tracker

A Trello/Linear-lite board API, written in [JWC](https://github.com/just-web-code/jwc-lang),
with a small React client. It exists to be a real application in the
language — the kind with authorisation on every path, a board tree, m2m
labels and assignees, an audit feed and three grouped aggregates.

## Layout

```
src/app.jwc                 database, schema, server config, declared errors
src/db/schema.jwc           every table
src/dto/requests.jwc        every request class, with its validation rules
src/middleware/auth.jwc     RequireAuth — Bearer JWT → context.user_id
src/services/               the queries: auth, workspaces, projects, boards,
                            tasks, and labels/comments/activity/stats
src/routes/                 the HTTP surface
client/                     React + Vite
migrations/                 the 1.0 baseline; the 0.9.x history is archived
                            under migrations/archive-0.9/
```

## Running it

```bash
createdb task_tracker
export DATABASE_URL=postgres://localhost/task_tracker
export JWT_SECRET=...          # required
export CURSOR_SECRET=...       # required: signs the pagination cursors

jwc migrate up .
jwc serve .                    # or: jwc build . && ./bin/debug/app
```

`jwc build .` produces a single native binary. It is verified against
`jwc serve` the only way that means anything: both run against the same
Postgres, forty-six requests covering every route go to each, and the
responses are compared byte for byte — status, content-type and body.

## The 1.0 port

This was a 0.9.x program. What changed, and why:

### The wire is snake_case now

1.0 spells columns in snake_case (names.md §3.2) and a projection's keys
are the declared names, so `workspaceId` in a response is `workspace_id`.
The client changed with it, in the same commit.

The *physical* names did not change. The 0.9.x deployment created
`"passwordHash"`, `"workspaceId"` and singular table names, and every
column carries an `as "…"` override to keep them — renaming live columns
buys nothing.

### The schema grew constraints it always needed

The 0.9.x source declared no foreign keys. `ProjectService.deleteDeep`
said so and walked boards → columns → project by hand, in a transaction,
to clean up. The 1.0 schema declares them with `on delete cascade`, so
deleting a project is one statement and the database does the rest. The
two join tables also gained the `unique (task_id, …)` pairs that make
attaching a label idempotent — the 0.9.x version read first and then
inserted, which is a race.

### Pagination is keyset, not offset

`limit`/`offset` re-scans every row before the page and drifts when a row
is inserted mid-scroll. `GET /workspaces/{id}/projects`,
`GET /projects/{id}/tasks` and `GET /tasks/{id}/comments` take a `cursor`
instead, and answer `{items, next, has_more}`. The cursor is HMAC-signed
with `CURSOR_SECRET`: unsigned, it is a predicate the caller writes and
nobody checks.

### One thing got worse

`GET /tasks/{id}` runs three queries where 0.9.x ran one. 1.0 refuses a
query that carries two `as many` collections reached through link tables
(E0532, queries.md §6.2, DEFERRED-12), and the alternative — making the
link the collection — nests as `labels: [{ label: {…} }]`, a worse wire
shape than the extra round-trip. It is a task-detail fetch, not a list
path. Worth revisiting when DEFERRED-12 lands.

### What the port cost the language

Three defects in `jwc` itself, found by writing this and fixed there:

- `group by T.column_id, C.name` with `as { column_name: C.name }` was
  E0531 against a column that was plainly grouped — the alias map read
  only unqualified names.
- A record could not be assigned to a `jsonb` column, which types.md §5.6
  explicitly allows. The activity feed's `payload` is exactly that case.
- The native backend refused `=?` and `page`; both are lowered now.
