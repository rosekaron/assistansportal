# Testing Patterns

**Analysis Date:** 2026-04-06

## Test Framework

**Runner:**
- None detected. No test runner is installed or configured.
- No `jest.config.*`, `vitest.config.*`, or similar config files exist anywhere in the repo.
- Neither `client/package.json` nor `server/package.json` include any test dependencies or test scripts.

**Assertion Library:**
- None installed.

**Run Commands:**
```bash
# No test commands available
# client/package.json scripts: dev, build, preview
# server/package.json scripts: dev, build, start, db:push, db:studio, db:generate
```

## Test File Organization

**Location:**
- No test files exist in the codebase. No `*.test.*` or `*.spec.*` files found anywhere.

**Naming:**
- Not applicable — no tests exist.

**Structure:**
- Not applicable.

## Test Structure

**Suite Organization:**
- Not applicable — no tests exist.

**Patterns:**
- Not applicable.

## Mocking

**Framework:** None installed.

**What currently lacks mock infrastructure:**
- Database layer: `server/src/db/index.ts` exports `db` directly with no abstraction for mocking
- Email lib: `server/src/lib/email.ts` directly instantiates nodemailer transporter at module load time
- Auth middleware: `server/src/middleware/auth.ts` reads `process.env.JWT_SECRET` directly
- API client: `client/src/lib/api.ts` creates axios instance at module load time with localStorage access

## Fixtures and Factories

**Test Data:**
- None. No fixture files, factory functions, or seed utilities for testing exist.
- `server/src/db/index.ts` has a `seedDefaults()` function for development bootstrapping, not testing.

**Location:**
- Not applicable.

## Coverage

**Requirements:** None enforced — no coverage tooling configured.

**View Coverage:**
```bash
# No coverage commands available
```

## Test Types

**Unit Tests:**
- None exist. Candidates for unit testing:
  - `client/src/lib/utils.ts` — pure functions `formatDate`, `getWeekDates`, `toYMD`, `hhmm`, `cn`
  - `client/src/lib/activities.ts` — `activityById` lookup function
  - `server/src/lib/id.ts` — `newId` prefix+hex generation
  - Auth middleware guard functions in `server/src/middleware/auth.ts`

**Integration Tests:**
- None exist. Candidates:
  - Server routes (all 9 route files under `server/src/routes/`) against a test database
  - Auth flow: register → verify → login → protected route

**E2E Tests:**
- Framework: Not installed. No Playwright, Cypress, or similar tooling detected.

## Recommendations for Adding Tests

**Suggested stack based on existing tech:**
- Server: Vitest + supertest for route integration tests (matches TypeScript ESM setup)
- Client: Vitest + @testing-library/react for component and utility tests (matches Vite build)
- Install: `vitest`, `@vitest/coverage-v8`, `supertest`, `@testing-library/react`, `@testing-library/user-event`

**Where to place tests:**
- Client unit/component tests: co-located as `src/lib/utils.test.ts`, `src/components/ui/button.test.tsx`
- Server route integration tests: `server/src/routes/__tests__/auth.test.ts`
- Shared test helpers: `server/src/__tests__/helpers.ts`

**Minimum viable test targets:**
1. `client/src/lib/utils.ts` — all 5 pure functions are zero-dependency and trivially testable
2. `server/src/middleware/auth.ts` — `requireAuth`, `requireGuardian`, `requireAssistant` are simple guard functions
3. Auth routes in `server/src/routes/auth.ts` — login, register, reset-password with mocked DB

---

*Testing analysis: 2026-04-06*
