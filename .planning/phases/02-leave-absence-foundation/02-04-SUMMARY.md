---
phase: 02-leave-absence-foundation
plan: "04"
subsystem: frontend
tags: [absences, leave, vab, react, typescript, react-query, frånvaro, ui]

# Dependency graph
requires:
  - phase: 02-03
    provides: Full absence CRUD API at /api/absences — list, create, delete, /balance/:assistantId endpoints
  - phase: 02-02
    provides: absences table schema with AbsenceType enum
provides:
  - Leave.tsx: complete Frånvaro page with balance cards, absence table, record dialog, inline delete, 3 client-side filters
  - absenceApi namespace in api.ts: list, create, delete, balance — with Absence, AbsenceBalance, AbsenceType types
  - Frånvaro nav entry in Layout.tsx sidebar (CalendarOff icon, position 3)
  - /leave route in App.tsx guardian block
  - Per-assistant AbsenceAbsenceSummary row in Assistants.tsx cards
affects:
  - Guardian UI: frånvaro workflow now fully end-to-end in the browser
  - Phase 3 payroll UI: absenceApi and balance data available for payroll calculations

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Per-assistant balance cards use individual useQuery hooks keyed by ['absences','balance',assistant.id]"
    - "Inline delete confirmation pattern: state per row (confirmDeleteId), no modal overlay"
    - "Client-side filtering: three independent useState values reduce already-fetched array — no re-fetch on filter change"
    - "Query invalidation on mutation: both ['absences'] and per-assistant ['absences','balance',id] invalidated"
    - "AbsenceAbsenceSummary sub-component in Assistants.tsx keeps balance fetch co-located with each card"

key-files:
  created:
    - client/src/pages/Leave.tsx
  modified:
    - client/src/lib/api.ts
    - client/src/components/Layout.tsx
    - client/src/App.tsx
    - client/src/pages/Assistants.tsx

key-decisions:
  - "Balance cards: show per-assistant pair (VAB + sick) for <= 3 assistants; collapse to summary for > 3 — per UI-SPEC Balance Cards Spec"
  - "formatPeriod uses sv-SE locale for Swedish month abbreviations (apr, mar, etc.)"
  - "CalendarOff icon confirmed available in installed lucide-react — no fallback needed"
  - "EmptyState renders different message depending on whether no absences exist at all vs. filters produce no match"

# Metrics
duration: ~25min
completed: 2026-04-06
---

# Phase 02 Plan 04: Frånvaro Frontend Summary

**Complete Frånvaro guardian UI: absenceApi namespace with Absence/AbsenceBalance types, Leave page (balance cards + absence table + record dialog + inline delete + 3 filters), Layout.tsx sidebar nav, App.tsx routing, and per-assistant balance row in Assistants.tsx**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-04-06
- **Completed:** 2026-04-06
- **Tasks:** 2 (1 implementation + 1 human verify checkpoint — PASSED)
- **Files modified:** 6 (1 created, 5 modified)

## Accomplishments

- Added `AbsenceType`, `Absence`, `AbsenceBalance` TypeScript types and `absenceApi` namespace (list/create/delete/balance) to `client/src/lib/api.ts` — matches shape of existing API namespaces
- Created `client/src/pages/Leave.tsx` with:
  - Balance cards: per-assistant VAB card (threshold color: green >= 30, amber 10-29, red < 10, with 4px progress bar) and sick YTD card; collapses to summary for > 3 assistants
  - Absence table with correct columns (Assistent, Period, Antal dagar, Typ badge, Registrerad, Åtgärder)
  - Inline delete confirm (no modal — state per row using confirmDeleteId)
  - Record absence dialog with Assistent Select, Typ Select, Startdatum, Slutdatum date inputs; client-side date validation ("Slutdatum kan inte vara före startdatum."); server error message
  - Three independent client-side filters (assistant, type, month) with "Alla" reset options
- Updated `client/src/components/Layout.tsx`: added `CalendarOff` import and Frånvaro nav entry between Schedule and Reports
- Updated `client/src/App.tsx`: added `/leave` route inside guardian block
- Updated `client/src/pages/Assistants.tsx`: added `AssistantAbsenceSummary` sub-component that fetches `absenceApi.balance(assistantId)` per card, displaying VAB kvar (with threshold color) and Sjukfrånvaro days
- TypeScript compiles cleanly: `npx tsc --noEmit` produces no output (zero errors)
- Server tests remain green: 34 passed, 4 skipped (unchanged)

## Task Commits

1. **Task 1: Frånvaro frontend** - `2dcfb6b` (feat)
   Files: client/src/lib/api.ts, client/src/pages/Leave.tsx, client/src/components/Layout.tsx, client/src/App.tsx, client/src/pages/Assistants.tsx
2. **Post-Task-1 fix: SelectItem empty-value crash + Tailwind PostCSS config** - `3604ba4` (fix)
   Files: client/src/pages/Leave.tsx, client/postcss.config.js
