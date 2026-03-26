import { Router } from "express";
import { db } from "../db";
import { entries } from "../db/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();

router.get("/", requireAuth, async (req, res) => {
  const { start, end, assistantId } = req.query as Record<string, string>;
  let query = db.select().from(entries);

  const conditions = [];
  if (start) conditions.push(gte(entries.date, start));
  if (end)   conditions.push(lte(entries.date, end));
  if (assistantId) conditions.push(eq(entries.assistantId, assistantId));

  const rows = conditions.length
    ? await db.select().from(entries).where(and(...conditions)).orderBy(entries.date, entries.startTime)
    : await db.select().from(entries).orderBy(entries.date, entries.startTime);

  res.json(rows);
});

router.post("/", requireAuth, async (req, res) => {
  const d = req.body;
  const [row] = await db.insert(entries).values({
    id:          newId("e"),
    assistantId: d.assistantId  ?? d.assistant_id,
    date:        d.date,
    startTime:   d.startTime   ?? d.start_time,
    endTime:     d.endTime     ?? d.end_time,
    hours:       d.hours,
    entryType:   d.entryType   ?? d.entry_type   ?? "active",
    reqStatus:   d.reqStatus   ?? d.req_status   ?? "pending",
    repStatus:   d.repStatus   ?? d.rep_status   ?? "draft",
    source:      d.source      ?? "proposal",
    calStatus:   d.calStatus   ?? d.cal_status   ?? null,
    activityId:  d.activityId  ?? d.activity_id  ?? null,
    gcalEventId: d.gcalEventId ?? null,
  }).returning();
  res.status(201).json(row);
});

// Bulk create (for week proposals)
router.post("/bulk", requireAuth, async (req, res) => {
  const { items } = req.body as { items: typeof entries.$inferInsert[] };
  if (!items?.length) return res.status(400).json({ error: "No items" });

  const withIds = items.map(i => ({ ...i, id: newId("e") }));
  const rows = await db.insert(entries).values(withIds).returning();
  res.status(201).json(rows);
});

router.put("/:id", requireAuth, async (req, res) => {
  const d = req.body;
  const allowed: Partial<typeof entries.$inferInsert> = {};
  if (d.entryType   ?? d.entry_type   !== undefined) allowed.entryType   = d.entryType   ?? d.entry_type;
  if (d.reqStatus   ?? d.req_status   !== undefined) allowed.reqStatus   = d.reqStatus   ?? d.req_status;
  if (d.repStatus   ?? d.rep_status   !== undefined) allowed.repStatus   = d.repStatus   ?? d.rep_status;
  if (d.calStatus   ?? d.cal_status   !== undefined) allowed.calStatus   = d.calStatus   ?? d.cal_status;
  if (d.hours       !== undefined) allowed.hours       = d.hours;
  if (d.startTime   ?? d.start_time   !== undefined) allowed.startTime   = d.startTime   ?? d.start_time;
  if (d.endTime     ?? d.end_time     !== undefined) allowed.endTime     = d.endTime     ?? d.end_time;
  if (d.activityId  ?? d.activity_id  !== undefined) allowed.activityId  = d.activityId  ?? d.activity_id;
  if (d.gcalEventId !== undefined) allowed.gcalEventId = d.gcalEventId;
  allowed.updatedAt = new Date();

  const [row] = await db.update(entries).set(allowed).where(eq(entries.id, req.params.id)).returning();
  res.json(row);
});

router.delete("/:id", requireAuth, async (req, res) => {
  await db.delete(entries).where(eq(entries.id, req.params.id));
  res.json({ ok: true });
});

export default router;
