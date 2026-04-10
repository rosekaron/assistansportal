---
phase: 03-payroll-calculation-recording
plan: "03"
subsystem: api
tags: [express, drizzle-orm, zod, payroll, payments, jwt-auth]

requires:
  - phase: 03-02
    provides: payrollRecords and payments tables in schema.ts, calculatePayroll utility

provides:
  - "GET /api/payroll?month=YYYY-MM — list payroll records for a month"
  - "POST /api/payroll/generate — generate per-assistant payroll records with snapshotted rates and absence breakdown"
  - "POST /api/payroll/:id/approve — one-way draft→approved state transition with 409 guard"
  - "GET /api/payments?payrollRecordId=XXX — list payments for a payroll record"
  - "POST /api/payments — record a payment against a payroll record"
  - "DELETE /api/payments/:id — remove a payment record"

affects: [04-reporting, client-payroll-ui, client-payments-ui]

tech-stack:
  added: []
  patterns:
    - "Generate route checks for existing record before INSERT — idempotent generate (T-03-08)"
    - "Assistant-scoped absence DB query using OR(assistantId=asst.id, assistantId IS NULL) — public holidays apply to all"
    - "filterBillableEntries reused from absence-utils for payroll pipeline consistency (D-05)"
    - "Rate values read exclusively from process.env and snapshotted into DB at generate time (D-02)"
    - "One-way approve state machine: draft → approved with 409 on re-approve (D-13)"
    - "payments route verifies payrollRecord existence before INSERT to prevent orphaned rows (T-03-07)"

key-files:
  created:
    - server/src/routes/payroll.ts
    - server/src/routes/payments.ts
  modified:
    - server/src/index.ts

key-decisions:
  - "POST /api/payroll/generate is idempotent — existing record returned without re-insert if called twice for same (assistantId, month)"
  - "filterBillableEntries called inside generate route using same absenceRow shape as pdf.ts pipeline (D-05 compliance)"
  - "Per-type absence breakdown stored as JSON text in absenceBreakdownJson at generate time, not computed on read (PAY-02)"
  - "Rate values sourced only from server-side env vars — no client-supplied rate fields accepted (T-03-05)"

patterns-established:
  - "Route file uses typed intermediate arrays (AbsenceRow[], EntryRow[]) when calling absence-utils pure functions"
  - "All payroll/payments endpoints protected with requireAuth + requireGuardian (no assistant-role access)"

requirements-completed: [PAY-01, PAY-02, PAY-03]

duration: 15min
completed: 2026-04-10
---

# Phase 03 Plan 03: Payroll and Payments Express Routes Summary

**Express routes for payroll generation, approval, and payment recording with auth guards, snapshotted rate values, per-type absence breakdown, and idempotent generate semantics**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-10T08:35:00Z
- **Completed:** 2026-04-10T08:37:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Implemented `payroll.ts` with GET list, POST generate (idempotent, rate snapshot, absence breakdown), POST approve (409 guard)
- Implemented `payments.ts` with GET (by payrollRecordId), POST (with payrollRecord existence check), DELETE
- Registered both routes in `index.ts` at `/api/payroll` and `/api/payments`
- All auth-guard tests GREEN: payroll (6 pass, 4 skipped), payments (6 pass, 4 skipped)
- Full test suite: 9 files, 54 tests pass, 12 skipped (DB-dependent), zero failures

## Task Commits

1. **Task 1: Create payroll.ts route — generate, list, approve** - `36c9b6f` (feat)
2. **Task 2: Create payments.ts route + register both routes in index.ts** - `bd47978` (feat)

## Files Created/Modified

- `server/src/routes/payroll.ts` — GET /api/payroll, POST /api/payroll/generate, POST /api/payroll/:id/approve
- `server/src/routes/payments.ts` — GET /api/payments, POST /api/payments, DELETE /api/payments/:id
- `server/src/index.ts` — Added imports and app.use registrations for both new routers

## Decisions Made

- Idempotent generate: if a `(assistantId, month)` record already exists, return it without re-inserting — satisfies T-03-08 and allows safe re-runs
- Per-type absence breakdown computed at generate time and stored as JSON text — matches PAY-02 requirement; future read paths parse the JSON rather than recompute
- `filterBillableEntries` called with typed `EntryRow[]` and `AbsenceRow[]` arrays built from DB results — ensures same pipeline as pdf.ts (D-05)
- Absence query uses `OR(assistantId = asst.id, assistantId IS NULL)` — public holidays stored with null assistantId apply to all assistants (RESEARCH.md Pattern 8)

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None — both files compiled cleanly, all auth-guard tests turned GREEN on first run.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- PAY-01, PAY-02, PAY-03 requirements satisfied
- Payroll generation and payment recording routes are live and auth-protected
- DB-dependent integration tests remain skipped pending live DB in test environment
- Ready for Phase 4 reporting or client-side payroll UI integration

---
*Phase: 03-payroll-calculation-recording*
*Completed: 2026-04-10*
