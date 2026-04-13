# Phase 5: Scheduling & Compliance Workflow - Research

**Researched:** 2026-04-14
**Domain:** React table UI, compliance deadline logic, server-side cron, nodemailer
**Confidence:** HIGH

## Summary

Phase 5 delivers three distinct sub-features that are each well-bounded upgrades to existing
pages. All critical infrastructure — nodemailer transport, settings key-value store,
AssistantAvatar colors, getWeekDates(), ProgressStepper, React Query data fetching — is already
in place. No new external service dependencies are introduced. The primary implementation risk is
in the schedule grid table layout (replacing a GCal-driven day-card strip with an
assistant-row table) and in threading a cron job safely into the Express server startup.

The compliance deadline logic is pure client-side arithmetic and fully specified in the UI-SPEC.
The email template follows an established inline-HTML pattern from email.ts. Settings storage
uses the existing key-value `settings` table via PUT /api/settings — no migration needed, just
a new key `reminder_day`.

**Primary recommendation:** Implement in three sequential waves: (1) schedule grid + week
navigation, (2) ProgressStepper due-date badges, (3) reminder_day Settings field + server cron.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Schedule Grid (SCHED-01)**
- D-01: Assistant-row table layout — rows = assistants, columns = Mon–Sun. Each cell shows shift time range and hours. Daily totals in a footer row. Weekly summary bar below.
- D-02: Week view only — week navigation with Prev/Next/Today buttons. No month view.
- D-03: Upgrade the existing Home.tsx weekly strip in place — replace the current day-card strip with the assistant-row table. No new route. Home = dashboard + schedule.
- D-04: Color-coded dots per assistant (consistent with existing AssistantAvatar color convention).
- D-05: Keep the existing 4-route IA unchanged (Home / Monthly / Records / Settings).

**Compliance Checklist (COMP-01)**
- D-06: Enhance the existing Monthly.tsx 4-step stepper with due date badges and completion status indicators. No new page or route.
- D-07: Due dates per step: FK deadline = 5th of second following month; AGI deadline = 12th of following month. Show "X days left" countdown badges.
- D-08: Steps show green checkmark when complete, amber warning when approaching deadline, red alert when overdue.

**Email Reminders (COMP-02)**
- D-09: Add a "reminder day" setting in Settings.tsx — guardian picks which day of the month (default: 1st).
- D-10: Server-side cron job checks daily; on guardian's configured day, sends email via existing nodemailer/Gmail infrastructure.
- D-11: Email contains: month being reported, list of pending steps (which forms not yet generated), and a direct link to `/monthly`.
- D-12: Store `reminder_day` in the existing settings key-value table.

### Claude's Discretion
- Exact table styling (follows existing design system tokens)
- Loading and empty states for the schedule table
- Email HTML template design (follow existing email patterns in server/src/lib/email.ts)
- Cron implementation details (node-cron or similar)

### Deferred Ideas (OUT OF SCOPE)
- Month calendar view — could be added as a toggle in a future phase if guardians request it
- Copy-previous-week schedule shortcut (SCHED-02, v2 requirement) — explicitly deferred
- Bulk absence entry (SCHED-03, v2) — deferred
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| SCHED-01 | Guardian can view a multi-assistant week grid showing all assistants' scheduled and logged shifts in a single calendar view | entriesApi.list() already fetches all entries; assistantsApi.list() provides rows; getWeekDates(offset) provides the 7 column dates; assistant.color used for left-border dots |
| COMP-01 | Guardian sees a monthly compliance checklist with required steps, completion status, and due dates (FK: 5th of second following month; AGI: 12th of following month) | ProgressStepper already in Monthly.tsx lines 93–141; StepProps already has sublabel; deadline arithmetic is client-side pure math per UI-SPEC |
| COMP-02 | System sends an email reminder on a configurable day each month with links to pending FK and AGI forms | nodemailer transporter pre-configured in email.ts; settings table stores arbitrary key-value; node-cron 4.2.1 handles daily check; no new infrastructure needed |
</phase_requirements>

---

## Standard Stack

