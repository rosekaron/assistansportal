# Phase 2: Leave & Absence Foundation — Research

**Researched:** 2026-04-06
**Domain:** Absence data model + FK billing exclusion + VAB/sick-leave balance display (TypeScript / Express / Drizzle ORM / React)
**Confidence:** HIGH — all findings verified directly against codebase files

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01: Absence Data Model**
- New dedicated `absences` table — NOT reusing `entries.entryType`
- Table columns: `id`, `guardianId` (scope), `assistantId` (nullable), `absenceType` enum, `startDate` (text YYYY-MM-DD), `endDate` (text YYYY-MM-DD), `createdAt`
- `assistantId` is nullable — if null, absence applies to ALL assistants for that date range (e.g., a public holiday)
- Absence types enum: `sjukfrånvaro`, `vab`, `semester`, `other`
- No hours-per-day field — total absent hours are derived by summing overlapping shift entries at query time

**D-02: Absence ↔ Shift Interaction**
- Recording an absence auto-cancels overlapping approved shifts for the affected assistant(s)
- Cancelled shifts are NOT deleted — they receive a status change
- Assistants cannot clock in/out on days covered by an active absence record (assistant-facing block)
- The existing shift record is preserved as an audit trail; deleting the absence should be reversible if needed

**D-03: VAB Balance Rules**
- VAB usage tracked per calendar year (January 1 – December 31)
- Counter resets each January 1
- Cap: 120 VAB days per year per assistant
- "Remaining VAB" = 120 − (VAB absence days recorded in current calendar year for that assistant)

**D-04: Sick Leave Visibility**
- Show total sick leave days recorded in the current calendar year per assistant
- No statutory cap — guardian sees usage count, not "remaining" days
- Label: "Sjukfrånvaro [year]: X dagar"

**D-05: UI Placement**
- New dedicated "Frånvaro" page — new nav item in the sidebar
- Page shows: all absence records (filterable by assistant/type/month), VAB balance per assistant, sick leave days this year per assistant, + "Record absence" action
- Also reflected inside the Assistants page: each assistant's detail view/section shows their current-year VAB and sick leave summary

### Claude's Discretion
- Exact `entryTypeEnum` extension strategy (add `"absent"` vs. use a separate `reqStatus` value for cancelled-by-absence)
- Whether the all-assistants absence (null assistantId) is stored as one record or expanded to N records at write time
- Exact Frånvaro page layout and table design
- How the assistant clock-in block is enforced (check absence table on clock-in endpoint, or frontend guard)

### Deferred Ideas (OUT OF SCOPE)
- Karensdag tracking — First day of each sick period flagged as unpaid waiting day. Relevant for Phase 3 payroll accuracy. User chose not to include in Phase 2.
- Bulk absence entry (SCHED-03) — Recording absence for multiple assistants in one operation. Deferred to v2 per REQUIREMENTS.md.
- Absence undo/reversal UI — The data model supports reversal (shifts have status, not deleted), but a UI to "undo an absence" is not in scope for Phase 2. Guardian can delete the absence record; planner should include basic delete endpoint.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LEAV-01 | Guardian can record an assistant absence with type (sjukfrånvaro, VAB, semester, other), start date, and end date | D-01 data model verified in schema.ts — new `absences` table added alongside existing `entries`. Route pattern from `entries.ts` is directly reusable. |
| LEAV-02 | Hours marked as absence are automatically excluded from billable hours in FK 3059 and FK 3057 calculations | FK 3059 query (pdf.ts lines 75-82) and FK 3057 query (lines 211-217) both use simple `.where()` filters — absence exclusion is a LEFT JOIN or NOT EXISTS subquery against the new `absences` table on matching assistantId + date range. |
| LEAV-03 | Guardian can view remaining VAB days (max 120/year) and sick leave balance per assistant | Aggregate query: `COUNT(*)` from `absences` WHERE absenceType + calendar year + assistantId. Result surfaced in Frånvaro page and assistant cards. |
</phase_requirements>

---

## Summary

