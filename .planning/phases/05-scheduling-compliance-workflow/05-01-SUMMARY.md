---
phase: 05-scheduling-compliance-workflow
plan: 01
subsystem: testing
tags: [vitest, tdd, cron, node-cron, compliance, deadline, reminder]

# Dependency graph
requires: []
provides:
  - "deadlineUtils.ts skeleton: computeDeadlines and deadlineBadge exported, throw Not implemented"
  - "deadlineUtils.test.ts: 9 failing test cases covering FK/AGI deadlines and badge variants"
  - "reminderCron.ts skeleton: shouldSendReminder, buildPendingSteps, startReminderCron exported"
  - "reminderCron.test.ts: 8 failing test cases covering day-match guard and pending step detection"
  - "node-cron@4.2.1 installed as dependency"
affects: [05-02, 05-03, 05-04]

# Tech tracking
tech-stack:
  added: ["node-cron@4.2.1", "@types/node-cron@3.0.11"]
  patterns:
    - "TDD RED phase: skeleton exports throw 'Not implemented'; tests fail as intended RED baseline"
    - "Pure function extraction: shouldSendReminder and buildPendingSteps are testable without cron scheduler"
    - "Dynamic import for email module in cron handler — avoids compile-time coupling to unimplemented sendComplianceReminderEmail"

key-files:
  created:
    - "server/src/lib/deadlineUtils.ts"
    - "server/src/lib/deadlineUtils.test.ts"
    - "server/src/lib/reminderCron.ts"
    - "server/src/lib/reminderCron.test.ts"
  modified:
    - "server/package.json (node-cron added)"
    - "server/package-lock.json"

key-decisions:
  - "Used `as any` cast on dynamic email import in reminderCron.ts to avoid compile-time failure for sendComplianceReminderEmail (not yet in email.ts; added in later plan)"
  - "startReminderCron not covered by unit tests — starts live cron scheduler; pure logic extracted to shouldSendReminder and buildPendingSteps for testability"
  - "reminderDay upper bound = 28 (not 31) to ensure reminder fires every month including February"

patterns-established:
  - "Compliance reminder pure logic: shouldSendReminder(todayDay, reminderDay) — testable without DB"
  - "Deadline arithmetic: computeDeadlines(YYYY-MM) returns typed Deadlines struct — no side effects"

requirements-completed: [COMP-01, COMP-02]

# Metrics
duration: 15min
completed: 2026-04-17
---

# Phase 05 Plan 01: Scheduling Compliance Workflow — TDD Scaffold Summary

**Test scaffolds for FK/AGI deadline arithmetic (COMP-01) and cron reminder logic (COMP-02) — 17 failing RED tests establish green targets for Wave 1 implementation plans**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-17T19:07:00Z
- **Completed:** 2026-04-17T19:10:00Z
- **Tasks:** 2
- **Files modified:** 4 created, 2 modified (package.json, package-lock.json)

## Accomplishments

- Created `deadlineUtils.ts` skeleton with `computeDeadlines` and `deadlineBadge` exports — both throw "Not implemented"
- Created `deadlineUtils.test.ts` with 9 failing test cases: FK deadline (Jan → Mar 5), AGI deadline (Jan → Feb 12), December edge cases (FK → Feb 5 next year, AGI → Jan 12 next year), badge variants (info/warning/destructive), overdue, and completion guard
- Created `reminderCron.ts` skeleton with `shouldSendReminder`, `buildPendingSteps`, and `startReminderCron` exports — pure functions throw "Not implemented"
- Created `reminderCron.test.ts` with 8 failing test cases: day-match (true/false), invalid reminder days (0 and 29), buildPendingSteps with none/partial/all steps complete
- Installed `node-cron@4.2.1` and `@types/node-cron@3.0.11`
- Full vitest suite: 17 tests RED (new), 84 tests green (pre-existing), 12 skipped — no regression

## Task Commits

Each task was committed atomically:

1. **Task 1: Create deadlineUtils.ts skeleton and failing tests** - `3599b0c` (test)
2. **Task 2: Create reminderCron.ts skeleton and failing tests** - `d002714` (test)

## Files Created/Modified

- `server/src/lib/deadlineUtils.ts` — Skeleton: exports `computeDeadlines(reportingMonth)` and `deadlineBadge(daysLeft, isComplete)`, both throw "Not implemented"
- `server/src/lib/deadlineUtils.test.ts` — 9 RED test cases for COMP-01 deadline arithmetic
- `server/src/lib/reminderCron.ts` — Skeleton: exports `shouldSendReminder`, `buildPendingSteps`, `startReminderCron`; cron handler references pending `sendComplianceReminderEmail` via dynamic import
- `server/src/lib/reminderCron.test.ts` — 8 RED test cases for COMP-02 cron reminder logic
- `server/package.json` — node-cron and @types/node-cron added
- `server/package-lock.json` — updated lockfile

## Decisions Made

- `startReminderCron` is not unit tested because it registers a live cron scheduler. Pure logic is extracted to `shouldSendReminder` and `buildPendingSteps` for full testability.
- `sendComplianceReminderEmail` does not yet exist in `email.ts` (added in later plan). The cron handler uses `await import("./email") as any` to defer this resolution to runtime rather than break TypeScript compilation now.
- `reminderDay` upper bound capped at 28 — ensures the reminder fires every calendar month, including February (max 28 days in non-leap year).

## Deviations from Plan

None — plan executed exactly as written. The `as any` cast on the dynamic email import is a minor TypeScript workaround consistent with the plan's intent (skeleton, not implementation).

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `// TODO: query entries/payroll to build pending steps` | `server/src/lib/reminderCron.ts:60` | Intentional — stub in cron handler body; actual pending-step query implemented in Plan 04 per plan spec |

These stubs are in the skeleton body of `startReminderCron` which is not under test in this plan. They do not prevent the plan's goal (RED test baseline) from being achieved.

## Threat Surface

No new network endpoints or trust boundaries introduced. Threat mitigations T-5-W0-01 (reminderDay range guard) and T-5-W0-02 (no full email in logs) are structurally present in the skeleton:
- T-5-W0-01: `shouldSendReminder` signature established — range enforcement implemented in Wave 1
- T-5-W0-02: Log line in cron handler reads `"[cron] guardian_email not configured — skipping reminder"` — does not include the email value

## Issues Encountered

None.

## Next Phase Readiness

- Wave 1 (Plan 02): Implement `computeDeadlines` and `deadlineBadge` to turn 9 RED tests GREEN
- Wave 1 (Plan 03): Implement `shouldSendReminder` and `buildPendingSteps` to turn 8 RED tests GREEN
- Both source files compile cleanly — no TypeScript errors blocking Wave 1 work
- `startReminderCron` requires `sendComplianceReminderEmail` to be added to `email.ts` before Plan 04 integration

---
*Phase: 05-scheduling-compliance-workflow*
*Completed: 2026-04-17*