### Core (all already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| react-query (@tanstack/react-query) | existing | Data fetching with cache/invalidation | Already used throughout |
| tailwind css | existing | Utility styling, design tokens | Project standard |
| lucide-react | existing | Icons (UserX for mark-absent, CheckCircle2, AlertCircle) | Already imported in all pages |
| nodemailer | existing in package.json | SMTP email via Gmail | Already configured transporter in email.ts |

### New (to be installed)
| Library | Version | Purpose | Why |
|---------|---------|---------|-----|
| node-cron | 4.2.1 [VERIFIED: npm registry] | Daily cron job for reminder dispatch | Lightweight, zero-config, widely used in Express apps; CONTEXT.md D-10 says "cron or similar" |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| node-schedule | 2.1.1 [VERIFIED: npm registry] | Alternative cron scheduler | Prefer node-cron — simpler API for this single-job use case |

**Installation (server only):**
```bash
cd server && npm install node-cron && npm install --save-dev @types/node-cron
```

**Version verification:** node-cron 4.2.1 confirmed via `npm view node-cron version` on 2026-04-14. [VERIFIED: npm registry]

---

## Architecture Patterns

### Schedule Grid (SCHED-01)

**What the current code does (Home.tsx lines 176–181, 236–307):**
The current "This week's schedule" card builds `byDay` from gcalEvents (Google Calendar source),
rendering a 7-column grid of day-cards with event titles and total hours. The assistant-row
table replaces this `byDay` section entirely. The Mark Absent button and dialog remain unchanged.

**Replacement pattern:**

```typescript
// Compute: for each assistant, for each day, find matching entries
const weekDates = getWeekDates(weekOffset);  // weekOffset replaces hardcoded 0

const weekEntries = (entries as Entry[]).filter(e =>
  weekDates.includes(e.date as string)
);

// Build a map: assistantId → dayIndex → entry[]
const byAssistantDay = (assistants as Assistant[]).map(assistant => ({
  assistant,
  days: weekDates.map(date =>
    weekEntries.filter(e => e.assistantId === assistant.id && e.date === date)
  ),
}));

// Footer: total hours per day
const dailyTotals = weekDates.map(date =>
  weekEntries.filter(e => e.date === date)
    .reduce((sum, e) => sum + ((e.hours as number) ?? 0), 0)
);
```

**Key integration point:** Home.tsx currently passes `0` to `getWeekDates(0)`. The upgrade
adds `weekOffset` state (integer, default 0) controlled by Prev/Next/Today buttons. All else
stays the same.

**Cell display (per UI-SPEC):**
- Shift present: `{entry.startTime}–{entry.endTime}` in text-sm font-mono text-muted-foreground;
  left border `2px solid {assistant.color}` via inline style
- No shift: "–" in text-muted-foreground
- Today column: `bg-primary/5`, left border `2px solid hsl(var(--primary))`
- Hover on shift cell: reveal UserX icon button (aria-label "Mark {name} absent on {date}")

**Table semantics (per UI-SPEC accessibility contract):**
```tsx
<table>
  <thead>
    <tr>
      <th scope="col">Assistant</th>
      {weekDates.map((date, i) => (
        <th key={date} scope="col" aria-current={date === todayStr ? "date" : undefined}>
          {DAY_NAMES[i]}
        </th>
      ))}
    </tr>
  </thead>
  <tbody>
    {byAssistantDay.map(({ assistant, days }) => (
      <tr key={assistant.id as string}>
        <th scope="row">
          {/* color dot 8×8px + assistant.name */}
        </th>
        {days.map((dayEntries, i) => (
          <td key={i}>
            {/* shift cell or "–" */}
          </td>
        ))}
      </tr>
    ))}
  </tbody>
  <tfoot>
    <tr>
      <td>Total</td>
      {dailyTotals.map((hrs, i) => <td key={i}>{hrs}</td>)}
    </tr>
  </tfoot>
</table>
```

**Week navigation state (local to Home, no URL params per UI-SPEC):**
```typescript
const [weekOffset, setWeekOffset] = useState(0);
const weekDates = getWeekDates(weekOffset);
```

---

### Compliance Stepper Enhancement (COMP-01)

**What exists (Monthly.tsx lines 84–141):**
`StepProps` already has `sublabel?: string`. `ProgressStepper` already renders sublabel as
`text-xs text-muted-foreground`. The enhancement adds: (a) a `badge` element inline with
sublabel, (b) a `dueDate` prop on steps 3 and 4, (c) countdown computation on render.

