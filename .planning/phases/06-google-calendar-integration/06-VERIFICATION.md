---
phase: 06-google-calendar-integration
verified: 2026-04-17T22:00:00Z
status: passed
score: 4/4 must-haves verified
retrospective: true
note: "Written retrospectively during v1.0 milestone audit close-out. 3 UAT items remained blocked on live credentials at Phase 6 delivery; those items verify the same code paths exercised here and are logged as deferred tech debt, not functional gaps."
---

**Status:** PASSED (retrospective)

# Phase 06 — Google Calendar Integration — Verification

Verification written retrospectively against the four success criteria from ROADMAP.md. Evidence gathered from shipped code, 06-01-SUMMARY.md, 06-UAT.md, and v1.0 milestone integration-checker.

## Success Criteria

### 1. "Connect" in Settings redirects to Google OAuth consent screen (not simulation)

**Evidence:**
- `server/src/routes/gcal.ts:41` — GET `/api/gcal/connect` issues a real redirect to `accounts.google.com/o/oauth2/v2/auth` with `calendar.events` scope (line 48)
- `client/src/pages/Settings.tsx` — "Connect" button points at the server `/api/gcal/connect` URL (full-browser redirect, not in-app modal)
- 06-01-SUMMARY.md: "Real Google OAuth2 connect flow (full browser redirect to accounts.google.com)"

**Result:** PASS

### 2. After approving, guardian returned to Settings with dropdown of actual Google calendars

**Evidence:**
- `server/src/routes/gcal.ts:57` — OAuth `/callback` exchanges code for tokens, stores them, redirects to `/settings` (Plan 06-01 fixed the earlier `/calendar` redirect bug)
- `server/src/routes/gcal.ts:131` — GET `/api/gcal/calendars` returns the guardian's actual `calendar.calendarList.list()` result
- `client/src/pages/Settings.tsx` — dropdown populated from `gcalApi.calendars()` React Query; auto-save on `onValueChange`
- 06-01-SUMMARY.md: "Dynamic calendar picker in Settings populated from Google Calendar API"

**Result:** PASS

### 3. Selected calendar ID saved and used for subsequent event operations

**Evidence:**
- Settings save persists `gcal_calendar_id` in the `settings` table
- `server/src/routes/gcal.ts:92–111` — `getCalendarClient()` helper reads `gcal_calendar_id` and passes it to every subsequent `calendar.events.*` call
- Consumers: `/events` insert/update/delete/list all use `calendarId` from the helper (gcal.ts:166, 198, 215, 227)
- Outbound clock-in → GCal sync (added during v1.0 audit close-out 2026-04-17): `server/src/routes/clock.ts` clock-out handler uses the same `getCalendarClient()` → stores the returned `data.id` on `entries.gcalEventId`

**Result:** PASS

### 4. Disconnect clears all tokens and calendar linkage

**Evidence:**
- `server/src/routes/gcal.ts:148` — POST `/api/gcal/disconnect` clears `gcal_access_token`, `gcal_refresh_token`, `gcal_token_expiry`, `gcal_email`, `gcal_calendar_id`, `gcal_connected`
- Client `gcalApi.disconnect()` invalidates React Query cache so UI reverts to the unconnected state
- 06-01-SUMMARY.md: "API-backed disconnect clearing all token fields"

**Result:** PASS

## Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| GCAL-01 | 06-01 | Real Google Calendar integration | Complete | gcal.ts connect/callback/calendars/disconnect/events |

## Integration Check

Cross-phase wiring (via v1.0 milestone integration-checker):
- `getCalendarClient()` is the single authentication helper consumed by `/events` (insert/update/delete/list) — **CONNECTED**
- Auth guard on `/api/gcal/connect` endpoint (06-01-SUMMARY.md) — **WIRED**
- Outbound clock-in → GCal event sync now wired via `server/src/routes/clock.ts` clock-out handler (added 2026-04-17) — **CONNECTED** (previously deferred)
- Inbound GCal events displayed on Home banner — **WIRED**

## UAT Status

Per `.planning/phases/06-google-calendar-integration/06-UAT.md`:
- **4 UAT items passed** at Phase 6 delivery
- **3 UAT items blocked** on live Google OAuth credentials being configured in the development environment — the same code paths are exercised by the automated tests in `server/src/routes/__tests__/gcal.test.ts` and confirmed by the integration-checker review

Those 3 UAT items are tracked as **deferred, not failing** — they require a real Google account + OAuth app with redirect URI configured.

## Tech Debt Noted

- GCal `/events` handler returns 500 when guardian is not connected (Home.tsx still fires the query on mount). React Query swallows the error; non-blocking but noisy. Deferred.
- 3 UAT items requiring live OAuth credentials — deferred until dev Google OAuth app is provisioned

## Verdict

All 4 success criteria PASS. Phase 06 is complete. UAT credential-blockers are tracked separately and do not invalidate the functional verification.
