# Phase 9: Salary Slip (Anhörig Model) — Context

**Gathered:** 2026-04-19
**Status:** Ready for planning
**Milestone:** v1.0.1 — Salary Slip + Foundation Cleanup

<domain>
## Phase Boundary

Ship the legally-required monthly **lönespecifikation** for the anhörig salary model: guardian generates per-(assistant, approved-month) from Monthly.tsx, assistants list+download their own from AssistantDashboard. Each issued slip is metadata-audited in `payment_slips`. Salary-model dropdown and per-assistant `hourly_rate_override` ship in Settings — Fremia/Custom remain disabled scaffolding (live logic = v1.4 / v1.5).

**Requirements in scope:** SLIP-01, SLIP-02, SLIP-03, SLIP-04, SLIP-05, SLIP-06, SLIP-07.

**Out of scope:**
- Fremia / Custom salary calculation logic (v1.4 / v1.5)
- Per-assistant skattetabell display on slip (v1.4 — added to ROADMAP §v1.4 + §v1.5 in this discuss session)
- Banking-day-shift logic on pay date (revisit with Fremia)
- Per-month pay-date override (revisit with Fremia)
- Storing immutable PDF blobs / 7-year retention enforcement (slips are rebuilt from snapshot, not persisted as files)
- Roles / multi-admin model (deferred from Phase 8, target v1.2+)
- Real data entry — Phase 10 covers DATA-01/02/03

</domain>

<decisions>
## Implementation Decisions

### D-01 — Visual layout: plain text, no branding
- Slip layout matches the ROADMAP.md §198–228 mock literally: monospace-ish, black-on-white, A4, no logo, no app branding header.
- Two-letter section headings in the mock (`ARBETSTID`, `LÖN`, `AVDRAG`) render as bold ALL-CAPS dividers.
- Footer asterisk note (`* Ingen ersättning vid sjukdom...`) ships verbatim per mock.

### D-02 — Header fields shown
- **Document number** (top right): `LS-YYYY-MM-NNN` per D-04.
- **Arbetsgivare**: patient name + pno + **full address** (built via `resolveEmployerRepresentation()` from Phase 8 — already returns `arbetsgivare.address`).
- **Företrädd av** (conditional): guardian name + pno when `EmployerRepresentation.företrädare !== null` (minor patient OR adult-with-override flag). Line absent otherwise. Already wired by Phase 8 D-11.
- **Anställd**: assistant name + pno.
- **Period**: "1 mars – 31 mars 2026" Swedish format.
- **Utbetalningsdag**: per D-09 (computed from default day-of-month + month-after-report-month).
- **Utbetalningssätt**: per D-10 (per-assistant, frozen at issue time).
- **Avtalsmodell**: "Anhörigassistans (fast timlön, ej sjuk/sem)" — hardcoded for v1.0.1 since only anhörig is wired.
- **Assistant bank**: clearing + account when set on `assistants.bankClearing` / `bankAccount` (or `iban`); line **omitted entirely** when all three are empty (no empty-string artifact).
- **Skattetabell**: NOT shown in v1.0.1 (deferred to v1.4 — see ROADMAP §v1.4 line 403 + §v1.5 line 421, added 2026-04-19).

### D-03 — PDF generation library
- Use **pdfkit** for layout (vector text + simple table layout). pdf-lib is for filling existing AcroForm PDFs (FK 3057 / SKV 4805); a from-scratch slip is a poor fit for pdf-lib's API.
- Add `pdfkit` to `server/package.json` dependencies. New library, but small and well-maintained.
- Output: single A4 page, ~200 KB max. Inline render to `Buffer`, stream as `application/pdf`.
- Fallback acceptable if planner finds pdfkit a poor fit: jsPDF (Node-friendly fork) or even hand-rolled with pdf-lib's drawText. **Claude's discretion** on final choice during planning, but pdfkit is the recommended default.

