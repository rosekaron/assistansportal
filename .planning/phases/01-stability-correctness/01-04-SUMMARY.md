---
phase: 01-stability-correctness
plan: 04
subsystem: client-types
tags: [typescript, camelcase, types, react, react-query, rates]

requires:
  - phase: 01-stability-correctness
    plan: 03
    provides: GET /api/rates endpoint returning { fkHourlyRate, employerTaxRate } from env vars

provides:
  - client/src/lib/types.ts exports Entry, Blocked, Assistant, Rates interfaces (camelCase, matching schema.ts)
  - Hours.tsx uses typed Entry/Blocked/Assistant; zero snake_case display-side field accesses
  - Reports.tsx uses typed Entry/Assistant; reads rates from /api/rates via ratesApi; no hardcoded FK_HOURLY_RATE or EMPLOYER_TAX_RATE constants
  - ratesApi.get() added to api.ts calling GET /api/rates
  - STAB-04 regression tests (6) pass GREEN
  - TypeScript compiles client/ with zero errors

affects: [STAB-04, reporting, payroll-calculations, type-safety]

tech-stack:
  added: []
  patterns:
    - "Export typed interfaces from client/src/lib/types.ts mirroring server/src/db/schema.ts (D-05: duplicate client-side)"
    - "useQuery({ queryKey: ['rates'], queryFn: () => ratesApi.get().then(r => r.data), staleTime: 5*60*1000 }) for rarely-changing config"
    - "const fkHourlyRate = rates?.fkHourlyRate ?? 334 fallback pattern for API-sourced constants"
    - "filter((a): a is Assistant => !!a) type guard for filtering undefined from assistant lookups"

key-files:
  created:
    - client/src/lib/types.ts
  modified:
    - client/src/lib/api.ts
    - client/src/pages/Hours.tsx
    - client/src/pages/Reports.tsx
    - client/src/lib/__tests__/entry-types.test.ts

key-decisions:
  - "Added initials field to client Assistant interface (schema.ts has it; pages use it for AvatarStack/AssistantAvatar)"
  - "ScheduleTab and ReportsTab in Hours.tsx given Assistant[] prop type (not Entry[]) since they access initials, color, name fields"
  - "Mutation payload keys (rep_status in update.mutate bodies) intentionally preserved — server routes accept both variants (RESEARCH Pitfall 5 / T-01-04-03)"
  - "STAB-04 test updated to import from @/lib/types instead of local interface stub — tests now verify the real exported type"

requirements-completed: [STAB-04]

duration: 14min
completed: 2026-04-06
---

# Phase 01 Plan 04: camelCase Type Consistency Summary

**Client-side Entry/Blocked/Assistant TypeScript interfaces created; Hours.tsx and Reports.tsx migrated to camelCase field access; Reports.tsx wired to /api/rates with inline error fallback; STAB-04 regression tests pass GREEN**

## Performance

- **Duration:** ~14 min
- **Started:** 2026-04-06T13:20:00Z
- **Completed:** 2026-04-06T13:34:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `client/src/lib/types.ts` created with `Entry`, `Blocked`, `Assistant`, `Rates` interfaces mirroring server Drizzle schema in camelCase
- `ratesApi.get()` added to `client/src/lib/api.ts` — calls `GET /api/rates` returning `{ fkHourlyRate, employerTaxRate }`
- `Hours.tsx`: removed local `Record<string, ...>` type aliases; imported `Entry`, `Blocked`, `Assistant` from `@/lib/types`; replaced all snake_case display-side accesses (`req_status`, `rep_status`, `start_time`, `end_time`, `assistant_id`, `cal_status`) with camelCase equivalents
- `Reports.tsx`: removed `FK_HOURLY_RATE = 334` and `EMPLOYER_TAX_RATE = 0.3142` constants; added `useQuery` for rates with 5-min `staleTime`; derived `fkHourlyRate` / `employerTaxRate` locals with fallback defaults; removed all 7 dual-access patterns (`e.reqStatus ?? e.req_status`, etc.); added inline error text per UI-SPEC
- `entry-types.test.ts` stub updated to `import type { Entry } from "@/lib/types"` — tests now verify the real exported type
- `npx tsc --noEmit` exits 0 with zero errors
- Full test suite: 17 server tests + 6 client STAB-04 tests — all pass GREEN