Phase 2 is a well-bounded feature addition to an existing, healthy codebase. The core work is:
1. a new `absences` database table with enum,
2. a CRUD route file following the established `entries.ts` pattern,
3. two surgical JOIN additions to the FK PDF billing queries,
4. a new React page ("Frånvaro") with a dialog form and balance cards, and
5. minor additions to the Assistants page and sidebar.

The Phase 1 stability work is complete and merged. The codebase is clean TypeScript throughout. The existing test framework (Vitest + supertest) is in place with three passing test files. All new server code must include unit/integration tests in `server/src/routes/__tests__/`.

The single most important implementation detail: the FK billing exclusion (LEAV-02) requires careful query construction — the absence check must cover the case where `absences.assistantId IS NULL` (whole-guardian absence) in addition to the assistant-specific case. Both FK 3059 and FK 3057 queries must be updated.

**Primary recommendation:** Implement in four sequential plans: (1) DB schema + migration, (2) server routes + billing exclusion, (3) Frånvaro page UI, (4) Assistants page integration + clock-in block.

---

## Standard Stack

### Core (already installed — no new dependencies needed for most of Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | ^0.30.10 [VERIFIED: server/package.json] | ORM, schema definition, query builder | Already used for all DB access |
| drizzle-kit | ^0.21.4 [VERIFIED: server/package.json] | Schema migrations via `db:push` | Already configured in drizzle.config.ts |
| express | ^4.19.2 [VERIFIED: server/package.json] | HTTP router | All routes use this |
| zod | ^3.23.8 [VERIFIED: server/package.json] | Request body validation | Already a dependency |
| react-query (@tanstack/react-query) | (client dep) | Data fetching + cache invalidation | All client fetching uses this pattern |

### Supporting (discretionary — Claude's call)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | (client dep) | Icon for "Frånvaro" sidebar nav item | Layout.tsx already imports from this package |

**No new server dependencies required for Phase 2.** The existing stack covers all needs.

**Migration command:**
```bash
cd server && npm run db:push
```
The project uses `drizzle-kit push` (schema-push mode, no migration files). Adding the `absences` table and `absenceTypeEnum` to `schema.ts` and running `db:push` is the correct approach — consistent with how Phase 1 schema changes were handled.

---

## Architecture Patterns

### Established Project Structure (verified)
```
server/src/
├── db/
│   ├── schema.ts          ← ADD: absenceTypeEnum + absences table + Absence type export
│   └── index.ts           ← unchanged
├── routes/
│   ├── absences.ts        ← NEW: full CRUD for absence records
│   ├── entries.ts         ← unchanged (pattern to copy)
│   ├── pdf.ts             ← MODIFY: FK 3059 + FK 3057 billing queries
│   └── assistant.ts       ← MODIFY: add absence check to self-book/submit-report if needed
├── middleware/
│   └── auth.ts            ← unchanged (requireAuth + requireGuardian reused)
├── lib/
│   └── id.ts              ← unchanged (newId("ab") for absence IDs)
└── index.ts               ← MODIFY: mount absencesRouter

client/src/
├── pages/
│   ├── Leave.tsx          ← NEW: Frånvaro page
│   └── Assistants.tsx     ← MODIFY: add VAB/sick summary per assistant card
├── components/
│   └── Layout.tsx         ← MODIFY: add "Frånvaro" nav entry
├── lib/
│   └── api.ts             ← MODIFY: add absenceApi namespace
└── App.tsx                ← MODIFY: add /leave route in guardian block
```

### Pattern 1: Route-per-Domain (established)
**What:** Each resource domain gets its own file in `server/src/routes/`. The file exports a Router, mounts middleware, and defines CRUD handlers.
**When to use:** All new API resources — follow exactly for `absences.ts`.
**Example:**
```typescript
// Source: server/src/routes/entries.ts (verified)
import { Router } from "express";
import { db } from "../db";
import { absences } from "../db/schema";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();

router.get("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  // query absences table with guardianId scoping
});

export default router;
```

