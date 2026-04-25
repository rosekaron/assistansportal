> **CLOSED (2026-04-18)**
>
> Triage executed this session. All 11 todos reviewed against the roadmap; 4 superseded (this + 3 others), 2 gaps identified (calendar drift routed to v2.0, login bug confirmed already-fixed), foundation schema todo absorbed into v1.0.1, 1 external (advisor review). ROADMAP.md now holds the full handoff context.

---
created: 2026-04-18T00:00:00Z
title: Triage all open todos with guardian before any implementation
area: planning
files:
  - .planning/todos/pending/
---

## Problem

Seven todos now sit in `.planning/todos/pending/`, captured during the v1.0 milestone close-out over 2026-04-17/18. Several of them overlap, compete for the same schema columns, or make assumptions about domain behaviour that are best answered by the guardian (and/or a labor-law / FK advisor) before any code ships.

Shipping them in the captured order — or all at once — risks:
- Building on hypotheses instead of facts (e.g. the payroll-calculation todo has 6 hypotheses, only one of which matches reality)
- Duplicating schema migrations (the three compliance-related todos all want new columns on `assistants` and `profile`)
- Over-engineering before the core question is answered (e.g. ship "Home violation notification" with 10 rules when the guardian only cares about 3)

**Treat this as a gate: no implementation until the backlog is triaged.**

## Open todos (as of 2026-04-18 22:00)

1. [log-login-silent-failure-as-a-bug](2026-04-17-log-login-silent-failure-as-a-bug.md) — pre-dates today's work
2. [calendar-and-scheduling-user-stories-from-v1-0-learnings](2026-04-17-calendar-and-scheduling-user-stories-from-v1-0-learnings.md) — entries↔GCal drift, invite atomicity
3. [capture-missing-assistant-and-profile-fields-for-fk-and-skat](2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md) — schema additions + data entry gaps
4. [march-2026-compliance-escalation-to-labor-law-advisor](2026-04-18-march-2026-compliance-escalation-to-labor-law-advisor.md) — blocking on external advisor
5. [home-notification-for-labor-law-and-fk-schedule-violations](2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md) — Home-page ATL/FK warnings at schedule time
6. [flag-submission-blocking-violations-before-fk-and-skatteverk](2026-04-18-flag-submission-blocking-violations-before-fk-and-skatteverk.md) — Monthly-page blockers at download time
7. [verify-and-fix-payroll-calculation-deduct-employer-tax-and-c](2026-04-18-verify-and-fix-payroll-calculation-deduct-employer-tax-and-c.md) — formula correctness (H1–H6 hypotheses)

## Solution — proposed triage process

### Step 1 — Read-through (do together, 15 min)

Walk through each todo with the guardian. For each:
- State the problem in one sentence.
- Confirm or correct the framing.
- Note any new signal that changes scope.

### Step 2 — Per-todo gate decisions

For each todo, answer three questions:

| Question | Possible answers |
|----------|------------------|
| **Is this real?** | confirmed / not-a-real-issue / needs-more-info |
| **When does it matter?** | blocking-now / v1.1 / v1.2+ / backlog / drop |
| **Who decides?** | guardian-only / guardian+advisor / guardian+me / me-alone |

Park any `needs-more-info` ones pending the right input source (advisor, product decision, user research). Don't try to answer them with hypotheses.

### Step 3 — Dependency graph

Draw the cross-references between todos. Known links already documented:
- #3 schema-additions → unblocks parts of #5, #6, #7
- #4 advisor brief → unblocks filing-related parts of #5, #6
- #7 payroll formula → may change what #6 reports
- #2 calendar drift → changes write paths that #5 and #6 assume

Order of work should follow the graph, not the creation order.

### Step 4 — Convert to phases

Promote agreed-to-do todos into formal GSD phases via `/gsd-insert-phase` or append to roadmap. Scope each phase to land in one milestone (v1.1 or v1.2). Leave "backlog" items in `.planning/todos/pending/` with a note.

### Step 5 — Archive decisions

Record the outcome of each triage in the todo itself (frontmatter field like `triage_status: confirmed-v1.1` or `triage_status: dropped-duplicate-of-X`). Move `dropped` and `confirmed-shipped` todos to `.planning/todos/completed/`. Commit a single `docs(triage)` commit so the decisions are traceable.

## Specific discussions to have

### Discussion A — Payroll formula (todo #7)

Which of H1–H6 matches what the guardian is seeing? Specifically:
- What numbers on Monthly does the guardian expect to see?
- Is there a concept of **assistansomkostnader pot** (set-aside for training, sick-leave reserve, insurance) that isn't modelled?
- What do they currently do month-to-month in practice? Fremia schablon split? Cash accounting?

Until this is answered, no other payroll work should ship because the formula change could invalidate it.

### Discussion B — Calendar as source of truth (todo #2)

We already pivoted the Home grid display to read from GCal. The next questions are:
- Should `POST /api/entries` write to GCal atomically (outbound sync)?
- Should a GCal import run import events as entries (inbound)?
- Which side wins when a conflict exists?

These choices determine whether v1.x is "display-only GCal + separate entries ledger" or "bidirectional sync".

### Discussion C — Violation rule coverage (todos #5 + #6)

10 rules + 12 blockers were proposed. The guardian will likely only care about 3–5 of each. Trim to the realistic ones before building a big rules engine. Specifically:
- ATL dygnsvila & weekly-hours — definitely valuable
- FK coverage gap/excess — needs `profile.fkDecisionHoursPerDay` to even run
- Anhörigassistans cap — only if guardian is also an assistant
- Employment-period checks — only if turnover is expected

### Discussion D — Schema scope (todo #3)

11 new fields proposed. Some are clearly needed (Mikael's pno); others are speculative (citizenship, residence permit expiry). Trim the schema PR to what's needed for v1.1 vs v1.2 vs never.

## Output

The output of this triage is:
1. A shortlist of 2–4 phases for v1.1 with scope locked
2. A drop/defer list for the remaining items
3. One commit capturing all decisions

## Priority

**Highest priority before any new coding.** Doing this badly = wasted work shipping wrong things; doing this well = v1.1 has real user-chosen scope.

## How to invoke this

When ready, the guardian can say:
- `/gsd-check-todos` — list all pending todos
- `let's triage` — start step 1 together

This todo is then closed with `triage_status: completed` and links to the phases created + items dropped.
