# Architecture: Payroll, Tax Reporting, and Leave Management Integration

**Project:** Kalinga — Swedish personal assistance care management platform
**Researched:** 2026-04-06
**Scope:** Integrate payroll calculation, Skatteverket AGI reporting, and leave/absence management with existing Express + Drizzle/PostgreSQL architecture

## Executive Summary

The existing monorepo (Express REST API + React SPA) provides a solid foundation for adding payroll, tax reporting, and leave management. The primary architectural challenge is **data isolation**: time entries, leave records, and payroll calculations must be scoped to each guardian's account, enforcing multi-tenant separation at the database query level, not just routing.

**Recommended approach:** Layer payroll and leave management as distinct REST API modules (following the existing route pattern), backed by new Drizzle schema tables for absences, payroll records, and tax line items. Leave and absence data affects three downstream consumers: (1) billable hours calculation in FK reports, (2) gross-to-net payroll computation, and (3) AGI (Skatteverket) tax declaration items.

The build order prioritizes leave/absence foundation first (blocking accurate FK reports), then payroll calculation, then tax reporting. Multi-tenant scoping must be enforced at query time on all new tables.

---

## Recommended Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  React SPA (client/)                        │
├─────────────────────────────────────────────────────────────┤
│                  Express REST API (server/)                 │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Auth    │  │ Profile  │  │Assistant │  │Entries   │   │
│  │  Routes  │  │ Routes   │  │ Routes   │  │ Routes   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Absence │  │ Payroll  │  │  Costs   │  │   PDF    │   │
│  │ Routes   │  │ Routes   │  │ Routes   │  │ Routes   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│       ↓            ↓            ↓            ↓              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Middleware: requireGuardian, requireAuth           │  │
│  └──────────────────────────────────────────────────────┘  │
│       ↓                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Service Layer (new):                                │  │
│  │  • AbsenceService: record/validate absences         │  │
│  │  • PayrollService: calculate gross, contrib, net    │  │
│  │  • TaxReportService: generate AGI line items        │  │
│  │  • BillableHoursService: apply leave deductions     │  │
│  └──────────────────────────────────────────────────────┘  │
│       ↓                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Data Access (Drizzle ORM):                          │  │
│  │  • entries, assistants, profile (existing)          │  │
│  │  • absences, payroll_records, tax_declarations      │  │
│  │  • Guardian scope enforced on ALL queries            │  │
│  └──────────────────────────────────────────────────────┘  │
│       ↓                                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  PostgreSQL Database                                 │  │
│  │  (single tenant schema with guardianId foreign keys) │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Component Boundaries

#### 1. Absence/Leave Module (`server/src/routes/absences.ts` + service layer)

**Responsibility:**
- Record assistant absences (sick leave, VAB, holiday, other)
- Validate absence dates and durations
- Expose absence balance and history to guardians
- Exclude absences from billable hours in time entry calculations
- Feed absence data to payroll and tax reporting

**Communicates with:**
- Entries module (query billable hours excluding absences)
- Payroll module (absence affects net pay calculation)
- Tax reporting module (certain absences affect AGI line items)
- Profile module (holiday balance configuration per guardian)

**Database tables (new):**
- `absences`: `id`, `guardianId`, `assistantId`, `absenceType` (ENUM: sick, vab, holiday, other), `dateStart`, `dateEnd`, `durationDays`, `notes`, `createdAt`
- `absence_types`: `id`, `code`, `label`, `affectsBillable` (boolean), `affectsPayroll` (boolean)

**Key constraint:** All queries MUST filter by `guardianId` to enforce multi-tenant isolation.

#### 2. Payroll Module (`server/src/routes/payroll.ts` + service layer)

**Responsibility:**
- Calculate monthly payroll per assistant
- Compute gross pay (billable hours × rate) minus absences
- Calculate employer social contributions (arbetsgivaravgifter) per Swedish 2026 rates (31.42%, with age-based reductions for 67+)
- Apply tax deductions (preliminärskatt) per assistant
- Persist payroll records for audit trail and tax reporting
- Expose payroll summary to guardian (hours approved, rate, gross, contrib, deductions, net)

