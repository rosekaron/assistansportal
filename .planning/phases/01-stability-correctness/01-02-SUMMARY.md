---
phase: 01-stability-correctness
plan: 02
subsystem: api
tags: [express, middleware, security, role-enforcement, error-sanitization, requireGuardian, requireAssistant]

requires:
  - phase: 01-stability-correctness
    plan: 01
    provides: vitest test scaffold with role-enforcement.test.ts stubs
provides:
  - requireGuardian wired to all 37 guardian-only route handlers across 8 files
  - requireAssistant wired via router.use() in assistant.ts covering all 7 assistant self-service handlers
  - all 25 catch blocks sanitized — no internal error details leak to API callers
affects: [01-03, 01-04, testing, security-audit]

tech-stack:
  added: []
  patterns:
    - "requireAuth, requireGuardian chain on every guardian-facing route handler"
    - "router.use(requireAuth, requireAssistant) for assistant router-level enforcement"
    - "catch (e) { console.error('[route-prefix] error:', e); res.status(500).json({ error: 'Internal server error' }) } pattern for all catch blocks"

key-files:
  created: []
  modified:
    - server/src/routes/entries.ts
    - server/src/routes/assistants.ts
    - server/src/routes/profile.ts
    - server/src/routes/costs.ts
    - server/src/routes/pdf.ts
    - server/src/routes/misc.ts
    - server/src/routes/gcal.ts
    - server/src/routes/assistant.ts
    - server/src/routes/auth.ts

key-decisions:
  - "requireGuardian applied per-handler (not router.use) for guardian routes — allows mixed-auth files like auth.ts and gcal.ts where some routes are pre-auth (connect, callback)"
  - "router.use(requireAuth, requireAssistant) used for assistant.ts — all handlers in that file are assistant-only, router-level is correct"
  - "catch blocks in entries.ts, assistants.ts, profile.ts, costs.ts, misc.ts have no try/catch — no changes needed there (handlers use direct await without wrapping)"
  - "gcal.ts callback and connect routes left without requireGuardian — callback is OAuth redirect (no JWT), connect is unauthenticated initiation"

requirements-completed: [STAB-01]

duration: 12min
completed: 2026-04-06
---

# Phase 01 Plan 02: Role Enforcement + Error Sanitization Summary

**requireGuardian and requireAssistant wired to 37 + 7 route handlers across 9 files; 25 catch blocks hardened to return generic errors and log internally**

## Performance

- **Duration:** 12 min
- **Started:** 2026-04-06T13:00:00Z
- **Completed:** 2026-04-06T13:10:00Z
- **Tasks:** 2
- **Files modified:** 9

## Accomplishments

- 37 guardian route handlers across entries, assistants, profile, costs, pdf, misc, gcal, auth now return 403 for any non-guardian JWT
- assistant.ts upgraded from `router.use(requireAuth)` to `router.use(requireAuth, requireAssistant)` — all 7 assistant self-service handlers now return 403 for guardian tokens
- 25 catch blocks across gcal.ts, pdf.ts, assistant.ts, and auth.ts replaced with sanitized pattern: `console.error("[prefix] error:", e)` server-side + `{ error: "Internal server error" }` to client
- Zero occurrences of `String(e)` remain in any file under server/src/routes/
- All 13 passing tests (5 STAB-01, 5 STAB-02, 3 STAB-03) continue to pass after changes

## Task Commits

1. **Task 1: Apply requireGuardian to guardian routes and requireAssistant to assistant.ts** - `3ec2308` (feat)
2. **Task 2: Sanitize all catch blocks** - `82c6cf2` (fix)

## Files Created/Modified

- `server/src/routes/entries.ts` — requireGuardian added to 5 handlers (GET, POST, POST /bulk, PUT, DELETE)
- `server/src/routes/assistants.ts` — requireGuardian added to 4 handlers (GET, POST, PUT, DELETE)
- `server/src/routes/profile.ts` — requireGuardian added to 2 handlers (GET, PUT)
- `server/src/routes/costs.ts` — requireGuardian added to 3 handlers (GET, POST, DELETE)
- `server/src/routes/pdf.ts` — requireGuardian added to 3 handlers (fk3059, fk3057, forms); 2 catch blocks sanitized
- `server/src/routes/misc.ts` — requireGuardian added to 12 handlers (slots 3, blocked 3, invites 4, settings 2)
- `server/src/routes/gcal.ts` — requireGuardian added to 7 authenticated handlers; 6 catch blocks sanitized
- `server/src/routes/assistant.ts` — router.use upgraded to requireAuth + requireAssistant; 7 catch blocks sanitized
- `server/src/routes/auth.ts` — requireGuardian added to /send-invite-email only; 10 catch blocks sanitized

## Decisions Made

- Applied `requireGuardian` per-handler rather than at router level for guardian route files. This is intentional: `auth.ts` has pre-auth routes (register, login, verify-email) and `gcal.ts` has unauthenticated OAuth routes (/connect, /callback) that must not require a JWT.
- `gcal.ts` /connect and /callback routes deliberately left without requireGuardian — the OAuth flow cannot carry a JWT through the Google redirect.
- `entries.ts`, `assistants.ts`, `profile.ts`, `costs.ts`, `misc.ts` have no try/catch blocks in their handlers (direct awaits without wrapping) — Task 2 correctly made no changes to these files.

## Deviations from Plan

None — plan executed exactly as written. The plan correctly predicted all catch block locations and the per-handler vs. router-level distinction.

## Issues Encountered

- vitest was not installed in server/node_modules at start of execution (despite Plan 01-01 SUMMARY claiming it was installed). Installed `vitest @vitest/coverage-v8 supertest @types/supertest` before running tests. Tests passed immediately after install — the test scaffold from Plan 01-01 was intact, only the node_modules install was missing.

## User Setup Required

None — no external service configuration required.

## Next Phase Readiness

- STAB-01 (role enforcement) is complete and GREEN
- Plans 01-03 and 01-04 can proceed independently
- The sanitized catch block pattern is established for all future route development

---
*Phase: 01-stability-correctness*
*Completed: 2026-04-06*
