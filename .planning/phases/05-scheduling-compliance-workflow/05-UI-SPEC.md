---
phase: 5
slug: scheduling-compliance-workflow
status: draft
shadcn_initialized: false
preset: none
created: 2026-04-14
revised: 2026-04-14
---

# Phase 5 — UI Design Contract: Scheduling & Compliance Workflow

> Visual and interaction contract for Phase 5. Delivers SCHED-01, COMP-01, COMP-02.
> Enhances existing Home.tsx (schedule grid) and Monthly.tsx (compliance stepper)
> in-place — no new routes. Settings.tsx gains one reminder field.

---

## Design System

| Property | Value | Source |
|----------|-------|--------|
| Tool | Manual (no shadcn) | Custom Radix-based component library |
| Component library | Custom Radix-based (Card, Dialog, Button, Badge, Select, Input, Separator) | client/src/components/ui/ |
| Icon library | lucide-react | All existing page files |
| Font | Inter (system-ui fallback) | client/src/index.css |
| Border radius | 0.75rem (--radius) | client/tailwind.config.js |
| Base font size | 16px | client/src/index.css |

**No design system changes in this phase.** All tokens, components, and patterns carry forward from Phase 3.5 UI-SPEC (approved 2026-04-11).

---

## Spacing Scale

Declared values (multiples of 4 only):

| Token | Value | Usage |
|-------|-------|-------|
| xs | 4px | Icon gaps, dot indicators, cell padding |
| sm | 8px | Compact element spacing, cell inner padding |
| md | 16px | Default element spacing, card padding |
| lg | 24px | Section padding, table header padding |
| xl | 32px | Layout gaps between schedule and pending sections |
| 2xl | 48px | Major section breaks on Home |
| 3xl | 64px | Empty state vertical centering |

Exception: Schedule grid cells — minimum touch target 36×36px (w-9 h-9) per Phase 3.5 contract.

---

## Typography

| Role | Size | Weight | Line Height |
|------|------|--------|-------------|
| Label / section heading | 14.4px (text-sm) | 600 semibold | 1.5 |
| Body | 16px (text-base) | 400 regular | 1.6 |
| Page heading | 24px (text-2xl) | 600 semibold | 1.3 |
| Display / stat number | 30px (text-3xl) | 600 semibold, font-mono | 1.3 |

2 weights only: 400 regular · 600 semibold.

Cell time ranges (e.g. "08:00–16:00") use text-sm (14.4px), weight 400, with font-mono tabular-nums and text-muted-foreground for visual distinction from labels — no additional size token.
Daily total row values use text-sm (14.4px), weight 600 semibold, font-mono tabular-nums.
Footer "Total" label uses text-sm uppercase tracking-wide text-muted-foreground.

---

## Color

| Role | CSS Variable | Usage |
|------|-------------|-------|
| Dominant (60%) | --background | Page background, schedule table background |
| Secondary (30%) | --card / --secondary | Table header row, card surfaces, stepper container |
| Accent (10%) | --primary | Week nav active state, "Today" column highlight border, step circle (active state), reminder day input focus ring |
| Destructive | --destructive | Overdue step badge (red) only |

Accent reserved for: week navigation Today button, the active-step circle border, focus rings on form inputs. Never used for decorative table borders or assistant color dots.

Status palette (carry-forward from Phase 3.5):
- Amber (warning): deadline approaching — `border-amber-200 bg-amber-50 text-amber-700`
- Emerald (success): step complete — `border-emerald-200 bg-emerald-50 text-emerald-700`
- Red (urgent): step overdue — `border-red-200 bg-red-50 text-red-700`
- Blue (info): countdown badge neutral — `border-blue-200 bg-blue-50 text-blue-700`

Assistant color dots: per-assistant color values already assigned via AssistantAvatar convention (inline style `color` property). Reuse existing color assignment logic — do not introduce new color tokens.

---

## Component Inventory

### New: Schedule Grid (replaces Home.tsx day-card strip)

**Purpose:** Multi-assistant week view — rows = assistants, columns = Mon–Sun.

The schedule grid is the primary visual anchor on the Home.tsx screen. It occupies the upper main content area, above the pending-items section, and is the first element a guardian interacts with on load.

**Layout:**

```
┌──────────────────────────────────────────────────────────────────┐
│  [← Prev]  Week of Mon 14 Apr – Sun 20 Apr  [Today]  [Next →]   │
├──────────────┬──────┬──────┬──────┬──────┬──────┬──────┬────────┤
│  Assistant   │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │ Sun    │
├──────────────┼──────┼──────┼──────┼──────┼──────┼──────┼────────┤
│ ● Anna L.    │08–16 │08–16 │  –   │08–16 │08–16 │  –   │  –     │
│ ● Björn K.   │  –   │  –   │08–16 │  –   │  –   │08–16 │  –     │
├──────────────┼──────┼──────┼──────┼──────┼──────┼──────┼────────┤
│ Total (hrs)  │  8   │  8   │  8   │  8   │  8   │  8   │  0     │
└──────────────┴──────┴──────┴──────┴──────┴──────┴──────┴────────┘
```

