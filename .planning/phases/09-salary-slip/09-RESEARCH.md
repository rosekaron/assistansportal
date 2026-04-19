# Phase 9: Salary Slip (Anhörig Model) — Research

**Researched:** 2026-04-19
**Domain:** PDF generation (Node/Express), payroll slip layout, assistant self-service endpoint, audit-table persistence, Settings scaffolding
**Confidence:** HIGH (stack + patterns ground-truthed against this repo; library choice verified against npm registry)

## Summary

Phase 9 ships the legally-required monthly lönespecifikation PDF for anhörig-model assistants. CONTEXT.md has already locked 14 decisions (D-01..D-14) and the UI design contract is frozen in `09-UI-SPEC.md` — this research does not re-open those decisions. Instead it grounds the plan in what is already in the repository: the server's existing PDF route pattern (`server/src/routes/pdf.ts`), the Phase 7 schema additions (`salaryModelSnapshotEnum`, `paymentMethodEnum`, snapshot columns), the Phase 8 helper (`resolveEmployerRepresentation`), pure-function lib conventions (`absence-utils.ts`, `payroll-utils.ts`, `employer-representation.ts` + colocated Vitest suites), and the existing 4805 download button pattern in `Monthly.tsx`. The new payment slip is purely additive — no existing PDF code is touched.

Primary unknowns requiring research (vs. relying on CONTEXT decisions): (a) `pdfkit` API shape for a from-scratch text layout; (b) atomic sequence-allocation strategy for document numbers under race conditions; (c) how to stream PDF buffers through Express without intermediate disk I/O; (d) Swedish number/date formatting approach matching the mock; (e) the "download via anchor with responseType blob" client pattern already used by 4805.

**Primary recommendation:** Introduce one new server library (`pdfkit`), one new pure module (`server/src/lib/payrollSlipUtils.ts` returning a `SlipFields` key-value map), one new table (`payment_slips`), two new routes on the existing `/api/pdf` router, and three additive UI surfaces (Monthly row, AssistantDashboard section, Settings dialog fields). Reuse the existing `requireAuth`/`requireGuardian`/`requireAssistantAccess` middleware, the existing 4805 blob-download pattern, and the existing Vitest colocated-file test convention. Ship the schema via `drizzle-kit push` per Phase 7 D-05 precedent — no migration files.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01 — Visual layout: plain text, no branding.** Monospace-ish, black-on-white, A4, no logo, no app branding header. Two-letter section headings (`ARBETSTID`, `LÖN`, `AVDRAG`) render as bold ALL-CAPS dividers. Footer asterisk note ships verbatim per ROADMAP mock lines 198–228.

**D-02 — Header fields shown.** Document number top-right (`LS-YYYY-MM-NNN`); Arbetsgivare = patient name + pno + full address via `resolveEmployerRepresentation()`; Företrädd av conditional (only when `rep.företrädare !== null`); Anställd = assistant name + pno; Period in Swedish format ("1 mars – 31 mars 2026"); Utbetalningsdag per D-09; Utbetalningssätt per D-10; Avtalsmodell hardcoded "Anhörigassistans (fast timlön, ej sjuk/sem)" for v1.0.1; assistant bank line shown only when bankClearing/bankAccount/iban are set (omitted entirely when empty); Skattetabell NOT shown (deferred v1.4).

**D-03 — PDF library: pdfkit.** Add `pdfkit` to `server/package.json`. Output: single A4 page, ~200 KB max. Inline render to `Buffer`, stream as `application/pdf`. Planner may fall back to jsPDF/pdf-lib drawText if pdfkit proves unsuitable, but pdfkit is the recommended default.

**D-04 — Document number scheme: `LS-YYYY-MM-NNN`.** YYYY-MM is the report month (not issue date). NNN is per-assistant per-month sequence, 3-digit padded. Effectively always `001` in v1.0.1; schema reserves space for future supersede semantics. Unique index on `(assistantId, reportMonth, sequence)`.

**D-05 — Replay semantics: re-download reuses row; payroll edit overwrites same number.** Same (assistant, report-month) reuses existing `payment_slips` row with same document number, issuedAt, payDate, payMethod. Only PDF binary rebuilds.

**D-06 — PDF persistence: rebuild on every download.** `payment_slips` stores metadata only. Each request regenerates the PDF deterministically from the snapshot.

