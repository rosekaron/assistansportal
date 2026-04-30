<!-- generated-by: gsd-doc-writer -->
# Testing

This document describes the test setup, commands, and conventions for the Assistansportal project.

## Test framework and setup

The project uses two test frameworks:

- **Vitest** (`^4.1.2`) — used for both the server (unit/integration) and the client (component/unit)
- **Playwright** (`^1.59.1`) — used for end-to-end tests in the client

**Server** additional tooling:
- `supertest` (`^7.2.2`) — HTTP integration test helper for Express routes
- `@vitest/coverage-v8` (`^4.1.2`) — V8-based code coverage

**Client** additional tooling:
- `@testing-library/react` (`^16.3.2`) and `@testing-library/user-event` (`^14.6.1`) — React component testing
- `@testing-library/jest-dom` (`^6.9.1`) — custom DOM matchers (imported via `client/src/test-setup.ts`)
- `jsdom` (`^24.1.3`) — browser environment simulation for Vitest
- `@vitest/coverage-v8` (`^4.1.2`) — V8-based code coverage

No additional setup step is required beyond installing dependencies (`npm install` in the appropriate workspace). Server tests inject all required environment variables directly through `vitest.config.ts` — no `.env` file is needed for tests.

## Running tests

### Server unit tests

Run from the `server/` directory, or via the workspace flag from the project root:

```bash
# From the server/ directory
cd server && npm test

# Or directly
npm run test --prefix server
```

With coverage:

```bash
npm run test:coverage --prefix server
```

### Client unit and component tests

Run from the `client/` directory:

```bash
# From the client/ directory
cd client && npm test

# Or directly
npm run test --prefix client
```

With coverage:

```bash
npm run test:coverage --prefix client
```

### End-to-end tests (Playwright)

E2E tests require the client dev server to be running (or Playwright will start it automatically via `webServer` config):

```bash
# From the client/ directory
npm run test:e2e --prefix client
```

Playwright is configured to target `http://localhost:5173` and will start `npm run dev` automatically if no server is already listening at that URL. No real Google credentials or database connection are needed — all API calls are mocked with `page.route()`.

## Writing new tests

### Server tests

- **Location:** `server/src/lib/` alongside the module under test
- **Naming convention:** `<module-name>.test.ts` (e.g., `deadlineUtils.test.ts`, `payroll-utils.test.ts`)
- **Import style:** `import { describe, it, expect } from "vitest";`
- **Pattern:** Vitest globals are enabled — `describe`, `it`, `expect`, `vi` are available without explicit imports, though explicit imports are used in existing tests.
- **Environment:** `node` (no DOM)
- **Environment variables:** Injected automatically by `server/vitest.config.ts`. Test values are:
  - `JWT_SECRET`: `test-secret-for-vitest`
  - `DATABASE_URL`: `postgres://test:test@localhost:5432/test`
  - `FK_HOURLY_RATE`: `334`
  - `EMPLOYER_TAX_RATE`: `0.3142`

### Client unit and component tests

- **Location:** `client/src/**/__tests__/` subdirectory relative to the module under test
- **Naming convention:** `<module-name>.test.ts` or `<module-name>.test.tsx`
- **Environment:** `jsdom`
- **Global setup file:** `client/src/test-setup.ts` — imports `@testing-library/jest-dom` to activate custom DOM matchers (`toBeInTheDocument`, etc.)
- **Path alias:** `@` resolves to `client/src/` (configured in `vitest.config.ts`)

### E2E tests (Playwright)

- **Location:** `client/e2e/`
- **Naming convention:** `<feature>.spec.ts`
- **Auth pattern:** Inject a fake JWT into `localStorage["auth"]` (Zustand persist shape) and `localStorage["token"]` before page load using `page.addInitScript()`. See `gcal.spec.ts` for the `injectGuardianToken` / `injectAssistantToken` helpers.
- **API mocking pattern:** Use `page.route("**/api/<path>", ...)` to mock all server calls. Tests must not require a live backend or database.

## Coverage requirements

No coverage threshold is configured in either `server/vitest.config.ts` or `client/vitest.config.ts`. Coverage reports are generated on demand with the `test:coverage` script and output to the default V8 coverage directory.

To view a coverage report:

```bash
# Server
npm run test:coverage --prefix server

# Client
npm run test:coverage --prefix client
```

## CI integration

No GitHub Actions workflow is present in the repository. Tests are run locally by developers. There is no automated CI pipeline enforcing test passage on pull requests at this time.

<!-- VERIFY: CI/CD pipeline status — confirm whether tests are run in an external CI system not reflected in the repository -->
