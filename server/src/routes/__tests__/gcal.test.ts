/**
 * GCAL-01: Google Calendar OAuth2 route tests
 *
 * Tests cover:
 * - GET  /api/gcal/calendars  — returns mapped calendar list, auth guards, error handling
 * - GET  /api/gcal/callback   — redirect targets: /settings (not /calendar)
 * - POST /api/gcal/disconnect — clears tokens, auth guards
 *
 * googleapis and the DB are mocked so these tests run without credentials or a live DB.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import express from "express";
import request from "supertest";
import jwt from "jsonwebtoken";

// ── Hoisted mock handles (must be above vi.mock calls) ────────────────────────
const mockCalendarListList = vi.hoisted(() => vi.fn());
const mockGetToken         = vi.hoisted(() => vi.fn());
const mockUserinfoGet      = vi.hoisted(() => vi.fn());
const mockDbSelectFrom     = vi.hoisted(() => vi.fn());
const mockDbInsertValues   = vi.hoisted(() => vi.fn());

// ── Mock googleapis ───────────────────────────────────────────────────────────
// OAuth2 is used as `new google.auth.OAuth2(...)`, so the mock must be a
// constructable regular function (arrow functions cannot be constructors).
vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: vi.fn(function () {
        // When called with `new`, returning a plain object overrides `this`
        return {
          generateAuthUrl: vi.fn().mockReturnValue("https://accounts.google.com/o/oauth2/auth"),
          getToken:        mockGetToken,
          setCredentials:  vi.fn(),
          on:              vi.fn(),
        };
      }),
    },
    oauth2: vi.fn().mockReturnValue({
      userinfo: { get: mockUserinfoGet },
    }),
    calendar: vi.fn().mockReturnValue({
      calendarList: { list: mockCalendarListList },
    }),
  },
}));

// ── Mock DB (path relative to this file resolves to server/src/db) ────────────
vi.mock("../../db", () => ({
  db: {
    select: vi.fn().mockReturnValue({ from: mockDbSelectFrom }),
    insert: vi.fn().mockReturnValue({ values: mockDbInsertValues }),
  },
  settings: {},
}));

import gcalRouter from "../gcal";

const JWT_SECRET = process.env.JWT_SECRET!;

function makeToken(role: "guardian" | "assistant") {
  return jwt.sign({ userId: 1, role }, JWT_SECRET, { expiresIn: "1h" });
}

const testApp = express();
testApp.use(express.json());
testApp.use("/api/gcal", gcalRouter);

/** Settings rows returned by db.select().from(settings) */
const connectedRows = [
  { key: "gcal_connected",     value: "true" },
  { key: "gcal_email",         value: "user@gmail.com" },
  { key: "gcal_calendar_id",   value: "primary" },
  { key: "gcal_access_token",  value: "fake-access-token" },
  { key: "gcal_refresh_token", value: "fake-refresh-token" },
  { key: "gcal_token_expiry",  value: "9999999999000" },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CLIENT_URL = "http://localhost:5173";
  // Default DB: connected state
  mockDbSelectFrom.mockResolvedValue(connectedRows);
  // Default insert chain: no-op
  mockDbInsertValues.mockReturnValue({
    onConflictDoUpdate: vi.fn().mockResolvedValue(undefined),
  });
});

// ── GET /api/gcal/calendars ───────────────────────────────────────────────────

describe("GCAL-01: GET /api/gcal/calendars", () => {
  it("returns mapped [{id, summary, primary}] array for guardian", async () => {
    mockCalendarListList.mockResolvedValue({
      data: {
        items: [
          { id: "cal_1", summary: "Personal", primary: true  },
          { id: "cal_2", summary: "Work",     primary: false },
        ],
      },
    });

    const res = await request(testApp)
      .get("/api/gcal/calendars")
      .set("Authorization", `Bearer ${makeToken("guardian")}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([
      { id: "cal_1", summary: "Personal", primary: true  },
      { id: "cal_2", summary: "Work",     primary: false },
    ]);
  });

  it("defaults primary to false when cal.primary is undefined", async () => {
    mockCalendarListList.mockResolvedValue({
      data: { items: [{ id: "cal_1", summary: "Work" }] },
    });

    const res = await request(testApp)
      .get("/api/gcal/calendars")
      .set("Authorization", `Bearer ${makeToken("guardian")}`);

    expect(res.status).toBe(200);
    expect(res.body[0].primary).toBe(false);
  });

  it("returns 500 when calendarList.list throws", async () => {
    mockCalendarListList.mockRejectedValue(new Error("quota exceeded"));

    const res = await request(testApp)
      .get("/api/gcal/calendars")
      .set("Authorization", `Bearer ${makeToken("guardian")}`);

    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: "Failed to fetch calendars" });
  });

  it("blocks assistant role with 403", async () => {
    const res = await request(testApp)
      .get("/api/gcal/calendars")
      .set("Authorization", `Bearer ${makeToken("assistant")}`);

    expect(res.status).toBe(403);
  });

  it("blocks missing auth with 401", async () => {
    const res = await request(testApp).get("/api/gcal/calendars");
    expect(res.status).toBe(401);
  });
});

// ── GET /api/gcal/callback ────────────────────────────────────────────────────

describe("GCAL-01: GET /api/gcal/callback — redirect targets", () => {
  it("redirects to /settings?gcal_connected=true on successful token exchange", async () => {
    mockGetToken.mockResolvedValue({
      tokens: {
        access_token:  "access-tok",
        refresh_token: "refresh-tok",
        expiry_date:   9999999999000,
      },
    });
    mockUserinfoGet.mockResolvedValue({ data: { email: "user@gmail.com" } });

    const res = await request(testApp).get("/api/gcal/callback?code=valid-code");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("http://localhost:5173/settings?gcal_connected=true");
  });

  it("redirects to /settings?gcal_error=auth_failed (not /calendar) when getToken throws", async () => {
    mockGetToken.mockRejectedValue(new Error("invalid_grant"));

    const res = await request(testApp).get("/api/gcal/callback?code=bad-code");

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("http://localhost:5173/settings?gcal_error=auth_failed");
    // Ensure legacy /calendar path is NOT used
    expect(res.headers.location).not.toContain("/calendar");
  });

  it("redirects with gcal_error=no_code when code param is absent", async () => {
    const res = await request(testApp).get("/api/gcal/callback");

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("gcal_error=no_code");
  });
});

// ── POST /api/gcal/disconnect ─────────────────────────────────────────────────

describe("GCAL-01: POST /api/gcal/disconnect", () => {
  it("returns {ok: true} for guardian", async () => {
    const res = await request(testApp)
      .post("/api/gcal/disconnect")
      .set("Authorization", `Bearer ${makeToken("guardian")}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });

  it("blocks assistant role with 403", async () => {
    const res = await request(testApp)
      .post("/api/gcal/disconnect")
      .set("Authorization", `Bearer ${makeToken("assistant")}`);

    expect(res.status).toBe(403);
  });
});
