# Phase 3: Payroll Calculation & Recording - Research

**Researched:** 2026-04-09
**Domain:** Swedish payroll calculation, Drizzle ORM schema extension, Express route patterns, React payroll UI
**Confidence:** HIGH — all findings verified against live codebase

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Two new tables: `payroll_records` (one row per assistant per month) and `payments` (one row per payment, references payroll record). The existing `costs` table is structurally wrong for this.
- **D-02:** Hourly rate and employer tax rate are **snapshotted into `payroll_records` at generation time**, not re-read from env var on each fetch.
- **D-03:** Single-tenant table pattern — no `guardianId` column on `payroll_records` or `payments`. Data isolation enforced at route level via `requireGuardian` middleware.
- **D-04:** Payroll math lives in `server/src/lib/payroll-utils.ts` — pure functions, no DB imports, parallel to `absence-utils.ts`.
- **D-05:** Billable hours MUST reuse `filterBillableEntries` from `server/src/lib/absence-utils.ts`. No divergence from FK form figures is acceptable.
- **D-06:** Flat 31.42% employer contribution rate for all assistants in Phase 3. Age-based rates deferred.
- **D-07:** Karensdag deduction not implemented in Phase 3. Deferred to Phase 5.
- **D-08:** New `/payroll` route and `client/src/pages/Payroll.tsx` page, not embedded in `Reports.tsx`. Added to guardian sidebar nav.
- **D-09:** Month selector at top, one card per assistant showing billable hours, absence hours by type, gross pay, employer contributions, total employer cost, outstanding payment balance.
- **D-10:** Approval via inline "Approve" button. Once approved, becomes "Approved ✓" (locked, disabled).
- **D-11:** Payment recording inline within assistant card (no modal). "Lägg till betalning" toggle shows/hides Add Payment form.
- **D-12:** Two new route files: `server/src/routes/payroll.ts` and `server/src/routes/payments.ts`.
  - `GET /api/payroll?month=YYYY-MM`, `POST /api/payroll/generate`, `POST /api/payroll/:id/approve`
  - `GET /api/payments?payrollId=`, `POST /api/payments`, `DELETE /api/payments/:id`
- **D-13:** `payroll_records` status enum: `draft | approved`. Approve endpoint rejects if already approved. No separate audit log table in Phase 3.

### Claude's Discretion

