# Technical Specification: Payroll, AGI Export, Leave Tracking

**Project:** Kalinga Assistansportal
**Date:** 2026-04-06
**Purpose:** Detailed technical design for implementing payroll calculations, AGI XML reporting, and leave tracking within existing Node.js/Express/React stack.

---

## Overview

This document details **what data structures, calculations, and integrations** are needed to implement:
1. **Swedish payroll calculations** (arbetsgivaravgifter)
2. **Skatteverket AGI (arbetsgivardeklaration på individnivå) XML export**
3. **Leave/absence tracking** (sick, VAB, holiday)
4. **Print-ready PDF output** for FK and Skatteverket forms

---

## 1. Payroll Calculations

### Data Model

**Core Tables (Drizzle ORM):**

```typescript
// server/src/db/schema.ts

export const payrollRuns = pgTable('payroll_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  guardianId: uuid('guardian_id').notNull().references(() => guardians.id),
  year: integer('year').notNull(),
  month: integer('month').notNull(),
  status: pgEnum('status', ['draft', 'finalized', 'exported'])('status').default('draft'),
  processedAt: timestamp('processed_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),

  // Unique: one payroll run per guardian per month
}, (table) => ({
  uniq: uniqueIndex('payroll_runs_guardian_month').on(table.guardianId, table.year, table.month),
}));

export const assistantEarnings = pgTable('assistant_earnings', {
  id: uuid('id').primaryKey().defaultRandom(),
  payrollRunId: uuid('payroll_run_id')
    .notNull()
    .references(() => payrollRuns.id, { onDelete: 'cascade' }),
  assistantId: uuid('assistant_id')
    .notNull()
    .references(() => assistants.id),

  // Hours worked (from approved entries, excluding absences)
  approvedHours: numeric('approved_hours', { precision: 7, scale: 2 }).notNull(),
  hourlyRate: numeric('hourly_rate', { precision: 8, scale: 2 }).notNull(), // SEK/hour

  // Calculated fields
  grossSalary: numeric('gross_salary', { precision: 10, scale: 2 }).notNull(), // hours × rate
  arbetsgivaravgifter: numeric('arbetsgivaravgifter', { precision: 10, scale: 2 }).notNull(), // 31.42% or 20.81%
  employerTotalCost: numeric('employer_total_cost', { precision: 10, scale: 2 }).notNull(), // salary + AGI

  // Tax withholding (preliminärskatt)
  taxWithheld: numeric('tax_withheld', { precision: 10, scale: 2 }).default('0'),
  netPay: numeric('net_pay', { precision: 10, scale: 2 }).notNull(), // salary - tax

  // Audit trail
  calculatedBy: uuid('calculated_by').notNull().references(() => guardians.id), // who ran payroll
  calculatedAt: timestamp('calculated_at').defaultNow(),
});

export type PayrollRun = typeof payrollRuns.$inferSelect;
export type AssistantEarnings = typeof assistantEarnings.$inferSelect;
```

### Calculation Logic

**PayrollCalculatorService:**

```typescript
// server/src/lib/payrollCalculator.ts

interface PayrollYear2026Config {
  year: 2026;
  standardRate: 0.3142;      // 31.42%
  reducedRate: 0.2081;       // 20.81%
  thresholdSek: 25000;       // Threshold for reduced rate
}

interface EmployeePayrollData {
  assistantId: string;
  approvedHours: number;
  hourlyRate: number;
  birthYear?: number;
  taxPercentage?: number;    // e.g., 10% for preliminärskatt
}

interface PayrollResult {
  approvedHours: number;
  hourlyRate: number;
  grossSalary: number;
  arbetsgivaravgifter: number;
  employerTotalCost: number;
  taxWithheld: number;
  netPay: number;
}

class PayrollCalculatorService {
  private config: PayrollYear2026Config = {
    year: 2026,
    standardRate: 0.3142,
    reducedRate: 0.2081,
    thresholdSek: 25000,
  };

  /**
   * Calculate arbetsgivaravgifter based on 2026 rates
   * Two-tier system: 20.81% up to 25,000 SEK, then 31.42% on remainder
   */
  calculateArbetsgivaravgifter(grossSalary: number): number {
    const { reducedRate, standardRate, thresholdSek } = this.config;

    const reducedPortion = Math.min(grossSalary, thresholdSek) * reducedRate;
    const standardPortion = Math.max(0, grossSalary - thresholdSek) * standardRate;

    return Math.round((reducedPortion + standardPortion) * 100) / 100;
  }

  /**
   * Full payroll calculation for one assistant in a month
   */
  calculatePayroll(data: EmployeePayrollData): PayrollResult {
    const { approvedHours, hourlyRate } = data;
    const grossSalary = Math.round(approvedHours * hourlyRate * 100) / 100;
    const arbetsgivaravgifter = this.calculateArbetsgivaravgifter(grossSalary);
    const taxWithheld = data.taxPercentage
      ? Math.round(grossSalary * (data.taxPercentage / 100) * 100) / 100
      : 0;

    return {
      approvedHours,
      hourlyRate,
      grossSalary,
      arbetsgivaravgifter,
      employerTotalCost: Math.round((grossSalary + arbetsgivaravgifter) * 100) / 100,
      taxWithheld,
      netPay: Math.round((grossSalary - taxWithheld) * 100) / 100,
    };
  }

  /**
   * Special case: age > 67 → only pension contribution (10.21%)
   * Implementation deferred to Phase 2 if needed
   */
  applyAgeAdjustment(salary: number, birthYear: number): number {
    const currentYear = this.config.year;
    const age = currentYear - birthYear;
    if (age > 67) {
      return Math.round(salary * 0.1021 * 100) / 100; // Pension only
    }
    return this.calculateArbetsgivaravgifter(salary);
  }
}

export default new PayrollCalculatorService();
```

