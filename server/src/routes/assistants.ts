import { Router } from "express";
import { db } from "../db";
import { assistants, assistantGuardianLinks, auth, authAssistants, profile } from "../db/schema";
import { eq, and } from "drizzle-orm";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();

const COLORS = ["#6366f1","#0891b2","#059669","#d97706","#dc2626","#7c3aed","#0e7490","#b45309","#0f766e","#9333ea"];

router.get("/", requireAuth, requireGuardian, async (_req: AuthRequest, res) => {
  const rows = await db.select().from(assistants).orderBy(assistants.createdAt);
  res.json(rows);
});

router.get("/:id", requireAuth, async (req, res) => {
  const [row] = await db.select().from(assistants).where(eq(assistants.id, req.params.id)).limit(1);
  if (!row) return res.status(404).json({ error: "Assistant not found" });
  res.json(row);
});

router.post("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
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
    name:                  data.name,
    email:                 data.email,
    pno:                   data.pno,
    phone:                 data.phone,
    minWeeklyHours:        data.minWeeklyHours,
    isFlexible:            data.isFlexible,
    color:                 data.color,
    address:               data.address ?? "",                                 // existing single-line kept per D-07
    // v1.0.1 Phase 7 additions (SCHEMA-01 / D-07, D-15, D-17)
    addressStreet:         data.addressStreet         ?? "",
    addressZip:            data.addressZip            ?? "",
    addressCity:           data.addressCity           ?? "",
    skattetabell:          data.skattetabell          ?? null,                 // integer; null OK
    taxScheme:             data.taxScheme             ?? "a-skatt",            // D-15 default
    bankClearing:          data.bankClearing          ?? "",
    bankAccount:           data.bankAccount           ?? "",
    iban:                  data.iban                  ?? "",
    employmentStartDate:   data.employmentStartDate   || null,                 // empty string → null
    employmentEndDate:     data.employmentEndDate     || null,
    citizenship:           data.citizenship           ?? "",
    residencePermitExpiry: data.residencePermitExpiry || null,
    notes:                 data.notes                 ?? "",
    // v1.0.1 Phase 9 additions (SLIP-06 / D-07)
    salaryModel:        data.salaryModel        ?? "anhörig",           // D-07: default "anhörig"; Fremia/Custom scaffold-only in v1.0.1
    hourlyRateOverride: data.hourlyRateOverride === "" || data.hourlyRateOverride == null ? null : Number(data.hourlyRateOverride),  // D-12 gate: NULL override → 400 in Plan 03
    paymentMethod:      data.paymentMethod      ?? "bankgiro",           // D-10: default "bankgiro"
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

    // Link auth account → assistant record (legacy single-link)
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

// ── POST /link-existing ────────────────────────────────────────
// US-25 (multi-family): Guardian sends a link request to an assistant who already has an account.
// Body: { assistantId, email } — assistantId is the guardian's local record, email is the assistant's auth email
router.post("/link-existing", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
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
  } catch (e) {
    console.error("[assistants] link-existing error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── GET /:id/link-status ───────────────────────────────────────
// Check link requests for a specific assistant record (multi-family)
router.get("/:id/link-status", requireAuth, requireGuardian, async (req, res) => {
  try {
    const links = await db.select().from(authAssistants)
      .where(eq(authAssistants.assistantId, req.params.id));
    res.json(links);
  } catch (e) {
    console.error("[assistants] link-status error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
