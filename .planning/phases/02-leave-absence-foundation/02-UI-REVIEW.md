---
phase: 2
slug: leave-absence-foundation
reviewed_at: 2026-04-06
auditor: gsd-ui-auditor
baseline: 02-UI-SPEC.md (approved)
---

# Phase 2 — UI Review

**Audited:** 2026-04-06
**Baseline:** 02-UI-SPEC.md (approved design contract)
**Screenshots:** Not captured — Playwright not installed; code-only audit

---

## Pillar Scores

| Pillar | Score | Key Finding |
|--------|-------|-------------|
| 1. Copywriting | 3/4 | Two minor deviations: card uses "VAB-saldo" not "VAB kvar [year]"; filtered empty state is not the spec-declared copy |
| 2. Visuals | 4/4 | Clear focal point, correct layout hierarchy, all icon-only buttons labelled, balance cards and table rendered per spec |
| 3. Color | 3/4 | Layout.tsx uses two hardcoded `hsl(...)` inline styles instead of CSS vars; `font-bold` appears on weekly-hours display in sidebar |
| 4. Typography | 3/4 | Two `font-medium` usages in Leave.tsx (table header, assistant name cell) violate two-weight rule; SectionLabel uses `text-[11px]` (arbitrary) instead of `text-sm` |
| 5. Spacing | 4/4 | All spacing values on-scale; filter label-to-select gap uses `gap-1` (4px = xs) which matches spec; no off-scale arbitrary values except `min-w-[160px]` (a width constraint, not spacing) |
| 6. Experience Design | 3/4 | Balance card loading states present; absence list query has no error branch; dialog has no `DialogDescription`; main list query does not destructure `isLoading` |

**Overall: 20/24**

---

## Top 3 Priority Fixes

1. **Missing error state on absence list query** — If `GET /api/absences` fails, the page silently renders an empty state ("Ingen frånvaro registrerad") with no indication of the failure. Guardian may believe no absences exist when a network or auth error occurred. Fix: destructure `isError` from the `absenceList` useQuery and render an error message above the table when true.

2. **`font-medium` used in two places in Leave.tsx violating the two-weight rule** — Table header cells (`font-medium` at line 380) and assistant name in table rows (`font-medium` at line 405) use weight 500, which the spec explicitly bans. This creates a third visual weight tier that dilutes hierarchy. Fix: change both to `font-semibold` (headers) and remove `font-medium` from the assistant name span (default regular weight is correct for data cells).

3. **Hardcoded `hsl()` values in Layout.tsx sidebar instead of CSS custom properties** — Lines 32, 40, 71, 84, and 101 use raw `style={{ background: "hsl(201 70% 42%)" }}` and `style={{ background: "hsl(210 20% 97%)" }}`. If the design token ever changes, these will diverge from the rest of the system. Fix: use `bg-primary` and `bg-background` Tailwind classes, or reference `var(--primary)` / `var(--background)`.

---

## Detailed Findings

### Pillar 1: Copywriting (3/4)

The vast majority of copy matches the contract exactly. All confirmed items:

- Page title: "Frånvaro" — PASS (Leave.tsx:262)
- Page description: "Registrera och spåra frånvaro per assistent" — PASS (Leave.tsx:263)
- Primary CTA: "Registrera frånvaro" — PASS (Leave.tsx:266)
- Dialog title: "Registrera frånvaro" — PASS (Leave.tsx:468)
- Dialog CTA: "Spara frånvaro" (with "Sparar…" pending state) — PASS (Leave.tsx:549)
- Empty state heading: "Ingen frånvaro registrerad. Klicka på 'Registrera frånvaro' för att lägga till frånvaro för en assistent." — PASS (Leave.tsx:369); note the spec declared the heading and body separately but combining them is acceptable
- Date validation error: "Slutdatum kan inte vara före startdatum." — PASS (Leave.tsx:235)
- Server error: "Kunde inte spara frånvaro. Kontrollera datumen och försök igen." — PASS (Leave.tsx:198)
- Delete confirmation: "Bekräfta radering?" / "Ja, radera" / "Avbryt" — PASS (Leave.tsx:426,433,440)
- Delete aria-label: "Radera frånvaro" — PASS (Leave.tsx:447)
- Filter placeholders: "Alla assistenter" / "Alla typer" / "Alla månader" — PASS (Leave.tsx:318,333,350)
- Absence type labels in Select: "Sjukfrånvaro", "VAB (vård av barn)", "Semester", "Övrigt" — PASS
- Absence type badge labels: "Sjukfrånvaro", "VAB", "Semester", "Övrigt" — PASS (Leave.tsx:47-51)
- Sidebar nav label: "Frånvaro" — PASS (Layout.tsx:11)
- Assistants page row: "VAB kvar: X dagar" / "Sjukfrånvaro: X dagar" — PASS (Assistants.tsx:38-48)