- Exact `payroll_records` and `payments` schema column names (beyond what's implied above)
- Loading/empty state design
- Error handling for approval of months with no entries

### Deferred Ideas (OUT OF SCOPE)

- Printable payslip (PDF per assistant per month)
- Age-based employer contribution rates (10.21% for 67+, 17.77% for 19–23)
- Karensdag deduction
- Adjustment tracking / audit trail beyond status lock
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PAY-01 | System calculates gross pay per assistant for a given month (approved billable hours × configured hourly rate) and employer social security contributions (31.42% standard rate) | `payroll-utils.ts` pure functions; rate snapshotted from `/api/rates`; `filterBillableEntries` reused from `absence-utils.ts` |
| PAY-02 | Guardian can view payroll summary per assistant per month: billable hours, absence hours by type, gross pay, employer contributions, total employer cost | `Payroll.tsx` card layout per UI-SPEC; `GET /api/payroll?month=YYYY-MM` returns pre-calculated rows |
| PAY-03 | Guardian can record a payment made to an assistant (date, amount, method) and system shows outstanding balance vs. calculated gross | `payments` table + `POST /api/payments`; balance = grossPay - sum(payments.amountSek); inline Add Payment form in card |
</phase_requirements>

---

## Summary

Phase 3 adds payroll calculation and payment recording on top of the Phase 2 absence foundation. The codebase is well-structured for this extension — the absence utility pattern, route-per-domain pattern, and API client pattern all have clear templates to follow.

The key technical work is: (1) two new Drizzle schema tables with a new pgEnum for payroll status, (2) a `payroll-utils.ts` pure function module, (3) two new Express route files, (4) a `Payroll.tsx` page with an inline payment history sub-form, and (5) wiring everything together in `index.ts`, `App.tsx`, `Layout.tsx`, and `api.ts`.

The biggest correctness risk is ensuring payroll billable hours are computed identically to FK form billable hours — this is satisfied by the locked decision to reuse `filterBillableEntries` directly. The second risk is numeric formatting: Swedish locale (comma decimal separator, non-breaking space thousands separator) must be applied consistently per the UI-SPEC.

**Primary recommendation:** Follow the existing absence phase blueprint exactly — Wave 0 (test stubs), Wave 1 (schema + migration), Wave 2 (server routes), Wave 3 (client page + nav wire-up). No new libraries needed.

---

## Standard Stack

### Core (already installed — verified against codebase)

| Library | Version | Purpose | Verified By |
|---------|---------|---------|-------------|
| drizzle-orm | installed | Schema definition and DB queries | `[VERIFIED: server/src/db/schema.ts]` |
| drizzle-kit | installed | `db push` migrations | `[VERIFIED: server/package.json]` |
| express | installed | Route handlers | `[VERIFIED: server/src/index.ts]` |
| zod | installed | Request body validation (see absences.ts pattern) | `[VERIFIED: server/src/routes/absences.ts line 12]` |
| @tanstack/react-query | installed | Server state on client | `[VERIFIED: client/src/App.tsx]` |
| axios | installed | HTTP client via `api.ts` | `[VERIFIED: client/src/lib/api.ts line 1]` |
| lucide-react | installed | Icons (add `Banknote` for nav) | `[VERIFIED: client/src/components/Layout.tsx line 6]` |

### No New Libraries Required

All component primitives needed (Card, Button, Input, Label, Badge, Separator, PageHeader, SectionLabel, EmptyState, AssistantAvatar) are present in the existing custom component library established in Phase 2.5. `[VERIFIED: client/src/components/shared.tsx, client/src/components/ui/]`

**Installation:** None required — all dependencies already present.

---

## Architecture Patterns

### Recommended Project Structure for New Files

```
server/src/
├── lib/
│   └── payroll-utils.ts        # NEW: pure payroll math (parallel to absence-utils.ts)
├── routes/
│   ├── payroll.ts              # NEW: payroll_records CRUD + approve endpoint
│   └── payments.ts             # NEW: payments CRUD
├── db/
│   └── schema.ts               # EXTEND: add payrollStatusEnum, payroll_records, payments tables

client/src/
├── pages/
│   └── Payroll.tsx             # NEW: /payroll route page
├── lib/
│   └── api.ts                  # EXTEND: add payrollApi, paymentsApi typed helpers
├── components/
│   └── Layout.tsx              # EXTEND: add Löner nav item with Banknote icon
App.tsx                         # EXTEND: add /payroll Route
```

### Pattern 1: Pure Utility Module (server/src/lib/payroll-utils.ts)

**What:** A module of pure TypeScript functions with no DB imports. Inputs are plain objects, outputs are calculated numbers. Mirrors `absence-utils.ts` exactly.

**When to use:** Any server-side calculation that must be (a) testable without a database, (b) shareable across multiple route files, and (c) guaranteed to stay consistent with FK form calculations.

**Example (from established pattern in absence-utils.ts):**
```typescript
// Source: [VERIFIED: server/src/lib/absence-utils.ts]
// New payroll-utils.ts follows identical contract:

export type PayrollInput = {
  billableHours: number;
  hourlyRate:    number;
  taxRate:       number; // e.g. 0.3142
};

export type PayrollResult = {
  grossPay:              number;
  employerContributions: number;
  totalEmployerCost:     number;
};

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const grossPay              = input.billableHours * input.hourlyRate;
  const employerContributions = grossPay * input.taxRate;
  const totalEmployerCost     = grossPay + employerContributions;
  return { grossPay, employerContributions, totalEmployerCost };
}
```

### Pattern 2: Route File Structure (server/src/routes/payroll.ts)

**What:** Single-domain Express router. All endpoints protected with `requireAuth, requireGuardian`. Zod validation on POST bodies. Error caught and returned as `{ error: "Internal server error" }`.

**When to use:** Every new API domain gets its own route file.

**Example (from established pattern in absences.ts):**
```typescript
// Source: [VERIFIED: server/src/routes/absences.ts]
import { Router }                              from "express";
import { z }                                  from "zod";
import { db }                                 from "../db";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";

const router = Router();

// Zod schema for POST body validation
const GeneratePayrollSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/), // YYYY-MM
});

router.post("/generate", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const parsed = GeneratePayrollSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
    }
    // ... implementation
  } catch (e) {
    console.error("[payroll] generate error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
```

### Pattern 3: Drizzle Schema Extension

**What:** New tables and enums added to `server/src/db/schema.ts`. New enum uses `pgEnum` pattern. New tables use `text` IDs (generated with `newId()`), foreign key references with `onDelete: "cascade"`, and `timestamp` for `createdAt`.

**When to use:** Every new table extends the single schema file.

**Proposed schema for `payroll_records` and `payments`:**
```typescript
// Source: [VERIFIED: server/src/db/schema.ts — existing enum/table patterns]
export const payrollStatusEnum = pgEnum("payroll_status", ["draft", "approved"]);

export const payrollRecords = pgTable("payroll_records", {
  id:                   text("id").primaryKey(),
  assistantId:          text("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  month:                text("month").notNull(),          // YYYY-MM
  billableHours:        real("billable_hours").notNull(),
  hourlyRateSnapshot:   real("hourly_rate_snapshot").notNull(),
  taxRateSnapshot:      real("tax_rate_snapshot").notNull(),
  grossPay:             real("gross_pay").notNull(),
  employerContributions:real("employer_contributions").notNull(),
  totalEmployerCost:    real("total_employer_cost").notNull(),
  status:               payrollStatusEnum("status").default("draft"),
  approvedAt:           timestamp("approved_at"),
  createdAt:            timestamp("created_at").defaultNow(),
  updatedAt:            timestamp("updated_at").defaultNow(),
});

export const paymentMethodEnum = pgEnum("payment_method", ["bankgiro", "swish", "kontant"]);

export const payments = pgTable("payments", {
  id:             text("id").primaryKey(),
  payrollRecordId:text("payroll_record_id").notNull().references(() => payrollRecords.id, { onDelete: "cascade" }),
  assistantId:    text("assistant_id").notNull(),  // denormalised for query convenience
  date:           text("date").notNull(),           // YYYY-MM-DD
  amountSek:      real("amount_sek").notNull(),
  method:         paymentMethodEnum("method").notNull(),
  createdAt:      timestamp("created_at").defaultNow(),
});
```

**Column name rationale:**
- `hourlyRateSnapshot` / `taxRateSnapshot` — follows D-02: values frozen at generation time so that approved records remain immutable even when env vars change.
- `approvedAt` — nullable timestamp for audit purposes; set when status transitions to `approved`.
- `payrollRecordId` on payments — FK to `payroll_records.id`; allows `GET /api/payments?payrollId=` query without joining.
- `assistantId` denormalised on payments — allows querying all payments for an assistant without joining through payroll_records. Trade-off: must be kept in sync at insert time (low risk: set once on create, never updated).

### Pattern 4: Route Registration (server/src/index.ts)

**What:** Import new router and mount at `/api/payroll` and `/api/payments`. Follows exact pattern of existing routes.

**Example:**
```typescript
// Source: [VERIFIED: server/src/index.ts lines 17-45]
import payrollRoutes  from "./routes/payroll";
import paymentsRoutes from "./routes/payments";

app.use("/api/payroll",  payrollRoutes);
app.use("/api/payments", paymentsRoutes);
```

### Pattern 5: Client API Helpers (client/src/lib/api.ts)

**What:** Typed Axios wrapper functions following existing `absenceApi` pattern. Return type annotations on GET endpoints. All paths relative to `/api`.

**Example:**
```typescript
// Source: [VERIFIED: client/src/lib/api.ts lines 143-152]
export type PayrollRecord = {
  id: string;
  assistantId: string;
  month: string;          // YYYY-MM
  billableHours: number;
  hourlyRateSnapshot: number;
  taxRateSnapshot: number;
  grossPay: number;
  employerContributions: number;
  totalEmployerCost: number;
  status: "draft" | "approved";
  approvedAt: string | null;
  createdAt: string;
};

export type Payment = {
  id: string;
  payrollRecordId: string;
  assistantId: string;
  date: string;
  amountSek: number;
  method: "bankgiro" | "swish" | "kontant";
  createdAt: string;
};

export const payrollApi = {
  list:     (month: string) => api.get<PayrollRecord[]>("/payroll", { params: { month } }),
  generate: (month: string) => api.post<PayrollRecord[]>("/payroll/generate", { month }),
  approve:  (id: string)    => api.post<PayrollRecord>(`/payroll/${id}/approve`),
};

export const paymentsApi = {
  list:   (payrollRecordId: string) => api.get<Payment[]>("/payments", { params: { payrollRecordId } }),
  create: (data: { payrollRecordId: string; assistantId: string; date: string; amountSek: number; method: string }) =>
    api.post<Payment>("/payments", data),
  delete: (id: string) => api.delete<{ ok: boolean }>(`/payments/${id}`),
};
```

### Pattern 6: Client Sidebar Nav (client/src/components/Layout.tsx)

**What:** Add one object to the `nav` array. Use `Banknote` icon from lucide-react.

**Example:**
```typescript
// Source: [VERIFIED: client/src/components/Layout.tsx lines 6-16]
import { ..., Banknote } from "lucide-react";

const nav = [
  { to: "/dashboard",  label: "Dashboard",  icon: LayoutDashboard },
  { to: "/calendar",   label: "Schedule",    icon: CalendarDays },
  { to: "/leave",      label: "Frånvaro",   icon: CalendarOff },
  { to: "/payroll",    label: "Löner",       icon: Banknote },      // NEW
  { to: "/reports",    label: "Reports",     icon: FileText },
  { to: "/assistants", label: "Assistants",  icon: Users },
  { to: "/settings",   label: "Settings",    icon: Settings },
];
```

### Pattern 7: App.tsx Route Registration

**What:** Add `/payroll` route inside the guardian route group. Matches `/leave` pattern.

```typescript
// Source: [VERIFIED: client/src/App.tsx lines 76-87]
import PayrollPage from "@/pages/Payroll";

// inside the guardian Layout route group:
<Route path="/payroll" element={<PayrollPage />} />
```

### Pattern 8: Generate Endpoint — Billable Hours Calculation

**What:** The `POST /api/payroll/generate` endpoint must query entries and absences exactly as `pdf.ts` does, then call `filterBillableEntries`. This ensures PAY figures match FK form figures.

**Example (derived from pdf.ts pattern):**
```typescript
// Source: [VERIFIED: server/src/routes/pdf.ts lines 77-103]
// For each assistant in month:
const monthEntries = await db.select().from(entries)
  .where(and(
    eq(entries.assistantId, assistantId),
    gte(entries.date, monthStart),
    lte(entries.date, monthEnd),
    eq(entries.reqStatus, "approved"),
  ));

const monthAbsences = await db.select({
  assistantId: absences.assistantId,
  startDate:   absences.startDate,
  endDate:     absences.endDate,
  absenceType: absences.absenceType,
}).from(absences).where(
  and(
    or(eq(absences.assistantId, assistantId), isNull(absences.assistantId)),
    lte(absences.startDate, monthEnd),
    gte(absences.endDate, monthStart),
  )
);

const billableEntries = filterBillableEntries(monthEntries, monthAbsences);
const billableHours = billableEntries.reduce((s, e) => s + e.hours, 0);
```

### Pattern 9: Absence Hours Breakdown for UI Display

**What:** The payroll card shows absence hours by type. This requires summing absence hours per type for the month. The absence table stores date ranges, not hours — hours must be computed by day-counting within the month window and estimating average daily hours OR by counting absent entry hours directly from the entries that were filtered out.

**Recommended approach:** Compute absence hours as (total approved entry hours) minus (billable entry hours). For per-type breakdown, map filtered-out entries back to their absence reason. However, this is complex because a single entry date can overlap multiple absences.

**Simpler correct approach:** Sum hours of entries that WERE filtered out (i.e., `allEntries - billableEntries`), then attribute each non-billable entry to its matching absence type by date lookup. This is the correct approach and matches what FK forms already do.

```typescript
// Pseudo-code for absence breakdown:
const absenceEntries = monthEntries.filter(e => !billableEntries.some(b => b.id === e.id));
const absenceByType: Record<string, number> = {};
for (const e of absenceEntries) {
  const matchingAbsence = monthAbsences.find(a =>
    (a.assistantId === null || a.assistantId === assistantId) &&
    e.date >= a.startDate && e.date <= a.endDate
  );
  const type = matchingAbsence?.absenceType ?? "other";
  absenceByType[type] = (absenceByType[type] ?? 0) + e.hours;
}
```

**Storage decision:** The absence breakdown can be stored as a JSON column on `payroll_records` (e.g., `absenceBreakdown text` storing serialised JSON) or recomputed on each GET. Given the locked immutability requirement for approved records (D-02), storing it as a snapshot at generation time is consistent with the snapshot principle. Recommend a `absence_breakdown_json` text column.

### Anti-Patterns to Avoid

- **Re-reading rates from env on each fetch:** D-02 prohibits this. Always use the snapshotted values in `payroll_records`.
- **Building custom billable hours logic:** D-05 requires reusing `filterBillableEntries` verbatim. Any divergence creates a compliance gap between payroll figures and FK form figures.
- **Calling `generate` more than once for the same assistant/month pair:** The generate endpoint must check for an existing record first and return an error (or idempotently return the existing one) to prevent duplicate rows.
- **Storing absence hours as calendar days (not entry hours):** The pay calculation is hours × rate; use the actual filtered entry hours, not a calendar-day estimate.
- **Swedish number formatting with `.toLocaleString()` without explicit locale:** Always use `new Intl.NumberFormat('sv-SE', ...)` — the host machine locale may differ. `[VERIFIED: 03-UI-SPEC.md]`

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Billable hours computation | Custom filter logic | `filterBillableEntries` from `absence-utils.ts` | Divergence creates FK form mismatch — compliance risk |
| Request body validation | Manual `if (!body.month)` checks | Zod `.safeParse()` | Type-safe, returns structured error messages |
| Rate lookup | Re-query env vars | Snapshot values from `payroll_records` row | Approved records must be immutable |
| ID generation | `uuid()` or `Date.now()` | `newId("pr")` from `server/src/lib/id.ts` | Consistent with all other table IDs in codebase |
| Swedish number formatting | Custom string replacement | `Intl.NumberFormat('sv-SE')` | Handle edge cases (decimals, thousands, negative) |

**Key insight:** The payroll math itself is trivially simple (multiplication), but the correctness comes from using the exact same entry+absence pipeline that the FK PDF generation uses. The hard part is not the math — it is the data pipeline.

---

## Common Pitfalls

### Pitfall 1: Duplicate Payroll Record on Re-generation

**What goes wrong:** Guardian clicks "Generera löneunderlag" twice for the same month. Two `payroll_records` rows are inserted for the same assistant/month pair. GET then returns duplicates, causing doubled figures in the UI.

**Why it happens:** The generate endpoint inserts without checking for existence.

**How to avoid:** In `POST /api/payroll/generate`, query for existing `payroll_records` with matching `(assistantId, month)` before inserting. Either (a) return existing record with 200 if it exists, or (b) add a unique constraint `UNIQUE(assistant_id, month)` to the table and handle the conflict. Option (b) is more robust.

**Warning signs:** Total cost figures doubling when the page is refreshed after a second generate call.

### Pitfall 2: Outstanding Balance Calculation Race

**What goes wrong:** The outstanding balance (grossPay - sumPayments) is computed client-side from separate API calls — one for payroll records and one for payments. If the payments query returns stale data (React Query cache), the balance appears incorrect.

**Why it happens:** React Query default stale time. Two separate query keys that don't invalidate each other.

**How to avoid:** After `POST /api/payments` or `DELETE /api/payments/:id` succeeds, invalidate both the `["payments", payrollRecordId]` query AND the parent `["payroll", month]` query (so skeleton refreshes). Alternatively, include `sumPayments` in the payroll GET response as a computed field — simpler and avoids the race entirely.

**Recommendation:** Include `totalPaid` as a computed field in `GET /api/payroll` response by joining payments at query time. This is one extra DB join but eliminates the race.

### Pitfall 3: Approve Endpoint Not Checking Existing Status

**What goes wrong:** Two rapid POST requests to `/api/payroll/:id/approve` succeed (first sets status to `approved`, second also succeeds because status check wasn't strict enough). Or a network retry re-approves.

**Why it happens:** The approve handler reads status after the lock is released by the first request.

**How to avoid:** Use a conditional update: `UPDATE payroll_records SET status='approved', approved_at=NOW() WHERE id=:id AND status='draft' RETURNING *`. If `RETURNING` returns 0 rows, the record was already approved — return 409 Conflict. `[VERIFIED: D-13 in CONTEXT.md]`

### Pitfall 4: Swedish Locale Formatting — Wrong Decimal Separator

**What goes wrong:** `15234.5` displays as `15,234.5` (English format) instead of `15 234,5` (Swedish format). This is a compliance display issue.

**Why it happens:** Calling `toLocaleString()` without locale, or `toFixed()` and then formatting manually.

**How to avoid:**
```typescript
// Source: [VERIFIED: 03-UI-SPEC.md — Numeric Formatting Rules]
// For currency:
new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 }).format(amount) + ' kr'
// For hours:
`${Math.round(hours * 10) / 10}h`.replace('.', ',')
```

### Pitfall 5: Absence Breakdown Stored as Recomputed — Changes After Approval

**What goes wrong:** Absence breakdown is recomputed on every GET. After an absence record is deleted or modified, the breakdown on an approved payroll record changes retroactively — violating the immutability of approved records.

**Why it happens:** Not snapshotting the breakdown at generation time (same problem as not snapshotting rates).

**How to avoid:** Store `absence_breakdown_json` as a text column in `payroll_records`, populated at generation time. Return it as parsed JSON in GET responses. Immutability for approved records is then guaranteed.

### Pitfall 6: `payroll_records` Missing Unique Constraint

**What goes wrong:** Two records exist for the same `(assistant_id, month)` pair. ORM queries return ambiguous results; balance calculation doubles.

**How to avoid:** Add a Drizzle `uniqueIndex("payroll_records_assistant_month_idx", [payrollRecords.assistantId, payrollRecords.month])` when defining the table.

---

## Code Examples

### Billable hours query (reusing the established pdf.ts pattern)

```typescript
// Source: [VERIFIED: server/src/routes/pdf.ts lines 77-103]
const mm    = month.slice(5, 7);      // "03" from "2026-03"
const year  = month.slice(0, 4);      // "2026"
const start = `${year}-${mm}-01`;
const daysInMonth = new Date(parseInt(year), parseInt(mm), 0).getDate();
const end   = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;

const monthEntries = await db.select().from(entries)
  .where(and(
    eq(entries.assistantId, assistantId),
    gte(entries.date, start),
    lte(entries.date, end),
    eq(entries.reqStatus, "approved"),
  ));

const monthAbsences = await db.select({
  assistantId: absences.assistantId,
  startDate:   absences.startDate,
  endDate:     absences.endDate,
  absenceType: absences.absenceType,
}).from(absences).where(
  and(
    or(eq(absences.assistantId, assistantId), isNull(absences.assistantId)),
    lte(absences.startDate, end),
    gte(absences.endDate, start),
  )
);

const billable = filterBillableEntries(monthEntries, monthAbsences);
const billableHours = billable.reduce((s, e) => s + e.hours, 0);
```

### Payroll math (payroll-utils.ts)

```typescript
// Follows [VERIFIED: server/src/lib/absence-utils.ts] pure-function pattern
export function calculatePayroll(billableHours: number, hourlyRate: number, taxRate: number) {
  const grossPay              = billableHours * hourlyRate;
  const employerContributions = grossPay * taxRate;
  const totalEmployerCost     = grossPay + employerContributions;
  return { grossPay, employerContributions, totalEmployerCost };
}
```

### Rate snapshot (from /api/rates)

```typescript
// Source: [VERIFIED: server/src/routes/misc.ts lines 11-12]
// At generate time, read the current rate values:
const FK_HOURLY_RATE    = parseFloat(process.env.FK_HOURLY_RATE    ?? "334");
const EMPLOYER_TAX_RATE = parseFloat(process.env.EMPLOYER_TAX_RATE ?? "0.3142");
// Then snapshot into payroll_records row:
// hourlyRateSnapshot: FK_HOURLY_RATE, taxRateSnapshot: EMPLOYER_TAX_RATE
```

### Approve endpoint (conditional update pattern)

```typescript
// Safe idempotent approve — rejects if already approved
router.post("/:id/approve", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const [updated] = await db
      .update(payrollRecords)
      .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
      .where(and(
        eq(payrollRecords.id, req.params.id),
        eq(payrollRecords.status, "draft"),  // only update if still draft
      ))
      .returning();

    if (!updated) {
      // Either not found OR already approved
      const [existing] = await db.select().from(payrollRecords)
        .where(eq(payrollRecords.id, req.params.id)).limit(1);
      if (!existing) return res.status(404).json({ error: "Payroll record not found" });
      return res.status(409).json({ error: "Det här löneunderlaget är redan godkänt och kan inte ändras." });
    }
    res.json(updated);
  } catch (e) {
    console.error("[payroll] approve error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});
```

### Swedish number formatting helper (client-side)

```typescript
// Source: [VERIFIED: 03-UI-SPEC.md — Numeric Formatting Rules]
export function formatSEK(amount: number): string {
  const formatted = new Intl.NumberFormat('sv-SE', {
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
  return `${formatted} kr`;
}

export function formatHours(hours: number): string {
  const rounded = Math.round(hours * 10) / 10;
  return `${rounded}h`.replace('.', ',');
}
```

### Absence breakdown computation in generate endpoint

```typescript
// Derive per-type absence hours from filtered-out entries
const absenceEntries = monthEntries.filter(
  e => !billable.some(b => b.id === e.id)
);
const absenceByType: Record<string, number> = {};
for (const e of absenceEntries) {
  const match = monthAbsences.find(a =>
    (a.assistantId === null || a.assistantId === e.assistantId) &&
    e.date >= a.startDate && e.date <= a.endDate
  );
  const type = match?.absenceType ?? "other";
  absenceByType[type] = (absenceByType[type] ?? 0) + e.hours;
}
// Store as: JSON.stringify(absenceByType) → absence_breakdown_json column
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Inline cost calculations in Reports.tsx component | Pure functions in `server/src/lib/` | Phase 2 research | Testable, reusable across routes |
| Hardcoded rates in React component | Rates served from `/api/rates`, snapshotted into payroll records | Phase 1 (STAB-03) | Configurable without redeploy |
| Manual number formatting | `Intl.NumberFormat('sv-SE')` | Phase 2.5 UI Spec | Swedish locale compliance |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `absence_breakdown_json` should be stored as text (serialised JSON) rather than a JSONB column | Architecture Patterns §Schema | JSONB might be cleaner for Drizzle; but text is safe and consistent with how existing string fields work |
| A2 | `assistantId` denormalised onto `payments` table is worth the trade-off | Architecture Patterns §Schema | If assistantId on payments drifts from payrollRecords.assistantId it could cause query issues; risk is low since it's set once |
| A3 | Including `totalPaid` as a computed field in GET /api/payroll response (via JOIN) is preferable to client-side aggregation | Common Pitfalls §Race | Server JOIN adds minor overhead; but eliminates client-side cache race |

**Low-risk assumptions:** All three are Claude's discretion areas per CONTEXT.md. The planner can choose the simpler alternative if preferred.

---

## Open Questions

1. **Generate endpoint: idempotent or error on duplicate?**
   - What we know: D-13 says approve endpoint rejects if already approved. No explicit guidance for generate.
   - What's unclear: If guardian generates, approves, then accidentally generates again for same month — should it silently return the approved record (safe), or error (explicit)?
   - Recommendation: Return existing record with 200 if a record already exists for `(assistantId, month)`. Prevents data corruption; guardian can see the existing record and its status.

2. **`absence_breakdown_json` vs. computed on-the-fly**
   - What we know: D-02 snapshots rates for immutability. Absence breakdown has the same mutability concern.
   - What's unclear: Whether the guardian expects the breakdown to reflect "what absences were recorded at generate time" vs. "current absences" (which could be edited later).
   - Recommendation: Snapshot at generate time (consistent with D-02 principle). Store as `absence_breakdown_json TEXT`.

3. **`totalPaid` in GET /api/payroll response**
   - What we know: Outstanding balance = grossPay - sum(payments). Client needs this.
   - What's unclear: Whether to compute server-side (JOIN) or return raw payments list and compute client-side.
   - Recommendation: Include `totalPaid` as a computed field in the GET response. Eliminates client-side cache race (Pitfall 2). One additional `SELECT SUM` per payroll record.

---

## Environment Availability

Step 2.6: SKIPPED — Phase 3 is code/schema changes only. No new external tools or services are required beyond what Phase 1–2 already depend on (PostgreSQL, Node.js, npm). All confirmed present and working since Phase 1 is complete.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest |
| Config file | `server/vitest.config.ts` |
| Quick run command | `cd server && npx vitest run src/lib/__tests__/payroll-utils.test.ts` |
| Full suite command | `cd server && npx vitest run` |

Test files live under `server/src/routes/__tests__/` and `server/src/lib/__tests__/`. `[VERIFIED: server/src/routes/__tests__/absences.test.ts]`

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAY-01 | `calculatePayroll()` returns correct grossPay, contributions, total for known inputs | unit | `cd server && npx vitest run src/lib/__tests__/payroll-utils.test.ts` | ❌ Wave 0 |
| PAY-01 | `calculatePayroll()` with 0 hours returns all zeros | unit | same | ❌ Wave 0 |
| PAY-01 | `filterBillableEntries` integration: entries in absence range excluded from payroll hours | unit | `cd server && npx vitest run src/lib/__tests__/payroll-utils.test.ts` | ❌ Wave 0 |
| PAY-02 | `GET /api/payroll?month=` returns 401 for unauthenticated request | unit | `cd server && npx vitest run src/routes/__tests__/payroll.test.ts` | ❌ Wave 0 |
| PAY-02 | `GET /api/payroll?month=` returns 403 for assistant role | unit | same | ❌ Wave 0 |
| PAY-02 | `POST /api/payroll/:id/approve` returns 409 if already approved | unit | same | ❌ Wave 0 |
| PAY-03 | `POST /api/payments` returns 401 for unauthenticated request | unit | `cd server && npx vitest run src/routes/__tests__/payments.test.ts` | ❌ Wave 0 |
| PAY-03 | `DELETE /api/payments/:id` returns 404 for non-existent id | unit | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd server && npx vitest run src/lib/__tests__/payroll-utils.test.ts`
- **Per wave merge:** `cd server && npx vitest run`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `server/src/lib/__tests__/payroll-utils.test.ts` — covers PAY-01 pure function tests
- [ ] `server/src/routes/__tests__/payroll.test.ts` — covers PAY-02 auth/status tests (skip DB integration tests until Wave 2)
- [ ] `server/src/routes/__tests__/payments.test.ts` — covers PAY-03 auth tests (skip DB integration tests until Wave 2)

These follow the exact Red-state stub pattern established in Phase 2 (`absences.test.ts` lines 1-18). `[VERIFIED: server/src/routes/__tests__/absences.test.ts]`

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireAuth` JWT middleware — already established in Phase 1 |
| V3 Session Management | no | JWT stateless — no session state to manage |
| V4 Access Control | yes | `requireGuardian` middleware on all payroll/payments endpoints |
| V5 Input Validation | yes | Zod schema on all POST request bodies (pattern from `absences.ts`) |
| V6 Cryptography | no | No new cryptographic operations |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Guardian A queries Guardian B's payroll data | Information Disclosure | Single-tenant: no `guardianId` column, isolation is enforced at route layer via `requireGuardian` (D-03). If multi-tenancy is added later, add `guardianId` FK then. |
| Payment amount injection (negative amount) | Tampering | Zod validation: `amountSek: z.number().positive()` — reject zero or negative amounts |
| Approve endpoint replay / double-approve | Tampering | Conditional update pattern: `WHERE status = 'draft'` — returns 409 on second call |
| Unauthenticated access to payroll data | Spoofing | `requireAuth` + `requireGuardian` on all endpoints — mirrors Phase 1 STAB-01 fix |

---

## Sources

### Primary (HIGH confidence)

- `[VERIFIED: server/src/db/schema.ts]` — existing table patterns, enum definitions, column types
- `[VERIFIED: server/src/lib/absence-utils.ts]` — pure function module pattern, `filterBillableEntries` signature
- `[VERIFIED: server/src/routes/absences.ts]` — route file pattern, Zod validation, guardianId scoping
- `[VERIFIED: server/src/routes/pdf.ts]` — billable hours query pattern with `filterBillableEntries`
- `[VERIFIED: server/src/routes/misc.ts]` — `/api/rates` endpoint, rate env var reading pattern
- `[VERIFIED: server/src/index.ts]` — route registration pattern
- `[VERIFIED: client/src/lib/api.ts]` — typed API helper pattern
- `[VERIFIED: client/src/components/Layout.tsx]` — nav array pattern
- `[VERIFIED: client/src/App.tsx]` — route registration pattern
- `[VERIFIED: server/vitest.config.ts]` — test framework config
- `[VERIFIED: server/src/routes/__tests__/absences.test.ts]` — Red-state stub pattern
- `[VERIFIED: .planning/phases/03-payroll-calculation-recording/03-CONTEXT.md]` — locked decisions
- `[VERIFIED: .planning/phases/03-payroll-calculation-recording/03-UI-SPEC.md]` — UI contract

### Secondary (MEDIUM confidence)

- `[ASSUMED]` Swedish 2026 employer contribution rate 31.42% — cross-referenced with STATE.md accumulated context which states "31.42% standard rate" and REQUIREMENTS.md PAY-01 which explicitly states "31.42% standard rate". The rate is locked in CONTEXT.md D-06.

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — verified against live codebase; no new libraries needed
- Architecture patterns: HIGH — all patterns derived from verified existing code
- Schema design: HIGH for column types/patterns; MEDIUM for the specific `absence_breakdown_json` approach (Claude's discretion)
- Pitfalls: HIGH — three of five pitfalls are race conditions and constraint violations that are predictable from the data model
- UI patterns: HIGH — UI-SPEC is approved and verified against existing component library

**Research date:** 2026-04-09
**Valid until:** Stable — no fast-moving dependencies. Re-verify if Drizzle ORM major version changes.
