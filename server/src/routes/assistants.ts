import { Router } from "express";
import { db } from "../db";
import { assistants, assistantGuardianLinks, auth } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();

const COLORS = ["#6366f1","#0891b2","#059669","#d97706","#dc2626","#7c3aed","#0e7490","#b45309","#0f766e","#9333ea"];

router.get("/", requireAuth, requireGuardian, async (_req: AuthRequest, res) => {
  const rows = await db.select().from(assistants).orderBy(assistants.createdAt);
  res.json(rows);
});

router.post("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
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

  // Auto-create an active guardian link so the assistant can clock in immediately
  // after accepting their invite. Single-tenant: req.userId is always the one guardian.
  await db.insert(assistantGuardianLinks).values({
    id:          newId("gl"),
    assistantId: row.id,
    guardianId:  req.userId!,
    active:      true,
  }).onConflictDoNothing();

  res.status(201).json(row);
});

router.put("/:id", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
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
    address:        data.address ?? "",
  }).where(eq(assistants.id, id)).returning();
  res.json(row);
});

router.delete("/:id", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  await db.delete(assistants).where(eq(assistants.id, req.params.id));
  res.json({ ok: true });
});

// POST /api/assistants/:id/link-self
// Lets a guardian link their own auth account to an assistant record so they
// can clock in/out for themselves. Sets assistants.authId, auth.assistantId,
// and creates an active assistantGuardianLinks row.
router.post("/:id/link-self", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const [asst] = await db.select().from(assistants).where(eq(assistants.id, id)).limit(1);
    if (!asst) return res.status(404).json({ error: "Assistant not found" });

    // Link assistant record → auth account
    await db.update(assistants)
      .set({ authId: req.userId!, inviteStatus: "accepted" })
      .where(eq(assistants.id, id));

    // Link auth account → assistant record
    await db.update(auth)
      .set({ assistantId: id })
      .where(eq(auth.id, req.userId!));

    // Create active guardian link so clock-in works
    await db.insert(assistantGuardianLinks).values({
      id:          newId("gl"),
      assistantId: id,
      guardianId:  req.userId!,
      active:      true,
    }).onConflictDoNothing();

    await db.update(assistantGuardianLinks)
      .set({ active: true })
      .where(eq(assistantGuardianLinks.assistantId, id));

    res.json({ ok: true, assistantId: id });
  } catch (e) {
    console.error("[assistants] link-self error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