### API Endpoint

**POST /api/payroll/calculate**

```typescript
// server/src/routes/payroll.ts

import { Router, Request, Response } from 'express';
import { requireGuardian } from '../middleware/auth';
import { db } from '../db';
import { assistantEarnings, payrollRuns, entries, absences } from '../db/schema';
import { eq, and, gte, lte } from 'drizzle-orm';
import payrollCalculator from '../lib/payrollCalculator';

const router = Router();

router.post('/calculate', requireGuardian, async (req: Request, res: Response) => {
  try {
    const { year, month } = req.body;
    const guardianId = (req as any).user.userId;

    // 1. Check if payroll run already exists
    let payrollRun = await db
      .select()
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.guardianId, guardianId),
          eq(payrollRuns.year, year),
          eq(payrollRuns.month, month)
        )
      )
      .limit(1);

    if (!payrollRun.length) {
      const [newRun] = await db
        .insert(payrollRuns)
        .values({
          guardianId,
          year,
          month,
          status: 'draft',
        })
        .returning();
      payrollRun = [newRun];
    }

    // 2. Get all approved entries for the month (excluding absences)
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    const monthlyEntries = await db
      .select({
        assistantId: entries.assistantId,
        hours: entries.hours,
      })
      .from(entries)
      .leftJoin(
        absences,
        and(
          eq(absences.assistantId, entries.assistantId),
          gte(entries.date, absences.startDate),
          lte(entries.date, absences.endDate)
        )
      )
      .where(
        and(
          eq(entries.guardianId, guardianId),
          eq(entries.reqStatus, 'approved'),
          gte(entries.date, startDate),
          lte(entries.date, endDate)
        )
      );

    // 3. Group by assistant, sum hours
    const hoursByAssistant = monthlyEntries.reduce(
      (acc, entry) => {
        if (!acc[entry.assistantId]) acc[entry.assistantId] = 0;
        acc[entry.assistantId] += parseFloat(entry.hours.toString());
        return acc;
      },
      {} as Record<string, number>
    );

    // 4. Get hourly rates from settings
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.guardianId, guardianId));

    const hourlyRate = profile?.hourlyRate || 150; // Default 150 SEK

    // 5. Calculate earnings and insert into assistantEarnings
    const earnings = [];
    for (const [assistantId, approvedHours] of Object.entries(hoursByAssistant)) {
      const result = payrollCalculator.calculatePayroll({
        assistantId,
        approvedHours,
        hourlyRate,
        taxPercentage: 0, // TODO: get from assistant profile if applicable
      });

      earnings.push(
        await db
          .insert(assistantEarnings)
          .values({
            payrollRunId: payrollRun[0].id,
            assistantId,
            approvedHours: result.approvedHours.toString(),
            hourlyRate: result.hourlyRate.toString(),
            grossSalary: result.grossSalary.toString(),
            arbetsgivaravgifter: result.arbetsgivaravgifter.toString(),
            employerTotalCost: result.employerTotalCost.toString(),
            taxWithheld: result.taxWithheld.toString(),
            netPay: result.netPay.toString(),
            calculatedBy: guardianId,
          })
          .returning()
      );
    }

    res.status(200).json({
      payrollRunId: payrollRun[0].id,
      month,
      year,
      totalEarnings: earnings.length,
      totalGrossSalaries: earnings
        .reduce((sum, e) => sum + parseFloat(e.grossSalary.toString()), 0)
        .toFixed(2),
      totalAGI: earnings
        .reduce((sum, e) => sum + parseFloat(e.arbetsgivaravgifter.toString()), 0)
        .toFixed(2),
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

export default router;
```

