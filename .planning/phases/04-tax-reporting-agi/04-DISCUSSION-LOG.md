# Phase 4: Tax Reporting (AGI) - Discussion Log

> **Audit trail only.** Do not use as input to planning agents.
> Decisions captured in 04-CONTEXT.md.

**Date:** 2026-04-11
**Phase:** 04-tax-reporting-agi
**Mode:** assumptions + user corrections

## Assumptions Presented

### Data Source
| Assumption | Confidence | Evidence |
|------------|------------|---------|
| AGI reads from payroll_records | Confident | Phase 3 D-02 snapshots |
| VAB days from absences table (calendar days) | Likely | clippedDays() in absence-utils.ts |

### Preliminary Tax
| Assumption | Confidence | Evidence |
|------------|------------|---------|
| Omit / report as zero | Confident (WRONG) | No withheldTax column found |

### XML Library
| Assumption | Confidence | Evidence |
|------------|------------|---------|
| Add xmlbuilder2 | Confident | No XML lib in package.json |

### UI Placement
| Assumption | Confidence | Evidence |
|------------|------------|---------|
| Monthly.tsx Step 4 | Likely | Monthly is compliance workflow page |

## Corrections Made

### Payroll Formula
- **Original assumption:** `gross = hours × 334` (Phase 3 formula treated FK rate as gross)
- **User correction:** 334 kr/h is the FK allocation envelope. Correct formula:
  `gross = (hours × 334 − costs) / 1.3142`
  Surplus after salary + contributions + costs is returned to FK.
- **Impact:** Phase 3 payroll-utils.ts has a bug. Phase 4 must fix the formula and re-derive payroll_records before generating AGI.

### Preliminary Tax
- **Original assumption:** Report as zero — no infrastructure exists
- **User correction:** Guardian withholds and remits preliminärskatt. It IS required.
- **Rate:** Guardian-level default (one rate for all assistants), stored in `settings` table
- **Impact:** Add `preliminary_tax_rate` settings key + UI field + snapshot into payroll_records

### Costs
- **Original assumption:** Costs not factored into AGI calculation
- **User correction:** Costs (from `costs` table) are deducted from FK allocation before
  deriving gross salary. They reduce the salary pool, not the AGI XML directly.
