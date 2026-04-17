---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
status: paused_triage
last_updated: "2026-04-18T22:00:00.000Z"
paused_at: "2026-04-18T22:00:00.000Z"
paused_reason: "Triage gate — do not advance phases until payroll formula discussion is resolved with guardian"
progress:
  total_phases: 9
  completed_phases: 9
  total_plans: 36
  completed_plans: 36
  percent: 100
next_action:
  command: /gsd-check-todos
  priority_files:
    - .planning/todos/pending/2026-04-18-resume-discussion-payroll-formula-hypotheses-before-any-code.md
    - .planning/todos/pending/2026-04-18-triage-all-open-todos-with-guardian-before-any-implementatio.md
    - .planning/todos/pending/2026-04-18-verify-and-fix-payroll-calculation-deduct-employer-tax-and-c.md
---

# Kalinga Assistansportal — Project State

## ⏸ PAUSED — Read this first on every session resume

Milestone v1.0 code is shipped (9/9 phases complete). Do NOT auto-advance to milestone archive or the next milestone.

On 2026-04-18 the guardian flagged the payroll calculation as wrong. Investigation showed the formula is arithmetically correct, so the real issue is one of six hypotheses (H1–H6). A triage gate was established: no new implementation until the hypotheses are discussed and a fix direction is chosen.

**When `/gsd-next` runs next:** route to the payroll-formula triage discussion, not phase advancement. Read:
1. `.planning/todos/pending/2026-04-18-resume-discussion-payroll-formula-hypotheses-before-any-code.md` — the hypothesis table + resume script
2. `.planning/todos/pending/2026-04-18-triage-all-open-todos-with-guardian-before-any-implementatio.md` — the broader backlog (8 todos) awaiting triage
3. `.planning/todos/pending/2026-04-18-verify-and-fix-payroll-calculation-deduct-employer-tax-and-c.md` — full analysis with hypotheses H1–H6

**Do not:**
- Run `/gsd-complete-milestone` (the milestone is ready for archival but paused pending discussion)
- Run `/gsd-plan-phase` or `/gsd-execute-phase` until a hypothesis is chosen
- Convert todos to phases without the triage conversation first

**Unpause protocol:**
1. Ask guardian: "Last session we paused at payroll formula triage. Resume now?"
2. If yes → walk through H1–H6 with guardian, settle on a direction
3. Set `status: planning` (or `executing`) in frontmatter, remove this block, proceed

---

**Project:** Swedish personal assistance (assistansersättning) self-management platform
**Milestone:** v1 — Stability, Compliance, and Core Payroll
**State Updated:** 2026-04-18 (paused)

---

## Project Reference

**Core Value:**
The guardian can complete the full monthly compliance cycle — approve hours, generate all required forms, calculate pay — without needing an HR department or assistance company.

**Current Focus:**
Phase 05 — scheduling-compliance-workflow

**Tech Stack:**

- Frontend: React + Vite (TypeScript)
- Backend: Express + Drizzle ORM (TypeScript)
- Database: PostgreSQL
- No breaking changes to stack; TypeScript throughout
- New libraries for v1: xmlbuilder2 (AGI XML), swedish-holidays (VAB tracking)

---

## Current Position

Phase: 06
Plan: Not started
**Phase 06:** COMPLETE (google-calendar-integration) — UAT: 4 passed, 3 blocked on credentials
**Phase 06.1:** Plan written — 3 remaining UAT bugs (BUG-002, BUG-004, BUG-005)
**Status:** Ready to plan
**Progress:** [█████████░] 89%

---

## Phases Defined

5 phases with clear dependencies:

| Phase | Goal | Requirements | Status |
|-------|------|--------------|--------|
| 1 | Stability & Correctness (security, data isolation, calculations) | 4 | ✓ Complete |
| 2 | Leave & Absence Foundation (track absences, exclude from billable hours) | 3 | Not started |
| 3 | Payroll Calculation & Recording (2026 tax rates, employer contributions) | 3 | Not started |
| 4 | Tax Reporting (AGI) (Skatteverket declarations) | 2 | Not started |
| 5 | Scheduling & Compliance Workflow (multi-assistant grid, monthly checklist, reminders) | 3 | Not started |

**Key Constraint:** Phase 1 must complete before any feature work (foundational security and data isolation).

---

## Critical Blockers & Risks

**Blocking Phase 1:**

- None — Phase 1 is foundational fixes, can start immediately

**Blocking Phase 2:**

- Phase 1 must be complete (no blocker until Phase 1 finishes)

