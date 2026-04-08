# Phase 3: Payroll Calculation & Recording - Discussion Log (Assumptions Mode)

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the analysis.

**Date:** 2026-04-08
**Phase:** 03-payroll-calculation-recording
**Mode:** assumptions
**Areas analyzed:** Data Model, Calculation Approach, UI Approach, API Design, Approval/Locking

## Assumptions Presented

### Data Model
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Two new tables: `payroll_records` + `payments` | Confident | `schema.ts` — no existing payroll table; `costs` table structurally wrong |
| No `guardianId` column (follow single-tenant pattern) | Likely | `schema.ts` line 161 comment; `costs`, `entries` have no guardianId |

### Calculation Approach
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Server-side in `payroll-utils.ts`, snapshot rate at approval | Confident | `absence-utils.ts` lib pattern; `Reports.tsx` does live client calc only |
| Reuse `filterBillableEntries` from `absence-utils.ts` | Confident | `pdf.ts` line 103 — FK forms already use this function |

### UI Approach
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| New `/payroll` page (not in Reports.tsx) | Likely | `Reports.tsx` is 250+ lines; Phase 2 added new Leave.tsx page |
| Per-assistant cards with inline Approve | Likely | `Reports.tsx` per-assistant card pattern; Phase 2.5 design system |

### API Design
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| Two route files: `payroll.ts` + `payments.ts` | Likely | One-domain-per-file pattern across all routes/ |

### Approval / Locking
| Assumption | Confidence | Evidence |
|------------|-----------|----------|
| `draft \| approved` status enum; no audit table in Phase 3 | Likely | `reqStatusEnum`/`repStatusEnum` pattern; `costs` has no locking |

## Corrections Made

No corrections — all assumptions confirmed.

## Product Decisions Captured

### Karensdag
- **Question:** Should Phase 3 payroll deduct karensdag (first unpaid sick day) from gross pay?
- **Decision:** No — skip for Phase 3. Deferred to Phase 5 compliance refinement.

### Age-based employer contribution rates
- **Question:** Should Phase 3 handle reduced rates for young/older workers (10.21%/17.77%)?
- **Decision:** Flat 31.42% for all assistants in Phase 3. Note to revisit for compliance phase.

### UI screens
- **Screen 1 (Payroll summary card):** Approved. Note: add printable payslip in future when targeting small care companies.
- **Screen 2 (Payment recording):** Inline within card — no modal, no separate page.

## External Research Topics Flagged (not researched — resolved via product decisions)

- **Karensdag deduction rule** — Resolved: skip Phase 3 (product decision)
- **Age-based contribution rates** — Resolved: flat rate (product decision)
- **Rate snapshotting** — Resolved: snapshot rate into `payroll_records` at generation time (internal design decision)
