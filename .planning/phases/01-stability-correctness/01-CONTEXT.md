# Phase 1: Stability & Correctness - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Fix known security, calculation, and type-consistency bugs in the existing codebase before any feature work begins. This phase delivers:

1. Server-side role enforcement — assistants cannot call guardian-only endpoints
2. FK 3057 date calculation — correct last day of reporting month, not hardcoded day 31
3. Configurable FK and tax rates — moved from hardcoded source to env vars
4. camelCase type consistency — client accesses API fields by correct names, backed by TypeScript types
5. Security hardening — dev endpoint gated, JWT startup validation, error sanitization

This phase does NOT add new user-visible capabilities. It stabilises what exists.

</domain>

<decisions>
## Implementation Decisions

### D-01: Test Framework Setup
- Install **vitest + supertest + @testing-library/react + @vitest/coverage-v8** across both workspaces (server and client)
- Add `test` and `test:coverage` npm scripts to both `server/package.json` and `client/package.json`
- Test files co-located in `__tests__/` folders next to source: `server/src/routes/__tests__/`, `client/src/lib/__tests__/`
- **Phase 1 test scope:** Regression tests covering the 4 STAB fixes only — role middleware, date calculation, rate env-var loading, camelCase field access
- No coverage threshold enforced in Phase 1 — any coverage is better than zero; threshold added in a later phase
- Full route coverage (all 9 route files, ~50 endpoints) is deferred — see Deferred Ideas

### D-02: Configurable Rates (STAB-03)
- FK hourly rate (334 SEK) and employer tax rate (31.42%) moved from hardcoded source code to **server-side env vars**: `FK_HOURLY_RATE` and `EMPLOYER_TAX_RATE`
- Server reads these at startup; a server restart is required to change them — the "no code deploy" requirement (STAB-03) is intentionally relaxed for now
- The existing DB `settings` table is **not** used for rates in Phase 1
- Settings UI for rate configuration is deferred to the B2B/multi-country expansion milestone — see Deferred Ideas
- Both vars must have documented fallback defaults in `.env.sample`

### D-03: Dev Endpoint & JWT Hardening
- `/api/auth/dev-verify` gated behind `NODE_ENV !== 'production'` — returns `404` in production, remains available for local development
- `devVerifyToken` stripped from the register response body when `NODE_ENV === 'production'`
- Real email verification flow works end-to-end; Nodemailer is mocked in tests to capture the verification token without sending real email
- **JWT startup guard:** server throws a fatal startup error if `JWT_SECRET` env var is absent or equals the literal string `"dev_secret"` — process exits immediately, no silent fallback

### D-04: Role Enforcement Breadth (STAB-01)
- Apply `requireGuardian` middleware to **all guardian-facing routes**: entries, assistants, profile, costs, pdf, slots, blocked, invites, settings, gcal
- Apply `requireAssistant` (or equivalent scope check) to **all assistant self-service routes**: `/api/assistant/*`
- Replace **all 25+ raw catch blocks** across every route file with sanitised error responses: return `{ error: "Internal server error" }` in production; log the actual error server-side only
- The existing `requireGuardian` and `requireAssistant` functions in `server/src/middleware/auth.ts` are used as-is — no changes to the middleware logic itself

### D-05: camelCase Type Consistency (STAB-04)
- Update client code to access API response fields using **camelCase** (`reqStatus`, `repStatus`, `startTime`, `endTime`) — remove all snake_case field access (`req_status`, `rep_status`, `start_time`, `end_time`)
- Replace the loose `type Entry = Record<string, string | number | null | undefined>` in `client/src/lib/api.ts` with a **proper TypeScript interface** derived from Drizzle's `$inferSelect` types (exported from `server/src/db/schema.ts` and mirrored as a shared type or duplicated in the client)
- All pages that access entry fields (primarily `Hours.tsx`) are updated to use camelCase
- TypeScript `strict: true` is already enabled — the compiler enforces correct field access after types are tightened