**Deviations found:**

1. **VAB balance card description** — Spec declares "VAB kvar [year]" (e.g., "VAB kvar 2026") as the card description. Implementation uses `"VAB-saldo {year}"` (Leave.tsx:87). "VAB-saldo" is Swedish for "VAB balance" which is semantically equivalent but does not match the exact copywriting contract. Low severity — the user understands the card, but the spec should be the source of truth.

2. **Filtered empty state copy** — Spec does not declare a separate copy for the filter-empty state. The implementation uses `"Inga poster matchar de valda filtren."` (Leave.tsx:370). This is a reasonable and clear message, but it was not declared in the copywriting contract. Not a bug — this is a minor gap in spec coverage resolved sensibly by the implementor.

---

### Pillar 2: Visuals (4/4)

The layout matches the spec contract closely:

- **Focal point**: "Registrera frånvaro" primary button in PageHeader is the highest-contrast interactive element — correct per spec declaration.
- **Layout hierarchy**: PageHeader → balance card grid (3 cols) → filter row → absence table. Matches the spec's declared nesting exactly.
- **Balance cards**: VAB card shows large number (`text-3xl font-semibold`), sub-label, and 4px progress bar. Sick YTD card shows large number and sub-label with no progress bar. Both per spec.
- **AssistantAvatar**: used in card headers and table rows. Reuses existing component correctly.
- **Icon-only delete button**: paired with `aria-label="Radera frånvaro"` — correct.
- **Inline delete confirmation**: replaces delete button in the same row without a modal overlay — matches interaction contract exactly.
- **Sidebar nav**: "Frånvaro" added at position 3 (after Schedule, before Reports) with `CalendarOff` icon — matches spec nav order.
- **Assistants page integration**: `AssistantAbsenceSummary` component renders correctly below a `Separator` — matches spec's code snippet layout.
- **Summary card for 1-assistant case**: adds a "Totalt frånvaro" card to fill the 3-column grid. Not declared in spec but consistent with the spec's "fill remaining grid slots" note.

No visual defects found. Score: 4/4.

---

### Pillar 3: Color (3/4)

**Accent usage (primary):**

- `bg-primary` on the "Registrera frånvaro" button — correct (spec item 1)
- `bg-primary` on active sidebar NavLink via inline `hsl(201 70% 42%)` — correct intent, see hardcoded value issue below
- `bg-primary` on progress bar fill in VAB card (`bg-primary`, Leave.tsx:100) — correct (spec item 3, VAB accent)
- `text-emerald-600` / `text-amber-600` / `text-red-600` for VAB threshold colors — correct per spec color table
- Badge color mapping: warning=amber, info=blue, success=green, slate=grey — all correct per spec

**Hardcoded color issues (2 files, 5 occurrences):**

1. `Layout.tsx:32` — `style={{ background: "hsl(210 20% 97%)" }}` on outer wrapper. Should be `className="bg-background"`.
2. `Layout.tsx:40` — `style={{ background: "hsl(201 70% 42%)" }}` on logo badge. Should be `className="bg-primary"`.
3. `Layout.tsx:71` — `style={... ? { background: "hsl(201 70% 42%)" } : {}}` on active NavLink. Should be applied via `bg-primary` class.
4. `Layout.tsx:84` — `style={{ color: "hsl(201 70% 38%)" }}` on weekly hours number. Should use `text-primary`.
5. `Layout.tsx:101` — `style={{ background: "hsl(210 20% 97%)" }}` on main content area. Should be `className="bg-background"`.

