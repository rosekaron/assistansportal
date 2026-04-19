# Kalinga — Assistansportal

## Current State (2026-04-19)

**Shipped:** v1.0 — Stability, Compliance, and Core Payroll
**Git tag:** `v1.0` (archive commit on branch `milestone/v1.0-mvp`)
**Active milestone:** v1.0.1 — Salary Slip + Foundation Cleanup (branch `milestone/v1.0.1`)
**v1.0.1 progress:** Phases 7 + 8 complete (2026-04-19, EMP-01 + EMP-02 validated). Phases 9/10 remaining (SLIP, DATA).

**v1.0 delivered:** 9 phases, 36 plans, 51 tasks. End-to-end monthly compliance cycle — schedule → approve → payroll → FK 3057/3059 + SKV 4805. See [.planning/MILESTONES.md](MILESTONES.md) for the full accomplishment list and [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for phase details.

**v1.0 accepted known issues** (documented, not fixed; guardian-approved deferrals):
- Preliminärskatt uses single global flat rate (30%) instead of per-assistant skattetabell — Skatteverket accepts this fallback
- Omkostnader pot (H5) not modelled — FK schablon 100% allocated to lönekostnader instead of Fremia ~87/8/3/2 split. Pending advisor input.
- Age-bracket arbetsgivaravgifter (67+, 19–23) not supported — flat 31.42%
- Monthly `outstanding` balance uses gross, not net

See [.planning/milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) for full audit with known-issues detail.

---

## What This Is

Kalinga is a care management platform for the Swedish personal assistance sector. It serves disabled people and their families who have chosen to self-manage their assistansersättning (personal assistance compensation from Försäkringskassan) rather than delegate to a staffing company like Humana or Attendo. The platform handles the full monthly compliance cycle: scheduling assistants, tracking hours, generating FK and Skatteverket forms, and calculating payroll — so the guardian can manage their own "micro-assistance employer" without specialist knowledge.

**v1.0 delivered the full cycle.** v1.0.1 adds the missing lönespecifikation (salary slip) required by Swedish labor law, plus foundation cleanup (schema additions, dead-code removal, real data entry, employer-representation helper). See [.planning/ROADMAP.md](ROADMAP.md) for forward scope.

## Core Value

The guardian can complete the full monthly cycle — approve hours, generate all required forms, calculate pay — without needing an HR department or assistance company.

## Current Milestone: v1.0.1 — Salary Slip + Foundation Cleanup

**Goal:** Ship the legally-required Swedish lönespecifikation (salary slip) for anhörig-model assistants, and absorb adjacent foundation items (schema additions, employer-representation helper, scheduling scaffolding removal, real-data entry) so v1.1–v1.3 don't rework this ground.

**Why urgent:** Swedish labor law requires a written pay record per pay period. Rose + Mikael currently receive only a bank transfer reference — statutory non-compliance.

**Target features:**
- Salary slip (anhörig model) — PDF generation, guardian + assistant download paths, Fremia/Custom scaffolding disabled until v1.4/v1.5
- Employer representation helper used by FK 3057, FK 3059, SKV 4805, and slip renderers
- Capture-missing-fields schema on `assistants` + `profile` tables (unblocks v1.2 + v1.3)
- Scheduling scaffolding removal (dead Settings card, openSlots table, self-book endpoints)
- Real brukare/guardian/assistant data entered in Settings (replaces placeholders)

## Requirements

### Validated

<!-- Shipped in v1.0 (2026-04-18) -->

- ✓ Guardian and assistant authentication with role-based access — v1.0
- ✓ Guardian can create and manage assistants (invite by email) — v1.0 / Phase 6.1
- ✓ Guardian can schedule shifts (manual entry + Google Calendar source of truth) — v1.0
- ✓ Assistant can view their schedule, clock in/out, and log verified hours — v1.0 / Phase 3.5
- ✓ Guardian can approve or reject assistant time entries — v1.0
- ✓ FK 3059 and FK 3057 forms filled and downloadable as PDF — v1.0
- ✓ SKV 4805 (AGI) PDF per assistant per month — v1.0 / Phase 4
- ✓ Monthly payroll summary with 2026 Swedish tax rates and employer contributions — v1.0 / Phase 3
- ✓ Leave & absence tracking (sjukfrånvaro, VAB, semester, other) with FK billing exclusion and VAB 120-day balance — v1.0 / Phase 2
- ✓ Role middleware enforced server-side; FK 3057 date bug fixed; rates env-configurable — v1.0 / Phase 1
- ✓ Monthly compliance stepper with FK/AGI deadline badges + email reminder cron — v1.0 / Phase 5
- ✓ Google Calendar OAuth2 connect + calendar picker + event CRUD + outbound clock-out sync — v1.0 / Phase 6
- ✓ Multi-family assistant support (assistant-guardian links + family selector) — v1.0 / Phase 3.5
- ✓ B2B-ready design system across guardian + assistant views — v1.0 / Phase 2.5

<!-- v1.0.1 Phase 7 shipped (2026-04-18) -->

- ✓ `assistants` schema gained 13 new columns (skattetabell, tax_scheme, bank clearing/account/iban, split address, employment_start/end_date, citizenship, residence_permit_expiry, notes) — v1.0.1 / Phase 7 (SCHEMA-01)
- ✓ `profile` schema gained 8 new columns (split address, fk_decision_start/end, dubbel_assistans_approved, patient_relation_to_guardian, patient_requires_representative) — v1.0.1 / Phase 7 (SCHEMA-02)
- ✓ `payroll_records` snapshots `salary_model_used` + `hourly_rate_used` at generation time — v1.0.1 / Phase 7 (SCHEMA-03)
- ✓ Settings → Profile card refactored into collapsible Personuppgifter + FK-beslut sections with all new editable fields — v1.0.1 / Phase 7
- ✓ Settings → Assistants edit dialog widened to max-w-lg with collapsible Personuppgifter + Anställning & ekonomi sections (17 guardian-editable fields) — v1.0.1 / Phase 7
- ✓ SetupWizard captures fk_decision_start/end + patient_relation_to_guardian on first-time setup — v1.0.1 / Phase 7
- ✓ Settings "Scheduling" card removed (self-book toggle, approval mode, booking window) — v1.0.1 / Phase 7 (CLEAN-01)
- ✓ `openSlots` table dropped; `/api/slots` + `/api/assistant/self-book` + `/api/assistant/open-slots` endpoints removed — v1.0.1 / Phase 7 (CLEAN-02)
- ✓ Dead settings keys (`allow_self_book`, `self_book_approval`, `booking_window_days`) removed from `seedDefaults()`; client helpers `slotsApi` / `assistantApi.selfBook` / `assistantApi.openSlots` removed — v1.0.1 / Phase 7 (CLEAN-03)
- ✓ Resolved pre-existing v1.0 schema drift (7 orphaned columns on entries/assistants/profile, timestamptz declaration mismatch on 3 columns) — v1.0.1 / Phase 7

<!-- v1.0.1 Phase 8 shipped (2026-04-19) -->

- ✓ `resolveEmployerRepresentation(profile, asOfDate)` helper returns structured arbetsgivare (always patient) + företrädare (guardian when minor-by-pno or adult with `patient_requires_representative = true`, else null) — v1.0.1 / Phase 8 (EMP-01)
- ✓ FK 3057, FK 3059, and SKV 4805 employer fields resolve via the helper — zero `guardianName` references for employer across `server/src/` (D-14 grep gate); signatures/contact remain guardian-sourced per D-09 — v1.0.1 / Phase 8 (EMP-02)
- ✓ Helper contract locked for Phase 9 salary slip consumer: 16 unit tests cover minor-by-pno, adult-with-override, adult-without-override, turns-18 boundary, malformed pno, and address fallback — v1.0.1 / Phase 8

### Active

<!-- v1.0.1 milestone scope remaining: Phases 8/9/10 -->

#### Salary Slip (Lönespecifikation)
- [ ] Guardian can generate and download a monthly salary slip PDF per approved assistant per month
- [ ] Assistant can view and download their own past salary slips from AssistantDashboard
- [ ] Salary slip is gated on payroll approval (same 409 gate as SKV 4805)
- [ ] Slip shows arbetstid (worked hours + absence days with running VAB balance), lön breakdown (bruttolön → preliminärskatt 30% → netto), and correct employer representation (minor brukare shows "Företrädd av [guardian]")
- [ ] Each issued slip is recorded in a `payment_slips` audit table for bokföringslag compliance
- [ ] Settings → Assistants exposes `salary_model` dropdown (anhörig wired; fremia/custom disabled with "(Kommer i v1.4/v1.5)")

#### Employer Representation Helper
✓ Shipped in Phase 8 — see Validated section below. Salary slip consumer lands in Phase 9 against the same helper contract.

#### Schema Additions (unblocks v1.2 + v1.3)
✓ Shipped in Phase 7 — see Validated section above. `hourly_rate_override` and `fk_decision_hours_per_day` intentionally deferred per 07-CONTEXT D-01 (weeklyHours remains single source of truth per FK 51 kap 9§ SFB) and D-18 (rate decoupling moved to v1.4 with Fremia model).

#### Scheduling Scaffolding Removal
✓ Shipped in Phase 7 — see Validated section above.

#### Real Data Entry
- [ ] Guardian enters real patient pno, patient name, patient address (no placeholder "TBD" or "000000-0000" remaining)
- [ ] Guardian enters real FK beslutsnummer, decision start/end dates, and hours-per-day entitlement
- [ ] Both assistants (Rose + Mikael) have valid pno, real addresses, tax scheme (A-skatt), and bank details
- [ ] One clean FK 3057 + one SKV 4805 + one salary slip download produces zero placeholder text

### Out of Scope

- Real-time chat between guardian and assistants — high complexity, not core to compliance workflow
- Mobile native app (iOS/Android) — web-responsive assistant interface is sufficient for v1
- Automated bank payment integration — guardian pays manually; the platform generates the paperwork
- Multi-language support — Swedish-only for v1; all FK/Skatteverket content is Swedish by nature
- Integration with Skatteverket API (e-filing) — forms are generated for manual submission first

## Context

- **Regulatory domain**: Swedish assistansersättning under LSS (lag om stöd och service till vissa funktionshindrade). FK 3059 is the monthly time report; FK 3057 is the employer activity report. AGI (arbetsgivardeklaration på individnivå) is filed monthly with Skatteverket. All filings currently require physical signature and postal submission.
- **Current codebase state**: Monorepo with React + Vite frontend and Express + Drizzle/PostgreSQL backend. Core scheduling and FK form generation is working but has known bugs (field name inconsistency, hardcoded date logic). Security concerns exist but do not block functional use.
- **Build strategy**: Start with one family's real use case; design for multi-tenant from the data-scoping layer up so adding a second account requires no schema rework.
- **Paper-first workflow**: Forms are filled digitally but printed, physically signed by each assistant, and sent by post to FK and Skatteverket. The platform must produce print-ready output.

## Constraints

- **Tech stack**: TypeScript throughout; Express + Drizzle/PostgreSQL server; React + Vite client — no stack changes
- **Regulatory**: FK and Skatteverket form layouts are fixed by the authorities; content must match official field definitions exactly
- **Deployment**: Single server deployment (no microservices); qpdf system binary required for PDF decryption
- **No tests exist**: All new work should include test coverage; existing bugs should be fixed with regression tests

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Self-manage (egenvald) model as primary user | The bureaucratic burden is highest for self-managers; assistance companies have staff for this | — Pending |
| Build for one family first, then open up | Validate the full workflow with real data before multi-tenant complexity | — Pending |
| Physical form submission (no API filing) | Skatteverket AGI API requires certification; FK postal submission is still mandatory | — Pending |
| Web-responsive assistant interface (no native app) | Reduces scope significantly; assistants only need to log hours and view schedule | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-19 — v1.0.1 Phase 8 (Employer Representation Helper) complete, EMP-01 + EMP-02 validated, 4 human visual-PDF UAT items persisted for Phase 10 DATA-01. Next: Phase 9 (Salary Slip).*

## Core Value Proposition (Clarified 2026-04-10)

This platform exists because families managing personal assistance (assistansersättning) cannot keep up with the administrative burden — so they hire care companies instead. Care companies have a documented problem with hour inflation (reporting more hours than assistants actually worked), which is fraudulent billing against FK reimbursements.

**The platform's real differentiator is trust and fraud prevention:**
- Assistants log their own hours from their own accounts — the guardian doesn't enter hours on their behalf
- Guardian approves before submission — guardian is the authorizing party, not the care company
- Clean audit trail means families can defend their FK claims in disputes or audits
- Clock-in/out with identity verification would be the strongest differentiator (see backlog seed)

## Architectural Clarification (2026-04-12)

**Schedule source of truth: Google Calendar — not internal entries**

The schedule (what shifts are planned and when) is owned by Google Calendar. The app reads from Google Calendar to display the schedule. The app does **not** create a schedule internally; users add events directly in Google Calendar.

- **Schedule views** (Calendar page grid, Home weekly strip) → pull from `GET /api/gcal/events` → Google Calendar API
- **Hour tracking** (entries table) → created by assistant clock-in/out; represents what was actually worked
- **Approval workflow** (Monthly page) → guardian approves clock-out entries before FK/payroll submission

This means:
- The "assign assistant to slot" flow in Calendar.tsx is a legacy/fallback, not the primary scheduling path
- A shift appearing on the schedule does not automatically create a DB entry — the assistant must clock in/out
- The entries table is a record of actual hours worked, not a schedule
