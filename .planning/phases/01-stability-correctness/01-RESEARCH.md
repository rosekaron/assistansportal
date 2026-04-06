# Phase 1: Stability & Correctness - Research

**Researched:** 2026-04-06
**Domain:** Express/TypeScript security hardening, Drizzle ORM type inference, Vitest test setup
**Confidence:** HIGH — all findings are based on direct source-code inspection of the existing codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Test Framework Setup**
- Install vitest + supertest + @testing-library/react + @vitest/coverage-v8 across both workspaces (server and client)
- Add `test` and `test:coverage` npm scripts to both `server/package.json` and `client/package.json`
- Test files co-located in `__tests__/` folders next to source: `server/src/routes/__tests__/`, `client/src/lib/__tests__/`
- Phase 1 test scope: Regression tests covering the 4 STAB fixes only — role middleware, date calculation, rate env-var loading, camelCase field access
- No coverage threshold enforced in Phase 1

**D-02: Configurable Rates (STAB-03)**
- FK hourly rate (334 SEK) and employer tax rate (31.42%) moved from hardcoded source code to server-side env vars: `FK_HOURLY_RATE` and `EMPLOYER_TAX_RATE`
- Server reads these at startup; a server restart is required to change them
- The existing DB `settings` table is NOT used for rates in Phase 1
- Both vars must have documented fallback defaults in `.env.sample`

**D-03: Dev Endpoint & JWT Hardening**
- `/api/auth/dev-verify` gated behind `NODE_ENV !== 'production'` — returns `404` in production
- `devVerifyToken` stripped from register response body when `NODE_ENV === 'production'`
- JWT startup guard: server throws fatal startup error if `JWT_SECRET` is absent or equals `"dev_secret"` — process exits immediately

**D-04: Role Enforcement Breadth (STAB-01)**
- Apply `requireGuardian` middleware to all guardian-facing routes: entries, assistants, profile, costs, pdf, slots, blocked, invites, settings, gcal
- Apply `requireAssistant` (or equivalent scope check) to all assistant self-service routes: `/api/assistant/*`
- Replace all 25+ raw catch blocks with sanitised error responses: return `{ error: "Internal server error" }` in production; log actual error server-side only
- The existing `requireGuardian` and `requireAssistant` functions in `server/src/middleware/auth.ts` are used as-is

**D-05: camelCase Type Consistency (STAB-04)**
- Update client code to access API response fields using camelCase (`reqStatus`, `repStatus`, `startTime`, `endTime`)
- Replace loose `type Entry = Record<string, string | number | null | undefined>` with proper TypeScript interface derived from Drizzle's `$inferSelect` types
- All pages that access entry fields (primarily `Hours.tsx`) are updated to use camelCase
- TypeScript `strict: true` is already enabled

### Claude's Discretion
- Test helper structure (factories, fixtures, seed utilities)
- Exact env var validation logic at startup (single check function, inline checks, or a `validateEnv()` utility)
- Error logging format in catch blocks — must not expose internals to API callers
- Whether to use a shared type package or duplicate the Drizzle-inferred types on the client

### Deferred Ideas (OUT OF SCOPE)
- Full Route Test Coverage (BACKLOG-01) — all 9 route files, ~50 endpoints
- Configurable Rate Settings UI (BACKLOG-02) — guardian-editable rates from Settings page persisted in DB
- Multi-Country / European Expansion (BACKLOG-03)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STAB-01 | Server enforces role separation — assistants cannot call guardian-only API endpoints (role middleware applied to all protected routes) | Confirmed: `requireGuardian`/`requireAssistant` exist and are correct; all 9 route files currently use only `requireAuth` on guardian routes. Exact middleware wire-up points catalogued below. |
| STAB-02 | FK 3057 date range uses correct last day of the reporting month (not hardcoded day 31) | Confirmed: `pdf.ts` line 214 uses literal `31`; FK3059 (line 68) already uses the correct `new Date(parseInt(year), parseInt(mm), 0).getDate()` pattern — FK3057 can mirror it. |
| STAB-03 | FK hourly rate and employer tax rate are configurable, not hardcoded in source code | Confirmed: `FK_HOURLY_RATE = 334` at `Reports.tsx:14`; `EMPLOYER_TAX_RATE = 0.3142` at `Reports.tsx:43`. Decision locks env-var approach; client reads from a new `/api/settings/rates` endpoint or the existing settings API. |
| STAB-04 | API response types are defined in TypeScript; camelCase field access consistent throughout client | Confirmed: `schema.ts` already exports `type Entry = typeof entries.$inferSelect` with all camelCase keys. Client pages (`Hours.tsx`, `Reports.tsx`) still use `Record<string,…>` and snake_case access. Drizzle types are the authoritative source. |
</phase_requirements>

