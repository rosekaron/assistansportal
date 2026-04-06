# Phase 2: Leave & Absence Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-06
**Phase:** 02-leave-absence-foundation
**Mode:** discuss
**Areas discussed:** Absence data model, Absence ↔ shift interaction, VAB & sick leave visibility, UI placement

---

## Gray Areas Presented

| Area | Description |
|------|-------------|
| Absence data model | New `absences` table vs. reusing entries entryType='sick' |
| Absence ↔ shift interaction | Does absence cancel/override existing approved shifts or coexist? |
| VAB & sick leave visibility | What guardian sees for LEAV-03: VAB cap rules, sick leave "balance" |
| UI placement | New dedicated page vs. integrated into Assistants or Calendar views |

**User selected:** All four areas ("the entire flow. i havent thought about how to handle absence and leaves and i should")

---

## Discussion by Area

### Absence Data Model

| Question | Answer |
|----------|--------|
| New absences table vs. extend entries? | **New absences table** (recommended) |
| Per-assistant or support all-assistants? | **Support both** — optional assistantId; null = all assistants |
| Hours per day or date range only? | **Date range only** (recommended) — hours derived from overlapping shifts |

### Absence ↔ Shift Interaction

| Question | Answer |
|----------|--------|
| What happens to overlapping shifts? | **Absence auto-cancels shifts** — assistants don't clock in on absence days |
| Delete shifts or keep with status change? | **Keep with status change** (recommended) — audit trail preserved |

### VAB & Sick Leave Visibility

| Question | Answer |
|----------|--------|
| Calendar year vs. rolling 12 months? | **Calendar year** (Jan 1 – Dec 31, resets January) |
| What is "sick leave balance"? | **Days recorded this year** — simple usage count, no cap |

### UI Placement

| Question | Answer |
|----------|--------|
| New page vs. integrated? | **New dedicated "Frånvaro" page** + also reflected in Assistants page per-assistant |

---

## Corrections Made

No corrections — all recommendations confirmed or user provided explicit preference.

---

## Codebase Context Applied

- `entries` table already has `entryType: "sick"` — but it's shift-level, not date-range; confirmed separate table is right
- FK 3059 and FK 3057 both need absence exclusion logic in `server/src/routes/pdf.ts`
- Guardian scoping pattern (guardianId on all tables) must be applied to `absences` table too
