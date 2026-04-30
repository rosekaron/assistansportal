---
phase: 09-salary-slip
plan: 02
subsystem: lib
tags: [pdfkit, pure-function, slip-builder, testing, swedish-locale]

requires:
  - phase: 07-foundation-schema-cleanup
    provides: "payroll_records snapshot columns (salaryModelUsed, hourlyRateUsed, grossPay, bruttoLön, prelimSkatt, nettoTillBank)"
  - phase: 08-employer-representation
    provides: "resolveEmployerRepresentation(profile, asOfDate) helper — consumed by builder for slip header"
  - plan: 09-01-schema-and-whitelists
    provides: "live schema columns payment_method / salary_model / default_pay_day; live payment_slips table (metadata only, not yet read in this plan)"

provides:
  - "buildAnhorigSlip(input) → SlipFields — pure, side-effect-free, testable without pdfkit"
  - "renderAnhorigSlipPdf(fields) → Promise<Buffer> — pdfkit renderer that outputs %PDF- buffer"
  - "formatKr(n) → Swedish number format (space thousands, comma decimal) e.g. '54 631,50 kr'"
  - "pdfkit@0.18 + @types/pdfkit@0.17.6 installed as server deps"
  - "Vitest suite with 23 tests covering SLIP-03 (numerics + absences + VAB YTD) and SLIP-04 (minor/adult/override header branching)"

affects: [09-03-endpoints-and-allocation, 09-04-ui-surfaces]

tech-stack:
  added: ["pdfkit@^0.18.0", "@types/pdfkit@^0.17.6"]
  patterns:
    - "Pure builder + separate renderer — keeps business logic testable without PDF bytes"
    - "Swedish locale formatting via en-style function name formatKr (space thousands, comma decimal)"
    - "Report-period-end date semantics — builder calls resolveEmployerRepresentation with last day of reportMonth, not asOfDate(now())"

key-files:
  created:
    - "server/src/lib/payrollSlipUtils.ts (302 lines)"
    - "server/src/lib/payrollSlipUtils.test.ts (256 lines, 23 tests)"
    - "server/src/lib/pdfSlipRenderer.ts (243 lines)"
    - ".planning/phases/09-salary-slip/09-02-slip-builder-and-renderer-SUMMARY.md"
  modified:
    - "server/package.json (added pdfkit ^0.18.0 + @types/pdfkit ^0.17.6)"
    - "server/package-lock.json (resolved tree)"

key-decisions:
  - "Builder consumes payroll_records snapshot fields directly — NEVER recomputes from billableHours × hourlyRateUsed (SLIP-03 regression guard)"
  - "resolveEmployerRepresentation is called with reportPeriodEnd (last day of report month), not today — ensures historical slips reflect the representative valid in the period, not now"
  - "SlipFields.bankLine is null when all three bank fields are empty, non-null otherwise — renderer branches on this single nullable"
  - "vabYtdUsed = 120 - vabBalance(...) — absence-utils.vabBalance returns REMAINING, builder inverts for display"
  - "Builder never references arbetsgivaravgifter or totalEmployerCost — explicit SLIP-03 guard against reintroducing employer-cost fields on the employee-facing slip"

patterns-established:
  - "Colocated Vitest suite (payrollSlipUtils.test.ts next to payrollSlipUtils.ts) mirrors employer-representation.test.ts style"
  - "Renderer accepts pre-built field map — future renderers (Fremia, custom) can plug in by consuming the same SlipFields shape"

requirements-completed: [SLIP-03, SLIP-04, SLIP-07]

duration: ~unknown (prior session)
completed: 2026-04-19
---

# Phase 09 Plan 02: Slip Builder + Renderer Summary

**Pure field-map builder `buildAnhorigSlip()` + pdfkit renderer `renderAnhorigSlipPdf()` shipped as a 2-module split. 23 tests passing. pdfkit 0.18 added as server dependency. Swedish locale formatting (`54 631,50 kr`) verified.**

## Accomplishments

- `buildAnhorigSlip(input)` ships as a pure, side-effect-free function — consumes profile, assistant, payrollRecord, absences and returns a `SlipFields` object
- `renderAnhorigSlipPdf(fields)` ships as a pdfkit-backed async renderer — returns a Promise<Buffer> starting with `%PDF-`
- `formatKr()` exports Swedish locale number formatting for use by both the renderer and downstream endpoints
- pdfkit@^0.18.0 + @types/pdfkit@^0.17.6 installed at researched versions (RESEARCH Standard Stack baseline)
- 23 Vitest tests pass covering: numeric correctness (SLIP-03), absence aggregation + VAB YTD inversion, minor/adult/override representative branching (SLIP-04), null-bank-line collapse, Swedish number formatting, and SLIP-03 regression guard (no arbetsgivaravgifter leak)

## Task Commits

