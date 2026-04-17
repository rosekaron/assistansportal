---
created: 2026-04-18T00:00:00Z
title: Home notification for labor-law and FK schedule violations
area: ui
planned_milestone: v1.3
files:
  - client/src/pages/Home.tsx
  - client/src/pages/Monthly.tsx
  - server/src/lib/scheduleCompliance.ts   # NEW — proposed pure-function module
  - server/src/routes/entries.ts
  - .planning/compliance/2026-03-advisor-brief.md
  - .planning/todos/pending/2026-04-18-march-2026-compliance-escalation-to-labor-law-advisor.md
---

> **Milestone assignment (2026-04-18):** This design is scoped for **v1.3 — Schedule-Violation Warnings on Monthly**. Original todo was Home-only; user directed that Monthly placement is primary (with Home as secondary mirror). See ROADMAP.md "Future Milestones" section. Promote via `/gsd-new-milestone v1.3` after v1.0 archives.


## Problem

The March 2026 compliance audit ([.planning/compliance/2026-03-advisor-brief.md](../../compliance/2026-03-advisor-brief.md)) found that the current schedule quietly contains:
- 48 dygnsvila (§13 ATL) violations — rest between shifts < 11h
- 4 weeks of veckovila (§14 ATL) shortfall — longest rest 35h, need 36h
- 48.5h/week for both assistants — 8.5h/week over ATL §5 ordinarie 40h
- ~60h of weekday dubbel-assistans (overlapping Rose + Mikael shifts) that may not be covered by the FK beslut
- 5h/day uncovered coverage (00:00–05:00) — if FK beslut is 24h, who's billed?

None of this is surfaced in the UI. The guardian only finds out at month-end (or from a labor-law advisor after the fact) — by which time the schedule is already worked and payroll is being calculated. **Violations need to be visible at scheduling time**, not after.

## Solution

Add a "Schedule health" card to the Home page — next to or above the week grid — that runs rule checks over the currently-displayed week and warns the guardian about each violation with the specific date, assistant, and rule.

### Rule set (v1)

Pure functions, all operating on the same `ShiftLike[]` shape the Home grid already derives:

| Rule ID | Source | Check | Severity | User-facing message |
|---------|--------|-------|----------|---------------------|
| `ATL-5-WEEKLY-40H` | Arbetstidslagen §5 | Sum of hours per assistant per ISO-week > 40h | warning | "{Name} is scheduled {X}h this week (ATL §5 limit is 40h)" |
| `ATL-8-OVERTIME-48H` | Arbetstidslagen §8 | Weekly övertid > 12h (48h/4-week cap heuristic) | error | "{Name} exceeds ATL §8 övertid cap — review kollektivavtal" |
| `ATL-13-DYGNSVILA` | Arbetstidslagen §13 | Gap between consecutive shifts (same assistant) < 11h | error | "{Name} has only {X}h rest between {Date1 End} and {Date2 Start} (ATL §13 requires 11h)" |
| `ATL-14-VECKOVILA` | Arbetstidslagen §14 | Longest continuous rest in any 7-day window < 36h | warning | "{Name} has no 36h continuous rest in week of {Date}" |
| `FK-DUBBEL-UNAPPROVED` | FK beslut | Two assistants overlap in same time slot AND `profile.dubbelAssistansApproved !== true` | error | "Dubbel-assistans at {Date} {Time1}–{Time2} is not approved in FK beslut" |
| `FK-COVERAGE-GAP` | FK beslut | Hours/day in grid < `profile.fkDecisionHoursPerDay` | warning | "Only {X}h scheduled on {Date} — FK beslut entitles {Y}h" |
| `FK-COVERAGE-EXCESS` | FK beslut | Hours/day in grid > `profile.fkDecisionHoursPerDay` | warning | "{X}h scheduled on {Date} exceeds FK beslut of {Y}h — excess won't be billable" |
| `FK-DECISION-EXPIRED` | FK beslut | Current date > `profile.fkDecisionEnd` | error | "FK beslut expired {Date} — new decision needed before billing" |
| `ANHORIG-CAP` | Anhörigassistans | If guardian is also an assistant and total personal hours > some threshold | warning | "{Name} is guardian and assistant — anhörigassistans rules may cap billable hours" |
| `EMPLOYMENT-OUT-OF-PERIOD` | Employment dates | Shift date outside `assistants.employmentStart/End` | error | "{Name} is not employed on {Date}" |