**Cell states:**
- Shift present: time range in text-sm font-mono text-muted-foreground + assistant dot color as left border (2px solid)
- No shift: "–" in text-muted-foreground
- Today column: background `hsl(var(--primary)/5%)`, left border `2px solid hsl(var(--primary))`
- Hover on shift cell: `bg-secondary` — reveals "Mark absent" icon button (UserX, size 14px)

**Nav controls:**
- "← Prev" / "Next →": `<Button variant="ghost" size="sm">` (existing button component)
- "Today": `<Button variant="outline" size="sm">`, accent border when current week is active
- Week label: text-sm font-semibold text-foreground, centered

**Footer row:**
- "Total (hrs)" label: text-sm uppercase tracking-wide text-muted-foreground
- Daily total values: text-sm font-semibold font-mono tabular-nums

**Reused components:** AssistantAvatar (color dot 8×8px filled circle), getWeekDates(), entriesApi.list().

---

### Enhanced: ProgressStepper (Monthly.tsx)

**Purpose:** Existing 4-step stepper extended with due date sublabels and colored countdown badges.

**Step state → visual mapping:**

| State | Circle | Label color | Badge |
|-------|--------|-------------|-------|
| complete | emerald bg + CheckCircle2 icon | text-foreground | none |
| active | primary border + primary/10 bg | text-foreground | countdown badge (blue/amber/red) |
| locked | border-border + muted bg | text-muted-foreground | due date static text-sm |

**Due date sublabel (per step):**
- Step 1 (Daily reports): no regulatory deadline — sublabel: "{approved}/{total} reports approved"
- Step 2 (Payroll): no regulatory deadline — sublabel: "{approved}/{total} records approved"
- Step 3 (FK forms): sublabel: "Due {date} · {N} days left" or "Overdue by {N} days"
- Step 4 (AGI / blankett 4805): sublabel: "Due {date} · {N} days left" or "Overdue by {N} days"

**Countdown badge variants** (Badge component, existing badgeVariants):
- More than 14 days: `variant="info"` — "{N} days left"
- 8–14 days: `variant="warning"` — "{N} days left"
- 1–7 days: `variant="destructive"` — "{N} days left"
- Past due: `variant="destructive"` — "Overdue"
- Completed: no badge shown

Badge placed inline after sublabel text, 4px gap.

**Regulatory deadlines to compute:**
- FK deadline: 5th of second month following the reporting month
  - Example: January → March 5
- AGI deadline: 12th of month following the reporting month
  - Example: January → February 12

---

### New: Reminder Day Field (Settings.tsx)

**Purpose:** Guardian configures which day of the month receives the compliance email reminder.

**Placement:** Settings page, inside a new "Notifications" card section, after existing sections.

**Field:**

```
Notifications

[  Compliance reminder ]
[ Day of month: [  1  ] ]
[ Save reminder day ]
```

- Label: "Monthly compliance reminder" (text-sm font-medium text-foreground)
- Sublabel: "Email sent on this day each month with pending compliance steps." (text-sm text-muted-foreground)
- Input: `<Input type="number" min="1" max="28" className="w-20">` — max 28 avoids February edge case
- Save: `<Button variant="default" size="sm">Save reminder day</Button>`
- Success feedback: inline text-sm text-emerald-600 "Saved" for 2 seconds, then clears
- Validation: if value < 1 or > 28 → inline error text-sm text-destructive "Enter a day between 1 and 28"

---

## State Map

### Schedule Grid States

| State | What renders |
|-------|-------------|
| Loading | Skeleton rows — 3 rows, 7 columns of `bg-muted animate-pulse rounded h-6` |
| No assistants | EmptyState component: "No assistants added yet. Add assistants in Settings." |
| No entries this week | Grid renders with "–" in all cells. An `aria-live="polite"` caption below the table reads "No shifts scheduled this week." for screen reader support. |
| Week with data | Full grid, time ranges per cell |
| Error | `<p className="text-sm text-destructive">Could not load schedule. Check your connection and reload.</p>` inside grid area |

### Compliance Stepper States

| State | What renders |
|-------|-------------|
| Loading | Existing stepper skeleton (no change) |
| Month with no data | Step 1 shows "0/0 reports" — stepper renders normally |
| All steps complete | All circles emerald + CheckCircle2, no badges, no overdue styling |
| Approaching deadline | Amber badge on active step |
| Overdue | Red badge on step; step circle remains active (not blocked) |

---

## Copywriting Contract

