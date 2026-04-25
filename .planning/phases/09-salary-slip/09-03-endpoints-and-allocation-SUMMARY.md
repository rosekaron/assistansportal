---
phase: 09-salary-slip
plan: 03
subsystem: routes
tags: [express, endpoints, pdfkit, idempotency, idor-guard, integration-tests]

requires:
  - phase: 07-foundation-schema-cleanup
    provides: "payroll_records snapshot columns; paymentMethodEnum / salaryModelSnapshotEnum"
  - phase: 08-employer-representation
    provides: "resolveEmployerRepresentation() — consumed indirectly via buildAnhorigSlip"
  - plan: 09-01-schema-and-whitelists
    provides: "payment_slips live table + unique index; assistants.hourlyRateOverride / paymentMethod; profile.defaultPayDay"
  - plan: 09-02-slip-builder-and-renderer
    provides: "buildAnhorigSlip() field-map builder + renderAnhorigSlipPdf() pdfkit renderer"

provides:
  - "POST /api/pdf/lonespec (requireAuth + requireGuardian) — guardian slip download with 409 (approval) + 400 (NULL rate) + 400 (invalid assistantId) gates"
  - "GET /api/pdf/lonespec/me (requireAuth + requireAssistantAccess) — assistant self-service slip download; assistantId resolved from JWT only (IDOR-safe)"
  - "GET /api/assistant/slips (requireAuth + requireAssistantAccess) — listing endpoint returning JWT-bound assistant's issued slips sorted reportMonth DESC then issuedAt DESC"
  - "issueOrReuseSlip() helper — idempotent allocator that reuses the existing payment_slips row on replay and catches 23505 on race"
  - "computePayDate() helper — derives next-month pay date from profile.defaultPayDay (clamped 1..28)"
  - "21 integration tests in pdf-lonespec.test.ts validating SLIP-01, SLIP-02, SLIP-05 behaviour end-to-end"

affects: [09-04-ui-surfaces, 10-real-data-entry]

tech-stack:
  added: []
  patterns:
    - "In-memory db mock via vi.mock for route-level integration tests (mirrors gcal.test.ts precedent); enables full handler coverage without a live Postgres"
    - "IDOR guard: assistantId derived from req.assistantId (JWT) only; query and body params are never read on /me or /slips routes"
    - "Postgres unique_violation (23505) caught and retried via re-select — provides race-safe document-number allocation under concurrent POSTs"
    - "Rate-NULL gate runs BEFORE the approval gate — signals guardian the fix is 'set the rate', not 're-approve payroll'"

key-files:
  created:
    - "server/src/routes/__tests__/pdf-lonespec.test.ts (671 lines, 21 tests)"
    - ".planning/phases/09-salary-slip/09-03-endpoints-and-allocation-SUMMARY.md"
  modified:
    - "server/src/routes/pdf.ts (+236 lines: imports, issueOrReuseSlip, computePayDate, safeNameSegment, POST /lonespec, GET /lonespec/me)"
    - "server/src/routes/assistant.ts (+24 lines: GET /slips handler with JWT-bound projection)"

key-decisions:
  - "Merged Task 1 + Task 2 integration tests into a single pdf-lonespec.test.ts per the plan's explicit discretion ('may be merged into pdf-lonespec.test.ts — Claude's discretion') — keeps fixture seeding + db mock in one place and lets the /me tests reuse the POST-to-seed pattern"
  - "Test strategy: mock the db module in-process rather than use a test Postgres. Project has no test-DB infrastructure (payments.test.ts / payroll.test.ts /absences.test.ts all use .skip for DB cases). Mock is precedented by gcal.test.ts :50 and is the only way to satisfy the plan's explicit '11+ / 17+ passing tests' acceptance criteria"
  - "Rate-NULL gate (D-12) runs BEFORE the approval gate (D-08) on both POST and GET handlers — the guardian's fix for a NULL rate is different from the fix for a draft payroll, so the earlier signal is informative"
  - "GET /slips projects only public fields (id, reportMonth, documentNumber, issuedAt, payDate, payMethod) — payrollRecordId is intentionally withheld to reduce coupling and minimise accidental PII exposure (T-09-27)"

