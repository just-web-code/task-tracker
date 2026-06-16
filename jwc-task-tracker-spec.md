# Task Tracker API — JWC build spec (Trello / Linear-lite)

**Maqsad:** JWC'да real, o'rtacha-kattaroq backend qurib, uning kuchli va zaif joylarini topish (dogfooding).
**Eslatma:** JWC syntaksisini o'zing yozasan — bu **spec** (nima qurish), kod emas. Qurar ekansan, oxiridagi "JWC pain log"ни to'ldirib bor.

---

## 1. Data model (entity'lar)

**User** — id, email, passwordHash, name, createdAt
**Workspace** — id, name, ownerId → User, createdAt
**WorkspaceMember** *(join: Workspace ↔ User, rol bilan)* — workspaceId, userId, role (owner / member)
**Project** — id, workspaceId → Workspace, name, description, createdAt
**Board** — id, projectId → Project, name, position
**Column** — id, boardId → Board, name, position
**Task** — id, columnId → Column, title, description, status, priority, position, dueDate, createdById → User, createdAt, updatedAt
**Label** — id, workspaceId → Workspace, name, color
**TaskLabel** *(join: Task ↔ Label)* — taskId, labelId
**TaskAssignee** *(join: Task ↔ User)* — taskId, userId
**Comment** — id, taskId → Task, authorId → User, body, createdAt
**Activity** *(ixtiyoriy, feed uchun)* — id, projectId → Project, actorId → User, type, payload, createdAt

**Munosabatlar:**
- Workspace 1—N Project → Board → Column → Task *(chuqur nesting)*
- Task **N—N** Label *(TaskLabel orqali)*
- Task **N—N** User — assignee *(TaskAssignee orqali)*
- Workspace **N—N** User — a'zolar, rol bilan *(WorkspaceMember orqali)*
- Task 1—N Comment; User 1—N Comment

---

## 2. Endpoint'lar (REST)

**Auth**
- `POST /auth/register`
- `POST /auth/login` → token

**Workspaces**
- `GET /workspaces` — meniki
- `POST /workspaces`
- `GET /workspaces/:id` — a'zolar bilan
- `POST /workspaces/:id/members` — a'zo qo'shish

**Projects**
- `GET /workspaces/:wid/projects`
- `POST /workspaces/:wid/projects`
- `GET /projects/:id` — board → column → task (qisqa) bilan
- `PATCH /projects/:id` · `DELETE /projects/:id`

**Boards / Columns**
- `POST /projects/:pid/boards`
- `POST /boards/:bid/columns`
- `PATCH /columns/:id` — nom / tartib

**Tasks** *(asosiy qism)*
- `GET /projects/:pid/tasks?assignee=&label=&status=&priority=&page=` — filter + pagination
- `POST /columns/:cid/tasks`
- `GET /tasks/:id` — assignee + label + comment bilan
- `PATCH /tasks/:id`
- `POST /tasks/:id/move` — column + position o'zgartirish
- `POST /tasks/:id/labels` · `DELETE /tasks/:id/labels/:labelId` *(m2m)*
- `POST /tasks/:id/assignees` · `DELETE /tasks/:id/assignees/:userId` *(m2m)*

**Labels**
- `GET /workspaces/:wid/labels` · `POST /workspaces/:wid/labels`

**Comments**
- `GET /tasks/:tid/comments` · `POST /tasks/:tid/comments`

**Stats** *(agregatsiya — JWC sinovi)*
- `GET /projects/:pid/stats` — column bo'yicha task soni, status bo'yicha, assignee bo'yicha
- `GET /projects/:pid/activity` — so'nggi faollik *(ixtiyoriy)*

---

## 3. Qurish tartibi (bosqichlar)

1. **Auth + scoping:** register/login, User, Workspace + a'zolik. (Avval auth ishlasin.)
2. **Iyerarxiya:** Project, Board, Column CRUD; nested load (project → board → column). → *nesting/`with` sinovi*
3. **Tasks:** Task CRUD, move, filter + pagination. → *core CRUD + query*
4. **Many-to-many:** Label + assignee (qo'shish/olib tashlash); task detail (label + assignee + comment bilan). → ***m2m sinovi***
5. **Comment + Activity feed.**
6. **Stats/agregatsiya endpoint'lari.** → ***agregatsiya sinovi***
7. **Sayqal:** validatsiya, scoping (faqat o'z workspace'ing ma'lumoti), error handling, hamma joyда pagination.

---

## 4. JWC pain log — kuzatadigan bo'shliqlar (eng qimmatli qism)

Har biriда yoz: JWC uddaladimi? `raw_sql`ga qaytdingmi? Qayerда noqulay bo'ldi?

1. **Many-to-many** (WorkspaceMember, TaskLabel, TaskAssignee): join-jadval + qo'shish/olib tashlash + "task'ni label va assignee'lari bilan" yuklash. Real `join` yo'q — `with`/navigatsiya m2m'ni toza uddalaydimi, yoki `raw_sql`? **(eng katta sinov)**
2. **Chuqur nested load** (Project → Board → Column → Task → assignee/label): `with`/json_agg qancha chuqur ketadi — qayerда noqulay yoki sekin bo'ladi?
3. **Ko'p ixtiyoriy filter** (assignee + label + status + priority + pagination): dinamik/ixtiyoriy filterни toza ifodalaydimi, yoki qiyinlashadimi?
4. **Agregatsiya** (column/status/assignee bo'yicha task soni, faollik): GROUP BY hikoyasi bormi? Ehtimol `raw_sql`. Aniq nima yetishmasligini yoz.
5. **Transaction / ko'p qadamli yozish** (move = column + position; "project + default board/column"ni birga yaratish): JWC transaktsion ko'p-yozishni qo'llaydimi? Atomiclik bormi?
6. **Auth + qator scoping** (har query foydalanuvchi workspace'iga cheklangan): "joriy user / uning workspace'lari"ни query'ga qanday ulaysan — middleware? qo'lда where?
7. **Tartib / position** (column/task'ni qayta tartiblash): fractional indexing yoki integer qayta-raqamlash? JWC tartiblangan ro'yxatni qanday boshqaradi?

> Bu pain log — JWC'ga keyin nima kerakligining oltin ro'yxati. Har "yetishmadi" — keyingi feature.

---

**Birinchi qadam:** Phase 1 — auth + User + Workspace. Eng kichik ishlaydigan bo'lak: register → login → workspace yaratish. Keyin sekin yuqoriga.
