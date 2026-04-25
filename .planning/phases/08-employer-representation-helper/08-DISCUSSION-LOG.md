# Phase 8: Employer Representation Helper - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in 08-CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-18
**Phase:** 08-employer-representation-helper
**Mode:** discuss
**Areas discussed:** Minor detection, Override flag semantics, 18th birthday transition, Salary slip label wording

---

## Gray Areas Presented

| Area | Description | User action |
|---|---|---|
| Minor-detection strategy | Parse age from patient_pno + current or report-end date; 18th birthday edge case | Selected: pno parsing |
| Override flag semantics | `patient_requires_representative` for adult only, or also minor? | Implicitly adult-only (not selected as a separate discussion — rolled into decisions) |
| Swedish label wording | "Företrädd av" / "Företrädare" / "Vårdnadshavare+Ombud" variants | Asked for clarification on which PDFs first |
| Test + rollout scope | Unit-only vs integration; single plan vs multi-plan | Not separately discussed — Claude defaulted per D-13/D-14 |

## Q&A Transcript

### Q1 — Gray area selection (multiSelect)
**Options presented:**
- Minor-detection strategy — How does the helper decide "patient is a minor"?
- Override flag semantics — What exactly does patient_requires_representative do?
- Swedish label wording — What label goes on PDFs for the representative line?
- Test + rollout scope — How deep are the tests, how are plans split?

**User's reply:** *"let's parse it from the pno. i think we should introduce roles to later phases. For example, both parents can be admin, the child can be admin when he becomes an adult, a godman etc"*

**Interpretation:**
- Minor detection: locked to pno parsing (D-01)
- Scope creep: roles system — captured as Deferred Idea (future milestone, possibly v1.2)

### Q2 — 18th birthday transition
**Options presented:**
- Adult (use end-of-period age) — the month patient turns 18 is the first adult month on paper
- Minor (use start-of-period age) — the birthday month stays minor; flip adult next month
- Minor for transition month, adult after

**User's answer:** **Adult (use end-of-period age)** — locked as D-02.

### Q3 — Swedish label wording (first attempt)
**Options presented:**
- "Företrädd av: [name] ([pno])"
- "Företrädare: [name] ([pno])"
- "Vårdnadshavare" when minor, "Ombud" when adult

**User's reply:** *"what pdfs are you asking about?"*

**Response:** Clarified that FK 3057 / FK 3059 / SKV 4805 have government-fixed field names (no label choice); only the v1.0.1 salary slip (Phase 9) header has free-form labels we control.

### Q3b — Salary slip label (second attempt after clarification)
**Options presented:**
- "Företrädd av: [name] ([pno])"
- "Vårdnadshavare: [name]"
- Claude's discretion — pick natural Swedish convention

**User's answer:** **Claude's discretion** — default to "Företrädd av"; researcher free to surface better term during research phase.

## Canonical Refs Accumulated

- `docs/compliance/swedish-fk-and-labor-rules.md` — identified during Phase 7 CONTEXT scout, still authoritative for the representative concept
- `.planning/phases/07-foundation-schema-cleanup/07-CONTEXT.md` + `07-01-SUMMARY.md` + `07-02-SUMMARY.md` — Phase 7 foundation
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — documents the `guardianName` bug this phase closes
- `server/src/lib/form4805-utils.ts`, `server/src/routes/pdf.ts`, `server/src/db/schema.ts` — identified by codebase scout (line numbers in CONTEXT.md)

## Deferred Ideas

- **Roles system** (user-volunteered): multi-admin for both parents, admin-transfer when child becomes adult, god-man as admin role. Replaces the stopgap `patient_requires_representative` flag + `patient_relation_to_guardian` enum shipped in Phase 7. Target: v1.2+, not this milestone.
- **Integration-level PDF regeneration tests**: deferred — Phase 10 DATA-01 will exercise on real data.

## Claude's Discretion Areas

- Exact TypeScript function signature, file location for the helper.
- Plan decomposition (single plan vs multi-plan refactor).
- Final Swedish label if research surfaces a better term than "Företrädd av".
- Pno parsing implementation detail.