### Claude's Discretion
- Test helper structure (factories, fixtures, seed utilities) — Claude chooses appropriate patterns matching the existing Drizzle + Express setup
- Exact env var validation logic at startup (single check function, inline checks, or a `validateEnv()` utility) — Claude decides
- Error logging format in catch blocks (console.error, structured log object) — Claude decides; must not expose internals to API callers
- Whether to use a shared type package or duplicate the Drizzle-inferred types on the client — Claude chooses the simpler approach given the monorepo has no shared workspace currently

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` — STAB-01, STAB-02, STAB-03, STAB-04 definitions
- `.planning/PROJECT.md` — constraints (TypeScript throughout, no stack changes) and active stability items

### Codebase Analysis
- `.planning/codebase/ARCHITECTURE.md` — middleware layer, route module pattern, data flow
- `.planning/codebase/CONCERNS.md` — detailed per-file security findings with line numbers
- `.planning/codebase/CONVENTIONS.md` — naming patterns, TypeScript style, error handling conventions
- `.planning/codebase/TESTING.md` — current test state (zero), recommended stack (vitest + supertest), suggested file locations

### Key Source Files (read before touching)
- `server/src/middleware/auth.ts` — `requireAuth`, `requireGuardian`, `requireAssistant` definitions
- `server/src/routes/auth.ts` — dev-verify endpoint (line 69–82), JWT secret usage (line 12)
- `server/src/routes/pdf.ts` — FK 3057 date calculation (hardcoded day 31)
- `client/src/pages/Reports.tsx` — hardcoded FK rate (334 SEK) and tax rate (31.42%)
- `client/src/pages/Hours.tsx` — snake_case field access (req_status, start_time, etc.)
- `client/src/lib/api.ts` — loose `Entry` type definition
- `server/src/db/schema.ts` — Drizzle schema with camelCase JS keys / snake_case DB columns

</canonical_refs>

<specifics>
## Specific Implementation Notes

- `requireGuardian` and `requireAssistant` already exist and are correct — the fix is wiring, not rewriting
- The FK 3057 date bug: server uses hardcoded `31` for the last day — replace with `new Date(year, month, 0).getDate()` (JavaScript month is 0-indexed, day 0 = last day of previous month)
- Rate env vars: `FK_HOURLY_RATE=334` and `EMPLOYER_TAX_RATE=31.42` — use `parseFloat(process.env.FK_HOURLY_RATE ?? "334")` pattern
- JWT guard: add early in `server/src/index.ts` before Express setup — `if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev_secret") { console.error("FATAL: JWT_SECRET not set"); process.exit(1); }`
- camelCase fix scope confirmed from `Hours.tsx`: `req_status` → `reqStatus`, `rep_status` → `repStatus`, `start_time` → `startTime`, `end_time` → `endTime`, `assistant_id` → `assistantId`

</specifics>

<deferred>
## Deferred Ideas

### Full Route Test Coverage (Roadmap Backlog)
100% line coverage of all user-facing routes (~50 endpoints across 9 route files). Estimated ~16 days of engineering work. Deferred from Phase 1 to avoid scope creep. Includes:
- PDF routes (qpdf binary mocking, form fixtures) — high complexity
- GCal routes (Google OAuth token mocking) — high complexity
- All remaining CRUD routes (entries, assistants, profile, costs, misc, auth)
**Capture as:** Phase 1b or dedicated "Test Coverage" phase in backlog

### Configurable Rate Settings UI (Roadmap Backlog)
Guardian-editable FK hourly rate and employer tax rate from the Settings page, without requiring a server restart. Deferred until B2B / multi-country expansion milestone, when rate configuration becomes critical across multiple guardian accounts.
**Capture as:** Backlog item linked to B2B / European expansion milestone

### Multi-Country European Expansion (Roadmap Backlog)
User requested a review of user stories and roadmap for expansion to multiple European countries. This is a major new capability far beyond Phase 1 scope.
**Capture as:** Strategic backlog item for post-v1 roadmap

</deferred>

---

*Phase: 01-stability-correctness*
*Context gathered: 2026-04-06 via /gsd-discuss-phase*