Note: these are in Layout.tsx which existed before Phase 2, but were not corrected during implementation. The spec requires Tailwind semantic classes.

**Font weight issue crossing into color pillar:**
`Assistants.tsx:139` uses `font-bold` on the weekly hours budget number. The spec's two-weight rule (regular + semibold only) is violated here. This also affects the Assistants page's visual consistency.

**AssistantAvatar** uses hardcoded `#6366f1` as a fallback color in `shared.tsx:13-14`. This is a pre-existing pattern outside Phase 2 scope but worth noting.

---

### Pillar 4: Typography (3/4)

**Declared sizes (spec: text-sm, text-base, text-xl, text-lg, text-3xl — 5 sizes over 4 tiers):**

Sizes found in Leave.tsx and supporting components:
- `text-xl` — PageHeader title (shared.tsx:116) — correct, spec-declared heading size
- `text-lg` — not used in Leave.tsx; appears in Layout.tsx sidebar (weekly hours) with `font-bold` (violation, see below)
- `text-3xl` — balance card large numbers (Leave.tsx:94,128) — correct, spec-declared
- `text-sm` — body text, labels, filter text, card descriptions — correct
- `text-xs` — "Registrerad" column (Leave.tsx:420), error messages (Leave.tsx:534,553), inline confirmation text — correct per spec's badge/label tier
- `text-[11px]` — table header cells (Leave.tsx:380) and `SectionLabel` component (shared.tsx:127) — this is an arbitrary value. Spec declares `text-sm font-semibold` for `SectionLabel`. The implementation uses `text-[11px]` (11px) which is between `text-xs` (12px) and a custom size. This deviates from the spec.

**Declared weights (spec: regular 400 and semibold 600 only):**