### D-04 — Document number scheme
- Format: `LS-YYYY-MM-NNN` where `YYYY-MM` is the **report month** (not issue date) and `NNN` is a **per-assistant per-month** sequence padded to 3 digits.
- For v1.0.1's overwrite semantics (D-05), `NNN` is effectively always `001` per (assistant, month) — but the schema allows higher values so future "supersede on edit" semantics (deferred) can use `002`+ without migration.
- Allocation: on first slip issue for an (assistant, month), insert `payment_slips` row with `documentNumber = LS-{month}-001`. On re-download (D-05), reuse the existing row's number.
- Uniqueness: enforce DB-level unique index on `(assistantId, reportMonth, sequence)` to prevent races.

### D-05 — Replay / payroll-edit semantics
- **Re-download**: identical (assistant, report-month) reuses the existing `payment_slips` row — same document number, same `issuedAt`, same `payDate`, same `payMethod`. Only the PDF binary is rebuilt.
- **Payroll edit + re-approval**: the existing `payment_slips` row stays in place (number unchanged). Next download regenerates the PDF reflecting the new payroll figures (new gross, new tax, new netto). No "superseded" flag, no v2/v3 versions in v1.0.1.
- **Audit trade-off accepted**: bokföringslagen-strict environments would freeze the as-issued PDF. v1.0.1 explicitly chooses the simpler model since (a) the household has 2 assistants on a predictable cadence, (b) Phase 10 DATA-01 walkthrough catches placeholder/wrong values before the first real filing, (c) `payroll_records` itself already snapshots the rates used (Phase 7 D-02), so historical values aren't lost.
- **Deferred**: supersede-with-new-number-and-archive-old. Captured in `<deferred>` for a later compliance-hardening pass.

### D-06 — PDF persistence: rebuild on every download
- `payment_slips` stores **metadata only**: `id`, `payrollRecordId`, `assistantId`, `reportMonth`, `documentNumber`, `issuedAt`, `payMethod` (frozen), `payDate` (frozen). No `pdfBlob`, no file path.
- Each `GET`/`POST` to the slip endpoint regenerates the PDF from `payroll_records` + `assistants` + `profile` + `absences` snapshots. Output is deterministic given the same inputs.
- Storage cost: ~120 bytes per slip metadata row vs. ~200 KB per PDF. For a 2-assistant household over 7 years (= 168 slip rows) the savings are negligible but the model is significantly simpler.
- Rebuild always reads frozen `payroll_records.hourlyRateUsed` + `salaryModelUsed` (Phase 7 SLIP-07 already enforces this), guaranteeing slip figures match the approved payroll exactly.

### D-07 — Schema additions
Two columns on `assistants`, one column on `profile`, one new table:

**`assistants` additions (drizzle-kit push, per Phase 7 D-05):**
- `salary_model` enum (`"anhörig" | "fremia" | "custom"`, default `"anhörig"`) — reuse the existing `salaryModelSnapshotEnum` from Phase 7 schema:23 OR introduce a parallel `salaryModelEnum` if naming clarity demands. **Claude's discretion** on enum naming during planning.
- `hourly_rate_override` real (nullable, no default) — per-assistant rate. NULL means "no override set". Per D-12, generation errors when this is NULL.
- `payment_method` reuses the existing `paymentMethodEnum` (schema:17 = `"bankgiro" | "swish" | "kontant"`), default `"bankgiro"`. Default at column level, not enforced.

**`profile` additions:**
- `default_pay_day` integer (1–28, default `25`) — day of month payments are made; pay date = `{month-after-report}-{default_pay_day}`. Range capped at 28 to avoid Feb edge cases (no need for end-of-month logic in v1.0.1).

**New table `payment_slips`:**
```ts
payment_slips {
  id:              text primary key,        // ulid
  payrollRecordId: text not null references payroll_records.id on delete cascade,
  assistantId:     text not null references assistants.id on delete cascade,  // denormalised for query convenience, mirrors payments table pattern (schema:229)
  reportMonth:     text not null,           // YYYY-MM, denormalised from payroll_records for unique-index
  documentNumber:  text not null,           // LS-YYYY-MM-NNN
  sequence:        integer not null default 1,  // NNN portion, supports future supersede semantics
  issuedAt:        timestamp not null default now,
  payDate:         text not null,           // YYYY-MM-DD frozen at issue time
  payMethod:       paymentMethodEnum not null,  // frozen at issue time
  createdAt:       timestamp default now,
}
// unique (assistantId, reportMonth, sequence)
// index (assistantId, reportMonth) for assistant "my slips" listing
```

