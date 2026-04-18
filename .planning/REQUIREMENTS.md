# Requirements: Kalinga Assistansportal — v1.0.1

**Defined:** 2026-04-18
**Milestone:** v1.0.1 — Salary Slip + Foundation Cleanup
**Core Value:** The guardian can complete the full monthly cycle — approve hours, generate all required forms, calculate pay — without needing an HR department or assistance company.

**Note:** v1.0 requirements (STAB, LEAV, PAY, TAX, SCHED, COMP, GCAL — 15 total) shipped 2026-04-18. Full traceability archived in [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md).

## v1.0.1 Requirements

Requirements for the v1.0.1 milestone. Each maps to exactly one roadmap phase.

### Salary Slip (SLIP)

- [ ] **SLIP-01**: Guardian can download a salary slip PDF per approved assistant per month from Monthly page (gated on payroll approval; server returns 409 otherwise)
- [ ] **SLIP-02**: Assistant can list and download their own past salary slips from AssistantDashboard (JWT-scoped to own records only)
- [ ] **SLIP-03**: Salary slip (anhörig model) shows arbetstid section (worked hours + absence days with running VAB year-to-date), lön breakdown (bruttolön → preliminärskatt 30% → netto), and excludes all employer-side numbers (no arbetsgivaravgifter, no total kostnad)
- [ ] **SLIP-04**: Salary slip header shows correct employer representation: `arbetsgivare = patient`, plus `företrädd av = guardian` only when patient is a minor
- [ ] **SLIP-05**: Each issued slip is recorded in a `payment_slips` audit table with document number, issued-at timestamp, pay method, and pay date
- [ ] **SLIP-06**: Settings → Assistants exposes `salary_model` dropdown with "Anhörigassistans" (wired), "Fremia" and "Custom" (scaffolding only, disabled with "(Kommer i v1.4/v1.5)"), plus a per-assistant `hourly_rate_override` field
- [ ] **SLIP-07**: `payroll_records` captures `salary_model_used` + `hourly_rate_used` snapshots at generation time so historical slips reproduce identical numbers

### Employer Representation (EMP)

- [ ] **EMP-01**: `resolveEmployerRepresentation()` helper returns correct `{arbetsgivareName, arbetsgivarePno, företrädareName, företrädarePno, isMinor}` based on minor-status derived from patient pno + `patient_requires_representative` override
- [ ] **EMP-02**: FK 3057, FK 3059, SKV 4805, and salary slip renderers all use the helper — zero direct `profile.guardianName` references for the employer field

### Schema Additions (SCHEMA)

- [ ] **SCHEMA-01**: `assistants` table gains: skattetabell (int), tax_scheme enum (`a-skatt` | `f-skatt`), bank_clearing/bank_account/iban (text), split address (address_street/address_zip/address_city), employment_start_date/employment_end_date (date), citizenship (text), residence_permit_expiry (date), notes (text)
- [ ] **SCHEMA-02**: `profile` table gains: patient_requires_representative (bool), patient_relation_to_guardian enum (`parent-child` | `spouse` | `adult-child` | `legal-guardian` | `god_man` | `other`), fk_decision_start/fk_decision_end (date), fk_decision_hours_per_day (int), dubbel_assistans_approved (bool), split household vs patient vs guardian addresses
- [ ] **SCHEMA-03**: Settings → Profile + Settings → Assistants expose all new fields for editing with Swedish labels and appropriate input types

### Scheduling Cleanup (CLEAN)

- [ ] **CLEAN-01**: Settings "Scheduling" card removed (self-book toggle, approval mode, booking window sections deleted from `Settings.tsx` including `sched` state and `saveSched` mutation)
- [ ] **CLEAN-02**: `openSlots` table dropped via migration; `/api/slots` (GET/POST/DELETE), `/api/assistant/self-book/:slotId`, and `/api/assistant/open-slots` endpoints removed
- [ ] **CLEAN-03**: Client API helpers `slotsApi`, `assistantApi.selfBook`, `assistantApi.openSlots` removed; dead settings keys (`allow_self_book`, `self_book_approval`, `booking_window_days`) removed from `seedDefaults()`

### Real Data (DATA)

- [ ] **DATA-01**: Guardian enters real patient pno/name/address, FK beslutsnummer, decision start/end, and hours-per-day entitlement in Settings → Profile (zero `TBD` or `000000-0000` placeholders remain)
- [ ] **DATA-02**: Both assistants (Rose + Mikael) have valid pno, real addresses, A-skatt scheme set, and bank details in Settings → Assistants
- [ ] **DATA-03**: One clean download each of FK 3057, SKV 4805, and salary slip for a recent month contains zero placeholder text (visual/QA check)

## Future Requirements

Deferred to future milestones. Tracked but not in v1.0.1 roadmap.

### Fremia Salary Model (FREMIA — v1.4)