---

## 2. AGI XML Export (Skatteverket Reporting)

### Data Structure

**AGIExporter Service:**

```typescript
// server/src/lib/agiExporter.ts

import { document } from 'xmlbuilder2';

interface AGIAbsence {
  type: 'sjuk' | 'vab' | 'semester' | 'tjänstledigt' | 'övrig';
  startDate: string;   // YYYY-MM-DD
  endDate: string;     // YYYY-MM-DD
  hoursOrPercent: number; // hours or percentage of work time
  isPercentage: boolean;   // true if percent, false if hours
}

interface AGIEmployee {
  personnummer: string;         // e.g., "19801234-5678"
  name: string;
  grossSalary: number;          // Total gross pay for month
  arbetsgivaravgifter: number;  // Employer contribution
  absences?: AGIAbsence[];
}

interface AGIDeclaration {
  year: number;
  month: number;
  organisationNumber: string;   // E.g., "556000-0000" (for individual: personnummer)
  declarantName: string;
  employees: AGIEmployee[];
}

class AGIExporter {
  /**
   * Generate Skatteverket AGI XML for a month
   * Schema version: 2.0 (updated 2025 to include absences)
   */
  generateXml(declaration: AGIDeclaration): string {
    const doc = document()
      .ele('ArbetsgivardeklarationIndividNiva', {
        xmlns: 'urn:skatteverket:arbetsgivardeklaration:2025',
        version: '2.0',
      })
      .ele('Deklarant')
      .ele('OrganisationsnummerUndersokare', declaration.organisationNumber)
      .up()
      .ele('DeklarantNamn', declaration.declarantName)
      .up()
      .up() // close Deklarant
      .ele('DeklarationsPeriod')
      .ele('År', declaration.year.toString())
      .up()
      .ele('Månad', declaration.month.toString())
      .up()
      .up(); // close DeklarationsPeriod

    // Add each employee's declaration
    declaration.employees.forEach((emp) => {
      const empEle = doc
        .ele('ArbetsgivardeklarationAnstalld')
        .ele('PersonnummerAnstalld', emp.personnummer)
        .up()
        .ele('Namn', emp.name)
        .up()
        .ele('LöpSummaLön', emp.grossSalary.toFixed(2))
        .up()
        .ele('Arbetsgivaravgift', emp.arbetsgivaravgifter.toFixed(2))
        .up();

      // Add absences if present (new in 2025 schema)
      if (emp.absences && emp.absences.length > 0) {
        emp.absences.forEach((absence) => {
          const absEle = empEle
            .ele('Frånvaro')
            .ele('FrånvaroTyp', absence.type)
            .up()
            .ele('StartDatum', absence.startDate)
            .up()
            .ele('SlutDatum', absence.endDate)
            .up();

          if (absence.isPercentage) {
            absEle.ele('ProcentsatsArbetsTid', absence.hoursOrPercent.toString()).up();
          } else {
            absEle.ele('AntalTimmar', absence.hoursOrPercent.toFixed(2)).up();
          }

          absEle.up(); // close Frånvaro
        });
      }

      empEle.up(); // close ArbetsgivardeklarationAnstalld
    });

    return doc.end({ prettyPrint: true });
  }

  /**
   * Generate filename following Skatteverket convention: AGI_YYYY_MM.xml
   */
  getFilename(year: number, month: number): string {
    return `AGI_${year}_${String(month).padStart(2, '0')}.xml`;
  }
}

export default new AGIExporter();
```

### API Endpoint

**GET /api/payroll/agi-export**

