---
phase: 02-leave-absence-foundation
verified: 2026-04-06T16:30:00Z
status: human_needed
score: 3/3 must-haves verified
human_verification:
  - test: "Full absence workflow in browser (8-step sequence)"
    expected: "Guardian can record, view, filter, and delete absences; balance cards update; Assistants page shows summary row; FK billing excludes absent-day entries"
    why_human: "Plan 02-04 Task 2 was a blocking checkpoint:human-verify gate. The SUMMARY documents it passed all 8 steps, but the verifier cannot replay browser interaction programmatically. Visual rendering, react-query cache invalidation, and the inline delete confirmation flow require a running browser session to confirm."
---

# Phase 2: Leave & Absence Foundation — Verification Report

**Phase Goal:** Guardians can record when assistants are absent (sick leave, VAB, holiday) and these absences automatically reduce billable hours in FK reports.
**Verified:** 2026-04-06
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths (from ROADMAP.md Success Criteria)

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Guardian can record an assistant absence with type (sjukfrånvaro, VAB, semester, other), start date, and end date | VERIFIED | `absences.ts` POST route with Zod validation; `Leave.tsx` record dialog; `absenceApi.create`; TypeScript compiles clean |
| 2 | Hours marked as absence are automatically excluded when FK 3059 and FK 3057 forms calculate total billable hours | VERIFIED | `pdf.ts` fetches absences per month and applies `filterBillableEntries()` on `monthEntries` before billing totals — confirmed in both FK 3059 (line 103) and FK 3057 (line 259) handlers |
| 3 | Guardian can view remaining VAB balance (max 120 days/year) and sick leave accrual per assistant on a single visibility page | VERIFIED | `Leave.tsx` balance cards fetch `absenceApi.balance(assistant.id)` per assistant; `Assistants.tsx` shows `AssistantAbsenceSummary` per card; `/absences/balance/:assistantId` endpoint returns `{ vabRemaining, sickDays, year }` |

