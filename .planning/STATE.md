---
gsd_state_version: 1.0
milestone: v1.0.1
milestone_name: Salary Slip + Foundation Cleanup
status: roadmap_complete
last_updated: "2026-04-18T23:59:00.000Z"
progress:
  total_phases: 4
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Kalinga Assistansportal — Project State

**Project:** Swedish personal assistance (assistansersättning) self-management platform
**Milestone:** v1.0.1 — Salary Slip + Foundation Cleanup
**State Updated:** 2026-04-18

---

## Project Reference

**Core Value:**
The guardian can complete the full monthly cycle — approve hours, generate all required forms, calculate pay — without needing an HR department or assistance company.

**Current Focus:**
v1.0.1 roadmap complete. Next: `/gsd-plan-phase 7` to decompose Foundation (Schema & Cleanup) into executable plans.

**Tech Stack:**

- Frontend: React + Vite (TypeScript)
- Backend: Express + Drizzle ORM (TypeScript)
- Database: PostgreSQL
- No breaking changes to stack; TypeScript throughout
- PDF libraries: pdf-lib + pdfkit (existing); no new libs for v1.0.1

---

## Current Position

Phase: Not started (roadmap complete, awaiting Phase 7 plan decomposition)
Plan: —
Status: Roadmap complete for v1.0.1 (4 phases, 18/18 requirements mapped)
Last activity: 2026-04-18 — Roadmap created by gsd-roadmapper (Phases 7–10)
**Progress:** [░░░░░░░░░░] 0%

---

## Phases Defined (v1.0.1)

4 phases with strict dependency chain:

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 7 | Foundation — Schema & Cleanup (new assistants/profile columns + remove dead scheduling scaffolding) | 6 (SCHEMA-01/02/03 + CLEAN-01/02/03) | Not started |
| 8 | Employer Representation Helper (single source of truth for FK/SKV/slip renderers) | 2 (EMP-01, EMP-02) | Not started |
| 9 | Salary Slip — Anhörig Model (legally-required lönespec PDF, guardian + assistant download paths, audit table, Fremia/Custom scaffolding) | 7 (SLIP-01..07) | Not started |
| 10 | Real Data Entry & End-to-End Verification (guardian enters real brukare/assistant data; clean FK/SKV/slip downloads) | 3 (DATA-01/02/03) | Not started |

**Key Constraint:** Phase 7 must ship before 8 (needs `patient_requires_representative` column). Phases 7 + 8 must ship before 9 (slip needs new schema columns and uses employer helper in header). Phase 10 is last — it validates end-to-end.

---

## Critical Blockers & Risks

**Blocking Phase 7:**

- None — Phase 7 is foundation work, can start immediately

**Blocking Phase 8:**

- Phase 7 SCHEMA-02 (patient_requires_representative column) must land

**Blocking Phase 9:**

- Phase 7 (salary_model enum, hourly_rate_override, payment_slips table, payroll_records snapshot columns)
- Phase 8 (employer helper wired so slip header uses it)

**Blocking Phase 10:**

- Phases 7, 8, 9 all complete (end-to-end walkthrough exercises FK 3057 + SKV 4805 + lönespec on real data)

**Medium-Confidence Areas (During Implementation):**

- `payment_slips.document_number` format (`LS-YYYY-MM-NNN`) — idempotency for reissue needs careful handling (replay should reuse number, not allocate new)
- `resolveEmployerRepresentation()` — adult-with-god-man case relies on explicit `patient_requires_representative` override; no automated detection
- Absence `GET /api/absences/balance/:assistantId/:year` — new endpoint or extension of existing balance route; needs VAB year-to-date running count

---

## Decisions Made (v1.0.1 kick-off)

| Decision | Rationale | Status |
|----------|-----------|--------|
| Continue in same repo, not fresh project | User decision 2026-04-18 — v1.0.1 is incremental follow-on to v1.0, not a clean break | Approved |
| Phase numbering continues from v1.0 (starts at 7) | Milestone continuity; avoids collision with shipped v1.0 phase history | Approved (GSD convention) |
| Schema + cleanup merged into single Phase 7 | Both are DB/foundation work that blocks downstream phases; keeps milestone at ~4 phases for ~6.5 day scope | Derived from requirements |
| EMP is its own Phase 8 (not absorbed into Phase 7) | Employer helper touches 3 existing renderers (FK 3057, FK 3059, SKV 4805) plus new slip — substantial refactor that benefits from isolated verification before slip work builds on it | Derived from dependency analysis |
| SLIP is its own Phase 9 (7 requirements — largest phase) | Salary slip is the headline deliverable with 7 requirements spanning schema snapshot, PDF, gated endpoints, audit table, Settings scaffolding — cohesive vertical slice | Derived from requirements |
| DATA is separated as Phase 10 (not merged with SLIP) | Real-data entry + end-to-end verification is a distinct gate — it proves the full pipeline works on live data and is a guardian-driven checkpoint, not code work | Derived from requirements |

---

## Accumulated Context

**From v1.0 archive (inherited):**

- v1.0 shipped 9 phases, 36 plans, 15/15 requirements (2026-04-18, tag `v1.0`)
- Full monthly compliance cycle works end-to-end in current UI
- Accepted known issues: flat 30% preliminärskatt, omkostnader pot not modelled, age-bracket arbetsgivaravgifter, gross-not-net outstanding balance, guardianName-as-employer (Phase 8 closes this)

**v1.0.1-specific context:**

- Anhörig arrangement: Rose + Mikael at fixed 254.10 kr/h, no sjuk/VAB/semester pay, no pension (legal — they're the patient's parents)
- Salary slip intentionally excludes arbetsgivaravgifter + total kostnad (guardian direction 2026-04-18)
- Fremia/Custom scaffolding ships disabled in v1.0.1; live logic deferred to v1.4/v1.5
- Latent bug closed by Phase 8: `form4805-utils.ts:91,120` and `pdf.ts:140,141,147,303,373` hardcode `profile.guardianName` as employer

---

## Session Continuity

**Roadmap Complete (v1.0.1):**

- 4 phases defined (7–10)
- 18/18 v1.0.1 requirements mapped (100% coverage)
- Dependencies documented
- Success criteria derived (2–6 observable behaviors per phase)

**Next Action:**
Run `/gsd-plan-phase 7` to decompose Phase 7 (Foundation — Schema & Cleanup) into executable plans.

**Context Artifacts Available:**

- `.planning/PROJECT.md` — core value, constraints, v1.0.1 kick-off context
- `.planning/REQUIREMENTS.md` — 18 v1.0.1 requirements + full traceability to Phases 7–10
- `.planning/ROADMAP.md` — v1.0.1 phase details (Phases 7–10) + v1.0 retrospective + future milestones
- `.planning/milestones/v1.0-ROADMAP.md` — shipped v1.0 phase archive
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — v1.0 known-issues and accepted debt
- `.planning/todos/pending/2026-04-18-*` — v1.0.1 design inputs (slip, capture-missing-fields, minor-vs-adult)

---

*State created: 2026-04-06 (v1.0 kickoff)*
*v1.0.1 roadmap state updated: 2026-04-18 — 4 phases (7–10), 18 requirements, 0/0 plans (awaiting decomposition)*