**Communicates with:**
- Entries module (approved billable hours)
- Absence module (hours to deduct)
- Profile module (rates, deductions per assistant, guardian employer tax ID)
- Costs module (reconciliation with monthly cost overview)
- Tax reporting module (consume payroll records for AGI)

**Database tables (new):**
- `payroll_records`: `id`, `guardianId`, `assistantId`, `month`, `year`, `billableHours`, `absenceHours`, `netBillableHours`, `hourlyRate`, `grossPay`, `employerTaxRate`, `employerContribution`, `preliminärskatt`, `netPay`, `status` (draft, approved, locked), `createdAt`, `approvedAt`
- `payroll_adjustments`: `id`, `payrollRecordId`, `type` (bonus, deduction), `amount`, `reason`

**Calculation logic:**
```
billableHours = sum of approved entry hours
absenceHours = sum of absence durations (excluding VAB and other non-deductible)
netBillableHours = billableHours - absenceHours

grossPay = netBillableHours × hourlyRate

// Age-based employer contribution (2026 rules)
employerTaxRate = 31.42% (standard)
  OR 10.21% if assistant age ≥ 67 at start of month
  OR 17.77% if assistant age 19–23 (youth reduction, April 2026+)

employerContribution = grossPay × employerTaxRate

netPay = grossPay - preliminärskatt (if applicable)

// Guardian sees: hours, rate, gross, employer contrib, tax deduction, net pay
```

**Key constraints:**
- All queries MUST filter by `guardianId`
- Payroll records must be immutable once approved (status="locked")
- Gross pay is derived from entries and absences at report-generation time; payroll_records is an audit snapshot

#### 3. Tax Reporting Module (`server/src/routes/tax-reports.ts` + service layer)

**Responsibility:**
- Generate AGI (arbetsgivardeklaration på individnivå) data per month per assistant
- Format data for Skatteverket submission (monthly by 12th of following month)
- Include gross pay, employer contributions, and tax deductions per assistant
- Handle 2026 changes: removal of fields 062/063, VAB reporting to Skatteverket, growth support exclusion
- Expose report data as structured JSON (printable or submittable format)
- Future: integrate with Skatteverket e-service API (currently out of scope, forms are print-and-submit)

**Communicates with:**
- Payroll module (consume payroll_records for each month/assistant)
- Absence module (VAB days must be reported to Skatteverket per 2025 legislation)
- Profile module (guardian employer ID, assistant tax info)
- PDF module (print-ready AGI forms)

**Database tables (new):**
- `tax_declarations`: `id`, `guardianId`, `month`, `year`, `generatedAt`, `status` (draft, submitted, confirmed)
- `tax_line_items`: `id`, `declarationId`, `assistantId`, `grossPay`, `employerContribution`, `preliminärskatt`, `vabDays` (reported per new 2026 rules), `metadata`

**Key constraints:**
- All queries MUST filter by `guardianId`
- VAB days must be summed from absences table with `absenceType = 'vab'`
- Fields 062/063 are NOT included (removed in 2026)
- Skatteverket submission deadline: 12th of month following pay month

#### 4. Billable Hours Service (shared utility in `server/src/services/billableHours.ts`)

**Responsibility:**
- Compute net billable hours for a given month/assistant by excluding approved absences
- Used by entries module (FK 3059 form generation) and payroll module
- Single source of truth for "what hours count toward FK and payroll?"

**Input:**
- `guardianId`, `assistantId`, `month`, `year`

**Output:**
```typescript
{
  totalApprovedHours: number,
  deductedAbsenceHours: number,
  netBillableHours: number,
  absenceBreakdown: { vab: number, sick: number, holiday: number, other: number }
}
```

**Key constraint:** Guardian scope enforced via `guardianId` parameter.

---

## Data Flow

### Flow 1: Time Entry → Billable Hours → FK Report → Payroll

```
Assistant logs hours (entries table)
  ↓
Guardian approves entry (status: "approved")
  ↓
Billable Hours Service:
  - Query all approved entries for month
  - Query all absences for month
  - Subtract absence hours from billable hours
  ↓
FK 3059 Report:
  - Use net billable hours in time report
  ↓
Payroll Module:
  - Use net billable hours × hourly rate = gross pay
  - Apply employer contributions, deductions
  - Store payroll_record (immutable snapshot)
```

