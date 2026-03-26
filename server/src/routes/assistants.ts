import { Router } from "express";
import { db } from "../db";
import { assistants } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();

const COLORS = ["#6366f1","#0891b2","#059669","#d97706","#dc2626","#7c3aed","#0e7490","#b45309","#0f766e","#9333ea"];

router.get("/", requireAuth, async (_req, res) => {
  const rows = await db.select().from(assistants).orderBy(assistants.createdAt);
  res.json(rows);
});

router.post("/", requireAuth, async (req, res) => {
  const { name, email, pno, phone, minWeeklyHours, isFlexible } = req.body;
  const count = (await db.select().from(assistants)).length;
  const initials = name.trim().split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
  const [row] = await db.insert(assistants).values({
    id: newId("a"),
    name: name.trim(),
    initials,
    color: COLORS[count % COLORS.length],
    email: email ?? "",
    pno:   pno   ?? "",
    phone: phone ?? "",
    minWeeklyHours: minWeeklyHours ?? 0,
    isFlexible: isFlexible ?? false,
  }).returning();
  res.status(201).json(row);
});

router.put("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const data = req.body;
  const [row] = await db.update(assistants).set({
    name:           data.name,
    email:          data.email,
    pno:            data.pno,
    phone:          data.phone,
    minWeeklyHours: data.minWeeklyHours,
    isFlexible:     data.isFlexible,
    color:          data.color,
  }).where(eq(assistants.id, id)).returning();
  res.json(row);
});

router.delete("/:id", requireAuth, async (req, res) => {
  await db.delete(assistants).where(eq(assistants.id, req.params.id));
  res.json({ ok: true });
});

export default router;