| Element | Copy |
|---------|------|
| Schedule section heading | "This week's schedule" |
| Week nav — prev | "← Previous week" (aria-label) |
| Week nav — today | "Today" |
| Week nav — next | "Next week →" (aria-label) |
| Schedule empty — no assistants | "No assistants added yet. Add assistants in Settings." |
| Schedule empty — no entries this week | "No shifts scheduled this week." (screen reader caption, aria-live) |
| Schedule loading | (skeleton, no text) |
| Schedule error | "Could not load schedule. Check your connection and reload." |
| No shift in cell | "–" |
| Grid footer label | "Total" |
| Mark absent icon button aria-label | "Mark {assistantName} absent on {date}" |
| Stepper step 1 label | "Daily reports" |
| Stepper step 2 label | "Payroll" |
| Stepper step 3 label | "FK forms" |
| Stepper step 4 label | "Blankett 4805" |
| Stepper step 3 sublabel (active, on-time) | "Due {MMM D} · {N} days left" |
| Stepper step 3 sublabel (overdue) | "Overdue by {N} days" |
| Stepper step 4 sublabel (active, on-time) | "Due {MMM D} · {N} days left" |
| Stepper step 4 sublabel (overdue) | "Overdue by {N} days" |
| Stepper countdown badge (info) | "{N} days left" |
| Stepper countdown badge (overdue) | "Overdue" |
| Reminder field section heading | "Notifications" |
| Reminder field label | "Monthly compliance reminder" |
| Reminder field sublabel | "Email sent on this day each month with pending compliance steps." |
| Reminder save button | "Save reminder day" |
| Reminder save success | "Saved" |
| Reminder validation error | "Enter a day between 1 and 28" |
| Email subject line | "Compliance reminder — {Month Year}" |
| Email body — pending steps intro | "You have pending compliance steps for {Month Year}:" |
| Email body — CTA | "Open Monthly →" (links to /monthly) |
| Email body — no pending | "All steps are complete for {Month Year}. Nothing to do." |

Carry-forward from Phase 3.5 (unchanged):
- Mark absent dialog copy
- FK download gate tooltip: "Approve all reports and payroll first"
- Error — general: "Could not load data. Check your connection and reload."
- Confirm — mark absent: "Mark {assistant} as absent?" + type selector + "Confirm" / "Cancel"

---

## Interaction Contract

### Week Navigation
- Prev/Next buttons: update `weekOffset` state (integer offset from current week)
- Today button: reset `weekOffset` to 0
- No URL params for week — state is local to Home component
- getWeekDates(weekOffset) already returns 7 date strings — use directly

### Mark Absent (from grid cell)
- Hover on a cell that has a shift: reveal UserX icon button (16px, text-muted-foreground, hover text-destructive)
- Click: opens existing Mark Absent dialog (no changes to dialog — reuse Phase 3.5 pattern)
- Pre-fill date from cell's date, pre-fill assistantId from row

### Stepper Due Date Computation
- FK deadline: `new Date(year, month + 1, 5)` where month is 0-indexed reporting month, year advances if month >= 11
- AGI deadline: `new Date(year, month, 12)` where month is the month after reporting month
- Days remaining: `Math.ceil((deadline - now) / 86400000)` — negative = overdue
- Compute client-side on render — no API call required

### Reminder Day Save
- POST /api/settings (existing endpoint, existing JSON body shape) with `{ reminderDay: N }`
- Optimistic: disable Save reminder day button while saving, re-enable on success or error
- Server validates 1–28 range; client validates before submit
- If server returns error: show text-destructive message below input

---

## Accessibility Contract

- Schedule table uses `<table>` semantic element with `<thead>`, `<tbody>`, `<tfoot>` for screen reader row/column associations
- Column headers: `<th scope="col">` for day names
- Row headers: `<th scope="row">` for assistant name column
- Today column header: `aria-current="date"` on `<th>` + `<td>` cells
- Mark absent icon button: `aria-label="Mark {assistantName} absent on {date}"`
- Countdown badge: role not required — decorative; color is supplemented by text label (never color-only)
- Reminder input: `aria-describedby` pointing to sublabel id
- Week nav buttons: `aria-label` as specified in copywriting contract
- No-entries caption: rendered as `<caption>` or adjacent `<p aria-live="polite">` so screen readers announce the empty week state without relying on the "–" cell characters alone

---

## Registry Safety

| Registry | Blocks Used | Safety Gate |
|----------|-------------|-------------|
| shadcn official | none | not applicable (shadcn not initialized) |
| Third-party | none | not applicable |

Custom Radix-based component library only (client/src/components/ui/). No new third-party registries.

---

## Files This Phase Touches

| File | Change |
|------|--------|
| `client/src/pages/Home.tsx` lines 66–151 | Replace byDay day-card strip with assistant-row table component |
| `client/src/pages/Monthly.tsx` ProgressStepper | Add dueDate prop + badge sublabel rendering to StepProps |
| `client/src/pages/Settings.tsx` | Add Notifications card with reminderDay Input + Save reminder day |
| `server/src/db/schema.ts` | Add `reminderDay` integer column to guardian_profiles or settings table |
| `server/src/lib/email.ts` | Add sendComplianceReminderEmail template |
| `server/src/routes/` | Register cron job or scheduled task for reminder dispatch |

---

## Checker Sign-Off

- [ ] Dimension 1 Copywriting: PASS
- [ ] Dimension 2 Visuals: PASS
- [ ] Dimension 3 Color: PASS
- [ ] Dimension 4 Typography: PASS
- [ ] Dimension 5 Spacing: PASS
- [ ] Dimension 6 Registry Safety: PASS

**Approval:** pending
