---
created: 2026-04-18T23:00:00Z
updated: 2026-04-19T00:00:00Z
title: Salary slip (lönespecifikation) for assistants
area: ui
priority: legally-required
planned_milestone: v1.0.1 or v1.1 (sequenced before v1.3)
scope_confirmed_by_guardian: 2026-04-18
scope_notes: |
  - Anhörigassistans model ONLY (Rose + Mikael both patient's parents, fixed
    hourly rate 254.10, no paid sick / VAB / vacation by mutual agreement)
  - NO employer-side info on slip (no arbetsgivaravgifter, no total kostnad)
    — the slip is for the assistant, not for employer accounting
  - Fremia and Custom salary models added to roadmap as FUTURE work
    (post-v1) — scaffolding only in v1.1, live logic when needed later
  - Absence section visible (sick/VAB/vacation/other days) even though 0 SEK
    is paid, because it's the assistant's record of attendance
  - Footnote explicitly states "no compensation under anhörig agreement" so
    the zero pay is not ambiguous
files:
  - server/src/routes/pdf.ts
  - server/src/lib/payrollSlipUtils.ts          # NEW — proposed
  - client/src/pages/Monthly.tsx
  - client/src/pages/AssistantDashboard.tsx
  - server/src/db/schema.ts
  - .planning/v1.0-MILESTONE-AUDIT.md
---

> **Scope refined (2026-04-18)**: Guardian confirmed anhörig-only model for v1.1; employer-side numbers (arbetsgivaravgifter, total kostnad) removed from slip because they belong on the employer's bookkeeping side, not on the assistant's document. Fremia + Custom salary models moved to the future-milestones roadmap as post-v1 work. The slip mock in section 6 below reflects the corrected scope.


## Problem

v1.0 ships no way to produce a **lönespecifikation** (salary slip / pay statement) for assistants. The guardian has no document to hand to Rose or Mikael each month showing gross pay, preliminärskatt withheld, and net deposit. Assistants have no way to see their own pay record from within the platform.

**This is a legal obligation, not a feature.** Swedish labor law requires the employer to issue a written pay record to each employee each pay period that shows:
- Employer and employee identification
- Pay period
- Hours worked
- Gross pay components
- Deductions (preliminärskatt, possibly pension contribution, union fees if applicable)
- Net pay
- Employer contributions (informational, for transparency)
- Payment date

Absence is not "a feature gap" — it's a **statutory non-compliance** for any ongoing employment relationship. Fremia/Kommunal kollektivavtal for personlig assistans reinforces this obligation.

**Discovery trigger:** Guardian flagged 2026-04-18 during v1.0 payroll walkthrough: *"what I'm missing is a salary slip that i can give to assistants"*.

## Solution

### What to produce

Per assistant, per month, a **lönespecifikation PDF** with these sections:

**Header block**
- Employer (arbetsgivare): brukare name + personnummer + address (legal employer is the brukare for personal assistance)
- **If the brukare is a minor** (derived from birth year in personnummer — under 18 at the date of issue, or from an explicit `profile.patient_is_minor` flag): additionally show a "Företrädd av" (legal representative) line with the guardian's name + personnummer. The minor cannot legally act as their own employer under Swedish law; the vårdnadshavare / förmyndare signs and administers on their behalf. Required for a valid pay record when the brukare is a minor.
- Employee: assistant name + personnummer + address
- Period: "Mars 2026" (or `YYYY-MM` label)
- Document type: "Lönespecifikation"
- Payment date (configurable; default = deadline + 3 days or similar)
- Document number (incrementing sequence per employer, for audit/bokföringslag)

**Example header when brukare is a minor:**
```
Arbetsgivare:    [Patient name], [Patient pno]
Företrädd av:    [Guardian name], [Guardian pno]    ← only shown if minor
Anställd:        Rose Karon, 8011155069
```

**Example header when brukare is an adult:**
```
Arbetsgivare:    [Patient name], [Patient pno]
Anställd:        Rose Karon, 8011155069
```

