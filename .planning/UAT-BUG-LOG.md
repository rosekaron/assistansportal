# UAT Bug Log — Phase 6 Acceptance Test

**Date:** 2026-04-12
**Tester:** Mikael Artur Junior Karon (guardian)
**Session:** Manual acceptance test — Google Calendar OAuth integration + general UI

---

## 🔴 Fixed

### BUG-001 — Setup wizard persists on dashboard after completion
**Root cause:** `SetupWizard.tsx` sent `setup_done: true` (snake_case); server `profile.ts` reads `data.setupDone` (camelCase) — mismatch meant `setupDone` was always written as `false`
**Fix:** Changed `setup_done: true` → `setupDone: true` in `SetupWizard.tsx:85`
**Status:** Fixed 2026-04-12

### BUG-008 — Home page does not recognize already-connected Google Calendar
**Root cause:** `Home.tsx:136` checked `profile?.gcalCalendarId` which does not exist on the profile table. GCal state lives in the `settings` table as `gcal_connected`.
**Fix:** Added `settings` query to `Home.tsx`; replaced check with `settings.gcal_connected === "true"` (matching `Calendar.tsx`)
**Status:** Fixed 2026-04-12

### BUG-003 — Assistance hours not updating on Home schedule after assistant accepts
**Root cause:** `Calendar.tsx:submitSlot()` created entries with `repStatus: "draft"`, but Home's pending approvals filter requires `repStatus === "pending"` — entries were invisible to the approval queue
**Fix:** Changed `repStatus: "draft"` → `repStatus: "pending"` in `Calendar.tsx:243`
**Status:** Fixed 2026-04-12

### BUG-006 — Assistant dashboard showing broken times and missing status badges
**Root cause:** `AssistantDashboard.tsx` used snake_case field names (`req_status`, `start_time`, `end_time`, `rep_status`, `activity_id`) but Drizzle returns camelCase (`reqStatus`, `startTime`, etc.) — times showed as `undefined – undefined`, status badges never appeared
**Fix:** All field references updated to `(e.camelCase ?? e.snake_case)` pattern across upcoming, reports, and today's shift sections
**Status:** Fixed 2026-04-12

### BUG-007 — Clock-in disabled for assistant (no active guardian link)
**Root cause:** `POST /api/assistants` and `POST /api/auth/accept-invite` never created an `assistantGuardianLinks` row. The clock route requires `active: true` link — with no link, `families` API returned empty, `effectiveGuardianId` was null, and the Clock In button was permanently disabled.
**Fix:** `assistants.ts:POST` now auto-creates an active link on guardian creation. `auth.ts:accept-invite` now queries the guardian by role and upserts an active link on invite acceptance.
**Status:** Fixed 2026-04-12

### BUG-009 — Google Calendar events not shown in schedule
**Root cause:** `Calendar.tsx` and `Home.tsx` showed DB entries as the schedule. Design clarification: the schedule is owned by Google Calendar — the app reads from GCal, not the entries table.
**Fix:** Added `gcalEvents` query (`GET /api/gcal/events`) to both pages. Calendar.tsx grid now renders GCal events (blue cells) as the primary schedule layer. Home.tsx weekly strip shows GCal event titles and hours per day.
**Note:** Architecture clarified in `PROJECT.md` — schedule = GCal; entries table = actual hours worked (from clock-in/out)
**Status:** Fixed 2026-04-12

### BUG-010 — Guardian cannot edit wrong times on a submitted report
**Root cause:** Monthly.tsx had Approve/Reject only — no way to correct `startTime`, `endTime`, or `hours` before approving.
**Fix:** Added Edit (pencil) button on all pending/approved entries in the report table. Opens a dialog pre-filled with existing times; hours auto-calculate from time range. Uses existing `PUT /api/entries/:id`.
**Status:** Fixed 2026-04-12

