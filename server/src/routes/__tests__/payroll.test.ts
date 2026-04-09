/**
 * PAY-02: Payroll route stubs — Wave 0 RED state.
 *
 * Imports payroll.ts which does NOT exist yet. Vitest will report this file as
 * FAILED/ERROR until Wave 1 creates the route implementation.
 *
 * Auth guard tests (401, 403) are structurally complete and will pass once the
 * route file exists. DB-dependent tests are marked with .skip.
 */

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// This import will FAIL — payroll.ts does not exist yet. That is the intended RED state.
import payrollRouter from "../../routes/payroll";

const JWT_SECRET = process.env.JWT_SECRET!;

function makeToken(role: "guardian" | "assistant") {
  return jwt.sign({ userId: 1, role }, JWT_SECRET, { expiresIn: "1h" });
}

const testApp = express();
testApp.use(express.json());
testApp.use("/api/payroll", payrollRouter);

describe("PAY-02: Payroll routes — auth guards", () => {
  it("GET /api/payroll rejects missing Authorization header with 401", async () => {
    const res = await request(testApp).get("/api/payroll");
    expect(res.status).toBe(401);
  });

  it("GET /api/payroll rejects assistant role with 403", async () => {
    const token = makeToken("assistant");
    const res = await request(testApp)
      .get("/api/payroll")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("POST /api/payroll/generate rejects missing Authorization header with 401", async () => {
    const res = await request(testApp).post("/api/payroll/generate");
    expect(res.status).toBe(401);
  });

  it("POST /api/payroll/generate rejects assistant role with 403", async () => {
    const token = makeToken("assistant");
    const res = await request(testApp)
      .post("/api/payroll/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ month: "2026-03" });
    expect(res.status).toBe(403);
  });

  it("POST /api/payroll/:id/approve rejects missing Authorization header with 401", async () => {
    const res = await request(testApp).post("/api/payroll/fake-id/approve");
    expect(res.status).toBe(401);
  });

  it("POST /api/payroll/:id/approve rejects assistant role with 403", async () => {
    const token = makeToken("assistant");
    const res = await request(testApp)
      .post("/api/payroll/fake-id/approve")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("PAY-02: Payroll routes — DB integration (requires Wave 1)", () => {
  it.skip("GET /api/payroll?month=2026-03 returns array for guardian", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp)
      .get("/api/payroll?month=2026-03")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it.skip("POST /api/payroll/generate with valid month returns payroll records array", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp)
      .post("/api/payroll/generate")
      .set("Authorization", `Bearer ${token}`)
      .send({ month: "2026-03" });
    expect(res.status).toBe(201);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it.skip("POST /api/payroll/:id/approve transitions status from draft to approved", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp)
      .post("/api/payroll/some-draft-id/approve")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "approved" });
  });

  it.skip("POST /api/payroll/:id/approve returns 409 if already approved", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp)
      .post("/api/payroll/some-approved-id/approve")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(409);
  });
});
