# Kalinga Assistansportal — Roadmap

**Project:** Swedish personal assistance (assistansersättning) self-management platform with compliance and payroll integration.
**Last updated:** 2026-04-30 (vision + far-horizon merged from root ROADMAP.md)

---

## Vision

Assistansportal is the operating system for personal assistance in Europe — starting with Sweden. We eliminate the administrative burden carried by families, individuals, and care companies managing personal assistance, replacing manual workflows with a purpose-built platform that handles compliance, coordination, and care — so that caregivers can focus on people, not paperwork.

---

## ▶ HANDOFF — read this first if you're resuming cold

If you're a new session / new LLM and have never seen this project before, **read this section, then PROJECT.md, then the Future Milestones section below. Skip nothing.**

### Where the project stands (as of 2026-04-26)

- **v1.0.1 SHIPPED & MERGED.** PR #7 merged into `main` 2026-04-25 (merge commit `a796a12`); git tag `v1.0.1` applied. All 4 phases (7–10) verified, 18/18 requirements satisfied. The platform is now statutorily complete for the anhörig-model use case (lönespec PDF live end-to-end + employer-representation helper closes the latent FK/SKV employer-name bug).
- **Active milestone:** None. Next milestone TBD — see options below.
- **Branch state:** `milestone/v1.0.1` ahead of `main` by one docs-only commit (`0e55f79` — design-wireframes seed + post-merge HANDOFF refresh). The bookkeeping commit from `/gsd-complete-milestone` (this archive write-up) lands on the same branch.
- **Two milestone archives now live:**
  - [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) + [v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) + [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)
  - [milestones/v1.0.1-ROADMAP.md](milestones/v1.0.1-ROADMAP.md) + [v1.0.1-REQUIREMENTS.md](milestones/v1.0.1-REQUIREMENTS.md) + [v1.0.1-MILESTONE-AUDIT.md](milestones/v1.0.1-MILESTONE-AUDIT.md) (the latter is the main↔milestone divergence reconciliation audit)

### How to pick the next milestone

Three live candidates. Decide via `/gsd-new-milestone`:

