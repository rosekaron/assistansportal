---
created: 2026-04-18T00:00:00Z
title: Capture missing assistant and profile fields for FK and Skatteverket compliance
area: database
planned_milestone: v1.0.1 (absorbed)
files:
  - server/src/db/schema.ts:20       # profile table
  - server/src/db/schema.ts:69       # assistants table
  - client/src/pages/Settings.tsx
  - .planning/compliance/2026-03-advisor-brief.md
  - server/src/lib/form4805-utils.ts
---

> **Absorbed into v1.0.1 (2026-04-18)** — All schema additions (Section B of this todo) ship as part of the v1.0.1 salary-slip milestone because v1.0.1 is already touching `assistants` + `profile` for the salary-model/rate-override work. Doing it once avoids schema drift across v1.0.1 / v1.2 / v1.3. Data-entry (Section A) is also part of v1.0.1's acceptance criteria. See ROADMAP.md v1.0.1 "Scope — Capture-Missing-Fields schema (absorbed)" section for the full column list.


## Problem

During March 2026 retroactive filing prep, the 4805 + FK 3057 generation was blocked by missing or placeholder data across two tables and settings. Separating the gaps into **(A) existing fields holding placeholders** and **(B) fields not yet modelled** so each can be addressed:

### A. Fields that exist in schema but currently hold placeholder values

| Field | DB location | Current value | Required for |
|-------|-------------|---------------|--------------|
| Rose `address` | `assistants.address` | `"TBD"` | SKV 4805 |
| Mikael `pno` | `assistants.pno` | `"000000-0000"` | SKV 4805 |
| Mikael `address` | `assistants.address` | `"TBD"` | SKV 4805 |
| Guardian name | `profile.guardianName` | `"TBD Guardian Name"` | FK 3057 |
| Guardian `pno` | `profile.guardianPno` | `""` (never set) | FK 3057, SKV 4805 (employer identifier) |
| Guardian email | `profile.guardianEmail` | probably empty | Invoice correspondence |
| Guardian phone | `profile.guardianPhone` | probably empty | FK contact |
| Patient name | `profile.patientName` | `"TBD Patient Name"` | FK 3057, 3059 |
| Patient `pno` | `profile.patientPno` | `"000000-0000"` | FK 3057, 3059, 4805 (brukare = legal employer) |
| Patient address / city / zip | `profile.address/city/zip` | probably empty | FK 3057, 4805 |
| FK beslutsnummer | `profile.fkDecisionNo` | `"TBD-FK-DECISION"` | FK 3057, 3059 |

**Fix**: Settings UI already has most of these fields. Guardian walks through Settings → Profile and enters real values. No schema change needed. Blockers are purely data entry.

### B. Fields NOT yet modelled — need new schema columns

These will be required for a full legal + operational flow but don't exist in the current DB:

| Missing field | Proposed location | Why |
|---------------|-------------------|-----|
| **Per-assistant skattetabell** | `assistants.skattetabell` (int) | Currently one global `settings.preliminary_tax_rate` = flat 30% applied to everyone. Skatteverket expects each individual's A-skatt table column, which varies by municipality + birth year. 4805 should snapshot this per assistant at generation. |
| **Per-assistant A-skatt/F-skatt status** | `assistants.taxScheme` (enum: "a-skatt" \| "f-skatt") | F-skatt self-employed assistants have different employer-obligation rules (no arbetsgivaravgifter if F-skatt, only 4805-equivalent ownership declaration). |
| **Assistant bank / clearing / IBAN** | `assistants.bankClearing`, `assistants.bankAccount`, `assistants.iban` | Payment tracking (PAY-03) has `method` string but no structured destination. Today guardians pay manually; a future "log payment" UI would benefit from having the target account on file. |
| **Employment start / end dates** | `assistants.employmentStart`, `assistants.employmentEnd` | 4805 requires employment period. Also used to gate FK billing — can't bill hours before start or after end. |
| **Assistant citizenship / residence permit** | `assistants.citizenship`, `assistants.residencePermitExpiry` | Arbetsgivare must verify work authorisation under utlänningslagen. Required audit trail. |
| **Assistant city + zip** | split `address` into `addressStreet`, `addressCity`, `addressZip` | `assistants.address` is currently a single text field. SKV 4805 has separate fields. Required for proper form filling. |
| **Profile: guardian home address vs patient address** | `profile.guardianAddress*` separate from `profile.address*` | If guardian ≠ patient household, FK and 4805 may need both. Current schema has one shared address that's implicitly "the household". |
| **Profile: legal relationship guardian ↔ patient** | `profile.guardianRelation` (enum: "parent", "spouse", "adult-child", "legal-guardian", ...) | Triggers anhörigassistans rules and affects FK beslut interpretation. |
| **Profile: FK beslut period** | `profile.fkDecisionStart`, `profile.fkDecisionEnd` | Beslut expires; bills submitted outside the period are rejected. |
| **Profile: FK beslut entitlement (hours/day)** | `profile.fkDecisionHoursPerDay` | Enables the system to flag schedule that exceeds or is short of beslut. Currently we have no way to compare. |
| **Profile: dubbel-assistans approved?** | `profile.dubbelAssistansApproved` (boolean) | Answers the "can two assistants be billed simultaneously?" question that the March advisor brief flagged. |
| **Assistant notes / flagged items** | `assistants.notes` (text) | Free-text field for "Mikael is on paternity leave Apr", "Rose works 60% per kollektivavtal" etc. |

### Also: data completeness UI

Currently nothing prompts the guardian to fill in these fields until they try to generate a PDF and it silently produces blanks. The form 4805 PDF would still generate — it just won't be valid. This is a silent-failure UX issue.

**Fix**: add a "Settings completeness" card on Monthly step 1 showing what's missing and blocking each downstream artefact.

## Solution

Split into three work streams:

1. **Data-entry-only (no schema change)** — guardian fills existing fields via Settings. Can happen today. Unblocks the March 2026 filing (combined with advisor sign-off from the companion compliance todo).

2. **Schema additions (v1.x)** — new columns on `assistants` + `profile` from section B. Requires:
   - Drizzle migration
   - Settings UI forms for each new field
   - 4805 + FK 3057 generation updated to consume the new fields
   - Per-assistant skattetabell snapshotting on payroll generate
   - Tests

3. **Completeness UX (v1.x)** — "what's missing" indicator on Monthly + Settings so guardians see blockers before they hit them.

## Related

- Companion todo: [.planning/todos/pending/2026-04-18-march-2026-compliance-escalation-to-labor-law-advisor.md](2026-04-18-march-2026-compliance-escalation-to-labor-law-advisor.md)
- Full analysis: [.planning/compliance/2026-03-advisor-brief.md](../../compliance/2026-03-advisor-brief.md)
