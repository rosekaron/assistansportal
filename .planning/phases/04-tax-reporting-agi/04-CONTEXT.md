# Phase 4: Tax Reporting (AGI) - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Guardian can generate and download a Skatteverket-ready AGI (arbetsgivardeklaration på individnivå)
XML file for a given month, covering all assistants. Phase 4 also fixes the Phase 3 payroll
calculation formula which was incorrect.

Requirements in scope: TAX-01, TAX-02
Not in scope: Direct e-filing with Skatteverket API, printable payslips, age-based contribution
rates (deferred from Phase 3), karensdag deduction.

</domain>

<decisions>
## Implementation Decisions

### Payroll Formula Correction (Phase 3 Bug Fix)

- **D-01:** Phase 3's `payroll-utils.ts` incorrectly treats `hours × hourlyRate` as gross salary.
  The correct formula is:

  ```
  FK allocation     = billableHours × hourlyRate
  − costs           = sum of costs.amount_sek for this assistant+month
  Net after costs   = FK allocation − costs
  Gross salary      = netAfterCosts / (1 + taxRate)        e.g. / 1.3142
  Employer contrib  = grossSalary × taxRate
  Check:            grossSalary + employerContrib ≈ netAfterCosts ✓
  ```

  Phase 4 must correct `payroll-utils.ts` and re-derive the stored `payroll_records` figures
  before generating AGI. The AGI XML figures must match what's in `payroll_records`.

- **D-02:** Costs (from the `costs` table, scoped to the same `assistant_id` and `month`) are
  deducted from the FK allocation before calculating gross. Costs represent admin overhead,
  materials, or other expenses paid from the FK envelope. Any remaining surplus after salary
  + contributions + costs is returned to FK — not relevant to the AGI XML itself.

### Preliminary Tax (Preliminärskatt)

- **D-03:** Preliminärskatt IS required in the AGI XML (`AvdragenSkatt` field). It is NOT zero.
  The guardian withholds tax from each assistant's gross salary and remits it to Skatteverket
  alongside the AGI declaration.

- **D-04:** A single guardian-level default preliminary tax rate, stored in the `settings` table
  under key `preliminary_tax_rate` (e.g. value `"0.30"` for 30%). This mirrors the existing
  `settings` key/value pattern (`allow_self_book`, `booking_window_days`, etc.).
  All assistants use the same rate — no per-assistant override in Phase 4.

- **D-05:** Add a "Preliminary tax rate" field to the Settings page (alongside the existing
  FK hourly rate and employer tax rate fields). Guardian sets this once; it applies to all AGI
  exports going forward. Snapshot the rate into `payroll_records` at generation time (same
  pattern as `hourly_rate_snapshot` and `tax_rate_snapshot`).

### Data Source for AGI

- **D-06:** AGI reads from `payroll_records` for gross salary and employer contributions
  (these are the approved, locked figures). VAB days are derived separately from the `absences`
  table using calendar day counts (clipped to the reporting month boundary) — not from
  `absence_breakdown_json` which stores hours, not days.

- **D-07:** AGI is only generated for months where `payroll_records.status = 'approved'`
  for all assistants. If any assistant's payroll is still `draft`, the download button is
  disabled with a tooltip explaining why.

### XML Generation

- **D-08:** Add `xmlbuilder2` as a new server dependency for XML serialisation. Do not use
  string templating — Swedish names contain Å, Ö, Ä which require proper encoding.

- **D-09:** New route file `server/src/routes/agi.ts`, mounted at `POST /api/agi/generate`.
  Request body: `{ year: string, month: string }`. Returns an XML file download
  (`Content-Type: application/xml`, `Content-Disposition: attachment; filename="AGI-YYYY-MM.xml"`).
  One file per month covering all assistants.

- **D-10:** New pure utility file `server/src/lib/agi-utils.ts` — builds the XML document
  from payroll and absence data. No DB imports. Follows the `payroll-utils.ts` / `absence-utils.ts`
  pure-function pattern.

### Employer Identifier

- **D-11:** Use `profile.guardianPno` as the employer identifier in the AGI XML
  (`AgRegistreradId`). The guardian is a private person, not a company — Swedish personal
  number is accepted by Skatteverket for private employers. Use the stored value as-is
  (format: `YYYYMMDDNNNN` 12-digit, already stored this way in the `profile` table).

### UI Placement

- **D-12:** AGI download is added to `Monthly.tsx` as **Step 4** in the compliance stepper
  (after FK forms). Gated: Step 4 only unlocks when Steps 1–3 are complete (reports approved,
  payroll approved, FK forms available). Download button triggers `POST /api/agi/generate`.

- **D-13:** The preliminary tax rate setting is added to the existing Settings page
  (`client/src/pages/Settings.tsx`) alongside FK hourly rate and employer tax rate.

### VAB Days

