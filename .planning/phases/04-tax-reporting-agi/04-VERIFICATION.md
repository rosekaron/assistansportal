---
phase: 04-tax-reporting-agi
verified: 2026-04-17T22:00:00Z
status: passed
score: 4/4 must-haves verified
retrospective: true
note: "Written retrospectively during v1.0 milestone audit close-out. Evidence from shipped code + integration-checker confirmation."
---

**Status:** PASSED (retrospective)

# Phase 04 — Tax Reporting (AGI) — Verification

Verification written retrospectively against the four success criteria from ROADMAP.md. Evidence gathered from shipped code and v1.0 milestone integration-checker.

## Success Criteria

### 1. Generate filled blankett 4805 PDF per assistant per month

**Required fields:** personnummer, gross salary, employer contributions, withheld preliminary tax — all derived from approved `payroll_records`.

**Evidence:**
- `server/src/lib/form4805-utils.ts` — `buildForm4805Fields()` maps payroll + assistant profile + rate snapshot onto SKV 4805 field schema
- `server/src/routes/pdf.ts` — POST `/api/pdf/4805` endpoint returns PDF blob with `requireGuardian`
- `forms/skv4805.pdf` — reference PDF form (committed 2026-04-17)
- Input source: `payroll_records` table rows, filtered to `status = approved`

**Result:** PASS

### 2. Guardian can download filled 4805 PDF per assistant from Monthly.tsx Step 4, gated on all payroll approved

**Evidence:**
- `client/src/lib/api.ts` — `pdfApi.form4805()` helper
- `client/src/pages/Monthly.tsx` — Step 4 per-assistant download buttons in the stepper
- `server/src/routes/pdf.ts` — returns **409 Conflict** if any payroll record for the month is non-approved
- Monthly.tsx gates the Step 4 UI on `agiUnlocked = step2Complete` (all payroll approved)

**Result:** PASS

### 3. Payroll formula corrected: gross = (billableHours × hourlyRate − costs) / (1 + taxRate)

**Evidence:**
- `server/src/lib/payroll-utils.ts` — `calculatePayroll()` applies the corrected formula after Phase 4 Plan 01 update
- `server/src/lib/payroll-utils.test.ts` — unit tests cover the corrected formula
- Phase 4 Plan 01 migration recalculated draft records to the new formula (per 04-01-SUMMARY.md)

**Result:** PASS

### 4. Configurable preliminary tax rate in Settings; snapshotted into payroll_records at generation

**Evidence:**
- `client/src/pages/Settings.tsx:165–214` — UI for preliminary tax rate (displays as integer %, stored as decimal)
- `server/src/routes/payroll.ts:51,198` — reads `settingsMap["preliminary_tax_rate"]` and snapshots into `payrollRecords.prelimTaxRateSnapshot`
- `server/src/db/schema.ts:185–186` — `hourlyRateSnapshot` and `taxRateSnapshot` columns (existing); prelim tax snapshot column added by Phase 4 migration
- `server/src/db/index.ts` — `seedDefaults()` seeds `preliminary_tax_rate = "0"` on fresh DB (added during v1.0 audit close-out 2026-04-17)

**Result:** PASS

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| TAX-01 | 04-01, 04-02, 04-03 | Generate AGI / 4805 data | Complete | form4805-utils.ts, pdf.ts |
| TAX-02 | 04-02, 04-03 | Download Skatteverket-compatible 4805 PDF | Complete | pdfApi.form4805, Monthly.tsx Step 4 |

## Integration Check

Cross-phase wiring (via v1.0 milestone integration-checker):
- 4805 PDF reads approved Phase 3 `payroll_records` with 409 guard — **CONNECTED**
- Prelim tax rate snapshot path: Settings → `preliminary_tax_rate` key → payroll.ts → `payrollRecords.prelim_tax_rate_snapshot` → form4805 fields — **WIRED**
- `requireGuardian` applied to PDF + prelim tax settings endpoints — **WIRED**

## Tech Debt Noted

None specific to this phase. All success criteria satisfied.

## Verdict

All 4 success criteria PASS. Phase 04 is complete.
