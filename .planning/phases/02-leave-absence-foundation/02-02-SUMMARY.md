---
phase: 02-leave-absence-foundation
plan: "02"
subsystem: database
tags: [drizzle, postgres, schema, enum, absences, leave]

# Dependency graph
requires:
  - phase: 02-01
    provides: Wave 0 RED test stubs for absences — test files that define the contracts this schema must satisfy
provides:
  - absenceTypeEnum with 4 Swedish values (sjukfrånvaro, vab, semester, other)
  - absences table with 7 columns (id, guardianId, assistantId, absenceType, startDate, endDate, createdAt)
  - reqStatusEnum extended with 'cancelled' value (auto-excludes cancelled shifts from FK billing)
  - Absence TypeScript type exported from schema.ts
  - Database schema pushed — absences table live in PostgreSQL dev database
affects:
  - 02-03 (absences API route reads this table)
  - 02-04 (absence-utils and billing filter use absenceTypeEnum and Absence type)
  - Phase 3 payroll (cancelled entries excluded from billable hours via reqStatus filter)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "guardianId (integer = auth.id from JWT) scopes every absence query — enforced at query level, not routing"
    - "Nullable assistantId means absence applies to all assistants for the guardian (public holiday pattern)"
    - "reqStatus 'cancelled' value auto-excludes shifts from FK billing queries that already filter eq(entries.reqStatus, 'approved')"

key-files:
  created: []
  modified:
    - server/src/db/schema.ts

key-decisions:
  - "Applied database schema changes directly via Node.js pg driver (not drizzle-kit push) to avoid drizzle-kit's interactive prompts dropping untracked database columns (guardian_auth_id, family_label, profile.auth_id) that have live data"
  - "reqStatusEnum 'cancelled' placed in the reqStatus (approval-flow) enum per D-02 and Research Pattern 6 Option B — FK billing queries already filter eq(entries.reqStatus, 'approved') so cancelled shifts auto-excluded without query changes"
  - "absenceTypeEnum uses Swedish values matching Swedish compliance domain (sjukfrånvaro=sick leave, vab=VAB, semester=holiday)"

patterns-established:
  - "guardianId scope pattern: all per-guardian data tables include integer guardian_id NOT NULL for row-level isolation"

requirements-completed:
  - LEAV-01

# Metrics
duration: 35min
completed: 2026-04-06
---

# Phase 2 Plan 02: Absences Schema Summary

**Drizzle schema extended with absenceTypeEnum (4 Swedish values), absences table (7 columns), and reqStatusEnum 'cancelled' — all three additions pushed live to PostgreSQL dev database**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-04-06T15:30:00Z
- **Completed:** 2026-04-06T16:05:00Z
- **Tasks:** 2
- **Files modified:** 1 (server/src/db/schema.ts)

## Accomplishments

- Extended `reqStatusEnum` with `"cancelled"` — shifts auto-excluded from FK billing queries that filter `eq(entries.reqStatus, "approved")` without any query changes needed
- Added `absenceTypeEnum` with 4 Swedish values: `sjukfrånvaro`, `vab`, `semester`, `other`
- Added `absences` table with all 7 required columns per D-01
- Exported `Absence` TypeScript type from schema.ts
- Applied all three changes live to the PostgreSQL dev database
- Verified existing 17 tests still pass GREEN; Wave 0 RED stubs remain RED as designed

## Task Commits

Each task was committed atomically:

1. **Task 1: Extend schema.ts** - `5fd1e64` (feat)
2. **Task 2: Push schema to database** - No file changes (database-only operation; schema applied via Node.js pg driver)

## Files Created/Modified

- `server/src/db/schema.ts` - Added absenceTypeEnum, absences table, Absence type export; extended reqStatusEnum with 'cancelled'

## Decisions Made

**Direct pg driver apply instead of drizzle-kit push:**
During Task 2, drizzle-kit push presented an interactive prompt to drop 3 columns that exist in the database but not in schema.ts (`assistants.guardian_auth_id`, `assistants.family_label`, `profile.auth_id`). These columns have live data (checked: 2 rows with family_label/guardian_auth_id, profile auth_id rows present). Dropping them would be a data-loss operation outside this plan's scope. Instead, applied the three required DDL changes directly via the Node.js pg driver:
1. `CREATE TYPE absence_type AS ENUM (...)`
2. `ALTER TYPE req_status ADD VALUE 'cancelled'`
3. `CREATE TABLE absences (...)`

This is additive-only and matches the plan's intent. The untracked columns (guardian_auth_id, family_label, profile.auth_id) are deferred to a separate investigation — see deferred items below.

## Deviations from Plan

### Auto-fixed Issues

None — schema.ts edits were clean.

### Approach Deviation: drizzle-kit push replaced with direct pg DDL

- **Found during:** Task 2 (Push schema to database)
- **Issue:** drizzle-kit push's interactive prompts could not be automated via piped input (TTY-based UI). Additionally, during the push it detected 3 untracked database columns with live data and asked to DROP them — a data-loss operation outside this plan's scope.
- **Fix (Rule 3 — Blocking):** Applied the 3 required DDL operations directly via Node.js pg driver. All operations are additive (CREATE TYPE, ALTER TYPE ADD VALUE, CREATE TABLE) — no data loss, no rollback risk.
- **Files modified:** None (database-only change)
- **Verification:** Node.js verification script confirmed all three changes live in PostgreSQL

---

**Total deviations:** 1 approach change (Rule 3 — blocking workaround)
**Impact on plan:** No scope creep. Additive DDL changes applied as designed. Data loss avoided.

## Issues Encountered

**Untracked database columns discovered:** The database has 3 columns not in schema.ts:
- `assistants.guardian_auth_id` (integer, has data: value 10 in 2 rows)
- `assistants.family_label` (text, has data: "Erik Larsson" in 2 rows)
- `profile.auth_id` (integer, has data: values 8 and 11)

These appear to be from an earlier migration or experimental schema version. They are outside this plan's scope. Deferred to deferred-items.md for investigation before schema is next migrated.

## Known Stubs

None — this plan is schema-only with no UI or API surface.

## Threat Flags

None — no new network endpoints or auth paths introduced. Schema additions stay within the existing trust boundary (server/src/db/schema.ts → PostgreSQL).

## User Setup Required

None — database is the local Docker dev instance; no external service configuration required.

## Next Phase Readiness

- absences table is live in PostgreSQL with correct structure
- Absence TypeScript type is exported and ready for use in absences.ts (02-03) and absence-utils.ts (02-04)
- Wave 0 RED tests remain RED — they will go GREEN in 02-03 (absences router) and 02-04 (absence-utils)
- **Concern:** The 3 untracked database columns (guardian_auth_id, family_label, profile.auth_id) will cause drizzle-kit push to prompt about data loss on every future schema push. Should be investigated and resolved before 02-03 or 02-04 require a schema push.

## Self-Check: PASSED

| Item | Status |
|------|--------|
| server/src/db/schema.ts | FOUND |
| 02-02-SUMMARY.md | FOUND |
| Commit 5fd1e64 | FOUND |
| absences table in PostgreSQL | VERIFIED |
| req_status includes 'cancelled' | VERIFIED |
| absence_type enum with 4 Swedish values | VERIFIED |
| Existing 17 tests GREEN | VERIFIED |

---
*Phase: 02-leave-absence-foundation*
*Completed: 2026-04-06*
