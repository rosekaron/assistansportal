# Milestones

Shipped-version history for Kalinga Assistansportal. Each entry is a closed, archived milestone. For in-flight work, see [ROADMAP.md](ROADMAP.md).

---

## v1.0.1 — Salary Slip + Foundation Cleanup (Shipped 2026-04-25)

**Tag:** `v1.0.1` (merge commit `a796a12`)
**PR:** [#7 — milestone/v1.0.1 → main](https://github.com/rosekaron/assistansportal/pull/7)
**Branch at archive:** `milestone/v1.0.1`
**Timeline:** 2026-04-18 → 2026-04-25 (8 calendar days)
**Scope:** 4 phases · 13 plans · 18/18 requirements satisfied

**Full detail:** [milestones/v1.0.1-ROADMAP.md](milestones/v1.0.1-ROADMAP.md) · [milestones/v1.0.1-REQUIREMENTS.md](milestones/v1.0.1-REQUIREMENTS.md) · [milestones/v1.0.1-MILESTONE-AUDIT.md](milestones/v1.0.1-MILESTONE-AUDIT.md) (main↔milestone divergence reconciliation)

### What shipped (by phase)

**Phase 7 — Foundation: Schema & Cleanup** (2026-04-18)
- Added 23 new columns + 3 enums across `assistants` / `profile` / `payroll_records` (skattetabell, tax_scheme, bank fields, split address, employment dates, FK decision period, patient_relation, dubbel_assistans flag, payment_method, salary_model, hourly_rate_override, default_pay_day)
- Removed dead scheduling scaffolding: `open_slots` table dropped, `/api/slots` + self-book endpoints deleted, Settings "Scheduling" card removed, 3 dead settings keys removed from `seedDefaults()`
- Settings refactored into 2-section collapsible dialogs (max-w-lg Assistants edit; FK-beslut section on Profile); SetupWizard captures FK decision dates + patient relation on first-run
- Resolved pre-existing v1.0 schema drift (7 orphaned columns + 3 timestamptz declaration mismatches)

**Phase 8 — Employer Representation Helper** (2026-04-19)
- Pure-function `resolveEmployerRepresentation(profile, asOfDate)` at `server/src/lib/employer-representation.ts` returns structured `{ arbetsgivare, företrädare, isMinor }`
- FK 3057, FK 3059, SKV 4805 refactored to consume the helper; signature/contact fields remain guardian-sourced per D-09
- 16 unit tests cover minor-by-pno / adult-with-override / adult-without-override / turns-18 boundary / malformed pno / address fallback
- D-14 grep gate: zero direct `profile.guardianName` references for employer field anywhere under `server/src/`

**Phase 9 — Salary Slip (Anhörig Model)** (2026-04-20)
- `payment_slips` audit table with `(assistantId, reportMonth, sequence)` unique index for replay-safe document numbering
- Pure `buildAnhorigSlip()` builder + `renderAnhorigSlipPdf()` pdfkit renderer at `server/src/lib/`; 23 unit tests covering numerics + absences + VAB YTD + minor/adult/override header branching
- Three JWT-scoped endpoints: `POST /api/pdf/lonespec` (guardian) + `GET /api/pdf/lonespec/me` (assistant self-service, IDOR-safe) + `GET /api/assistant/slips` (listing); 21 route-integration tests
- 400 NULL-rate gate runs BEFORE 409 approval gate (D-12) — guides guardian to "set the rate," not "re-approve payroll"
- Monthly "Lönespecifikation" section (3 disabled states: ready / Lönekörning ej godkänd / Timlön saknas), AssistantDashboard "Lönespecifikationer" card, Settings 4 fields (Avtalsmodell, Utbetalningssätt, Timlön, Utbetalningsdag)
- UAT 9/9 passed (cold start, Settings persistence, guardian PDF download, /me self-service, disabled-state gates, IDOR block, replay idempotency, D-09 pay-date freeze, Swedish locale PDF content)

**Phase 10 — Real Data Entry & End-to-End Verification** (2026-04-24)
- Plan 10-01: Profile data entered via `PUT /api/profile` (split-address fields + legacy D-02 sync); FK decision fields deferred per VERIFICATION rationale (schema-only, no PDF consumer)
- Plan 10-02 superseded mid-flight — guardian chose `--interactive` mode over agentic PUT pipeline; assistants data (Rose + Mikael) entered through Settings UI in the same E2E session
- Plan 10-03 UAT: 3 PDF tests passed with 0 placeholder hits — FK 3057 (after inline `decryptAndFill` regression fix in commit `8b93937`), Rose SKV 4805, Rose lönespec LS-2026-03-001 re-download (D-06 rebuild + D-09 freeze observed)
- Inline fix shipped: Phase 8's refactor missed `/fk3057` route — Test 1 surfaced the HTTP 500, fix applied + tested + committed in the same session

### Reconciliation note: PR #7 merge process

PR #7 was originally merge-blocked because `main` had 30 parallel commits (multi-family backend + clock-in/out + AssistantDetail + real OAuth) the milestone branch never inherited. Reconciled in commit `e389a0d` per 6 explicit decisions; the milestone UI won for guardian/assistant pages, main's multi-family backend kept, main's compatible FK form fixes (väntetid/beredskapstid totals, mkSlots helper, arbetsgivare checkbox) kept. Full audit at [milestones/v1.0.1-MILESTONE-AUDIT.md](milestones/v1.0.1-MILESTONE-AUDIT.md).

### Requirements delivered

All 18 v1.0.1 requirements satisfied. Traceability in [milestones/v1.0.1-REQUIREMENTS.md](milestones/v1.0.1-REQUIREMENTS.md).

| Category | Reqs | Status |
|----------|------|--------|
| Salary Slip | SLIP-01..07 | ✓ |
| Employer Representation | EMP-01..02 | ✓ |
| Schema Additions | SCHEMA-01..03 | ✓ |
| Scheduling Cleanup | CLEAN-01..03 | ✓ |
| Real Data | DATA-01..03 | ✓ (DATA-01 closed via VERIFICATION rationale — `fk_decision_*` is schema-only) |

### Stats

- 85 non-merge commits on milestone branch (21 feat / 8 test / 6 chore / 3 fix / 2 refactor / 46 docs)
- 211 files changed (+17,857 / −29,744 lines — net code reduction from scheduling scaffolding removal)
- 60+ new tests (23 slip unit + 21 route-integration + 16 employer helper)
- Source LOC at ship: 14,628 TS/TSX (server + client)

### Deferred items (rolled into v1.0.2 backlog)

Tracked in [todos/pending/2026-04-25-v1.0.2-hardening-from-pr7-review.md](todos/pending/2026-04-25-v1.0.2-hardening-from-pr7-review.md).

- **6 HIGH-severity CodeRabbit findings** (most pre-existing, not v1.0.1 regressions): TOCTOU on clock-in, multi-table ops without transactions, missing UNIQUE on `assistantGuardianLinks(assistantId, guardianId)`, JWT in query parameter logged, `e.message` leaked to clients
- **Multi-family Settings UI** — backend wired but UI dropped at merge per Decision #4 reversal; needs re-add in milestone's 2-section shape
- **`hourlyRateOverride = 0.31` parsing bug** — likely Swedish decimal-comma issue in Settings input (CodeRabbit-validated)
- **Plan 10-04 (FK decision fields gap-closure)** — recommended for DROP per `10-VERIFICATION.md` (`fk_decision_*` is schema-only); revisit if v1.2 SUBMIT introduces a consumer
- **Pre-existing PII leak** in `.planning/HANDOFF.md` git history (commit `9c38efc`) — low-priority redaction

### Next milestone

**v1.0.2** — Hardening (CodeRabbit findings + multi-family UI re-add + Swedish decimal-comma fix). Or pivot to a feature milestone (v1.1 Bulk Schedule, v1.2 Submission Readiness, design-wireframes implementation seed). See [ROADMAP.md](ROADMAP.md).

---

## v1.0 — Stability, Compliance, and Core Payroll (Shipped 2026-04-18)

**Tag:** `v1.0`
**Branch at archive:** `milestone/v1.0-mvp`
**Timeline:** 2026-04-06 → 2026-04-18 (13 calendar days)
**Scope:** 9 phases · 36 plans · 51 tasks · 15/15 requirements satisfied

**Full detail:** [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) · [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md) · [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md)

### What shipped (by phase)

**Phase 1 — Stability & Correctness** (2026-04-06)
- `requireGuardian` and `requireAssistant` middleware wired to 37 + 7 route handlers across 9 files; 25 catch blocks hardened to return generic errors and log internally
- FK 3057 month-end date corrected to `daysInMonth` (fixes February/April bug); JWT startup guard exits on weak secret; `/api/rates` endpoint exposes env-sourced FK + tax rates behind `requireGuardian`
- Client-side `Entry` / `Blocked` / `Assistant` TypeScript interfaces created; Hours.tsx and Reports.tsx migrated to camelCase field access; STAB-04 regression tests GREEN

**Phase 2 — Leave & Absence Foundation** (2026-04-06)
- Drizzle schema extended with `absenceTypeEnum` (4 Swedish values: sjukfrånvaro/VAB/semester/other), `absences` table (7 columns), and `reqStatusEnum "cancelled"` — all pushed to PostgreSQL
- Full absence API layer: CRUD routes, VAB/sick balance endpoint (120-day cap), FK billing exclusion via pure `filterBillableEntries()` function, server-side 409 block on clock-in during absence
- Complete Frånvaro guardian UI: `absenceApi` namespace, Leave page (balance cards + absence table + record dialog + filters), sidebar nav, per-assistant balance row in Assistants page

**Phase 2.5 — UI Overhaul & Design System** (2026-04-08)
- Tailwind ESM/CJS build bug fixed (`tailwind.config.js` `require()` → `import`) — unblocks visual work
- B2B-ready colour tokens introduced; guardian Layout + Dashboard redesigned; AssistantDashboard light-theme refresh
- Consistency pass across Leave, Login, Calendar, Reports, Assistants, Settings

**Phase 3 — Payroll Calculation & Recording** (2026-04-10)
- Pure `calculatePayroll()` + `calculateOutstandingBalance()` functions (8 tests GREEN); `payroll_records` + `payments` tables applied to database
- Express routes for payroll generation, approval (with lock), and payment recording — with auth guards, snapshotted rate values, per-absence-type breakdown, and idempotent generate semantics
- Guardian payroll page: month selector, per-assistant approval cards, inline payment recording, sv-SE locale currency formatting end-to-end

**Phase 3.5 — UX Consolidation & IA Redesign** (2026-04-11)
- PostgreSQL `clock_events` + `assistant_guardian_links` tables created via DDL; `entries.verified` column added — foundation for clock-in/out and multi-family
- App.tsx reduced from 7 guardian routes to 4 (home/monthly/records/settings) with 9 legacy redirects; sidebar nav reduced from 7 → 4 items
- Guardian home page with 7-day schedule grid, GCal status banner, FK-gated download, payroll pending count, mark-absent dialog
- Clock-in/out hero replaces proposals workflow in AssistantDashboard; live timer, family selector with sessionStorage persistence, read-only Reports tab

**Phase 4 — Tax Reporting (AGI)** (2026-04-11)
- Corrected payroll formula: `gross = (billableHours × hourlyRate − costs) / (1 + taxRate)`; migration recalculated draft records
- `form4805-utils.ts` pure field-mapping module + `POST /api/pdf/4805` endpoint + client `pdfApi.form4805` helper
- Monthly.tsx 4-step stepper with per-assistant blankett 4805 download buttons gated on approved payroll; Settings gains preliminary tax rate + assistant address fields

**Phase 5 — Scheduling & Compliance Workflow** (2026-04-17)
- Assistant-row weekly schedule table in Home.tsx (SCHED-01 unified week view); later refactored in milestone close-out to read from GCal
- `deadlineUtils.ts` implementation + Monthly.tsx ProgressStepper enhanced with FK/AGI due-date badges and approval-count sublabels — delivers COMP-01
- Node-cron compliance reminder job with `sendComplianceReminderEmail`, server-side `reminder_day` validation, Settings Notifications card — COMP-02 end-to-end

**Phase 6 — Google Calendar Integration** (2026-04-15)
- Real OAuth2 connect flow replacing the simulated placeholder
- Guardian connects their actual Google Calendar, sees real calendar names in a dynamic picker, and disconnects cleanly
- GCal event CRUD endpoints; clock-out → GCal outbound sync (added during audit close-out)

**Phase 6.1 — UAT Bug Fix** (2026-04-15)
- Guardian self-registration as assistant via dedicated dialog (BUG-005)
- Home schedule week navigator with Prev/Today/Next controls (BUG-002)
- Invite email SMTP path verified (BUG-004) — all 3 remaining UAT bugs closed

### Additional fixes applied during audit close-out (2026-04-17/18)

Commits `309311e`, `e3bf56c`, `36dcec4`, `51cb7bb`:
- Retrospective `VERIFICATION.md` written for Phases 03, 04, 06 (all success criteria pass)
- `seedDefaults()` now seeds `preliminary_tax_rate` and `reminder_day` so fresh DB boots with defaults
- `accept-invite` auto-creates `assistants` row if missing — fixes orphaned-assistant bug for new invites
- Outbound clock-out → GCal sync implemented
- 7 orphaned client pages deleted (Calendar, Leave, Payroll, Reports, Hours, Assistants, Dashboard)
- Monthly "Total employer cost" label bug fixed — summary chip now shows full cascade `gross + arbetsgivaravgifter = total`
- Server typecheck fully clean (fixed pre-existing TS2339 errors on `calendar.events.insert`)
- Home schedule grid refactored to read from Google Calendar (display source); `entries` remains the billing source — documents the drift that v2.0 will reconcile
- `/api/gcal/events` Sunday-clipping bug fixed (exclusive `timeMax` issue); multi-shift-per-day cell render fixed

### Requirements delivered

All 15 v1 requirements satisfied. Traceability in [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md).

| Category | Reqs | Status |
|----------|------|--------|
| Stability & Correctness | STAB-01..04 | ✓ |
| Leave & Absence | LEAV-01..03 | ✓ (Phase 02 `human_needed` sign-off pending guardian walkthrough) |
| Payroll | PAY-01..03 | ✓ |
| Tax Reporting (AGI) | TAX-01..02 | ✓ |
| Scheduling | SCHED-01 | ✓ |
| Compliance Workflow | COMP-01..02 | ✓ |

### Accepted known issues (deferred, not blocking)

Full detail in [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) "Accepted as v1.0 Known Issues" section.

- Preliminärskatt uses single global flat rate (30%) — Skatteverket's own fallback for unknown skattetabell is 30%, so filings valid. Deferred until 3rd assistant or F-skatt case.
- Omkostnader pot (H5) not modelled — FK schablon 100% allocated to lönekostnader instead of Fremia ~87/8/3/2 split. Overpays gross by ~7 000 SEK/month per assistant. Deferred pending advisor input.
- Age-bracket arbetsgivaravgifter (67+, 19–23) not supported. Flat 31.42% for all. Addressed with H3 in v1.4 Fremia model.
- Monthly `outstanding` balance uses gross, not net. UX choice, not error.
- FK 3057 / 4805 employer-name field uses `guardianName` — correct for minor brukare (current users), silently wrong for adult brukare. Fix ships in v1.0.1 via `resolveEmployerRepresentation()` helper.

### Deferred non-code items

- Phase 02 + 06.1 `VERIFICATION.md` in `human_needed` status — guardian walkthrough pending
- 3 Phase 6 UAT items blocked on live Google OAuth credentials
- 4/9 phases missing `VALIDATION.md`; 4/9 in `draft` Nyquist status
- March 2026 retroactive filing blocked on labor-law advisor review ([compliance/2026-03-advisor-brief.md](compliance/2026-03-advisor-brief.md))

### Next milestone

**v1.0.1** — Salary Slip + Foundation Cleanup. Urgent / legally required. See [ROADMAP.md](ROADMAP.md).

---
