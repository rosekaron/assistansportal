# Phase 2: Leave & Absence Foundation - Context

**Gathered:** 2026-04-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Guardians can record when assistants are absent (sjukfrånvaro, VAB, semester, other) with a date range. Recording an absence automatically cancels overlapping approved shifts and prevents assistant clock-in on those days. Absence hours are excluded from FK 3059 and FK 3057 billable totals. Guardian can view VAB balance (max 120 days/year, calendar year) and sick leave days recorded this year per assistant.

This phase does NOT include: payroll impact of absence (Phase 3), AGI reporting of absence periods (Phase 4), or bulk absence entry for multiple assistants at once (SCHED-03, deferred to v2).

</domain>

<decisions>
## Implementation Decisions

### D-01: Absence Data Model
- New dedicated `absences` table — NOT reusing `entries.entryType`
- Table columns: `id`, `guardianId` (scope), `assistantId` (nullable), `absenceType` enum, `startDate` (text YYYY-MM-DD), `endDate` (text YYYY-MM-DD), `createdAt`
- `assistantId` is nullable — if null, absence applies to ALL assistants for that date range (e.g., a public holiday)
- Absence types enum: `sjukfrånvaro`, `vab`, `semester`, `other`
- No hours-per-day field — total absent hours are derived by summing overlapping shift entries at query time

### D-02: Absence ↔ Shift Interaction
- Recording an absence **auto-cancels overlapping approved shifts** for the affected assistant(s)
- Cancelled shifts are NOT deleted — they receive a status change (add `"absent"` to `entryTypeEnum` in schema, or set a cancelled marker — planner decides exact mechanism)
- Assistants cannot clock in/out on days covered by an active absence record (assistant-facing block)
- The existing shift record is preserved as an audit trail; deleting the absence should be reversible if needed

### D-03: VAB Balance Rules
- VAB usage tracked per **calendar year** (January 1 – December 31)
- Counter resets each January 1
- Cap: 120 VAB days per year per assistant
- "Remaining VAB" = 120 − (VAB absence days recorded in current calendar year for that assistant)

### D-04: Sick Leave Visibility
- Show **total sick leave days recorded in the current calendar year** per assistant
- No statutory cap — guardian sees usage count, not "remaining" days
- Label: "Sjukfrånvaro [year]: X dagar"

### D-05: UI Placement
- New dedicated **"Frånvaro"** page — new nav item in the sidebar
- Page shows: all absence records (filterable by assistant/type/month), VAB balance per assistant, sick leave days this year per assistant, + "Record absence" action
- **Also** reflected inside the Assistants page: each assistant's detail view/section shows their current-year VAB and sick leave summary

### Claude's Discretion
- Exact `entryTypeEnum` extension strategy (add `"absent"` vs. use a separate `reqStatus` value for cancelled-by-absence)
- Whether the all-assistants absence (null assistantId) is stored as one record or expanded to N records at write time
- Exact Frånvaro page layout and table design
- How the assistant clock-in block is enforced (check absence table on clock-in endpoint, or frontend guard)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` — LEAV-01, LEAV-02, LEAV-03 definitions (absence types, FK exclusion, balance display)
- `.planning/PROJECT.md` — TypeScript constraint, no stack changes, test coverage requirement

### Core Schema & Billing Logic
- `server/src/db/schema.ts` — `entries` table, `entryTypeEnum`, all existing types; add `absences` table here
- `server/src/routes/pdf.ts` — FK 3059 (lines ~150–190) and FK 3057 (lines ~210–225) billing calculations; both need absence exclusion logic

### UI Integration Points
- `client/src/components/Layout.tsx` — sidebar nav array; add "Frånvaro" link here
- `client/src/pages/Assistants.tsx` — assistant cards/detail; add per-assistant VAB/sick summary here
- `client/src/lib/api.ts` — all HTTP calls live here; add `absenceApi` namespace

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `client/src/components/ui/dialog.tsx` — for the "Record absence" modal form
- `client/src/components/ui/card.tsx` — for absence/balance summary cards
- `client/src/components/ui/controls.tsx` — Select, DatePicker wrappers for the absence form
- `client/src/components/ui/inputs.tsx` — Input, Label, Badge for the form and balance display
- `client/src/lib/utils.ts` — date formatting helpers (reuse for absence date display)
- `server/src/lib/id.ts` — `newId(prefix)` for generating absence record IDs

### Established Patterns
- Route-per-domain: new `server/src/routes/absences.ts` follows the existing pattern
- Guardian scoping: all queries use `guardianId` from JWT — absence table needs same `guardianId` column
- Status enums: use `pgEnum` in `schema.ts` for `absenceTypeEnum`, consistent with `entryTypeEnum`, `reqStatusEnum`
- React Query + axios: client fetches via `api.ts` namespace objects, cached with React Query
- `requireAuth` + `requireGuardian` middleware already exists — apply to all absence routes

### Integration Points
- `server/src/db/schema.ts` — add `absences` table + `absenceTypeEnum` here
- `server/src/index.ts` — mount `absencesRouter` alongside existing routes
- `server/src/routes/pdf.ts` — FK 3059 and FK 3057 billing queries must join/check absence table to exclude absent-day shifts
- `client/src/App.tsx` — add `/leave` route inside guardian `<Route>` block
- `client/src/pages/Assistants.tsx` — add absence summary per assistant
- `client/src/components/Layout.tsx` — add "Frånvaro" nav entry

</code_context>

<specifics>
## Specific Implementation Notes

- Absence auto-cancels shifts: when `POST /api/absences` is called, server-side logic finds all `entries` for the assistant(s) where `date` falls within `[startDate, endDate]` and updates their status
- FK exclusion: the simplest approach is — in the FK 3059 and FK 3057 queries, filter out any entry where the assistant has an absence record covering that entry's date
- VAB balance query: `SELECT COUNT(*) FROM absences WHERE assistantId = ? AND absenceType = 'vab' AND startDate >= '2026-01-01' AND endDate <= '2026-12-31'` (count full days)
- For null-assistantId absences (all-assistants): queries checking absence coverage should also check for records where `assistantId IS NULL` (covers all assistants for that guardian)

</specifics>

<deferred>
## Deferred Ideas

- **Karensdag tracking** — First day of each sick period flagged as unpaid waiting day. Relevant for Phase 3 payroll accuracy. User chose not to include in Phase 2.
- **Bulk absence entry** (SCHED-03) — Recording absence for multiple assistants in one operation. Deferred to v2 per REQUIREMENTS.md.
- **Absence undo/reversal UI** — The data model supports reversal (shifts have status, not deleted), but a UI to "undo an absence" is not in scope for Phase 2. Guardian can delete the absence record; planner should include basic delete endpoint.

</deferred>

---

*Phase: 02-leave-absence-foundation*
*Context gathered: 2026-04-06*