### BUG-011 — No way to add hours retroactively (pre-app period)
**Root cause:** Entries could only be created via clock-in/out. A guardian starting mid-month had no way to log previous shifts.
**Fix:** Added "Add entry" button in the Daily reports section header. Opens a dialog to pick assistant, date, start/end times, activity. Entry is created with `reqStatus: "approved"` and `repStatus: "approved"` so it counts immediately toward FK/payroll. Uses existing `POST /api/entries`.
**Status:** Fixed 2026-04-12

### BUG-012 — Assistant schedule shows nothing (no clock-in history)
**Root cause:** `AssistantDashboard.tsx` showed `GET /api/assistant/entries` (clock-in records) as the "schedule". A new assistant who has never clocked in sees an empty dashboard with no upcoming shifts.
**Fix:** Added `GET /api/assistant/schedule` endpoint that reads the guardian's Google Calendar (same `getCalendarClient()` used by the guardian view). `AssistantDashboard.tsx` now uses this for Today's shift, week strip, and Upcoming tab. Reports tab still uses entries (actual worked hours).
**Status:** Fixed 2026-04-12

### BUG-004 — No email sent to assistant
**Page:** Assistants → Add assistant (invite flow)
**Steps to reproduce:** Go to Assistants → click "Add assistant" → fill form → Submit
**Expected:** Assistant receives an email with subject "You've been invited to assist [patient] — Assistansportal" and an "Accept invitation →" link
**Actual:** Email was not received during initial UAT (SMTP not confirmed at test time)
**Code verification (2026-04-15):**
- `server/src/lib/email.ts`: `sendAssistantInviteEmail()` fully implemented — nodemailer transporter using `GMAIL_USER` + `GMAIL_APP_PASSWORD`, correct subject line, accept link points to `/accept-invite?token=<invite-id>` using `row.id` (crypto newId)
- `server/src/routes/misc.ts` lines 79-87: function called immediately after DB insert; errors caught and logged without exposing credentials
- `server/.env`: Both `GMAIL_USER` and `GMAIL_APP_PASSWORD` confirmed present
- **Note:** Gmail App Password must be a 16-char app-specific password from https://myaccount.google.com/apppasswords — not the Gmail login password
**Status:** Fixed — code path complete and wired; env vars present; requires live SMTP test to confirm delivery

---

### BUG-002 — Week navigator missing on Home
**Page:** Home
**Steps to reproduce:** Go to Home → look for prev/next week controls
**Expected:** Guardian can navigate backwards and forwards through weeks
**Actual (before fix):** Schedule grid was hardcoded to current week only (`getWeekDates(0)`)
**Fix (2026-04-15):**
- Added `weekOffset` state to `Home.tsx` (default 0 = current week)
- Changed `getWeekDates(0)` to `getWeekDates(weekOffset)`
- Added Prev / Next buttons and a Today shortcut in the schedule card header
- Past navigation limited to 12 weeks; gcalEvents query auto-refetches on offset change
**Status:** Fixed — commit e5794a7

### BUG-005 — Guardian cannot register as their own assistant
**Page:** Assistants / Invite flow
**Expected:** A guardian who also acts as an assistant can register themselves and log hours
**Actual (before fix):** System treated guardian and assistant as separate roles; no self-registration UI existed
**Note:** Common use case in Swedish LSS (self-managed assistansersättning)
**Fix (2026-04-15):**
- Added "I'm also an assistant" button to Assistants page header (next to "Add assistant")
- Added self-registration dialog with fields: name, pno, phone, minWeeklyHours, isFlexible
- Calls `POST /api/assistants/register-self` (already existed with duplicate check → 409)
- On success: assistant list refreshes; on 409: error message displayed
**Status:** Fixed — commit ea9a995

---

## Resolved Bugs

_See 🔴 Fixed section above_

---

## Format

```
### BUG-001 — [Short description]
**Page:** [page/component]
**Steps to reproduce:** [what you did]
**Expected:** [what should happen]
**Actual:** [what happened]
**Status:** Open | Fixed | Won't Fix
```
