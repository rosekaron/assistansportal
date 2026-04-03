import { Router } from "express";
import { db } from "../db";
import { assistants, auth, authAssistants, profile } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();

const COLORS = ["#6366f1","#0891b2","#059669","#d97706","#dc2626","#7c3aed","#0e7490","#b45309","#0f766e","#9333ea"];

router.get("/", requireAuth, async (_req, res) => {
  const rows = await db.select().from(assistants).orderBy(assistants.createdAt);
  res.json(rows);
});

router.get("/:id", requireAuth, async (req, res) => {
  const [row] = await db.select().from(assistants).where(eq(assistants.id, req.params.id)).limit(1);
  if (!row) return res.status(404).json({ error: "Assistant not found" });
  res.json(row);
});

router.post("/", requireAuth, async (req: AuthRequest, res) => {
  const { name, email, pno, phone, minWeeklyHours, isFlexible } = req.body;
  const count    = (await db.select().from(assistants)).length;
  const initials = name.trim().split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();

  // Set familyLabel from the guardian's profile (patient name)
  const [prof] = await db.select().from(profile).limit(1);
  const familyLabel = prof?.patientName ?? "";

  const [row] = await db.insert(assistants).values({
    id:             newId("a"),
    name:           name.trim(),
    initials,
    color:          COLORS[count % COLORS.length],
    email:          email          ?? "",
    pno:            pno            ?? "",
    phone:          phone          ?? "",
    minWeeklyHours: minWeeklyHours ?? 0,
    isFlexible:     isFlexible     ?? false,
    guardianAuthId: req.userId     ?? null,
    familyLabel,
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

// ── POST /link-existing ────────────────────────────────────────
// US-25: Guardian sends a link request to an assistant who already has an account.
// Body: { assistantId, email } — assistantId is the guardian's local record, email is the assistant's auth email
router.post("/link-existing", requireAuth, async (req: AuthRequest, res) => {
  try {
    const { assistantId, email } = req.body;
    if (!assistantId || !email) return res.status(400).json({ error: "assistantId and email required" });

    // Verify the assistant record exists
    const [assistant] = await db.select().from(assistants).where(eq(assistants.id, assistantId)).limit(1);
    if (!assistant) return res.status(404).json({ error: "Assistant record not found" });

    // Find the auth account by email (must be assistant role)
    const [authAccount] = await db.select().from(auth)
      .where(and(eq(auth.email, email.toLowerCase()), eq(auth.role, "assistant"))).limit(1);
    if (!authAccount) return res.status(404).json({
      error: "No assistant account found with this email. Send an invite instead.",
      code: "NO_ACCOUNT",
    });

    // Check for existing link
    const existing = await db.select().from(authAssistants)
      .where(and(eq(authAssistants.authId, authAccount.id), eq(authAssistants.assistantId, assistantId))).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: "A link request already exists", status: existing[0].status });
    }

    // Create the pending link request
    const [link] = await db.insert(authAssistants).values({
      id:          newId("la"),
      authId:      authAccount.id,
      assistantId,
      status:      "pending",
    }).returning();

    res.status(201).json({ link, message: "Link request sent — the assistant will see it when they next log in." });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── GET /:id/link-status ───────────────────────────────────────
// Check link requests for a specific assistant record
router.get("/:id/link-status", requireAuth, async (req, res) => {
  try {
    const links = await db.select().from(authAssistants)
      .where(eq(authAssistants.assistantId, req.params.id));
    res.json(links);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
