import { Router } from "express";
import { db } from "../db";
import { entries, assistants, profile, absences, paymentSlips } from "../db/schema";
import { eq, and, gte, lte, or, isNull, desc } from "drizzle-orm";
import { requireAuth, requireAssistantAccess, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";
import { getCalendarClient } from "./gcal";

const router = Router();
router.use(requireAuth, requireAssistantAccess);

router.get("/me", async (req: AuthRequest, res) => {
  try {
    if (!req.assistantId) return res.status(400).json({ error: "No assistant linked to this account" });
    const [assistant] = await db.select().from(assistants).where(eq(assistants.id, req.assistantId)).limit(1);
    const [prof]      = await db.select().from(profile).limit(1);
    res.json({ assistant, patientName: prof?.patientName, weeklyHours: prof?.weeklyHours });
  } catch (e) {
    console.error("[assistant] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/entries", async (req: AuthRequest, res) => {
  try {
    if (!req.assistantId) return res.status(400).json({ error: "No assistant linked" });
    const { start, end } = req.query as Record<string, string>;
    const rows = await db.select().from(entries).where(
      and(
        eq(entries.assistantId, req.assistantId),
        ...(start ? [gte(entries.date, start)] : []),
        ...(end   ? [lte(entries.date, end)]   : []),
      )
    ).orderBy(entries.date, entries.startTime);
    res.json(rows);
  } catch (e) {
    console.error("[assistant] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Schedule: read guardian's GCal events (assistant read-only view) ─────
router.get("/schedule", async (req: AuthRequest, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    const { calendar, calendarId } = await getCalendarClient();
    const { data } = await calendar.events.list({
      calendarId,
      timeMin: start ? new Date(start).toISOString() : new Date().toISOString(),
      timeMax: end   ? new Date(end).toISOString()   : undefined,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });
    res.json(data.items ?? []);
  } catch (e) {
    console.error("[assistant] schedule error:", e);
    // If GCal isn't connected yet, return empty list rather than crashing
    res.json([]);
  }
});

router.put("/entries/:id/accept", async (req: AuthRequest, res) => {
  try {
    const [entry] = await db.select().from(entries).where(
      and(eq(entries.id, req.params.id), eq(entries.assistantId, req.assistantId!))
    ).limit(1);
    if (!entry) return res.status(404).json({ error: "Shift not found" });
    if (entry.reqStatus !== "pending") return res.status(400).json({ error: "Shift is not pending" });

    // Block clock-in if the entry date is covered by an active absence (D-02, T-02-03-04)
    // Server-side enforcement is authoritative — frontend check is UX-only.
    const activeAbsence = await db.select().from(absences).where(
      and(
        or(
          eq(absences.assistantId, req.assistantId!),
          isNull(absences.assistantId),
        ),
        lte(absences.startDate, entry.date),
        gte(absences.endDate, entry.date),
      )
    ).limit(1);

    if (activeAbsence.length > 0) {
      return res.status(409).json({ error: "Assistant has an active absence on this date" });
    }

    const [updated] = await db.update(entries)
      .set({ reqStatus: "approved", calStatus: "confirmed", updatedAt: new Date() })
      .where(eq(entries.id, req.params.id)).returning();
    res.json(updated);
  } catch (e) {
    console.error("[assistant] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/entries/:id/reject", async (req: AuthRequest, res) => {
  try {
    const [entry] = await db.select().from(entries).where(
      and(eq(entries.id, req.params.id), eq(entries.assistantId, req.assistantId!))
    ).limit(1);
    if (!entry) return res.status(404).json({ error: "Shift not found" });
    const [updated] = await db.update(entries)
      .set({ reqStatus: "rejected", calStatus: null, updatedAt: new Date() })
      .where(eq(entries.id, req.params.id)).returning();
    res.json(updated);
  } catch (e) {
    console.error("[assistant] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── SLIP-02: list the JWT-bound assistant's issued salary slips ──────────
// IDOR guard: WHERE assistantId = req.assistantId (never query/body).
router.get("/slips", async (req: AuthRequest, res) => {
  try {
    if (!req.assistantId) {
      return res.status(400).json({ error: "No assistant linked to this account" });
    }
    const rows = await db.select().from(paymentSlips)
      .where(eq(paymentSlips.assistantId, req.assistantId))
      .orderBy(desc(paymentSlips.reportMonth), desc(paymentSlips.issuedAt));
    res.json(rows.map((r: any) => ({
      id:             r.id,
      reportMonth:    r.reportMonth,
      documentNumber: r.documentNumber,
      issuedAt:       r.issuedAt,
      payDate:        r.payDate,
      payMethod:      r.payMethod,
    })));
  } catch (e) {
    console.error("[assistant] slips error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/entries/:id/submit-report", async (req: AuthRequest, res) => {
  try {
    const [entry] = await db.select().from(entries).where(
      and(eq(entries.id, req.params.id), eq(entries.assistantId, req.assistantId!))
    ).limit(1);
    if (!entry) return res.status(404).json({ error: "Shift not found" });
    if (entry.reqStatus !== "approved") return res.status(400).json({ error: "Can only report approved shifts" });
    const [updated] = await db.update(entries)
      .set({ repStatus: "pending", updatedAt: new Date() })
      .where(eq(entries.id, req.params.id)).returning();
    res.json(updated);
  } catch (e) {
    console.error("[assistant] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
