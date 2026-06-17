# JWC pain log 4 — v3 to'liq + native parity (jwc 0.6.1)

[PAIN_LOG.md](./PAIN_LOG.md) = 0.4.8. [PAIN_LOG2.md](./PAIN_LOG2.md) = 0.4.9 +
Query Layer addendum. [PAIN_LOG3.md](./PAIN_LOG3.md) = 0.5.1 Query Layer.
Bu hujjat — task-tracker'ni **o'rnatilgan `jwc 0.6.1`** (release binary) bilan
ishlatish tajribasi: plan v3 (Epic 1–5) to'liq tugagan versiya.

**Tekshiruv:** o'rnatilgan `jwc 0.6.1` bilan, toza Postgres'da (`migrate up` →
7 migration), to'liq oqim: register → login(Bearer JWT) → workspace → project →
board → column ×2 → task ×2 → label/assignee attach → comment → **move** →
stats → `/openapi.json` → **delete (cascade)**. Hammasi to'g'ri natija qaytardi.
Faqat rost.

---

## PAIN_LOG3'da "qolgan" deyilganlar — endi yopildi

- **🔴→✅ Cross-table aggregation `raw_sql` o'ldi.** `byColumn`/`byAssignee`
  endi **explicit JOIN** ustidan grouped aggregation (Epic 1):
  `select Task { columnId, columnName: Column.name, total: count(*) } from
  AppDb.Task join Column on Column.id == Task.columnId group by …`. Natija
  (`/projects/1/stats`): `byColumn:[{Todo:1},{Done:1}]`,
  `byAssignee:[{Alice:1}]`, `byStatus:[{todo:2}]` — **app'da 0 raw_sql**.
- **🟡→✅ Optional filter in-code shoxlanishi o'ldi.** `TaskService.listByProject`
  `status ==? @s` / `priority ==? @p` ishlatadi — qiymat bo'sh bo'lsa shart
  DB-side tushadi, bitta statik query barcha filter kombinatsiyasiga xizmat
  qiladi. Filter-bor→in-code branch yo'q.
- **🟡→✅ Ikki-bosqichli nested `with`.** `ProjectService.detail` endi bitta
  query: `select Project with boards.columns … first` → project + boards + har
  board'ning columns'i nested JSON'da. Tartib nav-decl `orderby position asc`'dan.
- **✅ Atomik move/reorder (D3).** `TaskService.move` load-modify-save o'rniga
  atomik `update Task set position = position ± 1 where …` shift'lar +
  `set columnId = …, position = …` — read'siz, lost-update oynasiz, gap-free.
- **✅ Write-path N+1 o'ldi.** `ProjectService.deleteDeep` endi columns'ni bitta
  `delete … where Column.boardId in (@boardIds)` (= ANY) bilan o'chiradi —
  board'ga bitta delete o'rniga (dinamik in-list, 2b).
- **✅ Halol Swagger.** `/openapi.json` server runtime'da jonli generatsiya
  (200, route'lardan) — qo'lda boqiladigan statik spec emas; drift mumkin emas.
- **🟢→✅ Native query-layer parity.** Nav eager-load (barcha turlar), grouped
  aggregation, JOIN, `op?` endi native AOT codegen'da (interpreter SQL'ini
  qayta ishlatadi). Read-path `compile_error` yo'q.

> Asosiy yutuq: PAIN_LOG3'ning butun "qolgan" ro'yxati 0.6.x'da yopildi.
> task-tracker'da read-path N+1 = 0 **va** write-path stats/reorder uchun
> raw_sql = 0. "ORM'siz, N+1'siz, 0 raw_sql" to'liq rost.

---

## Bu dogfood'da topilgan + tuzatilgan bug (0.6.0 → 0.6.1)

- **🔴→✅ D3 atomik update-set camelCase ustunni buzardi.**
  `update Task set columnId = @c, position = @p, updatedAt = now() where …`
  ishga tushganda **"Failed to prepare SQL statement"** berdi: D3 SET ustun
  nomini lowercase qilardi (`columnId` → `"columnid"`), lekin DB ustuni
  camelCase → mos kelmadi. (jwc-shortener'ning `hits = hits + 1` buni sezmagan —
  ustun allaqachon kichik harf edi.) `jwc 0.6.1`'da tuzatildi: SET ustun va RHS
  ustun-ref endi yozilganidek (case saqlab) tirnoqlanadi. `move` shu fix'dan
  keyin to'g'ri ishladi.

---

## Hali rough / qolgan (halol)

1. **🟡 task-tracker FULL native emas — auth builtinlar.** `jwc build --native`
   query-layer'ni qabul qiladi, lekin `jwt_verify`/`jwt_sign`/`verify_password`/
   `hash_password`/`env` native'da yo'q (crypto deps + prelude kerak). Bu
   query-layer EMAS — alohida builtin-coverage scope.
2. **🟢 Dinamik in-list `= ANY` native'da yo'q.** Interpreter ishlatadi
   (deleteDeep) — native'da interpreter-only (runtime array-param coverage
   Linux/CI'da). app interpreter'da ishlaganda muammo emas.
3. **🟢 PATCH hamon load-modify-save.** `update/ColumnService.update` load → set
   o'zgargan maydonlar → `update var in` — partial-PATCH'ning kanonik naqshi
   (workaround emas). D3 blind single-field update uchun, PATCH uchun emas.
4. **🟢 `myWorkspaces` membership→map.** Bitta query (`with workspace`) + in-memory
   pluck loop. JOIN bilan to'g'ridan-to'g'ri workspace olsa bo'lardi, lekin
   hozirgisi N+1-siz va yetarli.
5. **🟢 Native binar Windows'da runtime-test bo'lmaydi.** AOT Linux x86_64(+musl)
   only — bu mashinada emit-source + SQL-probe darajasi; haqiqiy compile/run CI.

---

> **Xulosa (0.6.1):** plan v3 (Epic 1–5) task-tracker'da to'liq dogfood qilindi:
> 0 raw_sql, read-path 0 N+1, atomik reorder, nested eager-load, jonli OpenAPI,
> native query-layer parity. Dogfood jarayonida bitta real bug (D3 camelCase)
> topildi va 0.6.1'da tuzatildi — dogfooding'ning aynan maqsadi. Til
> "web backend yoz — CRUD'ni qo'lda yozmasdan, ORM bilan kurashmasdan,
> native-tez" va'dasiga eng yaqin holatda.
