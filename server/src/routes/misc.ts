import { Router } from "express";
import { db } from "../db";
import { openSlots, blocked, invites, settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();

// ── Open Slots ────────────────────────────────────────────────
router.get("/slots", requireAuth, async (_req, res) => {
  const rows = await db.select().from(openSlots).orderBy(openSlots.date, openSlots.startTime);
  res.json(rows);
});

router.post("/slots", requireAuth, async (req, res) => {
  const d = req.body;
  const [row] = await db.insert(openSlots).values({
    id:         newId("s"),
    date:       d.date,
    startTime:  d.startTime  ?? d.start_time,
    endTime:    d.endTime    ?? d.end_time,
    hours:      d.hours,
    capacity:   d.capacity   ?? 1,
    activityId: d.activityId ?? d.activity_id ?? null,
  }).returning();
  res.status(201).json(row);
});

router.delete("/slots/:id", requireAuth, async (req, res) => {
  await db.delete(openSlots).where(eq(openSlots.id, req.params.id));
  res.json({ ok: true });
});

// ── Blocked ───────────────────────────────────────────────────
router.get("/blocked", requireAuth, async (_req, res) => {
  const rows = await db.select().from(blocked).orderBy(blocked.date, blocked.startTime);
  res.json(rows);
});

router.post("/blocked", requireAuth, async (req, res) => {
  const d = req.body;
  const [row] = await db.insert(blocked).values({
    id: newId("b"),
    date:      d.date,
    startTime: d.startTime ?? d.start_time,
    endTime:   d.endTime   ?? d.end_time,
    reason:    d.reason    ?? "",
  }).returning();
  res.status(201).json(row);
});

router.delete("/blocked/:id", requireAuth, async (req, res) => {
  await db.delete(blocked).where(eq(blocked.id, req.params.id));
  res.json({ ok: true });
});

// ── Invites ───────────────────────────────────────────────────
router.get("/invites", requireAuth, async (_req, res) => {
  const rows = await db.select().from(invites).orderBy(invites.createdAt);
  res.json(rows);
});

router.post("/invites", requireAuth, async (req, res) => {
  const d = req.body;
  const [row] = await db.insert(invites).values({
    id: newId("inv"), name: d.name, email: d.email,
    minWeeklyHours: d.minWeeklyHours ?? 0,
    isFlexible: d.isFlexible ?? false,
    status: "pending", message: d.message ?? "",
    sentAt: new Date(),
  }).returning();
  // TODO: send actual email via SMTP / SendGrid
  console.log(`📨 Invite → ${d.email} (${d.name})`);
  res.status(201).json(row);
});

router.put("/invites/:id", requireAuth, async (req, res) => {
  const { status } = req.body;
  const [row] = await db.update(invites).set({ status }).where(eq(invites.id, req.params.id)).returning();
  res.json(row);
});

router.delete("/invites/:id", requireAuth, async (req, res) => {
  await db.delete(invites).where(eq(invites.id, req.params.id));
  res.json({ ok: true });
});

// ── Settings ──────────────────────────────────────────────────
router.get("/settings", requireAuth, async (_req, res) => {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(map);
});

router.put("/settings", requireAuth, async (req, res) => {
  const data: Record<string, string> = req.body;
  for (const [key, value] of Object.entries(data)) {
    await db
      .insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } });
  }
  res.json({ ok: true });
});

export default router;