---

## Summary

Phase 1 is a pure bug-fix and hardening phase with no new user-facing features. Every fix targets a specific file and line range already identified in the codebase analysis. The middleware (`requireGuardian`, `requireAssistant`) is already correct and complete — the only work is wiring it to routes that currently use only `requireAuth`. The date bug in FK3057 is a single-line change mirroring the correct pattern already used by FK3059. The rate constants are two lines in `Reports.tsx` that move to env vars read through a server endpoint. The type-consistency fix is the largest task: replacing loose `Record<string,…>` casts with `Entry` imported from the server schema across multiple page files.

Test infrastructure must be created from scratch (zero test files exist). The chosen stack — Vitest + supertest on the server, Vitest + @testing-library/react on the client — is the natural fit given the existing Vite + TypeScript + ESM setup. The four regression tests map directly to the four requirements and are the minimum viable safety net for Phase 1.

**Primary recommendation:** Wire role middleware first (highest security risk), then harden the JWT guard and dev endpoint (security hardening), then fix the date calculation (data correctness), then migrate rates to env vars (configuration), then close out with type consistency (developer ergonomics). Set up the test framework as Wave 0 before any fix lands.

---

## Standard Stack

### Core (already installed — no new installs for fixes)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| express | ^4.19.2 | HTTP routing | Existing server framework |
| drizzle-orm | ^0.30.10 | ORM + type inference | Existing data layer; `$inferSelect` provides free TypeScript types |
| jsonwebtoken | ^9.0.2 | JWT sign/verify | Existing auth mechanism |
| typescript (server) | ^5.4.5 | Type safety | Existing; `strict: true` not yet confirmed server-side |

[VERIFIED: direct read of server/package.json and client/package.json]

### Test Stack (new installs — Wave 0)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| vitest | latest stable | Test runner for both workspaces | Vite-native; ESM-compatible; same config as Vite |
| @vitest/coverage-v8 | latest stable | V8 coverage provider | Paired with vitest; no Babel needed |
| supertest | latest stable | HTTP assertion for Express routes | Integration tests against real router without starting a server |
| @testing-library/react | latest stable | React component testing | Client-side unit/smoke tests |
| @testing-library/user-event | latest stable | Simulate user interactions | Companion to @testing-library/react |
| @types/supertest | latest stable | TypeScript types for supertest | Required because supertest ships no built-in types |

[ASSUMED] Exact current versions not confirmed via npm registry in this session. Planner should run `npm view vitest version` etc. before locking install commands.

**Installation commands (Wave 0):**
```bash
# Server workspace
cd server && npm install --save-dev vitest @vitest/coverage-v8 supertest @types/supertest

# Client workspace
cd client && npm install --save-dev vitest @vitest/coverage-v8 @testing-library/react @testing-library/user-event jsdom
```

---

## Architecture Patterns

### Existing Route Module Pattern

Every route file follows the same structure. The fix for STAB-01 is mechanical — add `requireGuardian` after `requireAuth` in each route registration call, or replace `requireAuth` with the two-middleware chain `[requireAuth, requireGuardian]`.

```typescript
// Source: server/src/routes/entries.ts (current — missing requireGuardian)
router.get("/", requireAuth, async (req, res) => { ... });

// Fixed pattern — add requireGuardian after requireAuth
router.get("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => { ... });
```

[VERIFIED: direct read of all route files]

### Middleware Chain — Confirmed Order

The two-step chain works because `requireAuth` populates `req.role` before `requireGuardian` checks it:

1. `requireAuth` — verifies JWT, populates `req.userId`, `req.role`, `req.assistantId`; calls `next()` or returns 401
2. `requireGuardian` — checks `req.role === "guardian"`; calls `next()` or returns 403

[VERIFIED: server/src/middleware/auth.ts lines 10-35]

### Recommended Project Structure (test additions only)

