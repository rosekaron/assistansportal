---
phase: 04-tax-reporting-agi
plan: 01
subsystem: payroll
tags: [formula-fix, schema, tdd, payroll-utils, costs-deduction, prelim-tax]
dependency_graph:
  requires: []
  provides: [corrected-payroll-formula, schema-prelim-tax-snapshot, schema-assistant-address, recalculate-drafts-endpoint]
  affects: [payroll-utils, payroll-route, schema, payroll-records-db]
tech_stack:
  added: []
  patterns: [pure-function-formula, tdd-red-green, snapshot-rates-at-generation, server-side-costs-query]
key_files:
  created:
    - server/src/lib/payroll-utils.test.ts
  modified:
    - server/src/lib/payroll-utils.ts
    - server/src/db/schema.ts
    - server/src/routes/payroll.ts
    - server/src/routes/__tests__/payroll-utils.test.ts
    - server/vitest.config.ts
decisions:
  - D-01 formula applied: gross = (fkAllocation - costsSum) / (1 + taxRate)
  - costsSum queried server-side from costs table scoped to assistant_id + month (D-02, T-04-01)
  - prelimTaxRate read from settings table key "preliminary_tax_rate", snapshotted at generation (D-04, D-05)
  - recalculate-drafts endpoint only touches status=draft records; approved records are immutable
  - db:push interactive prompt bypassed by applying DDL directly via pg client (drizzle-kit prompt not automatable)
metrics:
  duration: "~15 minutes"
  completed: "2026-04-11"
  tasks_completed: 2
  files_modified: 5
  files_created: 1
---

# Phase 04 Plan 01: Payroll Formula Fix + Schema Additions Summary

**One-liner:** Corrected FK-envelope payroll formula (gross = netAfterCosts / (1 + taxRate)), added `prelim_tax_rate_snapshot` and `address` schema columns, wired costs deduction and preliminary tax into the generate route.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Schema additions + corrected payroll-utils.ts formula (TDD) | 71366da | payroll-utils.ts, schema.ts, payroll-utils.test.ts, vitest.config.ts |
| 2 | Update payroll.ts generate route + db:push + recalculate drafts | 6ea7c06 | payroll.ts, routes/__tests__/payroll-utils.test.ts |

## What Was Built

### Corrected Formula (D-01)

Phase 3 stored `grossPay = billableHours × hourlyRate` — treating the entire FK allocation as gross salary, which is wrong. The correct formula:

```
fkAllocation  = billableHours × hourlyRate
netAfterCosts = fkAllocation − costsSum
grossPay      = netAfterCosts / (1 + taxRate)
employerContribs = grossPay × taxRate
totalEmployerCost ≈ netAfterCosts  ✓
```

When `netAfterCosts ≤ 0` (costs exceed allocation), all values return 0.

### Schema Changes

- `assistants.address` — `text DEFAULT ''` — required for form 4805 recipient address field (`txtAdress[0][1]`)
- `payroll_records.prelim_tax_rate_snapshot` — `real DEFAULT 0` — snapshots preliminary tax rate at generation time (D-05)

Both columns applied to the live database via direct DDL (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`).

### Payroll Route Updates

- Reads `preliminary_tax_rate` from `settings` table before the assistant loop
- Queries `costs` table scoped to `assistant_id + month` inside the loop (D-02)
- Passes `costsSum` to `calculatePayroll()`
- Snapshots `prelimTaxRateSnapshot` in `db.insert`

### Recalculate Drafts Endpoint

`POST /api/payroll/recalculate-drafts` — guardian-only endpoint that recalculates all `status='draft'` payroll records with the corrected formula. Approved records are not touched (one-way state machine preserved). Security: `requireAuth + requireGuardian` middleware (T-04-02).

## Test Results

All 58 tests pass, 12 skipped. New test file `server/src/lib/payroll-utils.test.ts` covers 4 cases:
1. Normal case with costs deduction (confirms D-01 formula)
2. Zero hours → all zeros
3. Costs exceed allocation → all zeros
4. Old formula (hours×rate) does NOT match new formula

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Plan's expected test value was slightly wrong**
- **Found during:** Task 1 GREEN phase
- **Issue:** Plan specified `grossPay ≈ 21611.58` for `100h × 334 @ 0.3142 − 5000 costs` but actual math gives `28400 / 1.3142 = 21610.105`
- **Fix:** Updated test expectation to `21610.11` (correct value)
- **Files modified:** server/src/lib/payroll-utils.test.ts

**2. [Rule 1 - Bug] Old Phase 3 PAY-01 test file used wrong formula signature**
- **Found during:** Task 2 TypeScript compile check
- **Issue:** `server/src/routes/__tests__/payroll-utils.test.ts` called `calculatePayroll()` without `costsSum`, causing TS2345 errors after the type was updated
- **Fix:** Updated all test cases in that file to pass `costsSum: 0` and corrected expected values for the D-01 formula
- **Files modified:** server/src/routes/__tests__/payroll-utils.test.ts

**3. [Rule 3 - Blocking] Vitest config excluded co-located test files**
- **Found during:** Task 1 RED phase
- **Issue:** `vitest.config.ts` only included `src/**/__tests__/**/*.test.ts`; plan specified test at `src/lib/payroll-utils.test.ts`
- **Fix:** Added `src/**/*.test.ts` to include array in vitest.config.ts
- **Files modified:** server/vitest.config.ts

**4. [Rule 3 - Blocking] drizzle-kit push prompt not automatable in non-TTY environment**
- **Found during:** Task 2 db:push step
- **Issue:** drizzle-kit's interactive prompt for "create column or rename?" cannot be piped to in a non-TTY context; `yes ""` and `printf '\n'` both returned exit 0 without applying changes
- **Fix:** Applied DDL directly via pg client (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`). Both columns verified present in DB.
- **Note:** drizzle-kit also detected pre-existing schema drift (`guardian_auth_id`, `family_label`, `auth_id` columns in DB not in schema.ts). These were NOT dropped — out of scope for this plan.

## Pre-existing Issues (Out of Scope — Deferred)

- `server/src/routes/gcal.ts` lines 146: TypeScript errors (`Property 'data' does not exist on type 'void'`, type overlap error). Pre-existing before this plan's changes. Logged to deferred items.

## Known Stubs

None. All formula values are computed from real inputs.

## Threat Surface Scan

No new network endpoints beyond what the plan specified. `POST /api/payroll/recalculate-drafts` is in the plan's threat model as T-04-02 with `requireAuth + requireGuardian` applied — mitigated as designed.

## Self-Check: PASSED

All files found. All commits verified:
- 71366da: feat(04-01): corrected payroll formula, schema columns, TDD tests
- 6ea7c06: feat(04-01): update payroll route with costs query, prelim tax snapshot, recalculate-drafts endpoint