**Minor detection logic:**
```
function isMinor(pno: string, asOfDate: Date): boolean {
  const birthYear = birthYearFromPno(pno);  // already implemented in form4805-utils
  const ageAtDate = asOfDate.getFullYear() - birthYear
                  - (birthdayNotYetReached(pno, asOfDate) ? 1 : 0);
  return ageAtDate < 18;
}
```
Also applies retroactively to historical slips: if a minor turned 18 during a pay period, use the status as of the slip's period end.

**Earnings section**
- Hours worked (from approved `entries` for the period, billable only per `filterBillableEntries`)
- Hourly rate (from `payroll_records.hourlyRateSnapshot`)
- Gross pay (from `payroll_records.grossPay`)
- Sub-breakdown if relevant:
  - Ordinary hours × rate
  - OB-tillägg (evening/night/weekend supplement) if configured
  - Helgersättning (holiday pay) if applicable
  - Semesterlön reserve (12% standard) — informational, paid out separately
- **For v1 implementation**, single-row "Hours × rate = gross" is acceptable; OB-tillägg and semesterlön reserve deferred to later milestone

**Deductions section**
- Preliminärskatt withheld (from `grossPay × prelimTaxRateSnapshot`)
- Net pay = gross − preliminärskatt
- Note: "preliminärskatt is withheld at flat rate X% per employer's schablon" (reinforces the known v1 limitation that this isn't per-assistant skattetabell)

**Employer obligations (informational)**
- Arbetsgivaravgifter (employer contributions, paid separately to Skatteverket, shown for transparency) — from `payroll_records.employerContributions`
- Pension contribution (if modelled in costs — future)

**Period summary**
- Year-to-date cumulative gross, net, withheld tax — optional but useful

**Footer**
- "Denna lönespecifikation är en sammanställning av lön och skatt för ovan angiven period. Frågor besvaras av arbetsgivaren."
- Payment reference (e.g. "Konto: {last-4}" if bank details stored)

### Where it's triggered from

**Guardian side:**
- Monthly page, payroll card → per-assistant "Download lönespecifikation" button (alongside the existing 4805 download)
- Records page, Payroll tab → historical lönespecifikation re-downloads

**Assistant side:**
- AssistantDashboard → "Pay slips" section → list of monthly slips → click to download own
- Requires read-side API endpoint scoped to `requireAssistantAccess` that reads only that assistant's own records

### Architecture sketch

**New server module**: `server/src/lib/payrollSlipUtils.ts`
- Pure function `buildLonespecifikationFields(input)` → structured field map
- Inputs: `profile` (employer), `assistant`, `payrollRecord`, `entries` (for hours breakdown), optional `previousSlips` for YTD totals
- Output: ordered key-value map for PDF rendering

**New server route**: `POST /api/pdf/lonespec`
- Body: `{ assistantId, month }`
- Guardian-only (uses `requireGuardian`) — as the employer, this is their document to issue
- Plus: `GET /api/pdf/lonespec/me?month=YYYY-MM` for assistants to download their own (uses `requireAssistantAccess`, scopes to JWT's `assistantId`)
- Reads payroll record (must be `approved` → 409 if not), composes fields via `payrollSlipUtils`, renders PDF

**PDF rendering**:
- pdfkit (already used for FK forms)? Or pdf-lib on a blank template?
- Probably simpler to generate programmatically than fill a pre-existing Skatteverket-style template — no official "lönespecifikation" template exists in the way SKV 4805 does.
- Layout: A4, single page, section headings per the Earnings / Deductions / Employer Obligations blocks above.

**Schema additions**:
- Optional: `payment_slips` table to persist slip metadata (id, assistantId, month, document_number, generated_at, pdf_snapshot_path). Allows reproducibility and audit.
- Or: compute on demand each time, no storage. Simpler. Bokföringslag requires the pay record to be retrievable for 7 years, but "retrievable by regenerating from the snapshotted payroll_records" probably satisfies that.

**Document numbering**:
- Per-employer sequential (e.g. "LS-2026-03-001" for Rose March, "LS-2026-03-002" for Mikael March). Required for bokföringslag traceability if audited. Simple counter on `payment_slips` or derived from payroll_records.id.

### What's ready to reuse

- `payroll_records` already stores all the money numbers (gross, prelim tax rate snapshot, employer contributions, total cost, hourly rate snapshot)
- `filterBillableEntries` already produces per-day hours breakdown
- `pdfApi` already has a working PDF generation pattern (FK 3057, 4805)
- `profile` + `assistants` tables have the identification fields (with placeholder values for now — see the missing-fields todo)

### What blocks a clean implementation

1. **Placeholder profile data** — same blocker as FK/4805. Brukare pno, guardian name, assistant address all need real values. Same fix as the capture-missing-fields todo.
2. **Preliminärskatt accuracy** — slip will show tax at the flat rate (documented as v1 known issue). For accuracy, v2+ needs per-assistant skattetabell (see v1.0-MILESTONE-AUDIT.md "Accepted as v1.0 Known Issues").
3. **Semesterlön treatment** — not modelled. Slip should ideally show semesterlön reserve (12%) but that requires the cost-ledger work (H2 from the payroll hypotheses).
4. **Payment date** — not tracked on `payroll_records`. Currently `payments` table captures when guardian logged paying the assistant. For the slip, we need the **intended** payment date (e.g. "will be paid on 2026-04-25"), which may or may not match what's logged after the fact.

### Implementation scope options

**v1.0.1 patch (minimal)** — ship just enough to satisfy legal requirement:
- Basic lönespecifikation PDF with header + hours × rate + gross + prelim tax + net
- Guardian-only download from Monthly
- No storage, no document numbering, no semesterlön, no OB-tillägg
- Uses current payroll_records data
- Arbetsgivaravgifter shown informationally
- Labels clearly that preliminärskatt is schablon (see v1.0 known issues)
- Estimated effort: ~1-2 days

**v1.x milestone (proper)**:
- All of the above, plus:
- Assistant-side self-download from dashboard
- `payment_slips` table with document numbering
- YTD cumulative columns
- Payment date field captured at generation
- Editable notes field (e.g. "Tack för god insats i mars" or ad hoc adjustments)
- Scoped PDF tests (pdf-parse based, similar to 4805 tests)

## Priority

**Legally required → block v1.0 archive or ship as v1.0.1 patch immediately after archive.**

Even if the guardian currently hand-writes or verbally reports pay, the ongoing employment relationship with two assistants paying ~430h/month means written records are an active obligation as long as assistants are employed. The risk scales with time, not with scale.

Recommendation: ship as a v1.0.1 hotfix (minimal scope) between v1.0 archive and v1.3 kickoff. Expand to full scope in a follow-up milestone.

## Acceptance criteria (v1.0.1 minimal scope)

- Guardian can click "Lönespecifikation" on any approved payroll record and download a valid PDF
- PDF contains: employer + employee ID, period, hours, hourly rate, gross, prelim tax (kr + %), net, arbetsgivaravgifter (informational), total employer cost (informational)
- PDF is in Swedish
- Endpoint returns 409 if payroll_record status is not "approved"
- Unit tests on `payrollSlipUtils` cover: correct numbers, correct Swedish labels, handling of missing optional fields (addresses), rounding consistent with 4805
- Labelled clearly that preliminärskatt is computed at a flat schablon rate (transparency per accepted v1 known issue)

## Related

- Concept source: Guardian 2026-04-18 during payroll walkthrough — "what I'm missing is a salary slip that i can give to assistants"
- Related to payroll accounting: [.planning/todos/pending/2026-04-18-verify-and-fix-payroll-calculation-deduct-employer-tax-and-c.md](2026-04-18-verify-and-fix-payroll-calculation-deduct-employer-tax-and-c.md) — omkostnader / cost-ledger / skattetabell concerns
- Depends on data-entry: [.planning/todos/pending/2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md](2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md) — same brukare pno, assistant address gaps
- Known issue context: [.planning/v1.0-MILESTONE-AUDIT.md](../../v1.0-MILESTONE-AUDIT.md) — Accepted as v1.0 Known Issues section
