# Phase 3: Payroll Calculation & Recording - Context

**Gathered:** 2026-04-08 (assumptions mode)
**Status:** Ready for planning

<domain>
## Phase Boundary

Guardian can view and approve monthly payroll per assistant, with correct 2026 Swedish tax rates
and employer contributions, and record actual payments made.

Requirements in scope: PAY-01, PAY-02, PAY-03
Not in scope: AGI generation (Phase 4), scheduling (Phase 5), karensdag deduction, age-based
contribution rates, printable payslips.

</domain>

<decisions>
## Implementation Decisions

### Data Model
- **D-01:** Two new tables: `payroll_records` (one row per assistant per month, stores calculated
  figures + approval status) and `payments` (one row per payment recorded, references a payroll
  record). The existing `costs` table is structurally wrong for this — it has no approval state
  and no assistant-month granularity.
- **D-02:** The hourly rate (FK_HOURLY_RATE) and employer tax rate used for calculation are
  **snapshotted into the `payroll_records` row at generation time**, not re-read from env var
  on each fetch. This ensures locked approved records stay immutable even if the rate changes.
- **D-03:** Follow the existing single-tenant table pattern — no `guardianId` column on
  `payroll_records` or `payments` (matching `costs`, `entries`, `openSlots`). Data isolation
  enforced at route level via `requireGuardian` middleware.

### Calculation Approach
- **D-04:** Payroll math lives server-side in a new `server/src/lib/payroll-utils.ts` — pure
  functions, no DB imports, parallel to `absence-utils.ts`.
- **D-05:** Billable hours fed into payroll MUST reuse `filterBillableEntries` from
  `server/src/lib/absence-utils.ts` — the same function used by FK 3059/3057 in `pdf.ts`.
  No divergence between payroll figures and FK form figures is acceptable.
- **D-06:** Employer contributions: **flat 31.42% rate for all assistants** in Phase 3.
  Age-based reduced rates (10.21% for 67+, 17.77% for 19–23) are deferred to a later
  compliance pass — noted for revisiting.
- **D-07:** Karensdag (first unpaid sick day) is **not deducted from gross pay in Phase 3**.
  Deferred to Phase 5 compliance refinement.

### UI Approach
- **D-08:** New dedicated `/payroll` route and page (`client/src/pages/Payroll.tsx`), not
  embedded in `Reports.tsx`. Added to the guardian sidebar nav in `Layout.tsx`.
- **D-09:** Layout: month selector at top, one card per assistant showing:
  billable hours, absence hours by type, gross pay (hours × rate), employer contributions,
  total employer cost, outstanding payment balance.
- **D-10:** Approval via an inline "Approve" button on each card. Once approved, button
  changes to "Approved ✓" and the record is locked.
- **D-11:** Payment recording is **inline within the assistant card** (no modal, no separate
  page). Expanding the card shows payment history + "Add payment" form (date, amount, method).

### API Design
- **D-12:** Two new route files following the one-domain-per-file pattern:
  - `server/src/routes/payroll.ts` — `GET /api/payroll?month=YYYY-MM`, `POST /api/payroll/generate`,
    `POST /api/payroll/:id/approve`
  - `server/src/routes/payments.ts` — `GET /api/payments?payrollId=`, `POST /api/payments`,
    `DELETE /api/payments/:id`

### Approval / Locking
- **D-13:** `payroll_records` status enum: `draft | approved`. The approve endpoint checks
  current status and rejects if already `approved`. No separate audit log table in Phase 3
  (Phase 4 will need to consider audit trail for AGI).