```
server/src/
├── routes/
│   ├── __tests__/
│   │   ├── auth.test.ts         # dev-verify gate, JWT guard (D-03)
│   │   ├── role-middleware.test.ts  # STAB-01 regression
│   │   └── pdf.test.ts          # STAB-02 date calc regression
│   └── [existing route files]
└── __tests__/
    └── helpers.ts               # shared supertest app setup, test db utilities

client/src/
├── lib/
│   ├── __tests__/
│   │   └── entry-types.test.ts  # STAB-04 camelCase field access regression
│   └── api.ts
└── pages/
    └── [existing page files]
```

### Pattern 1: Env Var Rate Loading (D-02 / STAB-03)

Rates are loaded on the server at module scope, exported via a new endpoint that the client calls on mount.

```typescript
// Source: CONTEXT.md specifics — env var read pattern
const FK_HOURLY_RATE  = parseFloat(process.env.FK_HOURLY_RATE  ?? "334");
const EMPLOYER_TAX_RATE = parseFloat(process.env.EMPLOYER_TAX_RATE ?? "0.3142");
```

The client already calls `settingsApi.get()` (reads from the `settings` DB table). Rather than reusing the DB settings table (deferred), the simplest path is to expose the two rate env vars via a new lightweight endpoint in `misc.ts` or `profile.ts`, or by extending the existing `/api/settings` GET response with two additional keys sourced from env vars instead of DB rows.