**Critical:** Absences with `affectsBillable: true` reduce both FK hours and payroll hours. Absences with `affectsBillable: false` (e.g., VAB, if coded separately) do NOT reduce billable hours but ARE reported to Skatteverket and affect gross pay interpretation.

### Flow 2: Absence Record → Payroll → Tax Report

```
Guardian records absence (VAB, sick leave, holiday, etc.)
  ↓
Absence record stored with type, dates, duration
  ↓
Payroll Month-End:
  - Compute gross pay with deductions for billable-affecting absences
  - Store payroll_record
  ↓
Tax Report (AGI) Generation:
  - Query payroll_records for month
  - Sum VAB days from absences (new 2026 requirement)
  - Generate tax_line_items with gross, contribution, VAB days
  ↓
Guardian downloads or prints AGI form (PDF or JSON export)
  ↓
Guardian submits to Skatteverket (manual, by 12th of following month)
```

### Flow 3: Multi-Tenant Query Isolation

**Every database query MUST include a guardian scope check.**

**Pattern (existing, must extend):**

```typescript
// In route handler
const guardianId = req.user.userId; // from JWT

// Fetch entries (existing)
const entries = await db
  .select()
  .from(entriesTable)
  .where(and(
    eq(entriesTable.guardianId, guardianId),
    eq(entriesTable.month, selectedMonth)
  ));

// Fetch absences (new)
const absences = await db
  .select()
  .from(absencesTable)
  .where(and(
    eq(absencesTable.guardianId, guardianId),
    eq(absencesTable.month, selectedMonth)
  ));

// Fetch payroll (new)
const payroll = await db
  .select()
  .from(payrollTable)
  .where(and(
    eq(payrollTable.guardianId, guardianId),
    eq(payrollTable.month, selectedMonth)
  ));
```

**Anti-pattern:** Querying without guardianId filter exposes data leakage across tenants.

---

## Build Order (Dependency Chain)

### Phase 1: Absence/Leave Foundation
**Why first:** Absences affect billable hours in FK 3059 reports and payroll. Cannot accurately compute either without absence support.

**Scope:**
1. Create absences table schema
2. Add absence routes: POST, GET, DELETE (CRUD)
3. Implement AbsenceService with validation
4. Integrate into Billable Hours Service: subtract absence hours
5. Update FK 3059 PDF generation to show net billable hours (excluding absences)
6. Expose absence balance UI to guardian

**Deliverable:** Guardian can record VAB, sick leave, holidays; FK 3059 hours automatically exclude recorded absences.

**Multi-tenant enforcement:** All absences queries filter by `guardianId`.

---

### Phase 2: Payroll Calculation & Recording
**Why second:** Depends on Phase 1 (net billable hours); feeds Phase 3 (tax reporting).

**Scope:**
1. Create payroll_records and payroll_adjustments schema
2. Implement PayrollService with 2026 Swedish contribution rates
3. Add payroll routes: GET month summary, POST approval, PUT adjustments
4. Monthly batch: calculate payroll for all assistants for a month
5. Expose payroll summary UI to guardian (hours, rates, gross, contrib, deductions, net)
6. Implement immutable record locking (status transitions: draft → approved → locked)
7. Reconcile with existing costs module (monthly cost overview must match payroll total)

**Deliverable:** Guardian sees monthly payroll per assistant, can approve, adjustments are tracked.

**Multi-tenant enforcement:** All payroll queries filter by `guardianId`.

---

### Phase 3: Tax Reporting (AGI) & PDF Export
**Why third:** Depends on Phases 1–2 (absences, payroll records).

**Scope:**
1. Create tax_declarations and tax_line_items schema
2. Implement TaxReportService: consume payroll_records + absences, generate AGI line items
3. 2026 compliance: exclude fields 062/063, include VAB days, exclude growth support
4. Add tax routes: GET declarations (filtered by guardianId + month/year), POST generate, GET export
5. Extend PDF module to render AGI form (similar to FK 3059/3057)
6. Expose AGI download to guardian

**Deliverable:** Guardian downloads AGI form with payroll + VAB data, ready to print and submit to Skatteverket by 12th of following month.

