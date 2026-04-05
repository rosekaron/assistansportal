# Research Summary: Kalinga Assistansportal

**Project:** Swedish personal assistance (assistansersättning) self-management platform with compliance and payroll integration
**Research Date:** 2026-04-06
**Status:** Complete — Four research dimensions synthesized (STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md)

---

## Executive Summary

Kalinga is building a compliance management platform for Swedish families self-managing personal assistance (egenvald assistans) without delegating to staffing companies. The core regulatory challenge is navigating three overlapping compliance cycles: FK 3059/3057 monthly hour and cost reporting (deadline 5th of second month), AGI monthly tax declaration to Skatteverket (deadline 12th of following month), and correct calculation of 31.42% employer contributions (arbetsgivaravgifter) plus tax deductions.

The existing TypeScript/Express/React codebase provides a solid foundation but requires **five critical fixes and three feature layers** before production use:

1. **Immediate stability concerns** (Phase 0–1): Multi-tenant data isolation is not enforced server-side, FK form date calculations have month-end bugs, rate configuration is hardcoded, and role-based access control relies only on client-side routing.

2. **Feature foundation** (Phases 2–3): Leave/absence tracking must be implemented first because absences affect all downstream calculations (billable hours, payroll, tax reporting). Payroll calculations and AGI reporting follow as dependent features.

3. **Swedish regulatory specificity** (2026 compliance): AGI format changed in 2026 (removed fields 062/063, added VAB day reporting). Age-based tax rate reductions (10.21% for 67+, 17.77% for ages 19–23 as of April 2026) require date-based logic, not hardcoded values.

**Recommendation:** Build in this sequence: (1) **Phase 0: Stability & Correctness** (security, role enforcement, date math, rate configuration), (2) **Phase 1: Leave & Absence Foundation**, (3) **Phase 2: Payroll Calculation & Recording**, (4) **Phase 3: Tax Reporting (AGI)**. Use custom TypeScript payroll module (no vendor lock-in), xmlbuilder2 for AGI XML export, keep pdf-lib + qpdf for FK form filling.

---

## Key Findings Summary

### From STACK.md: Technology Stack
- **Locked stack:** TypeScript throughout (Express, React, Vite, Drizzle, PostgreSQL) — no changes
- **Payroll module:** Custom TypeScript (2026 Skatteverket rates: 31.42% standard, 20.81% reduced for first 25k SEK) — simpler than vendor library
- **AGI export:** xmlbuilder2 v4.0.3 for XML generation, active maintenance, fluent API
- **Leave tracking:** Drizzle schema extension with PostgreSQL enums (sjuk, vab, semester, tjänstledigt, övrig)
- **PDF:** Keep pdf-lib v1.17.1 + qpdf system binary — form filling is correct use case, do NOT switch to Puppeteer
- **New libraries:** xmlbuilder2, swedish-holidays
- **Confidence:** MEDIUM-HIGH. Rates verified against official Skatteverket 2026. Exact AGI XML schema requires verification during Phase 3 implementation.

### From FEATURES.md: Feature Landscape
**Table Stakes (Must-Have for Compliance):**
- FK 3059/3057 form generation (auto-populates from approved entries, excludes absences, supports BankID signature)
- Payroll calculation with 31.42% employer contributions
- AGI monthly tax declaration (due 12th of month following payment; non-filing = 20–40% penalties)
- Leave/absence tracking (sjuk, vab, semester) auto-excluded from billable hours
- Monthly cost overview and overspending prevention
- Role-based authentication (guardian vs. assistant)
- Monthly form submission checklist

**Differentiators (High-Value, Not Required):**
- Automated absence exclusion from FK (reduces manual recalculation)
- Pre-filled AGI in Skatteverket format (guardian can upload directly)
- One-click form bundle download (FK + AGI print-ready)
- Payment recording and reconciliation (log vs. expected, flag mismatches)
- Payroll summary per assistant (hours, absence, gross, contributions, deductions)
- Monthly compliance checklist (in-app task list)
- Email/SMS deadline reminders

