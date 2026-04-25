import { Router } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { assistantGuardianLinks, assistants } from "../db/schema";
import { requireAuth, requireGuardian, requireAssistant, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();
router.use(requireAuth);

// ── Guardian endpoints ──────────────────────────────────────────

// GET /api/guardian-links — list all links for the authenticated guardian
router.get("/", requireGuardian, async (req: AuthRequest, res) => {
  try {
    const links = await db.select({
      id:             assistantGuardianLinks.id,
      assistantId:    assistantGuardianLinks.assistantId,
      guardianId:     assistantGuardianLinks.guardianId,
      active:         assistantGuardianLinks.active,
      createdAt:      assistantGuardianLinks.createdAt,
      assistantName:  assistants.name,
      assistantEmail: assistants.email,
    })
      .from(assistantGuardianLinks)
      .innerJoin(assistants, eq(assistants.id, assistantGuardianLinks.assistantId))
      .where(eq(assistantGuardianLinks.guardianId, req.userId!));
    return res.json(links);
  } catch (err) {
    console.error("guardian-links GET error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/guardian-links — create a new (inactive) link
// Body: { assistantId: string }
router.post("/", requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { assistantId } = req.body as { assistantId: string };
    if (!assistantId) return res.status(400).json({ error: "assistantId is required" });

    // Verify assistant exists
    const [assistant] = await db.select({ id: assistants.id })
      .from(assistants)
      .where(eq(assistants.id, assistantId))
      .limit(1);
    if (!assistant) return res.status(404).json({ error: "Assistant not found" });

    // Prevent duplicate links
    const [existing] = await db.select({ id: assistantGuardianLinks.id })
      .from(assistantGuardianLinks)
      .where(and(
        eq(assistantGuardianLinks.assistantId, assistantId),
        eq(assistantGuardianLinks.guardianId, req.userId!),
      ))
      .limit(1);
    if (existing) return res.status(409).json({ error: "Link already exists" });

    const [link] = await db.insert(assistantGuardianLinks).values({
      id:          newId("gl"),
      assistantId,
      guardianId:  req.userId!,
      active:      false,
    }).returning();

    return res.status(201).json(link);
  } catch (err) {
    console.error("guardian-links POST error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Assistant endpoints ─────────────────────────────────────────

// GET /api/guardian-links/my-families — list active links for the authenticated assistant
router.get("/my-families", requireAssistant, async (req: AuthRequest, res) => {
  try {
    // Resolve assistantId from JWT
    const [a] = await db.select({ id: assistants.id })
      .from(assistants)
      .where(eq(assistants.authId, req.userId!))
      .limit(1);
    if (!a) return res.status(404).json({ error: "Assistant not found" });

    const links = await db.select()
      .from(assistantGuardianLinks)
      .where(and(
        eq(assistantGuardianLinks.assistantId, a.id),
        eq(assistantGuardianLinks.active, true),
      ));

    return res.json(links);
  } catch (err) {
    console.error("my-families error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/guardian-links/:id/accept — assistant accepts a link (activates it)
router.post("/:id/accept", requireAssistant, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;

    // Resolve assistantId from JWT
    const [a] = await db.select({ id: assistants.id })
      .from(assistants)
      .where(eq(assistants.authId, req.userId!))
      .limit(1);
    if (!a) return res.status(404).json({ error: "Assistant not found" });

    // Verify the link belongs to this assistant
    const [link] = await db.select()
      .from(assistantGuardianLinks)
      .where(and(
        eq(assistantGuardianLinks.id, id),
        eq(assistantGuardianLinks.assistantId, a.id),
      ))
      .limit(1);
    if (!link) return res.status(404).json({ error: "Link not found" });
    if (link.active) return res.status(409).json({ error: "Link already active" });

    const [updated] = await db.update(assistantGuardianLinks)
      .set({ active: true })
      .where(eq(assistantGuardianLinks.id, id))
      .returning();

    return res.json(updated);
  } catch (err) {
    console.error("accept link error", err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
