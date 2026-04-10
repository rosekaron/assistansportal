---
phase: 03-payroll-calculation-recording
plan: 02
subsystem: payroll
tags: [typescript, drizzle-orm, postgres, pure-functions, vitest]

# Dependency graph
requires:
  - phase: 03-01
    provides: payroll-utils.test.ts RED stubs for calculatePayroll and calculateOutstandingBalance

provides:
  - server/src/lib/payroll-utils.ts — pure functions calculatePayroll and calculateOutstandingBalance
  - payrollRecords table in schema.ts with rate snapshots and absence_breakdown_json
  - payments table in schema.ts referencing payrollRecords
  - payrollStatusEnum and paymentMethodEnum in schema.ts
  - PayrollRecord and Payment type exports
  - payroll_records and payments tables applied to database

affects:
  - 03-03 (payroll route implementation — imports calculatePayroll from payroll-utils.ts)
  - 03-04 (payments route — imports payments table from schema.ts)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure calculation module pattern (no DB imports, mirrors absence-utils.ts)
    - Rate snapshot columns on payrollRecords (D-02: hourlyRateSnapshot, taxRateSnapshot frozen at generation)
    - absence_breakdown_json as TEXT column for per-type absence hours (PAY-02)

key-files:
  created:
    - server/src/lib/payroll-utils.ts
  modified:
    - server/src/db/schema.ts
    - server/src/routes/__tests__/payroll-utils.test.ts

key-decisions:
  - "Applied schema to DB via direct SQL instead of drizzle-kit push due to pre-existing column drift (guardian_auth_id, family_label in assistants table not in schema.ts) that would have caused data loss"
  - "Fixed incorrect test expected values: 29058 * 0.3142 = 9130.0236, not 9130.0836 as written in Wave 0 stub"

patterns-established:
  - "Pattern: Pure payroll module — no DB imports, all inputs via plain object parameter, mirrors absence-utils.ts"
  - "Pattern: Rate snapshot at generation time — hourlyRateSnapshot and taxRateSnapshot written once at INSERT, no UPDATE path"

requirements-completed: [PAY-01, PAY-02]

# Metrics
duration: 17min
completed: 2026-04-10
---

# Phase 03 Plan 02: Payroll Utils and Schema Summary

**Pure calculatePayroll/calculateOutstandingBalance functions (8 tests GREEN) and Drizzle schema extended with payrollRecords + payments tables applied to database**

## Performance

- **Duration:** 17 min
- **Started:** 2026-04-10T06:11:52Z
- **Completed:** 2026-04-10T06:29:36Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Created payroll-utils.ts with calculatePayroll and calculateOutstandingBalance — no DB imports, mirrors absence-utils.ts pattern
- Extended schema.ts with 2 enums (payrollStatusEnum, paymentMethodEnum) and 2 tables (payrollRecords, payments) including absence_breakdown_json for PAY-02
- Applied payroll_records and payments tables to the database; all 8 payroll-utils tests GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Create payroll-utils.ts pure payroll math functions** - `073b157` (feat)
2. **Task 2: Extend schema.ts with payroll enums and tables** - `3657b76` (feat)

## Files Created/Modified
- `server/src/lib/payroll-utils.ts` - Pure calculatePayroll and calculateOutstandingBalance functions; no DB imports
- `server/src/db/schema.ts` - Added payrollStatusEnum, paymentMethodEnum, payrollRecords table, payments table, PayrollRecord/Payment type exports
- `server/src/routes/__tests__/payroll-utils.test.ts` - Fixed incorrect expected values (9130.0836 → 9130.0236, 38188.0836 → 38188.0236)

## Decisions Made
- Used direct SQL (`CREATE TABLE`, `CREATE TYPE`) via Docker exec instead of `drizzle-kit push` because drizzle-kit detected pre-existing column drift (`guardian_auth_id` and `family_label` on `assistants`, `auth_id` on `profile`) and would have dropped those columns causing data loss. Schema additions are correct and verified in DB.
- Placed new enum declarations immediately after `absenceTypeEnum` at line 15 to keep all enums grouped together per existing convention.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect expected values in payroll-utils.test.ts**
- **Found during:** Task 1 (after running tests)
- **Issue:** Test expected `toBeCloseTo(9130.0836, 2)` and `toBeCloseTo(38188.0836, 2)` but `87 * 334 * 0.3142 = 9130.0236` — the Wave 0 stub had a typo (`0836` instead of `0236`)
- **Fix:** Updated expected values to `9130.0236` and `38188.0236` (correct math)
- **Files modified:** server/src/routes/__tests__/payroll-utils.test.ts
- **Verification:** All 8 tests pass GREEN
- **Committed in:** 073b157 (Task 1 commit)

**2. [Rule 3 - Blocking] Applied schema via direct SQL instead of drizzle-kit push**
- **Found during:** Task 2 (drizzle-kit push blocked by data-loss prompt)
- **Issue:** drizzle-kit detected 3 pre-existing columns in DB not in schema.ts (`guardian_auth_id`, `family_label` on assistants; `auth_id` on profile) and required interactive confirmation to drop them — unacceptable data loss for out-of-scope columns
- **Fix:** Applied only the new payroll enums and tables via direct SQL (`CREATE TYPE` + `CREATE TABLE`) using docker exec
- **Files modified:** None (DB-only change)
- **Verification:** `\dt` in psql confirms `payroll_records` and `payments` present; all 46 tests pass (2 still RED for missing Wave 2 route files as expected)
- **Committed in:** 3657b76 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 bug fix in test, 1 blocking issue with drizzle-kit push)
**Impact on plan:** Both fixes necessary — one for test correctness, one to avoid data loss. No scope creep.

## Issues Encountered
- Docker daemon was not running at plan start — opened Docker.app and waited for postgres container to come up before attempting drizzle-kit push.
- Pre-existing schema drift in `assistants` table (`guardian_auth_id`, `family_label`) not in schema.ts; these are out-of-scope columns deferred to a future cleanup plan.

## Known Stubs
None — payroll-utils.ts is fully implemented (not stubbed). Schema tables have no stub data. Route tests (payroll.test.ts, payments.test.ts) remain RED as intended Wave 0 stubs to be implemented in Wave 2.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- Wave 1 complete: payroll-utils.ts fully implemented and tested (8/8 GREEN)
- schema.ts has all 4 new declarations with correct column names; DB migrated
- Wave 2 (03-03, 03-04) can now import `calculatePayroll` from `../lib/payroll-utils` and `payrollRecords`, `payrollStatusEnum` from `../db/schema`
- Pre-existing schema drift (guardian_auth_id, family_label, auth_id columns) should be cleaned up in a future plan to allow drizzle-kit push to work cleanly

---
*Phase: 03-payroll-calculation-recording*
*Completed: 2026-04-10*