**Anti-Features (Out of Scope):**
- Real-time chat (use email/Slack)
- Integrated bank payment (guardian transfers manually)
- Expense receipt storage (not FK/Skatteverket requirement)
- Multi-language support (forms are Swedish-only by law)
- Direct API filing without human signature (FK requires physical signatures; AGI can be digital but requires guardian BankID)

**MVP Recommendation:** Prioritize Payroll + AGI + Leave over differentiators. Guardian cannot file with authorities without correct payroll and tax calculations.

### From ARCHITECTURE.md: System Design
**Recommended Architecture:** Layered monorepo with service modules for absences, payroll, and tax reporting. Critical design principle: **Multi-tenant data isolation**.

**Key Components:**

| Module | Inputs | Outputs | Dependency |
|--------|--------|---------|------------|
| Absence Module | Absence record (type, dates, duration) | Exclusion of non-billable hours | — |
| Billable Hours Service | Approved entries + absences | Net billable hours per month | Depends on Absence Module |
| Payroll Module | Billable hours + hourly rate + age-based tax rates | Payroll records (gross, contributions, deductions) | Depends on Billable Hours Service |
| Tax Reporting Module | Payroll records + absence data (VAB days) | AGI line items (Skatteverket format) | Depends on Payroll Module + Absence Module |

**Build Order (Dependency Chain):**
1. **Phase 0: Stability & Correctness** — Fix multi-tenant scoping, role enforcement, FK date bugs, rate configuration
2. **Phase 1: Leave & Absence Foundation** — Schema, CRUD routes, billable hours exclusion
3. **Phase 2: Payroll Calculation & Recording** — Service layer, 2026 tax rates, approval workflow
4. **Phase 3: Tax Reporting (AGI)** — XML export, Skatteverket format validation, line item generation

**Multi-Tenant Scoping Pattern (Mandatory for All New Routes):**
```typescript
// CORRECT: Every query filters by guardianId
const records = await db.select().from(table)
  .where(and(
    eq(table.guardianId, guardianId),  // MANDATORY
    eq(table.month, month)
  ));

// WRONG: No guardian filter = data leak across tenants
const records = await db.select().from(table)
  .where(eq(table.month, month));
```

**Immutable Payroll Records:** Once approved, records are locked (status: draft → approved → locked). Corrections tracked as separate adjustment records for audit trail.

### From PITFALLS.md: Critical Risks & Mitigation

**5 Critical Pitfalls Blocking Compliance:**