```typescript
// server/src/routes/payroll.ts (continued)

router.get('/agi-export', requireGuardian, async (req: Request, res: Response) => {
  try {
    const { year, month } = req.query;
    const guardianId = (req as any).user.userId;

    if (!year || !month) {
      return res.status(400).json({ error: 'year and month required' });
    }

    // 1. Get payroll run for the month
    const [payrollRun] = await db
      .select()
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.guardianId, guardianId),
          eq(payrollRuns.year, parseInt(year as string)),
          eq(payrollRuns.month, parseInt(month as string))
        )
      );

    if (!payrollRun) {
      return res.status(404).json({ error: 'No payroll run for this month' });
    }

    // 2. Get all earnings and absences for the month
    const earnings = await db
      .select()
      .from(assistantEarnings)
      .where(eq(assistantEarnings.payrollRunId, payrollRun.id));

    const employees: AGIEmployee[] = [];

    for (const earning of earnings) {
      // Get assistant details
      const [assistant] = await db
        .select()
        .from(assistants)
        .where(eq(assistants.id, earning.assistantId));

      // Get absences for the month
      const monthAbsences = await db
        .select()
        .from(absences)
        .where(
          and(
            eq(absences.assistantId, earning.assistantId),
            gte(absences.endDate, new Date(parseInt(year as string), parseInt(month as string) - 1, 1)),
            lte(absences.startDate, new Date(parseInt(year as string), parseInt(month as string), 0))
          )
        );

      employees.push({
        personnummer: assistant.personnummer || '',
        name: `${assistant.firstName} ${assistant.lastName}`,
        grossSalary: parseFloat(earning.grossSalary.toString()),
        arbetsgivaravgifter: parseFloat(earning.arbetsgivaravgifter.toString()),
        absences: monthAbsences.map((abs) => ({
          type: abs.type as any,
          startDate: abs.startDate.toISOString().split('T')[0],
          endDate: abs.endDate.toISOString().split('T')[0],
          hoursOrPercent: parseFloat(abs.percentageOfWorkTime?.toString() || abs.hours?.toString() || '0'),
          isPercentage: !!abs.percentageOfWorkTime,
        })),
      });
    }

    // 3. Get guardian profile for declarant name
    const [profile] = await db
      .select()
      .from(profiles)
      .where(eq(profiles.guardianId, guardianId));

    // 4. Generate XML
    const agiExporter = new AGIExporter();
    const xmlContent = agiExporter.generateXml({
      year: parseInt(year as string),
      month: parseInt(month as string),
      organisationNumber: profile?.personnummer || 'UNKNOWN',
      declarantName: profile?.name || 'Unknown',
      employees,
    });

    // 5. Return XML file download
    res.setHeader('Content-Type', 'application/xml');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${agiExporter.getFilename(parseInt(year as string), parseInt(month as string))}"`
    );
    res.send(xmlContent);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
```

---

## 3. Leave & Absence Tracking

### Data Model (Already Defined Above)

See schema addition for `absences` and `leaveBalances` tables.

### API Endpoints

**POST /api/absences/record**

```typescript
// server/src/routes/absences.ts

router.post('/record', requireGuardian, async (req: Request, res: Response) => {
  try {
    const { assistantId, type, startDate, endDate, hours, percentageOfWorkTime, notes } = req.body;
    const guardianId = (req as any).user.userId;

    // Validate dates
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (end < start) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }

    // Record absence
    const [absence] = await db
      .insert(absences)
      .values({
        guardianId,
        assistantId,
        type,
        startDate: start,
        endDate: end,
        hours: hours ? hours.toString() : null,
        percentageOfWorkTime: percentageOfWorkTime ? percentageOfWorkTime.toString() : '100',
        notes,
        createdBy: guardianId,
      })
      .returning();

    res.status(201).json(absence);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});

