# JWC pain log — Task Tracker dogfooding

JWC 0.4.8 bilan qurilmoqda. Har bosqichda: JWC uddaladimi, qayerda noqulay, `raw_sql`ga qaytildimi.

## Phase 1 — auth + User + Workspace + membership

**Holat:** ✅ Live ishladi. Postgres `task_tracker`, migrate up, end-to-end test o'tdi:
register → login → workspace yaratish (atomik owner-membership) → my workspaces → workspace+a'zolar → a'zo qo'shish → token yo'q = 401 → bob o'z workspace'ini ko'radi.

### Ishladi (raw_sql kerak bo'lmadi)
- **Auth oqimi:** `hash_password` / `verify_password` / `jwt_sign` / `jwt_verify` + `validate body { ... }` — to'liq, qo'shimcha kodsiz.
- **Scoping:** `middleware Auth` → `setContext("userId", claims.sub)` → route'da `context("userId")`. Qator-darajali scoping toza chiqdi (pain log #6).
- **Transaction:** workspace + owner-membership bitta `transaction { }` blokida atomik yaratildi (pain log #5) — ishladi.

### Noqulay / bug bo'lgan joylar
1. **🔴 `status` — rezervlangan javob kaliti (jiddiy):** `json({...})` body'dagi top-level `status` kalitini HTTP status kodi deb oladi va body'dan **o'chiradi**. `json({status:"ok"})` → `{}`. **Task entity'da `status` ustuni bor** — Phase 3'da `json(task)` task statusini yutib yuboradi. Yechim: envelope (`json({ data: task })`), nested, yoki projeksiyada qayta nomlash. Eng katta dizayn-tuzoq.
2. **🔴 Entity return-type + `select` bug:** `function f(): User { return select ... first; }` runtimeda yiqiladi — `select ... first` `Object` qaytaradi, lekin entity-tipli return faqat JSON-string qabul qiladi (`types.rs`). Qiziq: `new User()` qaytarish ishlaydi (string bo'ladi), `select` natijasi yo'q. Select qaytaruvchi funksiyalardan return-type annotatsiyasini olib tashlashga majbur bo'ldim → tip xavfsizligi yo'qoldi. *(testapp shu pattern bilan yozilgan — ehtimol 0.4.8'da hech sinalmagan.)*
3. **🟡 `jwt_verify` "Bearer " ni strip qilmaydi:** standart `Authorization: Bearer <t>` headerni middleware'da qo'lda `replace(raw, "Bearer ", "")` qilish kerak bo'ldi. Auth template'da ham shu kamchilik — out-of-the-box `Bearer` bilan 401 beradi.
4. **🟡 "Mening workspace'larim" (m2m o'qish):** join yo'q, dinamik `where id in (<list>)` yo'q. `WorkspaceMember`ni o'qib har biri uchun alohida `select Workspace ... first` — **N+1**. Aniq Phase 11 (Query Layer) ga ishora. *(pain log #1, #2)*
5. **🟢 `for` sintaksisi:** docs `for (x in xs)` yozadi, parser paren'siz `for x in xs` kutadi. Docs/parser nomuvofiqligi (kichik).
6. **🟢 Email unique:** app-darajali `findByEmail` tekshiruvi (TOCTOU race) — DB-darajali unique constraint qo'shilmadi.

## Phase 2 — Project / Board / Column CRUD + nested load

**Holat:** ✅ Live ishladi. Feature-based struktura (`src/Features/<Feature>/`). Test o'tdi: project create/list, board+column create (auto position), nested GET (project→board→column), partial PATCH, transaction'li deep delete (404), scoping (foreign workspace=403).

### Ishladi
- **Chuqur nested load:** `GET /projects/:id` → board → column to'liq yig'ildi (object literal ichiga `select` array'ni joylash ishlaydi). Lekin **N+1**: har board uchun alohida column select — join/`with` ishlatilmadi *(pain #2)*.
- **Transaction cascade delete:** FK on-delete-cascade ishlatmay, `transaction { bulk delete column → board → project }` — atomik, ishladi *(pain #5)*.
- **`Column` (SQL reserved):** entity → `"column"` jadval (quoted) — muammosiz, `user` kabi.
- **PATCH/DELETE, path param, auto position** (`length(existing)+1`) — ishladi.

### Bug / noqulay (Phase 2'da chiqqan)
1. **🔴 Row-based `update <var> in` select-loaded row bilan ishlamaydi:** `select ... first` `Object` qaytaradi, lekin `update`/`insert`/`delete <var>` `get_var_as_json` orqali `Value::Str` (JSON-string) talab qiladi. Ya'ni **kanonik `let x = select...; x.f=..; update x in` (testapp updateCar) pattern 0.4.8'da buzuq.** Yechim: `new Entity()` + pk + faqat o'zgargan maydon + dirty-tracking `update` (insert-stylе string bo'ladi).
2. **🔴 Atomik `update ... set col = @var` paramref qabul qilmaydi:** RHS'da `@newName` → parse error. Faqat literal / `body().field` / column-arith. Dinamik qiymat uchun atomik forma cheklangan.
3. **🔴 Typed class param partial'ni buzadi:** `function update(.., req: UpdateProjectRequest)` runtimeda DTO'ning BARCHA maydonini majburlaydi → PATCH `{name}` yuborsang `description yo'q` xatosi. Param tipini olib tashlashga majbur.
4. **🟡 Position/tartib (#7):** integer position qo'lda; reorder qo'shnilarni qayta raqamlamaydi (ikki column position=1 bo'lib qoldi). Fractional indexing yoki renumber logikasi kerak.

> Umumiy naqsh: runtime tip tizimi rigid (entity-return, class-param, row-update hammasi `Value::Str` kutadi, `select` esa `Object` beradi). Eng katta yashirin tuzoq — bu Str↔Object nomuvofiqligi.

## Phase 3 — Task CRUD + move + filter/pagination (eng katta qism)

**Holat:** ✅ Live ishladi. Endpointlar: `POST /columns/:cid/tasks`, `GET /projects/:pid/tasks` (filter+pagination), `GET /tasks/:id`, `PATCH /tasks/:id`, `POST /tasks/:id/move`. Test o'tdi: status saqlanish, status/priority filter, page/pageSize pagination, PATCH (updatedAt bump), move (+ cross-project move 400).

### Ishladi
- **`status` saqlash — envelope yechimi:** single-task javoblarni `{ data: <task> }` ga o'rab, top-level `status` strip'idan qutqarildi; list esa `items` ostida (xavfsiz). Ishladi.
- **Move + scoping:** task→projectId (denorm) orqali tez scoping; cross-project move bloklandi (400).
- **Pagination + filter** (code'da) — to'g'ri natija (total/page/items).

### Bug / noqulay (Phase 3'da chiqqan)
1. **🔴 `status` rezervlangan javob kaliti — TASDIQLANDI real ta'sir bilan:** `json(task)` bare qaytarilsa `status` yo'qoladi. Majburan `{data:..}` envelope. JWC'da javob body kaliti uchun reserved-word himoyasi kerak yoki opt-out.
2. **🔴 Datetime auto-bind:** JWC datetime-ko'rinish stringni ustun tipidan qat'i nazar `chrono::DateTime` qilib bind qiladi → varchar ustunga ISO sana = `cannot convert DateTime and varchar`. ISO'ni varchar'da saqlab bo'lmaydi; majburan `datetime` ustun.
3. **🔴 Optional/dinamik filter + pagination:** static `where`, dinamik predicate yo'q, dinamik `in (<list>)` yo'q → project tasklarini olib, filter+paginationни **code'da** qildim. Katta hajmda raw_sql / Phase 11 kerak. *(pain #3 tasdiq)*
4. **🟡 Join yo'qligi → denormalizatsiya:** task→column→board→project zanjirini joinsiz query qilib bo'lmagani uchun `projectId` ni Task'ga denorm qildim. *(pain #2)*
5. **🟡 Nullable sintaksisi:** entity column'da `field type nullable;` (keyword), `type?` EMAS (`?` faqat funksiya param/return type-ref uchun). Docs `age: int?` colon-style — chalg'itadi.
6. **🟡 `query_param()` yo'q bo'lsa `null` qaytaradi** (`""` emas) — typed `string` param null'ni rad etadi, controller'da coerce kerak.

## Phase 4 — Many-to-many: Label + assignee (eng katta sinov)

**Holat:** ✅ Live ishladi, **birinchi urinishda toza** (yangi crash yo'q — Phase 1–3 darslari ish berdi). Endpointlar: label CRUD, `POST/DELETE /tasks/:id/labels[/:labelId]`, `POST/DELETE /tasks/:id/assignees[/:userId]`, boyitilgan `GET /tasks/:id` (task+labels+assignees). Test: attach/detach, dedup, non-member assign=400, passwordHash sizmadi.

### Ishladi (raw_sql KERAK BO'LMADI)
- **m2m join jadval** (`TaskLabel`, `TaskAssignee`, surrogate id) + qo'shish/olib tashlash: `insert` / bulk `delete from ... where taskId and labelId`. Toza.
- **Dedup app-darajada:** qo'shishdan oldin `select ... first` bilan tekshiruv (composite pk sinalmadi).
- **"task'ni label+assignee bilan yuklash":** join yo'qligi sabab — link rowlarni o'qib, har biri uchun alohida `select` (**N+1**), `for` ichida `push`. Object literal'ga array'larni joylash toza chiqdi.
- **passwordHash himoyasi:** `select User { id, email, name }` proyeksiyasi — assignee'da parol sizmadi. ✅

### Noqulay (yangi emas, tasdiq)
1. **🟡 m2m o'qish = N+1:** har label/assignee alohida query. Real join / `with` nav m2m uchun yo'q → Phase 11 yana tasdiqlandi *(pain #1)*.
2. **🟡 Composite pk sinalmadi:** join uniqueness DB o'rniga app'da — `pk on (a,b)` template-style'da sinalmagani uchun (risk).

## Phase 5 — Comment + Activity feed

**Holat:** ✅ Live ishladi. `GET/POST /tasks/:tid/comments`, `GET /projects/:pid/activity`. Activity 3 ta controller'dan yoziladi (task.created, task.moved, comment.added). Test: comment author bilan, feed payload bilan, non-member=403.

### Ishladi
- **Comment CRUD + author join** (N+1) — toza.
- **Activity feed cross-controller:** `ActivityService.record(...)` Task va Comment controllerlaridan chaqirildi (flat namespace — hamma joydan ko'rinadi). `orderby createdAt desc limit 50` ishladi.
- **payload round-trip:** `json_stringify` (yozishda) + `json_parse` (o'qishda) → feed'da nested object qaytdi. ✅
- **`type` ustun nomi** (SQL reserved-ish) → quoted `"type"`, muammosiz.

### Bug / noqulay
1. **🔴 `json` (jsonb) ustun tipi obyekt qiymat bilan ishlamaydi:** `json_value_to_sql_param` nested obyektni `other.to_string()` → text qilib bind qiladi, Postgres jsonb'ga text'ni rad etadi. `payload`ni `varchar` + qo'lda `json_stringify`/`json_parse` qilishga majbur. jsonb path schema-aware bind talab qiladi.

## Phase 6 — Stats / agregatsiya (GROUP BY sinovi)

**Holat:** ✅ Live ishladi. `GET /projects/:pid/stats` → `{ byStatus, byColumn, byAssignee }`. Test: status/column/assignee bo'yicha to'g'ri sanoq (nomlar bilan), non-member=403.

### Asosiy topilma (pain #4 — javob: HA, raw_sql kerak)
1. **🔴 Native agregatsiya 0.4.8'da YO'Q.** `select { status: Task.status, total: count(*) } ... group by` parser'da **rad etiladi** ("expected entity name or '*' after 'select'"). `count`/`sum`/`group by`/arbitrary-shape projection — hammasi Phase 11 (Query Layer) deb e'lon qilingan. Docs misol ko'rsatadi, lekin implementatsiya yo'q (docs-ahead-of-impl).
2. Natijada **uchala stat ham `raw_sql`** orqali: `SELECT coalesce(json_agg(s),'[]')::text FROM (...) s` → `json_parse`. Sabab: raw_sql SELECT'da faqat birinchi ustun/qator text qaytaradi, shuning uchun ko'p-qatorli natijani `json_agg` bilan bitta skalyarga o'rash kerak.
3. Nomlar (column/user) SQL ichida `JOIN` bilan olindi; reserved jadvallar `"column"` / `"user"` quoted.

### Ishladi
- `raw_sql` escape hatch toza ishladi; `json_stringify([projectId])` param binding OK; `json_agg` round-trip → strukturali massiv.

## Phase 7 — Sayqal (errorHandler, pagination, scoping, validatsiya)

**Holat:** ✅ Live ishladi. Global `errorHandler`, pagination (tasks/comments/projects), izchil scoping+validatsiya.

### Ishladi
- **Global `errorHandler (e)`** — bitta deklaratsiya, uncaught throw'ni `internalError({error, code})` ga aylantiradi (safety-net). Validatsiya/notFound/forbidden allaqachon to'g'ridan-to'g'ri qaytariladi.
- **Scoping** — har bir route'da `WorkspaceService.isMember(...)` (task→project→workspace zanjiri orqali). Foydalanuvchi faqat o'z workspace ma'lumotini ko'radi.
- **Pagination** — tasks (filter bilan), comments, projects: `{ items, limit, offset, total }`.

### Bug / noqulay
1. **🟡 DB-side `limit @x offset @y` dinamik qiymat bilan ishonchsiz:** testda `offset` qo'llanmadi (offset=1 ham birinchi qatorni qaytardi). → in-code slice (fetch+slice) ga o'tdim, tasks bilan izchil.
2. **🟡 `total` uchun `count(*)` yo'q** (Phase 11) → to'liq fetch + `length()`. Katta jadvalda samarasiz; raw_sql count kerak bo'lardi.
3. **🟢 `int("abc")` throw qilmaydi** — toza 404 berdi (getById(null)), errorHandler'ga bormadi; normal xato yo'llar allaqachon toza envelope qaytaradi.

> **Loyiha holati: 7 fazaning hammasi yozildi va Postgres'da live test'dan o'tdi.** ~36 `.jwc` fayl, feature-based, 6 migration. raw_sql faqat agregatsiya (stats) uchun ishlatildi.

---

## 🏆 Barcha pain loglar yig'indisi — JWC'ga keyin nima kerak (oltin ro'yxat)

**🔴 P0 (eng og'riqli, 1.0 oldidan):**
1. **Join + agregatsiya + arbitrary-shape projection (Phase 11 Query Layer).** N+1 hamma joyda; project-tasks uchun denorm; `count`/`group by` **umuman yo'q** → barcha statistika `raw_sql`da. Eng katta yetishmovchilik — bittada to'rt og'riq.
2. **Str↔Object nomuvofiqligi.** `select...first` → `Object`, lekin entity-return / `update <var> in` / typed-class-param `Value::Str` kutadi. Kanonik `update x in` (testapp pattern) **buzuq**. Bitta tushuncha (Value) bo'lishi shart.
3. **`status` reserved response key.** Body kaliti jimgina yo'qoladi — reserved-word himoya yoki body/meta ajratish kerak.
4. **Datetime auto-bind ustun tipini e'tiborsiz qoldiradi** — schema-aware binding kerak.
4b. **`json`/jsonb ustun obyekt bilan ishlamaydi** — obyekt text sifatida bind bo'ladi → jsonb rad etadi. (datetime bilan bir ildiz: bind value-shape'ga qaraydi, schema'ga emas.)

**🟡 P1 (DX/ergonomika):**
5. **Optional/dinamik filter + dinamik `in (<list>)`** — dinamik query builder yo'q.
6. **Typed class param partial'ni majburlaydi** — PATCH uchun `Partial<T>` yoki optional-field semantikasi kerak.
7. **`jwt_verify` "Bearer " strip qilmaydi** (auth template'da ham).
8. **Position/reorder helperi yo'q** — fractional indexing kerak (#7).
9. **Email/unique app-darajada** — TOCTOU.
10. **`limit @x offset @y` dinamik qiymat ishonchsiz** (offset qo'llanmadi) + `count(*)` yo'q → pagination in-code (fetch+slice), katta hajmda samarasiz.

**🟢 Docs/kichik:** `for x in xs` (paren'siz); nullable `nullable` keyword; `query_param` null; docs colon-style vs template-style nomuvofiqligi.

> Ishlagan kuchli tomonlar: `validate`, JWT/parol stdlib, `transaction`+savepoint, middleware+context scoping, atomic `update set`, bulk delete, auto-migration diff, nested object literal'ga `select` joylash, feature-based ko'p-fayl bitta namespace.