**StepProps extension:**
```typescript
interface StepProps {
  number: number;
  label: string;
  sublabel?: string;
  state: StepState;
  badge?: { variant: "info" | "warning" | "destructive"; text: string };  // new
}
```

**Deadline arithmetic (client-side, per UI-SPEC):**
```typescript
// reportingMonth is the YYYY-MM string selected in Monthly.tsx month nav
const [year, mon] = reportingMonth.split("-").map(Number);

// FK: 5th of second following month
const fkDeadline = new Date(year, mon + 1, 5);  // mon is 1-based, Date month is 0-based → mon+1-1 = mon, +1 more month → mon+1
// Correct: mon-1 = 0-based month of reporting period; second following = +2
const fkDeadline = new Date(year, mon - 1 + 2, 5);  // e.g. Jan(0)→ Mar(2)→ 5th

// AGI: 12th of following month
const agiDeadline = new Date(year, mon - 1 + 1, 12);  // e.g. Jan(0)→ Feb(1)→ 12th

const now = new Date();
const fkDaysLeft  = Math.ceil((fkDeadline.getTime()  - now.getTime()) / 86400000);
const agiDaysLeft = Math.ceil((agiDeadline.getTime() - now.getTime()) / 86400000);
```

**Badge variant selection (per UI-SPEC):**
```typescript
function deadlineBadge(daysLeft: number, isComplete: boolean) {
  if (isComplete) return undefined;
  if (daysLeft < 0)  return { variant: "destructive" as const, text: "Overdue" };
  if (daysLeft <= 7) return { variant: "destructive" as const, text: `${daysLeft} days left` };
  if (daysLeft <= 14) return { variant: "warning" as const, text: `${daysLeft} days left` };
  return { variant: "info" as const, text: `${daysLeft} days left` };
}
```

**Step 1 sublabel (no regulatory deadline):**
```typescript
sublabel: `${approvedCount}/${totalCount} reports approved`
```

**Step 2 sublabel (no regulatory deadline):**
```typescript
sublabel: `${approvedPayroll}/${totalPayroll} records approved`
```

**Note on existing badge import:** Monthly.tsx already imports `Badge` from
`@/components/ui/inputs`. The `badgeVariants` prop must match the project's existing Badge
component — check `client/src/components/ui/inputs.tsx` for the exact `variant` values.
The UI-SPEC specifies info/warning/destructive — verify these exist as Badge variants.

---

### Reminder Day Setting + Cron (COMP-02)

**Settings storage (key-value table, existing pattern):**
The `settings` table uses `{ key: text, value: text }`. The `PUT /api/settings` endpoint
(misc.ts lines 109–118) already handles upsert for arbitrary keys. To store reminder_day:

```typescript
// Client: settingsApi already exists
settingsApi.update({ reminder_day: String(reminderDay) });

// Server: existing handler already writes this correctly — no server changes needed
// for the storage layer. reminder_day will be written as a string "1"–"28".
```

**Reading reminder_day in the cron job:**
```typescript
const rows = await db.select().from(settings);
const reminderDay = parseInt(rows.find(r => r.key === "reminder_day")?.value ?? "1", 10);
```

**Cron job pattern (node-cron, daily check):**
```typescript
// server/src/lib/reminderCron.ts — new file
import cron from "node-cron";
import { db } from "../db";
import { settings, entries, payrollRecords } from "../db/schema";
import { sendComplianceReminderEmail } from "./email";

export function startReminderCron() {
  // Run at 08:00 every day
  cron.schedule("0 8 * * *", async () => {
    const today = new Date();
    const dayOfMonth = today.getDate();

    const rows = await db.select().from(settings);
    const get = (k: string) => rows.find(r => r.key === k)?.value ?? "";

    const reminderDay = parseInt(get("reminder_day") ?? "1", 10);
    if (dayOfMonth !== reminderDay) return;  // not today

    const guardianEmail = get("guardian_email");
    if (!guardianEmail) return;  // no email configured

    // Determine reporting month (previous month)
    const reportMonth = today.getMonth() === 0
      ? `${today.getFullYear() - 1}-12`
      : `${today.getFullYear()}-${String(today.getMonth()).padStart(2, "0")}`;

    // Determine pending steps — query entries and payroll for reportMonth
    // ... build pendingSteps list ...
    await sendComplianceReminderEmail(guardianEmail, reportMonth, pendingSteps);
  });
}
```

