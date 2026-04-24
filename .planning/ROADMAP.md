# Kalinga Assistansportal — Roadmap

**Project:** Swedish personal assistance (assistansersättning) self-management platform with compliance and payroll integration
**Current milestone:** v1.0.1 — Salary Slip + Foundation Cleanup (EXECUTING; 85% — Phase 10 in-flight, plan 10-01 closed 2026-04-24)
**Last updated:** 2026-04-24

---

## ▶ HANDOFF — read this first if you're resuming cold

If you're a new session / new LLM and have never seen this project before, **read this section, then PROJECT.md, then the detailed milestone sections below. Skip nothing.**

### Where the project stands (as of 2026-04-20 — PAUSED)

- **Status: PAUSED.** User paused development 2026-04-20 with everything committed and pushed. See [STATE.md](STATE.md) and [HANDOFF.md](HANDOFF.md) for the full cold-start briefing. Resume with `/gsd-plan-phase 10`.
- **v1.0 is shipped and archived** (2026-04-18). 9 phases shipped, 36 plans summarised, 15/15 requirements satisfied in code. Git tag `v1.0`. Branch `milestone/v1.0-mvp` on `origin`. Full archive at [.planning/milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md).
- **v1.0.1 is the active milestone** (kicked off 2026-04-18). 4 phases (7–10), 18 requirements. Branch `milestone/v1.0.1` on `origin` — HEAD `850ecbb`. **Phases 7, 8, 9 all complete and UAT-verified. Phase 10 context captured, ready for planning.** No PR is open against `main`; strategy is to hold the PR until Phase 10 ships and then open the full v1.0.1 merge.
- **Phase 9 (Salary Slip) shipped 2026-04-20** — lönespec PDF pipeline live end-to-end. 4 plans summarised (schema+whitelists, builder+renderer, endpoints+allocation, UI surfaces). UAT: 9/9 tests passed automatically (cold start, Settings persistence, PDF download guardian + /me, disabled-state server gates, IDOR, replay idempotency, pay-date freeze D-09, PDF content Swedish locale). Evidence at `.planning/phases/09-salary-slip/09-UAT.md`.
- **Phase 10 (Real Data Entry & E2E Verification) is next** — data-entry phase, not code-heavy. Context captured at `.planning/phases/10-real-data-entry/10-CONTEXT.md` (D-01..D-07 locked). Planning has not been authored. Resume action: `/gsd-plan-phase 10`.
- **The app itself works end-to-end** — guardian can run the full monthly compliance cycle (schedule, approve, payroll, FK 3057, FK 3059, SKV 4805, now also salary slip) in the current UI. v1.0 accepted-known-issues and deferred items are catalogued in [.planning/milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md).

### The essential facts about this product

- **Users:** one guardian (parent of a disabled child), two assistants (Rose + Mikael, both parents of the patient). The patient is the legal employer (brukare); the guardian acts as company administrator and on-behalf-of-minor representative.
- **Anhörigassistans arrangement:** Rose + Mikael work under mutual agreement — fixed hourly rate (254.10 kr/h), no paid sick leave, no VAB pay, no vacation pay, no pension. This is legal because they're the patient's parents. Arbetsgivaravgifter (31.42% employer tax) still apply.
- **Tech stack:** React + Vite (client) / Express + Drizzle + PostgreSQL (server) / pdf-lib + pdfkit (PDFs) / React Query + Zustand (state). TypeScript throughout.
- **Source of truth duality:** schedule display on Home.tsx reads Google Calendar; FK/payroll/invoice calculation reads internal `entries` table. This drift is a known design issue — v2.0 will reconcile.

### What was decided in the 2026-04-18 session

Eight concrete decisions that bind future work:

1. **Payroll formula label bug fixed** — commit `51cb7bb`. `Monthly.tsx:544` summed `r.employerContributions` under a "Total employer cost" label. Now sums `r.totalEmployerCost` and the chip shows the cascade `gross X + arbetsgivaravgifter Y = total Z`. This resolved the confusing "gross > cost" display that triggered the discussion. The underlying formula was always correct.

2. **Preliminärskatt flat 30% accepted as v1 known issue.** Skatteverket's own fallback for unknown skattetabell is also 30%, so filings are valid. Per-assistant skattetabell lookup is deferred to v1.4 or later. Guardian's quote: "For tax, it is OK for as long as we are not doing anything illegal."

3. **Omkostnader pot (H5) accepted as v1 known structural issue.** The current formula spends 100% of FK schablon on lönekostnader; the Fremia schablon expects ~87% to lönekostnader and ~13% to omkostnader/admin/arbetsmiljö. This means the current code overpays gross by ~7000 SEK/month per assistant vs schablon-correct accounting. Deferred to a future milestone pending advisor input.