### D-08 — API endpoints (locked by ROADMAP §187–189)
- `POST /api/pdf/lonespec` — guardian only (`requireGuardian`). Body: `{ assistantId, year, month }`. Returns 409 when `payroll_records.status !== "approved"` for that (assistant, month). Returns 400 with Swedish error when `assistants.hourly_rate_override` is NULL (per D-12). Returns 200 with `application/pdf` body otherwise.
- `GET /api/pdf/lonespec/me?month=YYYY-MM` — assistant only (`requireAssistantAccess`). Resolves the JWT-bound assistant, refuses cross-assistant access. Same 409 / 400 rules.
- Both endpoints idempotently issue or reuse the `payment_slips` row per D-05.

### D-09 — Pay date: derived from profile.default_pay_day
- Computed at issue time as `{month-after-report-month}-{profile.default_pay_day}` formatted YYYY-MM-DD.
- Example: report month `2026-03`, default day `25` → payDate `2026-04-25`.
- **Frozen** at issue time on `payment_slips.payDate` — re-download keeps the same date even if `default_pay_day` is later changed in Settings.
- **No banking-day shift** in v1.0.1 — slip shows the literal date (e.g. "Utbetalningsdag: 25 april 2026" even if April 25 is a Saturday). Captured in `<deferred>` for v1.4.
- **No per-month override** in v1.0.1 — guardian must change Settings to issue a slip with a different day. Acceptable trade-off given household size; revisit with Fremia. Captured in `<deferred>`.

### D-10 — Pay method: per-assistant, frozen at issue time
- Settings → Assistants edit dialog (Anställning & ekonomi section) gets a new field: **Utbetalningssätt** dropdown using existing `paymentMethodEnum` (`bankgiro` / `swish` / `kontant`, Swedish labels in UI).
- Default at first issue: assistant's current `payment_method` value (defaults to `bankgiro`).
- **Frozen** at issue time on `payment_slips.payMethod` — re-download keeps the original method even if assistant's current setting changes later.

### D-11 — Historical slip eligibility
- Yes, guardian can generate slips for payroll records approved before Phase 9 ships (e.g. Jan/Feb/March 2026).
- Phase 7 SLIP-07 already defaulted `payroll_records.salaryModelUsed = "anhörig"` for all rows, so historical rows have a valid model.
- The hourly-rate-NULL gate (D-12) still applies — if the assistant has no override set, generation errors. This is intentional: it forces guardian to make a conscious data-quality decision before issuing a historically-dated legal document.
- Useful for the March 2026 retroactive filing thread (ROADMAP HANDOFF §"Outstanding threads").

### D-12 — Rate fallback: error if hourly_rate_override is NULL
- Generation refuses (HTTP 400) with Swedish error message when `assistants.hourly_rate_override IS NULL`.
- Suggested message text: `"Lönespecifikation kan inte genereras: timlön (hourly_rate_override) saknas för {assistantName}. Sätt timlönen i Inställningar → Assistenter."` — **Claude's discretion** on exact wording during planning.
- Rationale: a salary slip is a legal payroll document. Falling back silently to env default (`FK_HOURLY_RATE`) or to `payroll_records.hourlyRateUsed` (which may itself be 0 for pre-v1.0.1 records) risks emitting an authoritative-looking PDF with a guessed number.
- For Rose + Mikael (the existing 2 assistants), Phase 10 DATA-02 will fill `hourly_rate_override = 254.10` per ROADMAP HANDOFF.