router.get('/monthly', requireGuardian, async (req: Request, res: Response) => {
  try {
    const { year, month, assistantId } = req.query;
    const guardianId = (req as any).user.userId;

    const startDate = new Date(parseInt(year as string), parseInt(month as string) - 1, 1);
    const endDate = new Date(parseInt(year as string), parseInt(month as string), 0);

    const monthlyAbsences = await db
      .select()
      .from(absences)
      .where(
        and(
          eq(absences.guardianId, guardianId),
          assistantId ? eq(absences.assistantId, assistantId as string) : undefined,
          gte(absences.startDate, startDate),
          lte(absences.endDate, endDate)
        )
      );

    res.json(monthlyAbsences);
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
```

---

## 4. Print-Ready PDF Output

### FK 3059 (Time Report) — Updated with Payroll Data

The existing pdf-lib approach remains unchanged. When generating FK 3059, include:

```typescript
// server/src/routes/pdf.ts (updated)

router.post('/fk3059', requireGuardian, async (req: Request, res: Response) => {
  try {
    const { year, month } = req.body;
    const guardianId = (req as any).user.userId;

    // 1. Load base PDF form
    const pdfPath = path.join(__dirname, '../../forms/fk3059.pdf');
    const pdfBytes = fs.readFileSync(pdfPath);
    const decryptedBytes = await decryptPdfWithQpdf(pdfBytes);
    const pdf = await PDFDocument.load(decryptedBytes);

    // 2. Get payroll data for the month (NEW)
    const [payrollRun] = await db
      .select()
      .from(payrollRuns)
      .where(
        and(
          eq(payrollRuns.guardianId, guardianId),
          eq(payrollRuns.year, year),
          eq(payrollRuns.month, month)
        )
      );

    // 3. Populate form fields
    const form = pdf.getForm();

    // Existing fields...
    form.getTextField('PERIOD_FROM').setText(`${month}/1/${year}`);
    form.getTextField('PERIOD_TO').setText(
      `${month}/${new Date(year, month, 0).getDate()}/${year}`
    );

    // If payroll run exists, populate payroll summary (NEW)
    if (payrollRun) {
      const earnings = await db
        .select()
        .from(assistantEarnings)
        .where(eq(assistantEarnings.payrollRunId, payrollRun.id));

      const totalGross = earnings.reduce((s, e) => s + parseFloat(e.grossSalary.toString()), 0);
      const totalAGI = earnings.reduce((s, e) => s + parseFloat(e.arbetsgivaravgifter.toString()), 0);

      form.getTextField('TOTAL_GROSS_SALARY')?.setText(totalGross.toFixed(2));
      form.getTextField('TOTAL_AGI')?.setText(totalAGI.toFixed(2));
    }

    // 4. Flatten form (make non-editable)
    form.flatten();

    // 5. Return PDF
    const pdfOut = await pdf.save();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FK3059_${year}_${month}.pdf"`);
    res.send(Buffer.from(pdfOut));
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
```

### Skatteverket AGI Form (if needed)

Currently, AGI is exported as XML for manual submission. If a print-ready Skatteverket AGI form becomes required:
1. Request the official PDF form from Skatteverket
2. Use existing pdf-lib + qpdf approach
3. Populate fields from `assistantEarnings` and `absences` tables

---

## Testing Strategy

### Unit Tests (proposed)

```typescript
// server/__tests__/lib/payrollCalculator.test.ts

describe('PayrollCalculator', () => {
  it('calculates reduced rate for salary < 25000', () => {
    const result = payrollCalculator.calculatePayroll({
      assistantId: 'test',
      approvedHours: 100,
      hourlyRate: 200, // 20,000 gross
    });
    expect(result.arbetsgivaravgifter).toBe(416); // 20,000 × 0.2081
  });

  it('applies two-tier rate for salary > 25000', () => {
    const result = payrollCalculator.calculatePayroll({
      assistantId: 'test',
      approvedHours: 150,
      hourlyRate: 200, // 30,000 gross
    });
    // 25,000 × 0.2081 + 5,000 × 0.3142 = 5,202.50 + 1,571 = 6,773.50
    expect(result.arbetsgivaravgifter).toBe(6773.50);
  });
});
```

### Integration Tests

1. **Create payroll run** → verify Drizzle inserts record
2. **Calculate payroll** → verify earnings are inserted correctly
3. **Export AGI XML** → validate XML schema against Skatteverket test service
4. **Record absence** → verify it excludes from billable hours in FK report
5. **Generate FK 3059** → verify payroll data is populated in form

---

## 2026 Regulatory Considerations

| Requirement | Implementation |
|-------------|----------------|
| Arbetsgivaravgifter 31.42% standard, 20.81% reduced | Hard-coded in PayrollCalculatorService |
| AGI XML format version 2.0 (Jan 2025+) | xmlbuilder2 with updated schema |
| Absence reporting (new 2025) | Drizzle `absences` table + AGI export |
| Double-check month-end date | Use `date-fns` for reliable month boundaries |
| Preliminary tax (preliminärskatt) tracking | `taxWithheld` field in assistantEarnings |

---

## Performance Notes

| Operation | Expected Behavior |
|-----------|-------------------|
| Calculate payroll for 1 month | <100ms (simple arithmetic) |
| Export AGI XML (20 employees) | <200ms (XML generation overhead) |
| Generate FK 3059 PDF | 500–1000ms (qpdf decryption + pdf-lib filling) |

For larger-scale deployments (100+ employees), consider:
- Caching payroll calculations per run
- Batch AGI exports with streaming XML
- Background job for PDF generation

---

## References

- [Skatteverket AGI Technical Description](https://www.skatteverket.se/foretag/arbetsgivare/lamnaarbetsgivardeklaration/tekniskbeskrivningochtesttjanst.4.309a41aa1672ad0c8377c8b.html)
- [Swedish Payroll Rates 2026](https://www.skatteverket.se/servicelankar/otherlanguages/engliskengelska/businessesandemployers/startingandrunningaswedishbusiness/declaringtaxesbusinesses/filingapayereturn/employercontributions.4.2fb39afe18dabf1e4d24a3d.html)
- [Drizzle ORM Documentation](https://orm.drizzle.team/)
- [xmlbuilder2 Documentation](https://oozcitak.github.io/xmlbuilder2/)

