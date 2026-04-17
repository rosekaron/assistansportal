---
phase: 05-scheduling-compliance-workflow
plan: 03
subsystem: compliance
tags: [deadlineUtils, monthly, ProgressStepper, badges, tdd, COMP-01]

# Dependency graph
requires: [05-01]
provides:
  - "deadlineUtils.ts: computeDeadlines and deadlineBadge implemented — 9 tests GREEN"
  - "Monthly.tsx StepProps: badge? field added (D-08)"
  - "Monthly.tsx ProgressStepper: badge renders inline after sublabel with urgency variant"
  - "Monthly.tsx steps 1 and 2: approval-count sublabels"
  - "Monthly.tsx steps 3 and 4: due-date sublabels and urgency badges from fkDeadline/agiDeadline"
affects: [05-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Inline deadline arithmetic in component body: new Date(rmYear, rmMon+1, 5) for FK, new Date(rmYear, rmMon, 12) for AGI"
    - "makeDeadlineBadge helper: pure function inside component; returns StepProps['badge'] — same logic as server deadlineBadge"
    - "JS Date month overflow: December (mon=12) naturally wraps to next-year months with no special case needed"
    - "Badge variant: closed set 'info' | 'warning' | 'destructive' enforced by TypeScript at compile time"

key-files:
  created: []
  modified:
    - "server/src/lib/deadlineUtils.ts"
    - "client/src/pages/Monthly.tsx"

key-decisions:
  - "makeDeadlineBadge inlined in Monthly component body rather than importing from server deadlineUtils — client bundle stays separate from server lib; same arithmetic duplicated for clear colocation"
  - "step3IsComplete mapped to step1Complete (all reports approved = FK forms step done); step4IsComplete mapped to step2Complete (all payroll approved = AGI step done) — consistent with existing fkUnlocked/agiUnlocked logic"
  - "sublabel on step 3 uses fkDaysLeft < 0 guard to show 'Overdue by N days' rather than negative days-left string"

requirements-completed: [COMP-01]

# Metrics
duration: 10min
completed: 2026-04-17
---

# Phase 05 Plan 03: Compliance Deadline Badges — Summary

**deadlineUtils.ts RED tests turned GREEN and Monthly.tsx ProgressStepper enhanced with FK/AGI due-date badges and approval-count sublabels — delivers COMP-01 monthly compliance checklist with urgency signals**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-04-17T19:10:00Z
- **Completed:** 2026-04-17T19:20:00Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

### Task 1: deadlineUtils.ts implementation

- Replaced `throw new Error("Not implemented")` stubs in `computeDeadlines` and `deadlineBadge`
- `computeDeadlines("2026-01")` → `fkDeadline = March 5 2026`, `agiDeadline = February 12 2026`
- `computeDeadlines("2026-12")` → `fkDeadline = February 5 2027`, `agiDeadline = January 12 2027` (JS month overflow handles December edge case)
- `deadlineBadge(20, false)` → `{ variant: "info", text: "20 days left" }`
- `deadlineBadge(10, false)` → `{ variant: "warning", text: "10 days left" }`
- `deadlineBadge(5, false)` → `{ variant: "destructive", text: "5 days left" }`
- `deadlineBadge(-3, false)` → `{ variant: "destructive", text: "Overdue" }`
- `deadlineBadge(10, true)` → `undefined`
- All 9 tests GREEN (plan mentioned 7; test file has 9 — all pass)

### Task 2: Monthly.tsx ProgressStepper enhancement

- Added `badge?: { variant: "info" | "warning" | "destructive"; text: string }` to `StepProps` interface (D-08)
- ProgressStepper renders `<Badge>` inline after sublabel when `step.badge` is set
- Deadline arithmetic inlined: `fkDeadline = new Date(rmYear, rmMon + 1, 5)`, `agiDeadline = new Date(rmYear, rmMon, 12)`
- `makeDeadlineBadge` helper mirrors server logic — returns badge or undefined
- Step 1 sublabel: `"3/4 reports approved"` pattern
- Step 2 sublabel: `"2/3 records approved"` pattern
- Step 3 sublabel: `"Due 5 Mar · 20 days left"` or `"Overdue by 3 days"` when past deadline
- Step 4 sublabel: `"Due 12 Feb · 20 days left"` or `"Overdue by 3 days"` when past deadline
- Steps 3 and 4 carry urgency badges: `info` (>14 days), `warning` (8–14 days), `destructive` (≤7 days or overdue)
- TypeScript compiles clean — 0 errors

## Task Commits

1. **Task 1: Implement deadlineUtils.ts** — `912d9cf`
2. **Task 2: Enhance Monthly.tsx ProgressStepper** — `d284f2d`

## Files Modified

- `server/src/lib/deadlineUtils.ts` — Working implementation of `computeDeadlines` and `deadlineBadge`
- `client/src/pages/Monthly.tsx` — StepProps badge field, ProgressStepper badge rendering, deadline arithmetic, approval sublabels, FK/AGI deadline sublabels and badges

## Decisions Made

- `makeDeadlineBadge` is inlined in the Monthly component rather than imported from server `deadlineUtils` — the client bundle is separate from the server lib; the same arithmetic is intentionally duplicated for clear colocation with the UI that uses it.
- Step 3 completion (`isComplete` for FK badge) uses `step1Complete` (all reports approved = FK forms step considered done by the stepper). Step 4 uses `step2Complete` (all payroll approved = AGI step done). This is consistent with existing `fkUnlocked` / `agiUnlocked` boolean logic.
- Sublabel for overdue steps uses `"Overdue by N days"` pattern rather than showing a negative count.

## Deviations from Plan

### Minor discrepancy: test count

The plan states "7 tests" but `deadlineUtils.test.ts` contains 9 tests (4 `computeDeadlines` tests + 5 `deadlineBadge` tests). All 9 pass GREEN. No action required — the plan's count was conservative.

No other deviations — plan executed exactly as written.

## Known Stubs

None — all data flows from computed values already present in Monthly.tsx. Deadline arithmetic uses live `Date.now()` and the guardian's selected `monthKey`.

## Threat Surface

No new network endpoints or trust boundaries introduced. Consistent with threat register:
- T-5-03-01: `daysLeft` computed client-side from `Date.now()` and `reportingMonth` — no user-supplied value (accepted)
- T-5-03-02: Deadline dates derived from selected month — no PII exposed (accepted)
- T-5-03-03: Badge variants are a closed TypeScript type enforced at compile time (accepted)

## Self-Check

---
## Self-Check: PASSED

- `server/src/lib/deadlineUtils.ts` — modified, committed `912d9cf`
- `client/src/pages/Monthly.tsx` — modified, committed `d284f2d`
- `npx vitest run src/lib/deadlineUtils.test.ts` — 9 passed, 0 failed
- `npx tsc --noEmit` in client/ — 0 errors
- Acceptance criteria verified:
  - `badge?:` in StepProps interface — line 91
  - `step.badge &&` in ProgressStepper — line 133
  - `fkDeadline` present — line 563
  - `agiDeadline` present — line 566
  - `fkDaysLeft` present — line 568
  - `makeDeadlineBadge` present — line 571
  - `reports approved` sublabel string — line 584
  - TypeScript clean — confirmed

---
*Phase: 05-scheduling-compliance-workflow*
*Completed: 2026-04-17*