- **FREMIA-01**: OB-tillägg table (evening 20%, night 40%, weekend 60%) wired for `salary_model = "fremia"` assistants
- **FREMIA-02**: Helgersättning via Swedish public-holiday red-day calendar
- **FREMIA-03**: Semesterlön accrual 12% of gross — new `semesterlön_reserves` table
- **FREMIA-04**: Tjänstepension 4.5% tracking + payment ledger
- **FREMIA-05**: Sjuklön rules (karensdag + days 2–14 at 80% employer liability)
- **FREMIA-06**: Age-bracket arbetsgivaravgifter (67+ = 10.21%, 19–23 = 17.77%) — closes v1.0 Known Issue H3

### Custom Salary Model (CUSTOM — v1.5)

- **CUSTOM-01**: Per-assistant benefit toggles (`ob_enabled`, `pension_enabled`, `semesterlön_enabled`, `sjuklön_enabled`) for edge-case contracts
- **CUSTOM-02**: Compensation basis switch (månadslön vs timlön) with slip template adaptation

### Submission Readiness Gate (SUBMIT — v1.2)

- **SUBMIT-01**: Pre-flight validator for FK/SKV forms with 12-blocker matrix; downloads disabled until resolved
- **SUBMIT-02**: Submission readiness panel on Monthly + Records
- **SUBMIT-03**: Server-side 422 mirror on PDF POST when blockers exist

### Schedule Violations (RULE — v1.3)

- **RULE-01..10**: 10-rule ATL/FK engine (§5/§8/§13/§14, dubbel-assistans, coverage gap/excess, decision expiry, anhörigassistans cap, employment-period)
- **RULE-11**: Schedule-health card on Monthly + Home
- **RULE-12**: Gate Monthly Step 1 on error-severity resolution

### Calendar Reconciliation (RECON — v2.0)

- **RECON-01**: Bidirectional GCal ↔ entries sync on write
- **RECON-02**: One-shot GCal import with `gcal_event_id` matching
- **RECON-03**: Conflict-resolution UI + source-of-truth metadata

## Out of Scope (v1.0.1 only — may be revisited)

Explicitly excluded from v1.0.1. Prevents scope creep during implementation.

| Feature | Reason |
|---------|--------|
| Fremia / Custom salary model LIVE logic | Scaffolding only ships in v1.0.1; live behavior deferred to v1.4 / v1.5 (trigger = hiring non-family assistant) |
| OB-tillägg, helgersättning on slip | Fremia-model concern; anhörig assistants have fixed rate with no premiums |
| Tjänstepension, AFA-försäkringar, semesterlön reserve | Fremia-model concern |
| Sjuklön calculation on slip | Anhörig model has no employer-paid sick leave (mutual agreement); "0 kr *" line only |
| Per-assistant skattetabell lookup (jämkning, engångsbelopp) | H3 v1.0 Known Issue; flat 30% stays until v1.4; Skatteverket accepts as fallback |
| Omkostnader pot (H5) redesign | Requires advisor input + formula redesign + migration; deferred to dedicated "payroll formula redesign" milestone |
| Arbetsgivaravgifter + total kostnad on slip | Guardian direction 2026-04-18: employer-side figures don't belong on assistant's document |
| YTD cumulative totals on slip | Deferred — can be added without breaking changes later |
| GCal ↔ entries bidirectional reconciliation | v2.0 milestone (structural duality) |

## Traceability

Empty initially — populated by gsd-roadmapper during phase decomposition. Each requirement maps to exactly one phase.

| Requirement | Phase | Status |
|-------------|-------|--------|
| SLIP-01 | TBD | Pending |
| SLIP-02 | TBD | Pending |
| SLIP-03 | TBD | Pending |
| SLIP-04 | TBD | Pending |
| SLIP-05 | TBD | Pending |
| SLIP-06 | TBD | Pending |
| SLIP-07 | TBD | Pending |
| EMP-01 | TBD | Pending |
| EMP-02 | TBD | Pending |
| SCHEMA-01 | TBD | Pending |
| SCHEMA-02 | TBD | Pending |
| SCHEMA-03 | TBD | Pending |
| CLEAN-01 | TBD | Pending |
| CLEAN-02 | TBD | Pending |
| CLEAN-03 | TBD | Pending |
| DATA-01 | TBD | Pending |
| DATA-02 | TBD | Pending |
| DATA-03 | TBD | Pending |

**Coverage:**
- v1.0.1 requirements: 18 total
- Mapped to phases: 0 (awaiting roadmap)
- Unmapped: 18 ⚠️ (will resolve after roadmap)

---
*Requirements defined: 2026-04-18 for v1.0.1*
*v1.0 requirements archived at: [milestones/v1.0-REQUIREMENTS.md](milestones/v1.0-REQUIREMENTS.md)*
