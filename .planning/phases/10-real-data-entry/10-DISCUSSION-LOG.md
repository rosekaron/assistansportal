# Phase 10: Real Data Entry & End-to-End Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-20
**Phase:** 10-real-data-entry
**Areas discussed:** Data-entry method, Walkthrough scope

---

## Gray Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Data-entry method | UI-driven vs direct PUT/SQL | ✓ |
| Walkthrough scope | 3-PDF verify vs broader E2E | ✓ |
| Slip-month choice | 2026-03 (reuse) vs fresh month | |
| Bank details in git | Real vs synthetic in committed docs | |

Slip-month and bank-details were not selected for discussion; Claude resolved both under "Claude's Discretion" in CONTEXT.md (2026-03 confirmed later via Area 2 Q3; bank-details defaulted to "real in DB, never in git").

---

## Data-entry method

### Q1: Who actually enters the data?

| Option | Description | Selected |
|--------|-------------|----------|
| Claude drives via API | PUT /api/profile + PUT /api/assistants/:id with real values; user confirms | ✓ |
| You type into Settings UI | User navigates UI, types, clicks Save | |
| You type + Claude verifies | User types into UI; Claude verifies via API reads | |

**Notes:** Fast, reliable, dogfoods the Phase 7 whitelists but not the UI forms. UI-form dogfooding happened in Phase 9's UAT subtest 1, so this is an acceptable trade-off.

### Q2: Legacy `profile.address` column — what's its fate?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep both synced | Populate new split fields AND keep legacy `address` in sync | (implied) |
| Migrate & null-out legacy | Move to new fields, set legacy to "" | |
| You decide | Claude picks during implementation | |

**User's choice (free text):** "keep the date. treat all data entered and calendar entries synched as a reflection of the current reality"
**Interpretation:** User wants BOTH fields to reflect current reality. Maps to "Keep both synced" — legacy retained and new split fields filled to match. Captured as D-02.

### Q3: Order of data entry?

| Option | Description | Selected |
|--------|-------------|----------|
| Profile → Assistants → Verify | Dependency order | ✓ |
| Assistants → Profile → Verify | Reverse order | |
| All at once, then verify | Single batch write, then verify | |

**Notes:** Profile drives employer + representative header lines on FK 3057 + SKV 4805 + slip, so it must be correct before PDF-facing assistants data is finalised.

---

## Walkthrough scope

### Q1: Placeholder detection method for the 3 PDFs?

| Option | Description | Selected |
|--------|-------------|----------|
| Automated grep + visual | pdftotext → grep → show text for eyeball | ✓ (clarified) |
| Visual only | Open each PDF, read, thumbs up/down | |
| Automated grep only | Script-checked, skip eyeball | |

**User's choice (free text):** "are you using GSD"
**Interpretation after clarification:** User wanted confirmation that the GSD `/gsd-verify-work` framework drives this. Claude confirmed yes and mapped the answer to "Automated grep + visual" run INSIDE a GSD UAT — same pattern as Phase 9's `09-UAT.md`. Captured as D-06.

### Q2: Which PDFs to verify?

| Option | Description | Selected |
|--------|-------------|----------|
| All 3 per ROADMAP | FK 3057 + SKV 4805 (both) + Slip (both) = 5 PDFs | |
| Rose-only quick pass | FK 3057 + Rose SKV 4805 + Rose Slip = 3 PDFs | ✓ |
| Include FK 3059 too | Adds 1 more PDF | |

**Notes:** Scope downshift from ROADMAP criterion 3 literal reading. Data-entry still covers BOTH assistants (criterion 2 preserved). PDF eyeball step samples Rose only — Mikael treated as transitively passing if Rose's PDFs are clean and both assistants were entered through the same whitelists. Captured as D-04 with explicit rationale.

### Q3: Which month for the walkthrough?

| Option | Description | Selected |
|--------|-------------|----------|
| 2026-03 | Already approved + slip issued | ✓ |
| Fresh month | New payroll approval needed | |

**Notes:** 2026-03 exercises D-06 rebuild-on-download (new data surfaces in rebuilt PDF) and D-09 pay-date freeze (unchanged) without requiring a second payroll approval. Captured as D-05.

---

## Claude's Discretion

- Slip-month choice — user answered Q3 of Walkthrough scope; no discretion needed.
- Bank details in git — defaulted to "real values in Postgres only, never in commits." Rationale: `.planning/` commits could leak, DB state does not.
- FK 3059 inclusion — defaulted to omit; same helper as FK 3057/4805; add only on UAT request.
- Recovery workflow on grep hits — defaulted to the Phase 9 pattern (diagnose → plan → fix via `/gsd-plan-phase --gaps`).

## Deferred Ideas

- Mikael's full PDF walkthrough
- Fresh-month issuance smoke test (covered in Phase 9's 21-test mocked suite)
- FK 3059 placeholder check
- Synthetic seed script for CI
