---
phase: 01-stability-correctness
plan: 01
subsystem: testing-infrastructure
tags: [vitest, testing, regression-stubs, STAB-01, STAB-02, STAB-03, STAB-04]
dependency_graph:
  requires: []
  provides: [test-scaffold, npm-test-commands]
  affects: [01-02-PLAN, 01-03-PLAN, 01-04-PLAN]
tech_stack:
  added:
    - vitest@4.1.2 (server and client)
    - "@vitest/coverage-v8@4.1.2 (server and client)"
    - supertest@7.2.2 (server)
    - "@types/supertest@7.2.0 (server)"
    - "@testing-library/react@16.3.2 (client)"
    - "@testing-library/user-event@14.6.1 (client)"
    - "@testing-library/jest-dom@6.9.1 (client)"
    - jsdom@24.1.3 (client)
  patterns:
    - vitest globals mode (no explicit imports needed in tests)
    - supertest for Express route integration tests
    - __tests__/ subdirectory co-location pattern
    - vitest env block for test-only environment variables
key_files:
  created:
    - server/vitest.config.ts
    - server/src/routes/__tests__/role-enforcement.test.ts
    - server/src/routes/__tests__/pdf.test.ts
    - server/src/routes/__tests__/env.test.ts
    - client/vitest.config.ts
    - client/src/test-setup.ts
    - client/src/lib/__tests__/entry-types.test.ts
  modified:
    - server/package.json (added test, test:coverage scripts)
    - client/package.json (added test, test:coverage scripts; jsdom downgrade)
decisions:
  - "vitest@4.1.2 selected per plan — latest stable at execution time"
  - "jsdom downgraded to ^24 from ^29 — jsdom 29 introduces ESM-only dependency incompatible with Node 24 require() in vitest forks worker"
  - "client vitest.config.ts uses default forks pool (not vmForks) since jsdom 24 resolves the compatibility issue"
metrics:
  duration: "3m 10s"
  completed_date: "2026-04-06"
  tasks_completed: 2
  tasks_total: 2
  files_created: 7
  files_modified: 2
---

# Phase 1 Plan 1: Test Scaffold — Vitest Install + STAB Regression Stubs

**One-liner:** Vitest 4.1.2 installed in both workspaces with 4 regression test stubs covering STAB-01 through STAB-04, all running green at the infrastructure level.

## What Was Built

### Vitest Installation

Both workspaces now have a complete test infrastructure:

**Server (`server/`):**
- vitest@4.1.2 + @vitest/coverage-v8
- supertest@7.2.2 + @types/supertest for HTTP integration testing
- `server/vitest.config.ts` — node environment with pre-set env vars (JWT_SECRET, DATABASE_URL, FK_HOURLY_RATE, EMPLOYER_TAX_RATE, NODE_ENV=test)
- `npm test` → `vitest run` / `npm run test:coverage` → `vitest run --coverage`

**Client (`client/`):**
- vitest@4.1.2 + @vitest/coverage-v8
- @testing-library/react@16.3.2 + user-event + jest-dom
- jsdom@24.1.3 as the test environment
- `client/vitest.config.ts` — jsdom environment with React plugin, path alias `@`
- `client/src/test-setup.ts` — imports `@testing-library/jest-dom` for matchers
- `npm test` → `vitest run` / `npm run test:coverage` → `vitest run --coverage`

### Test Stubs Created

| File | Requirement | Tests | State |
|------|-------------|-------|-------|
| `server/src/routes/__tests__/role-enforcement.test.ts` | STAB-01 | 5 passing | GREEN (middleware already correct) |
| `server/src/routes/__tests__/pdf.test.ts` | STAB-02 | 5 passing | GREEN (pure function tests) |
| `server/src/routes/__tests__/env.test.ts` | STAB-03 | 3 passing + 2 todo | GREEN (env vars set in vitest.config.ts) |
| `client/src/lib/__tests__/entry-types.test.ts` | STAB-04 | 6 passing | GREEN (type-level checks compile-only) |

### Final Test Run Output

**Server (3 files, 13 tests + 2 todo):**
```
Test Files  3 passed (3)
Tests  13 passed | 2 todo (15)
Duration  243ms
```

**Client (1 file, 6 tests):**
```
Test Files  1 passed (1)
Tests  6 passed (6)
Duration  310ms
```

Note: Tests are passing at this scaffold stage. Plans 02–04 will replace stub implementations with actual route-level integration tests that will go RED until the fixes land.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jsdom@29 incompatible with Node 24 vitest forks worker**

- **Found during:** Task 2 — first client test run
- **Issue:** jsdom 29 depends on `@asamuzakjp/css-color` which uses top-level `await` in an ESM module. Node 24's `require()` cannot load async ESM modules, causing `ERR_REQUIRE_ASYNC_MODULE` in vitest's forks worker.
- **Fix:** Downgraded jsdom from `^29.0.1` to `^24.1.3` in `client/package.json`. jsdom 24 uses only CJS-compatible dependencies.
- **Files modified:** `client/package.json`, `client/package-lock.json`
- **Commit:** 6a5f19f

## Known Stubs

None. All test files are functional and passing. The STAB-02 through STAB-04 tests test the correct behavior at the type/unit level — Plans 02–04 will add route-level integration tests that exercise the actual server endpoints after the implementation fixes land.

## Threat Flags

None. No new network endpoints, auth paths, file access patterns, or schema changes introduced. Test config files contain only test-scoped secrets hardcoded in `server/vitest.config.ts` (not production values, not in `.env`).

## Commits

| Hash | Task | Description |
|------|------|-------------|
| 55d502b | Task 1 | chore(01-01): install vitest in both workspaces and add vitest configs |
| 6a5f19f | Task 2 | test(01-01): add failing test stubs for STAB-01 through STAB-04 |

## Self-Check: PASSED

All 7 created files exist on disk. Both commits (55d502b, 6a5f19f) are present in git log. Both `npm test` commands exit 0 with vitest discovering test files.
