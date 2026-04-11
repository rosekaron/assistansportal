# Phase 4: Tax Reporting (Form 4805) - Context

**Gathered:** 2026-04-11
**Updated:** 2026-04-11 (format pivot: AGI XML → pre-filled blankett 4805 PDF)
**Status:** Ready for planning

<domain>
## Phase Boundary

Guardian can generate and download pre-filled Skatteverket blankett 4805 (förenklad
arbetsgivardeklaration) PDFs — one per assistant per month. Phase 4 also fixes the Phase 3
payroll calculation formula which was incorrect.

Requirements in scope: TAX-01, TAX-02
Not in scope: Direct e-filing with Skatteverket API, AGI XML format, printable payslips,
karensdag deduction, per-assistant tax codes / jämkningsbeslut.
Age-based contribution rates: all three age paths implemented in Phase 4 (pure function,
no schema impact): 1959+ at 31.42%, 1938–1958 at 10.21%, 1937– no contributions.

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
  before generating form 4805 PDFs. The form field values must match what's in `payroll_records`.

- **D-02:** Costs (from the `costs` table, scoped to the same `assistant_id` and `month`) are
  deducted from the FK allocation before calculating gross. Costs represent admin overhead,
  materials, or other expenses paid from the FK envelope. Any remaining surplus after salary
  + contributions + costs is returned to FK — not relevant to the form 4805 itself.

### Preliminary Tax (Preliminärskatt)

- **D-03:** Preliminärskatt IS required on form 4805 (field `txtKod09` — Avdragen skatt). It is
  NOT zero. The guardian withholds tax from each assistant's gross salary and remits it to
  Skatteverket alongside the form 4805 declaration.

- **D-04:** A single guardian-level default preliminary tax rate, stored in the `settings` table
  under key `preliminary_tax_rate` (e.g. value `"0.30"` for 30%). This mirrors the existing
  `settings` key/value pattern (`allow_self_book`, `booking_window_days`, etc.).
  All assistants use the same rate — no per-assistant override in Phase 4.

- **D-05:** Add a "Preliminary tax rate" field to the Settings page (alongside the existing
  FK hourly rate and employer tax rate fields). Guardian sets this once; it applies to all form
  4805 exports going forward. Snapshot the rate into `payroll_records` at generation time (same
  pattern as `hourly_rate_snapshot` and `tax_rate_snapshot`).

### Data Source for Form 4805

- **D-06:** Form 4805 reads from `payroll_records` for gross salary and employer contributions
  (these are the approved, locked figures). VAB days: **dropped from Phase 4** (form 4805 has
  no VAB field). VAB derivation deferred to a future phase.

- **D-07:** Form 4805 is only generated for months where `payroll_records.status = 'approved'`
  for the specific assistant. If an assistant's payroll is still `draft`, that assistant's
  download button is disabled with a tooltip explaining why.

### PDF Generation

- **D-08:** Use `pdf-lib` (already installed at v1.17.1) to fill AcroForm fields in the
  Skatteverket blankett 4805 PDF template stored at `forms/skv4805.pdf`. Do NOT use
  `xmlbuilder2` or string templating. Swedish characters (Å, Ö, Ä) are handled by pdf-lib
  natively.

- **D-09:** Route `POST /api/pdf/4805` in `server/src/routes/pdf.ts` (extend existing file,
  do not create a separate agi.ts). Request body: `{ year: string, month: string, assistantId: string }`.
  Returns `application/pdf` with `Content-Disposition: attachment; filename="4805-YYYY-MM-{name}.pdf"`.
  One PDF per assistant per request.

- **D-10:** New pure utility file `server/src/lib/form4805-utils.ts` — builds the AcroForm
  field map from payroll and profile data. No DB imports. Returns
  `Record<string, string>` mapping confirmed field names to values. Follows the
  `payroll-utils.ts` / `absence-utils.ts` pure-function pattern.

### Confirmed AcroForm Field Names (from direct PDF inspection)

Duplicate field names (txtNamn[0], txtPersNr[0], txtAdress[0]) appear twice — use
`form.getFields().filter(f => f.getName() === name)` and access by index: [0]=employer, [1]=recipient.

```
txtManad[0]           ← Swedish month name, first letter capitalised
                        (new Intl.DateTimeFormat('sv-SE',{month:'long'}).format(date)
                         then .charAt(0).toUpperCase() + slice(1))
txtNamn[0]   [0]      ← profile.guardianName          (employer)
txtPersNr[0] [0]      ← profile.guardianPno            (employer)
txtAdress[0] [0]      ← `${profile.address}, ${profile.zip} ${profile.city}`.trim()
txtNamn[0]   [1]      ← assistant.name                (recipient)
txtPersNr[0] [1]      ← assistant.pno                 (recipient)
txtAdress[0] [1]      ← assistant.address             (recipient — NEW field)
txtKod04[0]           ← String(Math.round(grossPay))   (born 1959+ — Phase 4 only)
txtKod07[0]           ← String(Math.round(employerContributions))
txtKod06[0]           ← String(Math.round(grossPay))   (underlag för skatteavdrag = gross)
txtKod09[0]           ← String(Math.round(grossPay * prelimTaxRateSnapshot))
txtKod10[0]           ← String(Math.round(employerContributions + grossPay * prelimTaxRateSnapshot))
txtNamnfortydl[0]     ← profile.guardianName
txtNTelefon[0]        ← profile.guardianPhone
```

All monetary values are whole integers (no decimals). Confirmed from sample form
(4805-202503-Rose.pdf): 50046, 15733, 15014, 30747.

