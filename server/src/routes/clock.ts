import { Router } from "express";
import { eq, and, desc } from "drizzle-orm";
import { db } from "../db";
import { clockEvents, assistantGuardianLinks, assistants, entries } from "../db/schema";
import { requireAuth, requireAssistantAccess, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();

// All clock routes require authenticated assistant OR guardian-as-assistant
router.use(requireAuth, requireAssistantAccess);

// Helper: resolve assistantId from JWT userId
async function getAssistantId(userId: number): Promise<string | null> {
  const [a] = await db
    .select({ id: assistants.id })
    .from(assistants)
    .where(eq(assistants.authId, userId))
    .limit(1);
  return a?.id ?? null;
}

// POST /api/clock/in
// Body: { guardianId: number }
// Verifies active assistantGuardianLinks row exists (fraud prevention).
// Creates a clockEvent row with clockType="in" and verified=false.
router.post("/in", async (req: AuthRequest, res) => {
  try {
    const { guardianId } = req.body as { guardianId?: number };
    if (!guardianId || typeof guardianId !== "number") {
      return res.status(400).json({ error: "guardianId is required and must be a number" });
    }

    const assistantId = await getAssistantId(req.userId!);
    if (!assistantId) return res.status(404).json({ error: "Assistant not found" });

    // T-3.5-05: Verify active assistantGuardianLinks membership before allowing clock-in
    const [link] = await db
      .select()
      .from(assistantGuardianLinks)
      .where(
        and(
          eq(assistantGuardianLinks.assistantId, assistantId),
          eq(assistantGuardianLinks.guardianId, guardianId),
          eq(assistantGuardianLinks.active, true),
        ),
      )
      .limit(1);
    if (!link) return res.status(403).json({ error: "No active link for this family" });

    // Check if already clocked in (unprocessed clock-in = verified=false)
    const [existing] = await db
      .select()
      .from(clockEvents)
      .where(
        and(
          eq(clockEvents.assistantId, assistantId),
          eq(clockEvents.guardianId, guardianId),
          eq(clockEvents.clockType, "in"),
          eq(clockEvents.verified, false),
        ),
      )
      .orderBy(desc(clockEvents.timestamp))
      .limit(1);

    if (existing) {
      return res.status(400).json({ error: "Already clocked in for this family" });
    }

    const [event] = await db
      .insert(clockEvents)
      .values({
        id:          newId(),
        assistantId,
        guardianId,
        clockType:   "in",
        ip:          (req.ip ?? "").substring(0, 45),
        userAgent:   (req.headers["user-agent"] ?? "").substring(0, 255),
        verified:    false,
      })
      .returning();

    return res.status(201).json({ event });
  } catch (err) {
    console.error("[clock/in] error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/clock/out
// Body: { guardianId: number }
// Verifies active assistantGuardianLinks membership.
// Finds the active clock-in event, marks it verified=true.
// Creates a clock-out event, and auto-creates a verified entries row (shift report).
router.post("/out", async (req: AuthRequest, res) => {
  try {
    const { guardianId } = req.body as { guardianId?: number };
    if (!guardianId || typeof guardianId !== "number") {
      return res.status(400).json({ error: "guardianId is required and must be a number" });
    }

    const assistantId = await getAssistantId(req.userId!);
    if (!assistantId) return res.status(404).json({ error: "Assistant not found" });

    // T-3.5-05: Verify active assistantGuardianLinks membership before allowing clock-out
    const [link] = await db
      .select()
      .from(assistantGuardianLinks)
      .where(
        and(
          eq(assistantGuardianLinks.assistantId, assistantId),
          eq(assistantGuardianLinks.guardianId, guardianId),
          eq(assistantGuardianLinks.active, true),
        ),
      )
      .limit(1);
    if (!link) return res.status(403).json({ error: "No active link for this family" });

    // Find the active clock-in event (verified=false means still open)
    const [clockInEvent] = await db
      .select()
      .from(clockEvents)
      .where(
        and(
          eq(clockEvents.assistantId, assistantId),
          eq(clockEvents.guardianId, guardianId),
          eq(clockEvents.clockType, "in"),
          eq(clockEvents.verified, false),
        ),
      )
      .orderBy(desc(clockEvents.timestamp))
      .limit(1);

    if (!clockInEvent) {
      return res.status(400).json({ error: "Not currently clocked in for this family" });
    }

    const now         = new Date();
    const clockInTime = new Date(clockInEvent.timestamp);
    const hours       = parseFloat(((now.getTime() - clockInTime.getTime()) / 3_600_000).toFixed(2));

    const dateStr  = clockInTime.toISOString().split("T")[0];          // YYYY-MM-DD
    const startStr = clockInTime.toTimeString().substring(0, 5);        // HH:MM
    const endStr   = now.toTimeString().substring(0, 5);

    // Mark the clock-in event as verified (consumed by clock-out)
    await db
      .update(clockEvents)
      .set({ verified: true })
      .where(eq(clockEvents.id, clockInEvent.id));

    // Create the clock-out event
    const [outEvent] = await db
      .insert(clockEvents)
      .values({
        id:          newId(),
        assistantId,
        guardianId,
        clockType:   "out",
        ip:          (req.ip ?? "").substring(0, 45),
        userAgent:   (req.headers["user-agent"] ?? "").substring(0, 255),
        verified:    true,
      })
      .returning();

    // Auto-create verified shift report entry.
    // verified=true is the canonical flag added in Plan 01.
    // Plan 06 reads entry.verified === true for the "Verified" badge on Monthly page.
    const [entry] = await db
      .insert(entries)
      .values({
        id:          newId(),
        assistantId,
        date:        dateStr,
        startTime:   startStr,
        endTime:     endStr,
        hours,
        entryType:   "active",
        reqStatus:   "approved",   // presence confirmed via clock-in
        repStatus:   "pending",    // pending guardian approval on Monthly page
        source:      "self_book",  // clock-in origin marker (closest existing enum value)
        verified:    true,         // canonical verified flag — Plan 06 uses for "Verified" badge
        updatedAt:   now,
      })
      .returning();

    return res.status(201).json({ event: outEvent, entry });
  } catch (err) {
    console.error("[clock/out] error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/clock/status?guardianId=N
// Returns { state: "clocked_in" | "clocked_out", activeEvent?: ClockEvent }
router.get("/status", async (req: AuthRequest, res) => {
  try {
    const guardianId = parseInt(req.query.guardianId as string, 10);
    if (!guardianId || isNaN(guardianId)) {
      return res.status(400).json({ error: "guardianId is required" });
    }

    const assistantId = await getAssistantId(req.userId!);
    if (!assistantId) return res.status(404).json({ error: "Assistant not found" });

    const [activeEvent] = await db
      .select()
      .from(clockEvents)
      .where(
        and(
          eq(clockEvents.assistantId, assistantId),
          eq(clockEvents.guardianId, guardianId),
          eq(clockEvents.clockType, "in"),
          eq(clockEvents.verified, false),
        ),
      )
      .orderBy(desc(clockEvents.timestamp))
      .limit(1);

    if (activeEvent) {
      return res.json({ state: "clocked_in", activeEvent });
    }
    return res.json({ state: "clocked_out", activeEvent: null });
  } catch (err) {
    console.error("[clock/status] error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
