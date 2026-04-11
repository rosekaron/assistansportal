---
phase: 04-tax-reporting-agi
plan: 03
subsystem: ui
tags: [monthly-stepper, agi-download, settings, prelim-tax-rate, assistant-address, form4805]

# Dependency graph
requires:
  - phase: 04-02
    provides: "POST /api/pdf/4805 endpoint + pdfApi.form4805 client helper"
  - phase: 04-01
    provides: "corrected payroll formula + schema columns (prelim_tax_rate_snapshot, assistants.address)"
provides:
  - Monthly.tsx Step 4 AGI download section with per-assistant buttons
  - Settings.tsx preliminary tax rate (preliminärskatt) field
  - Settings.tsx assistant address field in edit dialog
  - assistants.ts PUT /:id route persisting address field
affects: [Monthly.tsx, Settings.tsx, assistants.ts]

# Tech tracking
tech-stack:
  added: []
  patterns: [per-assistant-blob-download, inline-async-handler, settings-decimal-storage]

key-files:
  created: []
  modified:
    - client/src/pages/Monthly.tsx
    - client/src/pages/Settings.tsx
    - server/src/routes/assistants.ts

key-decisions:
  - "agiUnlocked = step2Complete (all payroll approved) — Step 4 unlocks when all payroll records are approved"
  - "download4805() is an inline async function (not useMutation) to support per-assistant parameterization"
  - "preliminary_tax_rate stored as decimal string in settings (e.g. '0.30'); converted to/from percentage integer (e.g. '30') in UI"
  - "address included in editForm state; passed through to assistantsApi.update() without explicit change to mutation call"

patterns-established:
  - "Inline async click handler for per-entity blob downloads (avoids useMutation factory)"
  - "Settings fields read as decimal, displayed as integer percentage — convert on both read (×100) and write (÷100)"

requirements-completed:
  - TAX-01
  - TAX-02

# Metrics
duration: "~5 minutes (continuation after human verification)"
completed: "2026-04-11"
tasks_completed: 3
files_modified: 3
---

# Phase 04 Plan 03: AGI UI Wiring — Monthly Step 4, Settings Tax Rate and Assistant Address Summary

**Monthly.tsx gains a 4-step stepper with per-assistant blankett 4805 download buttons gated on approved payroll; Settings.tsx gains a preliminary tax rate field (persisted as decimal) and an assistant address field wired through to the PUT route.**

## Performance

- **Duration:** ~5 minutes (continuation after human verification checkpoint)
- **Started:** 2026-04-11
- **Completed:** 2026-04-11
- **Tasks:** 3 (2 auto + 1 checkpoint:human-verify, approved)
- **Files modified:** 3

## Accomplishments

- Monthly.tsx Step 4 section added with 4-item stepper; per-assistant Card rows show gross pay, tax withheld, and a Download 4805 button (enabled only when payroll is `approved`)
- Settings.tsx Payroll Rates card added with preliminary tax rate input (0–60 integer percent, stored as decimal); settings persist and reload correctly on page refresh
- Settings.tsx assistant edit dialog extended with an Address field; address saved via existing `assistantsApi.update()` call; `assistants.ts` PUT route updated to persist `address` column

## Task Commits

Each task was committed atomically:

1. **Task 1: Add Step 4 AGI download section to Monthly.tsx** - `0b7635a` (feat)
2. **Task 2: Settings.tsx prelim tax rate + assistant address + assistants.ts route** - `4408586` (feat)
3. **Task 3: Human verification checkpoint** - Approved by user (no code commit — checkpoint gate)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `client/src/pages/Monthly.tsx` — Added `agiUnlocked` computed value, Step 4 entry in `stepperSteps`, `download4805()` async handler, and Section 4 JSX with per-assistant Card grid
- `client/src/pages/Settings.tsx` — Added `prelimTaxRate` state, `savePrelimTax` mutation, Payroll Rates Card section in JSX, `address` field in `editForm` state and `openEdit()`, Address input in edit dialog
- `server/src/routes/assistants.ts` — Added `address: data.address ?? ""` to `db.update().set({...})` in PUT `/:id` route

## Decisions Made

- `agiUnlocked = step2Complete` (all payroll approved) — Step 4 unlocks exactly when all payroll records are in `approved` state, consistent with D-07
- `download4805()` implemented as inline async function rather than `useMutation` factory — simpler and avoids per-assistant mutation instance management
- `preliminary_tax_rate` stored in settings table as decimal string (e.g. `"0.30"`), displayed in UI as percentage integer (`"30"`) — conversion applied on both read (`×100`) and write (`÷100`)
- `address` threaded through `editForm` without changes to the mutation call — `assistantsApi.update(id, editForm)` automatically includes the new field

## Deviations from Plan

None — plan executed exactly as written. Both auto tasks compiled cleanly on first pass. Human verification checkpoint was approved by the guardian.

## Issues Encountered

None.

## User Setup Required

**External template file required (not automated):**
The guardian must download `skv4805.pdf` from Skatteverket and place it at `/forms/skv4805.pdf` in the monorepo root before the 4805 download button will produce a filled PDF. The endpoint returns HTTP 404 with a descriptive JSON error body if the file is absent — no crash, no silent failure.

Download URL: https://www.skatteverket.se/foretag/arbetsgivare/lamnaarbetsgivardeklaration/forenkladarb.4.1ef615b71526b14ba8e6e65.html

## Known Stubs

None. All fields are wired to live data: `payrollRecords` from `/api/payroll`, `assistants` from `/api/assistants`, and settings from `/api/settings`.

## Threat Surface Scan

No new surface beyond what was in the plan's threat model:
- Monthly.tsx Step 4 is guardian-only (T-04-11 — accepted; only authenticated guardian can see gross/tax figures)
- `assistantId` in `download4805()` taken from server-fetched assistants list (T-04-12 — accepted; not user-typed)
- `preliminary_tax_rate` input only updates settings; PDF generation reads from settings table server-side (T-04-10 — mitigated as designed)

## Next Phase Readiness

Phase 4 is fully implemented:
- Payroll formula corrected (Plan 01)
- Schema columns added and pushed (Plan 01)
- `form4805-utils.ts` + `POST /api/pdf/4805` endpoint (Plan 02)
- Monthly.tsx Step 4 + Settings.tsx tax rate field + assistant address (Plan 03)

Phase 5 (Scheduling & Compliance Workflow) can proceed. No blockers.

---

## Self-Check: PASSED

Files exist:
- `client/src/pages/Monthly.tsx` — FOUND (modified)
- `client/src/pages/Settings.tsx` — FOUND (modified)
- `server/src/routes/assistants.ts` — FOUND (modified)

Commits verified:
- `0b7635a`: feat(04-03): add Step 4 AGI download section to Monthly.tsx
- `4408586`: feat(04-03): add prelim tax rate field + assistant address to Settings and assistants route

*Phase: 04-tax-reporting-agi*
*Completed: 2026-04-11*