1. **v1.0.2 — Hardening** (recommended if any of the 6 HIGH-severity CodeRabbit findings are exploitable in your deployed environment). Backlog: [todos/pending/2026-04-25-v1.0.2-hardening-from-pr7-review.md](todos/pending/2026-04-25-v1.0.2-hardening-from-pr7-review.md). Includes:
   - 6 HIGH-severity CodeRabbit findings (mostly pre-existing, surfaced by PR #7 cumulative diff): TOCTOU on clock-in, multi-table ops without transactions, missing UNIQUE on `assistantGuardianLinks`, JWT in query parameter logged, `e.message` leaked to clients
   - Multi-family Settings UI re-add (backend wired; UI dropped at merge per Decision #4 reversal)
   - `hourlyRateOverride = 0.31` Swedish decimal-comma parsing bug in Settings input
   - Plan 10-04 FK decision fields gap-closure — recommended DROP per VERIFICATION (re-evaluate)
   - Pre-existing PII leak in `.planning/HANDOFF.md` git history (commit `9c38efc`)
2. **v1.1 — Bulk Schedule Entry** (convenience win): copy-week, weekday templates, multi-day/multi-assistant bulk create. Not yet planned.
3. **Design-wireframes implementation** ([seeds/design-wireframes-implementation.md](seeds/design-wireframes-implementation.md)) — fetch + implement Anthropic-hosted wireframes captured 2026-04-25.

Or one of the deeper feature milestones below (v1.2 Submission Readiness, v1.3 Schedule Violations, v1.4 Fremia Salary Model, v2.0 Calendar Reconciliation).

### The essential facts about this product

- **Users:** one guardian (parent of a disabled child), two assistants (Rose + Mikael, both parents of the patient). The patient is the legal employer (brukare); the guardian acts as company administrator and on-behalf-of-minor representative.
- **Anhörigassistans arrangement:** Rose + Mikael work under mutual agreement — fixed hourly rate (254.10 kr/h), no paid sick leave, no VAB pay, no vacation pay, no pension. This is legal because they're the patient's parents. Arbetsgivaravgifter (31.42% employer tax) still apply.
- **Tech stack:** React + Vite (client) / Express + Drizzle + PostgreSQL (server) / pdf-lib + pdfkit (PDFs) / React Query + Zustand (state). TypeScript throughout.
- **Source of truth duality:** schedule display on Home.tsx reads Google Calendar; FK/payroll/invoice calculation reads internal `entries` table. Drift is a known design issue — v2.0 reconciles.

### Three binding guardian directions (carry forward across milestones)

1. **Flat 30% preliminärskatt acceptable** — Skatteverket's own fallback for unknown skattetabell is 30%. Per-assistant lookup deferred to v1.4.
2. **Omkostnader pot (H5) overpay accepted** — current formula spends 100% of FK schablon on lönekostnader; Fremia split is ~87/8/3/2. Pending advisor input.
3. **Arbetsgivaravgifter + total kostnad must NOT appear on the assistant-facing salary slip** — those belong on employer accounting, not on the employee's document.

### Outstanding threads

- **Phase 02 + 06.1 human-needed verifications** (v1.0) — LEAV-01/02/03 + BUG-004 SMTP pending guardian walkthrough (carry-over from v1.0)
- **March 2026 retroactive filing** — 84 entries imported from GCal, reverted to draft, payroll records deleted. Advisor review pending. See [compliance/2026-03-advisor-brief.md](compliance/2026-03-advisor-brief.md).
- **3 Phase 6 UAT items** blocked on live Google OAuth credentials (carry-over from v1.0)
- **Nyquist validation gaps** — 4/9 v1.0 phases missing VALIDATION.md, 4/9 in `draft` Nyquist status

---

## Shipped milestones

| Milestone | Tag | Shipped | Phases | Plans | Reqs | Archive |
|-----------|-----|---------|--------|-------|------|---------|
| v1.0 — MVP (Stability, Compliance, Core Payroll) | `v1.0` | 2026-04-18 | 9 | 36 | 15/15 | [v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) |
| v1.0.1 — Salary Slip + Foundation Cleanup | `v1.0.1` | 2026-04-25 | 4 (7–10) | 13 | 18/18 | [v1.0.1-ROADMAP.md](milestones/v1.0.1-ROADMAP.md) |

<details>
<summary>✅ <strong>v1.0 — MVP</strong> (Phases 1–6.1) — SHIPPED 2026-04-18</summary>

- [x] **Phase 1: Stability & Correctness** — role middleware, FK 3057 date fix, rates env-configurable, camelCase client types (2026-04-06)
- [x] **Phase 2: Leave & Absence Foundation** — absence CRUD, VAB 120-day balance, billable-hours filter (2026-04-06)
- [x] **Phase 2.5: UI Overhaul & Design System** — Tailwind fix, B2B-ready visual system (2026-04-08)
- [x] **Phase 3: Payroll Calculation & Recording** — calculatePayroll + payroll_records + payments ledger + Monthly UI (2026-04-10)
- [x] **Phase 3.5: UX/IA Redesign** — 4-route IA, clock-in/out, multi-family links (2026-04-11)
- [x] **Phase 4: Tax Reporting (AGI)** — corrected payroll formula, prelim_tax snapshot, SKV 4805 PDF (2026-04-11)
- [x] **Phase 5: Scheduling & Compliance Workflow** — multi-assistant Home grid, Monthly stepper, deadline reminders, reminder cron (2026-04-17)
- [x] **Phase 6: Google Calendar Integration** — real OAuth2, calendar picker, event CRUD, clock-out → GCal outbound sync (2026-04-15)
- [x] **Phase 6.1: UAT Bug Fix (inserted)** — BUG-002 week navigator, BUG-004 invite email, BUG-005 self-registration (2026-04-15)

Full detail: [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md). Audit: [v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md).

</details>

<details>
<summary>✅ <strong>v1.0.1 — Salary Slip + Foundation Cleanup</strong> (Phases 7–10) — SHIPPED 2026-04-25</summary>

- [x] **Phase 7: Foundation — Schema & Cleanup** — 23 new columns + 3 enums, dead scheduling scaffolding removed, Settings 2-section collapsibles, SetupWizard FK fields (2026-04-18)
- [x] **Phase 8: Employer Representation Helper** — `resolveEmployerRepresentation()` helper + 16 unit tests, FK 3057/3059/SKV 4805 refactored, D-14 grep gate (2026-04-19)
- [x] **Phase 9: Salary Slip (Anhörig Model)** — `payment_slips` audit table, `buildAnhorigSlip()` + pdfkit renderer, 3 JWT-scoped endpoints, Monthly + AssistantDashboard + Settings UI, 60+ tests, UAT 9/9 (2026-04-20)
- [x] **Phase 10: Real Data Entry & End-to-End Verification** — Profile + Assistants real data via Settings UI, 3-test PDF UAT (FK 3057 / Rose SKV 4805 / Rose lönespec) all 0 placeholder hits, inline FK 3057 encryption fix (2026-04-24)

Full detail: [milestones/v1.0.1-ROADMAP.md](milestones/v1.0.1-ROADMAP.md). Audit: [v1.0.1-MILESTONE-AUDIT.md](milestones/v1.0.1-MILESTONE-AUDIT.md) (main↔milestone divergence reconciliation).

</details>

---

## Future Milestones (planned 2026-04-18, refreshed 2026-04-26)

### 🔜 v1.0.2 — Hardening (recommended next)

**Goal:** Close the 6 HIGH-severity CodeRabbit findings from PR #7 review, re-add multi-family Settings UI, fix Swedish decimal-comma parsing in Settings, and decide on Plan 10-04 FK decision fields.

**Scope:**

- TOCTOU on clock-in (`clock.ts:52-69`)
- Multi-table ops without transactions (`clock.ts:147-165`, `assistants.ts:89-145`)
- Missing UNIQUE on `assistantGuardianLinks(assistantId, guardianId)` (`auth.ts:229-234`)
- JWT in query parameter logged (`gcal.ts:20-38`)
- `e.message` leaked to clients (`entries.ts:45-48`)
- Multi-family Settings UI re-add in milestone's 2-section collapsible shape (backend already wired: `/families`, `/link-existing`, `/link-status`, `/link-requests/{accept,decline}` + `assistantsApi.linkExisting/linkStatus`)
- `hourlyRateOverride = 0.31` Swedish decimal-comma parsing bug in Settings input
- Plan 10-04 (FK decision fields gap-closure) — confirm DROP or revive
- Pre-existing PII leak redaction in `.planning/HANDOFF.md` git history (commit `9c38efc`)

**Backlog:** [todos/pending/2026-04-25-v1.0.2-hardening-from-pr7-review.md](todos/pending/2026-04-25-v1.0.2-hardening-from-pr7-review.md)

**Trigger:** Most HIGH findings are pre-existing latent issues, NOT v1.0.1 regressions. Urgency depends on deployment exposure.

### 🔜 v1.1 — Bulk Schedule Entry

**Goal:** Guardian can efficiently create multi-day / multi-assistant schedule entries in one action instead of one row at a time.

**Scope:**

- Bulk action on Home / Monthly for creating manual entries across multiple days and/or assistants in a single interaction
- Templates ("copy previous week", "apply this shift to Mon–Fri")
- Proper feedback on partial failures when bulk create hits validation errors

**Open questions for discuss phase:**

- What's the most common bulk pattern (copy week, weekday template, fill-remaining-days)?
- Does bulk entry trigger GCal outbound sync per entry, or a single batch sync?
- Should bulk entries bypass schedule-violation warnings or respect them?

**Not yet planned.** No phases defined. Promote during `/gsd-new-milestone v1.1`.

### 🔜 v1.2 — Submission Readiness Gate

**Goal:** Before the guardian downloads FK 3057 / FK 3059 / SKV 4805, surface any data gaps that would cause the receiving authority (FK or Skatteverket) to reject the submission. Disable downloads until blockers are resolved.

**Scope:**

- Pre-flight validator for each form with 12 blockers (brukare pno, beslutsnummer, assistant pno/address, payroll approval, tax table, etc.)
- "Submission readiness" panel on Monthly and Records pages
- Server-side mirror (422 on PDF POST when blockers exist)
- Deep-link from each blocker row to the fix location

**Existing design:** [todos/pending/2026-04-18-flag-submission-blocking-violations-before-fk-and-skatteverk.md](todos/pending/2026-04-18-flag-submission-blocking-violations-before-fk-and-skatteverk.md) — full 12-blocker matrix already specified.

**Depends on:** v1.0.1 schema additions (Phase 7) for 6 of 12 blockers — **already shipped** ✓ — half-unblocked.

### 🔜 v1.3 — Schedule-Violation Warnings on Monthly

**Goal:** When the guardian opens the Monthly page, show any FK-rule or labor-law violations in the approved schedule for the month being filed. Errors gate approval; warnings require explicit confirmation.

**Scope:**

- Pure-function rule engine with 10 rules: ATL §5/§8/§13/§14, FK dubbel-assistans, FK coverage gap/excess, FK decision expiry, anhörigassistans cap, employment-period check
- "Schedule health" card on Monthly (and mirror on Home per the existing Home-notification todo)
- Gate Monthly Step 1 ("Approve time entries") on error-severity resolution

**Existing design:** [todos/pending/2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md](todos/pending/2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md)

**Depends on:** v1.0.1 schema additions — FK-coverage-* and employment-period rules need columns from Phase 7 — **already shipped** ✓.

**Note:** ATL-rule subset can ship without any schema change — that can be a v1.3-lite if urgency warrants.

### 🔜 v1.4 — Fremia Salary Model

**Goal:** When a non-family assistant is hired under Fremia/Kommunal "Personlig assistans" kollektivavtal, the system produces correct payroll: OB-tillägg, helgersättning, semesterlön reserve, tjänstepension (4.5%), AFA-försäkringar, sjuklön (legal 14-day employer liability). Fremia-model assistants get a properly-computed bruttolön and a lönespecifikation that matches what a personal-assistance accounting firm would produce.

**Scope:**

- Enable `salary_model = "fremia"` in code (v1.0.1 scaffolding flipped on)
- OB-tillägg table (evening 20%, night 40%, weekend 60% — Fremia current rates)
- Helgersättning via red-day calendar (Swedish public holidays)
- Semesterlön accrual 12% of gross — new `semesterlön_reserves` table
- Tjänstepension 4.5% — new accrual + payment tracking
- AFA-försäkringar ~0.3% — informational / accrual
- Sjuklön rules: employer pays 80% for days 2–14, first day karensdag
- Per-assistant skattetabell lookup replaces flat 30% preliminärskatt; `skattetabell` column exists since v1.0.1 (SCHEMA-01) but unused until here
- Age-bracket arbetsgivaravgifter (67+ = 10.21%, 19–23 = 17.77%) — closes H3 from v1.0 known issues
- Lönespec template extended with Fremia rows

**Trigger:** Hiring a third assistant on a proper Fremia/Kommunal contract. Until then no point building — YAGNI.

**Depends on:** v1.0.1 (salary_model enum scaffolding from Phase 9, employment_start/end columns from Phase 7).

### 🔜 v1.5 — Custom Salary Model

**Goal:** Edge cases that don't fit anhörig (no benefits) or Fremia (full kollektivavtal). Examples: assistant on partial benefits, assistant paid monthly salary, assistant with individual agreement that mixes kollektivavtal-style benefits with custom rates.

**Scope:**

- `salary_model = "custom"` with per-assistant toggles: `ob_enabled`, `pension_enabled`, `semesterlön_enabled`, `sjuklön_enabled`
- Each enabled benefit uses the standard rate by default, per-assistant override possible
- Supports månadslön (fixed monthly amount) vs timlön (hourly) via a `compensation_basis` field
- Slip template adapts to show only the enabled rows

**Trigger:** Unusual hiring arrangement that neither anhörig nor Fremia handles cleanly. Realistically v2.0 territory.

**Depends on:** v1.4 (most Fremia building-blocks would be reused).

### 🔜 v2.0 — Calendar & Schedule Reconciliation

**Goal:** Resolve the structural duality between Google Calendar (read by Home grid for display) and the internal `entries` table (read by FK/payroll/4805 for billing). Today these can diverge — Home can show 97h/week while the FK invoice shows 0h. v2.0 makes them one.

**Scope:**

- **Outbound sync on entry write**: `POST /api/entries` creates/updates GCal event atomically (create → stash `gcal_event_id` on entries → rollback if GCal fails). Symmetric for `PUT` and `DELETE`.
- **Inbound import from GCal**: one-shot `POST /api/gcal/import?start=YYYY-MM-DD&end=YYYY-MM-DD` walking GCal events with `Assistance: {Name}` / `Shift: {Name}` summaries, matching assistants by name, creating `entries` rows for each event without a matching `gcal_event_id`. Handles legacy + externally-created events.
- **Conflict resolution UI**: when a shift is edited in both sources between syncs, present a side-by-side and let guardian pick winner.
- **Source-of-truth metadata**: each entry carries `source_of_truth` ∈ {"app", "gcal"} so downstream code knows which side is authoritative.
- **Multi-calendar support** (stretch): guardian has multiple Google calendars, picks which sync.
- **Assistant-per-calendar routing** (stretch): different assistants' shifts in different calendars.

**Full design:** [todos/pending/2026-04-17-calendar-and-scheduling-user-stories-from-v1-0-learnings.md](todos/pending/2026-04-17-calendar-and-scheduling-user-stories-from-v1-0-learnings.md)

**Trigger:** When the drift causes a concrete billing problem the guardian notices.

---

## Sequencing

Default shipping order (revisable):

1. **v1.0.2** — Hardening (depends on deployment exposure of HIGH findings)
2. **v1.1** — Bulk schedule entry (convenience)
3. **v1.2** — Submission readiness gate (prevents invalid FK/Skatteverket filings)
4. **v1.3** — Schedule-violation warnings on Monthly (surfaces labor-law + FK-rule issues)
5. **v1.4** — Fremia salary model (triggered by hiring a non-family assistant on kollektivavtal)
6. **v1.5** — Custom salary model (triggered by edge-case hiring arrangement)
7. **v2.0** — Calendar & schedule reconciliation (triggered by billing drift becoming visible)

**Design-wireframes implementation** ([seeds/design-wireframes-implementation.md](seeds/design-wireframes-implementation.md)) is a wildcard — could insert anywhere depending on deliverable scope.

**Payroll-formula triage resolution (H5 omkostnader pot)** — may slot in as `v1.1.5` or be absorbed into `v1.4` if advisor returns with clear direction. For now: documented as v1.0 Known Issue, not actively scheduled.

---

## Far Horizon (post-v2.0)

These phases are not yet scheduled. They follow naturally once the core compliance + payroll + reconciliation loop is solid.

### Care coordination (V2 product era)

**Goal:** Deepen retention by making Assistansportal the central hub for care coordination. Expand from admin automation into active care management. Begin onboarding small care companies alongside individual families.

**Features:**
- Care instructions: structured documentation from guardians to assistants
- Activities planning and logging
- Therapy and exercise tracking
- Events and appointment coordination

**B2B — small care companies:**
- Staff scheduling
- Multi-client management
- Compliance reporting

### Knowledge base & discovery (V3 product era)

**Goal:** Expand the platform into discovery and advocacy — helping families navigate the broader system of entitlements, equipment, and funding. Establish Assistansportal as the trusted companion for the full personal assistance journey.

**Features:**
- Knowledge base: condition-specific guidance for rare diseases
- Hjälpmedel discovery: surfacing relevant assistive equipment by diagnosis
- Funding discovery: identifying additional funding sources beyond LSS
- LSS appeals support: guiding families through challenging and appealing LSS decisions

### Platform expansion (marketplace era)

**Goal:** Evolve Assistansportal from a management tool into a two-sided platform with network effects. Once a critical mass of families, care companies, and assistants are active, open a marketplace layer that creates new value for all three sides.

**Features:**
- Assistant pool: searchable registry of available assistants for families and care companies
- Temp staff pool: care companies can source vetted temporary assistants on demand
- Ratings and reviews: families and companies rate assistants; assistants build a portable reputation
- Marketplace: care companies can list open positions; assistants can signal availability

**Strategic note:** Dependent on platform density. Revenue model expands to include placement fees, featured listings, and verification services. Network effects at this stage create significant competitive moat.

---

## Parking lot

Features acknowledged but not yet phased:

- European regulatory adaptation (German, Dutch, broader EU compliance layer)
- API integrations with payroll providers and public sector systems
- Enterprise tier: larger care operators, custom contracts
- Multilingual platform (English, German, Dutch)

---

*Roadmap created: 2026-04-06*
*v1.0 archived: 2026-04-18 — 15/15 requirements, 9 phases shipped*
*v1.0.1 archived: 2026-04-26 — 18/18 requirements, 4 phases shipped (7–10)*
*Far-horizon + vision merged from root ROADMAP.md: 2026-04-30*
