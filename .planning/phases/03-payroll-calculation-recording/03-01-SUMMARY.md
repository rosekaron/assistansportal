---
phase: 03-payroll-calculation-recording
plan: 01
subsystem: testing
tags: [vitest, tdd, payroll, payments, auth-guards, wave-0]

# Dependency graph
requires: []
provides:
  - Wave 0 failing test stubs for PAY-01 (payroll-utils pure functions), PAY-02 (payroll routes auth), PAY-03 (payments routes auth)
  - Nyquist feedback loop: each Wave 1/2 implementation task has a pre-existing test file that turns GREEN on landing
affects: [03-02, 03-03, 03-04]

# Tech tracking
tech-stack:
  added: []
  patterns: [Wave 0 RED stub pattern — import non-existent file to fail at import time; auth guard test pattern using supertest + jwt]

key-files:
  created:
    - server/src/routes/__tests__/payroll-utils.test.ts
    - server/src/routes/__tests__/payroll.test.ts
    - server/src/routes/__tests__/payments.test.ts
  modified: []

key-decisions:
  - "Auth guard tests (401/403) are NOT .skip'd — they test middleware behavior, not DB, so they can pass immediately when route files exist"
  - "DB-integration tests are .skip'd per Wave 0 pattern — re-enabled when Wave 1/2 routes and test DB seeding exist"
  - "409 status gate test for already-approved payroll included as .skip (satisfies D-13 requirement tracking)"

patterns-established:
  - "Wave 0 stub pattern: import from non-existent file causes vitest import failure = RED state without writing broken code"
  - "Auth guard test pattern: supertest + jwt.sign({ role }) against minimal express app; no DB required"

requirements-completed: [PAY-01, PAY-02, PAY-03]

# Metrics
duration: 2min
completed: 2026-04-10
---

# Phase 03 Plan 01: Wave 0 Test Stubs Summary

**Three vitest RED-state stubs for PAY-01/02/03 establishing TDD feedback loop: payroll-utils pure functions (8 tests), payroll route auth guards (10 tests), and payments route auth guards (10 tests)**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-09T23:33:31Z
- **Completed:** 2026-04-09T23:35:36Z
- **Tasks:** 2
- **Files modified:** 3 (all created)

## Accomplishments
- Created payroll-utils.test.ts with 8 tests covering calculatePayroll (5 tests: standard case, zero hours, grossPay formula, employer contributions, total cost) and calculateOutstandingBalance (3 tests: partial, full, no payment)
- Created payroll.test.ts with 10 tests: 6 live auth guards (401/403 for GET, POST generate, POST approve) + 4 .skip DB integration tests including 409 status gate (D-13)
- Created payments.test.ts with 10 tests: 6 live auth guards (401/403 for GET, POST, DELETE) + 4 .skip DB integration tests
- All three files fail at import time (intended RED state) — Wave 1 implementation will turn them GREEN

## Task Commits

Each task was committed atomically:

1. **Task 1: Wave 0 stub — payroll-utils.test.ts (PAY-01 pure functions)** - `3ddf838` (test)
2. **Task 2: Wave 0 stubs — payroll.test.ts and payments.test.ts (PAY-02, PAY-03 auth guards)** - `c132feb` (test)

## Files Created/Modified
- `server/src/routes/__tests__/payroll-utils.test.ts` - Unit test stubs for calculatePayroll and calculateOutstandingBalance; imports from non-existent lib/payroll-utils.ts
- `server/src/routes/__tests__/payroll.test.ts` - Auth guard + status gate stubs for GET /api/payroll, POST /api/payroll/generate, POST /api/payroll/:id/approve
- `server/src/routes/__tests__/payments.test.ts` - Auth guard stubs for GET /api/payments, POST /api/payments, DELETE /api/payments/:id

## Decisions Made
- Auth guard tests left as non-skipped: they only require JWT middleware behavior, not DB access, so they become green as soon as the route files are created
- DB integration tests are .skip'd to prevent flaky failures in CI until Wave 1 route implementations and proper test DB seeding are in place
- Followed exact stub pattern from absences-billing.test.ts and absences.test.ts as specified in plan

## Deviations from Plan
None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Wave 0 complete: all three stub files exist and fail at import (RED state confirmed)
- Wave 1 tasks (03-02, 03-03) can now be implemented — each implementation will turn the corresponding test file GREEN
- Auth guard tests will pass immediately once route files are created in Wave 1
- DB integration tests (.skip) will be re-enabled in Wave 2 when test DB seeding is available

## Known Stubs
None — this plan's output IS the stubs. The stub state is intentional and tracked by the Wave 0 pattern. Wave 1 will resolve all import failures.

---
*Phase: 03-payroll-calculation-recording*
*Completed: 2026-04-10*

## Self-Check: PASSED

- FOUND: server/src/routes/__tests__/payroll-utils.test.ts
- FOUND: server/src/routes/__tests__/payroll.test.ts
- FOUND: server/src/routes/__tests__/payments.test.ts
- FOUND: .planning/phases/03-payroll-calculation-recording/03-01-SUMMARY.md
- FOUND: commit 3ddf838 (Task 1)
- FOUND: commit c132feb (Task 2)