**Multi-tenant enforcement:** All tax queries filter by `guardianId`.

---

## Multi-Tenant Scoping (Critical)

**Current state:** Existing tables (entries, assistants, profile) already have `guardianId` column. Routes check `requireGuardian` middleware (JWT role check), but data-level scoping exists.

**Requirement:** All new tables MUST have `guardianId` foreign key. All Drizzle queries MUST filter by `guardianId` at the database level, not just in the API route.

### Data Isolation Model: **Row-Level Isolation (Shared Database)**

**Why this model?**
- Single database instance (cost-effective, operational simplicity)
- All tenants share PostgreSQL database and schema
- Logical separation via `guardianId` on every table (strong constraint)
- Clear data scoping at ORM level (errors are caught by type checking and query filtering)

**Implementation:**

```typescript
// New schema tables

export const absencesTable = pgTable('absences', {
  id: uuid('id').primaryKey().defaultRandom(),
  guardianId: uuid('guardian_id').notNull().references(() => profileTable.id, { onDelete: 'cascade' }),
  assistantId: uuid('assistant_id').notNull().references(() => assistantsTable.id, { onDelete: 'cascade' }),
  absenceType: pgEnum('absence_type')('sick', 'vab', 'holiday', 'other').notNull(),
  dateStart: date('date_start').notNull(),
  dateEnd: date('date_end').notNull(),
  durationDays: integer('duration_days').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// Enforce: (guardianId, assistantId) uniqueness per date range
// Ensure assistantId belongs to guardianId via foreign key + trigger

export const payrollRecordsTable = pgTable('payroll_records', {
  id: uuid('id').primaryKey().defaultRandom(),
  guardianId: uuid('guardian_id').notNull().references(() => profileTable.id, { onDelete: 'cascade' }),
  assistantId: uuid('assistant_id').notNull().references(() => assistantsTable.id, { onDelete: 'cascade' }),
  month: integer('month').notNull(), // 1–12
  year: integer('year').notNull(),
  billableHours: numeric('billable_hours', { precision: 10, scale: 2 }).notNull(),
  absenceHours: numeric('absence_hours', { precision: 10, scale: 2 }).notNull(),
  netBillableHours: numeric('net_billable_hours', { precision: 10, scale: 2 }).notNull(),
  hourlyRate: numeric('hourly_rate', { precision: 10, scale: 2 }).notNull(),
  grossPay: numeric('gross_pay', { precision: 10, scale: 2 }).notNull(),
  employerTaxRate: numeric('employer_tax_rate', { precision: 5, scale: 2 }).notNull(), // 31.42 = 31.42%
  employerContribution: numeric('employer_contribution', { precision: 10, scale: 2 }).notNull(),
  preliminärskatt: numeric('preliminarskatt', { precision: 10, scale: 2 }).default(0),
  netPay: numeric('net_pay', { precision: 10, scale: 2 }).notNull(),
  status: pgEnum('payroll_status')('draft', 'approved', 'locked').default('draft'),
  createdAt: timestamp('created_at').defaultNow(),
  approvedAt: timestamp('approved_at'),
});

// Ensure (guardianId, assistantId, month, year) uniqueness
// Prevent updates once status = 'locked'

export const taxDeclarationsTable = pgTable('tax_declarations', {
  id: uuid('id').primaryKey().defaultRandom(),
  guardianId: uuid('guardian_id').notNull().references(() => profileTable.id, { onDelete: 'cascade' }),
  month: integer('month').notNull(),
  year: integer('year').notNull(),
  generatedAt: timestamp('generated_at').defaultNow(),
  status: pgEnum('tax_status')('draft', 'submitted', 'confirmed').default('draft'),
});

export const taxLineItemsTable = pgTable('tax_line_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  declarationId: uuid('declaration_id').notNull().references(() => taxDeclarationsTable.id, { onDelete: 'cascade' }),
  guardianId: uuid('guardian_id').notNull().references(() => profileTable.id, { onDelete: 'cascade' }),
  assistantId: uuid('assistant_id').notNull().references(() => assistantsTable.id, { onDelete: 'cascade' }),
  grossPay: numeric('gross_pay', { precision: 10, scale: 2 }).notNull(),
  employerContribution: numeric('employer_contribution', { precision: 10, scale: 2 }).notNull(),
  preliminärskatt: numeric('preliminarskatt', { precision: 10, scale: 2 }).default(0),
  vabDays: integer('vab_days').default(0),
  metadata: jsonb('metadata'), // future extensibility
});
```

