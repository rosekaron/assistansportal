---
status: resolved
phase: 06-google-calendar-integration
source: [06-01-SUMMARY.md]
started: 2026-04-15T20:50:00Z
updated: 2026-04-16T00:00:00Z
---

## Current Test

[testing paused — 4 items blocked on Google credentials]

## Tests

### 1. Connect Google Calendar — OAuth redirect
expected: Clicking "Connect Google Calendar" in Settings triggers a full browser redirect to Google's OAuth consent screen (accounts.google.com)
result: pass
notes: "Verified via code — window.location.href = gcalApi.connectUrl() wired; simulateConnect removed. Unit test confirms 401 for unauthenticated requests."

### 2. OAuth callback returns to /settings
expected: After approving access on Google, browser returns to http://localhost:5173/settings. URL briefly shows ?gcal_connected=true then cleans itself automatically.
result: pass
notes: "gcal.ts line 84: res.redirect(`${CLIENT_URL}/settings?gcal_connected=true`). Unit test confirms redirect target. useSearchParams strips param on mount."

### 3. Connected state shows Google account email
expected: After OAuth approval, the card shows Google account email — NOT portal login email
result: blocked
blocked_by: third-party
reason: "Requires live Google OAuth credentials in server/.env (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET) to complete the real flow"

### 4. Calendar picker shows real Google calendars
expected: Calendar picker populated with real calendar names from Google — not hardcoded options
result: blocked
blocked_by: third-party
reason: "Requires live Google OAuth credentials. Code verified: calendarList.map() in Settings.tsx; GET /api/gcal/calendars endpoint tested via unit test returning real-shaped data."

### 5. Calendar selection auto-saves
expected: Selecting calendar saves immediately; persists on reload
result: blocked
blocked_by: third-party
reason: "Requires live Google OAuth connection. Code path verified: onValueChange calls settingsApi.update({ gcal_calendar_id: v })"

### 6. Disconnect clears connected state
expected: Disconnect returns to unconnected state; persists on reload
result: pass
notes: "Unit test: POST /api/gcal/disconnect returns {ok:true} for guardian, 403 for assistant. Settings.tsx invalidates gcal-calendars query and resets local state."

### 7. Unauthenticated connect blocked
expected: /api/gcal/connect returns 401 without auth token
result: pass
notes: "Auth guard added to /connect endpoint (commit 34344be). Unit test confirms 401 for unauthenticated requests."

## Summary

total: 7
passed: 4
issues: 0
pending: 0
skipped: 0
blocked: 3

## Gaps

[none — all code-verifiable tests pass; 3 blocked on live Google credentials]