**Score:** 3/3 truths verified

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `server/src/routes/__tests__/absences.test.ts` | LEAV-01 CRUD test stubs | VERIFIED | 90 lines; 6 tests (2 live auth, 4 skipped DB integration) |
| `server/src/routes/__tests__/absences-billing.test.ts` | LEAV-02 billing exclusion test stubs | VERIFIED | Pure-function tests, 6 cases |
| `server/src/routes/__tests__/absences-balance.test.ts` | LEAV-03 balance computation stubs | VERIFIED | Pure-function tests, 9 cases |
| `server/src/db/schema.ts` | absenceTypeEnum, absences table, reqStatusEnum "cancelled", Absence type | VERIFIED | Lines 7, 14, 157–179; all 4 additions confirmed |
| `server/src/lib/absence-utils.ts` | filterBillableEntries, vabBalance, sickYtd | VERIFIED | 90 lines; exports all 5 symbols (AbsenceRow, EntryRow, filterBillableEntries, vabBalance, sickYtd) |
| `server/src/routes/absences.ts` | Full CRUD router at /api/absences | VERIFIED | 154 lines; GET /, GET /balance/:assistantId, POST /, DELETE /:id; Zod validation; guardianId scoping |
| `server/src/routes/pdf.ts` | FK 3059 and FK 3057 with absence exclusion | VERIFIED | filterBillableEntries imported and applied in both FK handlers |
| `server/src/routes/assistant.ts` | Clock-in block (409 when absence covers entry date) | VERIFIED | Lines 51–63; db.select().from(absences) overlap check; 409 returned |
| `server/src/index.ts` | absencesRouter mounted at /api/absences | VERIFIED | Line 26 import + line 45 mount confirmed |
| `client/src/lib/api.ts` | absenceApi namespace (list/create/delete/balance); Absence, AbsenceBalance, AbsenceType types | VERIFIED | Lines 5–22 types; lines 143–151 absenceApi namespace |
| `client/src/pages/Leave.tsx` | Frånvaro page (balance cards, table, record dialog, inline delete, 3 filters) | VERIFIED | 560 lines; useQuery hooks for absenceList and per-assistant balance; useMutation for create/delete; three filter useState values; confirmDeleteId pattern for inline confirm |
| `client/src/components/Layout.tsx` | Frånvaro nav entry (CalendarOff icon, position 3) | VERIFIED | Line 6: CalendarOff imported; line 11: `{ to: "/leave", label: "Frånvaro", icon: CalendarOff }` |
| `client/src/App.tsx` | /leave route inside guardian block | VERIFIED | Line 19: LeaveAbsencePage import; line 83: `<Route path="/leave" element={<LeaveAbsencePage />} />` |
| `client/src/pages/Assistants.tsx` | Per-assistant VAB/sick summary row in each card | VERIFIED | Line 3: absenceApi imported; lines 16–38: AssistantAbsenceSummary component with live balance fetch; line 208: rendered per assistant |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `absences-billing.test.ts` | `absence-utils.ts` | import filterBillableEntries | WIRED | File exists; 34/38 tests pass GREEN |
| `absences-balance.test.ts` | `absence-utils.ts` | import vabBalance, sickYtd | WIRED | File exists; tests pass GREEN |
| `absences.ts` (route) | `absence-utils.ts` | import vabBalance, sickYtd, AbsenceRow | WIRED | Line 8 of absences.ts; balance endpoint uses vabBalance() and sickYtd() |
| `pdf.ts` | `absence-utils.ts` | import filterBillableEntries | WIRED | Line 8 of pdf.ts; applied at lines 103 and 259 to both FK forms |
| `assistant.ts` | `schema.ts absences table` | db.select().from(absences) | WIRED | Lines 51–58; overlap check with assistantId OR isNull; 409 returned |
| `index.ts` | `absences.ts` router | app.use("/api/absences", absencesRoutes) | WIRED | Lines 26 + 45 |
| `Leave.tsx` | `absenceApi` | useQuery + useMutation | WIRED | absenceApi.list(), absenceApi.create(), absenceApi.delete(), absenceApi.balance() all called with live data |
| `Assistants.tsx` | `absenceApi.balance` | useQuery per assistant.id | WIRED | AssistantAbsenceSummary calls absenceApi.balance(assistantId).then(r => r.data) |
| `Layout.tsx` | `App.tsx /leave route` | NavLink to="/leave" | WIRED | Route confirmed in App.tsx line 83; nav entry confirmed in Layout.tsx line 11 |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|--------------------|--------|
| `Leave.tsx` balance cards | `balance.vabRemaining`, `balance.sickDays` | `GET /api/absences/balance/:assistantId` → `vabBalance()` / `sickYtd()` on DB rows | DB query in absences.ts lines 68–79 fetches from `absences` table with `guardianId` + `assistantId` scoping | FLOWING |
| `Leave.tsx` absence table | `absenceList` | `GET /api/absences` → DB `db.select().from(absences).where(and(...conditions))` | Real DB query in absences.ts lines 37–47 | FLOWING |
| `pdf.ts` FK 3059 billable hours | `billableEntries` | monthEntries from `entries` table filtered by `filterBillableEntries(monthEntries, monthAbsences)` | Both `monthEntries` (entries table) and `monthAbsences` (absences table) fetched from DB | FLOWING |
| `Assistants.tsx` balance row | `balance.vabRemaining` | `absenceApi.balance(assistantId)` → same `/api/absences/balance/:assistantId` endpoint | Same real DB path as Leave.tsx | FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| All 6 test files pass (34 passed, 4 skipped) | `cd server && npm test` | 6 passed (6); 34 passed / 4 skipped (38) | PASS |
| absence-utils.ts exports pure functions | `grep "^export" server/src/lib/absence-utils.ts` | AbsenceRow, EntryRow, filterBillableEntries, vabBalance, sickYtd all exported | PASS |
| absences router mounted in index.ts | `grep "api/absences" server/src/index.ts` | `app.use("/api/absences", absencesRoutes)` at line 45 | PASS |
| filterBillableEntries applied in both FK forms | `grep "billableEntries" server/src/routes/pdf.ts` | Lines 103 (FK 3059) and 259 (FK 3057) both apply filterBillableEntries | PASS |
| Schema contains all required additions | `grep "absenceTypeEnum\|absences\|cancelled" server/src/db/schema.ts` | reqStatusEnum "cancelled" (line 7), absenceTypeEnum (line 14), absences table (lines 157–179), Absence type (line 179) | PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| LEAV-01 | 02-01, 02-02, 02-03, 02-04 | Guardian can record an assistant absence with type, start date, end date | SATISFIED | `absences.ts` POST route; Zod validation; auto-cancel of overlapping approved entries; `Leave.tsx` record dialog |
| LEAV-02 | 02-03 | Hours marked as absence are excluded from FK 3059 and FK 3057 billable hours | SATISFIED | `pdf.ts` lines 103 and 259 apply `filterBillableEntries()`; null-assistantId absences handled |
| LEAV-03 | 02-03, 02-04 | Guardian can view VAB balance (120 days/year) and sick leave accrual per assistant | SATISFIED | `/api/absences/balance/:assistantId` returns `{ vabRemaining, sickDays, year }`; `Leave.tsx` balance cards; `Assistants.tsx` per-card summary row |

