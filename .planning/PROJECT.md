# Kalinga — Assistansportal

## What This Is

Kalinga is a care management platform for the Swedish personal assistance sector. It serves disabled people and their families who have chosen to self-manage their assistansersättning (personal assistance compensation from Försäkringskassan) rather than delegate to a staffing company like Humana or Attendo. The platform handles the full monthly compliance cycle: scheduling assistants, tracking hours, generating FK and Skatteverket forms, and calculating payroll — so the guardian can manage their own "micro-assistance employer" without specialist knowledge.

## Core Value

The guardian can complete the full monthly cycle — approve hours, generate all required forms, calculate pay — without needing an HR department or assistance company.

## Requirements

### Validated

<!-- Already shipped in the existing codebase -->

- ✓ Guardian and assistant authentication with role-based access — existing
- ✓ Guardian can create and manage assistants (invite by email) — existing
- ✓ Guardian can schedule shifts (open slots + manual entry) — existing
- ✓ Assistant can view their schedule and log actual hours worked — existing
- ✓ Guardian can approve or reject assistant time entries — existing
- ✓ FK 3059 form is filled and downloadable as a PDF — existing
- ✓ FK 3057 form is filled and downloadable as a PDF — existing
- ✓ Monthly cost overview is tracked and visible — existing
- ✓ Google Calendar sync for schedule entries — existing
- ✓ Guardian profile setup wizard (first-run) — existing

### Active

<!-- What we are building toward -->

#### Stability & Correctness
- [ ] Role middleware enforced server-side (assistants cannot call guardian endpoints)
- [ ] FK 3057 date range uses correct month-end date (not hardcoded day 31)
- [ ] Hours page counts use camelCase field names (`reqStatus`, `repStatus`) correctly
- [ ] FK hourly rate and employer tax rate are configurable in Settings (not hardcoded)
- [ ] Dev-only endpoints (`/api/auth/dev-verify`) are disabled in production

#### Payroll
- [ ] Guardian can view a monthly payroll summary per assistant (hours × rate)
- [ ] Guardian can record and track payments made to assistants
- [ ] System calculates gross pay, employer social security contributions (arbetsgivaravgifter), and net pay per assistant

#### Skatteverket Reporting
- [ ] System generates the AGI (arbetsgivardeklaration på individnivå) report data per month
- [ ] Guardian can download or export Skatteverket-ready salary declaration output
- [ ] Tax deductions (preliminärskatt) per assistant are tracked and included in reporting

#### Leave & Absence
- [ ] Guardian can record assistant absence (sick leave, VAB, holiday)
- [ ] Absence entries are excluded from billable hours in FK reports
- [ ] Leave balances are visible to the guardian per assistant

#### Scheduling Improvements
- [ ] Self-booking slot capacity check is atomic (no race condition)
- [ ] Guardian has a week/month view showing all assistants' shifts in one grid
- [ ] Guardian can copy a previous week's schedule as a starting point

#### Multi-Tenant Foundation
- [ ] All data is scoped to a guardian account (enforced at query level, not just routing)
- [ ] A second guardian account can be registered and operates fully independently

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

---
*Last updated: 2026-04-06 — initial PROJECT.md after brownfield questioning*

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
