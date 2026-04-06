# Phase 1: Stability & Correctness — Discussion Log

**Session:** 2026-04-06
**Command:** /gsd-discuss-phase 1
**Areas discussed:** Test strategy, Settings UI for configurable rates, Dev endpoint removal, Role enforcement breadth, camelCase type consistency

---

## Area: Test Strategy

**Q: How much test infrastructure to establish in Phase 1?**
Options presented: Full setup + Phase 1 tests / Minimal: framework only / Defer testing
Selected: **Full setup + Phase 1 tests**
> Install vitest + supertest + @testing-library/react + @vitest/coverage-v8. Write regression tests for all 4 STAB fixes.

**Q: Where should server tests live, and do you want a coverage threshold enforced?**
Options presented: Co-located __tests__ folders + no threshold / Separate top-level tests/ + 70% threshold / Co-located + 50% threshold
Selected (free text): **100% coverage of all user-facing functionalities**

**Follow-up (plain text):** Clarified scope — A) 100% of Phase 1 fixes only, B) 100% of all existing guardian + assistant routes (~50 endpoints), C) other.
Selected: **B — all guardian-facing and assistant-facing routes**

**Effort breakdown presented:**
- Framework + test DB harness + JWT fixtures: ~2 days
- Low-complexity routes: ~4 days
- Auth routes: ~3 days
- Assistant routes: ~2 days
- PDF routes (qpdf mocking): ~3 days
- GCal routes (OAuth mocking): ~2 days
- Total: ~16 days (6× scope expansion from original Phase 1 intent)

**Resolution:** Proceed with split approach — Phase 1 covers fixes + framework + regression tests for fixed code. Full route coverage deferred as backlog item.

---

## Area: Settings UI for Configurable Rates

**Q: Where should FK hourly rate and employer tax rate live after Phase 1?**
Options presented: New 'Payroll Rates' section in Settings / Inline editable in Reports page / Server-side env vars only
Selected: **Server-side env vars only**

**Q (conflict resolution): STAB-03 requires 'no redeploy' — env vars require restart. Override?**
Options presented: Keep env vars, drop requirement / Env var default + Settings UI override / Settings UI only
Selected (free text): **Keep env vars with deploy requirement; add roadmap item for configurable rates when planning B2B/multi-country**

---

## Area: Dev Endpoint Removal

**Q: How to handle /api/auth/dev-verify?**
Options presented: Gate behind NODE_ENV !== 'production' / Remove entirely
Selected: **Gate behind NODE_ENV** (via free-text follow-up requesting real email verification for E2E testing)

User elaborated: wanted real email verification testable end-to-end. Resolution: Nodemailer mocked in tests to capture token; dev-verify gated in production; real flow works.

**Q: JWT fallback to 'dev_secret' — fix in Phase 1?**
Options presented: Throw fatal startup error / Warn but continue / Defer
Selected: **Throw fatal startup error if missing or equals 'dev_secret'**

---

## Area: Role Enforcement Breadth

**Q: How far should Phase 1 go with server hardening?**
Options presented: Guardian + assistant + error sanitization / Guardian only / Guardian + assistant (no sanitization)
Selected: **Guardian routes + assistant routes + raw error sanitization**
> Apply requireGuardian to all guardian routes, requireAssistant to assistant routes, replace all 25+ raw catch blocks with sanitised responses.

---

## Area: camelCase Type Consistency (STAB-04)

**Q: Approach for fixing snake_case vs camelCase inconsistency?**
Options presented: Fix client to use camelCase + proper TypeScript types / Server-side snake_case serialization / Leave as-is, just add types
Selected: **Fix client to use camelCase + add proper TypeScript types**
> Update Hours.tsx and other pages; replace loose Record<string,any> Entry type with typed interface from Drizzle $inferSelect.

---

## Deferred Ideas Captured

1. **Full route test coverage** — ~50 endpoints, ~16 days. Deferred to Phase 1b or dedicated test phase.
2. **Configurable rate Settings UI** — deferred to B2B/multi-country expansion milestone.
3. **Multi-country European expansion** — strategic backlog, post-v1 roadmap.
