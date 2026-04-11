---
phase: 04-tax-reporting-agi
plan: 02
subsystem: pdf-generation
tags: [form4805, pdf-lib, acroform, tdd, pure-function, tax-reporting]
dependency_graph:
  requires: [04-01]
  provides: [form4805-utils, pdf-4805-endpoint, pdfApi-form4805]
  affects: [pdf.ts, api.ts, form4805-utils.ts]
tech_stack:
  added: []
  patterns: [pure-function-field-map, acroform-duplicate-field-index, tdd-red-green, auth-guarded-pdf-endpoint]
key_files:
  created:
    - server/src/lib/form4805-utils.ts
    - server/src/lib/form4805-utils.test.ts
  modified:
    - server/src/routes/pdf.ts
    - client/src/lib/api.ts
decisions:
  - buildForm4805Fields uses __employer__//__recipient__ key prefix for duplicate-named AcroForm fields; pdf.ts resolves by index
  - assistantId validated with /^[a-zA-Z0-9_-]+$/ before any DB or file operation (T-04-05)
  - 4805 route returns 409 (not 404) when payroll exists but is not approved, per D-07
  - gcal.ts pre-existing TS errors (lines 146) are out of scope — documented in deferred items
metrics:
  duration: "~10 minutes"
  completed: "2026-04-11"
  tasks_completed: 2
  files_modified: 2
  files_created: 2
---

# Phase 04 Plan 02: Form 4805 PDF Generation Layer Summary

**One-liner:** Pure `buildForm4805Fields()` utility mapping payroll + profile data to confirmed AcroForm field names, wired into a new `POST /api/pdf/4805` Express endpoint that fills skv4805.pdf and streams it as a secured download.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Create form4805-utils.ts (TDD) | dd3c098 | form4805-utils.ts, form4805-utils.test.ts |
| 2 | Extend pdf.ts + add pdfApi.form4805 to api.ts | 1c99ae1 | pdf.ts, api.ts |

## What Was Built

### form4805-utils.ts (Pure Function Module)

`server/src/lib/form4805-utils.ts` — exports:
- `buildForm4805Fields(input: Form4805Input): Record<string, string>` — builds the complete AcroForm field map
- `birthYearFromPno(pno: string): number | null` — extracts birth year from 12-digit Swedish personnummer
- `swMonthName(yearMonth: string): string` — returns capitalised Swedish month name (e.g. "Mars")
- `Form4805Input`, `Form4805Profile`, `Form4805Assistant`, `Form4805PayrollRecord` types

Age-based code selection:
- Born 1959+: `txtKod04[0]` (gross), `txtKod07[0]` (employer contributions)
- Born 1938–1958: `txtKod18[0]` (gross), `txtKod24[0]` (employer contributions)
- Born 1937 or earlier: salary/contribution fields omitted

Duplicate-named AcroForm fields (`txtNamn[0]`, `txtPersNr[0]`, `txtAdress[0]`) returned with `__employer__` / `__recipient__` key prefixes so the caller can resolve by index.

### POST /api/pdf/4805 Endpoint

Added to `server/src/routes/pdf.ts`:
- `requireAuth + requireGuardian` middleware (T-04-06, T-04-09)
- `assistantId` validated with `/^[a-zA-Z0-9_-]+$/` before any DB or file access (T-04-05)
- Returns 404 JSON if `skv4805.pdf` is absent from `FORMS_DIR`
- Returns 409 JSON if payroll record not found or not `status='approved'` (D-07)
- Reads grossPay, employerContributions, prelimTaxRateSnapshot from `payroll_records` — never from request body (T-04-07)
- Duplicate-named AcroForm fields resolved via `form.getFields().filter(f => f.getName().endsWith(leafName))` and accessed by index

### Client API Helper

`client/src/lib/api.ts`:
- `pdfApi.form4805(year, month, assistantId)` — POSTs to `/pdf/4805` with `responseType: "blob"`
- `PayrollRecord` type updated to include `prelimTaxRateSnapshot: number`

## Test Results

16/16 tests pass in `server/src/lib/form4805-utils.test.ts`:
- Test 1: born 1970 → codes 04/07 present, 18/24 absent
- Test 2: born 1950 → codes 18/24 present, 04/07 absent
- Test 3: born 1930 → no salary/contribution codes present
- Test 4: `txtKod09[0]` = round(21611.58 × 0.30) = "6483"
- Test 5: `txtKod10[0]` = round(6798.52 + 21611.58 × 0.30) = correct integer string
- Test 6: `txtManad[0]` for "2026-03" = "Mars"
- Test 7: all monetary fields are integer strings (no decimals)
- Plus 9 additional tests for header, employer, recipient, and signature fields

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Vitest toMatch() called with 2 arguments (TS2554)**
- **Found during:** Task 2 TypeScript compile check
- **Issue:** Test line 148 used `expect(x).toMatch(/regex/, message)` — Vitest's `toMatch` only accepts 1 argument; correct form is `expect(x, message).toMatch(/regex/)`
- **Fix:** Moved message to the first `expect()` argument
- **Files modified:** server/src/lib/form4805-utils.test.ts
- **Commit:** 1c99ae1 (included in Task 2 commit)

## Pre-existing Issues (Out of Scope — Deferred)

- `server/src/routes/gcal.ts` lines 146: TypeScript errors (`.data` property, type overlap). Pre-existing before this plan — documented in Plan 01 SUMMARY. Not introduced or worsened by this plan's changes.

## Known Stubs

None. The PDF template file `forms/skv4805.pdf` is expected to be placed by the executor in plan 04-03 (human action checkpoint). The endpoint gracefully returns HTTP 404 with a JSON error body if the file is absent — this is intentional behavior, not a stub.

## Threat Surface Scan

All new surface is in the plan's threat model:
- `POST /api/pdf/4805` — T-04-05 (assistantId validation), T-04-06 (requireAuth + requireGuardian), T-04-07 (server-side data), T-04-08 (FORMS_DIR path), T-04-09 (requireGuardian) — all mitigated as designed.

No unplanned network endpoints, auth paths, or file access patterns introduced.

## Self-Check: PASSED

Files exist:
- server/src/lib/form4805-utils.ts — FOUND
- server/src/lib/form4805-utils.test.ts — FOUND
- server/src/routes/pdf.ts (modified) — FOUND
- client/src/lib/api.ts (modified) — FOUND

Commits verified:
- dd3c098: feat(04-02): create form4805-utils.ts with buildForm4805Fields and TDD tests
- 1c99ae1: feat(04-02): add POST /api/pdf/4805 endpoint and pdfApi.form4805 client helper
