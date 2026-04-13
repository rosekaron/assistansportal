# Kalinga Assistansportal — Roadmap

**Project:** Swedish personal assistance (assistansersättning) self-management platform with compliance and payroll integration
**Version:** v1 — Stability, Compliance, and Core Payroll
**Phases:** 7
**Granularity:** Standard (5-8 phases)
**Coverage:** 15/15 v1 requirements mapped
**Last Updated:** 2026-04-11

---

## Phases

- [x] **Phase 1: Stability & Correctness** — Fix critical security, data isolation, and calculation bugs before adding features (completed 2026-04-06)
- [x] **Phase 2: Leave & Absence Foundation** — Implement absence tracking so billable hours can be calculated correctly downstream (completed 2026-04-06)
- [x] **Phase 2.5: UI Overhaul & Design System** — Fix Tailwind CSS rendering, rebuild visual design to B2B-ready care.com-inspired standard for both guardian and assistant views (completed 2026-04-08)
- [x] **Phase 3: Payroll Calculation & Recording** — Monthly payroll per assistant with 2026 Swedish tax rates and employer contributions (completed 2026-04-10)
- [ ] **Phase 3.5: UX Consolidation & IA Redesign** — Audit all pages, consolidate features by user goal, produce formal UI-SPEC with one-page-one-purpose information architecture
- [x] **Phase 4: Tax Reporting (AGI)** — Generate Skatteverket-ready AGI declarations per month (completed 2026-04-11)
- [ ] **Phase 5: Scheduling & Compliance Workflow** — Multi-assistant schedule grid, monthly compliance checklist, and deadline reminders
- [ ] **Phase 6: Google Calendar Integration** — Real OAuth2 connection to Google Calendar with calendar picker, replacing the simulated connect flow

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
- [x] 02-01-PLAN.md — Wave 0: failing test stubs for LEAV-01, LEAV-02, LEAV-03 (3 test files)
- [x] 02-02-PLAN.md — Wave 1: absences table + absenceTypeEnum + reqStatusEnum "cancelled" + drizzle-kit push
- [x] 02-03-PLAN.md — Wave 2: absences CRUD routes + FK billing exclusion + assistant clock-in block
- [x] 02-04-PLAN.md — Wave 3: Frånvaro page + balance cards + sidebar nav + Assistants page integration

---

### Phase 2.5: UI Overhaul & Design System

**Goal:** Fix the broken Tailwind CSS build and rebuild the visual design to a B2B-ready, care.com-inspired professional standard suitable for both self-managing guardians and enterprise sale to care organisations (Humana, Attendo). Covers both guardian and assistant views.

**Depends on:** Phase 2

**Requirements:** No functional requirements — pure UI/UX quality phase

**Success Criteria** (what must be TRUE):
1. Tailwind utility classes render correctly in the browser (flex layouts, colors, shadows all applied)
2. Guardian sidebar and page layouts look professional and trust-inspiring — appropriate for a B2B demo to a care organisation
3. Assistant dashboard is visually polished and clearly communicates shift information
4. All pages use consistent typography, spacing, and color tokens
5. The design system is ready to support Phase 3 payroll UI without visual debt

**Plans:** 5/5 plans complete

Plans:
- [x] 02.5-01-PLAN.md — Wave 1: Fix Tailwind ESM/CJS bug (tailwind.config.js require() → import) — unblocks all visual work
- [x] 02.5-02-PLAN.md — Wave 2: Update index.css colour tokens to B2B professional palette
- [x] 02.5-03-PLAN.md — Wave 3: Redesign guardian Layout.tsx sidebar + Dashboard.tsx card layout (parallel with 02.5-04)
- [x] 02.5-04-PLAN.md — Wave 3: Redesign AssistantDashboard.tsx — eliminate dark-mode artefacts, apply light theme (parallel with 02.5-03)
- [x] 02.5-05-PLAN.md — Wave 4: Consistency pass across Leave, Login, Calendar, Reports, Assistants, Settings

---

### Phase 3: Payroll Calculation & Recording

**Goal:** Guardian can view and approve monthly payroll per assistant, with correct 2026 Swedish tax rates and employer contributions, and record actual payments made.

**Depends on:** Phase 2

**Requirements:** PAY-01, PAY-02, PAY-03