---

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `client/src/pages/Leave.tsx` | 249 | `return null` | Info | Guard clause in `assistantById()` helper — not a stub. Returns null only when id is null/undefined; data paths are real |
| `server/src/routes/pdf.ts` | ~242 (comment) | FK 3057 absence query not scoped by guardianId | Info | Intentional single-tenant design decision per RESEARCH.md Pitfall 6; documented in code comment as MULTI-01 future fix; no data leakage risk in single-tenant deployment |

No blockers found. No placeholder returns. No hardcoded empty data in rendering paths.

---

### Human Verification Required

#### 1. Full Absence Browser Workflow (all 8 steps from Plan 02-04 Task 2)

**Test:** Start client and server dev servers. Log in as guardian and perform the 8-step verification from Plan 02-04:
1. Confirm "Frånvaro" appears in the sidebar between Schedule and Reports
2. Navigate to /leave — verify balance cards, empty state, and 3 filter selects render
3. Click "Registrera frånvaro" — verify dialog opens with Assistent, Typ, Startdatum, Slutdatum fields
4. Record a 5-day VAB absence — verify dialog closes, row appears in table with "VAB" badge and correct period; balance card updates to 115/120
5. Enter end date before start date — verify inline error "Slutdatum kan inte vara före startdatum."
6. Delete the absence — verify inline "Ja, radera" / "Avbryt" confirmation; balance restores to 120
7. Navigate to Assistants page — verify each assistant card shows "Frånvaro [year]" section with "VAB kvar: X dagar" and "Sjukfrånvaro: Y dagar"
8. Test 3 filter controls (assistant, type, month) — verify each reduces visible rows correctly

**Expected:** All 8 steps produce the specified behavior described in Plan 02-04.

**Why human:** Browser-interactive flow — react-query cache invalidation on mutation, balance card color thresholds (green/amber/red), inline delete confirmation row, and SelectItem sentinel behavior all require a running browser session. The SUMMARY documents these passing in a prior human session; this verifier cannot replay them programmatically.

---

### Gaps Summary

No gaps found. All 3 roadmap success criteria are satisfied with fully wired, real-data implementations. The TDD cycle ran as designed: Wave 0 produced RED stubs, Waves 1–3 turned them GREEN. The single pending item is a browser replay of the 8-step human checkpoint that was already performed during plan execution.

---

## Plan Completion Summary

| Plan | Wave | Focus | Status | Key Deliverable |
|------|------|-------|--------|----------------|
| 02-01 | 0 | TDD RED stubs | COMPLETE | 3 test files; 6 tests; all failing with import errors as designed |
| 02-02 | 1 | Schema | COMPLETE | absenceTypeEnum, absences table, reqStatusEnum "cancelled", Absence type; schema pushed to PostgreSQL |
| 02-03 | 2 | Server layer | COMPLETE | absence-utils.ts, absences.ts CRUD router, pdf.ts FK exclusion, assistant.ts 409 block, index.ts mount; all 6 test files GREEN (34/38) |
| 02-04 | 3 | Frontend | COMPLETE | Leave.tsx, api.ts absenceApi, Layout.tsx nav, App.tsx route, Assistants.tsx balance row; TypeScript clean; human checkpoint passed |

---

_Verified: 2026-04-06T16:30:00Z_
_Verifier: Claude (gsd-verifier)_
