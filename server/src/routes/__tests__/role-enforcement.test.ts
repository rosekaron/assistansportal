import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import { requireAuth, requireGuardian, requireAssistant, AuthRequest } from "../../middleware/auth";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

function makeToken(role: "guardian" | "assistant", assistantId?: string) {
  return jwt.sign({ userId: 1, role, assistantId }, JWT_SECRET, { expiresIn: "1h" });
}

// Minimal test app with one guardian-only route
const testApp = express();
testApp.use(express.json());
testApp.get("/api/entries", requireAuth, requireGuardian, (_req, res) => res.json({ ok: true }));
testApp.get("/api/assistant/me", requireAuth, requireAssistant, (req: AuthRequest, res) => res.json({ assistantId: req.assistantId }));

describe("STAB-01: Role middleware enforcement", () => {
  it("guardian token passes guardian-only route", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp).get("/api/entries").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("assistant token is blocked from guardian-only route with 403", async () => {
    const token = makeToken("assistant", "asst_01");
    const res = await request(testApp).get("/api/entries").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body).toMatchObject({ error: expect.any(String) });
  });

  it("no token returns 401", async () => {
    const res = await request(testApp).get("/api/entries");
    expect(res.status).toBe(401);
  });

  it("assistant token passes assistant self-service route", async () => {
    const token = makeToken("assistant", "asst_01");
    const res = await request(testApp).get("/api/assistant/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it("guardian token is blocked from assistant-only route with 403", async () => {
    const token = makeToken("guardian");
    const res = await request(testApp).get("/api/assistant/me").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