**Success Criteria** (what must be TRUE):
1. Guardian sees a monthly payroll summary showing: billable hours, absence hours by type, gross pay (hours × rate), employer contributions (31.42% standard rate), and total cost per assistant
2. Guardian can approve payroll records; once approved, records are locked and changes tracked as separate adjustments for audit trail
3. Guardian can record payments made to an assistant (date, amount, method) and the system shows outstanding balance vs. calculated gross pay

**Plans:** 4 plans

Plans:
- [x] 03-01-PLAN.md — Wave 0: failing test stubs for PAY-01, PAY-02, PAY-03 (3 test files, RED state)
- [x] 03-02-PLAN.md — Wave 1: payroll-utils.ts pure functions + schema.ts payrollRecords/payments tables + drizzle-kit push (PAY-01)
- [x] 03-03-PLAN.md — Wave 2: payroll.ts + payments.ts Express routes + index.ts registration (PAY-01, PAY-02, PAY-03)
- [x] 03-04-PLAN.md — Wave 3: Payroll.tsx page + api.ts types/helpers + App.tsx + Layout.tsx nav (PAY-02, PAY-03)

---

### Phase 3.5: UX Consolidation & IA Redesign

**Goal:** Audit every existing page, consolidate features by user goal, and produce a formal UI-SPEC that defines the new information architecture — one page per purpose, no orphaned features. Includes V1 features: clock-in/out (verified presence) and multi-family support.

**Depends on:** Phase 3

**Requirements:** No functional requirements — UX/IA quality phase + V1 assistant features

**Success Criteria** (what must be TRUE):
1. Every page has a single, clearly stated purpose; no page contains features that belong on another page
2. Navigation structure reflects the guardian's actual workflow (not implementation order)
3. Assistant can clock in and clock out; clock-out auto-creates a verified shift report
4. Assistants working for multiple families can select their active family context
5. All existing features are accounted for — either consolidated, relocated, or explicitly cut from MVP scope

**Plans:** 10 plans

Plans:
- [x] 03.5-01-PLAN.md — Wave 1: DB schema additions — clockEvents + assistantGuardianLinks tables + drizzle-kit push
- [x] 03.5-02-PLAN.md — Wave 2: Clock API routes (POST /api/clock/in, /out, GET /status)
- [x] 03.5-03-PLAN.md — Wave 2: Multi-family link API routes (GET /api/guardian-links, POST create + accept)
- [x] 03.5-04-PLAN.md — Wave 3: Route restructure — App.tsx 4-route IA + Layout.tsx 4-item nav + legacy redirects
- [x] 03.5-05-PLAN.md — Wave 4: New Home.tsx (schedule grid + pending actions + mark absent dialog)
- [x] 03.5-06-PLAN.md — Wave 4: New Monthly.tsx (3-step stepper: reports + payroll + FK; Verified badge)
- [x] 03.5-07-PLAN.md — Wave 4: New Records.tsx (read-only history: Payroll | FK Submissions | Leave tabs)
- [x] 03.5-08-PLAN.md — Wave 4: Update Settings.tsx (embed Assistants section + GCal setup guide card)
- [x] 03.5-09-PLAN.md — Wave 5: Redesign AssistantDashboard.tsx (clock-in hero + family selector + tabs)
- [x] 03.5-10-PLAN.md — Wave 6: Phase verification checkpoint (TypeScript + server tests + human walkthrough)

---

### Phase 4: Tax Reporting (AGI)

**Goal:** Guardian can generate and download pre-filled Skatteverket blankett 4805 (Förenklad arbetsgivardeklaration) PDFs per assistant per month, with corrected payroll formula and preliminary tax rate configured in Settings.

**Depends on:** Phase 3

**Requirements:** TAX-01, TAX-02

**Success Criteria** (what must be TRUE):
1. System generates a filled blankett 4805 PDF per assistant for a given month, including: personnummer, gross salary, employer contributions, and withheld preliminary tax (preliminärskatt) — all figures derived from approved payroll_records
2. Guardian can download the filled 4805 PDF per assistant from Monthly.tsx Step 4, gated on all payroll being approved
3. Payroll formula is corrected: gross = (billableHours × hourlyRate − costs) / (1 + taxRate)
4. Guardian can configure preliminary tax rate in Settings; rate is snapshotted into payroll_records at generation time

**Plans:** 3/3 plans complete

