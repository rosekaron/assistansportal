import { Router } from "express";
import { db } from "../db";
import { entries, assistants, profile, openSlots } from "../db/schema";
import { eq, and, gte, lte } from "drizzle-orm";
import { requireAuth, requireAssistant, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();
router.use(requireAuth, requireAssistant);

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

router.put("/entries/:id/accept", async (req: AuthRequest, res) => {
  try {
    const [entry] = await db.select().from(entries).where(
      and(eq(entries.id, req.params.id), eq(entries.assistantId, req.assistantId!))
    ).limit(1);
    if (!entry) return res.status(404).json({ error: "Shift not found" });
    if (entry.reqStatus !== "pending") return res.status(400).json({ error: "Shift is not pending" });
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

router.post("/self-book/:slotId", async (req: AuthRequest, res) => {
  try {
    if (!req.assistantId) return res.status(400).json({ error: "No assistant linked" });
    const [slot] = await db.select().from(openSlots).where(eq(openSlots.id, req.params.slotId)).limit(1);
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    const existing = await db.select().from(entries).where(
      and(eq(entries.date, slot.date), eq(entries.startTime, slot.startTime), eq(entries.endTime, slot.endTime))
    );
    const filled = existing.filter(e => e.reqStatus !== "rejected").length;
    if (filled >= (slot.capacity ?? 1)) return res.status(400).json({ error: "Slot is full" });
    const [entry] = await db.insert(entries).values({
      id: newId("e"), assistantId: req.assistantId,
      date: slot.date, startTime: slot.startTime, endTime: slot.endTime, hours: slot.hours,
      reqStatus: "pending", repStatus: "draft", source: "self_book",
      calStatus: "tentative", activityId: slot.activityId,
    }).returning();
    if (filled + 1 >= (slot.capacity ?? 1)) {
      await db.delete(openSlots).where(eq(openSlots.id, slot.id));
    }
    res.status(201).json(entry);
  } catch (e) {
    console.error("[assistant] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/open-slots", async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(openSlots).orderBy(openSlots.date, openSlots.startTime);
    const withFill = await Promise.all(rows.map(async (slot) => {
      const booked = await db.select().from(entries).where(
        and(eq(entries.date, slot.date), eq(entries.startTime, slot.startTime), eq(entries.endTime, slot.endTime))
      );
      const filled = booked.filter(e => e.reqStatus !== "rejected").length;
      return { ...slot, filled, isFull: filled >= (slot.capacity ?? 1) };
    }));
    res.json(withFill.filter(s => !s.isFull));
  } catch (e) {
    console.error("[assistant] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
