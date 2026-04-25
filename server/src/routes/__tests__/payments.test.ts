/**
 * PAY-03: Payments route stubs — Wave 0 RED state.
 *
 * Imports payments.ts which does NOT exist yet. Vitest will report this file as
 * FAILED/ERROR until Wave 1 creates the route implementation.
 *
 * Auth guard tests (401, 403) are structurally complete and will pass once the
 * route file exists. DB-dependent tests are marked with .skip.
 */

import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// This import will FAIL — payments.ts does not exist yet. That is the intended RED state.
import paymentsRouter from "../../routes/payments";

const JWT_SECRET = process.env.JWT_SECRET!;

function makeToken(role: "guardian" | "assistant") {
  return jwt.sign({ userId: 1, role }, JWT_SECRET, { expiresIn: "1h" });
}

const testApp = express();
testApp.use(express.json());
testApp.use("/api/payments", paymentsRouter);

describe("PAY-03: Payments routes — auth guards", () => {
  it("GET /api/payments rejects missing Authorization header with 401", async () => {
    const res = await request(testApp).get("/api/payments");
    expect(res.status).toBe(401);
  });

  it("GET /api/payments rejects assistant role with 403", async () => {
    const token = makeToken("assistant");
    const res = await request(testApp)
      .get("/api/payments")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it("POST /api/payments rejects missing Authorization header with 401", async () => {
    const res = await request(testApp).post("/api/payments");
    expect(res.status).toBe(401);
  });

  it("POST /api/payments rejects assistant role with 403", async () => {
    const token = makeToken("assistant");
    const res = await request(testApp)
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({ payrollRecordId: "some-id", amount: 1000 });
    expect(res.status).toBe(403);
  });

  it("DELETE /api/payments/:id rejects missing Authorization header with 401", async () => {
    const res = await request(testApp).delete("/api/payments/fake-id");
    expect(res.status).toBe(401);
  });

  it("DELETE /api/payments/:id rejects assistant role with 403", async () => {
    const token = makeToken("assistant");
    const res = await request(testApp)
      .delete("/api/payments/fake-id")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});

describe("PAY-03: Payments routes — DB integration (requires Wave 1)", () => {
  it.skip("GET /api/payments?payrollRecordId=xxx returns payments array for guardian", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp)
      .get("/api/payments?payrollRecordId=some-record-id")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it.skip("POST /api/payments with valid body returns 201 and payment record", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp)
      .post("/api/payments")
      .set("Authorization", `Bearer ${token}`)
      .send({ payrollRecordId: "some-record-id", amount: 5000, paidAt: "2026-03-31" });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ payrollRecordId: "some-record-id", amount: 5000 });
  });

  it.skip("DELETE /api/payments/:id returns 200 { ok: true }", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp)
      .delete("/api/payments/some-payment-id")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ ok: true });
  });

  it.skip("DELETE /api/payments/:id returns 404 for unknown id", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp)
      .delete("/api/payments/nonexistent-id")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(404);
  });
});