### Query Pattern (All New Routes)

```typescript
// ✅ CORRECT: Filter by guardianId

router.get('/absences', requireGuardian, async (req, res) => {
  const guardianId = req.user.userId;
  const { month, year } = req.query;

  const absences = await db
    .select()
    .from(absencesTable)
    .where(and(
      eq(absencesTable.guardianId, guardianId),
      eq(month(absencesTable.dateStart), month),
      eq(year(absencesTable.dateStart), year)
    ));

  res.json(absences);
});

// ❌ WRONG: No guardianId filter = data leak

router.get('/absences', requireGuardian, async (req, res) => {
  const { month, year } = req.query;

  const absences = await db
    .select()
    .from(absencesTable)
    .where(and(
      eq(month(absencesTable.dateStart), month),
      eq(year(absencesTable.dateStart), year)
    )); // BUG: Returns all tenants' absences!

  res.json(absences);
});
```

---

## Patterns to Follow

### Pattern 1: Service Layer for Business Logic

**What:** Extract calculation logic (gross pay, contribution rates, tax line items) into services, separate from HTTP routes.

**When:** Payroll and tax logic is complex, multi-step, and tested independently.

**Example:**

```typescript
// server/src/services/payrollService.ts

export async function calculatePayrollMonth(
  guardianId: string,
  assistantId: string,
  month: number,
  year: number
): Promise<PayrollRecord> {
  // 1. Get billable hours (excluding absences)
  const billableHours = await billableHoursService.compute(guardianId, assistantId, month, year);

  // 2. Get hourly rate from profile
  const profile = await db.query.profileTable.findFirst({ where: eq(profileTable.id, guardianId) });

  // 3. Get assistant birth date for tax rate
  const assistant = await db.query.assistantsTable.findFirst({ where: eq(assistantsTable.id, assistantId) });
  const taxRate = computeEmployerTaxRate(assistant.birthDate, new Date(year, month - 1));

  // 4. Calculate payroll
  const grossPay = billableHours.netBillableHours * profile.hourlyRate;
  const employerContribution = grossPay * (taxRate / 100);
  const netPay = grossPay - (profile.preliminärskatt || 0);

  // 5. Persist record
  const record = await db.insert(payrollRecordsTable).values({
    guardianId,
    assistantId,
    month,
    year,
    billableHours: billableHours.totalApprovedHours,
    absenceHours: billableHours.deductedAbsenceHours,
    netBillableHours: billableHours.netBillableHours,
    hourlyRate: profile.hourlyRate,
    grossPay,
    employerTaxRate: taxRate,
    employerContribution,
    preliminärskatt: profile.preliminärskatt || 0,
    netPay,
    status: 'draft',
  }).returning();

  return record;
}

export function computeEmployerTaxRate(assistantBirthDate: Date, payMonth: Date): number {
  const age = payMonth.getFullYear() - assistantBirthDate.getFullYear();

  // 2026 rules
  if (age >= 67) return 10.21; // Old-age pension only
  if (age >= 19 && age <= 23 && payMonth >= new Date(2026, 3)) return 17.77; // Youth reduction (April 2026+)
  return 31.42; // Standard rate
}
```

### Pattern 2: Billable Hours as Reusable Utility

**What:** Single source of truth for "net billable hours" = approved entries minus deductible absences.

**When:** Multiple modules (FK reports, payroll, costs) need to compute billable hours.

**Example:**