- **D-14:** VAB days field in AGI XML = calendar days of `absenceType = 'vab'` absences
  for the assistant within the reporting month, derived from the `absences` table using
  `clippedDays()` from `absence-utils.ts`. If no VAB absences, field = 0.

### Claude's Discretion

- Exact AGI XML namespace/DOCTYPE (research item — confirm against 2026 Skatteverket spec)
- Income code (inkomstkod) value for personlig assistent (likely 11 — confirm via research)
- Exact element names in 2026 LONA format (confirm via research)
- Error handling when payroll_records are missing for some assistants in a month
- Empty state design on Monthly page Step 4

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Tax Reporting — TAX-01, TAX-02 acceptance criteria
- `.planning/ROADMAP.md` §Phase 4 — Success criteria and dependency notes

### Payroll foundation (formula must be corrected here)
- `server/src/lib/payroll-utils.ts` — current (incorrect) formula; Phase 4 fixes this
- `server/src/routes/payroll.ts` — payroll generation route; may need updating after formula fix
- `server/src/db/schema.ts` — `payroll_records` table columns (gross_pay, employer_contributions,
  hourly_rate_snapshot, tax_rate_snapshot, absence_breakdown_json, status)

### Costs deduction
- `server/src/db/schema.ts` — `costs` table (id, month, category, assistant_id, amount_sek)

### VAB days derivation
- `server/src/lib/absence-utils.ts` — `clippedDays()` function for calendar day counting
- `server/src/db/schema.ts` — `absences` table (assistant_id, start_date, end_date, absence_type)

### Settings pattern (for preliminary_tax_rate key)
- `server/src/routes/misc.ts` — existing `/api/settings` GET/POST endpoints; add new key here
- `server/src/db/schema.ts` — `settings` table (key text, value text)

### Existing file generation pattern to follow
- `server/src/routes/pdf.ts` — file download route pattern (Content-Disposition, error handling)

### UI integration points
- `client/src/pages/Monthly.tsx` — Step 4 AGI download goes here
- `client/src/pages/Settings.tsx` — preliminary tax rate field goes here

### Phase 3 context (decisions that constrain this phase)
- `.planning/phases/03-payroll-calculation-recording/03-CONTEXT.md` — D-02 (snapshots), D-03
  (single-tenant pattern), D-13 (approval locking)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/lib/absence-utils.ts` — `clippedDays(startDate, endDate, monthStart, monthEnd)` for VAB day count
- `server/src/lib/payroll-utils.ts` — will be corrected; `calculatePayroll()` signature can stay, formula changes
- `server/src/routes/pdf.ts` — file download pattern (set headers, send buffer) to replicate in `agi.ts`
- `server/src/middleware/auth.ts` — `requireAuth` + `requireGuardian` middleware for new route

### Established Patterns
- Pure utility in `server/src/lib/` with no DB imports — follow for `agi-utils.ts`
- One route file per domain — `agi.ts` for `POST /api/agi/generate`
- Settings key/value store — add `preliminary_tax_rate` key, read via existing `/api/settings`
- Snapshot rates at generation time (not re-read from settings on each fetch)

### Integration Points
- `server/src/index.ts` — register `agi.ts` routes at `/api/agi`
- `server/src/db/schema.ts` — add `prelim_tax_rate_snapshot` column to `payroll_records`
- `client/src/lib/api.ts` — add `agiApi.generate(year, month)` typed helper
- `client/src/pages/Monthly.tsx` — add Step 4 after existing Step 3 (FK forms)
- `client/src/pages/Settings.tsx` — add preliminary tax rate input field

</code_context>

<specifics>
## Specific Ideas

- 334 kr/h is the total FK allocation envelope — NOT just gross salary. The correct derivation is:
  `gross = (hours × 334 − costs) / 1.3142`. Phase 3 stored the wrong figure; Phase 4 corrects it.
- Surplus after salary + contributions + costs is returned to FK — no AGI relevance.
- Guardian remits both arbetsgivaravgifter AND preliminärskatt to Skatteverket directly.
- Preliminary tax rate is a blanket guardian setting — one rate for all assistants.

</specifics>

<deferred>
## Deferred Ideas

- **Per-assistant tax codes / jämkningsbeslut** — some assistants may have a tax adjustment
  decision reducing their withholding rate. Deferred to a future compliance pass.
- **Age-based employer contribution rates** — 10.21% for born before 1959, 17.77% for born
  2003–2006. Deferred from Phase 3; still deferred from Phase 4.
- **Karensdag deduction** — first unpaid sick day. Still deferred.
- **Direct e-filing via Skatteverket API** — out of scope per REQUIREMENTS.md.
- **Printable payslip** — noted in Phase 3 deferred ideas; not in Phase 4.

</deferred>

---

*Phase: 04-tax-reporting-agi*
*Context gathered: 2026-04-11*