Age-based fields `txtKod18[0]` / `txtKod24[0]` (born 1938–1958) are left empty in Phase 4.

### Employer Identifier

- **D-11:** Use `profile.guardianPno` as the employer personnummer in the form 4805
  (`txtPersNr[0]` employer field). The guardian is a private person — stored as 12-digit
  YYYYMMDDNNNN in the `profile` table, used as-is.

### UI Placement

- **D-12:** Form 4805 download is added to `Monthly.tsx` as **Step 4** in the compliance
  stepper (after FK forms). Per-assistant download buttons — one button per assistant row.
  Each button is gated on that assistant's payroll being `status = 'approved'` (D-07).
  Button triggers `POST /api/pdf/4805` with `{ year, month, assistantId }`.

- **D-13:** The preliminary tax rate setting is added to the existing Settings page
  (`client/src/pages/Settings.tsx`) alongside FK hourly rate and employer tax rate.

### Assistant Address (New)

- **D-15:** Add `address text default ''` column to the `assistants` table. Form 4805
  requires recipient address (`txtAdress[0]` recipient field). Add address input to the
  existing assistant profile/edit UI. Guardian fills this in for each assistant.

### Claude's Discretion

- Error handling when an assistant's payroll record is missing for a requested month
- Empty state design on Monthly page Step 4 when no payroll records exist yet
- Exact assistant edit UI component to extend for address field

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Tax Reporting — TAX-01, TAX-02 acceptance criteria
- `.planning/ROADMAP.md` §Phase 4 — Success criteria and dependency notes

### Payroll foundation (formula must be corrected here)
- `server/src/lib/payroll-utils.ts` — current (incorrect) formula; Phase 4 fixes this
- `server/src/routes/payroll.ts` — payroll generation route; needs updating after formula fix
- `server/src/db/schema.ts` — `payroll_records` table columns

### Costs deduction
- `server/src/db/schema.ts` — `costs` table (id, month, category, assistant_id, amount_sek)

### Settings pattern (for preliminary_tax_rate key)
- `server/src/routes/misc.ts` — existing `/api/settings` GET/POST endpoints
- `server/src/db/schema.ts` — `settings` table (key text, value text)

### PDF generation pattern to follow
- `server/src/routes/pdf.ts` — file download route pattern (Content-Disposition, error handling)
  Phase 4 extends this file with the 4805 endpoint (D-09)

### UI integration points
- `client/src/pages/Monthly.tsx` — Step 4 form 4805 download goes here
- `client/src/pages/Settings.tsx` — preliminary tax rate field goes here

### Phase 3 context (decisions that constrain this phase)
- `.planning/phases/03-payroll-calculation-recording/03-CONTEXT.md` — D-02 (snapshots), D-03
  (single-tenant pattern), D-13 (approval locking)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/lib/payroll-utils.ts` — will be corrected; `calculatePayroll()` signature updated to include `costsSum`
- `server/src/routes/pdf.ts` — file download pattern (set headers, send buffer); extend for 4805 endpoint
- `server/src/middleware/auth.ts` — `requireAuth` + `requireGuardian` middleware for new route

### Established Patterns
- Pure utility in `server/src/lib/` with no DB imports — follow for `form4805-utils.ts`
- Settings key/value store — add `preliminary_tax_rate` key, read via existing `/api/settings`
- Snapshot rates at generation time (not re-read from settings on each fetch)

### Integration Points
- `server/src/routes/pdf.ts` — add `POST /api/pdf/4805` endpoint here (D-09)
- `server/src/db/schema.ts` — add `prelim_tax_rate_snapshot` to `payroll_records`, `address` to `assistants`
- `client/src/lib/api.ts` — add `pdfApi.form4805(year, month, assistantId)` typed helper
- `client/src/pages/Monthly.tsx` — add Step 4 after existing Step 3 (FK forms)
- `client/src/pages/Settings.tsx` — add preliminary tax rate input field
- Assistant edit UI — add address field (locate the assistant edit component)

</code_context>

<specifics>
## Specific Ideas

- 334 kr/h is the total FK allocation envelope — NOT just gross salary. The correct derivation is:
  `gross = (hours × 334 − costs) / 1.3142`. Phase 3 stored the wrong figure; Phase 4 corrects it.
- Surplus after salary + contributions + costs is returned to FK — no form 4805 relevance.
- Guardian remits both arbetsgivaravgifter AND preliminärskatt to Skatteverket directly.
- Preliminary tax rate is a blanket guardian setting — one rate for all assistants.
- Sample form values confirmed: gross 50046, employer contrib 15733, prelim tax 15014 (≈30%), sum 30747.

</specifics>

<deferred>
## Deferred Ideas

- **VAB days** — form 4805 has no VAB field. Deferred from Phase 4; revisit before v1 complete.
- **Age-based contribution rates** — ✓ Implemented in Phase 4 (1959+ at 31.42%, 1938–1958 at 10.21%, 1937– no contributions).
- **Per-assistant tax codes / jämkningsbeslut** — some assistants may have a tax adjustment
  decision reducing their withholding rate. Deferred to a future compliance pass.
- **Karensdag deduction** — first unpaid sick day. Still deferred.
- **Direct e-filing via Skatteverket API** — out of scope per REQUIREMENTS.md.
- **Printable payslip** — noted in Phase 3 deferred ideas; not in Phase 4.

</deferred>

---

*Phase: 04-tax-reporting-agi*
*Context gathered: 2026-04-11 | Updated: 2026-04-11*
