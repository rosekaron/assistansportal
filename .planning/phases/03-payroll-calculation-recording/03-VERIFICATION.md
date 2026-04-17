---
phase: 03-payroll-calculation-recording
verified: 2026-04-17T22:00:00Z
status: passed
score: 3/3 must-haves verified
retrospective: true
note: "Written retrospectively during v1.0 milestone audit close-out. Evidence from shipped code + integration-checker confirmation."
---

**Status:** PASSED (retrospective)

# Phase 03 — Payroll Calculation & Recording — Verification

Verification written retrospectively against the three success criteria from ROADMAP.md. Evidence was gathered from the shipped code and cross-referenced with the v1.0 milestone integration-checker report (see [.planning/v1.0-MILESTONE-AUDIT.md](../../v1.0-MILESTONE-AUDIT.md)).

## Success Criteria

### 1. Monthly payroll summary per assistant

**Required:** Billable hours, absence hours by type, gross pay (hours × rate), employer contributions (31.42% standard rate), total cost per assistant.

**Evidence:**
- `server/src/lib/payroll-utils.ts` — `calculatePayroll()` computes billable hours, gross, employer contributions (arbetsgivaravgifter), and total cost; delegates absence filtering via `filterBillableEntries`
- `server/src/routes/payroll.ts:generate` — snapshots `absence_breakdown_json` onto each `payroll_records` row
- `client/src/pages/Monthly.tsx` — displays per-assistant payroll cards with breakdown (billable hours, absence hours, gross, employer cost)
- `server/src/lib/payroll-utils.test.ts` — unit coverage of the calculation with arbetsgivaravgifter

**Result:** PASS

### 2. Approve payroll records; approved records are locked; changes tracked as adjustments

**Evidence:**
- `server/src/routes/payroll.ts` — POST `/approve` endpoint flips record status; subsequent mutations guarded with `409 Conflict` when status is `approved`
- `server/src/routes/pdf.ts` — 4805 PDF generation returns 409 if any record is not approved (integration-check verified)
- Tests: `server/src/routes/__tests__/payroll.test.ts` exercises approve + locked-record behaviour

**Result:** PASS

### 3. Record payments (date, amount, method); show outstanding balance vs. calculated gross

**Evidence:**
- `server/src/routes/payments.ts` — CRUD endpoints with `requireGuardian`
- `client/src/pages/Monthly.tsx` — outstanding balance computed from `payrollApi` + `paymentsApi`
- Payment rows persisted to `payments` table (schema: date, amount, method)

**Result:** PASS

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| PAY-01 | 03-01, 03-02, 03-03 | Calculate gross pay + employer contributions | Complete | payroll-utils.ts, payroll.ts/generate |
| PAY-02 | 03-01, 03-03, 03-04 | Per-assistant monthly summary | Complete | Monthly.tsx payroll cards |
| PAY-03 | 03-01, 03-03, 03-04 | Record payments + outstanding balance | Complete | payments.ts, Monthly.tsx paymentsApi |

## Integration Check

Cross-phase wiring (via v1.0 milestone integration-checker):
- `filterBillableEntries` shared by payroll.ts and pdf.ts (FK3057/FK3059) — **CONNECTED**
- payroll_records consumed by Phase 4 pdf.ts/4805 with 409-on-unapproved guard — **CONNECTED**
- `requireGuardian` applied to all 7 payroll + payments routes — **WIRED**

## Tech Debt Noted

- Swedish UI copy on Monthly.tsx payroll cards deferred for English conversion (follow-up logged in STATE.md)
- Formula corrected in Phase 4 (`gross = (billableHours × hourlyRate − costs) / (1 + taxRate)`) — Phase 3 shipped the earlier form

## Verdict

All 3 success criteria PASS. Phase 03 is complete.
