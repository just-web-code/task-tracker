# JWC pain log 3 — Query Layer dogfooding (jwc 0.5.1)

[PAIN_LOG.md](./PAIN_LOG.md) = 0.4.8 build. [PAIN_LOG2.md](./PAIN_LOG2.md) = 0.4.9
fixes + Query Layer addendum. Bu hujjat — task-tracker'ni **jwc 0.5.1**
(o'rnatilgan release binary, `git commit f524820`) Query Layer imkoniyatlari
bilan ishlatish tajribasi.

**Tekshiruv:** o'rnatilgan `jwc 0.5.1` bilan, toza Postgres'da (`migrate up` →
7 migration), to'liq oqim: register → login(Bearer) → workspace → project →
board → column → task → label/assignee attach → comment, keyin barcha
Query-Layer endpointlari curl bilan. Hammasi to'g'ri natija qaytardi. Faqat rost.

---

## Ishladi — workaround'siz, toza (yangi Query Layer)

- **`with` eager-load barcha N+1ni o'ldirdi.** Bitta query'da nested JSON:
  - belongs-to: `Comment.author`, `Activity.actor`, `WorkspaceMember.workspace`
    (`author: User { id, name } via authorId`) — bare-via = belongs-to, tabiiy.
  - has-many: `Board.columns` (`select Board with columns`).
  - m2m: `Task.labels` / `Task.assignees` (`via TaskLabel(taskId, labelId)`) —
    join-jadval orqali, qisqa.
  Natija (`GET /tasks/1`): task + `labels:[…]` + `assignees:[…]` — **0 N+1**.
- **Nav projection parolni yashirdi.** `assignees: List<User> { id, email, name }`
  → javobda `passwordHash` yo'q, qo'lda projeksiyasiz.
- **Grouped aggregation `byStatus` raw_sql'ini o'ldirdi.**
  `select Task { status, total: count(*) } group by status` → `[{status,total}]`
  typed satrlar.
- **`migrate up` toza** (7 migration, jumladan `unique`/jsonb phase8). `unique`ni
  endi `schema_diff` mavjud ustunga ALTER bilan qo'shadi (D1).
- **jsonb payload** (`Activity.payload json`) obyekt round-trip — feed'da
  `payload:{…}` obyekt.

> Asosiy yutuq: "ORM'siz, N+1'siz" va'dasi keng holatlar uchun **rost** bo'ldi —
> har bir relation bitta nav deklaratsiyasi + `with` bilan keladi.

---

## Hali rough / qolgan (halol)

1. **🔴 Cross-table aggregation hamon `raw_sql`.** `byColumn`/`byAssignee` JOIN
   ustidan sanaydi (task→column nomi; task_assignee→task→user). Bir-entity'li
   grouped aggregation (B) buni qoplamaydi → **explicit JOIN (A4) kerak**. Hozir
   `raw_sql` — bu cross-table agg uchun escape-hatch'ning o'rinli ishlatilishi,
   lekin "0 raw_sql" uchun A4 shart.
2. **🟡 Dinamik/optional filter yo'q.** Task ro'yxati status/priority filtri
   bo'lsa hamon filter-yo'q→DB-side / filter-bor→in-code shoxlanishi (C1
   query-builder yo'q). Dinamik-uzunlik `in (@list)` ham yo'q (C2).
3. **🟡 Ikki-bosqichli nested `with` ishlatilmadi.** project→boards→columns bitta
   query o'rniga `select Board with columns` (bir bosqich) — yetarli, lekin
   nested `with` sinalmagan.
4. **🟢 Native AOT bu formalarni rad etadi.** Yangi nav/agg query'lar
   interpreter-only; `jwc build --native` aniq `compile_error` beradi (follow-up).
5. **🟢 Nav siklasi.** `Author.books` ↔ `Book.author` kabi ikki tomonlama nav
   deklaratsiya mumkin (faqat `with` ishlatilganda materializatsiya bo'ladi,
   rekursiya yo'q) — muammo emas, lekin e'tiborli bo'lish kerak.

---

> **Xulosa (0.5.1):** Query Layer yadrosi (eager-load + grouped aggregation +
> nav projection/ordering) task-tracker'da **read-path N+1 = 0** qildi va stats
> raw_sql'ining bir qismini (byStatus) o'ldirdi. Qolgan `raw_sql` — cross-table
> agg (A4 JOIN) va dinamik filter (C1) — keyingi epiclar. Til "web backend yoz,
> CRUD'ni qo'lda yozmasdan, ORM bilan kurashmasdan" va'dasiga sezilarli
> yaqinlashdi.