3. **Task 2: Human verification checkpoint** - PASSED (browser-verified, no commit)

## Files Created/Modified

- `client/src/pages/Leave.tsx` — NEW: Complete Frånvaro page
- `client/src/lib/api.ts` — Added AbsenceType/Absence/AbsenceBalance types + absenceApi namespace
- `client/src/components/Layout.tsx` — Added CalendarOff import + Frånvaro nav entry
- `client/src/App.tsx` — Added LeaveAbsencePage import + /leave route
- `client/src/pages/Assistants.tsx` — Added absenceApi import, AssistantAbsenceSummary component, Separator import

## Decisions Made

- Per-assistant balance cards for <= 3 assistants; summary card for > 3 — per UI-SPEC design decision
- `sv-SE` locale used for Swedish month abbreviations in period formatting and created date display
- `CalendarOff` available in installed lucide-react — no fallback required
- Empty state message adapts: "Ingen frånvaro registrerad" when list is empty vs. "Inga poster matchar de valda filtren" when filters produce empty result

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SelectItem empty-value crash**
- **Found during:** Human verification (post-Task-1)
- **Issue:** shadcn/radix SelectItem does not accept an empty string `""` as value — throws runtime error on render
- **Fix:** Replaced empty string values with `"__all__"` sentinel in all three filter selects and in the dialog Assistent select's "Alla assistenter" option; updated filter comparisons accordingly
- **Files modified:** client/src/pages/Leave.tsx
- **Verification:** All three filter selects render without crash; "__all__" sentinel correctly treated as "no filter"
- **Committed in:** 3604ba4

**2. [Rule 3 - Blocking] Fixed Tailwind PostCSS config for Vite**
- **Found during:** Human verification (post-Task-1)
- **Issue:** PostCSS config used CommonJS `module.exports` syntax which is incompatible with the Vite ESM build context
- **Fix:** Updated client/postcss.config.js to use ESM `export default` syntax
- **Files modified:** client/postcss.config.js
- **Verification:** Dev server starts without PostCSS errors; Tailwind styles apply correctly
- **Committed in:** 3604ba4

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes were necessary for the app to render correctly in the browser. No scope changes — all plan features were delivered as specified.

## Known Stubs

None. All balance cards use live `absenceApi.balance()` queries. All absence table data from `absenceApi.list()`. No hardcoded or placeholder values in data paths.

## Threat Flags

None. All trust boundaries from the threat register addressed:

| T-ID | Status | Implementation |
|------|--------|----------------|
| T-02-04-01 | Mitigated | Client-side date validation (endDate >= startDate) in handleSubmit(); server Zod validation is authoritative |
| T-02-04-02 | Accepted | Response only contains absences for authenticated guardian — server enforces guardianId scoping |
| T-02-04-03 | Accepted | Client-side filter state manipulation only shows/hides already-fetched rows — no cross-guardian leakage possible |
| T-02-04-04 | Accepted | Assistant names/IDs visible on Assistants page already; no new disclosure on Frånvaro page |

## Human Verification Checkpoint

Plan 02-04 Task 2 was a `checkpoint:human-verify` gate. All 8 verification steps PASSED:

1. "Frånvaro" visible in sidebar between Schedule and Reports (CalendarOff icon)
2. Frånvaro page loads: balance cards, empty state, 3 filter selects
3. "Registrera frånvaro" dialog: Assistent, Typ, Startdatum, Slutdatum fields present
4. VAB recorded: 115/120 balance, row in table (1 mars - 5 mars 2026, 5 dagar, VAB badge)
5. Date validation: end-before-start rejected with inline error
6. Delete: inline confirm ("Ja, radera") removes row, balance restored to 120
7. Assistants page: per-assistant "Fran varo 2026 — VAB kvar: 120 dagar — Sjukfranvaro: 0 dagar" row
8. Filters: 3 filter selects (Assistent, Typ, Manad) present with __all__ sentinel fix

## Self-Check: PASSED

| Item | Status |
|------|--------|
| client/src/pages/Leave.tsx | FOUND |
| client/src/lib/api.ts | FOUND |
| client/src/components/Layout.tsx | FOUND |
| client/src/App.tsx | FOUND |
| client/src/pages/Assistants.tsx | FOUND |
| client/postcss.config.js (ESM fix) | FOUND |
| Commit 2dcfb6b (Task 1 — Frånvaro frontend) | FOUND |
| Commit 3604ba4 (fix — SelectItem + PostCSS) | FOUND |
| TypeScript: npx tsc --noEmit | CLEAN (no errors) |
| Server tests: 34 passed, 4 skipped | VERIFIED |
| Human verification checkpoint | PASSED (all 8 steps) |

---
*Phase: 02-leave-absence-foundation*
*Completed: 2026-04-06*