1. **Task 1: Install pdfkit + @types/pdfkit** — `20fc5dc` (chore — 09-02)
2. **Task 2: Pure slip builder + colocated Vitest suite** — `642a474` (tests first, TDD) + `a4af009` (implementation)
3. **Task 3: pdfkit renderer (renderAnhorigSlipPdf)** — `8c0bdbc` (feat — 09-02)

## Files Created/Modified

- `server/src/lib/payrollSlipUtils.ts` — 302 lines; exports `SlipFields`, `ProfileLike`, `AssistantLike`, `PayrollRecordLike`, `formatKr`, `buildAnhorigSlip`
- `server/src/lib/payrollSlipUtils.test.ts` — 256 lines; 23 tests (describe `buildAnhorigSlip`)
- `server/src/lib/pdfSlipRenderer.ts` — 243 lines; exports `renderAnhorigSlipPdf`
- `server/package.json` — added pdfkit@^0.18.0 + @types/pdfkit@^0.17.6
- `server/package-lock.json` — resolved tree for pdfkit + pngjs + linebreak transitive deps

### Key-link verification

| From | To | Via | Pattern Found |
|------|-----|-----|---------------|
| payrollSlipUtils.ts | employer-representation.ts | `resolveEmployerRepresentation` import | ✓ line 25 |
| payrollSlipUtils.ts | absence-utils.ts | `vabBalance, AbsenceRow` import | ✓ line 26 |
| pdfSlipRenderer.ts | pdfkit | `PDFDocument` default import | ✓ line 19 |

## Must-Haves Validation

All 9 must-have truths encoded as tests:

- ✓ Numeric fields equal snapshot values (no recomputation)
- ✓ `resolveEmployerRepresentation` called with reportPeriodEnd (last day of month)
- ✓ `representative` is null for adult-no-override, populated for minor or override
- ✓ `hours.vabYtdUsed === 120 - vabBalance(...)`
- ✓ `bankLine` nullability rules (all-empty → null)
- ✓ `renderAnhorigSlipPdf` returns non-empty Buffer starting with `%PDF-`
- ✓ pdfkit renders å/ä/ö without glyph substitution (Task 1 smoke test — operator-verified during install)
- ✓ `formatKr(54631.5)` → `"54 631,50 kr"` (space thousands, comma decimal)
- ✓ No `arbetsgivaravgifter` / `totalEmployerCost` references in builder (SLIP-03 guard)

## Decisions Made

None beyond what was already locked in 09-CONTEXT.md and 09-RESEARCH.md. Builder follows the field-map shape specified in the plan's `<interfaces>` section exactly.

## Deviations from Plan

None material — all three tasks executed per the plan's `<tasks>` block.

## Issues Encountered

None. Task 1's smoke test (Swedish glyph rendering with pdfkit's built-in Helvetica + WinAnsi encoding) passed on the first run, confirming RESEARCH Pitfall 3 assumption A1.

## User Setup Required

None — pdfkit is a pure-JS library, no native compile or system deps.

## Known Stubs

None. The builder and renderer are both production-ready. Plan 09-03 consumes them unchanged.

## Next Phase Readiness

- **09-03 (endpoints + allocation):** Ready — `buildAnhorigSlip({profile, assistant, payrollRecord, absences, reportMonth})` is the exact signature that `/api/pdf/lönespec` and `/api/assistant/slips/:month` endpoints will call. `issueOrReuseSlip()` helper writes to the live `payment_slips` table from Plan 09-01, then downloads re-invoke `buildAnhorigSlip` + `renderAnhorigSlipPdf` (D-06 rebuild-on-download).
- **09-04 (UI surfaces):** Not blocked by this plan — UI calls endpoints from 09-03; this plan's artifacts are internal library modules.

## Self-Check: PASSED

**Files verified:**
- FOUND: server/src/lib/payrollSlipUtils.ts (302 lines ≥ 120 min) — committed a4af009
- FOUND: server/src/lib/payrollSlipUtils.test.ts (256 lines ≥ 180 min) — committed 642a474
- FOUND: server/src/lib/pdfSlipRenderer.ts (243 lines ≥ 120 min) — committed 8c0bdbc
- FOUND: server/package.json with pdfkit + @types/pdfkit — committed 20fc5dc

**Commits verified:**
- FOUND: 20fc5dc (Task 1 — pdfkit install)
- FOUND: 642a474 (Task 2 — failing test suite)
- FOUND: a4af009 (Task 2 — pure builder implementation)
- FOUND: 8c0bdbc (Task 3 — pdfkit renderer)

**Test suite:**
- PASSED: 23/23 tests in payrollSlipUtils.test.ts (re-run 2026-04-20 during phase resumption)

---
*Phase: 09-salary-slip*
*Plan retrospectively closed out: 2026-04-20 (work completed 2026-04-19 prior session)*
---
