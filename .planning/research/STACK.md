# Technology Stack — Payroll, AGI, Leave & PDF

**Project:** Kalinga Assistansportal
**Domain:** Swedish personal assistance care management with payroll compliance
**Researched:** 2026-04-06
**Confidence:** MEDIUM-HIGH

---

## Executive Summary

The existing TypeScript/Express/React stack is locked in. This research identifies libraries for:
- **Swedish payroll calculations** (arbetsgivaravgifter/AGI) — no single npm package covers both; implement via custom TypeScript module backed by 2026 Skatteverket rates
- **AGI XML export** — xmlbuilder2 for generation, Drizzle schema for structured data
- **Leave/absence tracking** — extend current Drizzle schema with absence entries
- **Print-ready PDF** — keep pdf-lib (already deployed); do NOT switch to Puppeteer without performance testing

---

## Recommended Stack

### Payroll Calculations — Custom TypeScript Module

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **TypeScript (custom module)** | 5.4+ (existing) | Arbetsgivaravgifter calculation logic | No dedicated npm library covers Swedish payroll + AGI. Hard-code 2026 rates (31.42% std, 20.81% reduced) into a clean, testable CalculatorService. Easier to maintain than vendor lock-in. Configuration object for rates makes future year updates straightforward. |
| **Drizzle ORM** | 0.30.10 (existing) | Persist payroll runs, calculations | Already in stack; add `payroll_runs` and `assistant_earnings` tables. Type-safe schema keeps calculations auditable. |

**Recommended Struct:**

```typescript
// server/src/lib/payrollCalculator.ts
interface PayrollConfig {
  year: number;
  standardRate: number;      // 0.3142 for 2026
  reducedRate: number;       // 0.2081 for 2026
  thresholdSek: number;      // 25000
  pensionOnly: boolean;      // true if employee >67 years old
}

interface ArbetsgivaravgifterResult {
  grossSalary: number;
  contribution: number;
  netCost: number;           // salary + contribution
}

class PayrollCalculator {
  calculateArbetsgivaravgifter(salary: number, config: PayrollConfig): ArbetsgivaravgifterResult {
    // Split calculation: reduced on first 25k, standard on remainder
    const reducedPortion = Math.min(salary, config.thresholdSek) * config.reducedRate;
    const standardPortion = Math.max(0, salary - config.thresholdSek) * config.standardRate;
    const contribution = reducedPortion + standardPortion;

    return {
      grossSalary: salary,
      contribution: Math.round(contribution * 100) / 100,
      netCost: salary + contribution
    };
  }
}
```

**Schema Addition:**

```typescript
// server/src/db/schema.ts - new tables
export const payrollRuns = pgTable('payroll_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  guardianId: uuid('guardian_id').notNull().references(() => guardians.id),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  processedAt: timestamp('processed_at').defaultNow(),
  // unique constraint: one run per guardian per month
});

export const assistantEarnings = pgTable('assistant_earnings', {
  id: uuid('id').primaryKey().defaultRandom(),
  payrollRunId: uuid('payroll_run_id').notNull().references(() => payrollRuns.id, { onDelete: 'cascade' }),
  assistantId: uuid('assistant_id').notNull().references(() => assistants.id),
  grossSalary: numeric('gross_salary', { precision: 10, scale: 2 }).notNull(),
  arbetsgivaravgifter: numeric('arbetsgivaravgifter', { precision: 10, scale: 2 }).notNull(),
  employerCost: numeric('employer_cost', { precision: 10, scale: 2 }).notNull(),
  deductedTax: numeric('deducted_tax', { precision: 10, scale: 2 }).default('0'),
  createdAt: timestamp('created_at').defaultNow(),
});
```

**Confidence: HIGH** — Rates are from official Skatteverket 2026. No external library needed; custom module is simpler than integrating a Swedish-only payroll vendor.

---

### AGI XML Export — xmlbuilder2 + Drizzle

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **xmlbuilder2** | 4.0.3 (new) | Generate Skatteverket AGI XML | Official Skatteverket format is XML. xmlbuilder2 is the most maintained builder (active 4 months ago). It offers a fluent chainable API and proper DOM compliance. Alternative xml2js is for parsing, not generation. Supports async/promise-based workflows. |
| **Drizzle ORM** | 0.30.10 (existing) | Query structured payroll data | Use Drizzle queries to assemble data for XML export. Ensures consistency with database source of truth. |