```typescript
// server/src/services/billableHoursService.ts

export async function computeForMonth(
  guardianId: string,
  assistantId: string,
  month: number,
  year: number
): Promise<BillableHoursResult> {
  // Query approved entries
  const entries = await db
    .select()
    .from(entriesTable)
    .where(and(
      eq(entriesTable.guardianId, guardianId),
      eq(entriesTable.assistantId, assistantId),
      eq(entriesTable.month, month),
      eq(entriesTable.year, year),
      eq(entriesTable.reqStatus, 'approved')
    ));

  const totalApprovedHours = sumHours(entries);

  // Query deductible absences
  const absences = await db
    .select()
    .from(absencesTable)
    .where(and(
      eq(absencesTable.guardianId, guardianId),
      eq(absencesTable.assistantId, assistantId),
      gte(absencesTable.dateEnd, new Date(year, month - 1, 1)),
      lt(absencesTable.dateStart, new Date(year, month, 1))
    ));

  const deductibleAbsences = absences.filter(a => a.affectsBillable);
  const deductedAbsenceHours = sumAbsenceHours(deductibleAbsences);

  const netBillableHours = totalApprovedHours - deductedAbsenceHours;

  return {
    totalApprovedHours,
    deductedAbsenceHours,
    netBillableHours,
    absenceBreakdown: groupByType(absences),
  };
}
```

### Pattern 3: Immutable Payroll Records with Status Transitions

**What:** Once a payroll record is approved and locked, it cannot be modified. Adjustments are tracked separately.

**When:** Audit trail and tax compliance require immutable historical records.

**Example:**

```typescript
// server/src/routes/payroll.ts

router.put('/payroll/:recordId/approve', requireGuardian, async (req, res) => {
  const guardianId = req.user.userId;
  const { recordId } = req.params;

  const record = await db.query.payrollRecordsTable.findFirst({
    where: and(eq(payrollRecordsTable.id, recordId), eq(payrollRecordsTable.guardianId, guardianId))
  });

  if (!record) return res.status(404).json({ error: 'Record not found' });
  if (record.status !== 'draft') return res.status(400).json({ error: 'Only draft records can be approved' });

  const updated = await db.update(payrollRecordsTable)
    .set({ status: 'approved', approvedAt: new Date() })
    .where(eq(payrollRecordsTable.id, recordId))
    .returning();

  res.json(updated);
});

// After guardian approves, lock record (or transition happens automatically)
// If correction needed, guardian logs an adjustment instead of modifying the record

router.post('/payroll/:recordId/adjustments', requireGuardian, async (req, res) => {
  const guardianId = req.user.userId;
  const { recordId } = req.params;
  const { type, amount, reason } = req.body; // type: "bonus", "deduction"

  const record = await db.query.payrollRecordsTable.findFirst({
    where: and(eq(payrollRecordsTable.id, recordId), eq(payrollRecordsTable.guardianId, guardianId))
  });

  if (!record) return res.status(404).json({ error: 'Record not found' });

  const adjustment = await db.insert(payrollAdjustmentsTable).values({
    payrollRecordId: recordId,
    type,
    amount,
    reason,
  }).returning();

  res.json(adjustment);
});
```

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Querying Absences Without GuardianId Filter

**What goes wrong:**
```typescript
// ❌ WRONG
const absences = await db.select().from(absencesTable);
// Returns all tenants' absences!
```

**Why bad:** Multi-tenant data leak. Guardian A sees Guardian B's absences.

**Instead:**
```typescript
// ✅ CORRECT
const absences = await db.select().from(absencesTable)
  .where(eq(absencesTable.guardianId, guardianId));
```

### Anti-Pattern 2: Modifying Locked Payroll Records

**What goes wrong:**
```typescript
// ❌ WRONG
const updated = await db.update(payrollRecordsTable)
  .set({ grossPay: newAmount })
  .where(eq(payrollRecordsTable.id, recordId));
// Destroys audit trail, tax compliance fails
```

**Why bad:** Locked records are immutable. Modifications must be tracked as adjustments.

**Instead:**
```typescript
// ✅ CORRECT
// Check status first
if (record.status === 'locked') {
  // Record an adjustment instead
  await db.insert(payrollAdjustmentsTable).values({...});
}
```

### Anti-Pattern 3: Hardcoding Tax Rates or Age-Based Rules

**What goes wrong:**
```typescript
// ❌ WRONG (hardcoded 2026 rule)
const taxRate = age >= 67 ? 10.21 : 31.42;
// Code breaks in 2027 when rules change again
```

**Why bad:** Swedish tax law changes annually. Hardcoding makes updates fragile.