4. **Salary slip scoped as v1.0.1 (urgent, legally required).** Anhörig model only — fixed hourly, no benefits, no employer-side numbers on slip (arbetsgivaravgifter + total kostnad removed per guardian direction; those belong on employer accounting, not on assistant's document). Absence section (sick/VAB/vacation days) visible even when 0 SEK. Minor-patient detection adds "Företrädd av [guardian]" line when brukare is under 18.

5. **Fremia and Custom salary models scheduled as v1.4 / v1.5.** Scaffolding (enum + dropdown options) ships in v1.0.1 but no live logic. Triggered when a non-family assistant is hired on kollektivavtal.

6. **Scheduling scaffolding to be removed.** Settings.tsx has a "Scheduling" card (self-book toggle, approval mode, booking window) that is dead code — no server route actually gates on these settings. Also openSlots table + self-book endpoints are unreachable from the current IA. Removal scoped into v1.0.1 cleanup pass.

7. **Schema-additions todo absorbed into v1.0.1.** Originally a shared foundation todo. Merged because v1.0.1 is already touching `assistants` + `profile` for salary-slip work, and adding all the flagged schema columns (skattetabell, bank fields, employment dates, split address, dubbel-assistans flag, FK decision period, patient_requires_representative, etc.) unblocks v1.2 + v1.3 too. Expands v1.0.1 estimate from 5 days to ~7–8 days.

8. **GCal/entries drift deferred to v2.0.** Home grid displays from GCal, FK/payroll reads from entries — can diverge (e.g. 97h shown on grid, 0h billable). No small-scope fix is viable; bidirectional reconciliation is its own milestone.

### Latent bug found this session (ships with v1.0.1)

`form4805-utils.ts:91,120` and `pdf.ts:140,141,147,303,373` hardcode `profile.guardianName` as the employer name on SKV 4805 + FK 3057 + FK 3059. Correct when patient is a minor (Kalinga's actual user base). **Silently wrong** for any adult brukare. Fix plan: extract `resolveEmployerRepresentation()` helper that returns `{ arbetsgivareName, företrädareName | null }` based on minor-detection from pno + optional `patient_requires_representative` flag. Ship with v1.0.1 (same helper used by salary slip).

### Outstanding threads you'll inherit

- **Phase 02 + 06.1 human-needed verifications** — LEAV-01/02/03 + BUG-004 SMTP pending guardian walkthrough. Can be flipped to `passed` during v1.0 archive if guardian confirms, or documented as deferred verification debt.
- **March 2026 retroactive filing** — 84 entries imported from GCal, reverted to draft, payroll records deleted. Advisor review pending. See [.planning/compliance/2026-03-advisor-brief.md](compliance/2026-03-advisor-brief.md) for full brief. Guardian must provide real brukare pno, beslutsnummer, addresses before any filing.
- **3 Phase 6 UAT items blocked on live Google OAuth credentials.**
- **Nyquist validation gaps** — 4/9 phases missing VALIDATION.md, 4/9 are `draft` status.

### How to pick up the work

For the next session / new LLM:

1. **If user says "continue v1.0.1":** Phase 7 is complete — pick up Phase 8 (Employer Representation Helper). Read `.planning/phases/07-foundation-schema-cleanup/07-VERIFICATION.md` for the foundation that's in place, then the Phase 8 section below, then run `/gsd-discuss-phase 8` (if no 08-CONTEXT.md exists) or `/gsd-plan-phase 8`.
2. **If user asks a specific question about any decision:** the session decisions list above has the reasoning. Cross-references point to the audit, compliance brief, or todo files with full context.
3. **If user asks about the schema or current Settings UI:** it's the state after Phase 7 — 23 new columns + 3 new enums live in Postgres, Settings has 2-section collapsibles for Profile (Personuppgifter / FK-beslut) and Assistants edit (Personuppgifter / Anställning & ekonomi) with `max-w-lg` dialog. Read `.planning/phases/07-foundation-schema-cleanup/07-01-SUMMARY.md` for the exact column list.

### Artifacts that together tell the full story

| Document | Why it matters |
|----------|---------------|
| [PROJECT.md](PROJECT.md) | Stable product context: what the app is, who it's for |
| [STATE.md](STATE.md) | Current session state + paused/resumed protocol |
| [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) | v1.0 audit with all known issues, fixes applied, accepted debt |
| [milestones/v1.0-ROADMAP.md](milestones/v1.0-ROADMAP.md) | v1.0 shipped phase details (archived) |
| [MILESTONES.md](MILESTONES.md) | Shipped-version history with accomplishments |
| [compliance/2026-03-advisor-brief.md](compliance/2026-03-advisor-brief.md) | March 2026 retroactive-filing analysis and legal risk findings |
| [todos/pending/*](todos/pending/) | 10 todos — each tagged with `planned_milestone` where applicable |

---
## v1.0 Retrospective

### Shipped code (9 phases, 36 plans)

All code for milestone v1.0 is merged into `milestone/v1.0-mvp`. Guardian can complete the full monthly compliance cycle end-to-end:

| Phase | What shipped |
|-------|--------------|
| 1 — Stability & Correctness | role middleware, FK 3057 date fix, rates env-configurable, camelCase client types |
| 2 — Leave & Absence | absence CRUD, VAB 120-day balance, billable-hours filter excludes absences |
| 2.5 — UI Overhaul | Tailwind fix, B2B-ready visual system across guardian + assistant |
| 3 — Payroll | calculatePayroll + payroll_records + payments ledger + Monthly UI |
| 3.5 — UX/IA Redesign | 4-route IA (Home/Monthly/Records/Settings), clock-in/out, multi-family links |
| 4 — Tax Reporting (AGI) | corrected payroll formula, prelim_tax snapshot, SKV 4805 PDF |
| 5 — Scheduling & Compliance | multi-assistant Home grid, Monthly stepper, deadline reminders, reminder cron |
| 6 — Google Calendar | real OAuth2, calendar picker, event CRUD, clock-out → GCal outbound sync |
| 6.1 — UAT Bug Fix | BUG-002 week navigator, BUG-004 invite email, BUG-005 self-registration |

### Known Fixes (applied during 2026-04-17/18 sessions)

| Fix | Commit | What it resolved |
|-----|--------|-----------------|
| Missing VERIFICATION.md for Phases 03/04/06 | `309311e` | Retrospective verifications written, 3/3 / 4/4 / 4/4 success criteria pass |
| `seedDefaults()` missing `preliminary_tax_rate`, `reminder_day` | `309311e` | Fresh DB now seeds both defaults |
| Outbound clock-out → GCal sync not implemented | `309311e` | `clock.ts` now mirrors verified shift to calendar |
| 7 orphaned client pages compiled but unreachable | `309311e` | Deleted Calendar/Leave/Payroll/Reports/Hours/Assistants/Dashboard pages |
| Pre-existing TS2339 errors on `calendar.events.insert` | `309311e` | Server typecheck fully clean |
| `accept-invite` didn't create assistants row if missing | `e3bf56c` | Invitees now always get a full assistants+auth+guardianLink triple |
| Home schedule grid read from entries, diverging from GCal | `36dcec4` | Grid now reads GCal directly; entries fallback when disconnected. Sunday clipping fixed. Multi-shift-per-day render fixed. |
| Monthly "Total employer cost" showed tax slice only | `51cb7bb` | Now sums correct field; summary chip shows cascade |
| Login silent failure bug (pre-existing todo) | Phase 02.5-05 consistency pass | Error display inline below submit; verified working. Todo closed as already-fixed. |

### Accepted as v1.0 Known Issues (documented, not fixed)

Full detail in [milestones/v1.0-MILESTONE-AUDIT.md](milestones/v1.0-MILESTONE-AUDIT.md) "Accepted as v1.0 Known Issues" section.

| Issue | Why accepted | When revisited |
|-------|--------------|----------------|
| Preliminärskatt is a single global flat rate (default 30%) applied to all assistants — no per-assistant skattetabell, no jämkning, no F-skatt, no engångsbelopp rules | Skatteverket's own fallback for unknown skattetabell is 30%. Filings are valid. Guardian's situation (2 assistants, similar income) makes a flat rate OK. | Third assistant joins / assistant files F-skatt / assistant requests jämkning. Then v1.4+ scope. |
| Omkostnader pot (H5) not modelled — FK schablon 100% allocated to lönekostnader instead of ~87%/8%/3%/2% Fremia split. Overpays gross by ~7000 SEK/month per assistant | Requires formula redesign, migration strategy for approved records, advisor input on exact split for this household's arrangement. | Advisor input + v1.4 scope (with Fremia model) or a dedicated "payroll formula redesign" milestone. |
| Monthly `outstanding` balance computed from gross, not net | Small UX gap. Not material at current scale. | Part of full Fremia model (v1.4) or a payslip/net-pay UX pass. |
| Age-bracket arbetsgivaravgifter not supported (flat 31.42% for all; should be 10.21% age 67+, 17.77% age 19–23) | Current assistants don't fall in reduced-rate bands. | When hiring outside standard bracket. Closes with H3 in v1.4. |
| FK 3057/3059/4805 use `guardianName` as employer name — correct for minor brukare, silently wrong for adult brukare | Current user base = minor patient. **Closed by the minor-vs-adult helper in v1.0.1** (not strictly v1.0). | v1.0.1 ships the fix. |

### Unresolved Deferred Items (not v1.0 bugs, just not done)

| Item | Status |
|------|--------|
| GCal `/events` returns 500 when guardian not connected (React Query swallows) | Minor; cosmetic |
| Phase 02 + 06.1 VERIFICATION.md in `human_needed` state | Await guardian walkthrough |
| 3 Phase 6 UAT items blocked on live OAuth credentials | External |
| 4/9 phases missing VALIDATION.md; 4/9 in `draft` status | Process debt |
| March 2026 retroactive filing blocked on advisor review + real brukare data | External |

---

## Phases (v1.0) — shipped

- [x] **Phase 1: Stability & Correctness** — Fix critical security, data isolation, and calculation bugs before adding features (completed 2026-04-06)
- [x] **Phase 2: Leave & Absence Foundation** — Implement absence tracking so billable hours can be calculated correctly downstream (completed 2026-04-06)
- [x] **Phase 2.5: UI Overhaul & Design System** — Fix Tailwind CSS rendering, rebuild visual design to B2B-ready care.com-inspired standard for both guardian and assistant views (completed 2026-04-08)
- [x] **Phase 3: Payroll Calculation & Recording** — Monthly payroll per assistant with 2026 Swedish tax rates and employer contributions (completed 2026-04-10)
- [x] **Phase 3.5: UX Consolidation & IA Redesign** — Audit all pages, consolidate features by user goal, produce formal UI-SPEC with one-page-one-purpose information architecture (completed 2026-04-11)
- [x] **Phase 4: Tax Reporting (AGI)** — Generate Skatteverket-ready AGI declarations per month (completed 2026-04-11)
- [x] **Phase 5: Scheduling & Compliance Workflow** — Multi-assistant schedule grid, monthly compliance checklist, and deadline reminders (completed 2026-04-17)
- [x] **Phase 6: Google Calendar Integration** — Real OAuth2 connection to Google Calendar with calendar picker, replacing the simulated connect flow (completed 2026-04-15)
- [x] **Phase 6.1: UAT Bug Fix** (inserted) — 3 remaining UAT bugs (BUG-002 week navigator, BUG-004 invite email, BUG-005 self-registration) (completed 2026-04-15)

---

## v1.0.1 — Salary Slip + Foundation Cleanup (ACTIVE)

**Why urgent:** Swedish labor law (and any applicable kollektivavtal) requires the employer to issue a written pay record to each employee each pay period. Currently **zero provision** — Rose and Mikael receive a bank transfer reference only. This is statutory non-compliance for an ongoing employment relationship.

**Why absorbed foundation items:** While the core deliverable is the salary slip, four related items were absorbed to avoid rework and schema drift: schema columns needed by v1.2 + v1.3, employer-representation helper shared by FK/4805/slip renderers, scheduling scaffolding removal, and real-data entry.

**Effort estimate:** ~6.5 days (1 calendar week including review).

**Full design narrative:** retained below under "v1.0.1 Design Reference" — that section is the source input for the formal phase breakdown and is preserved for traceability.

### Phases (v1.0.1)

- [x] **Phase 7: Foundation — Schema & Cleanup** — Shipped 2026-04-18. All new `assistants` + `profile` columns live, PUT whitelists extended, dead scheduling scaffolding removed, Settings 2-section UI + SetupWizard additions verified. 22/22 must-haves passed.
- [x] **Phase 8: Employer Representation Helper** — Shipped + UAT clean. `resolveEmployerRepresentation()` helper extracted; FK 3057, FK 3059, SKV 4805 renderers refactored; employer-name bug closed; slip renderer consumes helper via report-period-end date.
- [x] **Phase 9: Salary Slip (Anhörig Model)** — Shipped 2026-04-20 (`ad13a6a`). 4 plans summarised. Lönespec PDF live: guardian POST, assistant GET /me, slip listing endpoint, pdfkit renderer, 23 unit tests + 21 integration tests. UAT 9/9 passed (cold start, 4 Settings fields persist, guardian download, disabled-state gates, AssistantDashboard self-service, IDOR block, replay idempotency, D-09 pay-date freeze, Swedish locale PDF content). Fremia/Custom scaffolding disabled per v1.4/v1.5 deferral.
- [ ] **Phase 10: Real Data Entry & End-to-End Verification** — 🔄 Executing. Plan **10-01 closed 2026-04-24** (address-split fields + legacy D-02 sync populated via PUT /api/profile; FK decision number/start/end DEFERRED to new gap-closure plan 10-04 per guardian checkpoint decision). Plans **10-02 Assistants** and **10-03 PDF UAT** still pending. **Plan 10-04 (new)** will close the deferred FK fields and finish DATA-01 after the main flow.

---

## v1.0.1 Design Reference (narrative source)

This section is the 2026-04-18 design narrative that fed the formal phases above. It is preserved for traceability — phase plans draw from these details but the phase breakdown is authoritative.

### Scope — Salary Slip (anhörig model only)

**Data model additions:**
- `assistants.salary_model` enum: `anhörig` (default, fully wired) | `fremia` (UI scaffolding only, disabled) | `custom` (UI scaffolding only, disabled)
- `assistants.hourly_rate_override` numeric — per-assistant rate decoupled from FK schablon. Rose + Mikael both confirmed at **254.10 kr/h** 2026-04-18 (consumes the entire FK lönekostnader allocation since they have no benefits on top).
- `assistants.employment_start_date` / `employment_end_date` — for period gating, future FK period-expiry checks
- New `payment_slips` table: `{ id, payrollRecordId, documentNumber, issuedAt, payMethod, payDate }` — bokföringslag audit trail
- `payroll_records.salary_model_snapshot` + `hourly_rate_used` — freeze at generation time

**New server module** — `server/src/lib/payrollSlipUtils.ts`:
- Pure function `buildAnhorigSlip(input) → SlipFields` for testability
- Inputs: `{ profile, assistant, payrollRecord, entries, absences, asOfDate }`
- Output: ordered key-value map + formatted Swedish labels

**New endpoints:**
- `POST /api/pdf/lonespec` (guardian only, `requireGuardian`) — generates slip PDF for any assistant/month
- `GET /api/pdf/lonespec/me?month=YYYY-MM` (assistant, `requireAssistantAccess`) — assistant's own slips only
- Both return 409 if `payroll_records.status !== "approved"` for that month (same gate as 4805)

**New UI:**
- **Monthly.tsx** — per-approved-assistant "Ladda ner lönespecifikation" button alongside existing 4805 download
- **AssistantDashboard** — new "Lönespecifikationer" section: list of past slips with download buttons (own records only, scoped via JWT)
- **Settings → Assistants edit dialog** — salary-model dropdown (only "Anhörigassistans" enabled; "Fremia" / "Custom" shown as "(Kommer i v1.4 / v1.5)" disabled options) + hourly-rate override field + employment start/end date pickers

**New API (absence totals):** `GET /api/absences/balance/:assistantId/:year` → `{ sjuk, vab_used, vab_remaining (120 − used), semester, other }`. Slip uses this for the Frånvaro section.

**Slip content (anhörig), final layout:**
```
LÖNESPECIFIKATION                          Nr: LS-2026-03-001
Arbetsgivare:    [Patient name], [Patient pno]
Företrädd av:    [Guardian name], [Guardian pno]   ← only if patient <18
Anställd:        Rose Karon, 8011155069
Period:          1 mars – 31 mars 2026
Utbetalningsdag: 25 april 2026
Avtalsmodell:    Anhörigassistans (fast timlön, ej sjuk/sem)

ARBETSTID
  Arbetade timmar      215,0 tim
  Sjukfrånvaro           0 dagar
  VAB                    0 dagar (år till dato: 0/120)
  Semester               0 dagar (tagna i år: 0)
  Annan frånvaro         0 dagar

LÖN
  Grundlön  215,0 × 254,10          54 631,50 kr
  Sjuklön                                0,00 kr *
  VAB-lön                                0,00 kr *
  Semesterlön                            0,00 kr *
  BRUTTOLÖN                         54 631,50 kr

AVDRAG
  Preliminärskatt 30% (schablon)   −16 389,45 kr
  NETTO TILL BANK                   38 242,05 kr

* Ingen ersättning vid sjukdom, VAB eller semester
  enligt överenskommelse (anhörigmodell).
```

**Intentionally excluded** (per guardian direction 2026-04-18):
- Arbetsgivaravgifter line — employer-side, not the assistant's concern
- Total kostnad line — same reason
- YTD cumulative (can be added later)
- OB-tillägg, helgersättning, jour/beredskap — Fremia model (v1.4)
- Tjänstepension, AFA-försäkringar, semesterlön reserve — Fremia model (v1.4)

### Scope — Employer Representation Helper (absorbed from minor-vs-adult todo)

**Problem:** Current FK 3057 + 4805 code uses `profile.guardianName` where the legal arbetsgivare should be the brukare. Correct for minor-brukare (Kalinga's current user base) but silently wrong for adult-brukare.

**Fix:** extract single helper and use across all three renderers (FK 3057, FK 3059, SKV 4805, salary slip).

`server/src/lib/employerRepresentative.ts` (NEW):
```ts
export function resolveEmployerRepresentation(profile, asOfDate) {
  const minor = isMinor(profile.patientPno, asOfDate) || profile.patient_requires_representative === true;
  return {
    arbetsgivareName: profile.patientName,
    arbetsgivarePno:  profile.patientPno,
    företrädareName:  minor ? profile.guardianName : null,
    företrädarePno:   minor ? profile.guardianPno  : null,
    isMinor:          minor,
  };
}
```

Refactor touchpoints:
- `form4805-utils.ts:91,120` — use `rep.arbetsgivareName` / `rep.företrädareName`
- `pdf.ts:140,141,147,303,373` — same refactor for FK 3057 / FK 3059
- `payrollSlipUtils.ts` — use for slip header

**New schema field:** `profile.patient_requires_representative` boolean — explicit override for adult-without-capacity case (god man / förvaltare scenario). When null, minor-detection from pno applies.

**Full design:** [todos/pending/2026-04-18-minor-vs-adult-patient-handling-across-fk-4805-salary-slip.md](todos/pending/2026-04-18-minor-vs-adult-patient-handling-across-fk-4805-salary-slip.md)

### Scope — Capture-Missing-Fields schema (absorbed)

All fields from the capture-missing-fields todo ship here because v1.0.1 already touches `assistants` and `profile`. Unblocks v1.2 + v1.3 downstream.

**`assistants` columns to add:**
- `skattetabell` (int) — per-individual A-skatt table number (captured but NOT used in v1.0.1 — flat 30% remains the behavior until v1.4 closes H3)
- `tax_scheme` enum (`a-skatt` | `f-skatt`) — captured but A-skatt is the only wired path
- `bank_clearing` / `bank_account` / `iban` (text) — payment target, shown on slip if present
- Split `address` into `address_street` / `address_zip` / `address_city`
- `citizenship` / `residence_permit_expiry` (text/date) — work authorization audit
- `notes` (text) — free-form per-assistant comments

**`profile` columns to add:**
- `patient_requires_representative` boolean — see Employer Representation Helper above
- `patient_relation_to_guardian` enum (`parent-child` | `spouse` | `adult-child` | `legal-guardian` | `god_man` | `other`) — triggers anhörigassistans rules
- `fk_decision_start` / `fk_decision_end` (date) — decision period, gates filings
- `fk_decision_hours_per_day` (int) — entitlement, v1.3 coverage-check dependency
- `dubbel_assistans_approved` boolean — v1.3 dubbel-assistans rule dependency
- Split shared `address` into `household_address_street` / `zip` / `city` (or keep as single and add separate `patient_address_*` vs `guardian_address_*` if household differs)

**Settings UI** — new fields in Settings → Profile + Settings → Assistants (already being edited for salary-model). One focused data-entry pass unblocks everything.

**Full design:** [todos/pending/2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md](todos/pending/2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md)

### Scope — Scheduling scaffolding removal

**Problem:** Settings.tsx has a "Scheduling" card (self-book toggle, approval mode, booking window). None of these settings are read by any server route — dead config. Plus `openSlots` table + `/api/slots` + `/api/assistant/self-book/:slotId` are unreachable from the current IA.

**Remove:**
- `client/src/pages/Settings.tsx` — the entire "Scheduling" card + `sched` state + `saveSched` mutation
- `client/src/lib/api.ts` — `slotsApi` helper (lines ~85–89) + `assistantApi.selfBook` + `assistantApi.openSlots` (lines ~217–218)
- `server/src/routes/misc.ts` — `/slots` GET/POST/DELETE (lines 16–38)
- `server/src/routes/assistant.ts` — `/self-book/:slotId` + `/open-slots` (lines 131–162)
- `server/src/db/schema.ts` — `openSlots` table definition (line 109)
- `server/src/db/index.ts` seedDefaults — drop keys `allow_self_book`, `self_book_approval`, `booking_window_days`

**Keep:**
- `sourceEnum "self_book"` in schema — still used by `clock.ts` as a marker for clock-origin (line 182). Not self-booking, just reuse of the enum value.

**Migration:** drop `open_slots` table. Optional: delete existing settings rows for the 3 dead keys (won't harm if left — just orphans).

### Scope — Real brukare / guardian / assistant data entered

Currently placeholder values (`TBD Guardian Name`, `patientPno: 000000-0000`, `fkDecisionNo: TBD-FK-DECISION`, etc). Without real values the FK/4805/salary slip PDFs all contain invalid data.

Not a code change — a guardian data-entry pass in Settings once the new fields from the capture-missing-fields absorption ship. Guardian enters:
- Real patient pno, name, address
- Real guardian pno, name
- FK beslutsnummer, beslut start/end dates, hours-per-day entitlement
- Rose and Mikael's pno (Mikael currently `000000-0000`), real addresses
- Tax scheme confirmation (A-skatt)
- Bank details for slips

**Acceptance:** Settings → Profile shows all fields non-blank; Assistants list shows valid pno for both; one clean FK 3057 + one SKV 4805 + one salary slip downloads without placeholder text visible.

### Total v1.0.1 effort estimate

| Work stream | Days |
|-------------|------|
| Schema additions + migration | 1.0 |
| Scheduling scaffolding removal | 0.5 |
| Employer representation helper + refactor of 3 existing renderers | 0.5 |
| payrollSlipUtils + PDF rendering | 1.5 |
| API endpoints + auth scoping | 0.5 |
| Settings UI (new fields) + Monthly UI + AssistantDashboard UI | 1.5 |
| Unit + integration tests | 0.5 |
| Data entry by guardian + verification walkthrough | 0.5 |
| **Total** | **~6.5 days** (1 calendar week including review) |

---

## Future Milestones (planned 2026-04-18)

### 🔜 v1.1 — Bulk Schedule Entry

**Goal:** Guardian can efficiently create multi-day / multi-assistant schedule entries in one action instead of one row at a time.

**Scope:**
- Bulk action on Home / Monthly for creating manual entries across multiple days and/or assistants in a single interaction
- Templates (e.g. "copy previous week", "apply this shift to Mon–Fri")
- Proper feedback on partial failures when bulk create hits validation errors

**Open questions for discuss phase:**
- What's the most common bulk pattern (copy week, apply weekday template, fill-remaining-days)?
- Does bulk entry trigger GCal outbound sync per entry, or a single batch sync?
- Should bulk entries bypass the schedule-violation warnings or respect them?

**Not yet planned.** No phases defined. Promote during `/gsd-new-milestone v1.1`.

---

### 🔜 v1.2 — Submission Readiness Gate

**Goal:** Before the guardian downloads FK 3057 / FK 3059 / SKV 4805, surface any data gaps that would cause the receiving authority (FK or Skatteverket) to reject the submission. Disable downloads until blockers are resolved.

**Scope:**
- Pre-flight validator for each form with 12 blockers (brukare pno, beslutsnummer, assistant pno/address, payroll approval, tax table, etc.)
- "Submission readiness" panel on Monthly and Records pages
- Server-side mirror (422 on PDF POST when blockers exist)
- Deep-link from each blocker row to the fix location

**Existing design:** [.planning/todos/pending/2026-04-18-flag-submission-blocking-violations-before-fk-and-skatteverk.md](todos/pending/2026-04-18-flag-submission-blocking-violations-before-fk-and-skatteverk.md) — full 12-blocker matrix already specified. Promote that design during `/gsd-new-milestone v1.2`.

**Depends on:** v1.0.1 schema additions (Phase 7) for 6 of 12 blockers.

---

### 🔜 v1.3 — Schedule-Violation Warnings on Monthly

**Goal:** When the guardian opens the Monthly page, show any FK-rule or labor-law violations in the approved schedule for the month being filed. Errors gate approval; warnings require explicit confirmation.

**Scope:**
- Pure-function rule engine with 10 rules: ATL §5/§8/§13/§14, FK dubbel-assistans, FK coverage gap/excess, FK decision expiry, anhörigassistans cap, employment-period check
- "Schedule health" card on Monthly (and mirror on Home per the existing Home-notification todo)
- Gate Monthly Step 1 ("Approve time entries") on error-severity resolution

**Existing design:** [.planning/todos/pending/2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md](todos/pending/2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md) — original was Home-only; scope now includes Monthly per 2026-04-18 user direction. Full rule set + implementation sketch already in that todo.

**Depends on:** v1.0.1 schema additions (FK-coverage-* and employment-period rules need new columns from Phase 7).

**Note:** Kick-off blocked by the payroll-formula triage (STATE.md PAUSED). Also note that ATL-rule subset can ship without any schema change — that can be a v1.3-lite if urgency warrants.

---

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
- Lönespecifikation template extended with Fremia rows (OB-breakdown, pension, sjuklön if applicable)
- Lönespecifikation shows per-assistant **skattetabell** number in the header once per-assistant skattetabell lookup replaces the flat 30% preliminärskatt (captured in v1.0.1 but not displayed until here)
- Age-bracket arbetsgivaravgifter (67+ = 10.21%, 19–23 = 17.77%) — closes H3 from v1.0 known issues

**Trigger:** Hiring a third assistant on a proper Fremia/Kommunal contract. Until then no point building — YAGNI.

**Depends on:** v1.0.1 (salary_model enum scaffolding from Phase 9, employment_start/end columns from Phase 7).

---

### 🔜 v1.5 — Custom Salary Model

**Goal:** Edge cases that don't fit anhörig (no benefits) or Fremia (full kollektivavtal). Examples: assistant on partial benefits, assistant paid monthly salary instead of hourly, assistant with individual agreement that mixes kollektivavtal-style benefits with custom rates.

**Scope:**
- `salary_model = "custom"` with per-assistant toggles: `ob_enabled`, `pension_enabled`, `semesterlön_enabled`, `sjuklön_enabled`
- Each enabled benefit uses the standard rate by default, per-assistant override possible
- Supports månadslön (fixed monthly amount) vs timlön (hourly) via a `compensation_basis` field
- Slip template adapts to show only the enabled rows
- Slip header shows **skattetabell** number per assistant (shared with v1.4 once per-assistant skattetabell lookup is live)

**Trigger:** Unusual hiring arrangement that neither anhörig nor Fremia handles cleanly. Realistically v2.0 territory.

**Depends on:** v1.4 (most Fremia building-blocks would be reused here).

---

### 🔜 v2.0 — Calendar & Schedule Reconciliation

**Goal:** Resolve the structural duality between Google Calendar (read by Home grid for display) and the internal `entries` table (read by FK/payroll/4805 for billing). Today these can diverge — Home can show 97h/week while the FK invoice shows 0h. v2.0 makes them one.

**Scope:**
- **Outbound sync on entry write**: `POST /api/entries` creates/updates GCal event atomically (create event → stash `gcal_event_id` on entries → rollback if GCal fails). Symmetric for `PUT` and `DELETE`.
- **Inbound import from GCal**: one-shot `POST /api/gcal/import?start=YYYY-MM-DD&end=YYYY-MM-DD` that walks GCal events with `Assistance: {Name}` / `Shift: {Name}` summaries, matches assistants by name, creates `entries` rows for each event that doesn't already have a matching `gcal_event_id`. Handles legacy + externally-created events.
- **Conflict resolution UI**: when a shift is edited in both sources between syncs, present a side-by-side and let guardian pick winner.
- **Source-of-truth metadata**: each entry carries `source_of_truth` ∈ {"app", "gcal"} so downstream code knows which side is authoritative for ambiguous cases.
- **Multi-calendar support** (stretch): guardian has multiple Google calendars, picks which ones sync and which are ignored.
- **Assistant-per-calendar routing** (stretch): different assistants' shifts live in different Google calendars.

**Depends on:** v1.0.1 (Phase 7 cleanup + scheduling-scaffolding removal means v2.0 isn't fighting dead code).

**Full design:** [todos/pending/2026-04-17-calendar-and-scheduling-user-stories-from-v1-0-learnings.md](todos/pending/2026-04-17-calendar-and-scheduling-user-stories-from-v1-0-learnings.md) — user-stories decomposition captured during v1.0.

**Trigger:** When the drift causes a concrete billing problem the guardian notices (e.g. "I scheduled 30h in GCal but FK only paid 0h because entries was empty"). Until then it's a documented design trade-off.

---

### Backlog trigger / sequencing

Current shipping order:

1. **v1.0.1** — Salary slip + absorbed foundation cleanup (**ACTIVE** — Phases 7–10)
2. **v1.1** — Bulk schedule entry (convenience)
3. **v1.2** — Submission readiness gate (prevents invalid FK/Skatteverket filings)
4. **v1.3** — Schedule-violation warnings on Monthly (surfaces labor-law + FK-rule issues)
5. **v1.4** — Fremia salary model (triggered by hiring a non-family assistant on kollektivavtal)
6. **v1.5** — Custom salary model (triggered by edge-case hiring arrangement)
7. **v2.0** — Calendar & schedule reconciliation (triggered by billing drift becoming visible)

**Payroll-formula triage resolution (H5 omkostnader pot)** — may slot in as `v1.1.5` or be absorbed into `v1.4` if advisor returns with clear direction before v1.4 hiring trigger fires. For now: documented as v1.0 Known Issue, not actively scheduled.

---

## Phase Details

### Phase 7: Foundation — Schema & Cleanup

**Goal:** All new `assistants` and `profile` columns exist and are editable in Settings; dead scheduling scaffolding (Settings card, openSlots table, self-book endpoints) is removed so the codebase is a clean foundation for salary-slip work and downstream v1.2 / v1.3 milestones.

**Depends on:** v1.0 (complete)

**Requirements:** SCHEMA-01, SCHEMA-02, SCHEMA-03, CLEAN-01, CLEAN-02, CLEAN-03

**Success Criteria** (what must be TRUE):
1. Guardian can open Settings → Assistants edit dialog and fill in skattetabell, tax_scheme, bank details (clearing/account/IBAN), split address, employment start/end, citizenship, residence permit expiry, and notes for each assistant — all fields persist to the database
2. Guardian can open Settings → Profile and fill in FK decision number/start/end/hours-per-day, dubbel_assistans flag, patient relation enum, and patient_requires_representative override — all fields persist
3. `payroll_records` generated after this phase contain `salary_model_used` and `hourly_rate_used` snapshot columns (defaults in place even though live slip shipping happens in Phase 9)
4. Settings → Scheduling card no longer appears; navigating to `/api/slots`, `/api/assistant/self-book/:id`, or `/api/assistant/open-slots` returns 404; `open_slots` table is dropped from the database
5. Fresh-DB boot (`seedDefaults()`) does not write the dead keys `allow_self_book`, `self_book_approval`, or `booking_window_days`

**Plans:** 5 plans
- [x] 07-01-PLAN.md — Schema additions (assistants + profile + payrollRecords new columns + enums) + CLEAN-03 seedDefaults cleanup + [BLOCKING] db:push
- [x] 07-02-PLAN.md — Route whitelist extensions (profile.ts PUT + assistants.ts PUT) for new columns
- [x] 07-03-PLAN.md — Dead scheduling scaffolding removal (routes + client API helpers + Settings Scheduling card) — CLEAN-01/02/03
- [x] 07-04-PLAN.md — Settings collapsible sections: Assistants edit dialog (17 fields, 2 sections) + Profile FK-beslut section (5 new fields)
- [x] 07-05-PLAN.md — SetupWizard minimal first-time-setup prompts (3 fields: fk_decision_start/end + patient_relation_to_guardian)

**UI hint**: yes

---

### Phase 8: Employer Representation Helper

**Goal:** A single `resolveEmployerRepresentation()` helper is the authoritative source for the employer-name + representation fields on every document the platform produces — closing the latent FK 3057/3059/SKV 4805 bug where `guardianName` was used as the employer, and giving the upcoming salary slip a correct, reusable input.

**Depends on:** Phase 7 (needs `profile.patient_requires_representative` column)

**Requirements:** EMP-01, EMP-02

**Success Criteria** (what must be TRUE):
1. Guardian regenerates FK 3057, FK 3059, and SKV 4805 PDFs for a historical month and the employer field shows the patient's name + pno, not the guardian's — and when the patient is a minor (or the override flag is true) the "företrädd av" line correctly displays the guardian's name + pno
2. When an adult patient has `patient_requires_representative = true`, the helper returns the guardian as företrädare; when the flag is null/false on an adult, the företrädare fields are null and only the patient appears
3. No source file under `server/src/` references `profile.guardianName` for the employer-name field — the helper is the only source of truth (grep check passes)
4. A unit test covers minor-by-pno, adult-with-override, and adult-without-override cases for the helper

**Plans:** 1 plan
- [x] 08-01-employer-representation-helper-PLAN.md — Create `resolveEmployerRepresentation()` helper + Vitest unit tests (D-13 coverage), refactor SKV 4805 `__employer__` block (form4805-utils.ts) and FK 3059 `flt_txtNamnAnordnaren[0]` (pdf.ts) to resolve to patient identity; signature/contact fields remain guardian per D-09; grep absence gate closes EMP-02

---

### Phase 9: Salary Slip (Anhörig Model)

**Goal:** Guardian and assistants can generate and download a legally-compliant monthly lönespecifikation (anhörig-model) as PDF, gated on payroll approval, audited in a `payment_slips` table, and scaffolded in the UI for Fremia/Custom salary models shipping later.

**Depends on:** Phase 7 (schema: salary_model, hourly_rate_override, payment_slips table, payroll_records snapshot columns), Phase 8 (employer representation helper used in slip header)

**Requirements:** SLIP-01, SLIP-02, SLIP-03, SLIP-04, SLIP-05, SLIP-06, SLIP-07

**Success Criteria** (what must be TRUE):
1. Guardian clicks "Ladda ner lönespecifikation" on Monthly.tsx for an approved assistant/month and receives a PDF containing arbetstid (worked hours + sjuk/VAB/semester/annan days with running VAB year-to-date balance out of 120), a lön breakdown (bruttolön → preliminärskatt 30% → netto till bank), and zero employer-side numbers (no arbetsgivaravgifter, no total kostnad)
2. Assistant (Rose or Mikael) logs in, opens their AssistantDashboard "Lönespecifikationer" section, and can list + download only their own past slips — attempting to access another assistant's slip via the `me` endpoint returns 403
3. Requesting a slip for a month where `payroll_records.status !== "approved"` returns 409 with a clear Swedish error message (same gate as SKV 4805)
4. When the patient is a minor (or the representative override is true), the slip header shows "Arbetsgivare: [patient name + pno]" followed by "Företrädd av: [guardian name + pno]"; when the patient is an adult without override, the Företrädd-av line is absent
5. Each successful slip generation writes a row to `payment_slips` with a unique document number (format `LS-YYYY-MM-NNN`), issued-at timestamp, pay method, and pay date — a replay of the same month reuses the stored document number
6. Settings → Assistants edit dialog exposes a salary-model dropdown with "Anhörigassistans" enabled, "Fremia" and "Custom" disabled with "(Kommer i v1.4/v1.5)" label, plus a per-assistant hourly_rate_override numeric field

**Plans:** 4 plans
- [x] 09-01-schema-and-whitelists-PLAN.md — Schema additions (payment_slips table + 3 assistants columns + default_pay_day) + PUT whitelist extensions + [BLOCKING] drizzle db:push
- [x] 09-02-slip-builder-and-renderer-PLAN.md — Pure buildAnhorigSlip() builder + pdfkit renderer + Vitest unit tests (SLIP-03/04/07)
- [x] 09-03-endpoints-and-allocation-PLAN.md — POST /api/pdf/lonespec (guardian) + GET /api/pdf/lonespec/me (assistant) + GET /api/assistant/slips (listing) + issueOrReuseSlip helper + integration tests (SLIP-01/02/05)
- [x] 09-04-ui-surfaces-PLAN.md — Monthly Lönespec button (SLIP-01) + AssistantDashboard Lönespecifikationer section (SLIP-02) + Settings fields (SLIP-06) + human-verify checkpoint
**UI hint**: yes

---

### Phase 10: Real Data Entry & End-to-End Verification

**Goal:** Guardian has entered real brukare, guardian, and assistant data into Settings, and a fresh download each of FK 3057, SKV 4805, and the new salary slip for a recent month shows zero placeholder strings — proving the v1.0.1 foundation + employer helper + slip pipeline work together on live data.

**Depends on:** Phase 7 (field UI), Phase 8 (helper used by FK/SKV), Phase 9 (slip download available)

**Requirements:** DATA-01, DATA-02, DATA-03

**Success Criteria** (what must be TRUE):
1. Settings → Profile shows real patient pno, name, address, FK beslutsnummer, decision start/end dates, and hours-per-day entitlement — no `TBD`, `000000-0000`, or `TBD-FK-DECISION` strings remain on screen
2. Settings → Assistants lists both Rose and Mikael with valid Swedish pno, real street/zip/city addresses, tax_scheme set to `a-skatt`, and populated bank clearing/account (or IBAN) fields
3. A fresh download of FK 3057 (for the reporting month), a fresh download of SKV 4805 per assistant, and a fresh download of the salary slip per assistant for a recent approved month each contain zero placeholder text when visually inspected — verified by the guardian during a walkthrough checkpoint

**Plans:** 3 plans (+ 1 gap-closure plan planned)
- [x] 10-01-PLAN.md — Profile data entry via PUT /api/profile — **PARTIAL (2026-04-24):** split-address fields + legacy D-02 sync populated; FK decision fields (fk_decision_no / start / end) DEFERRED to new plan 10-04 per guardian decision; DATA-01 still OPEN until 10-04 ships; Wave 1
- [ ] 10-02-PLAN.md — Assistants data entry via PUT /api/assistants/:id (Rose + Mikael: split address, tax_scheme=a-skatt, bank clearing/account or IBAN; preserves Phase 9 lock-in for Rose; DATA-02; Wave 2)
- [ ] 10-03-PLAN.md — 10-UAT.md with 3 tests (FK 3057 2026-03, Rose SKV 4805, Rose lönespec LS-2026-03-001 re-download with D-06 rebuild + freeze invariants); pdftotext grep of D-07 placeholder set; DATA-03; Wave 3. NOTE: the FK 3057 header test will flag the deferred fk_decision_no placeholder — hit routes to 10-04, not a regression.
- [ ] 10-04-PLAN.md (to be created) — Gap-closure: collect real fk_decision_no + start/end from guardian and issue second PUT; reruns 10-03 FK 3057 header grep; finishes DATA-01.

**UI hint**: yes

---

## Phase Details (v1.0) — archived

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

---

### Phase 2: Leave & Absence Foundation

**Goal:** Guardians can record when assistants are absent (sick leave, VAB, holiday) and these absences automatically reduce billable hours in FK reports.

**Depends on:** Phase 1

**Requirements:** LEAV-01, LEAV-02, LEAV-03

**Success Criteria** (what must be TRUE):
1. Guardian can record an assistant absence with type (sjukfrånvaro, VAB, semester, other), start date, and end date
2. Hours marked as absence are automatically excluded when FK 3059 and FK 3057 forms calculate total billable hours
3. Guardian can view remaining VAB balance (max 120 days/year) and sick leave accrual per assistant on a single visibility page

**Plans:** 4/4 plans complete

---

### Phase 2.5: UI Overhaul & Design System

**Goal:** Fix the broken Tailwind CSS build and rebuild the visual design to a B2B-ready, care.com-inspired professional standard suitable for both self-managing guardians and enterprise sale to care organisations (Humana, Attendo). Covers both guardian and assistant views.

**Depends on:** Phase 2

**Requirements:** No functional requirements — pure UI/UX quality phase

**Plans:** 5/5 plans complete

---

### Phase 3: Payroll Calculation & Recording

**Goal:** Guardian can view and approve monthly payroll per assistant, with correct 2026 Swedish tax rates and employer contributions, and record actual payments made.

**Depends on:** Phase 2

**Requirements:** PAY-01, PAY-02, PAY-03

**Plans:** 4/4 plans complete

---

### Phase 3.5: UX Consolidation & IA Redesign

**Goal:** Audit every existing page, consolidate features by user goal, and produce a formal UI-SPEC that defines the new information architecture — one page per purpose, no orphaned features. Includes V1 features: clock-in/out (verified presence) and multi-family support.

**Depends on:** Phase 3

**Plans:** 10/10 plans complete

---

### Phase 4: Tax Reporting (AGI)

**Goal:** Guardian can generate and download pre-filled Skatteverket blankett 4805 (Förenklad arbetsgivardeklaration) PDFs per assistant per month, with corrected payroll formula and preliminary tax rate configured in Settings.

**Depends on:** Phase 3

**Requirements:** TAX-01, TAX-02

**Plans:** 3/3 plans complete

---

### Phase 5: Scheduling & Compliance Workflow

**Goal:** Guardian has a unified view of all assistants' shifts, a monthly compliance checklist of compliance steps, and automated deadline reminders so the full compliance cycle is manageable in one tool.

**Depends on:** Phase 4

**Requirements:** SCHED-01, COMP-01, COMP-02

**Plans:** 4/4 plans complete

---

### Phase 6: Google Calendar Integration

**Goal:** Guardian can connect their real Google Calendar via OAuth2, choose which calendar to sync, and have shift entries automatically reflected as calendar events.

**Depends on:** Phase 5

**Requirements:** GCAL-01

**Plans:** 1/1 plan complete

---

### Phase 6.1: UAT Bug Fix (INSERTED)

**Goal:** Close 3 remaining UAT bugs (BUG-002 week navigator, BUG-004 invite email, BUG-005 self-registration).

**Depends on:** Phase 6

**Plans:** 1/1 plan complete

---

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Stability & Correctness | 4/4 | Complete | 2026-04-06 |
| 2. Leave & Absence Foundation | 4/4 | Complete | 2026-04-06 |
| 2.5. UI Overhaul & Design System | 5/5 | Complete | 2026-04-08 |
| 3. Payroll Calculation & Recording | 4/4 | Complete | 2026-04-10 |
| 3.5. UX Consolidation & IA Redesign | 10/10 | Complete | 2026-04-11 |
| 4. Tax Reporting (AGI) | 3/3 | Complete | 2026-04-11 |
| 5. Scheduling & Compliance Workflow | 4/4 | Complete | 2026-04-17 |
| 6. Google Calendar Integration | 1/1 | Complete | 2026-04-15 |
| 6.1. UAT Bug Fix (inserted) | 1/1 | Complete | 2026-04-15 |
| 7. Foundation — Schema & Cleanup | 0/TBD | Not started | — |
| 8. Employer Representation Helper | 0/1 | Not started | — |
| 9. Salary Slip (Anhörig Model) | 0/4 | Not started | — |
| 10. Real Data Entry & End-to-End Verification | 0/3 | Planned | — |

---

## Dependencies

```
Phase 7: Foundation — Schema & Cleanup
  ↓
Phase 8: Employer Representation Helper  (needs patient_requires_representative column)
  ↓
Phase 9: Salary Slip (Anhörig Model)     (needs salary_model, rate snapshot, payment_slips, employer helper)
  ↓
Phase 10: Real Data Entry & End-to-End Verification  (exercises the full pipeline)
```

**Critical dependency chain (v1.0.1):**
- **Phase 7 must complete before 8** — employer helper depends on `patient_requires_representative` column
- **Phases 7 + 8 must complete before 9** — salary slip needs all new schema columns and uses the employer helper in its header
- **Phase 10 is last** — it validates end-to-end by exercising FK 3057 + SKV 4805 (Phase 8 output) and the salary slip (Phase 9 output) with real data

---

## Requirement Traceability (v1.0.1)

| Requirement | Phase | Category | Status |
|-------------|-------|----------|--------|
| SLIP-01 | 9 | Salary Slip | Complete |
| SLIP-02 | 9 | Salary Slip | Complete |
| SLIP-03 | 9 | Salary Slip | Complete |
| SLIP-04 | 9 | Salary Slip | Complete |
| SLIP-05 | 9 | Salary Slip | Complete |
| SLIP-06 | 9 | Salary Slip | Complete |
| SLIP-07 | 9 | Salary Slip | Complete |
| EMP-01 | 8 | Employer Representation | Complete |
| EMP-02 | 8 | Employer Representation | Complete |
| SCHEMA-01 | 7 | Schema Additions | Complete |
| SCHEMA-02 | 7 | Schema Additions | Complete |
| SCHEMA-03 | 7 | Schema Additions | Complete |
| CLEAN-01 | 7 | Scheduling Cleanup | Complete |
| CLEAN-02 | 7 | Scheduling Cleanup | Complete |
| CLEAN-03 | 7 | Scheduling Cleanup | Complete |
| DATA-01 | 10 | Real Data | Partial (address done 2026-04-24 in 10-01; FK decision fields deferred to plan 10-04) |
| DATA-02 | 10 | Real Data | Pending |
| DATA-03 | 10 | Real Data | Pending |

**Coverage:** 18/18 v1.0.1 requirements mapped. v1.0 coverage archived at [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md).

---

*Roadmap created: 2026-04-06*
*v1.0 archived: 2026-04-18 — 15/15 requirements, 9 phases shipped*
*v1.0.1 roadmap: 2026-04-18 — 4 phases (7–10), 18 requirements*
*v1.0.1 progress: 2026-04-18 — Phase 7 complete (22/22 must-haves), 6/18 requirements closed, 3 phases remaining (8/9/10)*
