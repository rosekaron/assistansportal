---
phase: 01-stability-correctness
plan: 03
subsystem: api
tags: [express, jwt, security, env-vars, pdf, date-calculation, fk3057, rates]

requires:
  - phase: 01-stability-correctness
    plan: 02
    provides: requireGuardian wired to misc.ts and all guardian routes

provides:
  - FK3057 handler uses correct daysInMonth (new Date(parseInt(year), parseInt(mm), 0).getDate()) for month-end boundary
  - JWT startup guard in index.ts calls process.exit(1) on missing or insecure JWT_SECRET
  - /api/auth/dev-verify returns 404 in NODE_ENV=production
  - devVerifyToken stripped from register response in NODE_ENV=production
  - GET /api/rates returns { fkHourlyRate, employerTaxRate } read from env vars — protected by requireGuardian
  - .env.sample documents all required env vars with defaults
  - STAB-02 (5 tests) and STAB-03 (7 tests, previously 3+2todo) all pass GREEN

affects: [client, 01-04, reporting, security-audit]

tech-stack:
  added: []
  patterns:
    - "daysInMonth = new Date(parseInt(year), parseInt(mm), 0).getDate() for last-day-of-month calculation"
    - "parseFloat(process.env.VAR ?? 'default') for env-var rate constants at module top level"
    - "...(process.env.NODE_ENV !== 'production' ? { devVerifyToken: token } : {}) for conditional dev-only response fields"
    - "if (process.env.NODE_ENV === 'production') return res.status(404) for dev-only endpoint gating"
    - "Startup guard: process.exit(1) before Express setup if JWT_SECRET is missing or equals 'dev_secret'"

key-files:
  created: []
  modified:
    - server/src/routes/pdf.ts
    - server/src/routes/auth.ts
    - server/src/routes/misc.ts
    - server/src/index.ts
    - server/src/routes/__tests__/env.test.ts
    - .env.sample

key-decisions:
  - "FK3057 fix mirrors FK3059 exactly — same daysInMonth pattern, same padStart(2,'0') output"
  - "JWT startup guard placed after dotenv.config() and before Express app setup to catch env issues before any routes mount"
  - "env.test.ts uses a minimal testApp mirror of /api/rates rather than importing misc.ts — avoids DB connection requirement in unit tests"
  - "4 STAB-03 /api/rates integration tests replace 2 .todo stubs: guardian passes, assistant 403, unauthenticated 401, values match env vars"

requirements-completed: [STAB-02, STAB-03]

duration: 8min
completed: 2026-04-06
---

# Phase 01 Plan 03: FK3057 Date Fix + JWT Hardening + /api/rates Summary

**FK3057 month-end date corrected to daysInMonth; JWT startup guard exits on weak secret; /api/rates exposes env-var-sourced FK and tax rates behind requireGuardian**

## Performance

- **Duration:** 8 min
- **Started:** 2026-04-06T13:10:00Z
- **Completed:** 2026-04-06T13:18:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- FK3057 PDF route now computes last day of month correctly for February (28/29), April (30), and all other months — `lte(entries.date, \`${year}-${mm}-31\`)` replaced with `daysInMonth` calculation on line 209
- Server refuses to start if `JWT_SECRET` is absent or equals `"dev_secret"` — `process.exit(1)` fires before Express setup, making misconfigured deployments fail loudly
- `/api/auth/dev-verify` returns 404 in production; `devVerifyToken` is stripped from register response in production — dev workflow preserved in non-production environments
- `GET /api/rates` added to misc.ts, reads `FK_HOURLY_RATE` (334 SEK) and `EMPLOYER_TAX_RATE` (0.3142) from env vars, protected by `requireAuth + requireGuardian`
- All 17 tests pass GREEN: 5 STAB-01 + 5 STAB-02 + 7 STAB-03 (4 new /api/rates integration tests + 3 existing env var unit tests)

## Task Commits

1. **Task 1: Fix FK 3057 date calculation** - `963860d` (fix)
2. **Task 2: JWT startup guard + dev-verify gate + /api/rates + env vars** - `260892f` (feat)

## Files Created/Modified

- `server/src/routes/pdf.ts` — FK3057 handler: added `daysInMonth` constant on line 209, replaced hardcoded `31` in `lte()` on line 214
- `server/src/routes/auth.ts` — dev-verify gated behind `NODE_ENV === "production"` check; register response uses spread conditional for `devVerifyToken`
- `server/src/routes/misc.ts` — FK_HOURLY_RATE and EMPLOYER_TAX_RATE constants from env vars; GET /api/rates route added before `export default`
- `server/src/index.ts` — JWT startup guard added on lines 7-10, after `dotenv.config()`, before Express app creation
- `server/src/routes/__tests__/env.test.ts` — 2 .todo stubs replaced with 4 real STAB-03 integration tests for /api/rates (guardian pass, assistant 403, unauth 401, value check)
- `.env.sample` — appended JWT_SECRET, FK_HOURLY_RATE, EMPLOYER_TAX_RATE, NODE_ENV, PORT, CLIENT_URL with documented defaults

## Decisions Made

- Used a minimal `testApp` mirror in env.test.ts rather than importing misc.ts directly — avoids triggering a DB connection in unit tests. The mirror replicates the exact same middleware chain (requireAuth, requireGuardian) and response shape.
- FK3057 fix placed immediately after `const mm = month.padStart(2, "0")` to mirror FK3059's structure exactly, minimizing cognitive diff between the two handlers.

## Deviations from Plan

None — plan executed exactly as written. The plan correctly specified:
- The exact location of the FK3057 bug (line 213)
- That env.test.ts .todo stubs should be replaced with real tests
- The minimal testApp pattern for avoiding DB connections (via the role-enforcement.test.ts precedent)

## Issues Encountered

None. All tests passed on first run. The vitest.config.ts already had JWT_SECRET and rate env vars set for the test environment, so the STAB-03 env var unit tests passed immediately.

## User Setup Required

**New env vars required:** Before running the server, copy `.env.sample` and set:
- `JWT_SECRET` — replace the placeholder with a long random string (minimum 32 chars, e.g., `openssl rand -hex 32`)
- `FK_HOURLY_RATE` — defaults to 334 (SEK per hour, as of 2025)
- `EMPLOYER_TAX_RATE` — defaults to 0.3142 (31.42% arbetsgivaravgifter)

The server will now refuse to start with a fatal error if `JWT_SECRET` is missing or equals `"dev_secret"`.

## Next Phase Readiness

- STAB-02 (FK3057 date bug) and STAB-03 (configurable rates + security hardening) are complete
- Plan 01-04 (camelCase type consistency for Hours.tsx) can proceed independently
- The /api/rates endpoint is ready for the client to consume — Reports.tsx hardcoded constants can now be replaced with a fetch to `/api/rates`

---
*Phase: 01-stability-correctness*
*Completed: 2026-04-06*