**Instead:**
```typescript
// ✅ CORRECT
const taxRate = await getTaxRateForYear(age, year); // Lookup from configurable table or settings
```

### Anti-Pattern 4: Deriving Payroll From Raw Calculation on Each Request

**What goes wrong:**
```typescript
// ❌ WRONG
router.get('/payroll/:month', async (req, res) => {
  const payroll = calculatePayrollOnTheFly(month); // Non-deterministic, not auditable
  res.json(payroll);
});
```

**Why bad:** No audit trail, results can change if entries are modified retroactively, tax compliance is impossible.

**Instead:**
```typescript
// ✅ CORRECT
// 1. Calculate once and persist (immutable snapshot)
// 2. Guardian approves, record is locked
// 3. Serve from database
router.get('/payroll/:month', async (req, res) => {
  const payroll = await db.query.payrollRecordsTable.findMany({
    where: and(eq(payrollRecordsTable.guardianId, guardianId), eq(payrollRecordsTable.month, month))
  });
  res.json(payroll);
});
```

---

## Scalability Considerations

### At 100 Users (Single Tenant, Small Scale)

| Concern | Approach |
|---------|----------|
| Query performance | Indexes on `(guardianId, month, year)` for absences, payroll, tax tables |
| Payroll computation | Monthly batch job in memory; no background queue needed |
| Data size | ~5–10 MB per tenant (1–2 years of data); no sharding needed |
| Concurrent access | Single server handles 100 guardians easily; no lock contention |

### At 10K Users (Growth Phase)

| Concern | Approach |
|---------|----------|
| Query performance | Add indexes on `(guardianId, assistantId)` for faster joins |
| Payroll computation | Move to background job queue (Bull + Redis) to avoid blocking UI |
| Data size | ~500 MB–1 GB; consider archiving old data or read replicas |
| Concurrent access | Multiple Express instances; shared PostgreSQL scales to 10K without issue |
| Reporting latency | Cache pre-computed monthly summaries; invalidate on new entry/absence |

### At 1M Users (Enterprise Scale)

| Concern | Approach |
|---------|----------|
| Query performance | Partition tables by `guardianId` or sharding; add materialized views for reports |
| Payroll computation | Distributed batch processing (Kubernetes Job, Airflow) |
| Data size | Multiple TB; archive old records, separate hot/cold storage |
| Concurrent access | Connection pooling (PgBouncer), read replicas for reporting |
| Reporting latency | Event-driven architecture; Kafka for entry/absence/payroll events |

**Current deployment (single server) supports ~1K–5K simultaneous guardians comfortably before scaling is needed.**

---

## 2026 Swedish Compliance Notes

### VAB Reporting (New in 2025, Active in 2026)

From January 1, 2025, employers must report employee absences (VAB, sick leave, parental leave) to Skatteverket monthly. This data is verified against FSK (Försäkringskassan) records to combat fraud.

**Implementation in Kalinga:**
- Absence records with `absenceType = 'vab'` are summed by month
- Tax declaration includes `vabDays` field per assistant
- Guardian sees VAB days in tax report; no additional action needed

### Employer Contribution Rate Changes (Effective 2026)

**Standard rate:** 31.42% (unchanged from 2025)

**Age-based reductions:**
- **Age ≥ 67:** 10.21% (old-age pension contribution only)
- **Age 19–23 (April 2026+):** 17.77% (youth reduction introduced)

**Implementation:** `computeEmployerTaxRate()` service must check assistant birth date and month/year to apply correct rate.

### AGI Field Removals (Effective 2026)

Fields 062 and 063 on individual notifications are removed from AGI starting January 1, 2026.

**Implementation:** Tax line items table does NOT include these fields; if migrating from legacy system, migration script must strip them.

### Growth Support Exclusion

Growth support (växastödet) is no longer included in AGI from 2026.

**Implementation:** Payroll calculation does NOT include growth support; no special handling needed in Kalinga.

---

## API Surface (Proposed Routes)

### Absences

```
GET    /api/absences?month=4&year=2026           # List guardian's absences
POST   /api/absences                              # Create absence
PUT    /api/absences/:id                          # Update absence
DELETE /api/absences/:id                          # Delete absence
GET    /api/assistants/:id/absenceBalance         # Remaining holiday balance per assistant
```