**D-07 — Schema additions.**
- `assistants.salary_model` — reuse `salaryModelSnapshotEnum` OR introduce parallel `salaryModelEnum` (Claude's discretion). Default `"anhörig"`.
- `assistants.hourly_rate_override` — real, nullable, no default. NULL means "no override set".
- `assistants.payment_method` — reuse `paymentMethodEnum`, default `"bankgiro"`.
- `profile.default_pay_day` — integer 1–28, default 25.
- New `payment_slips` table with columns: `id` (ulid), `payrollRecordId` (fk cascade), `assistantId` (denormalised), `reportMonth` (YYYY-MM), `documentNumber`, `sequence` (int, default 1), `issuedAt` (timestamp default now), `payDate` (YYYY-MM-DD, frozen), `payMethod` (paymentMethodEnum, frozen), `createdAt`. Unique `(assistantId, reportMonth, sequence)`; index on `(assistantId, reportMonth)`.

**D-08 — API endpoints.**
- `POST /api/pdf/lonespec` — `requireAuth` + `requireGuardian`. Body: `{ assistantId, year, month }`. Returns 409 when payroll not approved; 400 (Swedish message) when `hourly_rate_override` is NULL; 200 with `application/pdf` otherwise.
- `GET /api/pdf/lonespec/me?month=YYYY-MM` — `requireAuth` + `requireAssistantAccess`. Resolves JWT-bound assistant; 403 on cross-assistant. Same 409/400 rules.
- Both idempotently issue or reuse the `payment_slips` row.

**D-09 — Pay date.** Computed at issue as `{month-after-report}-{profile.default_pay_day}`, YYYY-MM-DD. Frozen on `payment_slips.payDate` at first issue. No banking-day shift (deferred). No per-month override (deferred).

**D-10 — Pay method.** Per-assistant on `assistants.payment_method`. Frozen on `payment_slips.payMethod` at issue. Settings → Assistants edit dialog adds `Utbetalningssätt` dropdown (Swedish labels for the existing enum values).

**D-11 — Historical slip eligibility.** Guardian CAN generate slips for payroll records approved before Phase 9. Phase 7 defaulted `payroll_records.salaryModelUsed = "anhörig"`. Rate-NULL gate still applies.

**D-12 — Rate fallback: 400 error if `hourly_rate_override` is NULL.** Swedish message (planner's discretion on exact wording). Rationale: slip is a legal document; guessed numbers are worse than clear missing-data errors.

**D-13 — Frontend surfaces.** Monthly.tsx new per-approved-assistant Lönespec download row (see 09-UI-SPEC.md §Monthly); AssistantDashboard.tsx new "Lönespecifikationer" section (see 09-UI-SPEC.md §AssistantDashboard); Settings.tsx Assistants edit gets salary_model (dropdown, only anhörig enabled), hourly_rate_override (numeric), payment_method (dropdown); Settings.tsx Profile gets default_pay_day (integer 1–28, default 25).

**D-14 — Test coverage.** Unit tests for slip builder (golden field-map fixture, no-absence/VAB/bank-empty/företrädd-av variants), document-number generation (sequence allocation + uniqueness + re-download reuse), endpoint integration (409, 400, 200 happy path, 403 cross-assistant on `/me`). Skip golden-PDF byte comparison (Phase 10 DATA-03 visual check covers).

### Claude's Discretion

- Final TypeScript signature of `buildAnhorigSlip()` — input shape (positional vs object) and exact return type.
- File location of slip builder — `server/src/lib/payrollSlipUtils.ts` recommended; override if circular-import or naming issue.
- pdfkit-vs-alternative library (D-03) if pdfkit's API proves unsuitable to layout.
- Exact Swedish error message wording (D-12).
- Exact pdf font/size/spacing values within the "plain, no branding" envelope of D-01.
- AssistantDashboard "Lönespecifikationer" empty-state copy and list density.
- Whether `default_pay_day` lives under Settings → Profile FK-beslut section, a new "Lön" subsection, or elsewhere.
- Plan decomposition — one plan vs multiple.
- Enum naming: reuse `salaryModelSnapshotEnum` or introduce parallel `salaryModelEnum`.

### Deferred Ideas (OUT OF SCOPE)

- Banking-day pay-date shift (revisit with Fremia v1.4).
- Per-month pay-date override (revisit with Fremia).
- Supersede-on-edit slip versioning — `sequence` column reserves space; logic deferred to future compliance pass.
- Storing PDF blobs for 7-year retention (bokföringslagen-strict); rebuild-from-snapshot model accepted as v1.0.1 trade-off.
- Skattetabell on slip (added to ROADMAP §v1.4 + §v1.5 as deferral proof 2026-04-19).
- Fremia / Custom salary-model live logic (v1.4 / v1.5); dropdown options ship disabled.
- Roles / multi-admin (deferred from Phase 8, target v1.2+).
- Real data entry (Phase 10 DATA-01/02/03).

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SLIP-01 | Guardian can download a salary slip PDF per approved assistant per month from Monthly (gated on payroll approval; 409 otherwise) | D-08 endpoint `POST /api/pdf/lonespec`; mirrors existing 4805 approval-gate pattern at `pdf.ts:362–374`; Monthly UI pattern at `Monthly.tsx:1096–1130`; `pdfApi.form4805` helper extends to `pdfApi.lonespec` |
| SLIP-02 | Assistant can list and download own past salary slips from AssistantDashboard (JWT-scoped to own records only, 403 on cross-assistant) | D-08 endpoint `GET /api/pdf/lonespec/me`; `requireAssistantAccess` middleware + `req.assistantId` pattern from `assistant.ts:12–22`; AssistantDashboard Card pattern at `AssistantDashboard.tsx:288/308/420` |
| SLIP-03 | Slip shows arbetstid section (worked hours + absence days + VAB year-to-date), lön breakdown (bruttolön → preliminärskatt 30% → netto), excludes all employer-side numbers | D-01/D-02 layout; pure-function `buildAnhorigSlip()` in `payrollSlipUtils.ts`; uses `absence-utils.ts` `vabBalance(absences, assistantId, year)` for VAB YTD (120-day) calculation and a new companion `absenceDaysByType()` helper; reads frozen `payroll_records.hourlyRateUsed` + `grossPay` |
| SLIP-04 | Slip header shows correct employer representation: arbetsgivare = patient, företrädd av = guardian only when patient is a minor (or override) | Calls existing `resolveEmployerRepresentation(profile, reportPeriodEnd)` from `server/src/lib/employer-representation.ts:66`; `asOfDate = new Date(${year}-${mm}-${lastDay})` — last day of report period, not today (see pitfall in existing helper's JSDoc) |
| SLIP-05 | Each issued slip is recorded in `payment_slips` with document number, issued-at, pay method, pay date | D-05/D-07 table schema; ulid via existing `newId("slip")` from `server/src/lib/id.ts`; re-download reuses row |
| SLIP-06 | Settings → Assistants exposes salary_model dropdown (Anhörigassistans enabled, Fremia/Custom disabled with "(Kommer i v1.4/v1.5)"), plus hourly_rate_override | D-07/D-13; 09-UI-SPEC.md §Settings; extends `assistants.ts:48–71` PUT whitelist with 3 fields; reuses existing `Select` + `Input` + `Dialog` primitives |
| SLIP-07 | `payroll_records` captures `salary_model_used` + `hourly_rate_used` snapshots | **Already shipped by Phase 7** — `schema.ts:212–213`. Phase 9 reads these columns; no schema change needed for SLIP-07. Confirmed by grepping `salaryModelUsed`/`hourlyRateUsed` against current schema. |

</phase_requirements>

## Project Constraints (from CLAUDE.md)

No root-level `CLAUDE.md` exists in this repository (verified via `Read` on `/Users/rosekaron/Desktop/Kalinga/assistansportal/CLAUDE.md` → file not found). No `.claude/skills/` or `.agents/skills/` directory present (verified via Glob). Research therefore inherits project conventions from the existing code and from Phase 7/8 locked decisions:

- **TypeScript strict throughout** — all new code must compile cleanly with the existing `server/tsconfig.json` + `client/tsconfig.json`.
- **drizzle-kit push for schema changes** (Phase 7 D-05). No SQL migration files checked in.
- **Vitest colocated `*.test.ts`** for pure libs (`server/src/lib/employer-representation.test.ts` convention); integration tests in `server/src/routes/__tests__/`.
- **Swedish sv-SE labels** for any new UI text (Phase 7 D-12).
- **No new auth middleware** — existing `requireAuth` + `requireGuardian` + `requireAssistantAccess` cover all cases.
- **Client-side validation only** for new fields (Phase 7 D-18) — server PUT whitelists are the gate.
- **Never use `alert()` for first-pass UX** — the existing `Monthly.tsx:631` `alert()` is grandfathered; 09-UI-SPEC prefers inline `text-destructive` toasts for new surfaces.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `pdfkit` | 0.18.0 | From-scratch A4 text layout (title, sections, rows, totals, footer note) [VERIFIED: npm view pdfkit version → 0.18.0, published 2026-03-15] | Mature (10+ years), MIT, Node-first, designed for from-scratch document layout; small install; built-in Helvetica supports Swedish å/ä/ö via WinAnsi encoding [ASSUMED — character support verification pushed to a Wave 0 smoke test in the plan, since the library's historical behavior has been WinAnsi by default but the current version's docs should confirm] |
| `@types/pdfkit` | 0.17.6 | TypeScript types for pdfkit [VERIFIED: npm view @types/pdfkit version] | DefinitelyTyped types lag the runtime slightly (0.17.x vs runtime 0.18.x) but cover the text/stroke/margin/pipe APIs Phase 9 uses |
| `drizzle-orm` | 0.30.10 (pinned in `server/package.json`) | Table definitions, insert/select/update | Already in stack |
| `drizzle-kit` | 0.21.4 | Schema push | Already in stack — Phase 7 used `db:push`; no new SQL migrations |
| `vitest` | 4.1.2 | Unit + integration tests | Already in stack |
| `zod` | 3.23.8 | Optional input validation on endpoint bodies | Already in stack (not mandatory — existing PDF routes don't use it, so Phase 9 may or may not adopt it; **Claude's discretion**) |
| `express` | 4.19.2 | Routing | Already in stack |
| `jsonwebtoken` | 9.0.2 | JWT decode (via existing middleware) | Already in stack |

### Supporting (already in stack — reused without new install)
| Library | Purpose | When to Use |
|---------|---------|-------------|
| `date-fns` (client, v3.6.0) | Swedish month name formatting for AssistantDashboard slip-list rows (`format(date, 'MMMM yyyy', { locale: sv })`) | Client-side display only. Server uses `toLocaleDateString("sv-SE", …)` for slip body (matches existing `pdf.ts:155` convention). |
| `lucide-react` (client, 0.383.0) | `Download` + `FileText` icons | Per 09-UI-SPEC.md |
| Existing `@/components/ui/*` primitives | Button, Card, Select, Input, Label, Dialog, Tooltip | Per 09-UI-SPEC.md — no new UI components |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| pdfkit | pdf-lib's `drawText` | pdf-lib is optimised for **filling existing AcroForm PDFs** (used for FK 3057 / FK 3059 / SKV 4805). From-scratch text layout with `drawText` is possible but requires manual positioning of every glyph; pdfkit's flow API (`.text(…).moveDown()`) is purpose-built for this. [CITED: pdf-lib README and pdfkit docs — both libraries linked from `server/package.json` + npm] |
| pdfkit | `@react-pdf/renderer` | React-based declarative PDF. Heavier (pulls React + Yoga); overkill for a plain single-page text layout; adds client/server bundling complexity. Rejected for this phase; a future branded template could revisit. |
| pdfkit | `puppeteer` (HTML-to-PDF) | Spawns a headless Chromium per request → ~200MB of disk + 200ms startup. Operationally heavy for a single-page slip; introduces Chromium dependency on deploy target. Rejected. |
| pdfkit | `jsPDF` (Node fork) | Browser-first API, Node support is ports. pdfkit has more mature Node streaming API for Express `res.pipe(doc)` pattern. |

**Installation:**
```bash
cd server && npm install pdfkit@^0.18.0 && npm install -D @types/pdfkit@^0.17.6
```

**Version verification:** Confirmed against npm registry on 2026-04-19:
- `pdfkit` 0.18.0 (published 2026-03-15) [VERIFIED]
- `@types/pdfkit` 0.17.6 [VERIFIED]

Plan should run `npm view pdfkit version` one more time in Wave 0 to catch any newer release between research and implementation.

## Architecture Patterns

### Recommended Project Structure (additive — no existing paths change)

```
server/
├── src/
│   ├── db/
│   │   └── schema.ts                      # ADD: payment_slips table + 3 assistants columns + 1 profile column
│   ├── lib/
│   │   ├── payrollSlipUtils.ts            # NEW: pure buildAnhorigSlip() returning SlipFields
│   │   ├── payrollSlipUtils.test.ts       # NEW: colocated Vitest suite (D-14)
│   │   ├── pdfSlipRenderer.ts             # NEW (optional split): takes SlipFields → Buffer via pdfkit
│   │   ├── absence-utils.ts               # EXTEND: add absenceDaysByType(absences, assistantId, monthStart, monthEnd) if not already trivially derivable
│   │   └── employer-representation.ts     # UNCHANGED — called by slip builder
│   ├── routes/
│   │   ├── pdf.ts                         # EXTEND: add POST /lonespec + GET /lonespec/me handlers
│   │   ├── assistants.ts                  # EXTEND: PUT whitelist gains salary_model / hourly_rate_override / payment_method
│   │   ├── profile.ts                     # EXTEND: PUT whitelist gains default_pay_day
│   │   └── __tests__/
│   │       └── pdf-lonespec.test.ts       # NEW: integration tests (409 / 400 / 200 / 403)
│   └── middleware/
│       └── auth.ts                        # UNCHANGED
client/
├── src/
│   ├── lib/
│   │   └── api.ts                         # EXTEND: pdfApi.lonespec + pdfApi.lonespecMe + new assistantApi.slips
│   ├── pages/
│   │   ├── Monthly.tsx                    # EXTEND: new Lönespec download row (mirrors 4805 pattern at :1096–1130)
│   │   ├── AssistantDashboard.tsx         # EXTEND: new "Lönespecifikationer" Card + list
│   │   └── Settings.tsx                   # EXTEND: Assistants dialog gains 3 fields; Profile gains 1 field
│   └── components/ui/                     # UNCHANGED (reuse existing primitives per 09-UI-SPEC)
```

Splitting `payrollSlipUtils.ts` (pure field-map builder) from `pdfSlipRenderer.ts` (pdfkit drawing) keeps the builder testable as a plain object-to-object function and lets integration tests assert on `SlipFields` shape without parsing PDF binary. **Claude's discretion** on whether to collapse them into one file.

### Pattern 1: Mirror the existing PDF route's shape

The existing 4805 endpoint (`server/src/routes/pdf.ts:338–448`) is the closest template:

```typescript
// Existing 4805 pattern (verified against repo) — new /lonespec follows this shape:
router.post("/lonespec", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { year, month, assistantId } = req.body as { year: string; month: string; assistantId: string };

    // 1. Validate assistantId (mirrors pdf.ts:346)
    if (!assistantId || !/^[a-zA-Z0-9_-]+$/.test(assistantId)) {
      return res.status(400).json({ error: "Invalid assistantId" });
    }

    const mm = month.padStart(2, "0");
    const yearMonth = `${year}-${mm}`;

    // 2. Load assistant (mirrors pdf.ts:359)
    const [asst] = await db.select().from(assistants).where(eq(assistants.id, assistantId));
    if (!asst) return res.status(404).json({ error: "Assistant not found" });

    // 3. D-12: rate-NULL gate
    if (asst.hourlyRateOverride == null) {
      return res.status(400).json({
        error: `Lönespecifikation kan inte genereras: timlön (hourly_rate_override) saknas för ${asst.name}. Sätt timlönen i Inställningar → Assistenter.`
      });
    }

    // 4. D-08: approval gate (mirrors pdf.ts:363–374)
    const [pr] = await db.select().from(payrollRecords).where(and(
      eq(payrollRecords.assistantId, assistantId),
      eq(payrollRecords.month, yearMonth),
      eq(payrollRecords.status, "approved"),
    ));
    if (!pr) return res.status(409).json({ error: "Lönekörningen är inte godkänd för denna månad." });

    // 5. D-05: idempotent payment_slips row (issue-or-reuse)
    const slipRow = await issueOrReuseSlip({ assistantId, reportMonth: yearMonth, payrollRecordId: pr.id, asst });

    // 6. Build slip fields (pure) + render PDF
    const fields = buildAnhorigSlip({ profile: prof, assistant: asst, payrollRecord: pr, absences, slipRow });
    const pdfBuffer = await renderAnhorigSlipPdf(fields);

    // 7. Stream (mirrors pdf.ts:440–442)
    const filename = `lonespec-${yearMonth}-${asst.name.replace(/\s+/g, "-")}.pdf`;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (e) {
    console.error("[pdf] lonespec error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

### Pattern 2: Pure-function lib + colocated test (matches `employer-representation` convention)

`server/src/lib/employer-representation.ts` is the template: named exports, JSDoc on locked-decision references (`D-01`, `D-02`, …), no DB imports, no side effects, plain-object input and output. `employer-representation.test.ts` mirrors this with a `baseProfile` fixture and named `it()` blocks per decision case. Phase 9's `payrollSlipUtils.ts` + `.test.ts` follow this convention exactly.

### Pattern 3: Idempotent sequence allocation

The naive flow (select `MAX(sequence)+1` → insert) has a race. Options, ordered by simplicity:

1. **Unique index + ON CONFLICT** (recommended): compute the next sequence via `SELECT COALESCE(MAX(sequence), 0) + 1` inside the insert; catch Postgres unique-violation (`SQLSTATE 23505`) and re-select the existing row. With the unique key `(assistantId, reportMonth, sequence)` and v1.0.1's single-admin model (D-05), races are theoretical but the catch-and-retry is cheap insurance.
2. **Advisory lock** per `(assistantId, reportMonth)` (`pg_advisory_xact_lock`): serializes issuance; overkill for single-admin.
3. **`INSERT … ON CONFLICT (assistantId, reportMonth, sequence) DO NOTHING RETURNING *` + follow-up SELECT** when nothing was returned: clean Postgres-native idempotency. [CITED: PostgreSQL 12+ UPSERT docs]

Recommendation: Option 1 for v1.0.1 simplicity; upgrade to 3 if tests reveal flakiness.

### Pattern 4: Client blob download via anchor + URL.createObjectURL

The existing `download4805` at `Monthly.tsx:621–633` is the exact template:

```typescript
// Existing pattern (verified):
async function download4805(assistantId: string, assistantName: string) {
  try {
    const res = await pdfApi.form4805(String(year), pad(month + 1), assistantId);
    const url = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `4805-${year}-${pad(month + 1)}-${assistantName.replace(/\s+/g, "-")}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  } catch { alert("…"); }
}
```

New `downloadLonespec()` mirrors this; per 09-UI-SPEC.md new surfaces prefer inline `text-destructive` toasts over `alert()`, but the `alert()` fallback is acceptable if the executor treats inline-toast as out-of-scope.

### Pattern 5: Monospace numeric alignment without a monospace font

The mock (ROADMAP lines 198–228) has the visual rhythm of a monospace document but pdfkit's Helvetica is proportional. Two options:
- Switch to pdfkit's `"Courier"` built-in for the whole slip — simplest but looks dated and not what D-01 "plain text" usually implies.
- Keep Helvetica, right-align numeric columns at fixed x-coordinates (per 09-UI-SPEC "kr amounts right-aligned at 195 mm, hour counts at 135 mm"). This is the UI-SPEC's locked choice.

Use pdfkit's `doc.text(text, x, y, { width: W, align: "right" })` with a fixed content width to produce clean right-aligned columns. [CITED: pdfkit docs — text options]

### Anti-Patterns to Avoid

- **Don't build a string from the slip and try to `.text()` it as one block.** pdfkit's flow API is row-by-row; trying to pre-format with `\t` or spaces fails because Helvetica glyph widths vary. Use explicit x/width arguments on each row.
- **Don't pass `Date.now()` as the `asOfDate` to `resolveEmployerRepresentation`.** The helper's JSDoc warns that historical months must use the report-period end date or a patient who turned 18 mid-month will be misclassified. Use `new Date(${year}-${mm}-${lastDay})`.
- **Don't persist the rendered PDF anywhere.** D-06 — metadata only. No filesystem, no DB blob, no cache.
- **Don't log slip contents in production.** Slips contain pno + bank details + net salary. Any `console.log(fields)` in the route handler leaks PII. The existing `console.error("[pdf] …error:", e)` pattern is fine — don't expand it.
- **Don't allocate document numbers from issue-date month.** D-04 locks the `YYYY-MM` segment to the **report** month so a January payroll approved in February still issues `LS-2026-01-001`, not `LS-2026-02-001`.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| VAB year-to-date 120-day running balance | Custom loop over absences table | Existing `vabBalance(absences, assistantId, year)` from `server/src/lib/absence-utils.ts:55` | Already implemented with correct clipping to year boundary; reused by Phase 2 balance view |
| Employer/representative shape | Inline conditional in slip header code | `resolveEmployerRepresentation(profile, asOfDate)` from `server/src/lib/employer-representation.ts:66` | Single source of truth (EMP-02 invariant); any divergence re-opens the bug Phase 8 just closed |
| ulid / random id generation | `Math.random()` or a new uuid library | Existing `newId("slip")` from `server/src/lib/id.ts` | Project convention; already used by payroll_records, payments, absences |
| PDF vector text layout | Hand-drawn glyph-by-glyph positioning with pdf-lib `drawText` | pdfkit's `doc.text(..., { align, width })` flow API | Purpose-built for this; avoids manual baseline math |
| Swedish number formatting | Regex-based string munging | `Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })` + space-thousands replacement | Standards-based; handles decimal comma + thousands grouping via locale [CITED: MDN Intl.NumberFormat] |
| Swedish date formatting for slip period | Manual month-name table | `Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric" })` | Already used in `pdf.ts:155`/`311` via `Date.toLocaleDateString("sv-SE")` — server-side supported by default Node ICU |
| Preliminärskatt calculation | Re-derive on the slip | Read `payroll_records.prelimTaxRateSnapshot` | Frozen at generation time per PAY-02; slip must match approved payroll exactly |
| Gross / employer contribution math | Redo in slip code | Read `payroll_records.grossPay` directly | SLIP-07 guarantees snapshot; slip is a display of payroll, not a recalculation |

**Key insight:** Phase 9 is overwhelmingly a **composition** job, not a calculation job. All the numbers already exist on the frozen `payroll_records` row (Phase 7 SLIP-07) and the absences table (Phase 2). The new code's job is to arrange them, not derive them. Every place the slip appears to "compute" something, check whether Phase 7/8 or the payroll record already has it.

## Common Pitfalls

### Pitfall 1: Passing today's date as `asOfDate` to the employer-representation helper
**What goes wrong:** Patient turned 18 in April 2026; guardian regenerates the March 2026 slip on May 1; the slip shows the patient as an adult (no Företrädd av line) even though March's legal employer-representation was still the minor case.
**Why it happens:** Copy-paste from elsewhere using `new Date()`.
**How to avoid:** Compute `const reportPeriodEnd = new Date(${year}-${mm}-${daysInMonth})` and pass it explicitly. The helper's JSDoc warns about this; slip builder signature should make `asOfDate` a required parameter, not defaulted.
**Warning signs:** Test case "minor patient turning 18 during report month" shows the wrong representative line — this is exactly the case `employer-representation.test.ts` covers; duplicate the pattern in slip tests.

### Pitfall 2: Using snapshot `hourlyRateUsed` when it is 0 (pre-Phase-7 rows)
**What goes wrong:** A payroll record approved in v1.0 (before SLIP-07 landed) has `hourlyRateUsed = 0` default. Slip multiplies `215.0 × 0 = 0 kr`. Guardian downloads a slip that looks structurally valid but shows zero pay.
**Why it happens:** Historical slip eligibility (D-11) is in scope; pre-Phase-7 records exist.
**How to avoid:** Slip builder should short-circuit and throw if `payrollRecord.hourlyRateUsed <= 0` AND `assistant.hourlyRateOverride` is set — use the override as the canonical number for historical rows, or refuse with a 400 per D-12 spirit. **Recommendation:** planner should explicitly decide this in a decision — either (a) fall back to `assistant.hourlyRateOverride` (aligns with D-12 "rate must be set" invariant), or (b) require a payroll re-approval to refresh the snapshot. Option (a) is simpler and still correct because D-12 already guarantees `hourlyRateOverride` is non-null.
**Warning signs:** Slip for a January/February 2026 approved payroll shows `0,00 kr` gross when the assistant has an override set.

### Pitfall 3: Swedish characters (å/ä/ö) rendering as "?" or missing glyphs
**What goes wrong:** pdfkit by default uses WinAnsi encoding with built-in Helvetica. Most Swedish characters are in WinAnsi so they render correctly, but character-substitution bugs in older pdfkit versions surfaced for specific glyphs.
**Why it happens:** pdfkit auto-registers fonts at `new PDFDocument()`; the default Helvetica is the built-in one.
**How to avoid:** (1) Wave 0 smoke test — render a one-line doc with `ÅÄÖåäö` and visually inspect; (2) if any character fails, load a TTF with `doc.registerFont("Body", path.join(...))` using a font that includes full Latin-1 Supplement, e.g. DejaVu Sans. pdfkit supports TTF/OTF/WOFF out of the box. [CITED: pdfkit docs — Registering fonts]
**Warning signs:** Test output PDF shows "sjukfrnvaro" instead of "sjukfrånvaro"; missing-glyph squares in "Företrädd av".

### Pitfall 4: `drizzle-kit push` data loss on rename or type change
**What goes wrong:** If a column rename is attempted via push, drizzle-kit prompts to drop+recreate, losing data.
**Why it happens:** Phase 7 D-05 locks us into `push` not generated migrations.
**How to avoid:** Phase 9's additions are **purely additive** (3 new `assistants` columns, 1 new `profile` column, 1 new table). No renames, no type changes. Push is safe. If a later iteration renames `hourly_rate_override` → `hourly_rate`, that's a migration ticket.
**Warning signs:** `drizzle-kit push` output shows `~` or `x` mutations — only `+` (add) is acceptable for this phase.

### Pitfall 5: Route order / Express path conflict
**What goes wrong:** Adding `POST /lonespec` and `GET /lonespec/me` to `pdf.ts` where existing routes live — `/me` must be registered before any `/:id`-style param route on the same path segment to avoid the `me` value being captured as a path param.
**Why it happens:** Express matches in declaration order; `assistants.ts` comment at :84 explicitly calls out "must be before /:id routes to avoid Express path conflict".
**How to avoid:** Register the static `/lonespec/me` before `/lonespec` if both are on the same router, or prefer distinct paths — current design has `POST /lonespec` and `GET /lonespec/me` which are different verbs on different exact paths, so no conflict. Keep it that way.
**Warning signs:** Hitting `GET /api/pdf/lonespec/me?month=…` returns a 404 or a different handler's response.

### Pitfall 6: Cross-assistant access via `/me` endpoint
**What goes wrong:** Assistant Rose (auth assistantId=`a_rose`) sends `GET /api/pdf/lonespec/me?month=2026-03&assistantId=a_mikael` hoping to override the JWT-derived assistant. Endpoint uses the query param instead of `req.assistantId`.
**Why it happens:** Copy-paste of the guardian handler that takes `assistantId` from the body.
**How to avoid:** The `/me` handler MUST derive `assistantId` solely from `req.assistantId` (populated by `requireAuth` from the JWT payload). Never read `assistantId` from body/query on `/me`. The guardian endpoint (`POST /lonespec`) does read body.assistantId — that's correct because `requireGuardian` is authorised to act for any assistant.
**Warning signs:** Integration test "assistant requests another assistant's slip" doesn't return 403.

### Pitfall 7: Reading `req.assistantId` when an assistant doesn't have a linked record
**What goes wrong:** The `requireAssistantAccess` middleware accepts both `"assistant"` and `"guardian"` roles. A guardian hitting `GET /lonespec/me` without having registered-self as an assistant has `req.assistantId = undefined`.
**Why it happens:** The middleware is permissive by design (see `middleware/auth.ts:37–46` JSDoc).
**How to avoid:** First line of the `/me` handler: `if (!req.assistantId) return res.status(400).json({ error: "No assistant linked to this account" });` — mirrors `assistant.ts:14`.
**Warning signs:** Guardian hitting `/me` as a debug check gets a 500 from a downstream `db.select` with `undefined` id.

### Pitfall 8: Locking the pay date on first issue and then showing a stale value after Settings change
**What goes wrong:** Guardian changes `profile.default_pay_day` from 25 to 28 after issuing the March slip; the March slip's `payment_slips.payDate` still shows April 25, which is correct but visually surprising.
**Why it happens:** D-09 locks this intentionally.
**How to avoid:** 09-UI-SPEC §Settings Profile (interaction 3) says "Changing the value does NOT retroactively alter already-issued slips. No warning banner needed." Planner follows that — no retroactive update path.
**Warning signs:** User files a "the pay date on my March slip is wrong" bug after changing Settings — this is expected behavior and needs documentation in the plan rather than a code change.

## Runtime State Inventory

**Nothing found in any category** — Phase 9 is a greenfield slip feature. No rename, refactor, or migration is involved.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | None — all new storage is additive (`payment_slips` table + 3 `assistants` columns + 1 `profile` column). No existing data is reshaped. | None |
| Live service config | None — no external service configuration changes. FK 3057 / FK 3059 / SKV 4805 routes are untouched. | None |
| OS-registered state | None — no cron jobs, launchd plists, or scheduled tasks involved. pdfkit is a pure library, not a process. | None |
| Secrets/env vars | None — no new env vars. `FK_HOURLY_RATE` is intentionally NOT used (D-12 explicitly forbids silent fallback). JWT_SECRET and DB creds are already in place. | None |
| Build artifacts | None specific to Phase 9. Routine `npm install` after adding pdfkit will populate `server/node_modules/pdfkit`. No egg-info / binary artifacts. | None |

**Verified by** greps against `server/src/**` for `payment_slips` (0 matches — new table) and inspection of `server/src/lib/*` (no Phase 9 modules yet) and `client/src/lib/api.ts:106–114` (pdfApi has no lonespec yet). This is additive work.

## Code Examples

Verified patterns grounded in existing repo code.

### Example 1: Pure slip builder signature (matches `employer-representation` convention)

```typescript
// server/src/lib/payrollSlipUtils.ts (NEW — pattern mirrors employer-representation.ts)
// Pure function: no DB access, no pdfkit import, no side effects.

import { resolveEmployerRepresentation } from "./employer-representation";
import { vabBalance } from "./absence-utils";
import type { Assistant, Profile, PayrollRecord } from "../db/schema";
import type { AbsenceRow } from "./absence-utils";

export type SlipFields = {
  documentNumber: string;           // "LS-2026-03-001"
  reportPeriodLabel: string;        // "1 mars – 31 mars 2026"
  payDateLabel: string;             // "25 april 2026"
  payMethodLabel: string;           // "Bankgiro" | "Swish" | "Kontant"
  avtalsmodellLabel: string;        // "Anhörigassistans (fast timlön, ej sjuk/sem)"
  employer: { name: string; pno: string; address: string };
  representative: { name: string; pno: string } | null;
  employee: { name: string; pno: string };
  bankLine: string | null;          // null → omit row entirely (D-02)
  hours: { worked: number; sjuk: number; vab: number; semester: number; other: number; vabYtdUsed: number };
  lön: { gross: number; sjukLön: number; vabLön: number; semesterLön: number; bruttoLön: number };
  avdrag: { prelimSkatt: number; prelimSkattRate: number; nettoTillBank: number };
};

export function buildAnhorigSlip(input: {
  profile: Profile;
  assistant: Assistant;
  payrollRecord: PayrollRecord;
  absences: AbsenceRow[];
  documentNumber: string;           // D-05: caller provides; pure fn does not allocate
  payDate: string;                  // D-09: caller provides frozen value as YYYY-MM-DD
  payMethod: "bankgiro" | "swish" | "kontant"; // D-10: caller provides frozen value
}): SlipFields {
  const [year, month] = input.payrollRecord.month.split("-").map(n => parseInt(n, 10));
  const daysInMonth = new Date(year, month, 0).getDate();
  const reportPeriodEnd = new Date(year, month - 1, daysInMonth);
  const rep = resolveEmployerRepresentation(input.profile, reportPeriodEnd);
  const vabRemaining = vabBalance(input.absences, input.assistant.id, year);
  const vabYtdUsed = 120 - vabRemaining;
  // ... (assemble remaining fields from payrollRecord snapshot + absences)
  return { /* ... */ } as SlipFields;
}
```

### Example 2: pdfkit rendering skeleton

```typescript
// server/src/lib/pdfSlipRenderer.ts (NEW)
// Reference only — exact font/size/spacing per 09-UI-SPEC.md PDF Layout Contract.

import PDFDocument from "pdfkit";
import type { SlipFields } from "./payrollSlipUtils";

export async function renderAnhorigSlipPdf(f: SlipFields): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 56, bottom: 56, left: 56, right: 56 }, // 20 mm @ 72pt/inch ≈ 56 pt
      info: { Title: `Lönespecifikation ${f.documentNumber}`, Author: "Kalinga Assistansportal" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", c => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    // Title + doc number (Helvetica-Bold 14 / Helvetica 10 per UI-SPEC)
    doc.font("Helvetica-Bold").fontSize(14).text("LÖNESPECIFIKATION", { continued: false });
    doc.font("Helvetica").fontSize(10).text(`Nr: ${f.documentNumber}`, { align: "right" });

    // ... header block, ARBETSTID section, LÖN section, AVDRAG section, footer per UI-SPEC
    // Numeric rows use doc.text(label, x1, y, { width, align: "left" })
    //                  .text(value, x2, y, { width, align: "right" })

    doc.end();
  });
}
```

Note pdfkit is synchronous-write but the stream completes asynchronously — wrap in a Promise that collects chunks. [CITED: pdfkit docs — Getting Started example uses `doc.pipe(fs.createWriteStream(…))`; the in-memory buffer pattern here is a common Express-streaming adaptation]

### Example 3: Swedish number formatting

```typescript
// Pure helper — can live at the top of pdfSlipRenderer.ts or in payrollSlipUtils.ts.
const kr = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

export function formatKr(n: number): string {
  // Intl produces non-breaking space thousand separators; replace with regular space to match mock.
  return kr.format(n).replace(/\u00A0/g, " ") + " kr";
}

// "54 631,50 kr" for 54631.5
// For negatives use U+2212 minus per UI-SPEC: `−${kr.format(Math.abs(n))} kr`
```

### Example 4: Client API extension (mirrors `pdfApi.form4805`)

```typescript
// client/src/lib/api.ts — ADD to existing pdfApi object:
export const pdfApi = {
  // ... existing
  lonespec: (year: string, month: string, assistantId: string) =>
    api.post("/pdf/lonespec", { year, month, assistantId }, { responseType: "blob" }),
  lonespecMe: (month: string) =>
    api.get(`/pdf/lonespec/me?month=${month}`, { responseType: "blob" }),
};

// New listing endpoint also needed for AssistantDashboard slip list (JSON, not PDF):
export const assistantApi = {
  // ... existing
  mySlips: () => api.get("/assistant/slips"),  // returns PaymentSlip[] for the JWT-bound assistant
};
```

Note this implies a second route `GET /api/assistant/slips` for the JSON listing (separate from `GET /api/pdf/lonespec/me` which streams a PDF for a specific month). Planner should confirm this split and add it to `server/src/routes/assistant.ts` — it's a small new handler selecting from `payment_slips` where `assistantId = req.assistantId`.

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pdf-lib` for both fill-existing-AcroForm AND from-scratch layout | `pdf-lib` for AcroForm filling (FK 3057/3059/SKV 4805); `pdfkit` for from-scratch layout (Phase 9 lönespec) | This phase (2026-04-19) | Two libraries, clear separation of concerns; no functional overlap |
| SQL migration files generated by `drizzle-kit generate` | `drizzle-kit push` for schema sync | Phase 7 (2026-04-18) | Phase 9 inherits; no migration files added |
| `guardianName` as employer on FK/SKV | `resolveEmployerRepresentation(profile, asOfDate)` helper | Phase 8 (2026-04-19) | Phase 9 slip header consumes helper; no direct profile.guardianName reads |
| pdfkit 0.13/0.14 era | pdfkit 0.18.0 (2026-03-15) | Minor release on npm; API stable — the flow-layout `.text()` surface has been stable for years [ASSUMED based on public release-note tone, NOT verified against changelog in this session] | Planner should add a Wave 0 task: `npm view pdfkit@0.18.0` sanity check + a 10-line smoke test rendering `ÅÄÖåäö` |

**Deprecated/outdated:**
- Using `alert()` for user errors on new surfaces. Grandfathered in `Monthly.tsx:631`; new slip error handling should use inline `text-destructive` per 09-UI-SPEC §Interaction Contract.
- Reading hourly rate from environment (`FK_HOURLY_RATE`). Replaced in v1.0.1 by per-assistant `hourly_rate_override`; CONTEXT D-12 explicitly forbids env fallback on slip generation.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | pdfkit's built-in Helvetica fully covers Swedish å/ä/ö via WinAnsi without manual font registration | Standard Stack, Pitfall 3 | Medium — if wrong, Wave 0 smoke test catches it immediately and planner adds a `doc.registerFont()` task pointing to a TTF. No spec changes, only one extra task. |
| A2 | pdfkit 0.18.0's flow API (`.text(…).moveDown()`, right-aligned `text(x,y,{width,align})`) has not regressed vs. the stable 0.13–0.17 series | State of the Art | Low — the flow API is the documented primary surface; any regression would have been noisy in the npm changelog. Wave 0 smoke test validates. |
| A3 | `Intl.NumberFormat("sv-SE")` in Node 20 (the project's runtime per `tsconfig`) correctly produces decimal-comma and space-thousands grouping | Code Examples Ex.3 | Low — Node 20 ships with full-ICU by default since v18; verified in the existing codebase's `toLocaleDateString("sv-SE")` calls at `pdf.ts:155`. |
| A4 | `drizzle-kit push` will add 3 `assistants` columns + 1 `profile` column + 1 new `payment_slips` table in a single interactive run without prompting for a destructive change | Pitfall 4 | Very low — changes are purely additive. Phase 7 did 23+ additive columns via push without issue. |
| A5 | `req.assistantId` is populated by `requireAuth` when the JWT payload includes `assistantId`, and the existing invite-acceptance flow issues assistant JWTs with that field set | Pitfall 6, Pitfall 7 | Low — verified against `middleware/auth.ts:17–23` which copies `payload.assistantId` onto the request. Existing `assistant.ts:14` uses the same field. |

## Open Questions

1. **Should historical slip generation (D-11) fall back to `assistant.hourlyRateOverride` when `payroll_records.hourlyRateUsed` is 0, or refuse and require re-approval?**
   - What we know: D-12 guarantees override is non-null at generation time. D-11 allows historical slips. Pre-SLIP-07 records may have `hourlyRateUsed = 0`.
   - What's unclear: Which value wins when they disagree (override = 254.10, snapshot = 0).
   - Recommendation: Plan a small decision step — my suggestion is "fall back to override" because (a) override is the user's intent, (b) SLIP-07 was a migration gap not a policy shift, (c) refusing would be user-hostile for the March 2026 retroactive filing thread. This should be captured as a planner decision in the PLAN.md.

2. **Does the JSON listing for AssistantDashboard slip rows live on `/api/assistant/slips` or `/api/pdf/lonespec/me` (GET without `month` query)?**
   - What we know: D-08 defines `/pdf/lonespec/me?month=YYYY-MM` as the PDF download endpoint. The list is separate data.
   - What's unclear: CONTEXT doesn't explicitly specify the listing endpoint.
   - Recommendation: `GET /api/assistant/slips` returning `PaymentSlip[]` for the JWT-bound assistant, ordered newest-first (reportMonth DESC, issuedAt DESC per UI-SPEC). Clean separation: `/pdf/*` streams PDFs, `/assistant/*` returns JSON. Planner should confirm.

3. **Does the Monthly.tsx Lönespec download row live as a sibling section to the existing "AGI (blankett 4805)" section, or as sub-rows under a renamed "Månadsdokument" section?**
   - What we know: 09-UI-SPEC.md Copywriting leaves this as executor's discretion (Option A vs Option B).
   - What's unclear: User's preference.
   - Recommendation: Option B (new sibling section titled "Lönespecifikation") for v1.0.1 — less invasive, no rename of the existing tested 4805 section, and cleaner visual hierarchy for the numbered-step Monthly layout.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Entire server runtime | ✓ | v20.20.1 | — |
| npm | `pdfkit` install | ✓ | 10.8.2 | — |
| qpdf | Existing FK form decryption (not Phase 9 code path, but installed and healthy) | ✓ | 12.3.2 | — |
| PostgreSQL | `payment_slips` table storage | Assumed ✓ (Phase 7 landed successfully using same DB) | — | — |
| pdfkit | Slip rendering | ✗ (not yet installed) | 0.18.0 (published 2026-03-15) | `npm install pdfkit@^0.18.0` in Wave 0 |
| `@types/pdfkit` | TypeScript types | ✗ (not yet installed) | 0.17.6 | `npm install -D @types/pdfkit@^0.17.6` in Wave 0 |

**Missing dependencies with fallback:** pdfkit / @types/pdfkit — standard `npm install` is the fallback (no blocker).

**Missing dependencies with no fallback:** none. Phase 9 has no environmental blockers. The existing successful Phase 7/8 implementations confirm the DB + Node + PDF toolchain works.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 (both `server/` and `client/`) |
| Config file | `server/vitest.config.ts` (inferred from working `server/src/routes/__tests__/*.test.ts` and `server/src/lib/*.test.ts`); no explicit read this session but existing tests run via `npm test` per `server/package.json:12` |
| Quick run command | `cd server && npm test -- --run server/src/lib/payrollSlipUtils.test.ts` (single file) |
| Full suite command | `cd server && npm test` (full server suite) and `cd client && npm test` (full client suite) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| SLIP-01 | Guardian POST /api/pdf/lonespec for approved assistant returns 200 + PDF bytes | integration | `cd server && npm test -- pdf-lonespec` | ❌ Wave 0 — `server/src/routes/__tests__/pdf-lonespec.test.ts` new |
| SLIP-01 | POST /api/pdf/lonespec when payroll not approved returns 409 | integration | `cd server && npm test -- pdf-lonespec` | ❌ Wave 0 |
| SLIP-01 | POST /api/pdf/lonespec when `hourly_rate_override` is NULL returns 400 + Swedish error | integration | `cd server && npm test -- pdf-lonespec` | ❌ Wave 0 |
| SLIP-02 | GET /api/pdf/lonespec/me?month=YYYY-MM returns 200 + PDF for JWT-bound assistant | integration | `cd server && npm test -- pdf-lonespec` | ❌ Wave 0 |
| SLIP-02 | GET /api/pdf/lonespec/me returns 403 when no assistant is linked (guardian role no link) | integration | `cd server && npm test -- pdf-lonespec` | ❌ Wave 0 |
| SLIP-02 | GET /api/assistant/slips returns only JWT-bound assistant's `payment_slips` rows | integration | `cd server && npm test -- assistant-slips` | ❌ Wave 0 — `server/src/routes/__tests__/assistant-slips.test.ts` new |
| SLIP-03 | `buildAnhorigSlip()` returns correct arbetstid/lön/avdrag field values for golden input | unit | `cd server && npm test -- payrollSlipUtils` | ❌ Wave 0 — `server/src/lib/payrollSlipUtils.test.ts` new |
| SLIP-03 | `buildAnhorigSlip()` VAB year-to-date matches `vabBalance()` inverted (120 − remaining) | unit | `cd server && npm test -- payrollSlipUtils` | ❌ Wave 0 |
| SLIP-03 | Slip shows 0 dagar rows when absences empty | unit | `cd server && npm test -- payrollSlipUtils` | ❌ Wave 0 |
| SLIP-03 | Slip fields exclude arbetsgivaravgifter / total kostnad (regression guard) | unit | `cd server && npm test -- payrollSlipUtils` | ❌ Wave 0 |
| SLIP-04 | Minor patient → `representative !== null`; adult without override → `representative === null` | unit | `cd server && npm test -- payrollSlipUtils` | ❌ Wave 0 |
| SLIP-04 | Slip builder calls `resolveEmployerRepresentation` with report-period-end date | unit | `cd server && npm test -- payrollSlipUtils` | ❌ Wave 0 |
| SLIP-05 | First POST allocates `payment_slips` row with `sequence=1` + `documentNumber='LS-YYYY-MM-001'` | integration | `cd server && npm test -- pdf-lonespec` | ❌ Wave 0 |
| SLIP-05 | Second POST for same (assistant, month) reuses the existing row (no new sequence, no new issuedAt) | integration | `cd server && npm test -- pdf-lonespec` | ❌ Wave 0 |
| SLIP-05 | Unique index on `(assistantId, reportMonth, sequence)` enforced at DB level | integration | `cd server && npm test -- pdf-lonespec` | ❌ Wave 0 |
| SLIP-06 | Settings → Assistants edit dialog renders salary_model / hourly_rate_override / payment_method fields | client component | `cd client && npm test -- Settings` (if such a test exists; otherwise Playwright smoke in Phase 10) | ⚠️ Optional — UI contract already locked by 09-UI-SPEC; planner may defer to Phase 10 manual walkthrough. |
| SLIP-06 | PUT /api/assistants/:id persists the 3 new fields (whitelist coverage) | integration | `cd server && npm test -- assistants-put` | ⚠️ Wave 0 — may extend existing assistants integration test rather than create new file |
| SLIP-07 | Read-only confirmation: `payroll_records.salaryModelUsed` and `hourlyRateUsed` already exist | schema invariant | — (already verified by Phase 7 tests) | ✅ Phase 7 coverage; Phase 9 is a read-only consumer |

**Manual walkthrough (Phase 10 DATA-03 responsibility, not Phase 9):**
- Visual inspection of rendered PDF: Swedish character rendering, right-aligned numeric columns, Företrädd av line appears/absents correctly, bank line conditional, footer asterisk note verbatim.

### Sampling Rate
- **Per task commit:** `cd server && npm test -- --run payrollSlipUtils` (fast unit suite, < 2 seconds)
- **Per wave merge:** `cd server && npm test` + `cd client && npm test` (full project suites)
- **Phase gate:** All Phase 9 new tests green + pre-existing suites remain green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/src/lib/payrollSlipUtils.ts` — new pure module (implementation)
- [ ] `server/src/lib/payrollSlipUtils.test.ts` — covers SLIP-03 and SLIP-04
- [ ] `server/src/lib/pdfSlipRenderer.ts` — new pdfkit renderer (optional split from builder; see Architecture)
- [ ] `server/src/routes/__tests__/pdf-lonespec.test.ts` — covers SLIP-01, SLIP-02 (endpoint side), SLIP-05
- [ ] `server/src/routes/__tests__/assistant-slips.test.ts` — covers SLIP-02 listing endpoint (or merge into pdf-lonespec suite, planner discretion)
- [ ] Extension of `server/src/routes/__tests__/` for the assistants PUT whitelist (SLIP-06 server side) — may piggyback on a pre-existing assistants suite if present; if not, create `assistants-put.test.ts`
- [ ] Wave 0 smoke test: `npm install pdfkit @types/pdfkit` in server, render a 1-line doc with `ÅÄÖåäö`, open visually — confirms Pitfall 3 fallback not needed
- [ ] `.planning/phases/09-salary-slip/09-VALIDATION.md` — Nyquist validation doc listing the above test-to-requirement matrix (per workflow.nyquist_validation = true in config.json)

No missing framework install — Vitest is already in the stack. No missing shared fixtures required beyond what each test colocates.

## Security Domain

Per project `security_enforcement` assumption (absent in config → enabled), this section enumerates applicable controls.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | Existing `requireAuth` JWT middleware; no change in Phase 9 |
| V3 Session Management | yes | Existing JWT pattern (`Authorization: Bearer …`); Phase 9 consumes, does not alter |
| V4 Access Control | yes | `requireGuardian` for POST /lonespec; `requireAssistantAccess` + `req.assistantId`-only check for GET /lonespec/me (see Pitfall 6) |
| V5 Input Validation | yes | Validate `assistantId` regex (mirrors existing `pdf.ts:346` — `/^[a-zA-Z0-9_-]+$/`); validate `month` format `/^\d{4}-\d{2}$/`; planner may introduce zod if desired but no new dependency required |
| V6 Cryptography | no | No encryption of PDFs; no key management. Slip is served over HTTPS at the transport layer, which is an infra concern not a code concern. |
| V7 Error Handling & Logging | yes | Never log slip contents (PII — pno, bank, netto salary). Existing `console.error("[pdf] … error:", e)` pattern is safe; do not expand to dump `fields` or `req.body`. |
| V9 Data Protection | yes | `payment_slips` row contains no PII beyond `assistantId` foreign key + timestamps; PDF is ephemeral (rebuilt each request, never persisted) which limits data-at-rest exposure |
| V11 Business Logic | yes | The 409 approval gate and 400 rate-NULL gate ARE the business-logic controls that prevent issuance of a legal document with placeholder or un-reviewed numbers. Tests MUST cover both gates. |

### Known Threat Patterns for TypeScript/Express/pdfkit Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| SQL injection on `assistantId` body field | Tampering | Drizzle ORM parameterises all values; the regex validation at request entry rejects malformed IDs before hitting DB |
| Path traversal via filename in Content-Disposition | Information Disclosure | Filename is built from `assistant.name.replace(/\s+/g, "-")` — trusted DB value. Mirror existing `pdf.ts:438` pattern; do NOT incorporate raw req body into the filename. |
| Cross-assistant IDOR on /me endpoint | Elevation of Privilege | Use ONLY `req.assistantId` from JWT; never trust query/body `assistantId` on the /me route. Integration test proves 403 on attempted override. |
| JWT replay / stolen token usage | Spoofing | Out of scope for Phase 9; existing `requireAuth` enforces; token rotation is an infra/auth-phase concern |
| Denial of service via repeated PDF generation | Denial of Service | Low risk: pdfkit in-memory render of a single A4 page is ~30–80ms with ~500KB memory; no PDF compression tuning needed. Rate limiting lives in an infra layer, not this phase. |
| PII leakage via error response | Information Disclosure | 409 / 400 / 403 / 404 / 500 responses contain generic messages. 400 for NULL rate includes `assistantName` only, which is already visible to the caller (they just queried for that assistant). Acceptable. |
| Storing PDF with sensitive data unencrypted | Information Disclosure | N/A — D-06 forbids storing the PDF at all |

## Sources

### Primary (HIGH confidence — grounded in this repo)
- `server/src/routes/pdf.ts` — existing FK 3057/3059/SKV 4805 routes; template for new /lonespec endpoints (verified lines 338–448)
- `server/src/lib/employer-representation.ts` — `resolveEmployerRepresentation()` slip header source (verified lines 66–99)
- `server/src/lib/employer-representation.test.ts` — colocated test convention (verified lines 1–40)
- `server/src/lib/absence-utils.ts` — `vabBalance()` + `filterBillableEntries()` (verified lines 1–91)
- `server/src/lib/payroll-utils.ts` — frozen calculation model; slip reads output, does not recompute
- `server/src/db/schema.ts` — Phase 7 columns & enums (verified full file; salaryModelSnapshotEnum at :23, paymentMethodEnum at :17, snapshot columns at :212–213)
- `server/src/middleware/auth.ts` — `requireAuth` + `requireGuardian` + `requireAssistantAccess` (verified lines 1–46)
- `server/src/routes/assistant.ts:12–22` — `/me` pattern with `req.assistantId` resolution
- `server/src/routes/assistants.ts:45–73` — PUT whitelist pattern to extend for salary_model/hourly_rate_override/payment_method
- `server/src/routes/profile.ts:13–50` — PUT whitelist pattern to extend for default_pay_day
- `client/src/lib/api.ts:106–114` — `pdfApi` pattern to extend with lonespec helpers
- `client/src/pages/Monthly.tsx:621–633` + `:1096–1130` — `download4805` handler + 4805 row UI template
- `.planning/phases/09-salary-slip/09-CONTEXT.md` — locked decisions (authoritative)
- `.planning/phases/09-salary-slip/09-UI-SPEC.md` — UI design contract (authoritative)
- `.planning/REQUIREMENTS.md` + `.planning/ROADMAP.md` — phase goal + success criteria
- `.planning/phases/07-foundation-schema-cleanup/` — Phase 7 schema-push precedent
- npm registry verification `npm view pdfkit version` → 0.18.0 (2026-03-15) [VERIFIED this session]
- npm registry verification `npm view @types/pdfkit version` → 0.17.6 [VERIFIED this session]

### Secondary (MEDIUM confidence)
- pdfkit docs — Getting Started / Text API / Font Registration (referenced, not fetched this session; planner may cite `http://pdfkit.org/docs/getting_started.html` for Wave 0 reference)
- MDN `Intl.NumberFormat` — Swedish locale number formatting
- PostgreSQL 12+ UPSERT / ON CONFLICT docs — sequence-allocation idempotency Option 3

### Tertiary (LOW confidence — flagged for validation)
- pdfkit 0.18.0 changelog — not fetched this session. Assumption A1/A2 depend on API stability. Wave 0 smoke test is the verification.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — versions verified against npm, alternatives ruled out with repo grounding
- Architecture: HIGH — every pattern traces to a specific file and line already in the repo
- Pitfalls: HIGH — all 8 pitfalls reference either a CONTEXT decision, an existing code file, or an established pattern
- Validation: HIGH — test framework is known (Vitest), existing colocated-test convention is the template
- Security: MEDIUM — ASVS mapping is standard; specific controls are in place, no new auth surface introduced

**Research date:** 2026-04-19
**Valid until:** 2026-05-19 (30 days — stack is stable, pdfkit unlikely to ship a breaking 0.18.x release in that window; CONTEXT decisions are locked)
