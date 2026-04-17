---
phase: 05-scheduling-compliance-workflow
plan: 02
subsystem: frontend
tags: [schedule, home, week-view, table, accessibility, entries]

# Dependency graph
requires: [05-01]
provides:
  - "Home.tsx: assistant-row schedule table replacing day-card strip"
  - "Home.tsx: weekOffset state + getWeekDates(weekOffset) week navigation"
  - "Home.tsx: byAssistantDay computed map from internal entries"
  - "Home.tsx: dailyTotals footer row per day"
  - "Home.tsx: hover UserX mark-absent trigger per shift cell"
affects: [05-03, 05-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Semantic HTML table with scope=col/scope=row for accessibility"
    - "today column highlight: bg-primary/5 + 2px primary border via inline style"
    - "Color dot (8×8px rounded-full) using assistant.color hex for row identity"
    - "group/group-hover pattern for hover-reveal UserX button without JS"

key-files:
  created: []
  modified:
    - "client/src/pages/Home.tsx"

key-decisions:
  - "EmptyState component takes a single `message` prop (not title+description) — merged both strings"
  - "Plus and AssistantAvatar imports removed as unused after day-card strip deletion"
  - "gcalEventDate, gcalEventHours, byDay removed — all GCal-driven schedule logic gone from Home"
  - "gcalEvents query and gcalConnected banner retained unchanged — banner still shows sync status"

# Metrics
duration: 15min
completed: 2026-04-17
---

# Phase 05 Plan 02: Scheduling — Assistant-Row Schedule Table Summary

**Assistant-row weekly schedule table in Home.tsx sourced from internal entries, replacing the GCal day-card strip — delivers SCHED-01 unified week view**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-04-17T19:15:00Z
- **Completed:** 2026-04-17T19:30:00Z
- **Tasks:** 1
- **Files modified:** 1 (client/src/pages/Home.tsx)

## Accomplishments

- Removed `gcalEventDate`, `gcalEventHours`, `byDay` computed values (GCal-driven day-card strip)
- Added `weekEntries`, `byAssistantDay`, `dailyTotals`, `weekLabel` computed values driven by internal `entries` data
- Replaced 7-column card grid with a semantic `<table>` using `scope="col"` and `scope="row"` attributes
- Today's column: `bg-primary/5` background + `2px solid hsl(var(--primary))` left border via inline style
- Each assistant row has an 8×8px color dot using `assistant.color` hex in the row header
- Shift cells display `startTime–endTime` with assistant color left border accent
- Hover on a shift cell reveals a `UserX` icon button with `aria-label="Mark {name} absent on {date}"`
- Clicking the UserX button opens the existing Mark Absent dialog with `assistantId` and `date` pre-filled
- Footer `<tfoot>` row shows `dailyTotals` per day column
- Empty week state: `aria-live="polite"` caption — "No shifts scheduled this week."
- No assistants state: `EmptyState` component with combined message
- GCal banner (connected/not-connected) preserved unchanged
- Add Shift and Mark Absent dialogs preserved unchanged
- `gcalEvents` query retained (used only for the banner)
- TypeScript compiles clean — 0 errors

## Task Commits

1. **Task 1: Replace day-card strip with assistant-row schedule table** — `8d28b34`

## Files Modified

- `client/src/pages/Home.tsx` — Complete schedule section rewrite: semantic table, week navigation, byAssistantDay data map, color dots, today highlight, hover mark-absent trigger, footer totals

## Decisions Made

- `EmptyState` component accepts only a `message` prop — merged `title` and `description` from plan spec into a single string to match actual component signature (Rule 1 auto-fix)
- Removed `Plus` and `AssistantAvatar` from imports since neither is used in the new table layout

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] EmptyState prop signature mismatch**
- **Found during:** Task 1 — TypeScript compile check
- **Issue:** Plan spec used `title` and `description` props on `EmptyState` but the component only accepts `message: string`
- **Fix:** Replaced `<EmptyState title="..." description="..." />` with `<EmptyState message="No assistants added yet. Add assistants in Settings." />`
- **Files modified:** `client/src/pages/Home.tsx`
- **Commit:** `8d28b34`

**2. [Rule 1 - Bug] Unused imports after strip removal**
- **Found during:** Task 1 — post-edit cleanup
- **Issue:** `Plus` (lucide-react) and `AssistantAvatar` (shared.tsx) were imported but no longer used after the day-card strip was deleted
- **Fix:** Removed both from their respective import lines
- **Files modified:** `client/src/pages/Home.tsx`
- **Commit:** `8d28b34`

## Known Stubs

None — all data flows from real `entries` and `assistants` queries. The schedule table renders live server data.

## Threat Surface

No new network endpoints or trust boundaries introduced. All data comes from existing authenticated API routes (`/api/entries`, `/api/assistants`). The `assistantId` and `date` passed to Mark Absent dialog are sourced from server-fetched data, consistent with threat register T-5-02-03 (accepted).

## Self-Check

---
## Self-Check: PASSED

- `client/src/pages/Home.tsx` — modified and staged
- Commit `8d28b34` — confirmed in git log
- `npx tsc --noEmit` — 0 errors
- Acceptance criteria verified:
  - `weekOffset` present
  - `setWeekOffset` present
  - `byAssistantDay` present
  - `dailyTotals` present
  - `scope="col"` present
  - `scope="row"` present
  - `aria-live="polite"` present
  - `aria-label` with "Mark" present
  - `getWeekDates(weekOffset)` present (not hardcoded 0)
  - `byDay` absent (removed)
  - `gcalConnected` retained