Plans:
- [x] 04-01-PLAN.md — Wave 1: Schema columns (prelim_tax_rate_snapshot + assistants.address) + corrected payroll-utils.ts formula + payroll.ts route update + db:push + recalculate drafts (TAX-01)
- [x] 04-02-PLAN.md — Wave 2: form4805-utils.ts pure field mapping + POST /api/pdf/4805 endpoint + pdfApi.form4805 helper (TAX-01, TAX-02)
- [x] 04-03-PLAN.md — Wave 3: Monthly.tsx Step 4 per-assistant download buttons + Settings.tsx prelim tax rate field + assistant address edit dialog + human verification checkpoint (TAX-01, TAX-02)

---

### Phase 5: Scheduling & Compliance Workflow

**Goal:** Guardian has a unified view of all assistants' shifts, a monthly compliance checklist of compliance steps, and automated deadline reminders so the full compliance cycle is manageable in one tool.

**Depends on:** Phase 4

**Requirements:** SCHED-01, COMP-01, COMP-02

**Success Criteria** (what must be TRUE):
1. Guardian can view a week/month grid showing all assistants' scheduled and logged shifts in a single calendar view without switching between assistants
2. Guardian sees a monthly compliance checklist showing required steps (approve time entries, generate FK 3059, generate FK 3057, generate AGI) with completion status and regulatory due dates (FK: 5th of second following month; AGI: 12th of following month)
3. System sends email reminders to the guardian on a configurable date each month with links to pending forms and step-by-step next actions

**Plans:** 4 plans

Plans:
- [ ] 05-01-PLAN.md — Wave 0: Test stubs for deadlineUtils and reminderCron (COMP-01, COMP-02)
- [ ] 05-02-PLAN.md — Wave 1: Home.tsx assistant-row schedule table + week navigation (SCHED-01)
- [ ] 05-03-PLAN.md — Wave 1: deadlineUtils implementation + Monthly.tsx deadline badges (COMP-01)
- [ ] 05-04-PLAN.md — Wave 2: reminderCron implementation + email.ts + Settings.tsx Notifications card + human checkpoint (COMP-02)

---

### Phase 6: Google Calendar Integration

**Goal:** Guardian can connect their real Google Calendar via OAuth2, choose which calendar to sync, and have shift entries automatically reflected as calendar events.

**Depends on:** Phase 5

**Requirements:** GCAL-01

**Success Criteria** (what must be TRUE):
1. Clicking "Connect" in Settings redirects to Google OAuth consent screen (not a simulation)
2. After approving, guardian is returned to Settings and shown a dropdown of their actual Google calendars to choose from
3. Selected calendar ID is saved and used for all subsequent event operations
4. Disconnect clears all tokens and calendar linkage

**Plans:** 1 plan

Plans:
- [ ] 06-01-PLAN.md — Fix OAuth redirect, add /calendars endpoint, wire real connect/disconnect/picker in Settings (Wave 1)

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Stability & Correctness | 4/4 | Complete | 2026-04-06 |
| 2. Leave & Absence Foundation | 4/4 | Complete | 2026-04-06 |
| 2.5. UI Overhaul & Design System | 5/5 | Complete   | 2026-04-08 |
| 3. Payroll Calculation & Recording | 4/4 | Complete | 2026-04-10 |
| 3.5. UX Consolidation & IA Redesign | 0/10 | Not started | — |
| 4. Tax Reporting (AGI) | 3/3 | Complete   | 2026-04-11 |
| 5. Scheduling & Compliance Workflow | 0/TBD | Not started | — |
| 6. Google Calendar Integration | 0/1 | Not started | — |

---

## Dependencies

```
Phase 1: Stability & Correctness (foundation)
  ↓
Phase 2: Leave & Absence (enables correct billable hours calculation)
  ↓
Phase 2.5: UI Overhaul & Design System (visual foundation for Phase 3 payroll UI)
  ↓
Phase 3: Payroll Calculation (depends on billable hours + absences)
  ↓
Phase 3.5: UX Consolidation & IA Redesign (new IA + clock-in/out + multi-family)
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

**Coverage:** 15/15 requirements mapped

---

*Roadmap created: 2026-04-06*
*Phase 1 planned: 2026-04-06 — 4 plans, 3 waves*
*Phase 2 planned: 2026-04-06 — 4 plans, 4 waves*
*Phase 2.5 planned: 2026-04-07 — 5 plans, 4 waves*
*Phase 3 planned: 2026-04-10 — 4 plans, 4 waves*
*Phase 3.5 planned: 2026-04-11 — 10 plans, 6 waves*
*Phase 4 planned: 2026-04-11 — 3 plans, 3 waves*
*Phase 6 planned: 2026-04-12 — 1 plan, 1 wave*
