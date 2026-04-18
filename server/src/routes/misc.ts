import { Router } from "express";
import { db } from "../db";
import { blocked, invites, settings } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";
import { sendAssistantInviteEmail } from "../lib/email";

const router = Router();

// Rate constants — read from env vars at startup with fallback defaults
const FK_HOURLY_RATE    = parseFloat(process.env.FK_HOURLY_RATE    ?? "334");
const EMPLOYER_TAX_RATE = parseFloat(process.env.EMPLOYER_TAX_RATE ?? "0.3142");

// ── Blocked ───────────────────────────────────────────────────
router.get("/blocked", requireAuth, requireGuardian, async (_req: AuthRequest, res) => {
  const rows = await db.select().from(blocked).orderBy(blocked.date, blocked.startTime);
  res.json(rows);
});

router.post("/blocked", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
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

router.delete("/blocked/:id", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  await db.delete(blocked).where(eq(blocked.id, req.params.id));
  res.json({ ok: true });
});

// ── Invites ───────────────────────────────────────────────────
router.get("/invites", requireAuth, requireGuardian, async (_req: AuthRequest, res) => {
  const rows = await db.select().from(invites).orderBy(invites.createdAt);
  res.json(rows);
});

router.post("/invites", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  const d = req.body;
  const [row] = await db.insert(invites).values({
    id: newId("inv"), name: d.name, email: d.email,
    minWeeklyHours: d.minWeeklyHours ?? 0,
    isFlexible: d.isFlexible ?? false,
    status: "pending", message: d.message ?? "",
    sentAt: new Date(),
  }).returning();
  // Send invite email — fetch guardian/patient names from settings
  try {
    const settingsRows = await db.select().from(settings);
    const get = (key: string) => settingsRows.find(r => r.key === key)?.value ?? "";
    const guardianName = get("guardian_name") || "Your guardian";
    const patientName  = get("patient_name")  || "the care recipient";
    await sendAssistantInviteEmail(d.email, d.name, guardianName, patientName, row.id, d.message);
  } catch (err) {
    console.error("[invite] email failed:", err);
  }
  res.status(201).json(row);
});

router.put("/invites/:id", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  const { status } = req.body;
  const [row] = await db.update(invites).set({ status }).where(eq(invites.id, req.params.id)).returning();
  res.json(row);
});

router.delete("/invites/:id", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  await db.delete(invites).where(eq(invites.id, req.params.id));
  res.json({ ok: true });
});

// ── Settings ──────────────────────────────────────────────────
router.get("/settings", requireAuth, requireGuardian, async (_req: AuthRequest, res) => {
  const rows = await db.select().from(settings);
  const map = Object.fromEntries(rows.map(r => [r.key, r.value]));
  res.json(map);
});

router.put("/settings", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  const data: Record<string, string> = req.body;

  // Server-side validation: reminder_day must be integer 1–28 (T-5-04-01: Tampering mitigation)
  if ("reminder_day" in data) {
    const val = parseInt(String(data.reminder_day), 10);
    if (isNaN(val) || val < 1 || val > 28) {
      return res.status(400).json({ error: "Invalid day: reminder_day must be between 1 and 28" });
    }
    // Normalise to integer string before storage
    data.reminder_day = String(val);
  }

  for (const [key, value] of Object.entries(data)) {
    await db
      .insert(settings)
      .values({ key, value: String(value) })
      .onConflictDoUpdate({ target: settings.key, set: { value: String(value) } });
  }
  res.json({ ok: true });
});

// ── Rates (env-var sourced) ───────────────────────────────────
router.get("/rates", requireAuth, requireGuardian, (_req, res) => {
  res.json({ fkHourlyRate: FK_HOURLY_RATE, employerTaxRate: EMPLOYER_TAX_RATE });
});

export default router;
