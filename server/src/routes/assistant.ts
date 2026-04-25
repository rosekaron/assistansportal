import { Router } from "express";
import { db } from "../db";
import { entries, assistants, profile, absences, paymentSlips, authAssistants } from "../db/schema";
import { eq, and, gte, lte, or, isNull, desc, inArray } from "drizzle-orm";
import { requireAuth, requireAssistantAccess, AuthRequest } from "../middleware/auth";
import { getCalendarClient } from "./gcal";

const router = Router();
router.use(requireAuth, requireAssistantAccess);

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
  } catch (e) {
    console.error("[assistant] /me error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
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

    // Attach familyLabel from the assistant record so the UI can show family tags (multi-family)
    const linkedAssistants = await db.select().from(assistants).where(inArray(assistants.id, assistantIds));
    const assistantMap = Object.fromEntries(linkedAssistants.map(a => [a.id, a]));

    const rowsWithFamily = rows.map(r => ({
      ...r,
      familyLabel: assistantMap[r.assistantId]?.familyLabel ?? "",
    }));

    res.json(rowsWithFamily);
  } catch (e) {
    console.error("[assistant] /entries error:", e);
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

// ── PUT /entries/:id/accept ────────────────────────────────────
router.put("/entries/:id/accept", async (req: AuthRequest, res) => {
  try {
    const assistantIds = await getLinkedAssistantIds(req.userId!, req.assistantId ?? undefined);
    const [entry] = await db.select().from(entries).where(
      and(eq(entries.id, req.params.id), inArray(entries.assistantId, assistantIds))
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
  } catch (e) {
    console.error("[assistant] /submit-report error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// NOTE: main's POST /entries/:id/clock-in and /clock-out routes were dropped during the
// 2026-04-25 main↔milestone reconciliation per Decision #2 — milestone's separate `clock.ts`
// route is the authoritative clock-in/out implementation. main's parallel approach used
// `entries.clockedInAt`/`clockedOutAt` columns which were also dropped from the schema.
//
// NOTE: main's GET /open-slots and POST /self-book/:slotId routes were dropped per
// Phase 7 CLEAN-01 — the entire scheduling-scaffolding (`openSlots` table + UI card +
// self-book endpoints) was deliberately removed as dead code.

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