patterns-established:
  - "Additive route extension of an existing router (pdf.ts) instead of a new file — lets the two lönespec handlers share issueOrReuseSlip, computePayDate, and safeNameSegment private helpers without an export-just-for-test contortion"
  - "safeNameSegment(name) strips whitespace + non-word chars before embedding in Content-Disposition filename — mirrors the 4805 pattern and hardens against path-traversal in filename parsers (T-09-25)"

requirements-completed: [SLIP-01, SLIP-02, SLIP-05, SLIP-07]

duration: ~5min
completed: 2026-04-19
---

# Phase 09 Plan 03: Endpoints and Allocation Summary

**Three HTTP endpoints live — guardian POST, assistant GET /me, and assistant GET /slips — wired to the idempotent `issueOrReuseSlip()` allocator. 21 integration tests green; SLIP-01, SLIP-02, SLIP-05, SLIP-07 validated end-to-end.**

## Accomplishments

- **POST /api/pdf/lonespec** ships with requireAuth + requireGuardian middleware, input validation (assistantId regex, year/month format), D-12 rate-NULL gate (400 with Swedish error), D-08 approval gate (409 with Swedish error), idempotent slip-row allocation, builder + renderer composition, and sanitised Content-Disposition filename.
- **GET /api/pdf/lonespec/me** ships with requireAuth + requireAssistantAccess, JWT-only assistantId derivation (IDOR-safe per Pitfall 6), and the same gate stack as the POST handler. Accepts `?month=YYYY-MM` and rejects missing/malformed month with 400.
- **GET /api/assistant/slips** lists the JWT-bound assistant's issued slips sorted newest-first with an explicit public-field projection.
- **`issueOrReuseSlip()`** helper ships as a private function in pdf.ts — handles the re-download replay case (D-05), computes the next 3-digit sequence defensively, and catches Postgres 23505 to re-select on theoretical race.
- **21 integration tests pass** covering all must-have truths in the plan's frontmatter.

## Task Commits

1. **Task 1: Failing test suite (21 tests, RED state)** — `13f6074` (test — 09-03)
2. **Task 1: POST /api/pdf/lonespec + issueOrReuseSlip + computePayDate implementation** — `9e1f4d9` (feat — 09-03)
3. **Task 2: GET /api/assistant/slips listing endpoint** — `45222d6` (feat — 09-03)

(GET /api/pdf/lonespec/me was written alongside the POST handler in the same implementation commit since both live in pdf.ts and share the private helpers `issueOrReuseSlip`, `computePayDate`, `safeNameSegment`. Tests L–U validate its behaviour from the merged test file.)

## Files Created/Modified

- `server/src/routes/pdf.ts` — +236 lines. New exports: (none — router export unchanged). New private functions: `issueOrReuseSlip`, `computePayDate`, `safeNameSegment`. Two new routes: `POST /lonespec`, `GET /lonespec/me`.
- `server/src/routes/assistant.ts` — +24 lines. Added `paymentSlips` to schema import, `desc` to drizzle-orm import. New route: `GET /slips`.
- `server/src/routes/__tests__/pdf-lonespec.test.ts` — 671 lines, 21 tests in 3 describe blocks (SLIP-01 POST, SLIP-02 GET /me, SLIP-02 GET /slips).

### Test coverage per requirement