**Recommended Approach:**

```typescript
// server/src/lib/agiExporter.ts
import { document } from 'xmlbuilder2';

interface AGIDeclaration {
  year: number;
  month: number;
  organisationNumber: string;
  employees: AGIEmployee[];
}

interface AGIEmployee {
  personnummer: string;
  name: string;
  grossSalary: number;
  arbetsgivaravgifter: number;
  absences?: AGIAbsence[];
}

class AGIExporter {
  generateXml(declaration: AGIDeclaration): string {
    const doc = document()
      .ele('ArbetsgivardeklarationIndividNiva')
      .att('xmlns', 'urn:skatteverket:arbetsgivardeklaration:2025')
      .att('version', '2.0')
      .ele('Deklarant')
      .ele('OrganisationsnummerUndersokare', declaration.organisationNumber).up()
      .ele('DeklarationsPeriod')
      .ele('År', declaration.year).up()
      .ele('Månad', declaration.month).up()
      .up();

    // Loop employees
    declaration.employees.forEach(emp => {
      doc.ele('ArbetsgivardeklarationAnstallning')
        .ele('PersonnummerAnstalld', emp.personnummer).up()
        .ele('Namn', emp.name).up()
        .ele('LöpVeckosumma', emp.grossSalary.toFixed(2)).up()
        .ele('Arbetsgivaravgift', emp.arbetsgivaravgifter.toFixed(2)).up();

      if (emp.absences) {
        emp.absences.forEach(abs => {
          doc.ele('Frånvaro')
            .ele('FrånvaroTyp', abs.type).up()
            .ele('StartDatum', abs.startDate).up()
            .ele('SlutDatum', abs.endDate).up()
            .ele('Procent', (abs.percent || 100).toString()).up();
        });
      }
    });

    return doc.end({ prettyPrint: true });
  }
}
```

**Installation:**

```bash
npm install --save xmlbuilder2
npm install --save-dev @types/xmlbuilder2
```

**Confidence: MEDIUM** — xmlbuilder2 is stable, but exact Skatteverket XML schema for 2026 requires direct verification from official documentation. This design allows schema adjustments without library changes.

---

### Leave & Absence Tracking — Drizzle Schema Extension

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **Drizzle ORM** | 0.30.10 (existing) | Absence records, type enums, validation | Consistent with existing stack. Use PostgreSQL enums for absence types (sick, VAB, holiday, other). Link absences to entries so they exclude from billable hours. Timestamps for audit. |

**Recommended Schema:**

```typescript
// server/src/db/schema.ts - new tables and enums
export const absenceType = pgEnum('absence_type', [
  'sjuk',        // sick leave
  'vab',         // parental leave (vård av barn)
  'semester',    // holiday/vacation
  'tjänstledigt', // unpaid leave
  'övrig'        // other
]);

export const absences = pgTable('absences', {
  id: uuid('id').primaryKey().defaultRandom(),
  guardianId: uuid('guardian_id').notNull().references(() => guardians.id),
  assistantId: uuid('assistant_id').notNull().references(() => assistants.id),
  type: absenceType('type').notNull(),
  startDate: date('start_date').notNull(),
  endDate: date('end_date').notNull(),
  hours: numeric('hours', { precision: 5, scale: 2 }).default('0'),  // if partial day
  percentageOfWorkTime: numeric('percentage_of_work_time', { precision: 5, scale: 2 }).default('100'), // 0–100
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: uuid('created_by').notNull().references(() => guardians.id), // which guardian recorded this

  // Index for quick lookups: guardian + month range
  // Used to exclude absences from FK 3059 billable hours
});

// Helper to track balances (e.g., vacation days used vs. available)
export const leaveBalances = pgTable('leave_balances', {
  id: uuid('id').primaryKey().defaultRandom(),
  assistantId: uuid('assistant_id').notNull().references(() => assistants.id),
  year: integer('year').notNull(),
  type: absenceType('type').notNull(),
  entitled: numeric('entitled', { precision: 5, scale: 2 }).notNull(), // e.g., 25 days for vacation
  used: numeric('used', { precision: 5, scale: 2 }).default('0'),
  remaining: numeric('remaining', { precision: 5, scale: 2 }).generated(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
```

