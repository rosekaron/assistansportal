---
phase: 02-leave-absence-foundation
plan: "03"
subsystem: api
tags: [absences, leave, billing, drizzle, express, zod, vab, sjukfranvaro, tdd]

# Dependency graph
requires:
  - phase: 02-02
    provides: absences table in PostgreSQL with absenceTypeEnum (sjukfrånvaro/vab/semester/other), reqStatusEnum extended with 'cancelled', Absence TypeScript type in schema.ts
  - phase: 02-01
    provides: Wave 0 RED test stubs for absences CRUD, billing exclusion, and VAB/sick balance — contracts this plan satisfies
provides:
  - absence-utils.ts with filterBillableEntries, vabBalance, sickYtd pure functions
  - Full CRUD router at /api/absences (GET list, GET /balance/:assistantId, POST, DELETE)
  - FK 3059 and FK 3057 exclude absence-covered entries from billable hours
  - assistant.ts accept endpoint returns 409 when absence covers the shift date
  - /api/absences mounted in index.ts
affects:
  - 02-04 (frontend absence UI will call these routes)
  - Phase 3 payroll (cancelled entries + absence-filtered billable hours feed into payroll calc)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure utility functions in lib/ — no DB imports, plain array inputs; enables unit testing without DB"
    - "Balance route defined BEFORE /:id param route to avoid Express path conflict"
    - "Ownership check returns 404 (not 403) on DELETE to avoid disclosing other guardians' records (T-02-03-03)"
    - "Auto-cancel is one-way: POST absence cancels overlapping approved shifts; DELETE absence does NOT restore them (D-02)"
    - "FK billing exclusion via filterBillableEntries applied post-query: DB fetches approved entries, then pure function removes absence-covered ones"
    - "FK 3057 absence query unscoped by guardianId per single-tenant RESEARCH.md Pitfall 6 — code comment documents MULTI-01 future fix"

key-files:
  created:
    - server/src/lib/absence-utils.ts
    - server/src/routes/absences.ts
  modified:
    - server/src/routes/pdf.ts
    - server/src/routes/assistant.ts
    - server/src/index.ts

key-decisions:
  - "filterBillableEntries applied post-query (not in SQL WHERE) so null-assistantId global absences can exclude any assistant's entries without complex SQL OR logic"
  - "Balance route /balance/:assistantId defined before /:id in absences router to prevent Express treating 'balance' as a dynamic :id segment"
  - "FK 3057 absence fetch is unscoped (no guardianId filter) — intentional single-tenant assumption per RESEARCH.md Pitfall 6; documented in code comment for MULTI-01"
  - "Assistant accept block is server-authoritative — 409 returned from server even if frontend shows absence; frontend enforcement is UX-only"

patterns-established:
  - "Absence exclusion pattern: DB query fetches approved entries, filterBillableEntries() removes absence-covered ones, result used for all billing calculations"

requirements-completed:
  - LEAV-01
  - LEAV-02
  - LEAV-03

# Metrics
duration: 3min
completed: 2026-04-06
---

# Phase 02 Plan 03: Absence Server Layer Summary

**Full absence API layer with CRUD routes, VAB/sick balance endpoint, FK billing exclusion via pure filterBillableEntries function, and server-side 409 clock-in block — all three Wave 0 test stubs GREEN**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-04-06T13:44:18Z
- **Completed:** 2026-04-06T13:46:58Z
- **Tasks:** 2
- **Files modified:** 5 (2 created, 3 modified)

## Accomplishments

- Created `absence-utils.ts` with pure functions `filterBillableEntries`, `vabBalance`, `sickYtd` — cross-year clipping, null-assistantId global absences, VAB 120-day cap
- Created `absences.ts` CRUD router with Zod validation, guardianId scoping, auto-cancel of overlapping approved entries on POST, 404-not-403 ownership protection on DELETE
- Updated `pdf.ts` FK 3059 and FK 3057 to fetch absence rows and apply `filterBillableEntries` before billing totals — LEAV-02 fully implemented
- Added 409 absence block in `assistant.ts` accept handler — server-authoritative enforcement of absence date conflicts
- Mounted `/api/absences` in `index.ts`; all 6 test files GREEN (34 passing, 4 skipped DB integration stubs)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create absence-utils.ts and absences.ts route** - `b54b1d0` (feat)
2. **Task 2: Apply FK billing exclusion (pdf.ts) and clock-in block (assistant.ts + index.ts)** - `4b6c04d` (feat)

## Files Created/Modified

- `server/src/lib/absence-utils.ts` - Pure functions: filterBillableEntries, vabBalance, sickYtd, AbsenceRow/EntryRow types
- `server/src/routes/absences.ts` - Full CRUD router: GET /, GET /balance/:assistantId, POST /, DELETE /:id
- `server/src/routes/pdf.ts` - FK 3059 and FK 3057 handlers now fetch absences and apply filterBillableEntries
- `server/src/routes/assistant.ts` - accept endpoint checks for active absence and returns 409 if found
- `server/src/index.ts` - absencesRouter mounted at /api/absences

## Decisions Made

- `filterBillableEntries` applied post-query (not SQL) so null-assistantId global absences work without complex SQL OR conditions across joined tables
- `GET /balance/:assistantId` route registered before `/:id` to prevent Express treating "balance" as dynamic param
- FK 3057 absence query is not scoped by guardianId — single-tenant assumption per RESEARCH.md Pitfall 6, code comment documents future MULTI-01 fix
- DELETE returns 404 (not 403) for both "not found" and "wrong guardian" — avoids disclosing existence of other guardians' records (T-02-03-03)

## Deviations from Plan

None — plan executed exactly as written. All code follows plan's action blocks verbatim; TypeScript compiled cleanly (only pre-existing gcal.ts errors unrelated to this plan).

## Issues Encountered

Pre-existing TypeScript errors in `gcal.ts` (two errors, unrelated to this plan). These existed before plan execution and are out of scope for this plan. Noted in deferred-items.

## Known Stubs

None. All routes implemented with real DB queries; balance endpoint wired to live absence data. No placeholder values or hardcoded returns.

## Threat Flags

None. All trust boundaries from the threat register were addressed:

| T-ID | Status | Implementation |
|------|--------|----------------|
| T-02-03-01 | Mitigated | Zod schema validates absenceType enum, date format, startDate <= endDate |
| T-02-03-02 | Mitigated | All queries include `eq(absences.guardianId, req.userId!)`, requireGuardian on all routes |
| T-02-03-03 | Mitigated | DELETE fetches record with guardianId check, returns 404 to avoid disclosure |
| T-02-03-04 | Mitigated | 409 server-side block in assistant.ts accept handler |
| T-02-03-05 | Accepted | Bulk cancel on POST is intentional; guardian is authenticated |
| T-02-03-06 | Accepted | FK 3057 unscoped absence query per single-tenant design; code comment documents MULTI-01 |

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- All three LEAV requirements (LEAV-01, LEAV-02, LEAV-03) are satisfied at the server layer
- `/api/absences` endpoints are live and ready for frontend consumption
- `absence-utils.ts` exports are available for any future server-side consumers
- 4 DB integration tests remain `.skip` (intentional Wave 0 design) — can be enabled when test DB seeding is available
- Phase 02-04 (frontend absence UI) can proceed immediately

---
*Phase: 02-leave-absence-foundation*
*Completed: 2026-04-06*