### D-13 — Frontend surfaces
- **Monthly.tsx** — per-approved-assistant row gets a new `Ladda ner lönespecifikation` button alongside the existing FK 4805 download. Button disabled (with tooltip) when payroll status is not `approved`. Wires to `POST /api/pdf/lonespec`.
- **AssistantDashboard.tsx** — new "Lönespecifikationer" section listing the JWT-bound assistant's `payment_slips` rows ordered newest-first. Each row shows month + document number + issuedAt + download button. Uses `GET /api/pdf/lonespec/me`. Empty state copy: "Inga lönespecifikationer ännu — kommer när din lön godkänts." (Claude's discretion).
- **Settings.tsx → Assistants edit dialog (Anställning & ekonomi section)** gains: `salary_model` dropdown (only `Anhörigassistans` enabled, `Fremia` + `Custom` shown disabled with `(Kommer i v1.4 / v1.5)` per ROADMAP), `hourly_rate_override` numeric input (placeholder `254,10`), `payment_method` dropdown.
- **Settings.tsx → Profile edit (FK-beslut section, or new "Lön" subsection — Claude's discretion)** gains: `default_pay_day` integer input (range 1-28, default 25, label "Utbetalningsdag (varje månad)").

### D-14 — Test coverage
- **Unit tests for slip builder** (`server/src/lib/payrollSlipUtils.test.ts`):
  - Anhörig slip with all fields populated → matches a golden field-map fixture
  - Slip with no absences → `0 dagar` rows render
  - Slip with VAB used → `år till dato` line shows correct cumulative
  - Bank line omitted when all bank fields empty
  - Företrädd-av line present for minor patient, absent for adult-without-override (delegated to Phase 8 helper — verify integration)
- **Document number generation tests:** sequence allocation, uniqueness, re-download reuse
- **Endpoint integration tests:** 409 on non-approved payroll, 400 on null hourly_rate_override, 200 happy path, 403 for assistant accessing another's slip via `/me`
- **Skip:** golden PDF fixture comparison (deferred per Phase 8 D-14 precedent — Phase 10 DATA-03 will visually verify on real data)

### Claude's Discretion
- Final TypeScript signature of `buildAnhorigSlip()` — input shape (positional vs object) and exact return type.
- File location of slip builder — `server/src/lib/payrollSlipUtils.ts` per ROADMAP §181 is the recommended path; Claude can override if circular-import or naming concerns arise during planning.
- pdfkit-vs-alternative library choice (D-03) if pdfkit's API turns out to be poorly suited to the layout.
- Exact Swedish error message wording (D-12).
- Exact pdf font/size/spacing values within the "plain, no branding" envelope of D-01.
- AssistantDashboard "Lönespecifikationer" empty-state copy and exact list density.
- Whether `default_pay_day` lives under Settings → Profile FK-beslut section, a new "Lön" subsection, or somewhere else in the existing collapsibles structure.
- Plan decomposition — whether to ship schema + helper + endpoints + UI in one plan or split.

### Folded Todos
None — `gsd-tools todo match-phase 9` returned 0 matches against the 7 pending todos. Phase 9 is fully self-contained relative to backlog.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Salary slip layout & scope (authoritative source)
- `.planning/ROADMAP.md` §Phase 9 (line 510) — Goal, dependencies, requirements list, 6 success criteria.
- `.planning/ROADMAP.md` §"v1.0.1 Design Reference — Scope — Salary Slip" (lines 172–235) — Final slip layout mock (lines 198–228), intentionally-excluded fields list (230–235), payroll formula context.

### Compliance & Swedish labor law
- `docs/compliance/swedish-fk-and-labor-rules.md` — Anhörig model rules: no sjuklön, no semesterlön, no pension. Confirms why those lines are 0 SEK on the slip.
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` §"Accepted as v1.0 Known Issues" — Documents the flat 30% preliminärskatt acceptance (relevant to slip's "Preliminärskatt 30% (schablon)" line).

### Phase 7 foundation (consumed by Phase 9)
- `.planning/phases/07-foundation-schema-cleanup/07-CONTEXT.md` — D-05 (drizzle-kit push for schema), D-17 (column type conventions), D-18 (client-side validation only), D-19 (extend whitelists, no new endpoints for Settings PUTs).
- `.planning/phases/07-foundation-schema-cleanup/07-01-SUMMARY.md` — Exact list of `assistants`/`profile` columns Phase 7 added that Phase 9 reads (`salary_model_used` snapshot, `hourly_rate_used` snapshot, split address columns, `bank_clearing`/`bank_account`/`iban`).

### Phase 8 helper (consumed by Phase 9 slip header)
- `.planning/phases/08-employer-representation-helper/08-CONTEXT.md` D-06, D-07, D-11 — Helper return shape (`arbetsgivare.address` already populated), default Företrädd-av label "Företrädd av: [name] ([pno])".
- `server/src/lib/employer-representation.ts` — Implementation. Slip calls `resolveEmployerRepresentation(profile, asOfDate)` where `asOfDate` = report period **end** date.
- `server/src/lib/employer-representation.test.ts` — Existing test patterns to mirror for slip builder tests.

### Source files to read before planning
- `server/src/db/schema.ts:90–118` — `assistants` table; Phase 9 adds `salary_model`, `hourly_rate_override`, `payment_method` here.
- `server/src/db/schema.ts:23` — `salaryModelSnapshotEnum` already exists (Phase 7); Phase 9 either reuses or defines a parallel `salaryModelEnum` for the live column.
- `server/src/db/schema.ts:17` — `paymentMethodEnum = ["bankgiro", "swish", "kontant"]` — Phase 9 reuses this for `assistants.payment_method` and `payment_slips.payMethod`.
- `server/src/db/schema.ts:200–222` — `payrollRecords` with Phase 7's `salaryModelUsed` + `hourlyRateUsed` snapshot columns.
- `server/src/db/schema.ts:30–50` (approx) — `profile` table; Phase 9 adds `default_pay_day`.
- `server/src/routes/pdf.ts` — Existing FK 3057 / FK 3059 / SKV 4805 PDF endpoints; pattern to follow for `/api/pdf/lonespec` + `/api/pdf/lonespec/me`.
- `server/src/routes/profile.ts` (line 21) and `server/src/routes/assistants.ts` (line 49) — PUT whitelists to extend per Phase 7 D-19.
- `server/src/lib/absence-utils.ts` — `filterBillableEntries` already exists; slip needs a similar absence-totals function for the ARBETSTID section (sjuk/VAB/semester/annan day counts + VAB year-to-date).
- `server/src/lib/payroll-utils.ts` — Existing payroll calculation shape, source of `bruttolön` figures the slip displays.
- `client/src/pages/Monthly.tsx` — Existing FK 4805 download button pattern; Phase 9 adds Lönespec button alongside.
- `client/src/pages/AssistantDashboard.tsx` — Where the new "Lönespecifikationer" section lives.
- `client/src/pages/Settings.tsx` — Existing 2-section collapsible structure (Phase 7 D-10) for Profile + Assistants edit dialogs.

### Future milestone refs (forward links from this discuss)
- `.planning/ROADMAP.md` §v1.4 (line 403, added 2026-04-19) — Skattetabell display on slip deferred here.
- `.planning/ROADMAP.md` §v1.5 (line 421, added 2026-04-19) — Skattetabell display alignment with v1.4.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **Phase 8 helper** (`server/src/lib/employer-representation.ts`) — Already returns the exact shape the slip header needs: `{ arbetsgivare: { name, pno, address }, företrädare: { name, pno } | null }`. Just call with `asOfDate = lastDayOfReportMonth`.
- **`paymentMethodEnum`** (schema:17) — Reuse for both new columns; no new enum needed.
- **`salaryModelSnapshotEnum`** (schema:23) — Phase 7 already defined this for snapshot purposes; Phase 9 evaluates whether to reuse for the live column or define a parallel enum (Claude's discretion).
- **`payments` table pattern** (schema:226–234) — Mirror for `payment_slips` denormalisation choices (`assistantId` denormalised from `payrollRecordId` for query convenience).
- **`pdf.ts` route structure** — Existing FK endpoints already wire requireAuth/requireGuardian, query payroll_records for approval gate, query absences for breakdown. Slip endpoint mirrors this.
- **Phase 7 split address columns + Phase 8 helper's `buildPatientAddress()`** — Already handle the address-fallback logic; slip header gets the formatted string for free.
- **`absence-utils.ts` `filterBillableEntries()`** — Already excludes sjuk/VAB/semester from billable hours; slip uses inverse to count absence days.

### Established Patterns
- **drizzle-kit push** for all schema changes (Phase 7 D-05). No migration files. Phase 9 follows.
- **Client-side validation only** for new fields (Phase 7 D-18). HTML5 input patterns; server PUT whitelists are the gate.
- **Vitest** for unit tests (`*.test.ts` colocated in `server/src/lib/`). Mirror `employer-representation.test.ts` structure.
- **No new auth middleware** — `requireGuardian` and `requireAssistantAccess` already exist in `middleware/auth.ts`.
- **Swedish labels** throughout UI (sv-SE convention from Phase 7 D-12).

### Integration Points
- **Monthly.tsx** consumes `POST /api/pdf/lonespec` from the per-assistant approved-payroll row. Same row already has the FK 4805 button.
- **AssistantDashboard.tsx** consumes `GET /api/pdf/lonespec/me` from a new "Lönespecifikationer" section. JWT-scoped to current assistant.
- **Settings.tsx** edits — extend existing Profile + Assistants edit dialogs; no new top-level surfaces. Per Phase 7 D-10 existing 2-section collapsibles.
- **`payroll_records.salaryModelUsed`** (Phase 7) — slip generation reads this to confirm "anhörig"; in v1.0.1 always true. Phase 9 logic branches on this value to keep Fremia/Custom paths cleanly separable for v1.4/v1.5.
- **No FK / SKV PDF code touched** — Phase 9 is purely additive on the PDF route surface.

### New Dependency
- **`pdfkit`** to be added to `server/package.json`. Mature library (~10 years), MIT, Node-first, designed for from-scratch document layout. Bundle impact: ~1 MB (server-side only, no client impact).

</code_context>

<specifics>
## Specific Ideas

- "It should look like the mock literally — plain text, no logo, no branding. Polish later." (paraphrased from this session)
- Address on header: yes; bank details on header: yes (when set). Skattetabell: no (deferred to v1.4 — proof in ROADMAP).
- Pay date / pay method: configured once in Settings, frozen onto each `payment_slips` row at issue time. Revisit per-month overrides when Fremia ships.
- Numbering simplicity preferred over audit completeness — re-approving payroll overwrites the same slip number rather than issuing a "version 2". Acceptable trade for the household scale.
- Rate fallback explicitly errors rather than silently using a default — the slip is a legal document, guessed numbers are worse than a clear missing-data error.

</specifics>

<deferred>
## Deferred Ideas

### Banking-day pay-date shift
If the computed pay date (e.g. `2026-04-25`) lands on a Saturday/Sunday/red day, real Swedish payroll would shift to the preceding banking day. v1.0.1 shows the literal date. Revisit with v1.4 (Fremia) since Fremia accounts will likely demand it.

### Per-month pay-date override
Currently `default_pay_day` is one value, applied uniformly. If guardian wants to pay one specific month on the 28th instead of the 25th, they must change Settings → generate → change Settings back. Acceptable for 2-assistant household; revisit with Fremia.

### Supersede-on-edit slip versioning
v1.0.1 overwrites the same `payment_slips` row on payroll re-approval (same number, new figures). Bokföringslagen-strict environments would prefer issuing `LS-{month}-002` and archiving `001` as `superseded`. The `payment_slips.sequence` column reserves space in the schema for this without migration; logic ships in a future compliance-hardening pass (no milestone yet).

### Storing PDF blobs for 7-year retention
v1.0.1 rebuilds the PDF on every download from the snapshot. Bokföringslagen technically requires immutable file retention. The `payroll_records` snapshot guarantees figures don't drift, but the as-rendered PDF (with any future template tweaks baked in) is not preserved. If an audit ever demands the literal PDF as it was issued, add a `payment_slips.pdfBlob` column or filesystem path. No milestone scheduled.

### Skattetabell on slip
Captured on `assistants.skattetabell` in Phase 7 but not displayed until per-assistant skattetabell preliminärskatt logic ships. Added to ROADMAP.md §v1.4 (line 403) and §v1.5 (line 421) on 2026-04-19 as proof.

### Reviewed Todos (not folded)
None — todo match returned 0 results for Phase 9.

</deferred>

---

*Phase: 09-salary-slip*
*Context gathered: 2026-04-19*