1. **Guardian Data Leaking Across Multi-Tenant Boundaries** (Pitfall #1)
   - Current state: Role middleware defined but not enforced server-side
   - Risk: Guardian A sees Guardian B's payroll, absences, entries
   - Prevention: Enforce `guardian_id` filter in ALL Drizzle queries; write concurrent access tests
   - Phase: Stability & Correctness (before payroll features launch)

2. **FK Form Date Range Bugs** (Pitfall #2)
   - Current bug: FK 3057 uses hardcoded `day 31`; breaks for February and 30-day months
   - Risk: February entries excluded, May entries leak into April, double-billing or under-payment
   - Prevention: Use dynamic month-end (date-fns `lastDayOfMonth`); regression tests for Feb, April, Dec
   - Phase: Stability & Correctness (critical bug before any FK filing)

3. **Hardcoded FK Hourly Rate and Tax Rate** (Pitfall #3)
   - Current state: 334 SEK rate and 31.42% tax hardcoded in Reports component
   - Risk: When FK updates rates annually, platform requires re-deploy; guardian pays incorrect amounts
   - Prevention: Move to settings table; add rate-change alerts; version rates in payroll records
   - Phase: Payroll Calculation (during rate config implementation)

4. **Absence/Leave Deductions Not Properly Excluded** (Pitfall #4)
   - Current state: No absence tracking yet; future bug when feature added
   - Risk: Guardian invoices absence hours to FK, inflating costs; AGI over-reports wages
   - Prevention: Mandatory `absence_type` field; validate billable hours before form generation
   - Phase: Leave & Absence (before FK form generation updates)

5. **Field Name Inconsistency (camelCase vs snake_case)** (Pitfall #5)
   - Current bug: Hours page accesses `req_status` (snake_case) but API returns `reqStatus` (camelCase)
   - Risk: Silent data bugs; regressions when refactoring
   - Prevention: Define TypeScript types for all API responses; enable strict mode
   - Phase: Stability & Correctness (tech debt blocking safe refactoring)

**6 Moderate Pitfalls:**
- Role middleware not enforced server-side (Pitfall #6)
- AGI field format mismatches (Pitfall #7) — Skatteverket rejects if date format, decimals, lengths wrong
- Multi-assistant payroll aggregation errors (Pitfall #8) — GROUP BY without guardianId, floating-point rounding
- No input validation on API routes (Pitfall #10) — Zod installed but unused
- N+1 query problems (Pitfall #11) — Open slots endpoint slow as slot count grows
- Self-booking race condition (Pitfall #12) — Two assistants simultaneously exceed capacity

**4 Minor Pitfalls:**
- Missing indexes on high-query tables (Pitfall #13)
- PDF generation fragility (Pitfall #14) — qpdf binary path hardcoded to macOS Homebrew
- Google OAuth CSRF vulnerability (Pitfall #15) — /api/gcal/callback doesn't validate state parameter

---

## Implications for Roadmap

### Recommended Phase Structure

**Phase 0: Stability & Correctness (1–2 sprints)**
- Enforce role middleware server-side on all routes
- Fix FK 3057 date range bug (use dynamic month-end calculation)
- Move FK hourly rate and employer tax rate to configurable settings table
- Define TypeScript response types for all API endpoints; enable strict mode
- Implement multi-tenant data isolation test suite (concurrent requests from two guardian accounts)
- Fix camelCase/snake_case inconsistency in Hours page

**Deliverables:** Security enforced, FK date math correct, type safety, multi-tenant test suite.

---

**Phase 1: Leave & Absence Foundation (2 sprints)**
- Create absences table schema (guardianId, assistantId, absenceType enum, dateStart, dateEnd, durationDays)
- Implement absence CRUD routes (POST, GET, PUT, DELETE)
- Extend Billable Hours Service: subtract absence hours from approved entries
- Update FK 3059 generation to use net billable hours (excluding absences)
- Guardian UI: absence management page, visual separation of absence vs. worked hours
- Implement holiday balance tracking (25 days/year, accrual per month)

**Deliverables:** Guardian can record VAB, sick leave, holidays; FK 3059 hours automatically exclude absences; balance visible.

---

**Phase 2: Payroll Calculation & Recording (2–3 sprints)**
- Create payroll_records and payroll_adjustments schema
- Implement PayrollService with 2026 Swedish contribution rates:
  - Standard rate: 31.42%
  - Age ≥ 67: 10.21% (pension-only)
  - Age 19–23 (April 2026+): 17.77% (youth reduction)
- Add payroll routes (GET monthly summary, POST approval, PUT adjustments)
- Monthly payroll calculation: hours × rate + contributions − deductions
- Implement immutable record locking (status: draft → approved → locked)
- Guardian UI: monthly payroll per assistant (hours, gross, contributions, deductions), approval workflow
- Reconciliation: monthly cost overview must match payroll total

**Deliverables:** Guardian sees monthly payroll per assistant, can approve, adjustments tracked for audit.

---

**Phase 3: Tax Reporting (AGI) & PDF Export (2 sprints)**
- Create tax_declarations and tax_line_items schema
- Implement TaxReportService: consume payroll_records + absence data, generate AGI line items
- 2026 compliance: exclude fields 062/063, include VAB days (new requirement), exclude growth support
- Add tax routes (GET declarations by month/year, POST generate, GET export)
- Extend PDF module to render AGI form (or CSV/XML export for Skatteverket upload)
- Guardian UI: AGI download, submission deadline tracking, confirmation when submitted
- Format validation: verify field lengths, decimal places, date formats against Skatteverket specification

**Deliverables:** Guardian downloads print-ready AGI form (or structured export), ready to submit to Skatteverket by 12th of month.

---

**Phase 4: UX & Compliance Polish (1–2 sprints) — Optional before v1 launch**
- Email/SMS deadline reminders (FK forms due 5th, AGI due 12th)
- Monthly compliance checklist (in-app task list: approve entries, generate forms, verify totals)
- Payroll summary report per assistant (printable invoice-style: hours, rate, gross, contributions, net)
- One-click form bundle download (FK 3059, 3057, AGI as single PDF or zip)
- Copy-previous-week schedule shortcut (populate new week from prior week template)
- Multi-week schedule grid view (all assistants' shifts in single month/week grid)
- Payment recording and reconciliation (log actual payments; compare to calculated gross; flag unpaid balances)

---

### Roadmap Dependencies

```
Phase 0: Stability & Correctness
  ↓
Phase 1: Leave & Absence Foundation
  ↓
Phase 2: Payroll Calculation
  ↓
Phase 3: Tax Reporting (AGI)
  ↓
Phase 4: UX Polish (optional)
```

**Cannot advance to Phase 2 without Phase 1** because billable hours = approved hours − absence hours.
**Cannot advance to Phase 3 without Phase 2** because AGI consumes payroll records and VAB data.

---

## Research Flags: Which Phases Need Deeper Validation

### High Confidence (No Additional Research Needed):
- **Phase 0 (Stability & Correctness):** Bugs documented in codebase. Fixes are standard patterns (role enforcement, date math, configuration tables, TypeScript types).
- **Phase 1 (Leave & Absence):** Absence types (sjuk, vab, semester) from Swedish labor law and LSS regulations. Schema design is standard HR pattern.
- **Phase 2 (Payroll Calculation):** 2026 tax rates from official Skatteverket documentation. Calculation logic is straightforward arithmetic.

### Medium Confidence (Validation During Implementation):
- **Phase 3 (Tax Reporting):** Exact AGI XML schema for 2026 requires verification against official Skatteverket technical documentation. Field mappings (personnummer, decimal places, date format) must be tested against real Skatteverket submission or sandbox.
- **VAB Day Calculation:** If assistant takes VAB across month boundaries, how many days count in each month? Need product owner clarification.
- **Preliminärskatt Configuration:** Is tax deduction per-guardian, per-assistant, or per-month? Confirm with FK reporting requirements.
- **Holiday Balance Accrual:** Swedish vacation = 25 days/year. Clarify accrual logic (per month vs. per year), carryover limits, year-end rollover.

### Lower Confidence (Phase 3+ Deep Dive Recommended):
- **Skatteverket e-service API Integration:** Currently out of scope (forms are print-and-submit). If guardian wants to file digitally, clarify which fields map to e-service API and whether full AGI XML accepted.
- **FK Form Signature Requirements:** Guardian and each assistant must digitally sign FK 3059. Current implementation does not handle signatures. Clarify signature workflow (BankID integration).
- **Multi-Month Audit Bundle:** Guardian may need to export all forms and payroll records for a month (for audits by FK or tax authorities). Clarify export format, data retention, archival.

---

## Confidence Assessment

| Area | Confidence | Basis | Gaps |
|------|------------|-------|------|
| **Stack & Technology** | **HIGH** | 2026 Skatteverket rates verified. Libraries (xmlbuilder2, swedish-holidays) maintained and appropriate. Custom payroll module simpler than vendor lock-in. | Exact Skatteverket AGI XML schema v2026 not fully validated (requires official technical docs). Puppeteer vs. pdf-lib performance untested on large batch runs. |
| **Features & MVP Scope** | **MEDIUM-HIGH** | Features derived from FK guidance, Skatteverket tax rules, Swedish employment law (LSS). Existing competitor systems (Coordinare, FAST, Aiai) benchmarked for differentiators. | Feature dependencies validated; but product owner must confirm prioritization. Payment recording workflow unclear (manual vs. automated reconciliation). |
| **Architecture & Data Isolation** | **MEDIUM-HIGH** | Multi-tenant isolation pattern is industry-standard Row-Level Isolation design. Service layer pattern proven. Drizzle + PostgreSQL scalable to 10K+ users. | Current codebase has undocumented data leakage bugs; isolation test suite must be written before multi-tenant feature launch. Payroll approval workflow sequencing needs product owner confirmation. |
| **Pitfalls & Risk Mitigation** | **MEDIUM** | Critical pitfalls identified from code inspection (date bugs, hardcoded rates, role enforcement). Moderate pitfalls derived from general SaaS and payroll patterns. | Exact failure modes of FK 3057 date bug not reproduced (February/April test data needed). AGI format rejection scenarios not tested against real Skatteverket environment. Floating-point rounding error not quantified. |
| **2026 Swedish Compliance** | **MEDIUM** | Age-based tax rate changes from official Skatteverket. VAB reporting requirement from official FSK/Skatteverket coordination. AGI field removals from official announcements. | VAB day calculation edge cases (cross-month VAB, partial days) need clarification. Whether VAB is "absence" (reduces billable hours) vs. "paid leave" (reduces gross differently) is unclear. Preliminärskatt configuration must be confirmed with FK. |

**Overall Confidence: MEDIUM-HIGH**

Research provides solid roadmap with well-defined phases, clear dependencies, and identified risks. Technology stack locked and proven. Biggest gaps: exact Skatteverket AGI format validation, product owner confirmation on feature prioritization, VAB and preliminärskatt edge cases.

**Recommendation:** Proceed with Phase 0 immediately. Flag Phase 3 for formal Skatteverket schema validation during sprint planning.

---

## Next Steps (For Roadmapper)

1. **Confirm Phase Prioritization:** Get product owner sign-off on sequence. Can Phase 0 be combined with Phase 1? Is payroll summary per assistant required for v1, or deferred to Phase 4?

2. **Clarify Edge Cases Before Phase 2 Starts:**
   - VAB day calculation if crossing month boundaries
   - Preliminärskatt configuration (per-guardian, per-assistant, or per-month)
   - Holiday balance accrual rules (carryover limits, year-end rollover)
   - FK form signature workflow (BankID for individual signatures)

3. **Flag Phase 3 for Formal Schema Validation:**
   - Obtain latest Skatteverket AGI technical specification
   - Test AGI XML generation against Skatteverket sandbox (if available)
   - Verify field formats (personnummer, dates, decimals) match official requirements

4. **Security Review Before Phase 2:**
   - Write and run multi-tenant data isolation test suite (Phase 0 must include this)
   - Code audit for role enforcement on all new routes
   - Penetration testing for data leakage scenarios

5. **Dependency Graph for Implementation:**
   - Phase 0 blocks Phase 1
   - Phase 1 blocks Phase 2
   - Phase 2 blocks Phase 3
   - Phases 0–2 sequential; Phase 4 (UX Polish) can proceed in parallel with Phase 3 if resources allow

---

## Sources (Aggregated from All Research Files)

### Swedish Regulatory Authority Sources
- [Försäkringskassan: Assistansersättning vägledning 2003:6 Version 35](https://www.forsakringskassan.se/)
- [Försäkringskassan: FK 3059 Time Reporting Form](https://assistanskoll.se/_up/3059-tidredovisning-for-assistansersattning.pdf)
- [Försäkringskassan: FK 3057 Instructions](https://assistanskoll.se/_up/ifyllnad-3057.pdf)
- [Skatteverket: Arbetsgivardeklaration på individnivå (AGI)](https://www.skatteverket.se/foretag/arbetsgivare/lamnaarbetsgivardeklaration.4.41f1c61d16193087d7fcaeb.html)
- [Skatteverket: Employer contributions 2026](https://www.skatteverket.se/)

### Architecture & SaaS Patterns
- [Multi-Tenant SaaS Testing Guide 2026](https://blog.qatestlab.com/)
- [Multi-Tenant Data Isolation & Row-Level Security](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)

### Technology Documentation
- [xmlbuilder2 - npm](https://www.npmjs.com/package/xmlbuilder2)
- [swedish-holidays - GitHub](https://github.com/Pythe1337N/swedish-holidays)
- [Drizzle ORM](https://orm.drizzle.team/)

### Payroll & Tax References
- [Mercans: Sweden Employer Social Contribution Rules 2026](https://mercans.com/)
- [Fortnox: AGI Documentation](https://www.fortnox.se/)
- [Assistanskoll: Personal Assistance Information Portal](https://assistanskoll.se/)

### Competitors
- [Coordinare](https://www.coordinare.se/sv)
- [FAST](https://fasttid.se/)
- [Aiai](https://aiai.se/)

---

**Research synthesis complete. Ready for roadmapper intake.**

*Last updated: 2026-04-06*
