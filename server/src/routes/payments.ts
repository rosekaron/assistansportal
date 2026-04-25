import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { payments, payrollRecords } from "../db/schema";
import { eq } from "drizzle-orm";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";
import { newId } from "../lib/id";

const router = Router();

const CreatePaymentSchema = z.object({
  payrollRecordId: z.string().min(1),
  assistantId:     z.string().min(1),
  date:            z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  amountSek:       z.number().positive("amountSek must be positive"),
  method:          z.enum(["bankgiro", "swish", "kontant"]),
});

// GET /api/payments?payrollRecordId=XXX — list payments for a payroll record (D-12)
router.get("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { payrollRecordId } = req.query as Record<string, string>;
    if (!payrollRecordId) {
      return res.status(400).json({ error: "payrollRecordId query param required" });
    }
    const rows = await db.select().from(payments).where(
      eq(payments.payrollRecordId, payrollRecordId)
    );
    res.json(rows);
  } catch (e) {
    console.error("[payments] GET error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/payments — record a payment against a payroll record
router.post("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const parsed = CreatePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0]?.message ?? "Invalid request" });
    }

    // Verify payrollRecord exists before insert (T-03-07: no orphaned payments)
    const [record] = await db.select().from(payrollRecords).where(
      eq(payrollRecords.id, parsed.data.payrollRecordId)
    );
    if (!record) {
      return res.status(404).json({ error: "Payroll record not found" });
    }

    const [row] = await db.insert(payments).values({
      id: newId(),
      ...parsed.data,
    }).returning();
    res.status(201).json(row);
  } catch (e) {
    console.error("[payments] POST error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/payments/:id — remove a payment record
router.delete("/:id", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const [payment] = await db.select().from(payments).where(
      eq(payments.id, req.params.id)
    );
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }
    await db.delete(payments).where(eq(payments.id, req.params.id));
    res.json({ ok: true });
  } catch (e) {
    console.error("[payments] DELETE error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