**Recommendation (Claude's discretion):** Add a dedicated `/api/rates` GET endpoint in `misc.ts` that returns `{ fkHourlyRate, employerTaxRate }` read from env vars. This keeps the DB settings table clean and avoids touching the existing settings endpoint contract.

### Pattern 2: JWT Startup Guard (D-03)

The guard must execute before Express setup so a misconfigured server never accepts connections.

```typescript
// Source: CONTEXT.md specifics — insert at top of server/src/index.ts, after dotenv.config()
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev_secret") {
  console.error("FATAL: JWT_SECRET not set or uses insecure default");
  process.exit(1);
}
```

[VERIFIED: server/src/index.ts structure confirmed — dotenv.config() is at line 5, Express setup begins at line 21; guard fits at lines 7-9]

### Pattern 3: FK3057 Date Fix (STAB-02)

FK3059 (line 68) already uses the correct JavaScript idiom. FK3057 must mirror it exactly.

```typescript
// Source: server/src/routes/pdf.ts line 68 (FK3059 — already correct)
const daysInMonth = new Date(parseInt(year), parseInt(mm), 0).getDate();
const end = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;

// Current FK3057 bug — server/src/routes/pdf.ts line 214:
lte(entries.date, `${year}-${mm}-31`)   // hardcoded 31

// Fixed FK3057 — same pattern as FK3059:
const daysInMonth = new Date(parseInt(year), parseInt(mm), 0).getDate();
lte(entries.date, `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`)
```

[VERIFIED: server/src/routes/pdf.ts lines 68-69 and 214 read directly]

### Pattern 4: Drizzle-Inferred Types on the Client (STAB-04)

`schema.ts` already exports `type Entry = typeof entries.$inferSelect` (line 159). The client must import or mirror this type. Since there is no shared workspace in the monorepo, the simplest approach (Claude's discretion) is to duplicate the interface in a new `client/src/lib/types.ts` file that mirrors the schema exactly. This avoids build-tool complexity and keeps the client self-contained.

```typescript
// Source: server/src/db/schema.ts lines 156-164 — types already exported
export type Entry = typeof entries.$inferSelect;
// Entry fields (all camelCase):
// id, assistantId, date, startTime, endTime, hours, entryType,
// reqStatus, repStatus, source, calStatus, activityId, gcalEventId,
// createdAt, updatedAt
```

Client pages replace:
```typescript
// Before (Hours.tsx line 16, Reports.tsx line 45)
type Entry = Record<string, string | number | null | undefined>;

// After
import type { Entry } from "@/lib/types";
```

[VERIFIED: server/src/db/schema.ts lines 81-97 and 156-159 read directly]

### Pattern 5: Error Sanitization (D-04 catch blocks)

Current pattern leaks internal errors:
```typescript
// Existing — all 25+ catch blocks
} catch (e) { res.status(500).json({ error: String(e) }); }
```

Replacement pattern (preserves server-side visibility, hides from client):
```typescript
} catch (e) {
  console.error("[route name] error:", e);
  res.status(500).json({ error: "Internal server error" });
}
```

[VERIFIED: pattern confirmed in auth.ts, entries.ts, and all other route files]

### Anti-Patterns to Avoid

- **Replacing `requireAuth` instead of adding `requireGuardian`:** The assistant self-service routes (`/api/assistant/*`) already use `router.use(requireAuth)` at the router level (confirmed: assistant.ts line 9). Do not remove `requireAuth` from guardian routes — it must precede `requireGuardian`.
- **Adding the JWT guard after Express setup:** If the guard runs after route registration, the server could theoretically be probed before the guard fires. Place it immediately after `dotenv.config()`.
- **Duplicating rate constants client-side as fallback:** Once rates are served from the API, no client-side constant fallback should remain. Remove `FK_HOURLY_RATE` and `EMPLOYER_TAX_RATE` entirely from `Reports.tsx`.
- **Using the DB `settings` table for rates in Phase 1:** Deferred per D-02. The env-var route avoids any schema migration in this phase.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Test HTTP routes | Custom mock HTTP server | supertest + existing Express app | supertest calls router directly without binding a port; no async server lifecycle to manage |
| JWT verification in tests | Custom token decode logic | `jsonwebtoken.sign()` with test secret | Exact same library the production code uses; no drift |
| Date last-day calculation | Custom calendar logic | `new Date(year, month, 0).getDate()` | Native JavaScript; zero dependencies; already used correctly in FK3059 |
| Type generation from DB schema | Manual type definitions | Drizzle `$inferSelect` | Schema changes automatically propagate to types; no manual sync |
| Env var validation library | Custom required-env checker | Inline guard at startup | Two variables only; a library would be over-engineering at this scale |

**Key insight:** All the hard problems in Phase 1 already have solutions in the codebase — they just need to be applied consistently. The middleware exists; the date pattern exists; the Drizzle types exist. The task is wiring, not invention.

---

## Common Pitfalls

### Pitfall 1: Middleware Order Breaks Auth

**What goes wrong:** Adding `requireGuardian` before `requireAuth` causes all requests to fail with 403 because `req.role` is not yet populated.
**Why it happens:** `requireGuardian` checks `req.role`, which is set by `requireAuth`; if `requireAuth` hasn't run, `req.role` is `undefined`.
**How to avoid:** Always maintain the chain `requireAuth, requireGuardian` in that order. The regression test for STAB-01 should confirm both 401 (no token) and 403 (wrong role) response codes.
**Warning signs:** All requests to a protected route return 403 even with a valid guardian token.

### Pitfall 2: assistant.ts Already Uses `router.use(requireAuth)` — Don't Double-Apply

**What goes wrong:** Adding `requireAssistant` to individual route handlers inside `assistant.ts` while the file already has `router.use(requireAuth)` at line 9 creates a redundant (but harmless) double-auth call.
**Why it happens:** The route-level `router.use()` applies middleware to all routes in the file; individual handler additions would be redundant.
**How to avoid:** For `assistant.ts`, add `requireAssistant` at the router level: `router.use(requireAuth, requireAssistant)`. This replaces the existing `router.use(requireAuth)` line.
**Warning signs:** Tests show correct behavior but code review flags the redundancy.

### Pitfall 3: FK3057 Start Date Not Clamped

**What goes wrong:** Fixing only the end-date `lte` clause but leaving the start date hardcoded as `${year}-${mm}-01` is correct — day 1 is always valid. No change needed to the start side.
**Why it happens:** Reviewers might try to apply the same fix pattern to the start boundary unnecessarily.
**How to avoid:** Only the end boundary (line 214) needs fixing. FK3059's start date (line 67: `const start = \`${year}-${mm}-01\``) is the model — keep that pattern.

### Pitfall 4: `devVerifyToken` Still in Response When NODE_ENV Missing

**What goes wrong:** The condition `NODE_ENV === 'production'` evaluates to false when `NODE_ENV` is unset (e.g., in CI or staging), causing `devVerifyToken` to remain in the response.
**Why it happens:** Unset env var is `undefined`, not `"production"`.
**How to avoid:** Gate on `NODE_ENV !== 'production'` for _exposing_ the token: strip it unless `NODE_ENV === 'development'` (explicit allowlist). Or equivalently, only include `devVerifyToken` when `process.env.NODE_ENV !== "production"`.

### Pitfall 5: camelCase Fix Breaks snake_case Request Bodies

**What goes wrong:** The client currently sends some mutation bodies with snake_case keys (e.g., `Hours.tsx` `BlockedTab` sends `{ start_time, end_time }` in the `add.mutate` call at line 283). Fixing field _access_ in display code must not change what the mutation bodies send until the server routes are also updated.
**Why it happens:** The camelCase fix is read-side (display) but the client also has write-side snake_case in mutation payloads.
**How to avoid:** STAB-04 scope is API _response_ field access (read side). The `misc.ts` routes already accept both variants via `d.startTime ?? d.start_time` patterns. Fix the read access first; leave mutation payload keys as-is unless a specific mutation is broken.
**Warning signs:** Blocked time creation stops working after the camelCase refactor.

### Pitfall 6: JWT Guard Breaks Tests That Don't Set JWT_SECRET

**What goes wrong:** After adding the startup guard, test files that import `server/src/index.ts` directly will fail unless `JWT_SECRET` is set in the test environment.
**Why it happens:** The guard calls `process.exit(1)`, which terminates the test process.
**How to avoid:** Set `JWT_SECRET=test-secret-for-tests` in the vitest config's `env` block or in a `.env.test` file loaded by vitest setup. Tests should never import `index.ts` directly — use the router modules with supertest instead.

---

## Code Examples

### Verified Route Middleware Fix (STAB-01)

```typescript
// Source: server/src/routes/entries.ts — all 5 handlers need this change
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";

// Before
router.get("/", requireAuth, async (req, res) => { ... });

// After
router.get("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => { ... });
```

### Verified FK3057 Date Fix (STAB-02)

```typescript
// Source: server/src/routes/pdf.ts — FK3059 pattern (line 68) applied to FK3057 (line 214)
const mm = month.padStart(2, "0");
const daysInMonth = new Date(parseInt(year), parseInt(mm), 0).getDate();
// Replace:
//   lte(entries.date, `${year}-${mm}-31`)
// With:
lte(entries.date, `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`)
```

### Verified JWT Startup Guard (D-03)

```typescript
// Source: CONTEXT.md specifics — insert in server/src/index.ts after dotenv.config() (line 5)
dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev_secret") {
  console.error("FATAL: JWT_SECRET is not set or uses the insecure default 'dev_secret'. Exiting.");
  process.exit(1);
}
```

### Verified Drizzle Type Usage (STAB-04)

```typescript
// Source: server/src/db/schema.ts lines 81-97 and 159
// Entry fields from Drizzle $inferSelect:
export type Entry = typeof entries.$inferSelect;
// {
//   id: string
//   assistantId: string
//   date: string
//   startTime: string
//   endTime: string
//   hours: number
//   entryType: "active" | "waiting" | "standby" | "sick" | null
//   reqStatus: "pending" | "approved" | "rejected" | null
//   repStatus: "draft" | "pending" | "approved" | "rejected" | null
//   source: "proposal" | "self_book" | null
//   calStatus: "tentative" | "confirmed" | null
//   activityId: string | null
//   gcalEventId: string | null
//   createdAt: Date
//   updatedAt: Date
// }
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcoded `"dev_secret"` JWT fallback | Fatal startup guard | Phase 1 | Prevents silent production misconfiguration |
| `requireAuth` only on all routes | `requireAuth + requireGuardian` on guardian routes | Phase 1 | Closes role escalation attack surface |
| Hardcoded `31` in FK3057 end date | `new Date(year, month, 0).getDate()` | Phase 1 | Fixes February and 30-day months |
| `Record<string, …>` API types | Drizzle `$inferSelect`-derived interfaces | Phase 1 | Compile-time field name safety |
| Rate constants in client source | Env var → server endpoint → client | Phase 1 | No redeploy for annual rate changes |

---

## Inventory: Route Files and Middleware Gaps

This is the authoritative list of what changes for STAB-01. All route files verified by direct grep.

### Guardian Routes — Need `requireGuardian` Added

| File | Endpoints | Current | Fix |
|------|-----------|---------|-----|
| `server/src/routes/entries.ts` | GET /, POST /, POST /bulk, PUT /:id, DELETE /:id (5 handlers) | `requireAuth` only | Add `requireGuardian` after `requireAuth` on all 5 |
| `server/src/routes/assistants.ts` | GET /, POST /, PUT /:id, DELETE /:id (4 handlers) | `requireAuth` only | Add `requireGuardian` after `requireAuth` on all 4 |
| `server/src/routes/profile.ts` | GET /, PUT / (2 handlers) | `requireAuth` only | Add `requireGuardian` after `requireAuth` on both |
| `server/src/routes/costs.ts` | GET /, POST /, DELETE /:id (3 handlers) | `requireAuth` only | Add `requireGuardian` after `requireAuth` on all 3 |
| `server/src/routes/pdf.ts` | POST /fk3059, POST /fk3057, GET /forms (3 handlers) | `requireAuth` only | Add `requireGuardian` after `requireAuth` on all 3 |
| `server/src/routes/misc.ts` | slots (3), blocked (3), invites (4), settings (2) = 12 handlers | `requireAuth` only | Add `requireGuardian` to slots/invites/settings handlers; blocked may be shared — confirm with context (both guardian and assistant use blocked?) |
| `server/src/routes/gcal.ts` | GET /status, POST /disconnect, POST /events, PUT /events/:id, DELETE /events/:id, GET /events (6 handlers) | `requireAuth` only | Add `requireGuardian` after `requireAuth` on all 6 |

[VERIFIED: direct grep of all 7 route files]

### Assistant Routes — Already Have `requireAuth`, Need `requireAssistant`

| File | Current | Fix |
|------|---------|-----|
| `server/src/routes/assistant.ts` | `router.use(requireAuth)` at line 9 — covers all handlers | Change to `router.use(requireAuth, requireAssistant)` |

[VERIFIED: server/src/routes/assistant.ts line 9]

### Auth Routes — No Role Middleware Needed

| File | Handler | Note |
|------|---------|------|
| `server/src/routes/auth.ts` | POST /register, POST /login, POST /dev-verify, GET /verify-email, etc. | These are pre-auth routes — `requireAuth` only on `/me` and `/send-invite-email`. No `requireGuardian` needed; `/send-invite-email` could have `requireGuardian` added since only guardians send invites — confirm in plan. |

---

## Inventory: snake_case Access Sites (STAB-04)

All confirmed by direct source read.

### `client/src/pages/Hours.tsx` — Primary Fix Target

| Line | Current (broken) | Fix (camelCase) |
|------|------------------|-----------------|
| 27 | `e.req_status === "approved" && e.rep_status === "pending"` | `e.reqStatus === "approved" && e.repStatus === "pending"` |
| 71 | `e.req_status !== "rejected"` | `e.reqStatus !== "rejected"` |
| 76 | `e.start_time` / `e.end_time` in merged map key and spread | `e.startTime` / `e.endTime` |
| 81 | `group[0].start_time` / `group[0].end_time` | `group[0].startTime` / `group[0].endTime` |
| 121 | `e.assistant_id` | `e.assistantId` |
| 126 | `e.assistant_id` | `e.assistantId` |
| 131 | `e.req_status` (ReqBadge cast) | `e.reqStatus` |
| 147 | `e.req_status`, `e.cal_status` | `e.reqStatus`, `e.calStatus` |
| 148 | `group[0].cal_status` | `group[0].calStatus` |
| 170 | `e.req_status`, `e.assistant_id` | `e.reqStatus`, `e.assistantId` |
| 172 | `e.req_status`, `e.rep_status` (sort fn) | `e.reqStatus`, `e.repStatus` |
| 198 | `x.id === e.assistant_id` | `x.id === e.assistantId` |
| 205 | `e.start_time`, `e.end_time` | `e.startTime`, `e.endTime` |
| 206 | `e.req_status` | `e.reqStatus` |
| 207 | `e.rep_status` | `e.repStatus` |
| 263 | `blocked.start_time`, `blocked.end_time` (Blocked type) | `b.startTime`, `b.endTime` — confirm Blocked type too |

[VERIFIED: direct read of Hours.tsx]

### `client/src/pages/Reports.tsx` — Check Required

Lines 125-168 are noted in CONCERNS.md as having dual-access patterns (`e.reqStatus ?? e.req_status`). The Reports.tsx type must also be upgraded from `Record<string,…>`. Reports.tsx was too large to read fully in this session — the planner must confirm all snake_case sites in Reports.tsx during implementation. The CONCERNS.md analysis is authoritative: "Reports.tsx lines 125–168, 643, 666, 720".

[ASSUMED] Full enumeration of Reports.tsx snake_case sites not verified line-by-line due to file size. Treat the CONCERNS.md line numbers as the working list.

---

## Open Questions (RESOLVED)

1. **Does `blocked` data belong to guardians only or both roles?**
   - **RESOLVED:** Guardian-only. D-04 (CONTEXT.md) explicitly lists "blocked" in the guardian-facing routes requiring `requireGuardian`. The `assistant.ts` self-service routes have no blocked endpoint. Plan 02 Task 1 applies `requireGuardian` to all blocked handlers in `misc.ts`.
   - Implementation consequence: All GET/POST/DELETE blocked handlers in `misc.ts` get `requireGuardian`. No change needed to assistant routes.

2. **Should `/api/auth/send-invite-email` get `requireGuardian`?**
   - **RESOLVED: Yes.** Only guardians send invite emails. D-04 locks `requireGuardian` on all guardian-facing routes, and invite email sending is a guardian-only action. Plan 02 Task 1 now includes `server/src/routes/auth.ts` with a step to add `requireGuardian` to the `/send-invite-email` handler.
   - Implementation consequence: `auth.ts` added to Plan 02 Task 1 `<files>`. The `/send-invite-email` route handler chain becomes `requireAuth, requireGuardian, async (req: AuthRequest, res) => { ... }`.

3. **Client token storage via `localStorage`?**
   - What we know: `api.ts` reads from `localStorage.getItem("token")` (line 7) not the Zustand store. The Zustand store persists under key `"auth"` but stores `{ token, role, assistantId }` — the API client reads `"token"` directly. This is a pre-existing inconsistency.
   - What's unclear: Is there a data integrity issue if a user has `"auth"` in localStorage but not a standalone `"token"` key?
   - **RESOLVED:** Out of scope for Phase 1 — log the observation, do not touch auth storage.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | All server/client scripts | Assumed yes (project runs) | Unknown — not probed | None needed |
| PostgreSQL | Drizzle ORM data layer | Assumed yes (docker-compose.yml present) | Unknown | None — required |
| vitest | Wave 0 test framework | NOT installed (confirmed zero test deps) | — | None — must install |
| supertest | Wave 0 server test | NOT installed | — | None — must install |
| @testing-library/react | Wave 0 client test | NOT installed | — | None — must install |

[VERIFIED: server/package.json and client/package.json read directly — no test libraries present]

**Missing dependencies with no fallback:**
- vitest, @vitest/coverage-v8, supertest, @types/supertest (server)
- vitest, @vitest/coverage-v8, @testing-library/react, @testing-library/user-event, jsdom (client)

All install via npm in Wave 0 before any fix lands.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest (to be installed in Wave 0) |
| Config file | `server/vitest.config.ts` and `client/vitest.config.ts` — neither exists yet (Wave 0 gap) |
| Quick run command (server) | `cd server && npm test` |
| Quick run command (client) | `cd client && npm test` |
| Full suite command | `npm test --workspaces` (from root) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| STAB-01 | Assistant JWT returns 403 on guardian-only endpoint (e.g. GET /api/entries) | Integration | `cd server && npm test -- role-middleware` | Wave 0 gap |
| STAB-01 | No token returns 401 on protected endpoint | Integration | `cd server && npm test -- role-middleware` | Wave 0 gap |
| STAB-02 | FK3057 end date for February (month=02) is day 28, not day 31 | Unit | `cd server && npm test -- pdf` | Wave 0 gap |
| STAB-02 | FK3057 end date for April (month=04) is day 30, not day 31 | Unit | `cd server && npm test -- pdf` | Wave 0 gap |
| STAB-03 | Server returns `FK_HOURLY_RATE` from env when set | Integration | `cd server && npm test -- rates` | Wave 0 gap |
| STAB-03 | Server returns fallback 334 when env var not set | Integration | `cd server && npm test -- rates` | Wave 0 gap |
| STAB-04 | Entry type fields are camelCase (reqStatus, startTime, etc.) | Unit | `cd client && npm test -- entry-types` | Wave 0 gap |

### Sampling Rate

- **Per task commit:** Quick test run for the specific area changed (e.g., `npm test -- role-middleware` after STAB-01 work)
- **Per wave merge:** Full suite — `npm test --workspaces`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `server/vitest.config.ts` — vitest configuration for ESM + tsx
- [ ] `client/vitest.config.ts` — vitest configuration with jsdom environment
- [ ] `server/src/routes/__tests__/role-middleware.test.ts` — covers STAB-01
- [ ] `server/src/routes/__tests__/pdf.test.ts` — covers STAB-02
- [ ] `server/src/routes/__tests__/rates.test.ts` — covers STAB-03
- [ ] `client/src/lib/__tests__/entry-types.test.ts` — covers STAB-04
- [ ] `server/src/__tests__/helpers.ts` — shared supertest app setup

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | JWT via jsonwebtoken; startup guard prevents weak secret; `dev-verify` gated |
| V3 Session Management | Yes | JWT 30-day expiry; no server-side session invalidation (out of scope Phase 1) |
| V4 Access Control | Yes | `requireGuardian` + `requireAssistant` middleware; role in JWT payload |
| V5 Input Validation | Partial | Env var parse (`parseFloat`) with NaN guard; Zod installed but unused (out of scope) |
| V6 Cryptography | No | bcrypt for passwords (existing, correct); JWT secret validation only |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Authenticated assistant calls guardian endpoint | Elevation of Privilege | `requireGuardian` middleware on all guardian routes (STAB-01) |
| Missing/weak JWT_SECRET in production | Spoofing | Fatal startup guard — `process.exit(1)` if secret missing or equals `"dev_secret"` |
| `devVerifyToken` exposed in production register response | Information Disclosure | Strip from response when `NODE_ENV === "production"` |
| Raw Postgres/ORM errors in API response | Information Disclosure | Replace `String(e)` in catch blocks with `"Internal server error"` |
| Hardcoded rate constants requiring code deploy to change | Tampering (indirect) | Move to env vars read at startup |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | vitest, @vitest/coverage-v8, supertest, @testing-library/react are current stable packages installable via npm | Standard Stack | Install commands may need version pins if latest has breaking changes; verify with `npm view vitest version` before installing |
| A2 | Full enumeration of snake_case access sites in Reports.tsx (lines 125-168, 643, 666, 720) is complete per CONCERNS.md | Code Examples | Additional snake_case sites may exist in Reports.tsx beyond those listed; planner must do a full scan of Reports.tsx during implementation |
| A3 | `blocked` endpoints are guardian-only (assistants don't need to read blocked time) | Inventory: Route Files | If assistants need blocked time visibility, the blocked routes require a different access pattern |

---

## Sources

### Primary (HIGH confidence)
- Direct file reads: `server/src/middleware/auth.ts`, `server/src/routes/auth.ts`, `server/src/routes/pdf.ts`, `server/src/routes/entries.ts`, `server/src/routes/assistants.ts`, `server/src/routes/profile.ts`, `server/src/routes/costs.ts`, `server/src/routes/misc.ts`, `server/src/routes/gcal.ts`, `server/src/routes/assistant.ts`, `server/src/index.ts`, `server/src/db/schema.ts`, `client/src/lib/api.ts`, `client/src/pages/Hours.tsx`, `client/src/pages/Reports.tsx` (lines 1-80)
- Direct file reads: `server/package.json`, `client/package.json` — confirmed no test libraries installed
- `.planning/codebase/ARCHITECTURE.md`, `CONCERNS.md`, `CONVENTIONS.md`, `TESTING.md` — codebase analysis artifacts
- `.planning/phases/01-stability-correctness/01-CONTEXT.md` — locked decisions

### Secondary (MEDIUM confidence)
- `.planning/REQUIREMENTS.md`, `STATE.md`, `ROADMAP.md` — project requirements and phase definitions

### Tertiary (LOW confidence / assumed)
- Vitest package versions — not verified against npm registry in this session; marked [ASSUMED]

---

## Metadata

**Confidence breakdown:**
- Standard stack (fixes): HIGH — all existing libraries confirmed via direct file reads
- Standard stack (test installs): MEDIUM — library names confirmed; versions not registry-verified
- Architecture: HIGH — route structure and middleware chain verified by direct source read
- Pitfalls: HIGH — all derive from confirmed code patterns, not general knowledge
- Snake_case inventory for Hours.tsx: HIGH — verified line by line
- Snake_case inventory for Reports.tsx: MEDIUM — relies on CONCERNS.md analysis, not full file scan

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable codebase; no external dependencies change during fix phase)
