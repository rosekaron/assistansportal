---
phase: 02-leave-absence-foundation
plan: 01
subsystem: server-tests
tags: [tdd, wave-0, absence, leave, tests-only]
dependency_graph:
  requires: []
  provides:
    - "Failing test contracts for LEAV-01, LEAV-02, LEAV-03"
    - "absences.test.ts: 6 test cases (2 live auth, 4 skipped integration)"
    - "absences-billing.test.ts: 6 pure-function test cases"
    - "absences-balance.test.ts: 9 pure-function test cases"
  affects:
    - "server/src/routes/__tests__/ — new test files added"
tech_stack:
  added: []
  patterns:
    - "TDD Wave 0: import-failure RED state (no try-catch, unconditional imports)"
    - "Integration tests marked .skip with re-enable comment for Wave 2"
    - "Inline type aliases in test files (no shared import from non-existent module)"
key_files:
  created:
    - server/src/routes/__tests__/absences.test.ts
    - server/src/routes/__tests__/absences-billing.test.ts
    - server/src/routes/__tests__/absences-balance.test.ts
  modified: []
decisions:
  - "Auth tests (401/403) kept live (not skipped) so they run once route exists"
  - "Integration DB tests marked .skip with clear Wave 2 re-enable comment"
  - "Inline type aliases used instead of importing from non-existent absence-utils"
  - "vabBalance cap test uses single 40-day absence (Jan 1 - Feb 9) for clarity"
metrics:
  duration: "12 minutes"
  completed: "2026-04-06"
  tasks_total: 3
  tasks_completed: 3
  files_created: 3
  files_modified: 0
---

# Phase 02 Plan 01: Wave 0 Test Stubs Summary

**One-liner:** Three failing test files establishing the TDD contract for absence CRUD, FK billing exclusion, and VAB/sick balance computation — all RED by unconditional import of non-existent modules.

---

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | LEAV-01 absence CRUD test stubs | 81eb64a | server/src/routes/__tests__/absences.test.ts |
| 2 | LEAV-02 billing exclusion test stubs | dab0db1 | server/src/routes/__tests__/absences-billing.test.ts |
| 3 | LEAV-03 VAB balance and sick YTD stubs | 73c9e41 | server/src/routes/__tests__/absences-balance.test.ts |

---

## Verification Result

```
Test Files  3 failed | 3 passed (6)
     Tests  17 passed (17)
```

- 3 new files: FAIL (RED) — expected; missing module imports enforce Wave 0 contract
- 3 existing files: PASS (GREEN) — role-enforcement, pdf, env unchanged
- 17 existing tests: all passing — no regressions

---

## Test Contract Established

### absences.test.ts (LEAV-01)

- POST /api/absences returns 201 with correct fields (skip, needs DB)
- POST /api/absences invalid absenceType returns 400 (skip, needs DB)
- POST /api/absences auto-cancels overlapping approved entries (skip, needs DB)
- DELETE /api/absences/:id returns { ok: true } (skip, needs DB)
- Unauthenticated request returns 401 (live — runs once route exists)
- Assistant token blocked with 403 (live — runs once route exists)

### absences-billing.test.ts (LEAV-02)

- Empty absences returns all entries
- Entry within absence range is excluded
- Entry outside absence range is kept
- null assistantId absence excludes all assistants
- Specific assistantId absence excludes only that assistant
- Cross-month boundary absence excludes correct entries

### absences-balance.test.ts (LEAV-03)

- vabBalance: 120 when no VAB
- vabBalance: 115 after 5-day VAB
- vabBalance: 117 for cross-year absence (3 days in 2026)
- vabBalance: 80 after 40-day absence
- vabBalance: ignores other assistant's absences
- sickYtd: 0 when no sick absences
- sickYtd: 3 after 3-day sjukfrånvaro
- sickYtd: cross-year clipping to target year
- sickYtd: ignores vab and semester types

---

## Deviations from Plan

None — plan executed exactly as written. All three files use unconditional imports for RED state. Integration tests skipped with explicit Wave 2 re-enable comments. Type aliases inlined in test files as specified.

---

## Known Stubs

None. This plan creates test-only files. No production code stubs exist.

---

## Threat Flags

None. Wave 0 creates only test files with synthetic fixture data. JWT_SECRET is sourced from process.env (set via vitest.config.ts), not hardcoded.

---

## Self-Check: PASSED

| Item | Status |
|------|--------|
| server/src/routes/__tests__/absences.test.ts | FOUND |
| server/src/routes/__tests__/absences-billing.test.ts | FOUND |
| server/src/routes/__tests__/absences-balance.test.ts | FOUND |
| .planning/phases/02-leave-absence-foundation/02-01-SUMMARY.md | FOUND |
| Commit 81eb64a (LEAV-01 stubs) | FOUND |
| Commit dab0db1 (LEAV-02 stubs) | FOUND |
| Commit 73c9e41 (LEAV-03 stubs) | FOUND |