### Pattern 2: Guardian-Scoped Queries
**What:** Every query that touches guardian-owned data must filter by `guardianId`. The JWT payload does NOT currently carry `guardianId` — instead, the current schema does NOT have a `guardianId` column on tables (assistants, entries, etc.). The existing code uses a single-tenant assumption (one guardian per deployment). Phase 2's `absences` table is the first table defined with an explicit `guardianId` column per the CONTEXT.md decision.

**Critical observation:** Looking at the existing entries, assistants, and costs tables — none of them carry a `guardianId` column. [VERIFIED: server/src/db/schema.ts] The codebase currently operates single-tenant. The `guardianId` on the new `absences` table introduces multi-tenant-ready scoping on this new table. The AUTH middleware provides `req.userId` (the auth row's integer id) — this is the de-facto guardianId. Use `req.userId` as the guardian scope value for the absences table.

### Pattern 3: Drizzle ORM Query Patterns
**What:** Drizzle uses chained `.where(and(...conditions))` for filtering. Date range queries use `gte` and `lte` from `drizzle-orm`.
**Example:**
```typescript
// Source: server/src/routes/entries.ts lines 14-21 (verified)
import { eq, and, gte, lte } from "drizzle-orm";

const rows = await db.select().from(absences).where(
  and(
    eq(absences.guardianId, req.userId!),
    eq(absences.assistantId, assistantId),
    gte(absences.startDate, `${year}-01-01`),
    lte(absences.endDate, `${year}-12-31`),
  )
);
```

### Pattern 4: FK Billing Exclusion Query
**What:** The FK 3059 and FK 3057 queries fetch approved entries for a date range. Absence exclusion means: skip any entry where the assistant has an active absence record covering that entry's date.

**FK 3059 current query (lines 75-82, pdf.ts — verified):**
```typescript
const monthEntries = await db.select().from(entries)
  .where(and(
    eq(entries.assistantId, assistantId),
    gte(entries.date, start),
    lte(entries.date, end),
    eq(entries.reqStatus, "approved"),
  ))
  .orderBy(entries.date, entries.startTime);
```

**Required change:** Add absence exclusion. The cleanest Drizzle approach is a raw SQL `NOT EXISTS` subquery or fetching absences for the period separately and filtering in application code. Given the small data volumes (one assistant, one month), application-code filtering is acceptable and avoids complex Drizzle subquery syntax:

```typescript
// Application-code approach (simple, correct for small data volumes)
const monthAbsences = await db.select().from(absences).where(
  and(
    or(
      eq(absences.assistantId, assistantId),
      isNull(absences.assistantId)          // covers whole-guardian absences
    ),
    lte(absences.startDate, end),           // absence starts before or during month
    gte(absences.endDate, start),           // absence ends after or during month
  )
);

// Then filter entries: exclude any entry whose date falls within any absence range
const billableEntries = monthEntries.filter(e =>
  !monthAbsences.some(a => e.date >= a.startDate && e.date <= a.endDate)
);
```

**FK 3057 current query (lines 211-217, pdf.ts — verified):**
```typescript
const monthEntries = await db.select().from(entries)
  .where(and(
    gte(entries.date, `${year}-${mm}-01`),
    lte(entries.date, `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`),
    eq(entries.reqStatus, "approved"),
    eq(entries.repStatus, "approved"),
  ));
```

FK 3057 covers ALL assistants for a guardian — the absence exclusion must check per-assistant:
```typescript
// For FK 3057: fetch all absences for the month, then filter per entry
const monthAbsences = await db.select().from(absences).where(
  and(
    lte(absences.startDate, end),
    gte(absences.endDate, start),
  )
);

const billableEntries = monthEntries.filter(e =>
  !monthAbsences.some(a =>
    (a.assistantId === null || a.assistantId === e.assistantId) &&
    e.date >= a.startDate && e.date <= a.endDate
  )
);
```

### Pattern 5: React Query Client Data Fetching
**What:** All API calls go through the `api.ts` namespace objects. React Query wraps them with `useQuery`/`useMutation`.
**Example:**
```typescript
// Source: client/src/pages/Assistants.tsx lines 24-26 (verified)
const { data: assistants = [] } = useQuery({
  queryKey: ["assistants"],
  queryFn: () => assistantsApi.list().then((r) => r.data),
});
```

New `absenceApi` namespace follows the same shape as `assistantsApi`, `entriesApi`, etc.

### Pattern 6: Cancel-on-Absence Shift Status
**Claude's discretion area.** Two options for marking shifts as "cancelled by absence":

**Option A — Add `"absent"` to `entryTypeEnum`:**
- Pro: survives the existing `totMins` accumulation in FK 3059 if filtered at accumulation time
- Con: `entryType` describes shift category (active/waiting/standby/sick), not cancellation reason — semantic mismatch
- Con: existing FK 3059 code iterates `entryType` for billing row assignment; `"absent"` would need to be handled as an exclusion case

**Option B — Add `"cancelled"` to `reqStatusEnum`:**
- Pro: `reqStatus` already describes approval flow state (pending/approved/rejected) — "cancelled" fits semantically
- Pro: the FK billing query already filters `eq(entries.reqStatus, "approved")` — cancelled shifts are automatically excluded without any query changes
- Pro: consistent with the CONTEXT.md principle that "cancelled shifts receive a status change"
- Con: Must ensure the assistant self-service endpoints reject state transitions from `"cancelled"` entries

**Recommendation (Claude's discretion): Add `"cancelled"` to `reqStatusEnum`.** This is the minimal-impact change: the FK billing queries already exclude non-approved entries, so LEAV-02 is partially satisfied by this change alone. The only additional filtering needed is for the "absent hours" display in Phase 3's payroll view.

### Anti-Patterns to Avoid
- **Deleting cancelled shifts:** CONTEXT.md explicitly forbids this — status change only, audit trail preserved.
- **Hardcoding calendar year boundaries:** Always derive `${year}-01-01` / `${year}-12-31` dynamically from the current year.
- **Checking absence only at frontend:** The clock-in block must be enforced server-side (on assistant self-book and submit-report endpoints) to prevent bypass. Frontend guard is acceptable as UX polish on top of server enforcement.
- **Storing multi-assistant absences as one record with null assistantId:** Per CONTEXT.md D-01, a single record with `assistantId IS NULL` covers all assistants. Do NOT expand to N records at write time — store one record, and apply the null check in all queries.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Date overlap detection | Custom date math | Application-code string comparison (`e.date >= a.startDate && e.date <= a.endDate`) | Dates stored as YYYY-MM-DD strings — lexicographic comparison is correct and sufficient |
| VAB day count | Complex date-diff logic | SQL `COUNT(*)` on absence rows | Each absence record represents a contiguous range; days = (endDate − startDate + 1). COUNT rows per assistant is wrong — must compute day count per record. |
| Request body validation | Manual field checks | Zod schema (already installed) | Already a dependency; use `z.object()` to validate POST body for absence creation |
| ID generation | UUID or custom | `newId("ab")` from `server/src/lib/id.ts` | Consistent with all other record IDs in the codebase |

**Key insight on VAB day count:** The `absences` table stores date ranges, not individual days. The VAB balance query must sum `(endDate - startDate + 1)` for each VAB absence row, not count rows. In PostgreSQL with Drizzle raw SQL:
```sql
SELECT SUM(
  EXTRACT(DAY FROM (end_date::date - start_date::date)) + 1
) FROM absences
WHERE assistant_id = $1 AND absence_type = 'vab'
AND start_date >= '2026-01-01' AND end_date <= '2026-12-31'
```
Or fetch rows and compute in application code: `rows.reduce((sum, a) => sum + dayDiff(a.startDate, a.endDate) + 1, 0)` where `dayDiff` subtracts date strings.

---

## Critical Implementation Details

### 1. Schema Changes Required

**New enum** (add to `schema.ts`):
```typescript
export const absenceTypeEnum = pgEnum("absence_type", [
  "sjukfrånvaro", "vab", "semester", "other"
]);
```

**New table** (add to `schema.ts`):
```typescript
export const absences = pgTable("absences", {
  id:          text("id").primaryKey(),
  guardianId:  integer("guardian_id").notNull(),   // auth.id of the guardian
  assistantId: text("assistant_id"),               // nullable — null = all assistants
  absenceType: absenceTypeEnum("absence_type").notNull(),
  startDate:   text("start_date").notNull(),       // YYYY-MM-DD
  endDate:     text("end_date").notNull(),         // YYYY-MM-DD
  createdAt:   timestamp("created_at").defaultNow(),
});

export type Absence = typeof absences.$inferSelect;
```

**`reqStatusEnum` extension** (Claude's discretion — recommended):
```typescript
// Before:
export const reqStatusEnum = pgEnum("req_status", ["pending","approved","rejected"]);
// After:
export const reqStatusEnum = pgEnum("req_status", ["pending","approved","rejected","cancelled"]);
```

**Migration command:**
```bash
cd server && npm run db:push
```
[VERIFIED: server/package.json — `db:push` script exists and uses `drizzle-kit push`]

### 2. Route File: `server/src/routes/absences.ts`

Endpoints needed:
- `GET /api/absences` — list with optional `?assistantId=&year=&month=` filters
- `POST /api/absences` — create absence + auto-cancel overlapping shifts
- `DELETE /api/absences/:id` — delete absence record (reversal; does NOT restore cancelled shifts automatically per CONTEXT.md)
- `GET /api/absences/balance/:assistantId` — VAB remaining + sick leave YTD count

All routes: `requireAuth, requireGuardian`. Guardian scope enforced via `req.userId` matching `absences.guardianId`.

### 3. Auto-Cancel Logic (POST /api/absences)

When creating an absence, server must:
1. Insert the absence record.
2. Find all `entries` where `assistantId` matches (or `assistantId IS NULL` for all-assistant case) AND `date >= startDate` AND `date <= endDate` AND `reqStatus = "approved"`.
3. Update those entries: `reqStatus = "cancelled"`, `updatedAt = now()`.
4. Return the created absence record (and optionally the count of cancelled entries).

This is a two-step operation within a single request — no transaction needed given PostgreSQL's row-level locking, but wrapping in a Drizzle transaction is good practice.

### 4. Clock-In Block (Server-Side)

Add absence check to `PUT /api/assistant/entries/:id/accept` and `POST /api/assistant/self-book/:slotId` in `assistant.ts`:

```typescript
// Before processing, check for active absence on the entry's date
const activeAbsence = await db.select().from(absences).where(
  and(
    or(
      eq(absences.assistantId, req.assistantId!),
      isNull(absences.assistantId)
    ),
    lte(absences.startDate, entry.date),
    gte(absences.endDate, entry.date),
  )
).limit(1);

if (activeAbsence.length > 0) {
  return res.status(409).json({ error: "Assistant has an active absence on this date" });
}
```

### 5. Server Mount (index.ts)

```typescript
import absencesRoutes from "./routes/absences";
// ...
app.use("/api/absences", absencesRoutes);
```

### 6. Client API Namespace (api.ts)

```typescript
export const absenceApi = {
  list:    (params?: Record<string, string>) => api.get("/absences", { params }),
  create:  (data: Record<string, unknown>)   => api.post("/absences", data),
  delete:  (id: string)                      => api.delete(`/absences/${id}`),
  balance: (assistantId: string)             => api.get(`/absences/balance/${assistantId}`),
};
```

### 7. Sidebar Nav (Layout.tsx)

The `nav` array in Layout.tsx [VERIFIED: client/src/components/Layout.tsx line 8] needs a new entry:
```typescript
import { LayoutDashboard, CalendarDays, Users, Settings, LogOut, FileText, CalendarOff } from "lucide-react";

const nav = [
  { to: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { to: "/calendar",   label: "Schedule",   icon: CalendarDays },
  { to: "/leave",      label: "Frånvaro",   icon: CalendarOff },   // NEW
  { to: "/reports",    label: "Reports",    icon: FileText },
  { to: "/assistants", label: "Assistants", icon: Users },
  { to: "/settings",   label: "Settings",   icon: Settings },
];
```

### 8. App.tsx Route

Add inside the guardian `<Route>` block [VERIFIED: client/src/App.tsx lines 77-85]:
```typescript
import LeaveAbsencePage from "@/pages/Leave";
// ...
<Route path="/leave" element={<LeaveAbsencePage />} />
```

---

## Common Pitfalls

### Pitfall 1: VAB Day Count Using ROW COUNT Instead of Date Diff
**What goes wrong:** Counting absence rows (`COUNT(*)`) returns number of absence records, not number of absent days. A single 5-day absence is 1 row but 5 VAB days.
**Why it happens:** SQL COUNT is the intuitive approach, but date-range records need summed durations.
**How to avoid:** Sum `(endDate_epoch - startDate_epoch) / 86400 + 1` per row, or fetch rows and compute in application code.
**Warning signs:** VAB balance shows "119 remaining" after a 5-day absence instead of "115 remaining."

### Pitfall 2: Missing Null-AssistantId Check in Absence Queries
**What goes wrong:** An all-assistants absence (null assistantId) does not exclude entries from billing because the query only checks `absences.assistantId = entry.assistantId`.
**Why it happens:** Standard equality join fails for NULL values in SQL.
**How to avoid:** All absence coverage queries must include `OR absences.assistantId IS NULL`. In Drizzle: `or(eq(absences.assistantId, targetId), isNull(absences.assistantId))`.
**Warning signs:** FK 3059 still includes hours on a day where a whole-guardian absence was recorded.

### Pitfall 3: Calendar Year Boundary for Multi-Month Absences
**What goes wrong:** An absence recorded as 2025-12-28 to 2026-01-03 spans two calendar years. The VAB balance query using `startDate >= '2026-01-01' AND endDate <= '2026-12-31'` misses this record entirely.
**Why it happens:** Strict equality on both ends excludes cross-year records.
**How to avoid:** For VAB/sick balance queries, check if the absence *overlaps* the target year: `startDate <= '2026-12-31' AND endDate >= '2026-01-01'`. Then clip the day count to the year boundary: days within 2026 = min(endDate, Dec 31) − max(startDate, Jan 1) + 1.
**Warning signs:** Balance appears 0 for January after a December-spanning absence.

### Pitfall 4: FK 3059 Absent Entries Still Appearing in Shift Grid
**What goes wrong:** The FK 3059 PDF fills shift rows from `monthEntries`. If cancelled entries are not excluded, absent days appear on the form.
**Why it happens:** The current FK 3059 query filters `reqStatus = "approved"` — if "cancelled" is added to reqStatusEnum, cancelled entries are automatically excluded. But if the planner mistakenly adds absence exclusion only to the billable hour *totals* and not to the *shift row generation*, the form shows absent days in the shift grid.
**How to avoid:** Apply absence exclusion to the full `monthEntries` result before both shift-row filling and total accumulation.

### Pitfall 5: pgEnum Migrations Require Specific Drizzle Push Sequence
**What goes wrong:** Adding a new value to an existing PostgreSQL enum (e.g., `"cancelled"` to `reqStatusEnum`) requires an `ALTER TYPE ... ADD VALUE` statement, not a DROP/RECREATE. `drizzle-kit push` handles this correctly in recent versions, but may fail if the enum is referenced in production with active rows.
**Why it happens:** PostgreSQL cannot drop an enum type that has existing rows using it.
**How to avoid:** Run `npm run db:push` on a clean development database first. If production already has rows with the old enum values, the push will work because `ADD VALUE` is additive (no existing values removed).
**Warning signs:** `drizzle-kit push` errors with "cannot drop type" or "enum has dependents."

### Pitfall 6: guardianId Scope Mismatch
**What goes wrong:** The `absences` table stores `guardianId` as `integer` (the `auth.id`), but `req.userId` from the JWT is also an integer — this matches. However, `assistants`, `entries`, and other tables do NOT have a `guardianId` column (single-tenant assumption). The absence auto-cancel logic that queries `entries` cannot scope by `guardianId` and instead relies on `assistantId` (which is guardian-scoped implicitly in a single-tenant deployment).
**Why it happens:** The existing tables were designed single-tenant; absences is the first multi-tenant-aware table.
**How to avoid:** Accept the inconsistency for Phase 2 (single guardian deployment). Note this in code comments. Multi-tenant isolation across all tables is a v2 concern (MULTI-01).
**Warning signs:** N/A for single-tenant. Would manifest in v2 if a second guardian is added.

---

## Code Examples

### Absence Balance Computation (application-code approach)
```typescript
// Source: derived from entries.ts pattern + CONTEXT.md D-03/D-04
function computeDays(startDate: string, endDate: string): number {
  const start = new Date(startDate).getTime();
  const end   = new Date(endDate).getTime();
  return Math.round((end - start) / 86_400_000) + 1;
}

function vabBalance(vabAbsences: Array<{ startDate: string; endDate: string }>, year: number): number {
  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;
  const days = vabAbsences.reduce((sum, a) => {
    // Clip to year boundaries
    const clippedStart = a.startDate < yearStart ? yearStart : a.startDate;
    const clippedEnd   = a.endDate   > yearEnd   ? yearEnd   : a.endDate;
    if (clippedStart > clippedEnd) return sum;
    return sum + computeDays(clippedStart, clippedEnd);
  }, 0);
  return 120 - days;
}
```

### Auto-Cancel Overlapping Shifts (POST /api/absences handler)
```typescript
// Source: derived from entries.ts update pattern (lines 56-71)
const overlapping = await db.select().from(entries).where(
  and(
    ...(assistantId
      ? [eq(entries.assistantId, assistantId)]
      : []                                         // null = all assistants
    ),
    gte(entries.date, startDate),
    lte(entries.date, endDate),
    eq(entries.reqStatus, "approved"),
  )
);

if (overlapping.length > 0) {
  await db.update(entries)
    .set({ reqStatus: "cancelled", updatedAt: new Date() })
    .where(
      and(
        ...(assistantId ? [eq(entries.assistantId, assistantId)] : []),
        gte(entries.date, startDate),
        lte(entries.date, endDate),
        eq(entries.reqStatus, "approved"),
      )
    );
}
```

### React Query Pattern for Absence List (Leave.tsx)
```typescript
// Source: Assistants.tsx lines 24-26 pattern
const { data: absenceList = [] } = useQuery({
  queryKey: ["absences"],
  queryFn: () => absenceApi.list().then((r) => r.data),
});

const createAbsence = useMutation({
  mutationFn: (data: Record<string, unknown>) => absenceApi.create(data),
  onSuccess: () => {
    qc.invalidateQueries({ queryKey: ["absences"] });
    setDialogOpen(false);
  },
});
```

---

## Environment Availability

Step 2.6: SKIPPED — Phase 2 has no new external dependencies. All required tools (PostgreSQL, Node.js, npm) are operational since Phase 1 completed successfully.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 [VERIFIED: server/package.json] |
| Config file | `server/vitest.config.ts` (exists, configured) |
| Quick run command | `cd server && npm test` |
| Full suite command | `cd server && npm run test:coverage` |
| Test location | `server/src/routes/__tests__/*.test.ts` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| LEAV-01 | POST /api/absences creates record with correct type, startDate, endDate | unit (route mock) | `cd server && npm test -- --reporter=verbose` | No — Wave 0 gap |
| LEAV-01 | POST /api/absences with invalid type returns 400 | unit (route mock) | same | No — Wave 0 gap |
| LEAV-01 | POST /api/absences auto-cancels overlapping approved shifts | unit (route mock) | same | No — Wave 0 gap |
| LEAV-01 | DELETE /api/absences/:id removes absence record | unit (route mock) | same | No — Wave 0 gap |
| LEAV-02 | FK 3059 billable hours exclude absent-day entries | unit (pure function or route mock) | same | No — Wave 0 gap |
| LEAV-02 | FK 3057 total hours exclude absent-day entries for all assistants | unit (pure function) | same | No — Wave 0 gap |
| LEAV-02 | Absence with null assistantId excludes hours for all assistants in FK reports | unit | same | No — Wave 0 gap |
| LEAV-03 | GET /api/absences/balance/:id returns correct VAB days remaining | unit | same | No — Wave 0 gap |
| LEAV-03 | VAB balance clips cross-year absences to calendar year | unit (pure function) | same | No — Wave 0 gap |
| LEAV-03 | Sick leave YTD count returns total days, no cap | unit | same | No — Wave 0 gap |

### Sampling Rate
- **Per task commit:** `cd server && npm test`
- **Per wave merge:** `cd server && npm run test:coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/src/routes/__tests__/absences.test.ts` — covers LEAV-01 (create, validate, auto-cancel, delete)
- [ ] `server/src/routes/__tests__/absences-billing.test.ts` — covers LEAV-02 (FK exclusion logic as pure functions)
- [ ] `server/src/routes/__tests__/absences-balance.test.ts` — covers LEAV-03 (VAB day computation, sick YTD, cross-year clipping)

**Test approach for LEAV-02:** Extract the billing exclusion filter into a pure function (e.g., `filterBillableEntries(entries, absences)`) before applying it in the PDF route. Test the function in isolation — no HTTP, no PDF generation, no qpdf binary dependency.

**Test approach for LEAV-03:** Extract `vabBalance(absences, year)` and `sickYtd(absences, year)` as pure functions. Test edge cases: empty list, cross-year absence, exactly 120 days used.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `drizzle-kit push` (schema-push, not migration files) is the deployment pattern for this project | Standard Stack | If the project has switched to migration files, the Wave 0 plan needs a `drizzle-kit generate` + `migrate` step instead. Mitigate: check if `server/drizzle/` directory has any SQL files (it is empty per glob search [VERIFIED]). |
| A2 | `req.userId` (integer from JWT) is the correct guardianId to store on the absences table | Critical Implementation Details §6 | If the guardian identity changes (e.g., multi-tenant v2 adds a separate guardian table), the FK needs updating. Acceptable risk for Phase 2 single-tenant scope. |
| A3 | Lucide `CalendarOff` icon exists in the installed version | Standard Stack | Icon name may differ; verify with `import { CalendarOff } from "lucide-react"` — if missing, use `Calendar` or `Ban` as fallback. |

---

## Sources

### Primary (HIGH confidence — verified directly in codebase)
- `server/src/db/schema.ts` — Full schema: all existing enums, tables, type exports
- `server/src/routes/pdf.ts` — FK 3059 (lines 55-195) and FK 3057 (lines 198-257) billing query structure
- `server/src/routes/entries.ts` — Route pattern to replicate for absences.ts
- `server/src/routes/assistant.ts` — Self-service endpoints where absence block must be added
- `server/src/middleware/auth.ts` — Auth middleware signatures, req.userId/role/assistantId fields
- `server/src/lib/id.ts` — newId() function for ID generation
- `server/src/index.ts` — Router mount pattern for new routes
- `client/src/components/Layout.tsx` — Nav array structure for adding "Frånvaro" entry
- `client/src/App.tsx` — Guardian route block for adding /leave route
- `client/src/lib/api.ts` — API namespace pattern to replicate for absenceApi
- `client/src/pages/Assistants.tsx` — Card/dialog pattern for Leave page UI
- `server/vitest.config.ts` — Test framework config (include path, env vars)
- `server/package.json` — Installed dependencies and npm scripts
- `server/drizzle.config.ts` — Migration mode: schema-push

### Secondary (MEDIUM confidence)
- `.planning/phases/02-leave-absence-foundation/02-CONTEXT.md` — All locked decisions
- `.planning/REQUIREMENTS.md` — LEAV-01, LEAV-02, LEAV-03 definitions

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified in package.json
- Architecture: HIGH — verified in all route and client files
- Billing exclusion pattern: HIGH — verified against actual FK query code
- VAB day computation: HIGH — straightforward date arithmetic, verified logic
- Pitfalls: HIGH — derived from code inspection, not assumed

**Research date:** 2026-04-06
**Valid until:** 2026-05-06 (stable codebase, no fast-moving dependencies)