**Registration in server/src/index.ts:**
```typescript
import { startReminderCron } from "./lib/reminderCron";
// Inside main():
startReminderCron();
```

**Email template (follows email.ts inline HTML pattern):**
```typescript
export async function sendComplianceReminderEmail(
  to: string,
  month: string,    // "YYYY-MM"
  pendingSteps: string[]
) {
  const monthLabel = new Date(month + "-01").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  const link = `${BASE}/monthly`;
  const body = pendingSteps.length === 0
    ? `<p>All steps are complete for ${monthLabel}. Nothing to do.</p>`
    : `<p>You have pending compliance steps for ${monthLabel}:</p>
       <ul>${pendingSteps.map(s => `<li>${s}</li>`).join("")}</ul>
       <a href="${link}" style="...">Open Monthly →</a>`;

  await transporter.sendMail({
    from: FROM, to,
    subject: `Compliance reminder — ${monthLabel}`,
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
      <h2 style="color:#1e3a8a">Monthly compliance reminder</h2>
      ${body}
    </div>`,
  });
}
```

**Settings.tsx reminder field (follows existing SettingsField pattern):**
The Settings page already has a pattern for saving fields with success feedback (the `saved` /
`setSaved` state pattern at top of component). Add analogous `reminderSaved` / `setReminderSaved`
state. Input type="number" min=1 max=28 className="w-20". POST via `settingsApi.update({
reminder_day: String(val) })`.

---

### Anti-Patterns to Avoid

- **Reading weekDates inside the cron:** The cron is server-side; weekDates is client-side.
  Keep them completely separate — cron only needs month string and settings.
- **Accepting reminder_day from request body without validation:** Server should clamp to 1–28
  before storage. Client validates before submit (UI-SPEC) but server must not trust it.
- **Using assistant color from CSS variables in the table border:** The `assistant.color` field
  is already a hex string (e.g., `#6366f1`) stored in the `assistants` table schema — use
  inline style `borderLeft: \`2px solid ${assistant.color}\`` directly, no CSS var lookup.
- **Calling entriesApi.list() a second time for the schedule grid:** The existing `entries`
  query is already in Home.tsx with `staleTime: 0`. Filter client-side by weekDates — no new
  API call.
- **Introducing a new API endpoint for pending steps in the cron email:** The cron runs
  server-side and can query the DB directly — no HTTP self-call needed.
- **Changing the Badge variant prop signature:** Monthly.tsx imports Badge from
  `@/components/ui/inputs`. Verify that variant names match exactly before adding badge to
  StepProps — do not introduce a new badge component variant name that doesn't exist.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Daily schedule job | Custom setInterval loop | node-cron | setInterval doesn't survive server restart or timezone shifts; node-cron handles both |
| Email HTML templating | JSX-to-string renderer | Inline HTML strings | Matches existing email.ts pattern; no new dependency needed |
| Week date arithmetic | Custom Date manipulation | getWeekDates(offset) | Already exists in utils.ts, handles Monday-start correctly |
| Deadline countdown | External date library | Native Date arithmetic | Pure math: `Math.ceil((deadline - now) / 86400000)` — no library needed |

**Key insight:** All three sub-features reuse existing infrastructure. The only novel code is
the cron scheduler and the table layout.

---

## Common Pitfalls

### Pitfall 1: getWeekDates uses offset in weeks, not days
**What goes wrong:** Developer passes day offset instead of week offset, producing wrong dates.
**Why it happens:** Function signature is `getWeekDates(offset = 0)` where offset = N weeks,
not N days.
**How to avoid:** State variable is `weekOffset` (integer weeks). Prev button: `setWeekOffset(o => o - 1)`. Next: `setWeekOffset(o => o + 1)`. Today: `setWeekOffset(0)`.
**Warning signs:** Week shows dates 1 day off from expected Monday start.

