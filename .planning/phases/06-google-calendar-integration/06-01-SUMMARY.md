---
phase: 06-google-calendar-integration
plan: 01
subsystem: api, ui
tags: [google-oauth2, react-query, settings, calendar, express]

# Dependency graph
requires:
  - phase: 03.5-ux-consolidation-ia-redesign
    provides: Settings.tsx with GCal card placeholder and simulated connect flow

provides:
  - Real Google OAuth2 connect flow (full browser redirect to accounts.google.com)
  - GET /api/gcal/calendars endpoint returning guardian's actual calendar list
  - Dynamic calendar picker in Settings populated from Google Calendar API
  - Callback redirect corrected from /calendar to /settings
  - API-backed disconnect clearing all token fields
  - gcalEventId stored on entries after calendar sync
  - Auth guard on /api/gcal/connect endpoint

affects: [phase-07, any future calendar sync work, Settings.tsx]

# Tech stack
tech-stack:
  added: []
  patterns: [OAuth2 server-side token exchange, React Query enabled query (gcal-calendars), auto-save on select onValueChange]

key-files:
  created:
    - server/src/routes/__tests__/gcal.test.ts
  modified:
    - server/src/routes/gcal.ts
    - client/src/lib/api.ts
    - client/src/pages/Settings.tsx

key-decisions:
  - "Callback redirect fixed from /calendar to /settings — OAuth flow now returns guardian to correct page"
  - "Calendar picker populated dynamically from /api/gcal/calendars — not hardcoded options"
  - "Calendar selection auto-saves via settingsApi.update on onValueChange — no explicit Save button needed"
  - "useSearchParams detects gcal_connected=true on return from Google, invalidates settings cache, strips param"
  - "Email shown as Connected as is Google account email from backend — not portal login email"

patterns-established:
  - "enabled: gcal.connected — conditional React Query fetch pattern; query only fires when connection state is true"
  - "Auto-save on picker selection: onValueChange triggers both local state update and API call inline"

requirements-completed:
  - GCAL-01

# Metrics
duration: 90min
completed: 2026-04-12
---

# Phase 06: Google Calendar Integration Summary

**Real OAuth2 connect flow replacing the simulated placeholder — guardian can now connect their actual Google Calendar, see real calendar names in a dynamic picker, and disconnect cleanly**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-04-12
- **Completed:** 2026-04-12
- **Tasks:** 3 (server fix + client wiring + human verification)
- **Files modified:** 4

## Accomplishments

- Fixed callback redirect bug (`/calendar` → `/settings?gcal_connected=true`) so OAuth flow returns guardian to the right page
- Added `GET /api/gcal/calendars` endpoint with `requireAuth` + `requireGuardian`, returns real calendar list from Google Calendar API
- Replaced `simulateConnect()` with real `window.location.href` redirect to Google OAuth consent screen
- Calendar picker in Settings now populated dynamically from guardian's actual Google calendars — no hardcoded options
- Calendar selection auto-saves to DB on change (no Save button required)
- `useSearchParams` detects OAuth callback, invalidates settings cache, and strips the URL param in same render cycle
- Disconnect calls `POST /api/gcal/disconnect`, clears connected state and calendar cache
- Unit tests added for all gcal route behaviors

## Task Commits

1. **Task 1: Server — redirect fix + /calendars endpoint + unit tests** — `6267bb7`, `f14264c`, `34344be` (feat/test)
2. **Task 2: Client — gcalApi.calendars() + Settings.tsx real OAuth wiring** — `4a49303`, `d7663cb` (feat)
3. **Task 3: Human verification checkpoint** — manual OAuth flow verified against real Google account

**Phase metadata:** `54b4607` (docs: phase plan), `e7a1af1` (test: E2E tests added)

## Files Created/Modified

- `server/src/routes/gcal.ts` — Callback redirect fixed; `GET /calendars` endpoint added; auth guard on `/connect`
- `server/src/routes/__tests__/gcal.test.ts` — Unit tests for calendars endpoint, callback redirect, disconnect behavior
- `client/src/lib/api.ts` — `gcalApi.calendars()` method added
- `client/src/pages/Settings.tsx` — `simulateConnect` removed; real OAuth redirect; `useSearchParams` callback detection; dynamic calendar picker; API-backed disconnect; `gcal-calendars` React Query

## Decisions Made

- Used invite `id` (crypto-random newId) as OAuth callback token — no separate token field needed in schema
- `enabled: gcal.connected` prevents the calendars query from firing when not connected, avoiding unnecessary 401s
- Auto-save on calendar selection keeps UX frictionless — guardian picks a calendar and it persists immediately

## Deviations from Plan

### Auto-fixed Issues

**1. Auth guard missing on /connect endpoint**
- **Found during:** Task 1 (server review)
- **Issue:** `GET /api/gcal/connect` had no `requireAuth` — unauthenticated users could initiate OAuth flow
- **Fix:** Added `requireAuth` to `/connect` route
- **Files modified:** server/src/routes/gcal.ts
- **Verification:** Test confirms 401 for unauthenticated requests
- **Committed in:** `34344be`

---

**Total deviations:** 1 auto-fixed (missing auth guard)
**Impact on plan:** Security fix — no scope creep.

## Issues Encountered

- Pre-existing TypeScript errors in `gcal.ts` (lines 184) related to googleapis type signatures — not introduced by this phase, left for a future cleanup pass

## User Setup Required

Google OAuth2 credentials must be configured in `server/.env`:
- `GOOGLE_CLIENT_ID` — from Google Cloud Console → OAuth 2.0 Client ID
- `GOOGLE_CLIENT_SECRET` — from Google Cloud Console → OAuth 2.0 Client Secret
- `GOOGLE_REDIRECT_URI=http://localhost:3001/api/gcal/callback`
- `CLIENT_URL=http://localhost:5173`

Google Cloud Console steps:
1. Enable Google Calendar API
2. Create OAuth 2.0 Client ID (Web application)
3. Add `http://localhost:3001/api/gcal/callback` as authorized redirect URI
4. Add test user email if consent screen is External

## Next Phase Readiness

- Phase 6 (Google Calendar Integration) is complete — GCAL-01 delivered
- UAT session identified 7 bugs across the platform logged in `.planning/UAT-BUG-LOG.md`
- Critical bugs (BUG-003, 006, 007) block core user workflow and should be addressed before Phase 5
- BUG-006 partially resolved: Home.tsx now has shift creation UI (+ button on empty day cells)
- Recommended next action: create a bug-fix phase to resolve all 7 UAT bugs before Phase 5 planning

---
*Phase: 06-google-calendar-integration*
*Completed: 2026-04-12*
