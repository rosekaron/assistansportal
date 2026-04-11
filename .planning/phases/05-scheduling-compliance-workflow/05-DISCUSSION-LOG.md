# Phase 5: Scheduling & Compliance Workflow - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions captured in CONTEXT.md — this log preserves the discussion.

**Date:** 2026-04-12
**Phase:** 05-scheduling-compliance-workflow
**Mode:** discuss (interactive)
**Areas discussed:** Schedule grid design

## Gray Areas Presented

4 areas identified:
1. Schedule grid design (SCHED-01)
2. Compliance checklist placement (COMP-01)
3. Email reminder strategy (COMP-02)
4. Navigation changes

User selected: **Schedule grid design** only. Other areas resolved with defaults.

## Discussion: Schedule Grid Design

### Layout style
- **Presented 3 options:** Time-row grid (Google Calendar style), Assistant-row table, Day cards
- **User asked to see mockups** for all 3 options — HTML previews generated
- **User chose:** Option 2 — Assistant-row table (rows = assistants, columns = days)
- **Reasoning:** Compact, scannable, straightforward

### Time range
- **Week view only** — confirmed as recommended default
- No month view needed

### Placement
- **Key discussion:** User questioned why we'd add a `/schedule` route
- Realized Home.tsx already has a weekly schedule strip — adding a separate route would split responsibility
- **User chose:** Upgrade Home.tsx in place — replace the day-card strip with the assistant-row table
- **Result:** Keep 4-route IA unchanged

## Default Decisions (not discussed interactively)

### Compliance checklist (COMP-01)
- Enhance existing Monthly.tsx 4-step stepper with due dates and status badges
- User did not request discussion — accepted default

### Email reminders (COMP-02)
- Add reminder_day setting in Settings; server cron sends email via existing nodemailer
- User did not request discussion — accepted default

### Navigation
- No changes — keep 4-route IA (confirmed during schedule placement discussion)
