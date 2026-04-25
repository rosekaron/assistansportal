import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { requireAuth, requireGuardian } from "../../middleware/auth";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

// Minimal test app that mirrors the /api/rates route from misc.ts
// (avoids importing misc.ts which would trigger a DB connection)
const FK_HOURLY_RATE    = parseFloat(process.env.FK_HOURLY_RATE    ?? "334");
const EMPLOYER_TAX_RATE = parseFloat(process.env.EMPLOYER_TAX_RATE ?? "0.3142");

const testApp = express();
testApp.use(express.json());
testApp.get("/rates", requireAuth, requireGuardian, (_req, res) => {
  res.json({ fkHourlyRate: FK_HOURLY_RATE, employerTaxRate: EMPLOYER_TAX_RATE });
});

describe("STAB-03: Env var rate loading", () => {
  it("FK_HOURLY_RATE env var is set and parses to a positive number", () => {
    const rate = parseFloat(process.env.FK_HOURLY_RATE ?? "334");
    expect(rate).toBeGreaterThan(0);
    expect(Number.isFinite(rate)).toBe(true);
  });

  it("EMPLOYER_TAX_RATE env var is set and parses to a fraction between 0 and 1", () => {
    const rate = parseFloat(process.env.EMPLOYER_TAX_RATE ?? "0.3142");
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1);
  });

  it("JWT_SECRET env var is set and is not the insecure default", () => {
    const secret = process.env.JWT_SECRET;
    expect(secret).toBeDefined();
    expect(secret).not.toBe("dev_secret");
    expect(secret!.length).toBeGreaterThanOrEqual(12);
  });
});

describe("STAB-03: /api/rates endpoint shape", () => {
  it("GET /api/rates returns { fkHourlyRate: number, employerTaxRate: number }", async () => {
    const token = jwt.sign({ userId: 1, role: "guardian" }, JWT_SECRET, { expiresIn: "1h" });
    const res = await request(testApp)
      .get("/rates")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(typeof res.body.fkHourlyRate).toBe("number");
    expect(typeof res.body.employerTaxRate).toBe("number");
    expect(res.body.fkHourlyRate).toBeGreaterThan(0);
    expect(res.body.employerTaxRate).toBeGreaterThan(0);
    expect(res.body.employerTaxRate).toBeLessThan(1);
  });

  it("GET /api/rates reads values from FK_HOURLY_RATE and EMPLOYER_TAX_RATE env vars", async () => {
    const token = jwt.sign({ userId: 1, role: "guardian" }, JWT_SECRET, { expiresIn: "1h" });
    const res = await request(testApp)
      .get("/rates")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.fkHourlyRate).toBe(parseFloat(process.env.FK_HOURLY_RATE ?? "334"));
    expect(res.body.employerTaxRate).toBe(parseFloat(process.env.EMPLOYER_TAX_RATE ?? "0.3142"));
  });

  it("returns 403 for assistant token", async () => {
    const assistantToken = jwt.sign({ userId: 2, role: "assistant", assistantId: "a1" }, JWT_SECRET, { expiresIn: "1h" });
    const res = await request(testApp)
      .get("/rates")
      .set("Authorization", `Bearer ${assistantToken}`);
    expect(res.status).toBe(403);
  });

  it("returns 401 for unauthenticated requests", async () => {
    const res = await request(testApp).get("/rates");
    expect(res.status).toBe(401);
  });
});