Some of these (`FK-DUBBEL-UNAPPROVED`, `FK-COVERAGE-*`, `FK-DECISION-*`, `EMPLOYMENT-*`) depend on schema additions flagged in the companion todo ([capture-missing-assistant-and-profile-fields](2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md)). Ship the ATL rules first (they only need the data we already have), then enable the FK rules as schema fills in.

### Implementation sketch

**1. Pure-function rule engine** at `server/src/lib/scheduleCompliance.ts`:

```ts
export type Violation = {
  ruleId: string;
  severity: "error" | "warning";
  assistantId?: string;
  date?: string;
  message: string;
  details?: Record<string, unknown>;
};

export function checkWeek(
  shifts: ShiftLike[],
  assistants: Assistant[],
  profile: Profile,
): Violation[] { ... }
```

Fully unit-testable in isolation with no DB/HTTP.

**2. Server endpoint** `GET /api/schedule/violations?start=YYYY-MM-DD&end=YYYY-MM-DD` — reads entries OR GCal events (same source the Home grid uses) and runs `checkWeek`. Returns `Violation[]`.

**3. UI card on Home.tsx** above or below the week grid:
- Empty state: green check + "No issues this week"
- Errors: red pill with count; expandable list of specific violations
- Warnings: amber pill with count
- Each violation row: badge for severity, the message, and a small "See rule" link that opens a popover explaining which statute/FK rule and what the fix looks like

**4. Real-time re-run on schedule edits**: React Query invalidation key tied to `weekDates[0]` so violations recompute after every entry create/delete/approve.

**5. Blocking vs advisory**:
- `error` severity on approval path → Monthly Step 1 ("Approve time entries") shows a "Resolve X errors first" banner. Still allow override with a "Proceed despite warnings" confirmation. Never silently submit.
- `warning` severity → visible on Home but does not block.

### Data flow integration

```
entries / gcal events → Home grid (unchanged)
                      ↓
            scheduleCompliance.checkWeek() → Violation[]
                      ↓
              "Schedule health" card on Home
                      ↓
            Gate Monthly Step 1 approval when errors exist
```

### Why this matters beyond "nice to have"

- Every month the guardian currently risks submitting FK claims that the advisor/FK rejects, requiring rework after the fact. Early detection = hours saved.
- The labor-law violations aren't theoretical — the March schedule has 48 concrete dygnsvila breaches. If any assistant files a complaint (Kommunal intervention, Arbetsmiljöverket inspection), lack of documented awareness is itself a problem. A standing notification establishes that the guardian is aware and that override decisions are explicit.
- Most of the rules are single-week pure functions — cheap to compute, easy to test.

## Related

- Triggering incident: [.planning/compliance/2026-03-advisor-brief.md](../../compliance/2026-03-advisor-brief.md)
- Blocks fully on: [2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md](2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md) — FK-prefixed rules need fkDecisionHoursPerDay, dubbelAssistansApproved, fkDecisionStart/End columns. ATL-prefixed rules can ship independently.
- Drift context: [2026-04-17-calendar-and-scheduling-user-stories-from-v1-0-learnings.md](2026-04-17-calendar-and-scheduling-user-stories-from-v1-0-learnings.md)

## Proposed phase scope

**v1.1 (ATL rules only)** — ships immediately with no schema change:
- `ATL-5-WEEKLY-40H`
- `ATL-8-OVERTIME-48H` (heuristic — kollektivavtal threshold configurable in Settings)
- `ATL-13-DYGNSVILA`
- `ATL-14-VECKOVILA`
- UI card + server endpoint + 20-ish unit tests

**v1.2 (FK rules)** — after schema additions land:
- `FK-DUBBEL-UNAPPROVED`, `FK-COVERAGE-GAP`, `FK-COVERAGE-EXCESS`, `FK-DECISION-EXPIRED`
- `EMPLOYMENT-OUT-OF-PERIOD`, `ANHORIG-CAP`