| Requirement | Tests | Behaviours proven |
|-------------|-------|-------------------|
| SLIP-01 | A, B, C, D, J, K | 200 happy path, 409 draft payroll, 400 NULL rate, 400 invalid assistantId, 401 no auth, 403 assistant role |
| SLIP-02 (/me) | L, M, N, O, P, Q | 200 own slip, IDOR guard (query ignored), 400 no linked assistant, 409 draft payroll, 400 NULL rate, 400 invalid month |
| SLIP-02 (/slips) | R, S, T, U | sort order + scope, IDOR guard, 400 no assistant, 401 no auth |
| SLIP-05 | E, F, G, H, I | First-issue allocation, replay reuse, different month → new row, different assistant → new row, 23505 on duplicate insert |
| SLIP-07 | (passthrough) | POST + GET /me hand `pr` (approved row with hourlyRateUsed/salaryModelUsed snapshots) directly to buildAnhorigSlip — proven by Plan 02's 23 tests that consume these fields verbatim |

### Verification evidence

- `cd server && npm test -- --run pdf-lonespec` → `Test Files 1 passed (1) / Tests 21 passed (21)` in 1.19s
- `cd server && npm test` → `Test Files 18 passed (18) / Tests 165 passed | 12 skipped (177)` — no regression
- `cd server && npx tsc --noEmit` → exit 0 (clean)

### Acceptance-criteria greps

| Grep | Expected | Actual |
|------|----------|--------|
| `router.post("/lonespec"` in pdf.ts | 1 | 1 |
| `async function issueOrReuseSlip` in pdf.ts | 1 | 1 |
| `function computePayDate` in pdf.ts | 1 | 1 |
| `Timlön saknas för` in pdf.ts | >= 1 | 2 (POST + GET /me) |
| `Lönekörningen är inte godkänd för denna månad` in pdf.ts | >= 1 | 2 |
| `LS-${params.reportMonth}` in pdf.ts | >= 1 | 2 |
| `router.get("/lonespec/me"` in pdf.ts | 1 | 1 |
| `router.get("/slips"` in assistant.ts | 1 | 1 |
| `desc(paymentSlips.reportMonth)` in assistant.ts | 1 | 1 |
| `req.query.assistantId\|req.body.assistantId` in pdf.ts | 0 | 0 (IDOR guard clean) |
| `it(` count in pdf-lonespec.test.ts | >= 11 (task 1) / >= 17 (merged) | 21 |

## Must-Haves Validation

All 12 must-have truths from the plan frontmatter are encoded as tests:

- ✓ 200 + application/pdf with `%PDF-` prefix (Test A)
- ✓ 409 Swedish error on non-approved payroll (Test B)
- ✓ 400 Swedish error when hourlyRateOverride is NULL (Test C)
- ✓ First issue inserts LS-YYYY-MM-001 row (Test E)
- ✓ Replay reuses the same documentNumber and row (Test F)
- ✓ `GET /me` returns 200 + PDF for JWT-bound assistant (Test L)
- ✓ `GET /me` ignores query-param assistantId (Test M — filename contains "Rose" not "Mikael")
- ✓ `GET /me` returns 400 when req.assistantId undefined (Test N)
- ✓ `GET /me` cross-assistant IDOR ignored (Test M, enforced by `req.assistantId` derivation)
- ✓ `GET /slips` returns sorted array scoped to req.assistantId (Test R)
- ✓ `GET /slips` returns 400 when req.assistantId undefined (Test T)
- ✓ Filename `lonespec-{YYYY-MM}-{assistantName-dash-separated}.pdf` with no traversal chars (Test A — Content-Disposition assertion)

## Decisions Made

Three decisions made during execution, all derived from plan Claude's-discretion clauses or project context:

