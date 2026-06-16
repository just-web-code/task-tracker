# JWC pain log 2 — Task Tracker, JWC 0.4.9 ga qayta yozildi

Birinchi [PAIN_LOG.md](./PAIN_LOG.md) 0.4.8 bilan qurish jarayonida topilgan
og'riqlarni hujjatlashtirdi. Bu hujjat shu loyihani **JWC 0.4.9** imkoniyatlari
bilan qayta yozish natijasini yozadi: qaysi og'riqlar tuzatildi (va workaround
olib tashlandi), qaysilari qoldi.

Hamma narsa **runtime'da, Postgres'ga qarshi jonli tekshirildi** (izolyatsiyalangan
konteyner, to'liq oqim: register → login(Bearer) → workspace → project → board →
column → task CRUD/move → relations → comment → activity → stats). Faqat rost.

---

## 1. 0.4.9 tuzatgan og'riqlar (workaround olib tashlandi)

| # (eski) | Og'riq (0.4.8) | 0.4.9 fix | Qayerda ishlatildi (verified) |
|---|---|---|---|
| P0 #3 | `status` rezervlangan javob kaliti — `json(task)` `status`ni yutardi | sentinel orqali saqlanadi | `TaskController`: `{data:}` envelope olib tashlandi, `json(t)` bare — javobda `"status":"done"` turibdi |
| P0 #2 | `update <var> in` select-loaded row'ni rad etardi (Str↔Object) | select-Record qabul qilinadi | `TaskService.update/move`, `ProjectService.update`, `ColumnService.update`: kanonik load → mutate → `update x in` → return |
| P0 #4 | datetime auto-bind ustun tipini e'tiborsiz qoldirardi | schema-aware binding | Task.dueDate/createdAt/updatedAt to'g'ri saqlanadi |
| P0 #4b | `json`/jsonb ustun obyektni text deb bind qilardi | schema-aware bind | `Activity.payload` `varchar` → `json`; `ActivityService` `json_stringify`/`json_parse` siz — feed'da `payload:{taskId,title}` obyekt round-trip |
| P1 #6 | typed class param BARCHA maydonni majburlardi (PATCH buzuq) | partial PATCH | `ProjectService.update(req: UpdateProjectRequest)` — `{name}` yuborilsa `description` yo'qligi xato bermaydi |
| P1 #7 | `jwt_verify` `Bearer ` strip qilmasdi | avtomatik strip | `AuthMiddleware`: `replace(raw,"Bearer ","")` olib tashlandi, `jwt_verify(raw, ...)` — `Authorization: Bearer <t>` to'g'ridan-to'g'ri ishladi |
| 🟢 docs | `query_param` yo'q bo'lsa `null` | endi `""` | barcha controller'larda null-coerce (`if x==null x=""`) olib tashlandi |
| P1 #9 | email unique faqat app-darajada (TOCTOU) | `unique` modifikatori | `User.email varchar(120) unique` → DB `user_email_key` UNIQUE; app-check 400 beradi, DB constraint poyga'ni yopadi |
| P1 #10 | `limit @x offset @y` dinamik qiymat ishonchsiz; `count(*)` yo'q | bound limit/offset + skalyar count | `ProjectService.listByWorkspace`, `TaskService.listByProject` (filter'siz yo'l), `CommentService.listByTask`: fetch+slice o'rniga DB-side paging + `select count(*)` total |
| Phase 1 #2 | entity-tipli return select'ni rad etardi | endi qabul qiladi | `getById`/`findByEmail` larga `: Entity?` return-type qaytarildi (0.4.8'da olib tashlashga majbur edik) |
| Phase 2 N+1 | board → column nested load N+1 | `with` nav eager loading | `ProjectService.detail`: `select Board with columns` — bitta json_agg query, board'lar kolonkalari bilan keladi |

Position uchun `length(fetch-all)+1` o'rniga `select count(*)` ishlatildi
(Task/Board/Column create) — to'liq jadvalni o'qimaydi.

---

## 2. Hali qolgan og'riqlar (0.4.9'dan keyingi oltin ro'yxat)

**🔴 P0 — eng katta yetishmovchilik:**

1. **Grouped agregatsiya / arbitrary-shape projection — hali YO'Q.** Runtime'da
   tasdiqlandi:
   - `select Entity ... group by col` → `SELECT t.* ... GROUP BY col` chiqaradi,
     Postgres rad etadi: `column "t.id" must appear in the GROUP BY clause`.
   - `having count(*) > N` — **parse bo'lmaydi** (`having` faqat yalang ustun
     taqqoslashini oladi).
   - `select { status, total: count(*) }` (aliased + aggregate projection) —
     implement qilinmagan; projection faqat yalang ustun nomlari.
   - Natija: `StatsService` (byStatus/byColumn/byAssignee) **`raw_sql`da qoladi**
     (json_agg::text + json_parse). Skalyar `select count(*) from ...` esa
     ishlaydi (pagination total, next-position uchun ishlatildi).

**🟡 P1 — Query Layer qolgan qismi:**

