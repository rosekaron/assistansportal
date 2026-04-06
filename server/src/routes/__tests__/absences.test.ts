/**
 * LEAV-01: Absence CRUD test stubs
 *
 * Wave 0 — RED state. These tests import absencesRouter from "../../routes/absences"
 * which does NOT exist yet. Vitest will report this file as FAILED/ERROR until Wave 2
 * creates the route implementation.
 *
 * Auth tests (401, 403) are structurally complete and will pass once the route exists.
 * Integration tests that require a real DB are marked with .skip until Wave 2.
 */

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// This import will FAIL — absences.ts does not exist yet. That is the intended RED state.
import absencesRouter from "../../routes/absences";

const JWT_SECRET = process.env.JWT_SECRET!;

function makeToken(role: "guardian" | "assistant", assistantId?: string) {
  return jwt.sign({ userId: 1, role, assistantId }, JWT_SECRET, { expiresIn: "1h" });
}

const testApp = express();
testApp.use(express.json());
testApp.use("/api/absences", absencesRouter);

describe("LEAV-01: Absence CRUD", () => {
  // Integration: re-enable in Wave 2 when absences.ts exists and test DB is seeded.
  it.skip("POST /api/absences with valid body returns 201 and absence record", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp)
      .post("/api/absences")
      .set("Authorization", `Bearer ${token}`)
      .send({
        assistantId: "asst_01",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        absenceType: "vab",
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      absenceType: "vab",
      startDate: "2026-03-01",
      endDate: "2026-03-05",
    });
  });

  // Integration: re-enable in Wave 2 when absences.ts exists and test DB is seeded.
  it.skip("POST /api/absences with invalid absenceType returns 400", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp)
      .post("/api/absences")
      .set("Authorization", `Bearer ${token}`)
      .send({
        assistantId: "asst_01",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        absenceType: "vacation", // invalid — not in allowed enum
      });
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  // Integration: re-enable in Wave 2 when absences.ts exists and test DB is seeded.
  it.skip("POST /api/absences auto-cancels overlapping approved entries", async () => {
    const token = makeToken("guardian");
    // Assumes Wave 2 seeds an approved entry on 2026-03-03 for asst_01
    const res = await request(testApp)
      .post("/api/absences")
      .set("Authorization", `Bearer ${token}`)
      .send({
        assistantId: "asst_01",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        absenceType: "sjukfrånvaro",
      });
    expect(res.status).toBe(201);
    // Wave 2 test should verify overlapping entry now has reqStatus="cancelled"
    // e.g. check via GET /api/entries or direct DB assertion
  });

  // Integration: re-enable in Wave 2 when absences.ts exists and test DB is seeded.
  it.skip("DELETE /api/absences/:id removes absence and returns { ok: true }", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp)
      .delete("/api/absences/some-absence-id")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });

  it("unauthenticated request to POST /api/absences returns 401", async () => {
    const res = await request(testApp).post("/api/absences").send({
      assistantId: "asst_01",
      startDate: "2026-03-01",
      endDate: "2026-03-05",
      absenceType: "vab",
    });
    expect(res.status).toBe(401);
  });

  it("assistant token to POST /api/absences is blocked with 403", async () => {
    const token = makeToken("assistant", "asst_01");
    const res = await request(testApp)
      .post("/api/absences")
      .set("Authorization", `Bearer ${token}`)
      .send({
        assistantId: "asst_01",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        absenceType: "vab",
      });
    expect(res.status).toBe(403);
  });
});