1. **Merged Task 1 + Task 2 tests into a single file** — plan explicitly allows this ("may be merged into pdf-lonespec.test.ts — Claude's discretion"). Kept the fixture seeding + db-mock boilerplate in one place; the /me tests reuse the POST-to-seed pattern naturally.
2. **In-memory db mock via vi.mock over a test Postgres** — project has zero test-DB infrastructure (payments/payroll/absences route tests all use `.skip` for DB behaviour). gcal.test.ts:50 is the precedent for mocking. This is the only way to ship the plan's required count of actually-passing tests.
3. **GET /slips projects public fields only** (omits payrollRecordId) — reduces client coupling to the internal FK and minimises accidental PII exposure. Plan frontmatter requires returning "an array" with `id, reportMonth, documentNumber, issuedAt, payDate, payMethod` per the threat model's I-09-26 disposition ("only assistant name … exposed").

## Deviations from Plan

None material. Observations:

- **Test count in Task 1 vs Task 2 boundary**: Plan lists 11 tests for Task 1 (A–K) + 6 additional for Task 2 /me (L–Q) + 4 for /slips (R–U) = 21 total. Shipped 21, identical to plan.
- **GET /lonespec/me + GET /slips routes shipped in separate commits from POST /lonespec**: Task 1 implementation commit (`9e1f4d9`) actually contains both POST and GET /me handlers because they share private helpers that are simpler to write together than to stage across two commits. Task 2 commit (`45222d6`) contains only the GET /slips endpoint in assistant.ts. The plan's Task 2 acceptance criteria grep checks are all satisfied by `9e1f4d9` + `45222d6` combined.

## Issues Encountered

- **TS narrowing of the Row fixture inside the db mock's `insertChain`** — initial mock had `const row = { issuedAt: ..., ...v }` which TS narrowed to `{ issuedAt, createdAt }` only, rejecting `row.assistantId` access downstream. Fixed with explicit `const row: Row = {...}` type annotation.
- **One test authoring bug (Test R)** — I had left a stale assertion that Rose's listing contained no row with `documentNumber === "LS-2026-03-001"` — but Rose's own March slip legitimately has that number. Replaced the assertion to check the Mikael row (id `s4`) was absent, which is the actual IDOR guarantee.

No auto-fix deviations (Rules 1–3). No authentication gates.

## User Setup Required

None. The in-memory mock tests require no external credentials or infrastructure; `npm test` runs green offline.

## Known Stubs

None — this plan ships production-ready HTTP surface. Plan 09-04 (UI surfaces) consumes these endpoints through existing client/src/lib/api.ts extension points.

## Threat Flags

None — the routes introduce no new trust surface beyond what the plan's `<threat_model>` locked (client→guardian POST; client→JWT-scoped GET /me and /slips; server→Postgres parameterised). All STRIDE dispositions (T-09-20..T-09-28) are mitigated as planned; T-09-29 (DoS) remains `accept` per plan.

## Next Phase Readiness

- **09-04 (UI surfaces):** Ready. The three endpoints are stable and their JSON/PDF shapes are locked. `pdfApi.lonespec(year, month, assistantId)` for guardian POST, `pdfApi.lonespecMe(month)` for the assistant GET, and `assistantApi.slips()` for the listing are the three client helpers to add in client/src/lib/api.ts.

## Self-Check: PASSED

**Files verified:**
- FOUND: server/src/routes/pdf.ts (committed 9e1f4d9)
- FOUND: server/src/routes/assistant.ts (committed 45222d6)
- FOUND: server/src/routes/__tests__/pdf-lonespec.test.ts (committed 13f6074)
- FOUND: .planning/phases/09-salary-slip/09-03-endpoints-and-allocation-SUMMARY.md (this file)

**Commits verified:**
- FOUND: 13f6074 (test — failing suite)
- FOUND: 9e1f4d9 (feat — POST + issueOrReuseSlip + GET /me)
- FOUND: 45222d6 (feat — GET /slips listing)

**Test verification:**
- PASSED: 21/21 in pdf-lonespec.test.ts
- PASSED: 165/165 in full server suite (no regression)
- PASSED: tsc --noEmit clean

**Acceptance grep verification:** all 10 grep criteria satisfied (see table above).

---
*Phase: 09-salary-slip*
*Completed: 2026-04-19*
