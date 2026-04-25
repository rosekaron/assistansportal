---
phase: 07-foundation-schema-cleanup
plan: 03
status: complete
subsystem: server/api + client
tags: [cleanup, dead-code, scheduling, self-book, open-slots, phase-7]
commits:
  - 94ba988
  - de3f540
  - eae5922
requirements: [CLEAN-01, CLEAN-02, CLEAN-03]
dependency_graph:
  requires:
    - 07-01 (openSlots table already dropped from schema; imports left to fix here)
  provides:
    - Clean server typecheck (zero errors after Plan 07-01 + 07-02)
    - Dead API surface removed — future plans no longer fight ghost references
  affects:
    - Plan 07-04 UI (Settings page Scheduling gap replaced by new Anställning & ekonomi section)
    - Phase 9 salary slip (one less source of confusion when wiring slip download paths)
tech_stack:
  added: []
  patterns:
    - "Atomic per-task commits (server, client API, UI) per D-13"
    - "D-14 safeguard: sourceEnum 'self_book' value preserved in schema.ts + clock.ts"
key_files:
  created: []
  modified:
    - server/src/routes/misc.ts
    - server/src/routes/assistant.ts
    - client/src/lib/api.ts
    - client/src/pages/Settings.tsx
decisions:
  - "Kept existing section comment numbers (5. ACCOUNT, 6. NOTIFICATIONS) — renumbering would enlarge diff unnecessarily; Plan 04 re-touches this region next"
  - "Imports in Settings.tsx left unchanged (Switch/Select/SelectTrigger/SelectContent/SelectItem still needed by Plan 04)"
metrics:
  duration: "~2 minutes"
  completed: "2026-04-18"
  tasks: 3
  files_modified: 4
---

# Phase 7 Plan 3: Remove Dead Scheduling Scaffolding — Summary

## One-liner

Removed all dead scheduling API + UI references (CLEAN-01/02/03) in 3 atomic commits — server routes, client API helpers, and Settings card all gone; `sourceEnum "self_book"` preserved per D-14; both typechecks clean.

## What was built

### Task 1 — Server routes purged (commit `94ba988`)

**`server/src/routes/misc.ts`:**
- Line 3 import: dropped `openSlots` → now `import { blocked, invites, settings } from "../db/schema"`
- Removed lines 15–38 inclusive (original): `// ── Open Slots ──` comment + `GET /slots` + `POST /slots` + `DELETE /slots/:id` handlers
- Net change: -24 lines

**`server/src/routes/assistant.ts`:**
- Line 3 import: dropped `openSlots` → now `import { entries, assistants, profile, absences } from "../db/schema"`
- Removed lines 131–155 (original): `POST /self-book/:slotId` handler (25 lines)
- Removed lines 157–172 (original): `GET /open-slots` handler (16 lines)
- Net change: -43 lines

Preserved as-is: `/me`, `/entries`, `/schedule`, `/entries/:id/accept`, `/entries/:id/reject`, `/entries/:id/submit-report`, `/blocked`, `/invites`, `/settings`, `/rates`.

### Task 2 — Client API helpers purged (commit `de3f540`)

**`client/src/lib/api.ts`:**
- Removed `slotsApi` export block (original lines 84–89: list / create / delete)
- Inside `assistantSelfApi` object: removed `openSlots:    () => api.get("/assistant/open-slots")` and `selfBook:     (slotId: string) => api.post(\`/assistant/self-book/${slotId}\`)`
- `assistantSelfApi` still exports: `me`, `entries`, `schedule`, `accept`, `reject`, `submitReport`
- Net change: -9 lines

Preserved as-is: authApi, profileApi, assistantsApi, entriesApi, blockedApi, invitesApi, settingsApi, pdfApi, costsApi, gcalApi, ratesApi, absenceApi, payrollApi, paymentsApi, clockApi, guardianLinksApi.

### Task 3 — Settings UI purged (commit `eae5922`)

**`client/src/pages/Settings.tsx`:**
- Removed `const [sched, setSched] = useState({ allowSelfBook, selfBookApproval, bookingWindowDays })` (was line 116–118)
- Removed the `setSched({...})` block inside the `useEffect(() => { if (settings) {...} }, [settings])` hook (was lines 160–164) — other effects in that hook (gcal, prelimTaxRate, reminderDay) preserved
- Removed `const saveSched = useMutation({ ... })` entirely (was lines 203–210)
- Removed the entire Scheduling card JSX block: `{/* ── 3. SCHEDULING ── */}` through closing `</Card>` (was lines 618–667, 50 lines including ToggleRow + radio group + Booking window Select)
- Imports unchanged (Switch, Select, SelectTrigger, SelectContent, SelectItem retained — Plan 04 will need them)
- Net change: -69 lines

