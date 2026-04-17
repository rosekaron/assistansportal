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

// POST /api/assistants/register-self
// Guardian registers themselves as an assistant in a single step.
// Creates the assistant record, links it to the guardian's auth account,
// and creates an active guardian link. No invite email needed.
// IMPORTANT: must be before /:id routes to avoid Express path conflict
router.post("/register-self", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { name, pno, phone, minWeeklyHours, isFlexible } = req.body;
    if (!name) return res.status(400).json({ error: "Name is required" });

    // Check if guardian already has a linked assistant record
    const [existing] = await db.select().from(auth).where(eq(auth.id, req.userId!)).limit(1);
    if (existing?.assistantId) {
      return res.status(409).json({ error: "You already have a linked assistant record" });
    }

    // Safety check: make sure no OTHER assistant row already has this guardian's auth_id.
    // This prevents accidentally linking the guardian account to an existing assistant
    // (e.g. a family member's record that was manually patched in the DB).
    const alreadyLinked = await db.select().from(assistants).where(eq(assistants.authId, req.userId!));
    if (alreadyLinked.length > 0) {
      return res.status(409).json({
        error: `Your account is already linked to assistant "${alreadyLinked[0].name}". Remove that link before registering yourself as a new assistant.`,
      });
    }

    const count = (await db.select().from(assistants)).length;
    const initials = name.trim().split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

    const [row] = await db.insert(assistants).values({
      id:            newId("a"),
      name:          name.trim(),
      initials,
      color:         COLORS[count % COLORS.length],
      email:         existing?.email ?? "",
      pno:           pno    ?? "",
      phone:         phone  ?? "",
      minWeeklyHours: minWeeklyHours ?? 0,
      isFlexible:    isFlexible ?? false,
      authId:        req.userId!,
      inviteStatus:  "accepted",
    }).returning();

    // Link auth account → assistant record
    await db.update(auth)
      .set({ assistantId: row.id })
      .where(eq(auth.id, req.userId!));

    // Create active guardian link so clock-in works immediately
    await db.insert(assistantGuardianLinks).values({
      id:          newId("gl"),
      assistantId: row.id,
      guardianId:  req.userId!,
      active:      true,
    }).onConflictDoNothing();

    res.status(201).json({ ok: true, assistantId: row.id, assistant: row });
  } catch (e) {
    console.error("[assistants] register-self error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
