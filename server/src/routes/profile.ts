import { Router } from "express";
import { db } from "../db";
import { profile } from "../db/schema";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";

const router = Router();

router.get("/", requireAuth, requireGuardian, async (_req: AuthRequest, res) => {
  const [p] = await db.select().from(profile).limit(1);
  res.json(p ?? {});
});

router.put("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  const data = req.body;
  const [existing] = await db.select().from(profile).limit(1);

  if (existing) {
    const [updated] = await db
      .update(profile)
      .set({
        guardianName:                  data.guardianName,
        guardianPno:                   data.guardianPno,
        guardianEmail:                 data.guardianEmail,
        guardianPhone:                 data.guardianPhone,
        patientName:                   data.patientName,
        patientPno:                    data.patientPno,
        address:                       data.address,                                         // existing single-line kept per D-07/D-09
        city:                          data.city,
        zip:                           data.zip,
        fkDecisionNo:                  data.fkDecisionNo,
        // v1.0.1 Phase 7 additions (SCHEMA-02 / D-02, D-03, D-07, D-16)
        addressStreet:                 data.addressStreet                 ?? "",
        addressZip:                    data.addressZip                    ?? "",
        addressCity:                   data.addressCity                   ?? "",
        fkDecisionStart:               data.fkDecisionStart               || null,           // empty string → null
        fkDecisionEnd:                 data.fkDecisionEnd                 || null,
        dubbelAssistansApproved:       data.dubbelAssistansApproved       ?? false,
        patientRelationToGuardian:     data.patientRelationToGuardian     ?? "parent-child",
        patientRequiresRepresentative: data.patientRequiresRepresentative ?? false,
        weeklyHours:                   data.weeklyHours                   ?? 129,
        setupDone:                     data.setupDone                     ?? false,
        // v1.0.1 Phase 9 addition (D-07, D-09)
        defaultPayDay: typeof data.defaultPayDay === "number" && data.defaultPayDay >= 1 && data.defaultPayDay <= 28
          ? data.defaultPayDay
          : 25,
        updatedAt:                     new Date(),
      })
      .returning();
    res.json(updated);
  } else {
    const [created] = await db.insert(profile).values(data).returning();
    res.json(created);
  }
});

export default router;
