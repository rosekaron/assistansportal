import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { absences, entries } from "../db/schema";
import { eq, and, gte, lte, or, isNull } from "drizzle-orm";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";
import { vabBalance, sickYtd, AbsenceRow } from "../lib/absence-utils";

const router = Router();

const CreateAbsenceSchema = z.object({
  assistantId: z.string().nullable().optional(),
  absenceType: z.enum(["sjukfrånvaro", "vab", "semester", "other"]),
  startDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  endDate:     z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
}).refine(d => d.startDate <= d.endDate, {
  message: "endDate must be on or after startDate",
  path: ["endDate"],
});

// GET /api/absences — list with optional ?assistantId= &year= &month= filters
router.get("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { assistantId, year, month } = req.query as Record<string, string>;
    const conditions = [eq(absences.guardianId, req.userId!)];

    if (assistantId) conditions.push(eq(absences.assistantId, assistantId));
    if (year && month) {
      const mm = month.padStart(2, "0");
      const daysInMonth = new Date(parseInt(year), parseInt(mm), 0).getDate();
      const mStart = `${year}-${mm}-01`;
      const mEnd   = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;
      conditions.push(lte(absences.startDate, mEnd));
      conditions.push(gte(absences.endDate, mStart));
    } else if (year) {
      conditions.push(lte(absences.startDate, `${year}-12-31`));
      conditions.push(gte(absences.endDate, `${year}-01-01`));
    }

    const rows = await db.select().from(absences).where(and(...conditions))
      .orderBy(absences.startDate);
    res.json(rows);
  } catch (e) {
    console.error("[absences] GET error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/absences/balance/:assistantId — VAB remaining + sick YTD
// IMPORTANT: this route must be defined BEFORE /:id to avoid Express path conflict
router.get("/balance/:assistantId", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { assistantId } = req.params;
    const year = new Date().getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd   = `${year}-12-31`;

    // Fetch all absences for this assistant (or null-assistantId) overlapping the current year
    const rows = await db.select().from(absences).where(
      and(
        eq(absences.guardianId, req.userId!),
        or(
          eq(absences.assistantId, assistantId),
          isNull(absences.assistantId),
        ),
        lte(absences.startDate, yearEnd),
        gte(absences.endDate, yearStart),
      )
    );

    const absenceRows: AbsenceRow[] = rows.map(r => ({
      assistantId: r.assistantId,
      startDate: r.startDate,
      endDate: r.endDate,
      absenceType: r.absenceType,
    }));

    res.json({
      vabRemaining: vabBalance(absenceRows, assistantId, year),
      sickDays:     sickYtd(absenceRows, assistantId, year),
      year,
    });
  } catch (e) {
    console.error("[absences] balance error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/absences — create absence + auto-cancel overlapping approved shifts
router.post("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const parsed = CreateAbsenceSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
    }
    const { assistantId, absenceType, startDate, endDate } = parsed.data;

    // Insert the absence record
    const [created] = await db.insert(absences).values({
      id:          newId("ab"),
      guardianId:  req.userId!,
      assistantId: assistantId ?? null,
      absenceType,
      startDate,
      endDate,
    }).returning();

    // Auto-cancel overlapping approved entries (D-02)
    // If assistantId is null, cancel ALL entries in the range (public holiday pattern)
    const entryConditions = [
      gte(entries.date, startDate),
      lte(entries.date, endDate),
      eq(entries.reqStatus, "approved"),
    ];
    if (assistantId) {
      entryConditions.push(eq(entries.assistantId, assistantId));
    }

    await db.update(entries)
      .set({ reqStatus: "cancelled", updatedAt: new Date() })
      .where(and(...entryConditions));

    res.status(201).json(created);
  } catch (e) {
    console.error("[absences] POST error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/absences/:id — remove absence record
// Does NOT auto-restore cancelled shifts per D-02 (one-way auto-cancel)
router.delete("/:id", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const [existing] = await db.select().from(absences).where(
      and(
        eq(absences.id, req.params.id),
        eq(absences.guardianId, req.userId!),
      )
    ).limit(1);

    // Return 404 for both "not found" and "wrong guardian" — avoids disclosing existence
    // of other guardians' records (T-02-03-03)
    if (!existing) return res.status(404).json({ error: "Absence not found" });

    await db.delete(absences).where(eq(absences.id, req.params.id));
    res.json({ ok: true });
  } catch (e) {
    console.error("[absences] DELETE error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
