---
created: 2026-04-17T21:44:44.169Z
title: Calendar and scheduling user stories from v1.0 learnings
area: planning
files:
  - client/src/pages/Home.tsx
  - server/src/routes/gcal.ts
  - server/src/routes/entries.ts
  - server/src/routes/clock.ts
  - server/src/routes/auth.ts:190
  - server/src/routes/misc.ts:69
  - client/src/pages/Settings.tsx:303
---

## Problem

During v1.0 milestone close-out (2026-04-17), a live walk-through of SCHED-01 + GCAL-01 surfaced multiple architectural and UX gaps between the internal schedule (`entries` table) and the linked Google Calendar. We shipped functional code for both, but the two systems are largely disconnected, which leads to user-visible drift (e.g. schedule grid can show 97h/week while the FK invoice shows 0h).

The learnings span four concerns:
1. **Source-of-truth drift** — `entries` (payroll/FK) vs GCal (display) can hold different shifts
2. **Invite/assistant creation consistency** — three creation paths, none atomically linked
3. **Read-side bugs** — Sunday clipping, single-shift-per-cell rendering, TZ labels
4. **Missing write-paths** — guardian-created shifts don't push to GCal; GCal events don't import back

Capturing these as user stories to drive a later phase (likely v1.1 or v2.0 "Calendar & scheduling reconciliation") rather than losing the context once the milestone archives.

## Solution

### Guardian (primary user)

- **As a guardian**, I want the shifts I see on the Home grid to match the shifts that get billed to FK, **so that** I don't accidentally under-bill or over-bill because the grid and the invoice disagreed.
  - *Today:* Grid reads GCal, FK reads `entries`. Drift is silent.

- **As a guardian**, I want a shift I create in the app to appear in Google Calendar automatically, **so that** I don't have to maintain two schedules.
  - *Today:* `POST /api/entries` writes only to the internal table. Only clock-out and the deleted legacy Calendar.tsx ever pushed to GCal. `POST /api/gcal/events` exists but is orphan.

- **As a guardian**, I want a shift I create in Google Calendar (from a phone on the go, for example) to import into the app and count toward billing, **so that** scheduling works the way I already work.
  - *Today:* No inbound sync path exists. GCal events appear on the Home grid (after this session's change) but they never land in `entries`, so FK / payroll ignore them.

- **As a guardian**, when I invite an assistant, I want one action to produce one assistant record, **so that** I never see duplicates in Settings or the schedule grid.
  - *Today:* POST /api/invites creates an invite; POST /api/assistants creates an assistant; Settings.tsx "Convert invite" creates another. Three paths produced two Mikael rows during v1.0 testing. Partial mitigation landed (accept-invite now auto-creates the assistants row), but the creation-on-invite side still isn't atomic.

- **As a guardian**, when an assistant has multiple shifts on the same day (early + evening), I want to see both in the grid cell, **so that** the schedule isn't misleadingly half-empty.
  - *Today:* Fixed this session (flex-col stack per cell). Keep as regression-check requirement.

- **As a guardian**, when I look at the week's Sunday column, I want to see Sunday's shifts, **so that** I don't miss the start of the next work pattern.
  - *Today:* Fixed this session (server end-date was exclusive at midnight UTC). Keep as regression-check requirement.

- **As a guardian**, I want the schedule to display in Stockholm time regardless of which calendar I connected, **so that** times I read in the app match local working hours.
  - *Today:* GCal events carry `Europe/Madrid` tz label (guardian's calendar default). Same UTC offset as Stockholm in April but label is wrong; edge-case around DST transitions.

### Assistant

- **As an assistant**, when I accept my invite, I want to be able to clock in immediately, **so that** my first shift isn't blocked by an admin step.
  - *Today:* Fixed in this session. accept-invite now creates the assistants row + active `assistantGuardianLinks` in one transaction.

- **As an assistant**, I want shifts I'm scheduled for in Google Calendar to show on my dashboard, **so that** I know when to turn up without switching apps.
  - *Today:* Assistant dashboard reads from entries; doesn't read GCal. Same drift story as guardian view, mirrored.

### Operator / developer

- **As a developer maintaining this system**, I want a single code path that creates the (assistants, auth, guardianLink, invite) tuple for a new assistant, **so that** edge cases like "invite accepted but no assistants row" can't happen.
  - *Today:* 3 creation paths in Settings.tsx; accept-invite handler now defensively creates missing rows.

- **As a developer**, I want every outbound GCal event to be traceable back to the internal entry that caused it (and vice versa), **so that** I can diagnose drift and build a reconciliation tool.
  - *Today:* `entries.gcal_event_id` column exists but only clock-out populates it; most GCal events have no counterpart.

- **As a developer**, I want the `/api/gcal/events` endpoint to honour inclusive date ranges, **so that** client code doesn't have to hack around it.
  - *Today:* Fixed this session (advance end by one day before sending as timeMax).

### Out of scope (captured to explicitly defer)

- Reconciliation UI ("show me shifts that exist in GCal but not in entries, and vice versa; let me pick which wins")
- Multi-calendar support (guardian has multiple Google calendars, wants some synced and some not)
- Assistant-per-calendar routing (different assistants' shifts live in different Google calendars)
- Conflict resolution when a shift is edited in both sources between syncs

## Proposed scope for v1.x phase

Minimum to close drift:
1. Make `POST /api/entries` push to GCal atomically (create event, store `gcal_event_id`, rollback on failure)
2. Make `PUT /api/entries/:id` update the corresponding GCal event
3. Make `DELETE /api/entries/:id` delete the corresponding GCal event
4. Add a one-shot `POST /api/gcal/import` that creates `entries` rows for every GCal event that doesn't already have one (catches legacy + external-creation cases)
5. Atomic invite creation: `POST /api/invites` creates matching `assistants` row with `inviteStatus: "invited"`

Anything beyond = v2.0 concern.