**Usage in FK 3059 Generation:**

```typescript
// When calculating billable hours for FK 3059, exclude absences:
const billableHours = await db
  .select({ hours: entries.hours, assistantId: entries.assistantId })
  .from(entries)
  .leftJoin(absences, and(
    eq(absences.assistantId, entries.assistantId),
    gte(entries.date, absences.startDate),
    lte(entries.date, absences.endDate)
  ))
  .where(and(
    eq(entries.guardianId, guardianId),
    eq(entries.month, targetMonth),
    isNull(absences.id)  // no matching absence
  ));
```

**Confidence: HIGH** — Standard HR schema patterns. Absence types align with Swedish LSS regulations.

---

### Print-Ready PDF — Stick with pdf-lib + qpdf

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **pdf-lib** | 1.17.1 (existing) | Fill AcroForm fields in FK/Skatteverket PDFs | Already integrated. Fills form fields reliably. Alternatives (Puppeteer, pdfmake) introduce complexity: Puppeteer requires Chrome/memory overhead; pdfmake is slower for large docs. For form filling (not HTML→PDF), pdf-lib is correct choice. |
| **qpdf (CLI binary)** | — (system) | Decrypt owner-password-protected PDFs | Existing dependency. FK templates are owner-encrypted. Keep as-is. |
| **node-qpdf2** | 2.0.0 (existing) | Node.js wrapper for qpdf CLI | Existing. Works well. No change needed. |

**DO NOT SWITCH TO:**
- **Puppeteer** — Not needed for form filling; adds overhead. Only use if forms become complex HTML that can't be filled programmatically.
- **Playwright** — Similar to Puppeteer; overkill for AcroForm filling.
- **pdfmake** — Slower for large documents, declarative DSL less suited to filling existing form templates.

**Optional Enhancement (if print quality issues arise):**

If print-ready output shows rendering issues, consider:
- **PDFKit** — Lower-level control; allows precise field positioning if pdf-lib doesn't handle complex layouts.
- **IronPDF** — Enterprise library with better form filling; but adds cost/lock-in.

For now, pdf-lib + qpdf is the right fit.

**Confidence: HIGH** — Library is proven in existing codebase. No migration needed unless new requirements break pdf-lib assumptions.

---

### Date Manipulation & Swedish Holidays — date-fns + swedish-holidays

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **date-fns** | 3.6.0 (existing) | Date parsing, formatting, month boundaries | Already in stack. Use for FK form date ranges (month-end calculations). date-fns is modern, tree-shakeable, and faster than moment.js. |
| **swedish-holidays** | latest (new) | Check if date is Swedish holiday, weekend | Allows payroll logic to exclude holidays/weekends from working day calculations. Small, focused library. |

**Installation:**

```bash
npm install swedish-holidays
```

**Usage:**

```typescript
import { getHolidays, isPublicHoliday } from 'swedish-holidays';

const holidays2026 = getHolidays(2026);
const isHolidayOrWeekend = (date: Date): boolean => {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6 || isPublicHoliday(date);
};
```

**Confidence: HIGH** — swedish-holidays is maintained (GitHub: Pythe1337N/swedish-holidays). date-fns is battle-tested.

---

### XML Parsing (if importing AGI data later) — xml2js

| Technology | Version | Purpose | Why |
|------------|---------|---------|-----|
| **xml2js** | latest (new, optional) | Parse Skatteverket XML responses or imported files | Only needed if importing AGI confirmations or parsing external payroll data. Bi-directional (parse + generate via Builder). Keep separate from xmlbuilder2 (which is generation-focused). |

**Installation (only if needed for Phase 2+):**

```bash
npm install xml2js
```

---

## Alternatives Considered

