# Phase 5: Scheduling & Compliance Workflow - Context

**Gathered:** 2026-04-12
**Status:** Ready for planning

<domain>
## Phase Boundary

Guardian has a unified view of all assistants' shifts, a monthly compliance checklist with regulatory due dates, and automated email reminders. This phase delivers SCHED-01, COMP-01, COMP-02.

</domain>

<decisions>
## Implementation Decisions

### Schedule Grid (SCHED-01)
- **D-01:** Assistant-row table layout — rows = assistants, columns = days (Mon–Sun). Each cell shows shift time range and hours. Daily totals in a footer row. Weekly summary bar below.
- **D-02:** Week view only — week navigation with Prev/Next/Today buttons. No month view.
- **D-03:** Upgrade the existing Home.tsx weekly strip in place — replace the current day-card strip with the assistant-row table. No new route. Home = dashboard + schedule.
- **D-04:** Color-coded dots per assistant (consistent with existing AssistantAvatar color convention).
- **D-05:** Keep the existing 4-route IA unchanged (Home / Monthly / Records / Settings).

### Compliance Checklist (COMP-01)
- **D-06:** Enhance the existing Monthly.tsx 4-step stepper with due date badges and completion status indicators. No new page or route.
- **D-07:** Due dates displayed per step: FK deadline = 5th of second following month; AGI deadline = 12th of following month. Show "X days left" countdown badges.
- **D-08:** Steps show green checkmark when complete, amber warning when approaching deadline, red alert when overdue.

### Email Reminders (COMP-02)
- **D-09:** Add a "reminder day" setting in Settings.tsx — guardian picks which day of the month to receive the compliance reminder (default: 1st).
- **D-10:** Server-side cron job checks daily; on the guardian's configured day, sends email via existing nodemailer/Gmail infrastructure.
- **D-11:** Email contains: month being reported, list of pending steps (which forms are not yet generated), and a direct link to `/monthly`.
- **D-12:** Store `reminder_day` in the existing settings/guardian_profiles table.

### Claude's Discretion
- Exact table styling (follows existing design system tokens)
- Loading and empty states for the schedule table
- Email HTML template design (follow existing email patterns in server/src/lib/email.ts)
- Cron implementation details (node-cron or similar)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Schedule grid
- `client/src/pages/Home.tsx` — Current weekly strip to be replaced with assistant-row table
- `client/src/lib/api.ts` — entriesApi, assistantsApi data fetching patterns
- `client/src/lib/utils.ts` — getWeekDates() helper already exists for week navigation

### Compliance stepper
- `client/src/pages/Monthly.tsx` — Existing 4-step ProgressStepper component (lines 80–138) to enhance with due dates
- `.planning/REQUIREMENTS.md` §Compliance Workflow — COMP-01 acceptance criteria and FK/AGI deadlines

### Email reminders
- `server/src/lib/email.ts` — Existing nodemailer setup, email template patterns (sendVerificationEmail, sendAssistantInviteEmail)
- `server/src/db/schema.ts` — Guardian settings/profile storage for reminder_day field

### Navigation / IA
- `client/src/App.tsx` — Route definitions (4 guardian routes, legacy redirects)
- `client/src/pages/Home.tsx` — Layout integration point

No external specs — requirements are fully captured in decisions above and REQUIREMENTS.md.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getWeekDates(offset)` in utils.ts — returns array of 7 date strings for the week; used on Home and Calendar
- `AssistantAvatar` component with color assignment — reuse for color dots in schedule table
- `ProgressStepper` component in Monthly.tsx — enhance in place rather than rebuild
- `nodemailer` transporter in email.ts — pre-configured Gmail transport with HTML templates
- `entriesApi.list()` — already fetches all time entries; filter by week for schedule grid
- `payrollApi.list(month)` — used to determine payroll step completion status

### Established Patterns
- React Query for all data fetching with queryKey invalidation
- Tailwind CSS utility classes for all styling (design system tokens in index.css)
- sv-SE Intl.NumberFormat for SEK display
- lucide-react icons throughout

### Integration Points
- Home.tsx line 66–151: Replace the `byDay` computed section and day-card rendering with assistant-row table
- Monthly.tsx ProgressStepper: Add due date sublabel props and color-coded status badges
- Settings.tsx: Add reminder day setting (follows existing field pattern)
- server/src/routes/index.ts: Register new reminder cron route or background job
- server/src/db/schema.ts: Add `reminderDay` column to guardian settings

</code_context>

<specifics>
## Specific Ideas

- User explicitly chose assistant-row table over time-row grid (Google Calendar style) and day cards — prefers compact, scannable format
- User confirmed upgrade-in-place on Home rather than adding a 5th route — consistent with Phase 3.5 "one page per purpose" IA principle
- Week-only view confirmed — guardians plan week by week, month view adds complexity with little value

</specifics>

<deferred>
## Deferred Ideas

- Month calendar view — could be added as a toggle in a future phase if guardians request it
- Copy-previous-week schedule shortcut (SCHED-02, v2 requirement) — explicitly deferred per REQUIREMENTS.md
- Bulk absence entry (SCHED-03, v2) — deferred

</deferred>

---

*Phase: 05-scheduling-compliance-workflow*
*Context gathered: 2026-04-12*