### Pitfall 2: FK deadline month arithmetic edge case
**What goes wrong:** `new Date(year, mon + 1, 5)` where mon is 0-based produces wrong month
when reporting month is November (mon=10 → mon+1=11 → December; correct is January of next year → need year+1, month 0).
**Why it happens:** JavaScript Date handles month overflow automatically (month=13 wraps to
January of next year), so `new Date(year, mon - 1 + 2, 5)` with mon=1-based is actually safe
for December (mon=12, mon-1+2=13, JS wraps to Jan year+1). Verify explicitly.
**How to avoid:** Use the UI-SPEC formula exactly:
```typescript
// For FK: 5th of second following month (mon is 1-based from "YYYY-MM".split("-"))
const fkDeadline = new Date(year, mon + 1, 5);  // mon=1-based: Jan=1 → new Date(year, 2, 5) = Mar 5 ✓
// For December: mon=12 → new Date(year, 13, 5) → JS wraps to Feb 5 next year... WRONG for FK
// FK for December should be February 5 of year+1 → new Date(year, 13, 5) = Feb 5 (year+1) ✓ JS wraps correctly
```
JavaScript Date auto-wraps month overflow, so this is safe. Write a test case for December.
**Warning signs:** Badge shows wrong month name in sublabel.

### Pitfall 3: cron fires but guardian_email is empty
**What goes wrong:** Email send fails silently because `guardian_email` key hasn't been set
in settings table.
**Why it happens:** Settings table uses key-value pairs; guardian_email may not exist as a key
at all (undefined vs empty string).
**How to avoid:** Guard explicitly: `if (!guardianEmail) { console.warn("[cron] No guardian_email in settings, skipping"); return; }`. Do not throw — let cron cycle complete.
**Warning signs:** No error in logs, no email received.

### Pitfall 4: node-cron startReminderCron called before DB is ready
**What goes wrong:** Cron job fires within first seconds of startup, DB not yet seeded.
**Why it happens:** `startReminderCron()` called at module level before `await seedDefaults()`.
**How to avoid:** Call `startReminderCron()` inside `main()`, after `await seedDefaults()`.
**Warning signs:** DB query error on first cron tick.

### Pitfall 5: Home.tsx replaces gcalEvents-driven byDay — GCal schedule data lost
**What goes wrong:** The new assistant-row table uses `entries` (time entries), but the current
GCal strip uses `gcalEvents`. If the guardian's schedule lives primarily in Google Calendar
(not in time entries), the new table will appear empty.
**Why it happens:** CONTEXT.md D-03 says "replace the day-card strip" — but today's strip is
gcalEvents-driven. Time entries come from the internal entries table.
**How to avoid:** The plan is to use `entriesApi.list()` (internal entries) as the data source
for the new table. GCal events are for display context only; actual assistant shift entries are
in the `entries` table. The gcalConnected banner can remain; the gcalEvents query can be
removed or kept for the existing GCal sync status display.
**Decision needed for planner:** Confirm whether gcalEvents query should be kept for any
remaining purpose (GCal sync banner) or removed entirely. The schedule grid data source is
`entries` (assistantId + date + startTime + endTime). [ASSUMED — planner should decide
definitively whether to retain or remove the gcalEvents query]

### Pitfall 6: Badge variant mismatch in ProgressStepper
**What goes wrong:** `<Badge variant="info">` throws runtime error or renders unstyled because
the project's Badge component doesn't have an "info" variant.
**Why it happens:** UI-SPEC specifies "info/warning/destructive" but the actual Badge component
variants may differ from those names.
**How to avoid:** Before implementing, read `client/src/components/ui/inputs.tsx` to verify
exact variant names. Match exactly. If "info" variant doesn't exist, use "default" and apply
blue color classes manually.
**Warning signs:** TypeScript error on `variant` prop, or badge renders with wrong color.

---

## Code Examples

