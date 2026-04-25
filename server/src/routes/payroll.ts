import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { payrollRecords, assistants, entries, absences, costs, settings } from "../db/schema";
import { eq, and, gte, lte, or, isNull } from "drizzle-orm";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";
import { calculatePayroll } from "../lib/payroll-utils";
import { filterBillableEntries } from "../lib/absence-utils";
import type { AbsenceRow, EntryRow } from "../lib/absence-utils";

const router = Router();

const MonthSchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/, "month must be YYYY-MM format"),
});

// GET /api/payroll?month=YYYY-MM — list payroll records for a month
// IMPORTANT: Placed first before /:id routes to avoid Express path conflict
router.get("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const parsed = MonthSchema.safeParse(req.query);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid month" });
    }
    const rows = await db.select().from(payrollRecords).where(
      eq(payrollRecords.month, parsed.data.month)
    );
    res.json(rows);
  } catch (e) {
    console.error("[payroll] GET error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/payroll/generate — generate payroll records for all assistants for a month
// IMPORTANT: Must be placed BEFORE /:id routes to avoid Express matching "generate" as an id
router.post("/generate", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const parsed = MonthSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid month" });
    }

    const hourlyRate = parseFloat(process.env.FK_HOURLY_RATE ?? "334");
    const taxRate    = parseFloat(process.env.EMPLOYER_TAX_RATE ?? "0.3142");

    // Read preliminary tax rate from settings (D-04, D-05)
    const settingsRows = await db.select().from(settings);
    const settingsMap = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));
    const prelimTaxRate = parseFloat(settingsMap["preliminary_tax_rate"] ?? "0");

    const allAssistants = await db.select().from(assistants);

    const { month } = parsed.data;
    const [yearStr, monStr] = month.split("-");
    const monthStart = `${month}-01`;
    const daysInMonth = new Date(parseInt(yearStr), parseInt(monStr), 0).getDate();
    const monthEnd = `${month}-${String(daysInMonth).padStart(2, "0")}`;

    const result: typeof payrollRecords.$inferSelect[] = [];

    for (const asst of allAssistants) {
      // Check for existing record
      const existing = await db.select().from(payrollRecords).where(
        and(
          eq(payrollRecords.assistantId, asst.id),
          eq(payrollRecords.month, month)
        )
      );
      if (existing.length > 0) {
        if (existing[0].status === "approved") {
          // Approved records are locked — never overwrite
          result.push(existing[0]);
          continue;
        }
        // Draft record exists — delete it and recalculate from current entries
        await db.delete(payrollRecords).where(eq(payrollRecords.id, existing[0].id));
      }

      // Fetch approved entries for this assistant in the month
      const monthEntries = await db.select().from(entries).where(
        and(
          eq(entries.assistantId, asst.id),
          gte(entries.date, monthStart),
          lte(entries.date, monthEnd),
          eq(entries.reqStatus, "approved")
        )
      );

      // Fetch absences using assistant-scoped DB query (RESEARCH.md Pattern 8 — matches pdf.ts pipeline per D-05)
      // Includes null-assistantId absences (public holidays that apply to all assistants)
      const monthAbsences = await db
        .select()
        .from(absences)
        .where(
          and(
            or(eq(absences.assistantId, asst.id), isNull(absences.assistantId)),
            lte(absences.startDate, monthEnd),
            gte(absences.endDate, monthStart)
          )
        );

      // Build typed absence rows for filterBillableEntries (D-05)
      const absenceRows: AbsenceRow[] = monthAbsences.map(a => ({
        assistantId: a.assistantId,
        startDate:   a.startDate,
        endDate:     a.endDate,
        absenceType: a.absenceType,
      }));

      // Build typed entry rows
      const entryRows: EntryRow[] = monthEntries.map(e => ({
        id:          e.id,
        assistantId: e.assistantId,
        date:        e.date,
        hours:       e.hours,
      }));

      // Filter to billable entries (D-05 — same function used by FK forms)
      const billableEntries = filterBillableEntries(entryRows, absenceRows);
      const billableHours = billableEntries.reduce((sum, e) => sum + e.hours, 0);

      // Query costs scoped to this assistant + month (D-02)
      const costsRows = await db.select().from(costs).where(
        and(eq(costs.assistantId, asst.id), eq(costs.month, month))
      );
      const costsSum = costsRows.reduce((s, c) => s + c.amountSek, 0);

      // Calculate payroll figures (D-04)
      const { grossPay, employerContributions, totalEmployerCost } = calculatePayroll({
        billableHours,
        hourlyRate,
        taxRate,
        costsSum,   // NEW — D-02
      });

      // Compute per-type absence breakdown (PAY-02 — RESEARCH.md Pattern 9)
      // Cross-reference non-billable entries against monthAbsences to count hours per type
      const nonBillableEntries = entryRows.filter(
        (e) => !billableEntries.some((b) => b.id === e.id)
      );
      const absenceBreakdown: Record<string, number> = {
        "sjukfrånvaro": 0,
        "vab":          0,
        "semester":     0,
        "other":        0,
      };
      for (const entry of nonBillableEntries) {
        // Find the absence covering this entry's date
        const covering = monthAbsences.find(
          (a) =>
            (a.assistantId === asst.id || a.assistantId === null) &&
            a.startDate <= entry.date &&
            a.endDate >= entry.date
        );
        if (covering) {
          const type = covering.absenceType as keyof typeof absenceBreakdown;
          absenceBreakdown[type] = (absenceBreakdown[type] ?? 0) + entry.hours;
        }
      }
      const absenceBreakdownJson = JSON.stringify(absenceBreakdown);

      // Insert new payroll record with snapshotted rate values (D-02, D-05)
      const [newRow] = await db.insert(payrollRecords).values({
        id:                    newId(),
        assistantId:           asst.id,
        month,
        billableHours,
        hourlyRateSnapshot:    hourlyRate,
        taxRateSnapshot:       taxRate,
        prelimTaxRateSnapshot: prelimTaxRate,   // NEW — D-05
        grossPay,
        employerContributions,
        totalEmployerCost,
        absenceBreakdownJson,
        status:                "draft",
      }).returning();
      result.push(newRow);
    }

    res.status(201).json(result);
  } catch (e) {
    console.error("[payroll] generate error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/payroll/recalculate-drafts — one-time admin recalculation of all draft records
// IMPORTANT: Placed BEFORE /:id routes to avoid Express matching "recalculate-drafts" as an id
router.post("/recalculate-drafts", requireAuth, requireGuardian, async (_req: AuthRequest, res) => {
  try {
    const draftRecords = await db.select().from(payrollRecords).where(
      eq(payrollRecords.status, "draft")
    );
    const settingsRows = await db.select().from(settings);
    const settingsMap = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));
    const prelimTaxRate = parseFloat(settingsMap["preliminary_tax_rate"] ?? "0");

    let updated = 0;
    for (const record of draftRecords) {
      const costsRows = await db.select().from(costs).where(
        and(eq(costs.assistantId, record.assistantId), eq(costs.month, record.month))
      );
      const costsSum = costsRows.reduce((s, c) => s + c.amountSek, 0);
      const { grossPay, employerContributions, totalEmployerCost } = calculatePayroll({
        billableHours: record.billableHours,
        hourlyRate:    record.hourlyRateSnapshot,
        taxRate:       record.taxRateSnapshot,
        costsSum,
      });
      await db.update(payrollRecords)
        .set({ grossPay, employerContributions, totalEmployerCost, prelimTaxRateSnapshot: prelimTaxRate, updatedAt: new Date() })
        .where(eq(payrollRecords.id, record.id));
      updated++;
    }
    res.json({ ok: true, updated });
  } catch (e) {
    console.error("[payroll] recalculate-drafts error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/payroll/:id/approve — transition payroll record from draft to approved (D-13)
router.post("/:id/approve", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const [record] = await db.select().from(payrollRecords).where(
      eq(payrollRecords.id, req.params.id)
    );
    if (!record) {
      return res.status(404).json({ error: "Payroll record not found" });
    }
    // One-way state machine: draft → approved (T-03-04)
    if (record.status === "approved") {
      return res.status(409).json({ error: "Det här löneunderlaget är redan godkänt och kan inte ändras." });
    }

    await db.update(payrollRecords)
      .set({ status: "approved", approvedAt: new Date(), updatedAt: new Date() })
      .where(eq(payrollRecords.id, req.params.id));

    const [updated] = await db.select().from(payrollRecords).where(
      eq(payrollRecords.id, req.params.id)
    );
    res.json(updated);
  } catch (e) {
    console.error("[payroll] approve error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