Page layout self-heals: Integrations section → (former Scheduling gap) → `<div className="mt-8 mb-3"><SectionLabel>Payroll rates</SectionLabel></div>` provides natural vertical rhythm per UI-SPEC.

## Deviations from plan

None — plan executed exactly as written. All line ranges, import surgery, and JSX block boundaries matched the plan's action text.

## Verification

### Typecheck (both sides clean)

```
cd server && npx tsc --noEmit    → 0 errors (was 2 pre-existing from Plan 07-01/07-02)
cd client && npx tsc --noEmit    → 0 errors
```

The 2 pre-existing `openSlots` import errors flagged in Plan 07-01/07-02 SUMMARY's "Known transitional state" are now resolved.

### Grep verification (D-14 safeguard preserved)

```
grep -rE "self_book" server/src client/src
```
Returns:
- `server/src/db/schema.ts` — sourceEnum value `["proposal","self_book"]` + explanatory NOTE comment
- `server/src/routes/clock.ts:182` — `source: "self_book"` clock-in origin marker
- `client/src/lib/types.ts` — `type Source = "proposal" | "self_book"` (matches server enum)

All three are the D-14 preserved usages. Zero references to self-book as a UX feature remain.

### Grep verification (removed surface)

```
grep -rE "slotsApi|selfBook|openSlots|saveSched|allowSelfBook" server/src client/src
```
Returns: **nothing** — all dead references fully excised.

### Grep verification (adjacent sections preserved in Settings.tsx)

```
grep -q "Google Calendar" client/src/pages/Settings.tsx   → match (Integrations card intact)
grep -q "Payroll rates"   client/src/pages/Settings.tsx   → match (next section intact)
grep -q "SectionLabel"    client/src/pages/Settings.tsx   → match (primitive still used elsewhere)
```

### Runtime note

Server and client were not booted for this plan — typecheck clean is sufficient verification for CLEAN-01/02/03 (deletion-only scope). Page render verification is deferred to Plan 07-04, which is the next Wave 2 plan and will be the first to boot the app against the new schema.

## Threat Flags

None. All threats in the plan's register were either `accept` (404 behavior is safe for removed endpoints; orphan settings rows won't harm) or `mitigate` and verified:

- T-07-03-01 (DoS via removed endpoints): accepted — single-user anhörig app, no external consumers
- T-07-03-02 (middleware fails-open on deleted path): mitigated — `grep -E "slots|self-book|open-slots" server/src/middleware/*.ts` returns empty
- T-07-03-03 (sourceEnum "self_book" accidentally deleted): mitigated — explicit grep verification above confirms value present in schema.ts + clock.ts
- T-07-03-04 (orphan settings keys): accepted — harmless; no cleanup migration added
- T-07-03-05 (leftover openSlots references): mitigated — `grep -r "openSlots" server/src` returns nothing

## key-files

### created
_(none — pure deletions)_

### modified

- `server/src/routes/misc.ts` — dropped openSlots import + 3 /slots handlers (commit `94ba988`)
- `server/src/routes/assistant.ts` — dropped openSlots import + self-book + open-slots handlers (commit `94ba988`)
- `client/src/lib/api.ts` — dropped slotsApi + assistantSelfApi.{openSlots, selfBook} (commit `de3f540`)
- `client/src/pages/Settings.tsx` — dropped sched state + saveSched mutation + Scheduling card JSX (commit `eae5922`)

## Self-Check: PASSED

- [x] All 3 tasks executed
- [x] Each task committed atomically (`94ba988`, `de3f540`, `eae5922`)
- [x] `cd server && npx tsc --noEmit` → zero errors (pre-existing 2 errors resolved)
- [x] `cd client && npx tsc --noEmit` → zero errors
- [x] D-14 safeguard intact: `self_book` value present in `schema.ts` sourceEnum + `clock.ts:182` origin marker
- [x] Zero references to removed surface (slotsApi, selfBook, openSlots, saveSched, allowSelfBook) across entire codebase
- [x] Adjacent Settings sections (Integrations, Payroll rates) render boundaries preserved
- [x] Imports in Settings.tsx unchanged (Plan 04 will need Switch/Select)