**Medium-Confidence Areas (During Implementation):**

- Exact AGI XML schema for 2026 requires validation against official Skatteverket technical docs
- VAB day calculation if crossing month boundaries — needs product owner clarification
- Preliminärskatt (preliminary tax) configuration — per-guardian, per-assistant, or per-month? Confirm with FK

---

## Decisions Made

| Decision | Rationale | Status |
|----------|-----------|--------|
| Phase 1 is Stability & Correctness | Fixes existing bugs before adding features; unblocks safe extension | Approved in instructions |
| Leave/Absence before Payroll | Billable hours = approved − absence; must be in correct order | Approved in instructions |
| Payroll before Tax Reporting (AGI) | AGI consumes payroll records; dependency chain enforced | Approved in instructions |
| 5 phases (standard granularity) | Balanced grouping; each phase delivers one complete capability | Derived from requirements |
| No UI phase separation | Phases 3 and 5 have UI work, but grouped with backend for cohesion | Grouped for delivery independence |

---
- [Phase 03-payroll-calculation-recording]: sv-SE Intl.NumberFormat used for all SEK currency display in payroll UI
- [Phase 03-payroll-calculation-recording]: Swedish UI copy deferred for English conversion — follow-up task logged
- [Phase 03.5-02]: assistantId always resolved server-side from JWT (getAssistantId helper) — never accepted from request body, satisfying T-3.5-04
- [Phase 03.5-02]: Used newId() (crypto.randomBytes) for ID generation — matches existing project convention; nanoid not a dependency
- [Phase 04]: agiUnlocked = step2Complete — Step 4 unlocks when all payroll records are approved (consistent with D-07)
- [Phase 04]: preliminary_tax_rate stored as decimal string in settings, displayed as integer percentage in UI — conversion on read and write
- [Phase 06.1-uat-bug-fix]: Self-registration requires name+pno+minWeeklyHours; server enforces 409 on duplicate
- [Phase 06.1-uat-bug-fix]: BUG-004 marked Fixed (code path complete); live SMTP test required separately for delivery confirmation

## Roadmap Evolution

- Phase 06.1 inserted after Phase 06: UAT Bug Fix (URGENT) — 7 bugs found during Phase 6 acceptance testing logged in .planning/UAT-BUG-LOG.md

## Accumulated Context

**From Research Summary:**

- **2026 Swedish Compliance Specificity:**
  - Employer contributions: 31.42% standard rate, 10.21% for age 67+, 17.77% for ages 19–23 (April 2026+)
  - AGI format: 2026 removed fields 062/063, added VAB day reporting
  - FK deadlines: 5th of second following month (e.g., Jan hours → due March 5)
  - AGI deadline: 12th of following month (e.g., Jan hours → due Feb 12)

- **Known Bugs in Existing Codebase:**
  1. FK 3057 uses hardcoded `day 31` — breaks for February (28 days) and 30-day months
  2. Role middleware defined but not enforced server-side — assistants can theoretically call guardian endpoints
  3. FK hourly rate (334 SEK) and tax rate (31.42%) hardcoded in Reports component — requires redeploy when rates change
  4. API response types inconsistent (some camelCase, some snake_case) — silent failures in client code
  5. Multi-tenant data isolation not enforced at query level — no guarantee data doesn't leak between guardians

- **Architecture Strengths:**
  - Monorepo with clear separation (client, server)
  - Drizzle ORM with PostgreSQL — good for multi-tenant row-level scoping
  - JWT stateless auth — good for scaling
  - React Query + Zustand — solid client state management

- **No Test Suite Exists:**
  - All new work should include regression tests
  - Phase 1 must include multi-tenant data isolation test suite

---

## Performance Metrics

**Will update after Phase 1 planning:**

- Lines of code to fix (Phase 1 estimate)
- Test coverage target (currently 0%)
- Build time (baseline)
- API response latency (baseline)

---

## Session Continuity

**Roadmap Complete:**

- All 15 v1 requirements mapped to phases
- 100% coverage validated
- Dependencies documented
- Success criteria defined

**Next Action:**
Run `/gsd-plan-phase 1` to decompose Phase 1 (Stability & Correctness) into executable plans.

**Context Artifacts Available:**

- `.planning/PROJECT.md` — core value and constraints
- `.planning/REQUIREMENTS.md` — full requirement list with traceability
- `.planning/research/SUMMARY.md` — research findings and risk analysis
- `.planning/codebase/ARCHITECTURE.md` — system design and data flows

---

*State created: 2026-04-06*