### Payroll

```
GET    /api/payroll?month=4&year=2026            # Monthly payroll summary
GET    /api/payroll/:recordId                    # Single record
POST   /api/payroll/calculate                    # Trigger month calculation (draft records)
PUT    /api/payroll/:recordId/approve            # Approve record (draft → approved)
POST   /api/payroll/:recordId/adjustments        # Add adjustment
GET    /api/payroll/:recordId/adjustments        # List adjustments
```

### Tax Reporting

```
GET    /api/tax-reports?month=4&year=2026        # Declarations for month
POST   /api/tax-reports/generate                 # Generate AGI for month
GET    /api/tax-reports/:declarationId           # Single declaration
GET    /api/tax-reports/:declarationId/lineItems # AGI line items
PUT    /api/tax-reports/:declarationId/status    # Mark as submitted/confirmed
GET    /api/pdf/agi                              # Download AGI form (print-ready)
```

---

## Open Questions / Phase-Specific Research Needed

1. **Skatteverket e-service API integration (out of scope for Phase 3, flagged for future):** Currently, forms are print-and-submit. Future phases may integrate with Skatteverket's e-filing API if certification becomes available.

2. **VAB days calculation edge cases:** If an assistant takes VAB across month boundaries, how many days count in each month? Clarify with product owner.

3. **Preliminärskatt configuration:** Is preliminärskatt (tax deduction per assistant) a static guardian setting, or per-assistant, or per-month? Confirm with FK reporting requirements.

4. **Holiday balance accrual rules:** Swedish vacation entitlement is 25 days/year. How does Kalinga track accrual (per month, per year), carryover limits, and usage? Implement in Phase 1 or defer to Phase 2.

5. **Background job queue:** At what user count should we move payroll computation to a queue (Bull + Redis)? Currently single-server; no queue needed for 100 users.

6. **Payroll approval workflow:** Does guardian approve payroll before FK form generation, or after? Document approval sequencing.

---

## Sources

- [Sweden: Employer Social Contribution Rules Updated For 2026](https://mercans.com/resources/statutory-alerts/sweden-employer-social-contribution-rules-updated-for-2026-age-based-rate-change-for-67/)
- [Employer contributions in Sweden 2026: rates, payroll changes and SINK updates](https://1office.co/blog/employer-contributions-sweden/)
- [Skatteverket: Employer contributions](https://www.skatteverket.se/servicelankar/otherlanguages/engliskengelska/businessesandemployers/startingandrunningaswedishbusiness/declaringtaxesbusinesses/filingapayereturn/employercontributions.4.2fb39afe18dabf1e4d24a3d.html)
- [Arbetsgivardeklaration (AGI) — komplett guide 2026](https://redovisning.ai/guider/arbetsgivardeklaration)
- [Skatteverket: Lämna arbetsgivardeklaration på individnivå (AGI)](https://www.skatteverket.se/foretag/arbetsgivare/lamnaarbetsgivardeklaration.4.41f1c61d16193087d7fcaeb.html)
- [The 'VAB' Guide: Claiming Care Benefits for Sick Kids in 2026](https://www.lync.me/blog/673/vab-guide-claiming-care-benefits-sick-kids-2026)
- [Care of a sick child (vab) - Försäkringskassan](https://www.forsakringskassan.se/english/parents/care-of-a-sick-child-vab)
- [Multi-Tenant Architecture Strategies 2026 Guide](https://gainhq.com/blog/multi-tenant-architecture/)
- [Data Isolation and Sharding Architectures for Multi-Tenant Systems](https://medium.com/@justhamade/data-isolation-and-sharding-architectures-for-multi-tenant-systems-20584ae2bc31)
- [Understanding design patterns in TypeScript and Node.js](https://blog.logrocket.com/understanding-design-patterns-typescript-node-js/)
- [How to Build a Payroll System with Express and Monnify Using Background Jobs](https://www.freecodecamp.org/news/build-a-payroll-system-with-express-and-monnify-using-background-jobs/)
- [TypeScript at scale in 2026: What senior engineers should know](https://blog.logrocket.com/typescript-at-scale-2026/)

---

*Architecture research: 2026-04-06*