2. **Explicit multi-entity JOIN yo'q.** `with` faqat child-FK yo'nalishidagi
   navlar (has-many / has-one) uchun. Qolgan N+1 lar:
   - **belongs-to** (`with` qoplamaydi): `Comment → author`, `Activity → actor`,
     `WorkspaceMember → workspace` (myWorkspaces) — hamon alohida select.
   - **m2m** (join jadval orqali): task ↔ label, task ↔ assignee
     (`labelsFor`/`assigneesFor`) — `with` m2m'ni qoplamaydi, N+1 saqlandi.
3. **`with` nav cheklovi:** nav to'plamini tartiblash sintaksisi yo'q — board
   ichidagi kolonka tartibi (json_agg) aniq emas. Ikki bosqichli nested `with`
   (project → boards → columns bitta query'da) ishlatilmadi/sinalmadi.
4. **Dinamik / optional filter kompozitsiyasi yo'q.** `where` statik; Task
   ro'yxatida status/priority filtri bo'lsa yana fetch+filter (in-code) ga
   tushiladi. Dinamik-uzunlikdagi `in (@list)` qo'llab-quvvatlanmaydi — faqat
   fixed-arity `in (a, b, c)` ishlaydi.

**🟢 Kichik / ergonomika:**

5. **Atomik `update CTX.Table set col = @param`** — RHS paramref'ni rad etadi
   (`expected expression`); faqat literal va column-arith (`hits = hits + 1`).
   Kanonik `update <var> in` (load → mutate → update) bilan o'rni qoplangan.
6. **`schema_diff` `unique`ni ALTER sifatida chiqarmaydi.** `migrate new` mavjud
   ustunga qo'shilgan `unique`ni sezmadi — faqat fresh `CREATE TABLE` (gen-sql)
   `UNIQUE`ni hosil qiladi. `ALTER TABLE ... ADD CONSTRAINT ... UNIQUE`ni
   migratsiyaga qo'lda yozish kerak bo'ldi.
7. **Position/reorder primitivi yo'q.** `count(*)+1` append uchun ishlaydi, lekin
   reorder qo'shnilarni qayta raqamlamaydi (collision saqlanadi).

---

> **Xulosa:** 0.4.9 PAIN_LOG.md'dagi P0 #2/#3/#4/#4b va P1 #6/#7/#9/#10 ni
> yopdi — kanonik CRUD pattern'lari (status-safe javob, `update x in`, partial
> PATCH, jsonb, schema-aware bind, DB-side paging, `unique`) endi workaround'siz
> ishlaydi. Qolgan asosiy bo'shliq — **Query Layer** (grouped agregatsiya +
> arbitrary projection, explicit JOIN, m2m/belongs-to eager load, dinamik
> filter). `with` (has-many) va skalyar `count(*)` keldi; agregatsiya-projection
> va join hali raw_sql talab qiladi.

---

## Update — Query Layer plani (v2) implement qilindi (jwc 0.5.x, runtime-verified)

`jwc-query-layer-plan-v2.md` bo'yicha quyidagilar **jwc-lang'ga shipped** (har biri
fmt/clippy/371-test gated, probe'da runtime tasdiq):

- **A1** — nav-collection ordering: `posts: List<Post> via Post.userId orderby createdAt desc;` → `json_agg(... ORDER BY ...)`.
- **A2** — belongs-to eager load + nav projection: `author: User { id, name } via authorId;` (parol sizmaydi).
- **A3** — m2m eager load: `labels: List<Label> via TaskLabel(taskId, labelId);` (join-jadval orqali, projection bilan).
- **B** — grouped aggregation: `select Task { status, total: count(*) } group by status` — projection SELECT'ni boshqaradi.
- **D1** — `schema_diff` mavjud ustunga qo'shilgan `unique`ni `ALTER ... ADD CONSTRAINT` qilib chiqaradi.

**task-tracker qayta yozildi (live tasdiqlandi):**
- Read-path N+1 = **0**: `Activity.actor`, `Comment.author`, `WorkspaceMember.workspace` (myWorkspaces), `Task.labels`+`Task.assignees` — hammasi `with` eager-load. `labelsFor`/`assigneesFor` o'chirildi.
- `StatsService.byStatus` → native grouped aggregation (raw_sql'siz).

**Hali qolgan (ataylab kechiktirilgan tail; reja A4'ni "eng oxiri / kerak bo'lsa" degan):**
- **A4 — explicit multi-entity JOIN:** `byColumn`/`byAssignee` stats hamon `raw_sql` — ular JOIN ustidan sanaydi (task→column nomi; task_assignee→task→user). Bu cross-table aggregation `raw_sql`ning o'rinli ishlatilishi (escape hatch aynan shu uchun); umumiy JOIN sintaksisi katta keyingi epic.
- **C1 — dinamik/optional filter:** Task ro'yxatining status/priority filtri hamon filter-yo'q→DB-side / filter-bor→in-code shoxlanishi (query-builder kerak).
- **C2 — dinamik-uzunlikdagi `in (@list)` (`= ANY`):** hamon yo'q (app A2 belongs-to bilan o'rnini qopladi).
- **B2 — `having count(*)`:** aggregat having parse bo'lmaydi (app talab qilmaydi).
- **D2 — position/reorder primitivi:** `count(*)+1` append ishlaydi; reorder app-darajadagi fractional-indexing masalasi.