| Component | Recommended | Alternative | Why Not |
|-----------|-------------|-------------|---------|
| Payroll calculations | Custom TypeScript module | Vendor payroll library (Visma, Fortnox API) | Vendor APIs require auth/cost; custom module is maintainable for a single family's use case. Revisit if scaling to many employers. |
| AGI XML generation | xmlbuilder2 | xml2js (Builder) or handwritten strings | xml2js Builder works but xmlbuilder2 has cleaner API and better TypeScript support. Handwritten XML is error-prone. |
| Form filling | pdf-lib + qpdf | Puppeteer + HTML forms | Puppeteer adds memory/complexity for no gain in form filling. pdf-lib is lighter and proven. |
| Date library | date-fns (existing) | dayjs or moment | date-fns already in use; switching is unnecessary. Moment is heavier and deprecated in favor of alternatives. |
| Leave tracking | Drizzle schema | No external lib | Leave tracking is straightforward database design; no special library needed. Drizzle provides type safety. |

---

## Installation & Setup

### Server Dependencies (add to `server/package.json`)

```bash
# From server/
npm install xmlbuilder2 swedish-holidays
npm install -D @types/xmlbuilder2  # if using strict TypeScript
```

### Configuration (environment variables)

Ensure `.env` includes:
```
# Existing
DATABASE_URL=postgres://...
NODE_PASSWORD=...

# New (optional, for future multi-employer scaling)
PAYROLL_YEAR=2026
PAYROLL_STANDARD_RATE=31.42
PAYROLL_REDUCED_RATE=20.81
PAYROLL_THRESHOLD_SEK=25000
```

**Note:** For now, hardcode 2026 rates. Move to env when multi-year support is needed.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Custom payroll module, not npm package** | No Swedish-specific payroll npm library. Custom code is simpler to audit, test, and update yearly. |
| **xmlbuilder2 for AGI export** | Most recent XML builder; active maintenance; fluent API. |
| **Drizzle schema for absence tracking** | Type-safe, aligns with existing stack, avoids external dependencies. |
| **Keep pdf-lib + qpdf** | Proven in codebase. Form filling is the right use case. No migration needed. |
| **swedish-holidays for holiday logic** | Small, focused, maintained by community. Reduces custom date logic. |

---

## Confidence Assessment

| Technology | Level | Notes |
|------------|-------|-------|
| Payroll calculations (custom) | **HIGH** | 2026 rates from official Skatteverket. Logic is straightforward. |
| AGI XML (xmlbuilder2) | **MEDIUM** | Exact schema requires verification from Skatteverket technical docs. Library is solid; schema needs testing. |
| Leave tracking (Drizzle) | **HIGH** | Standard database design. Type-safe schema. |
| PDF (pdf-lib + qpdf) | **HIGH** | Already deployed and working. No changes needed. |
| Date/holidays (date-fns + swedish-holidays) | **HIGH** | Both are stable, maintained libraries. |

---

## Version Pinning Recommendations

To ensure reproducible builds and stability:

```json
{
  "dependencies": {
    "xmlbuilder2": "^4.0.3",
    "swedish-holidays": "^1.4.0",
    "date-fns": "^3.6.0"
  }
}
```

Use exact versions in `package-lock.json` (npm standard). Audit periodically for security updates.

---

## Sources

- [Skatteverket Official: Employer Contributions 2026](https://www.skatteverket.se/servicelankar/otherlanguages/engliskengelska/businessesandemployers/startingandrunningaswedishbusiness/declaringtaxesbusinesses/filingapayereturn/employercontributions.4.2fb39afe18dabf1e4d24a3d.html)
- [Skatteverket: AGI Technical Description](https://www.skatteverket.se/foretag/arbetsgivare/lamnaarbetsgivardeklaration/tekniskbeskrivningochtesttjanst.4.309a41aa1672ad0c8377c8b.html)
- [xmlbuilder2 - npm](https://www.npmjs.com/package/xmlbuilder2)
- [swedish-holidays - GitHub](https://github.com/Pythe1337N/swedish-holidays)
- [PDF Generation Libraries Comparison 2026 - Nutrient](https://www.nutrient.io/blog/top-js-pdf-libraries/)
- [pdfmake vs pdf-lib performance - DEV Community](https://dev.to/handdot/generate-a-pdf-in-js-summary-and-comparison-of-libraries-3k0p)

---

*Technology recommendations: 2026-04-06*
