# Kalinga Assistansportal — Roadmap

**Project:** Swedish personal assistance (assistansersättning) self-management platform with compliance and payroll integration
**Current milestone:** v1.0 (shipped code, awaiting clean-finish archive) → v1.0.1 kick-off queued
**Last updated:** 2026-04-18 23:59

---

## ▶ HANDOFF — read this first if you're resuming cold

If you're a new session / new LLM and have never seen this project before, **read this section, then PROJECT.md, then the detailed milestone sections below. Skip nothing.**

### Where the project stands (as of 2026-04-18)

- **v1.0 is code-complete.** 9 phases shipped, 36 plans summarised, 15/15 requirements satisfied in code. Branch `milestone/v1.0-mvp` on `origin`, tip commit see git log.
- **v1.0 is NOT archived yet.** `/gsd-complete-milestone v1.0` was not run. Milestone archive is the next housekeeping step before v1.0.1.
- **The user has requested that v1.0.1 be opened as a new project** (meaning: cleanly separated from v1.0's noise). How "new project" is interpreted is a decision for the NEXT session — either a fresh GSD init, a new workspace, or a new milestone in this project. Ask the user.
- **The app itself works end-to-end** — guardian can run the full monthly compliance cycle (schedule, approve, payroll, FK 3057, FK 3059, SKV 4805) in the current UI. Known bugs are either fixed (see Known Fixes) or deferred as Accepted Known Issues (see v1.0 Retrospective).

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

1. **If user says "continue v1.0 cleanup":** run through the v1.0 Retrospective section, finish the scheduling cleanup code change, close the pending superseded todos, then `/gsd-complete-milestone v1.0`.
2. **If user says "start v1.0.1":** read the v1.0.1 section in full, plus the linked todos. If the user wants a new GSD project run `/gsd-new-project` fresh and bring forward just the v1.0.1 spec. If they want a new milestone in this project run `/gsd-new-milestone v1.0.1`.
3. **If user asks a specific question about any decision:** the session decisions list above has the reasoning. Cross-references point to the audit, compliance brief, or todo files with full context.

### Artifacts that together tell the full story

| Document | Why it matters |
|----------|---------------|
| [PROJECT.md](PROJECT.md) | Stable product context: what the app is, who it's for |
| [STATE.md](STATE.md) | Current session state + paused/resumed protocol |
| [v1.0-MILESTONE-AUDIT.md](v1.0-MILESTONE-AUDIT.md) | v1.0 audit with all known issues, fixes applied, accepted debt |
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

Full detail in [v1.0-MILESTONE-AUDIT.md](v1.0-MILESTONE-AUDIT.md) "Accepted as v1.0 Known Issues" section.

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

## Phases (v1.0)

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

## Future Milestones (planned 2026-04-18)

### 🔜 v1.0.1 — Salary Slip + Foundation Cleanup — **URGENT / legally required**

**Why this is urgent:** Swedish labor-law (and any applicable kollektivavtal) requires the employer to issue a written pay record to each employee each pay period. Currently **zero provision** — Rose and Mikael receive a bank transfer reference only. This is statutory non-compliance for an ongoing employment relationship. Must ship before anything else.

**Why it's a foundation:** While the core deliverable is the salary slip, four related items were absorbed to avoid rework and schema drift:
1. Schema columns needed by v1.2 + v1.3 (submission gate, schedule warnings)
2. Employer-representation helper shared by FK/4805/slip renderers
3. Scheduling scaffolding removal (dead code from pre-IA-redesign era)
4. Real brukare/guardian data entered (unblocks all downstream filings)

#### Scope — Salary Slip (anhörig model only)

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
- ❌ Arbetsgivaravgifter line — employer-side, not the assistant's concern
- ❌ Total kostnad line — same reason
- ❌ YTD cumulative (can be added later)
- ❌ OB-tillägg, helgersättning, jour/beredskap — Fremia model (v1.4)
- ❌ Tjänstepension, AFA-försäkringar, semesterlön reserve — Fremia model (v1.4)

#### Scope — Employer Representation Helper (absorbed from minor-vs-adult todo)

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

#### Scope — Capture-Missing-Fields schema (absorbed)

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

#### Scope — Scheduling scaffolding removal

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

#### Scope — Real brukare / guardian / assistant data entered

Currently placeholder values (`TBD Guardian Name`, `patientPno: 000000-0000`, `fkDecisionNo: TBD-FK-DECISION`, etc). Without real values the FK/4805/salary slip PDFs all contain invalid data.

Not a code change — a guardian data-entry pass in Settings once the new fields from the capture-missing-fields absorption ship. Guardian enters:
- Real patient pno, name, address
- Real guardian pno, name
- FK beslutsnummer, beslut start/end dates, hours-per-day entitlement
- Rose and Mikael's pno (Mikael currently `000000-0000`), real addresses
- Tax scheme confirmation (A-skatt)
- Bank details for slips

**Acceptance:** Settings → Profile shows all fields non-blank; Assistants list shows valid pno for both; one clean FK 3057 + one SKV 4805 + one salary slip downloads without placeholder text visible.

#### Total v1.0.1 effort estimate

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

#### Success criteria

1. Rose downloads her March 2026 slip from AssistantDashboard and it shows valid personal data, correct numbers, absence section, no placeholder text.
2. Guardian downloads Mikael's March 2026 slip from Monthly and it shows "Företrädd av [guardian name]" if patient is a minor.
3. Existing FK 3057 + SKV 4805 regeneration produces identical numbers but correct employer names (via the new helper).
4. Settings → Scheduling card is gone. No broken links anywhere. `allow_self_book` settings key absent from Settings UI.
5. All schema columns from the capture-missing-fields todo exist in the database and are editable in Settings.
6. Tests pass: `server/` typecheck clean, `client/` typecheck clean, `vitest run` passes (including new unit tests on payrollSlipUtils).
7. v1.0 audit "Deferred Items" list loses the scheduling-cleanup + minor-vs-adult items.

---

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

**Depends on:** v1.1 schema additions ([2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md](todos/pending/2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md)) for 6 of 12 blockers.

---

### 🔜 v1.3 — Schedule-Violation Warnings on Monthly

**Goal:** When the guardian opens the Monthly page, show any FK-rule or labor-law violations in the approved schedule for the month being filed. Errors gate approval; warnings require explicit confirmation.

**Scope:**
- Pure-function rule engine with 10 rules: ATL §5/§8/§13/§14, FK dubbel-assistans, FK coverage gap/excess, FK decision expiry, anhörigassistans cap, employment-period check
- "Schedule health" card on Monthly (and mirror on Home per the existing Home-notification todo)
- Gate Monthly Step 1 ("Approve time entries") on error-severity resolution

**Existing design:** [.planning/todos/pending/2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md](todos/pending/2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md) — original was Home-only; scope now includes Monthly per 2026-04-18 user direction. Full rule set + implementation sketch already in that todo.

**Depends on:** v1.1 schema additions (FK-coverage-* and employment-period rules need new columns).

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
- Age-bracket arbetsgivaravgifter (67+ = 10.21%, 19–23 = 17.77%) — closes H3 from v1.0 known issues

**Trigger:** Hiring a third assistant on a proper Fremia/Kommunal contract. Until then no point building — YAGNI.

**Depends on:** v1.0.1 (salary_model enum scaffolding), v1.1 schema additions (employment_start/end already present).

---

### 🔜 v1.5 — Custom Salary Model

**Goal:** Edge cases that don't fit anhörig (no benefits) or Fremia (full kollektivavtal). Examples: assistant on partial benefits, assistant paid monthly salary instead of hourly, assistant with individual agreement that mixes kollektivavtal-style benefits with custom rates.

**Scope:**
- `salary_model = "custom"` with per-assistant toggles: `ob_enabled`, `pension_enabled`, `semesterlön_enabled`, `sjuklön_enabled`
- Each enabled benefit uses the standard rate by default, per-assistant override possible
- Supports månadslön (fixed monthly amount) vs timlön (hourly) via a `compensation_basis` field
- Slip template adapts to show only the enabled rows

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

**Depends on:** v1.0.1 (schema cleanup + scheduling-scaffolding removal means v2.0 isn't fighting dead code).

**Full design:** [todos/pending/2026-04-17-calendar-and-scheduling-user-stories-from-v1-0-learnings.md](todos/pending/2026-04-17-calendar-and-scheduling-user-stories-from-v1-0-learnings.md) — user-stories decomposition captured during v1.0.

**Trigger:** When the drift causes a concrete billing problem the guardian notices (e.g. "I scheduled 30h in GCal but FK only paid 0h because entries was empty"). Until then it's a documented design trade-off.

---

### Backlog trigger / sequencing

After v1.0 archives, ship in this order:

1. **v1.0.1** — Salary slip + absorbed foundation cleanup (legal obligation; ~6.5 days) → `/gsd-new-milestone v1.0.1`
2. **v1.1** — Bulk schedule entry (convenience)
3. **v1.2** — Submission readiness gate (prevents invalid FK/Skatteverket filings)
4. **v1.3** — Schedule-violation warnings on Monthly (surfaces labor-law + FK-rule issues)
5. **v1.4** — Fremia salary model (triggered by hiring a non-family assistant on kollektivavtal)
6. **v1.5** — Custom salary model (triggered by edge-case hiring arrangement)
7. **v2.0** — Calendar & schedule reconciliation (triggered by billing drift becoming visible)

**Payroll-formula triage resolution (H5 omkostnader pot)** — may slot in as `v1.1.5` or be absorbed into `v1.4` if advisor returns with clear direction before v1.4 hiring trigger fires. For now: documented as v1.0 Known Issue, not actively scheduled.

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
- [x] 05-01-PLAN.md — Wave 0: Test stubs for deadlineUtils and reminderCron (COMP-01, COMP-02)
- [x] 05-02-PLAN.md — Wave 1: Home.tsx assistant-row schedule table + week navigation (SCHED-01)
- [x] 05-03-PLAN.md — Wave 1: deadlineUtils implementation + Monthly.tsx deadline badges (COMP-01)
- [x] 05-04-PLAN.md — Wave 2: reminderCron implementation + email.ts + Settings.tsx Notifications card + human checkpoint (COMP-02)

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
| 3.5. UX Consolidation & IA Redesign | 10/10 | Complete | 2026-04-11 |
| 4. Tax Reporting (AGI) | 3/3 | Complete   | 2026-04-11 |
| 5. Scheduling & Compliance Workflow | 4/4 | Complete | 2026-04-17 |
| 6. Google Calendar Integration | 1/1 | Complete | 2026-04-15 |
| 6.1. UAT Bug Fix (inserted) | 1/1 | Complete | 2026-04-15 |

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

### Phase 06.1: UAT Bug Fix (INSERTED)

**Goal:** [Urgent work - to be planned]
**Requirements**: TBD
**Depends on:** Phase 6
**Plans:** 1/1 plans complete

Plans:
- [x] TBD (run /gsd-plan-phase 06.1 to break down) (completed 2026-04-15)
