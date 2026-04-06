# Kalinga Assistansportal — Roadmap

**Project:** Swedish personal assistance (assistansersättning) self-management platform with compliance and payroll integration
**Version:** v1 — Stability, Compliance, and Core Payroll
**Phases:** 5
**Granularity:** Standard (5-8 phases)
**Coverage:** 15/15 v1 requirements mapped
**Last Updated:** 2026-04-06

---

## Phases

- [x] **Phase 1: Stability & Correctness** — Fix critical security, data isolation, and calculation bugs before adding features (completed 2026-04-06)
- [ ] **Phase 2: Leave & Absence Foundation** — Implement absence tracking so billable hours can be calculated correctly downstream
- [ ] **Phase 3: Payroll Calculation & Recording** — Monthly payroll per assistant with 2026 Swedish tax rates and employer contributions
- [ ] **Phase 4: Tax Reporting (AGI)** — Generate Skatteverket-ready AGI declarations per month
- [ ] **Phase 5: Scheduling & Compliance Workflow** — Multi-assistant schedule grid, monthly compliance checklist, and deadline reminders

---

## Phase Details

### Phase 1: Stability & Correctness

**Goal:** Guardian and assistant data is secure, calculations are accurate, and the platform is safe to extend with new features.

**Depends on:** Nothing (foundational phase)

**Requirements:** STAB-01, STAB-02, STAB-03, STAB-04

**Success Criteria** (what must be TRUE):
1. Server rejects any assistant API call to a guardian-only endpoint (role middleware enforced on all protected routes)
2. FK 3057 form correctly calculates the last day of the reporting month (no hardcoded day 31 bug for February/April)
3. Guardian can view and modify FK hourly rate and employer tax rate (arbetsgivaravgifter) in Settings without code deploy
4. All API response types are defined in TypeScript; client code consistently accesses fields by their correct camelCase names

**Plans:** 4/4 plans complete

Plans:
- [x] 01-01-PLAN.md — Vitest test framework setup and failing test stubs for all 4 STAB requirements (Wave 0)
- [x] 01-02-PLAN.md — Role middleware enforcement on all guardian routes + error sanitization (STAB-01)
- [x] 01-03-PLAN.md — FK 3057 date fix + JWT startup guard + dev-verify gate + /api/rates endpoint (STAB-02, STAB-03)
- [x] 01-04-PLAN.md — Client camelCase types + Hours.tsx/Reports.tsx migration + rate consumption (STAB-04)

---

### Phase 2: Leave & Absence Foundation

**Goal:** Guardians can record when assistants are absent (sick leave, VAB, holiday) and these absences automatically reduce billable hours in FK reports.

**Depends on:** Phase 1

**Requirements:** LEAV-01, LEAV-02, LEAV-03

**Success Criteria** (what must be TRUE):
1. Guardian can record an assistant absence with type (sjukfrånvaro, VAB, semester, other), start date, and end date
2. Hours marked as absence are automatically excluded when FK 3059 and FK 3057 forms calculate total billable hours
3. Guardian can view remaining VAB balance (max 120 days/year) and sick leave accrual per assistant on a single visibility page

**Plans:** 4 plans

Plans:
- [ ] 02-01-PLAN.md — Wave 0: failing test stubs for LEAV-01, LEAV-02, LEAV-03 (3 test files)
- [ ] 02-02-PLAN.md — Wave 1: absences table + absenceTypeEnum + reqStatusEnum "cancelled" + drizzle-kit push
- [ ] 02-03-PLAN.md — Wave 2: absences CRUD routes + FK billing exclusion + assistant clock-in block
- [ ] 02-04-PLAN.md — Wave 3: Frånvaro page + balance cards + sidebar nav + Assistants page integration

---

### Phase 3: Payroll Calculation & Recording

**Goal:** Guardian can view and approve monthly payroll per assistant, with correct 2026 Swedish tax rates and employer contributions, and record actual payments made.

**Depends on:** Phase 2

**Requirements:** PAY-01, PAY-02, PAY-03

**Success Criteria** (what must be TRUE):
1. Guardian sees a monthly payroll summary showing: billable hours, absence hours by type, gross pay (hours × rate), employer contributions (31.42% standard rate), and total cost per assistant
2. Guardian can approve payroll records; once approved, records are locked and changes tracked as separate adjustments for audit trail
3. Guardian can record payments made to an assistant (date, amount, method) and the system shows outstanding balance vs. calculated gross pay

**Plans:** TBD

**UI hint**: yes

---

### Phase 4: Tax Reporting (AGI)

**Goal:** Guardian can generate and download Skatteverket-ready AGI (arbetsgivardeklaration på individnivå) tax declarations for monthly submission.

**Depends on:** Phase 3

**Requirements:** TAX-01, TAX-02

