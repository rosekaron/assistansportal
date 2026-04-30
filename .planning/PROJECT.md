# Kalinga — Assistansportal

## Current State (2026-04-30)

**Shipped:** v1.0.1 — Salary Slip + Foundation Cleanup (merged to `main` 2026-04-25 via [PR #7](https://github.com/rosekaron/assistansportal/pull/7))
**Git tag:** `v1.0.1` on merge commit `a796a12` (also `v1.0` archived on `milestone/v1.0-mvp`)
**Active milestone:** v1.0.2 — Production Deployment (azin.run)
**Branch state:** `main` — ahead of origin by 0 commits after cleanup/README/gitignore housekeeping

**v1.0.1 delivered:** 4 phases (7–10), 13 plans, 18/18 requirements. Lönespec PDF live end-to-end; statutory non-compliance closed (Swedish labor law requires written pay record per pay period). Latent FK 3057/3059/SKV 4805 employer-name bug closed by `resolveEmployerRepresentation()` helper. Schema additions for v1.2 + v1.3 already in place. Dead scheduling scaffolding removed. See [.planning/MILESTONES.md](MILESTONES.md) and [.planning/milestones/v1.0.1-ROADMAP.md](milestones/v1.0.1-ROADMAP.md).

**v1.0 delivered:** 9 phases, 36 plans, 51 tasks. End-to-end monthly compliance cycle — schedule → approve → payroll → FK 3057/3059 + SKV 4805. See [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) for phase details.

**v1.0 accepted known issues** (carried forward; documented, not fixed):
- Preliminärskatt uses single global flat rate (30%) instead of per-assistant skattetabell — Skatteverket accepts this fallback. Per-assistant skattetabell column added in v1.0.1 (SCHEMA-01) but not yet read by the calculator; lookup ships with v1.4 Fremia.
- Omkostnader pot (H5) not modelled — FK schablon 100% allocated to lönekostnader instead of Fremia ~87/8/3/2 split. Pending advisor input.
- Age-bracket arbetsgivaravgifter (67+, 19–23) not supported — flat 31.42%; closes with v1.4 Fremia.
- Monthly `outstanding` balance uses gross, not net
- ~~FK 3057/4805 employer-name bug~~ — **closed by v1.0.1 Phase 8** (`resolveEmployerRepresentation()` helper)

**v1.0.1 deferred (rolling into v1.0.2 hardening backlog):**
- 6 HIGH-severity CodeRabbit findings on PR #7 (mostly pre-existing, surfaced by cumulative diff): TOCTOU on clock-in, multi-table ops without transactions, missing UNIQUE on `assistantGuardianLinks`, JWT in query parameter logged, `e.message` leaked to clients
- Multi-family Settings UI re-add (backend wired; UI dropped at merge per Decision #4 reversal)
- `hourlyRateOverride = 0.31` Swedish decimal-comma parsing bug in Settings input
- Plan 10-04 FK decision fields gap-closure — recommended DROP per VERIFICATION (schema-only, no PDF consumer)
- Pre-existing PII leak in `.planning/HANDOFF.md` git history (commit `9c38efc`)

Track at [.planning/todos/pending/2026-04-25-v1.0.2-hardening-from-pr7-review.md](todos/pending/2026-04-25-v1.0.2-hardening-from-pr7-review.md).

See [.planning/milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) for v1.0 issues and [.planning/milestones/v1.0.1-MILESTONE-AUDIT.md](milestones/v1.0.1-MILESTONE-AUDIT.md) for v1.0.1 main↔milestone divergence reconciliation.

---

## What This Is

Kalinga is a care management platform for the Swedish personal assistance sector. It serves disabled people and their families who have chosen to self-manage their assistansersättning (personal assistance compensation from Försäkringskassan) rather than delegate to a staffing company like Humana or Attendo. The platform handles the full monthly compliance cycle: scheduling assistants, tracking hours, generating FK and Skatteverket forms, and calculating payroll — and now (v1.0.1) issues the legally-required Swedish lönespecifikation per pay period — so the guardian can manage their own "micro-assistance employer" without specialist knowledge.

**v1.0 delivered the full compliance cycle. v1.0.1 added the salary slip + foundation cleanup. v1.0.2 deploys the platform to production on azin.run.** Forward scope is security hardening (v1.0.3), then feature milestones (v1.1 Bulk Schedule, v1.2 Submission Readiness Gate, v1.3 Schedule Violations, v1.4 Fremia Salary Model, v2.0 Calendar Reconciliation). See [.planning/ROADMAP.md](ROADMAP.md).

## Core Value

The guardian can complete the full monthly cycle — approve hours, generate all required forms, issue the lönespec, calculate pay — without needing an HR department or assistance company.

## Current Milestone: v1.0.2 — Production Deployment

**Goal:** Deploy Assistansportal to production on azin.run — containerize the app, get it live at a real URL, with PDFs generating, Google OAuth working, and the database migrated.

**Target features:**
- Production multi-stage Dockerfile with qpdf (apt) and forms directory included
- Server serves compiled React client as static files in `NODE_ENV=production`
- GitHub repo connected to Azin, all env vars configured, PostgreSQL provisioned
- Push-to-main triggers automatic build and deploy
- Database schema pushed to production
- Google OAuth redirect URI updated for production domain
- Smoke test: guardian login → PDF download → Google Calendar OAuth
- **Design-wireframes implementation** ([.planning/seeds/design-wireframes-implementation.md](seeds/design-wireframes-implementation.md)) — fetch + implement Anthropic-hosted wireframes captured 2026-04-25.

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

<!-- v1.0.1 Phase 9 shipped (2026-04-20) -->

- ✓ Guardian can download a salary slip PDF per approved assistant per month from Monthly page (gated on payroll approval; server returns 409 otherwise) — v1.0.1 / Phase 9 (SLIP-01)
- ✓ Assistant can list and download their own past salary slips from AssistantDashboard (JWT-scoped to own records; IDOR-safe `/me` endpoint) — v1.0.1 / Phase 9 (SLIP-02)
- ✓ Salary slip (anhörig model) shows arbetstid section (worked hours + absence days + VAB YTD balance), lön breakdown (bruttolön → preliminärskatt 30% → netto), and excludes all employer-side numbers (no arbetsgivaravgifter, no total kostnad) — v1.0.1 / Phase 9 (SLIP-03)
- ✓ Salary slip header shows correct employer representation: arbetsgivare = patient, företrädd av = guardian only when patient is a minor — v1.0.1 / Phase 9 (SLIP-04)
- ✓ Each issued slip is recorded in `payment_slips` audit table with unique document number (`LS-YYYY-MM-NNN`), issued-at timestamp, pay method, and pay date; replays reuse document number (race-safe via 23505 catch) — v1.0.1 / Phase 9 (SLIP-05)
- ✓ Settings → Assistants exposes `salary_model` dropdown (Anhörigassistans wired; Fremia/Custom disabled with "(Kommer i v1.4/v1.5)") + `hourly_rate_override` + `payment_method` + `default_pay_day` — v1.0.1 / Phase 9 (SLIP-06)
- ✓ `payroll_records` captures `salary_model_used` + `hourly_rate_used` snapshots so historical slips reproduce identical numbers — v1.0.1 / Phase 9 (SLIP-07)
- ✓ Pure `buildAnhorigSlip()` builder + `renderAnhorigSlipPdf()` pdfkit renderer at `server/src/lib/`; 23 unit tests + 21 route-integration tests; UAT 9/9 passed — v1.0.1 / Phase 9
- ✓ D-12 NULL-rate gate (400) runs BEFORE D-08 approval gate (409) — guides guardian to "set the rate," not "re-approve payroll" — v1.0.1 / Phase 9
- ✓ D-09 pay-date freeze at issuance — changing `profile.default_pay_day` afterwards does NOT mutate issued slips — v1.0.1 / Phase 9

<!-- v1.0.1 Phase 10 shipped (2026-04-24) -->

- ✓ Guardian entered real patient pno/name/address + FK beslutsnummer + decision start/end + hours-per-day in Settings → Profile — v1.0.1 / Phase 10 (DATA-01; `fk_decision_*` schema-only, no PDF consumer in v1.0.1)
- ✓ Both assistants (Rose + Mikael) have valid pno + real street/zip/city addresses + A-skatt tax scheme + bank clearing/account in Settings → Assistants — v1.0.1 / Phase 10 (DATA-02; entered via Settings UI; plan 10-02 superseded by manual flow)
- ✓ Fresh download of FK 3057 (2026-03), Rose SKV 4805, and Rose lönespec LS-2026-03-001 each contain zero D-07 placeholder hits; D-06 rebuild + D-09 freeze observed on lönespec re-download — v1.0.1 / Phase 10 (DATA-03; 10-UAT 3/3 pass)
- ✓ Inline regression fix: Phase 8's refactor missed `/fk3057` route (still using `ignoreEncryption: true` instead of `decryptAndFill` qpdf); surfaced as HTTP 500 in 10-UAT Test 1, fixed in commit `8b93937` — v1.0.1 / Phase 10

### Active

<!-- v1.0.2 Production Deployment -->

- [ ] App is containerized with a production multi-stage Dockerfile (includes qpdf via apt, forms directory, compiled client)
- [ ] Server serves compiled React client as static files when `NODE_ENV=production`
- [ ] GitHub repo connected to Azin; push to `main` triggers auto-deploy
- [ ] Production PostgreSQL provisioned by Azin; schema migrated via Drizzle push
- [ ] All 13 environment variables configured in Azin production environment
- [ ] Google OAuth redirect URIs updated for production domain
- [ ] Smoke test passes: login, PDF download, Google Calendar OAuth at production URL

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
| Self-manage (egenvald) model as primary user | The bureaucratic burden is highest for self-managers; assistance companies have staff for this | ✓ Validated v1.0.1 — guardian completed full monthly cycle (schedule → approve → FK → SKV → lönespec) without specialist help |
| Build for one family first, then open up | Validate the full workflow with real data before multi-tenant complexity | ✓ Validated v1.0.1 — Phase 10 E2E with real Rose + Mikael data closed the loop |
| Physical form submission (no API filing) | Skatteverket AGI API requires certification; FK postal submission is still mandatory | — Holding (no triggering event yet) |
| Web-responsive assistant interface (no native app) | Reduces scope significantly; assistants only need to log hours and view schedule | ✓ Good — AssistantDashboard with clock-in/out + lönespec list works well at v1.0.1 scope |
| `resolveEmployerRepresentation()` as authoritative employer-name source | Closes latent FK 3057/3059/SKV 4805 bug AND gives salary slip a correct, reusable input | ✓ Good v1.0.1 / Phase 8 — D-14 grep gate enforces |
| Slip excludes arbetsgivaravgifter + total kostnad | Employer-side numbers don't belong on assistant's document | ✓ Good v1.0.1 / Phase 9 — guardian direction 2026-04-18 |
| D-12 NULL-rate gate runs BEFORE D-08 approval gate | Tells guardian "set the rate" not "re-approve payroll" | ✓ Good v1.0.1 / Phase 9 |
| D-06 rebuild-on-download + D-09 pay-date freeze at issuance | PDF reflects current data; pay-date is bokföringslag-frozen | ✓ Good v1.0.1 / Phase 9 — verified in UAT |
| Plan 10-02 superseded by manual Settings UI entry | Mid-flight pivot — agentic PUT was duplicating the E2E test | ✓ Good v1.0.1 — DATA-02 closed via 10-03 UAT outcomes |
| Plan 10-04 (FK decision fields gap-closure) recommended for DROP | `fk_decision_*` is schema-only in v1.0.1 — no PDF consumer | ⚠️ Revisit when v1.2 SUBMIT introduces a consumer |

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
*Last updated: 2026-04-30 — v1.0.2 Production Deployment milestone started. GSD updated to 1.38.5. v1.0.1 phase dirs archived. Next: `/gsd-plan-phase 11`.*

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
