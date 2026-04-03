import { Router } from "express";
import { db } from "../db";
import { entries, assistants, profile, openSlots, authAssistants } from "../db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();
router.use(requireAuth);

// ── Helper: get all accepted assistantIds for this auth account ──
async function getLinkedAssistantIds(authId: number, legacyAssistantId?: string): Promise<string[]> {
  // New junction table (accepted links)
  const links = await db.select().from(authAssistants)
    .where(and(eq(authAssistants.authId, authId), eq(authAssistants.status, "accepted")));
  const ids = links.map(l => l.assistantId);

  // Backward compat: include legacy single-link if present and not already in list
  if (legacyAssistantId && !ids.includes(legacyAssistantId)) {
    ids.push(legacyAssistantId);
  }
  return ids;
}

// ── GET /me ────────────────────────────────────────────────────
router.get("/me", async (req: AuthRequest, res) => {
  try {
    const assistantIds = await getLinkedAssistantIds(req.userId!, req.assistantId ?? undefined);
    if (assistantIds.length === 0) return res.status(400).json({ error: "No assistant linked to this account" });

    const linkedAssistants = await db.select().from(assistants).where(inArray(assistants.id, assistantIds));
    // For backward compat: primary assistant = first result or the legacy one
    const primary = linkedAssistants.find(a => a.id === req.assistantId) ?? linkedAssistants[0];

    const [prof] = await db.select().from(profile).limit(1);
    res.json({
      assistant:   primary,
      assistants:  linkedAssistants,
      patientName: prof?.patientName,
      weeklyHours: prof?.weeklyHours,
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── GET /entries ───────────────────────────────────────────────
router.get("/entries", async (req: AuthRequest, res) => {
  try {
    const assistantIds = await getLinkedAssistantIds(req.userId!, req.assistantId ?? undefined);
    if (assistantIds.length === 0) return res.status(400).json({ error: "No assistant linked" });

    const { start, end } = req.query as Record<string, string>;
    const rows = await db.select().from(entries).where(
      and(
        inArray(entries.assistantId, assistantIds),
        ...(start ? [gte(entries.date, start)] : []),
        ...(end   ? [lte(entries.date, end)]   : []),
      )
    ).orderBy(entries.date, entries.startTime);

    // Attach familyLabel from the assistant record so the UI can show family tags
    const linkedAssistants = await db.select().from(assistants).where(inArray(assistants.id, assistantIds));
    const assistantMap = Object.fromEntries(linkedAssistants.map(a => [a.id, a]));

    const rowsWithFamily = rows.map(r => ({
      ...r,
      familyLabel: assistantMap[r.assistantId]?.familyLabel ?? "",
    }));

    res.json(rowsWithFamily);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── PUT /entries/:id/accept ────────────────────────────────────
router.put("/entries/:id/accept", async (req: AuthRequest, res) => {
  try {
    const assistantIds = await getLinkedAssistantIds(req.userId!, req.assistantId ?? undefined);
    const [entry] = await db.select().from(entries).where(
      and(eq(entries.id, req.params.id), inArray(entries.assistantId, assistantIds))
    ).limit(1);
    if (!entry) return res.status(404).json({ error: "Shift not found" });
    if (entry.reqStatus !== "pending") return res.status(400).json({ error: "Shift is not pending" });
    const [updated] = await db.update(entries)
      .set({ reqStatus: "approved", calStatus: "confirmed", updatedAt: new Date() })
      .where(eq(entries.id, req.params.id)).returning();
    res.json(updated);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── PUT /entries/:id/reject ────────────────────────────────────
router.put("/entries/:id/reject", async (req: AuthRequest, res) => {
  try {
    const assistantIds = await getLinkedAssistantIds(req.userId!, req.assistantId ?? undefined);
    const [entry] = await db.select().from(entries).where(
      and(eq(entries.id, req.params.id), inArray(entries.assistantId, assistantIds))
    ).limit(1);
    if (!entry) return res.status(404).json({ error: "Shift not found" });
    const [updated] = await db.update(entries)
      .set({ reqStatus: "rejected", calStatus: null, updatedAt: new Date() })
      .where(eq(entries.id, req.params.id)).returning();
    res.json(updated);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── PUT /entries/:id/submit-report ────────────────────────────
router.put("/entries/:id/submit-report", async (req: AuthRequest, res) => {
  try {
    const assistantIds = await getLinkedAssistantIds(req.userId!, req.assistantId ?? undefined);
    const [entry] = await db.select().from(entries).where(
      and(eq(entries.id, req.params.id), inArray(entries.assistantId, assistantIds))
    ).limit(1);
    if (!entry) return res.status(404).json({ error: "Shift not found" });
    if (entry.reqStatus !== "approved") return res.status(400).json({ error: "Can only report approved shifts" });
    const [updated] = await db.update(entries)
      .set({ repStatus: "pending", updatedAt: new Date() })
      .where(eq(entries.id, req.params.id)).returning();
    res.json(updated);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── POST /entries/:id/clock-in ─────────────────────────────────
router.post("/entries/:id/clock-in", async (req: AuthRequest, res) => {
  try {
    const assistantIds = await getLinkedAssistantIds(req.userId!, req.assistantId ?? undefined);
    const [entry] = await db.select().from(entries).where(
      and(eq(entries.id, req.params.id), inArray(entries.assistantId, assistantIds))
    ).limit(1);
    if (!entry) return res.status(404).json({ error: "Shift not found" });
    if (entry.reqStatus !== "approved") return res.status(400).json({ error: "Can only clock in on approved shifts" });
    if (entry.clockedInAt) return res.status(400).json({ error: "Already clocked in" });
    const [updated] = await db.update(entries)
      .set({ clockedInAt: new Date(), updatedAt: new Date() })
      .where(eq(entries.id, req.params.id)).returning();
    res.json(updated);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── POST /entries/:id/clock-out ────────────────────────────────
router.post("/entries/:id/clock-out", async (req: AuthRequest, res) => {
  try {
    const assistantIds = await getLinkedAssistantIds(req.userId!, req.assistantId ?? undefined);
    const [entry] = await db.select().from(entries).where(
      and(eq(entries.id, req.params.id), inArray(entries.assistantId, assistantIds))
    ).limit(1);
    if (!entry) return res.status(404).json({ error: "Shift not found" });
    if (!entry.clockedInAt) return res.status(400).json({ error: "Not clocked in yet" });
    if (entry.clockedOutAt) return res.status(400).json({ error: "Already clocked out" });
    const now = new Date();
    const diffMins = (now.getTime() - new Date(entry.clockedInAt).getTime()) / 60000;
    const actualHours = Math.round(diffMins / 15) * 15 / 60;
    const [updated] = await db.update(entries)
      .set({ clockedOutAt: now, actualHours, repStatus: "pending", updatedAt: new Date() })
      .where(eq(entries.id, req.params.id)).returning();
    res.json(updated);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── GET /open-slots ────────────────────────────────────────────
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
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── POST /self-book/:slotId ────────────────────────────────────
router.post("/self-book/:slotId", async (req: AuthRequest, res) => {
  try {
    const assistantIds = await getLinkedAssistantIds(req.userId!, req.assistantId ?? undefined);
    if (assistantIds.length === 0) return res.status(400).json({ error: "No assistant linked" });
    const primaryId = req.assistantId ?? assistantIds[0];

    const [slot] = await db.select().from(openSlots).where(eq(openSlots.id, req.params.slotId)).limit(1);
    if (!slot) return res.status(404).json({ error: "Slot not found" });
    const existing = await db.select().from(entries).where(
      and(eq(entries.date, slot.date), eq(entries.startTime, slot.startTime), eq(entries.endTime, slot.endTime))
    );
    const filled = existing.filter(e => e.reqStatus !== "rejected").length;
    if (filled >= (slot.capacity ?? 1)) return res.status(400).json({ error: "Slot is full" });
    const [entry] = await db.insert(entries).values({
      id: newId("e"), assistantId: primaryId,
      date: slot.date, startTime: slot.startTime, endTime: slot.endTime, hours: slot.hours,
      reqStatus: "pending", repStatus: "draft", source: "self_book",
      calStatus: "tentative", activityId: slot.activityId,
    }).returning();
    if (filled + 1 >= (slot.capacity ?? 1)) {
      await db.delete(openSlots).where(eq(openSlots.id, slot.id));
    }
    res.status(201).json(entry);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── GET /families ──────────────────────────────────────────────
// List all families (assistant records) linked to this assistant account
router.get("/families", async (req: AuthRequest, res) => {
  try {
    const assistantIds = await getLinkedAssistantIds(req.userId!, req.assistantId ?? undefined);

    // Include pending link requests too
    const allLinks = await db.select().from(authAssistants)
      .where(eq(authAssistants.authId, req.userId!));

    const allAssistantIds = [...new Set([
      ...allLinks.map(l => l.assistantId),
      ...(req.assistantId ? [req.assistantId] : []),
    ])];

    const linkedAssistants = allAssistantIds.length > 0
      ? await db.select().from(assistants).where(inArray(assistants.id, allAssistantIds))
      : [];

    const result = linkedAssistants.map(a => {
      const link = allLinks.find(l => l.assistantId === a.id);
      const status = link?.status ?? (req.assistantId === a.id ? "accepted" : "pending");
      return { ...a, linkStatus: status, linkId: link?.id ?? null };
    });

    res.json(result);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── POST /families/:assistantId/leave ─────────────────────────
// Assistant leaves a family (removes the auth_assistants link)
router.post("/families/:assistantId/leave", async (req: AuthRequest, res) => {
  try {
    await db.delete(authAssistants).where(
      and(eq(authAssistants.authId, req.userId!), eq(authAssistants.assistantId, req.params.assistantId))
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── GET /link-requests ─────────────────────────────────────────
// Pending link requests sent to this assistant
router.get("/link-requests", async (req: AuthRequest, res) => {
  try {
    const pending = await db.select().from(authAssistants)
      .where(and(eq(authAssistants.authId, req.userId!), eq(authAssistants.status, "pending")));

    if (pending.length === 0) return res.json([]);

    const assistantIds = pending.map(l => l.assistantId);
    const linkedAssistants = await db.select().from(assistants).where(inArray(assistants.id, assistantIds));
    const result = pending.map(link => ({
      ...link,
      assistant: linkedAssistants.find(a => a.id === link.assistantId),
    }));
    res.json(result);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── POST /link-requests/:linkId/accept ────────────────────────
router.post("/link-requests/:linkId/accept", async (req: AuthRequest, res) => {
  try {
    const [link] = await db.select().from(authAssistants)
      .where(and(eq(authAssistants.id, req.params.linkId), eq(authAssistants.authId, req.userId!))).limit(1);
    if (!link) return res.status(404).json({ error: "Link request not found" });
    const [updated] = await db.update(authAssistants)
      .set({ status: "accepted" })
      .where(eq(authAssistants.id, req.params.linkId)).returning();
    res.json(updated);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── POST /link-requests/:linkId/decline ───────────────────────
router.post("/link-requests/:linkId/decline", async (req: AuthRequest, res) => {
  try {
    const [link] = await db.select().from(authAssistants)
      .where(and(eq(authAssistants.id, req.params.linkId), eq(authAssistants.authId, req.userId!))).limit(1);
    if (!link) return res.status(404).json({ error: "Link request not found" });
    const [updated] = await db.update(authAssistants)
      .set({ status: "declined" })
      .where(eq(authAssistants.id, req.params.linkId)).returning();
    res.json(updated);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