**Success Criteria** (what must be TRUE):
1. System generates AGI line item per assistant with: personnummer, gross salary, employer contributions, preliminary tax (preliminärskatt), and VAB days used (2026 format compliance)
2. Guardian can download AGI data in Skatteverket-ready format (structured export) with correct field lengths, decimal places, and date formats ready for submission

**Plans:** TBD

---

### Phase 5: Scheduling & Compliance Workflow

**Goal:** Guardian has a unified view of all assistants' shifts, a monthly checklist of compliance steps, and automated deadline reminders so the full compliance cycle is manageable in one tool.

**Depends on:** Phase 4

**Requirements:** SCHED-01, COMP-01, COMP-02

**Success Criteria** (what must be TRUE):
1. Guardian can view a week/month grid showing all assistants' scheduled and logged shifts in a single calendar view without switching between assistants
2. Guardian sees a monthly compliance checklist showing required steps (approve time entries, generate FK 3059, generate FK 3057, generate AGI) with completion status and regulatory due dates (FK: 5th of second following month; AGI: 12th of following month)
3. System sends email reminders to the guardian on a configurable date each month with links to pending forms and step-by-step next actions

**Plans:** TBD

**UI hint**: yes

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Stability & Correctness | 4/4 | Complete   | 2026-04-06 |
| 2. Leave & Absence Foundation | 0/4 | In progress | — |
| 3. Payroll Calculation & Recording | 0/3 | Not started | — |
| 4. Tax Reporting (AGI) | 0/3 | Not started | — |
| 5. Scheduling & Compliance Workflow | 0/3 | Not started | — |

---

## Dependencies

```
Phase 1: Stability & Correctness (foundation)
  ↓
Phase 2: Leave & Absence (enables correct billable hours calculation)
  ↓
Phase 3: Payroll Calculation (depends on billable hours + absences)
  ↓
Phase 4: Tax Reporting (depends on payroll records and VAB data)
  ↓
Phase 5: Scheduling & Compliance (can proceed in parallel with Phase 4, depends on Payroll foundation)
```

**Critical dependency chains:**
- **Phase 2 must complete before Phase 3** — billable hours = approved hours − absence hours
- **Phase 3 must complete before Phase 4** — AGI consumes payroll records and VAB data
- **Phase 1 must complete before any other feature phase** — security and data isolation are foundational

---

## Requirement Traceability

| Requirement | Phase | Category | Status |
|-------------|-------|----------|--------|
| STAB-01 | 1 | Stability & Correctness | Pending |
| STAB-02 | 1 | Stability & Correctness | Pending |
| STAB-03 | 1 | Stability & Correctness | Pending |
| STAB-04 | 1 | Stability & Correctness | Pending |
| LEAV-01 | 2 | Leave & Absence | Pending |
| LEAV-02 | 2 | Leave & Absence | Pending |
| LEAV-03 | 2 | Leave & Absence | Pending |
| PAY-01 | 3 | Payroll | Pending |
| PAY-02 | 3 | Payroll | Pending |
| PAY-03 | 3 | Payroll | Pending |
| TAX-01 | 4 | Tax Reporting | Pending |
| TAX-02 | 4 | Tax Reporting | Pending |
| SCHED-01 | 5 | Scheduling | Pending |
| COMP-01 | 5 | Compliance Workflow | Pending |
| COMP-02 | 5 | Compliance Workflow | Pending |

**Coverage:** 15/15 requirements mapped ✓

---

*Roadmap created: 2026-04-06*
*Phase 1 planned: 2026-04-06 — 4 plans, 3 waves*
*Phase 2 planned: 2026-04-06 — 4 plans, 4 waves*

---

## Backlog

Items captured during discuss-phase that are deferred from v1 scope.

### BACKLOG-01: Full Route Test Coverage
**Captured:** 2026-04-06 (Phase 1 discuss-phase)
**Scope:** 100% line coverage of all user-facing API routes (~50 endpoints across 9 route files). Includes complex routes requiring test infrastructure for qpdf binary mocking (PDF routes), Google OAuth token mocking (GCal routes), and Nodemailer mocking (auth routes).
**Estimated effort:** ~16 days
**Trigger:** After Phase 1 ships and test framework is in place. Can be addressed as Phase 1b or folded into Phase 2+.

### BACKLOG-02: Configurable Rate Settings UI
**Captured:** 2026-04-06 (Phase 1 discuss-phase)
**Scope:** Guardian-editable FK hourly rate and employer tax rate from the Settings page, persisted in DB, no server restart required. Currently deferred in favour of env-var approach.
**Trigger:** B2B expansion or multi-country milestone, when rate variation across guardian accounts becomes necessary.

### BACKLOG-03: Multi-Country / European Expansion
**Captured:** 2026-04-06 (Phase 1 discuss-phase)
**Scope:** Strategic review of user stories and roadmap for operating in multiple European countries beyond Sweden. Involves compliance framework differences, multi-language support, and regulatory adaptations per country.
**Trigger:** Post-v1, when the Swedish single-family use case is validated and B2B/SaaS growth is the next horizon.
