---
phase: 03-payroll-calculation-recording
plan: "04"
subsystem: ui
tags: [react, typescript, axios, lucide-react, sv-SE-locale, payroll]

# Dependency graph
requires:
  - phase: 03-payroll-calculation-recording
    provides: payroll and payments REST endpoints (GET/POST/DELETE /api/payroll, /api/payments)
provides:
  - Payroll.tsx page with month selector, per-assistant cards, approve flow, payment history
  - PayrollRecord and Payment TypeScript types in api.ts
  - payrollApi and paymentsApi axios helpers in api.ts
  - /payroll route in App.tsx (guardian layout group)
  - Löner nav item in Layout.tsx sidebar
affects: [04-reporting-exports, 05-compliance-forms]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "sv-SE locale formatting via Intl.NumberFormat for all SEK currency display"
    - "Optimistic UI for approve/payment via re-fetch after mutation"
    - "Inline payment history toggle within payroll card"

key-files:
  created:
    - client/src/pages/Payroll.tsx
  modified:
    - client/src/lib/api.ts
    - client/src/App.tsx
    - client/src/components/Layout.tsx

key-decisions:
  - "Swedish UI copy used throughout (Löner, Godkänd, Generera löneunderlag, etc.) — full English conversion deferred, logged as follow-up"
  - "absenceBreakdownJson parsed inline in Payroll.tsx for per-type absence display"
  - "Outstanding balance shown with emerald (zero) / amber (non-zero) colour coding"

patterns-established:
  - "api.ts payrollApi / paymentsApi pattern matches existing absenceApi structure"
  - "Per-assistant payroll card as self-contained component with local payment state"

requirements-completed: [PAY-02, PAY-03]

# Metrics
duration: 200min
completed: 2026-04-10
---

# Phase 03 Plan 04: Payroll UI Summary

**Full guardian payroll page with month selector, per-assistant approval cards, inline payment recording, and sv-SE locale currency formatting wired end-to-end to the Phase 03-03 REST API**

## Performance

- **Duration:** ~200 min (including browser-automation verification)
- **Started:** 2026-04-10T06:38Z
- **Completed:** 2026-04-10T12:00Z
- **Tasks:** 4 (3 automated + 1 human-verify checkpoint)
- **Files modified:** 4

## Accomplishments

- Added `PayrollRecord` and `Payment` TypeScript types plus `payrollApi` / `paymentsApi` axios helpers to `api.ts`, matching the existing `absenceApi` pattern
- Built a 361-line `Payroll.tsx` page covering: month selector with prev/next navigation, per-assistant payroll cards (billable hours, per-type absence breakdown, gross pay, employer contributions, total cost, outstanding balance), approve flow (draft → Godkänd ✓), inline payment history with add/delete, loading skeletons, and sv-SE locale SEK formatting
- Wired `/payroll` route into the guardian layout group in `App.tsx` and added a Löner nav item with the Banknote icon to `Layout.tsx`
- All features verified end-to-end by browser automation: route loads, month navigation works, generate/approve/add-payment/delete-payment flows confirmed, data persisted in DB

## Task Commits

Each task was committed atomically:

1. **Task 1: Add PayrollRecord, Payment types and payrollApi, paymentsApi to api.ts** - `79d0754` (feat)
2. **Task 2: Create Payroll.tsx page — month selector, cards, approve flow, payment history** - `a97d715` (feat)
3. **Task 3: Wire /payroll route in App.tsx and add Löner nav item to Layout.tsx** - `ca7e0ec` (feat)
4. **Task 4: Human verify checkpoint** — browser-automation verified, no code commit

**Plan metadata:** _(this commit)_ (docs: complete plan)

## Files Created/Modified

- `client/src/lib/api.ts` — Added 50 lines: `PayrollRecord` type (with `absenceBreakdownJson`, `status`, `approvedAt`), `Payment` type, `payrollApi` (list/generate/approve), `paymentsApi` (list/create/delete)
- `client/src/pages/Payroll.tsx` — New 361-line page: month selector, per-assistant payroll cards, approve mutation, inline payment history, outstanding balance, loading skeletons, empty state
- `client/src/App.tsx` — Import `PayrollPage`, register `<Route path="/payroll">` in guardian route group
- `client/src/components/Layout.tsx` — Import `Banknote` from lucide-react, insert Löner nav item between Frånvaro and Reports

## Decisions Made

- Used sv-SE `Intl.NumberFormat` for all SEK amounts (comma decimal, non-breaking-space thousands separator) as specified in the UI-SPEC design contract
- `absenceBreakdownJson` parsed inline in the card component — no separate service layer needed at this scale
- Outstanding balance uses emerald colour when zero (fully paid), amber when positive (amount outstanding)

## Deviations from Plan

### Notes

**1. Swedish UI copy not converted to English**
- **Found during:** Plan review / post-execution
- **Issue:** All UI copy (Löner, Godkänd, Generera löneunderlag, Inga löneunderlag, Frånvaro, etc.) is in Swedish. The Swedish copywriting contract specified in the plan is fulfilled, but a follow-up decision has been made to convert the full UI to English.
- **Action:** Deferred. This is tracked as a follow-up task — do NOT make the change inside this plan. A dedicated UI-copy sweep plan should be created.
- **Files affected:** `client/src/pages/Payroll.tsx`, `client/src/components/Layout.tsx`

---

**Total deviations:** 0 auto-fixes. 1 deferred follow-up (English copy conversion).
**Impact on plan:** Plan executed exactly as written. The Swedish copy deferral is a future-scope item, not a blocking issue.

## Issues Encountered

None - all three code tasks built and committed cleanly. Browser-automation checkpoint passed all 9 acceptance criteria on first run.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Phase 03 is now fully complete — the full payroll cycle (hours recording → payroll calculation → approval → payment recording) is usable end-to-end
- Phase 04 (reporting/exports) can consume `payrollApi.list()` and `paymentsApi.list()` for report generation
- Phase 05 (compliance forms) can reference the `PayrollRecord` type and approved status
- Follow-up needed before public launch: convert all Swedish UI copy to English (Löner, Godkänd, Generera löneunderlag, etc.)

---
*Phase: 03-payroll-calculation-recording*
*Completed: 2026-04-10*