- `font-semibold` — card titles, balance numbers, assistant names in cards, dialog title — all correct
- `font-medium` at Leave.tsx:380 — table header cells use `font-medium` (500), should be `font-semibold` or dropped (headers rendered in all-caps with `text-muted-foreground` so weight matters less but still violates the rule)
- `font-medium` at Leave.tsx:405 — assistant name span in table data cell uses `font-medium`, should be removed (regular weight is correct for data cells per spec's body tier)
- `font-bold` at Layout.tsx:84 — weekly hours number in sidebar uses `font-bold` (700). Pre-existing code but spec explicitly bans it.
- `font-bold` at Assistants.tsx:139,270 — weekly budget number and step counter badges use `font-bold`. Pre-existing but violates the two-weight system.

**Summary:** Font sizes are largely correct. Two `font-medium` usages in Leave.tsx and multiple `font-bold` usages (in pre-existing code not changed in Phase 2) violate the two-weight rule.

---

### Pillar 5: Spacing (4/4)

Spacing is well-implemented and consistent with the declared scale:

- Balance card grid: `grid grid-cols-3 gap-4` (16px = md) — matches spec exactly
- Balance-to-filter gap: `mb-6` (24px = lg) implicit via `mb-6` on grid — matches spec's "section gap" declaration
- Filter row: `flex gap-3` between filter groups — 12px, acceptable compact spacing
- Filter label-to-select: `gap-1` (4px = xs) — matches spec's "icon-to-label gaps, badge padding" xs token
- Dialog content: `space-y-4` (16px = md) between form field groups — matches spec's "space-y-4 between label+field pairs"
- Form field label-to-input: `space-y-1.5` (6px) — this is between xs (4px) and sm (8px). Spec says `sm` (8px) for "form field gap within groups". Minor deviation but visually acceptable and consistent with existing dialog patterns in the codebase.
- Table row padding: `py-2` (8px = sm) — matches spec exactly
- Table cell horizontal: `px-4` (16px = md) — consistent with existing table patterns
- Dialog padding: handled by `DialogContent` component's `p-6` — matches spec

No arbitrary spacing values in Leave.tsx except `min-w-[160px]` (a minimum width constraint on filter dropdowns, not a spacing value) and inline `style={{ width: N }}` on table columns (fixed column widths, not spacing — matches spec's table column width declarations).

---

### Pillar 6: Experience Design (3/4)

**Loading states:**
- Balance cards: `isLoading` branch renders `"--"` placeholder (Leave.tsx:90-91, 124-125) — correct per spec
- `AssistantAbsenceSummary` in Assistants.tsx: `isLoading` renders `null` → `"--"` placeholder (Assistants.tsx:23) — matches spec's "show '--' as placeholder while loading"
- Absence list query: no `isLoading` state rendered. Page renders balance cards above the table while the list loads. This is acceptable UX since cards load independently, but an explicit loading state for the table would be more complete.

**Error states:**
- Mutation errors: `onError` callback sets `serverError` string displayed below CTA in dialog — correct per spec
- Date validation error: inline `dateError` shown below Slutdatum field — correct per spec
- Delete mutation: no `onError` handler. If `DELETE /api/absences/:id` fails, the inline confirmation row disappears (state resets) but no error message is shown to the guardian. Low severity but missing feedback.
- **Absence list query error**: `useQuery` for `absenceList` does not destructure `isError` (Leave.tsx:171-174). If the fetch fails, the page renders an empty state "Ingen frånvaro registrerad" — indistinguishable from a genuinely empty list. Guardian may be misled into thinking there are no absences when there is actually a network or auth failure.

**Empty states:**
- Two distinct empty states (no records vs. filters produce no match) — correct, both declared in spec with appropriate copy
- `EmptyState` component renders inside `CardContent` — correct placement

**Disabled states:**
- Submit button disabled when `isPending || !absenceType || !startDate || !endDate` — correct
- Delete confirm button disabled while `deleteAbsence.isPending` — correct

**Confirmation for destructive actions:**
- Inline delete confirmation pattern implemented exactly per spec (no separate modal, "Bekräfta radering?" text, destructive + ghost buttons in row) — excellent

**Dialog accessibility:**
- `DialogTitle` present — provides accessible name
- `DialogDescription` not used — the dialog has no machine-readable description. While not a hard accessibility failure (the title is sufficient), the spec does not explicitly require it for this phase; however, screen-reader UX would benefit from it.
- Focus order: Assistent Select → Typ Select → Startdatum → Slutdatum → Spara — correct (natural DOM order)
- All form fields have `Label` with `htmlFor` + matching `id` on the input/trigger — correct (Leave.tsx:474,495,512,523)

---

## Registry Safety

No `components.json` found. shadcn is not initialized. Registry safety audit: not applicable — all components are hand-written Radix primitives in the project codebase, as declared in the UI-SPEC.

---

## Files Audited

**Phase 2 planning files:**
- `.planning/phases/02-leave-absence-foundation/02-UI-SPEC.md`
- `.planning/phases/02-leave-absence-foundation/02-CONTEXT.md`
- `.planning/phases/02-leave-absence-foundation/02-01-SUMMARY.md` through `02-04-SUMMARY.md`

**Client source files:**
- `client/src/pages/Leave.tsx` (new, 560 lines)
- `client/src/components/Layout.tsx` (modified — nav addition)
- `client/src/pages/Assistants.tsx` (modified — AssistantAbsenceSummary addition)
- `client/src/components/shared.tsx` (read-only audit — PageHeader, SectionLabel, EmptyState, AssistantAvatar)

**Server source files (read reference only, not UI-audited):**
- `server/src/lib/absence-utils.ts`
- `server/src/routes/absences.ts`

---

*Phase: 02-leave-absence-foundation*
*UI-REVIEW created: 2026-04-06*
*Audited by: gsd-ui-auditor (claude-sonnet-4-6)*
