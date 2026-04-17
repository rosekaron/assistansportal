---
phase: 05-scheduling-compliance-workflow
plan: "04"
subsystem: api
tags: [node-cron, nodemailer, email, cron, settings, compliance]

# Dependency graph
requires:
  - phase: 05-scheduling-compliance-workflow
    provides: TDD scaffolding with 8 RED reminderCron tests (05-01), schedule table (05-02), compliance deadline badges (05-03)
provides:
  - Monthly compliance reminder cron job firing at 08:00 on configured day (Europe/Stockholm)
  - sendComplianceReminderEmail function in email.ts with inline HTML template
  - startReminderCron() wired into server main() after seedDefaults()
  - Server-side validation for reminder_day (1–28) in PUT /api/settings
  - Settings.tsx Notifications card with number input, save feedback, and inline validation
affects: [future-email-features, settings-expansions, compliance-reporting]

# Tech tracking
tech-stack:
  added: [node-cron]
  patterns:
    - Pure-function cron logic (shouldSendReminder, buildPendingSteps) separated from I/O for testability
    - Inline HTML email template pattern (consistent with existing email.ts functions)
    - Settings key-value table used for runtime-configurable cron parameters

key-files:
  created: []
  modified:
    - server/src/lib/reminderCron.ts
    - server/src/lib/email.ts
    - server/src/index.ts
    - server/src/routes/misc.ts
    - client/src/pages/Settings.tsx

key-decisions:
  - "reminder_day capped at 28 (not 31) to avoid month-length edge cases on short months"
  - "guardian email logged only as absent indicator — full address never written to console (T-5-04-02)"
  - "FK/AGI generation treated as pending when payroll is not fully approved (no download log table exists)"

patterns-established:
  - "Cron pure functions: separate shouldSendReminder/buildPendingSteps from startReminderCron for unit testability without DB"
  - "Settings validation: server validates reminder_day before DB write loop in misc.ts PUT /api/settings"
  - "2-second saved feedback: setSaved(true) + setTimeout(() => setSaved(false), 2000) replicated for Notifications card"

requirements-completed: [COMP-02]

# Metrics
duration: ~45min
completed: 2026-04-17
---

# Phase 05 Plan 04: Email Reminder System Summary

**Node-cron compliance reminder job with sendComplianceReminderEmail, server-side reminder_day validation, and Settings Notifications card — COMP-02 delivered end-to-end**

## Performance

- **Duration:** ~45 min
- **Started:** 2026-04-17
- **Completed:** 2026-04-17
- **Tasks:** 2 auto + 1 checkpoint (human-verify, approved)
- **Files modified:** 5

## Accomplishments

- Implemented `shouldSendReminder` and `buildPendingSteps` pure functions in reminderCron.ts, turning all 8 RED TDD tests GREEN
- Added `sendComplianceReminderEmail` to email.ts following the existing inline HTML transporter pattern; wired `startReminderCron()` into server `main()` after `seedDefaults()`
- Delivered Settings.tsx Notifications card with reminder day number input (min=1, max=28), 2-second "Saved" feedback, and client + server validation for out-of-range values

## Task Commits

Each task was committed atomically:

1. **Task 1: reminderCron.ts pure functions + sendComplianceReminderEmail** - `1439e14` (feat)
2. **Task 2: Wire cron into server startup, reminder_day validation, Notifications card** - `c93c057` (feat)

## Files Created/Modified

- `server/src/lib/reminderCron.ts` - Pure functions shouldSendReminder/buildPendingSteps + startReminderCron() cron job
- `server/src/lib/email.ts` - Added sendComplianceReminderEmail with inline HTML template
- `server/src/index.ts` - startReminderCron() called inside main() after seedDefaults()
- `server/src/routes/misc.ts` - reminder_day server-side validation (1–28) in PUT /api/settings
- `client/src/pages/Settings.tsx` - Notifications card with reminderDay state, number input, save button, feedback

## Decisions Made

- reminder_day range is 1–28 (not 1–31) to avoid firing skips on months with fewer than 31 days — simplest guard with minimal user impact.
- Guardian email is never logged in full; only the absence signal `"[cron] guardian_email not configured"` is written to console (T-5-04-02 information disclosure mitigation).
- FK/AGI generation status is proxied from payroll approval state because no download-log table exists in the schema; documented as a known approximation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

**External services require manual configuration.** Gmail SMTP credentials must be set before compliance reminder emails will send:

- `GMAIL_USER` — Gmail account address (use an app password, not the account password)
- `GMAIL_APP_PASSWORD` — From Gmail → Manage Google Account → Security → 2-Step Verification → App Passwords
- `CLIENT_URL` — Set to `http://localhost:5173` for development; production domain for production

Without these env vars the cron job will run but `transporter.sendMail` will fail silently (error caught and logged as `[cron] Reminder cron failed`).

## Next Phase Readiness

- COMP-02 fully delivered: cron runs at 08:00 Europe/Stockholm on the configured day, reads reminder_day from settings table, emails guardian with pending compliance steps
- Phase 05 complete: SCHED-01 (schedule table), COMP-01 (deadline badges), and COMP-02 (reminder email) all GREEN and human-verified
- Ready for Phase 06 (Google Calendar integration) or any phase that builds on the compliance workflow

---
*Phase: 05-scheduling-compliance-workflow*
*Completed: 2026-04-17*