### Claude's Discretion
- Exact `payroll_records` and `payments` schema column names (beyond what's implied by decisions above)
- Loading/empty state design
- Error handling for approval of months with no entries

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Payroll requirements
- `.planning/REQUIREMENTS.md` §Payroll — PAY-01, PAY-02, PAY-03 acceptance criteria
- `.planning/ROADMAP.md` §Phase 3 — Success criteria and dependency notes

### Existing calculation utilities to reuse
- `server/src/lib/absence-utils.ts` — `filterBillableEntries` function (billable hours calculation)
- `server/src/routes/pdf.ts` — shows the query pattern for fetching entries + absences and calling filterBillableEntries

### Existing data model to extend
- `server/src/db/schema.ts` — all existing tables; understand `costs`, `entries`, `absences` before designing new tables
- `server/src/db/schema.ts` lines 7–8 — `reqStatusEnum`/`repStatusEnum` pattern for status enums

### Existing rate API (snapshot this value into payroll_records)
- `server/src/routes/misc.ts` — `/api/rates` endpoint serving FK_HOURLY_RATE and EMPLOYER_TAX_RATE from env vars

### Phase 1 context (security patterns)
- `.planning/phases/01-stability-correctness/01-CONTEXT.md` — D-04: data isolation via `requireGuardian`, not column-level

### Phase 2 context (billable hours foundation)
- `.planning/phases/02-leave-absence-foundation/02-CONTEXT.md` — absence types, billable hours definition

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/lib/absence-utils.ts` — `filterBillableEntries(entries, absences)` — pure function, reuse directly for billable hour calculation
- `server/src/routes/misc.ts` — `/api/rates` — read FK_HOURLY_RATE and EMPLOYER_TAX_RATE (snapshot these into payroll_records at generation)
- `client/src/pages/Reports.tsx` lines 160–180 — per-assistant summary card pattern to follow for Payroll.tsx layout

### Established Patterns
- One route file per domain (`absences.ts`, `costs.ts`, `entries.ts`) — follow for `payroll.ts` and `payments.ts`
- Pure utility functions in `server/src/lib/` with no DB imports — follow for `payroll-utils.ts`
- Status enum gating transitions (`reqStatusEnum`, `repStatusEnum` in `schema.ts`) — follow for `payroll_records` status
- New page + sidebar nav item for new capability (Phase 2 added `Leave.tsx` and nav item)

### Integration Points
- `server/src/db/schema.ts` — add `payroll_records` and `payments` tables here
- `server/src/index.ts` (or route registration file) — register `payroll.ts` and `payments.ts` routes
- `client/src/components/Layout.tsx` — add Payroll nav item to the 6-item sidebar nav array
- `client/src/lib/api.ts` (or equivalent API client) — add `payrollApi` and `paymentsApi` typed fetch helpers

</code_context>

<specifics>
## Specific Ideas

- The payroll card layout mirrors the wireframe shown during discussion:
  assistant name + Approve button at top, then billable hours / absence hours / gross pay /
  employer contributions / total cost, then payment history + Add payment form at the bottom.
- Month selector at the top of the page (not per-card).
- Once approved, the Approve button becomes "Approved ✓" (disabled, visually locked).
- "Printable payslip" feature noted for a future phase targeting small care companies — not in Phase 3.

</specifics>

<deferred>
## Deferred Ideas

- **Printable payslip** — Guardian wants a PDF payslip per assistant per month. Deferred to a
  future phase when the product targets small care companies. Note: Phase 4 already adds PDF
  infrastructure (AGI export) — payslip could piggyback on that work.
- **Age-based employer contribution rates** — 10.21% for workers born before 1959, 17.77% for
  workers born 2003–2006 (2026 rates). Requires birth year extraction from personnummer.
  Deferred to a later compliance pass.
- **Karensdag deduction** — First unpaid day of a sick period deducted from gross pay. Deferred
  to Phase 5 compliance refinement (already deferred in Phase 2).
- **Adjustment tracking / audit trail** — ROADMAP mentions "changes tracked as separate
  adjustments" but a full adjustment table is a Phase 4 concern when AGI needs the audit trail.
  Phase 3 locks records via status enum only.

</deferred>

---

*Phase: 03-payroll-calculation-recording*
*Context gathered: 2026-04-08*