## Task Commits

1. **Task 1: Create types.ts and add ratesApi** - `a9c1da1` (feat)
2. **Task 2: Migrate Hours.tsx, Reports.tsx, entry-types.test.ts** - `2729e97` (feat)

## Files Created/Modified

- `client/src/lib/types.ts` — NEW: Entry, Blocked, Assistant (with initials), Rates interfaces
- `client/src/lib/api.ts` — Added ratesApi.get() before assistantSelfApi
- `client/src/pages/Hours.tsx` — Removed Record types, added typed imports, camelCase field access throughout display paths
- `client/src/pages/Reports.tsx` — Removed hardcoded constants, added ratesApi useQuery + fallback variables, removed dual-access patterns, added ratesError inline text
- `client/src/lib/__tests__/entry-types.test.ts` — Replaced local interface stub with real import from @/lib/types

## Decisions Made

- Added `initials: string | null` to the `Assistant` interface — the plan's interface spec omitted it but the server schema has it and both `AvatarStack` and `AssistantAvatar` components need it. Adding it is required for the TypeScript migration to compile; omitting it would cause TS2339 errors.
- `ScheduleTab` and `ReportsTab` in `Hours.tsx` now take `assistants: Assistant[]` (not `Entry[]`) — necessary because these components access `initials`, `color`, `name` which are Assistant-specific fields not on Entry.
- Mutation payload keys in Hours.tsx `update.mutate({ data: { rep_status: ... } })` intentionally left as snake_case — per RESEARCH.md Pitfall 5, server routes accept both variants via nullish coalescing; mutation keys are preserved until server routes standardize (threat model T-01-04-03).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Field] Added `initials` to Assistant interface**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** Plan's `Assistant` interface spec omitted `initials`; server schema has it; Hours.tsx `AvatarStack` and `AssistantAvatar` components require it — TS2339 errors on `a?.initials`
- **Fix:** Added `initials: string | null` to the Assistant interface in types.ts
- **Files modified:** `client/src/lib/types.ts`
- **Commit:** `2729e97`

**2. [Rule 2 - Missing Type] Updated ScheduleTab/ReportsTab props from Entry[] to Assistant[]**
- **Found during:** Task 2 TypeScript compilation
- **Issue:** Original code passed `assistants as Entry[]` but the components accessed `name`, `initials`, `color` — fields present on Assistant but not on Entry. Strict mode surfaced this correctly.
- **Fix:** Changed `assistants: Entry[]` to `assistants: Assistant[]` in both sub-component signatures
- **Files modified:** `client/src/pages/Hours.tsx`
- **Commit:** `2729e97`

## Known Stubs

None — all fields are wired to real data. The rate fallback values (334, 0.3142) are intentional defaults documented in the plan and threat model, not stubs.

## Threat Flags

None — all network surface and auth paths are pre-existing. The `ratesApi.get()` call goes to an existing endpoint (`GET /api/rates`) that is already protected by `requireAuth + requireGuardian` (shipped in Plan 01-03).

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| `client/src/lib/types.ts` exists | FOUND |
| `client/src/pages/Hours.tsx` exists | FOUND |
| `client/src/pages/Reports.tsx` exists | FOUND |
| `01-04-SUMMARY.md` exists | FOUND |
| Commit a9c1da1 exists | FOUND |
| Commit 2729e97 exists | FOUND |
| `npx tsc --noEmit` exits 0 | PASSED |
| 6 STAB-04 tests pass GREEN | PASSED |

---
*Phase: 01-stability-correctness*
*Completed: 2026-04-06*