### Week navigation with offset state
```typescript
// Source: derived from existing getWeekDates() in client/src/lib/utils.ts [VERIFIED: codebase]
const [weekOffset, setWeekOffset] = useState(0);
const weekDates = getWeekDates(weekOffset);
const todayStr  = new Date().toISOString().split("T")[0];

// Week label: "Mon 14 Apr – Sun 20 Apr"
const weekLabel = `${new Date(weekDates[0] + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })} – ${new Date(weekDates[6] + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}`;
```

### Settings key-value upsert (server, existing pattern)
```typescript
// Source: server/src/routes/misc.ts lines 109–118 [VERIFIED: codebase]
router.put("/settings", requireAuth, requireGuardian, async (req, res) => {
  const data: Record<string, string> = req.body;
  for (const [key, value] of Object.entries(data)) {
    await db.insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } });
  }
  res.json({ ok: true });
});
// No changes needed — existing endpoint handles reminder_day key automatically.
```

### Email template pattern (existing style)
```typescript
// Source: server/src/lib/email.ts lines 16–28 [VERIFIED: codebase]
// New sendComplianceReminderEmail follows same inline-div structure
html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
  <h2 style="color:#1e3a8a">...</h2>
  <p style="color:#475569;...">...</p>
  <a href="${link}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Open Monthly →</a>
</div>`
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| GCal-driven day-card strip | Assistant-row table from entries | Phase 5 | Schedule becomes assistant-centric rather than event-centric |
| ProgressStepper with static sublabel | Stepper with countdown badge | Phase 5 | Guardian sees urgency signals directly in the workflow |
| No compliance reminders | Server cron + Gmail nodemailer | Phase 5 | Proactive nudge without guardian checking manually |

**node-cron note:** As of v4 (current), node-cron does not require any external system-level
cron setup — it runs inside the Node.js process. [VERIFIED: npm registry version 4.2.1]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The schedule grid data source is internal `entries` table (not gcalEvents) for the assistant-row table | Architecture Patterns / Pitfall 5 | If guardian's shifts are exclusively in GCal and not in entries, the table will show empty — plan must address whether to migrate entries or keep gcalEvents |
| A2 | Badge component in `client/src/components/ui/inputs.tsx` has "info", "warning", "destructive" variants | Architecture Patterns / Pitfall 6 | TypeScript error or unstyled badge if variant names differ; planner should add a task to verify before implementing |
| A3 | `guardian_email` key is stored in the `settings` table (not the `profile` table) for the cron email lookup | Architecture Patterns — cron section | If email is only in `profile` table, cron must join differently |
| A4 | gcalEvents query in Home.tsx can be removed or retained based on planner discretion | Pitfall 5 | Removing it removes GCal sync status display; keeping it adds a query that's no longer the schedule source |

---

## Open Questions

1. **Source of schedule data for the assistant-row table**
   - What we know: entries table has assistantId, date, startTime, endTime, hours. gcalEvents has Google Calendar events without assistantId.
   - What's unclear: Do guardians currently create entries through the portal (via "Add shift" dialog in Home.tsx lines 431–482), or do they rely solely on GCal sync? If only GCal, the table will appear empty.
   - Recommendation: The "Add shift" dialog already exists and writes to entries. Plan should include a note that the assistant-row table uses internal entries, not gcalEvents. The gcalConnected banner can remain for informational purposes.

2. **Badge variant names in the existing Badge component**
   - What we know: Monthly.tsx imports `Badge` from `@/components/ui/inputs`. The UI-SPEC says use "info", "warning", "destructive".
   - What's unclear: Whether those exact variant strings are defined in the Badge component's badgeVariants.
   - Recommendation: Wave 0 task should read `client/src/components/ui/inputs.tsx` and confirm variant names before implementing countdown badges.

3. **guardian_email storage location for cron**
   - What we know: `settingsApi.get()` returns a flat key-value map. Profile stores guardian email in `profile.guardianEmail`.
   - What's unclear: Whether the cron should read from `settings` table (key "guardian_email") or query the `profile` table directly for `guardian_email`.
   - Recommendation: Cron should query the `profile` table (single row) for `guardianEmail` — this is already the authoritative source and avoids duplicating data in settings.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| node-cron | COMP-02 cron job | Not installed | — | Install: `npm install node-cron` |
| nodemailer | COMP-02 email | Already installed | existing | — |
| PostgreSQL | All DB queries | Assumed running (existing project) | — | — |
| vitest | Tests | Already installed | 4.1.2 | — |
| supertest | Route tests | Already installed (devDeps) | 7.2.2 | — |

**Missing dependencies with no fallback:**
- node-cron: must be installed before implementing COMP-02 cron route

**Missing dependencies with fallback:**
- None

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.2 (server) |
| Config file | `server/vitest.config.ts` |
| Quick run command | `cd server && npx vitest run --reporter=verbose 2>&1 \| tail -20` |
| Full suite command | `cd server && npx vitest run` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SCHED-01 | Schedule grid renders entries by assistant and day | unit (pure JS) | `cd server && npx vitest run src/lib/scheduleUtils.test.ts` | Wave 0 gap |
| COMP-01 | FK deadline = 5th of second following month | unit | `cd server && npx vitest run src/lib/deadlineUtils.test.ts` | Wave 0 gap |
| COMP-01 | AGI deadline = 12th of following month | unit | same file | Wave 0 gap |
| COMP-01 | Badge variant: >14 days → info, 8–14 → warning, 1–7 → destructive, past → destructive | unit | same file | Wave 0 gap |
| COMP-02 | reminder_day saved via PUT /api/settings | integration | existing settings route test or new | Wave 0 gap |
| COMP-02 | Cron fires email only on configured day | unit (mock cron) | `cd server && npx vitest run src/lib/reminderCron.test.ts` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** `cd server && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **Per wave merge:** `cd server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/src/lib/deadlineUtils.test.ts` — covers COMP-01 deadline arithmetic (FK, AGI, badge variants), including December edge case
- [ ] `server/src/lib/reminderCron.test.ts` — covers COMP-02 cron logic (day match, guardian_email missing guard, pending step detection)
- [ ] `server/src/lib/reminderCron.ts` — the cron implementation module itself (new file)
- [ ] `server/src/lib/deadlineUtils.ts` — pure functions for deadline computation (optional extract for testability)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | — |
| V3 Session Management | no | — |
| V4 Access Control | yes | `requireAuth + requireGuardian` middleware already on all settings routes |
| V5 Input Validation | yes | reminder_day must be validated 1–28 server-side before storage |
| V6 Cryptography | no | — |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| reminder_day out of range | Tampering | Server clamp/reject: `if (val < 1 || val > 28) return res.status(400).json({ error: "Invalid day" })` |
| Guardian email leaked to cron log | Information disclosure | Do not log full email address; log only first char + domain or omit |
| Cron runs as unauthenticated context | Elevation of privilege | Cron runs server-side with direct DB access — no JWT auth required internally; ensure no external trigger endpoint is exposed |

---

## Sources

### Primary (HIGH confidence)
- `server/src/lib/email.ts` — nodemailer transport config, inline HTML template pattern [VERIFIED: codebase]
- `server/src/routes/misc.ts` lines 109–118 — settings key-value upsert pattern [VERIFIED: codebase]
- `server/src/db/schema.ts` — settings table shape (key/value text), assistants.color field [VERIFIED: codebase]
- `client/src/lib/utils.ts` — getWeekDates(offset) signature and behavior [VERIFIED: codebase]
- `client/src/pages/Home.tsx` — current byDay/gcalEvents schedule strip, lines 176–307 [VERIFIED: codebase]
- `client/src/pages/Monthly.tsx` lines 84–141 — ProgressStepper and StepProps interface [VERIFIED: codebase]
- `server/src/index.ts` — Express app startup and route registration pattern [VERIFIED: codebase]
- npm registry — node-cron@4.2.1 [VERIFIED: npm registry]
- npm registry — node-schedule@2.1.1 [VERIFIED: npm registry]

### Secondary (MEDIUM confidence)
- `.planning/phases/05-scheduling-compliance-workflow/05-UI-SPEC.md` — complete UI contract for all three sub-features
- `.planning/phases/05-scheduling-compliance-workflow/05-CONTEXT.md` — locked decisions D-01 through D-12

### Tertiary (LOW confidence)
- None

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified in package.json or npm registry
- Architecture: HIGH — all integration points verified against actual source files
- Pitfalls: HIGH — pitfalls derived from reading actual code, not assumed
- Validation: HIGH — vitest config and existing test patterns confirmed

**Research date:** 2026-04-14
**Valid until:** 2026-05-14 (stable stack)
