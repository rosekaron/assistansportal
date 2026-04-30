---
phase: 07-foundation-schema-cleanup
plan: 02
status: complete
subsystem: server/api
tags: [whitelist, profile, assistants, put-handler, phase-7]
commits:
  - a7d50b8
  - ea02bf1
requirements: [SCHEMA-01, SCHEMA-02]
dependency_graph:
  requires:
    - 07-01 (schema columns must exist before PUT handlers can persist them)
  provides:
    - PUT /api/profile whitelist for all 8 new profile columns
    - PUT /api/assistants/:id whitelist for all 13 new assistants columns
  affects:
    - Plan 07-04 UI (Settings forms can now round-trip every Phase 7 field)
    - Plan 08 employer helper (reads patient_requires_representative — now writeable)
tech_stack:
  added: []
  patterns:
    - "Explicit .set({...}) whitelist preserved (T-07-02-01 mitigation)"
    - "Date string → null coercion via `|| null` for optional date columns"
    - "Default-or-empty coercion via `?? \"\"` / `?? false` / `?? \"a-skatt\"` for non-null text/bool/enum columns"
key_files:
  created: []
  modified:
    - server/src/routes/profile.ts
    - server/src/routes/assistants.ts
decisions:
  - "Followed D-19 exactly: extended existing .set() whitelist; no new endpoints, no schema validation middleware"
  - "Kept legacy single-line `address` field alongside new split address (D-07/D-09) — UI will migrate later"
  - "POST /api/assistants and POST /api/assistants/register-self left untouched — Phase 7 only gains fields in the edit dialog per UI-SPEC §Inventory"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-18"
  tasks: 2
  files_modified: 2
---

# Phase 7 Plan 2: Extend PUT Whitelists for New Phase 7 Columns — Summary

## One-liner

Extended explicit `.set({...})` whitelists in `profile.ts` and `assistants.ts` PUT handlers with 21 new Phase 7 columns (8 profile + 13 assistants) so guardian can persist the columns added in Plan 07-01; security boundary preserved — unknown fields still silently dropped.

## What was built

### profile.ts — PUT / whitelist gains 8 entries

Placed between `fkDecisionNo` and `weeklyHours` (matches column order in schema.ts):

| Column | Default coercion | Notes |
|---|---|---|
| `addressStreet` | `?? ""` | D-07 split address |
| `addressZip` | `?? ""` | D-07 |
| `addressCity` | `?? ""` | D-07 |
| `fkDecisionStart` | `\|\| null` | D-02 — empty string → null |
| `fkDecisionEnd` | `\|\| null` | D-02 — empty string → null |
| `dubbelAssistansApproved` | `?? false` | D-03 |
| `patientRelationToGuardian` | `?? "parent-child"` | D-16 enum default |
| `patientRequiresRepresentative` | `?? false` | SCHEMA-02 / Phase 8 dep |

### assistants.ts — PUT /:id whitelist gains 13 entries

Placed after existing `address` entry:

| Column | Default coercion | Notes |
|---|---|---|
| `addressStreet` | `?? ""` | D-07 |
| `addressZip` | `?? ""` | D-07 |
| `addressCity` | `?? ""` | D-07 |
| `skattetabell` | `?? null` | D-17 — integer, null OK |
| `taxScheme` | `?? "a-skatt"` | D-15 enum default |
| `bankClearing` | `?? ""` | D-17 |
| `bankAccount` | `?? ""` | D-17 |
| `iban` | `?? ""` | D-17 |
| `employmentStartDate` | `\|\| null` | D-17 — empty → null |
| `employmentEndDate` | `\|\| null` | D-17 — null = tillsvidare |
| `citizenship` | `?? ""` | D-17 |
| `residencePermitExpiry` | `\|\| null` | D-17 — null for EU/EES |
| `notes` | `?? ""` | D-17 free-form |

### Safety invariants preserved

- **Explicit whitelist retained** (T-07-02-01): No switch to `.set(data)`. Any non-listed field in the request body is silently dropped — this is the security boundary against column-spray attacks (e.g. a malicious body setting `authId` or `createdAt`).
- **POST handlers untouched**: `router.post("/")` and `router.post("/register-self")` in `assistants.ts` still set only their minimal creation fields. Guardian continues to fill the rest via PUT from the Settings edit dialog, matching UI-SPEC §Inventory which says only the edit dialog gains the new fields in Phase 7.
- **GET handlers untouched**: `SELECT *` behavior unchanged (out of scope per T-07-02-05 disposition "accept — consistent with pre-Phase-7 behavior").

## Deviations from plan

None — plan executed exactly as written. Column order, default coercions, comment placement, and scope boundaries all match the plan's action text verbatim.

## Verification

### Typecheck

```
cd server && npx tsc --noEmit
src/routes/assistant.ts(3,40): error TS2305: Module '"../db/schema"' has no exported member 'openSlots'.
src/routes/misc.ts(3,10): error TS2305: Module '"../db/schema"' has no exported member 'openSlots'.
```

These are the 2 **pre-existing errors** flagged in the prompt's `<transitional_state_note>` — they originate from Plan 07-01 dropping the `openSlots` export, and are **scheduled for removal in Plan 07-03** (CLEAN-01/CLEAN-02). The files modified in this plan (`profile.ts`, `assistants.ts`) compile cleanly — no new errors introduced.

### Acceptance criteria (grep)

All 7 Task 1 patterns match (6 new + 1 existing preserved). All 12 Task 2 patterns match (11 new + 1 existing preserved). Details logged in execution bash output.

### Smoke test (not run — server does not boot cleanly until Plan 07-03)

Per prompt note, `server/src/routes/misc.ts` and `server/src/routes/assistant.ts` still import the removed `openSlots` export and will typecheck-fail until Plan 07-03 removes those imports. Runtime smoke test via `curl -X PUT` deferred to Plan 07-04 (UI round-trip) where a bootable server is the first task.

## Threat Flags

None — this plan's changes are entirely within the existing trust boundary (guardian-authenticated PUT → whitelist → single-tenant DB row). No new endpoints, no new auth surface, no new schema. All column additions were already in the threat register from Plan 07-01.

## key-files

### created
_(none — pure edits)_

### modified
- `server/src/routes/profile.ts` — PUT / `.set({...})` gains 8 entries
- `server/src/routes/assistants.ts` — PUT /:id `.set({...})` gains 13 entries

## Self-Check: PASSED

- [x] Both tasks executed
- [x] Each task committed atomically (`a7d50b8`, `ea02bf1`)
- [x] All 19 acceptance criteria pass (7 Task 1 + 12 Task 2)
- [x] Typecheck shows only pre-existing `openSlots` errors (Plan 07-03 scope); no new errors from this plan
- [x] POST handlers (`/`, `/register-self`) untouched
- [x] Whitelist security pattern (T-07-02-01) preserved in both files
