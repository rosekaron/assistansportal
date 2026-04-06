import { Router } from "express";
import { db } from "../db";
import { costs } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();

// GET /api/costs?month=YYYY-MM
router.get("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  const { month } = req.query as Record<string, string>;
  const rows = month
    ? await db.select().from(costs).where(eq(costs.month, month)).orderBy(costs.createdAt)
    : await db.select().from(costs).orderBy(costs.month, costs.createdAt);
  res.json(rows);
});

// POST /api/costs
router.post("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  const d = req.body;
  const [row] = await db.insert(costs).values({
    id:          newId("cost"),
    month:       d.month,
    category:    d.category,
    assistantId: d.assistantId ?? null,
    amountSek:   Number(d.amountSek),
    description: d.description ?? "",
  }).returning();
  res.status(201).json(row);
});

// DELETE /api/costs/:id
router.delete("/:id", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  await db.delete(costs).where(eq(costs.id, req.params.id));
  res.json({ ok: true });
});

export default router;
