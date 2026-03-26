import { Router } from "express";
import { db } from "../db";
import { profile } from "../db/schema";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, async (_req, res) => {
  const [p] = await db.select().from(profile).limit(1);
  res.json(p ?? {});
});

router.put("/", requireAuth, async (req, res) => {
  const data = req.body;
  const [existing] = await db.select().from(profile).limit(1);

  if (existing) {
    const [updated] = await db
      .update(profile)
      .set({
        guardianName:  data.guardianName,
        guardianPno:   data.guardianPno,
        guardianEmail: data.guardianEmail,
        guardianPhone: data.guardianPhone,
        patientName:   data.patientName,
        patientPno:    data.patientPno,
        address:       data.address,
        city:          data.city,
        zip:           data.zip,
        fkDecisionNo:  data.fkDecisionNo,
        weeklyHours:   data.weeklyHours ?? 129,
        setupDone:     data.setupDone ?? false,
        updatedAt:     new Date(),
      })
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(profile).values(data).returning();
    res.json(created);
  }
});

export default router;
