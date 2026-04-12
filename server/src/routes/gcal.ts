import { Router, Response, NextFunction } from "express";
import { google } from "googleapis";
import jwt from "jsonwebtoken";
import { db } from "../db";
import { settings } from "../db/schema";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";
import * as dotenv from "dotenv";
dotenv.config();

const router = Router();

function getOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    process.env.GOOGLE_REDIRECT_URI
  );
}

// ── Auth helper: accepts JWT from header OR ?token= query param ──
function requireGuardianOrQueryToken(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    try {
      const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET || "dev_secret") as { userId: number; role?: string };
      req.userId = payload.userId; req.role = payload.role;
    } catch { return res.status(401).json({ error: "Invalid token" }); }
  } else if (req.query.token) {
    try {
      const payload = jwt.verify(req.query.token as string, process.env.JWT_SECRET || "dev_secret") as { userId: number; role?: string };
      req.userId = payload.userId; req.role = payload.role;
    } catch { return res.status(401).json({ error: "Invalid token" }); }
  } else {
    return res.status(401).json({ error: "Unauthorized" });
  }
  if (req.role !== "guardian") return res.status(403).json({ error: "Guardian access required" });
  next();
}

// ── Step 1: Redirect user to Google consent screen ────────────
router.get("/connect", requireGuardianOrQueryToken as Parameters<typeof router.get>[1], (_req, res) => {
  const oauth2Client = getOAuthClient();
  const url = oauth2Client.generateAuthUrl({
    access_type: "offline",
    prompt:      "consent",
    scope: [
      "https://www.googleapis.com/auth/calendar",
      "https://www.googleapis.com/auth/calendar.events",
      "https://www.googleapis.com/auth/userinfo.email",
    ],
  });
  console.log("\n🔗 OAuth URL:", url, "\n");
  res.redirect(url);
});

// ── Step 2: Google redirects back here with a code ────────────
router.get("/callback", async (req, res) => {
  try {
    const { code } = req.query as { code: string };
    if (!code) return res.redirect(`${process.env.CLIENT_URL}?gcal_error=no_code`);

    const oauth2Client = getOAuthClient();
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get the user's email
    const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
    const { data: userInfo } = await oauth2.userinfo.get();

    // Store tokens + email in settings
    const upsert = async (key: string, value: string) => {
      await db.insert(settings).values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } });
    };

    await upsert("gcal_connected",     "true");
    await upsert("gcal_email",         userInfo.email ?? "");
    await upsert("gcal_access_token",  tokens.access_token ?? "");
    await upsert("gcal_refresh_token", tokens.refresh_token ?? "");
    await upsert("gcal_token_expiry",  String(tokens.expiry_date ?? ""));
    await upsert("gcal_calendar_id",   "primary");

    // Redirect back to app
    res.redirect(`${process.env.CLIENT_URL}/settings?gcal_connected=true`);
  } catch (e) {
    console.error("GCal callback error:", e);
    res.redirect(`${process.env.CLIENT_URL}/settings?gcal_error=auth_failed`);
  }
});

// ── Helper: get authenticated calendar client ─────────────────
async function getCalendarClient() {
  const rows = await db.select().from(settings);
  const s = Object.fromEntries(rows.map(r => [r.key, r.value]));

  const oauth2Client = getOAuthClient();
  oauth2Client.setCredentials({
    access_token:  s.gcal_access_token,
    refresh_token: s.gcal_refresh_token,
    expiry_date:   parseInt(s.gcal_token_expiry || "0"),
  });

  // Auto-refresh token if needed
  oauth2Client.on("tokens", async (tokens) => {
    if (tokens.access_token) {
      await db.insert(settings).values({ key: "gcal_access_token", value: tokens.access_token })
        .onConflictDoUpdate({ target: settings.key, set: { value: tokens.access_token } });
    }
  });

  return { calendar: google.calendar({ version: "v3", auth: oauth2Client }), calendarId: s.gcal_calendar_id || "primary" };
}

// ── Get calendar status ───────────────────────────────────────
router.get("/status", requireAuth, requireGuardian, async (_req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(settings);
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({
      connected:   s.gcal_connected === "true",
      email:       s.gcal_email ?? "",
      calendarId:  s.gcal_calendar_id ?? "primary",
    });
  } catch (e) {
    console.error("[gcal] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── List user's Google calendars ─────────────────────────────
router.get("/calendars", requireAuth, requireGuardian, async (_req: AuthRequest, res) => {
  try {
    const { calendar } = await getCalendarClient();
    const { data } = await calendar.calendarList.list({ maxResults: 50 });
    const list = (data.items ?? []).map((cal) => ({
      id:      cal.id,
      summary: cal.summary,
      primary: cal.primary ?? false,
    }));
    res.json(list);
  } catch (e) {
    console.error("[gcal] calendars error:", e);
    res.status(500).json({ error: "Failed to fetch calendars" });
  }
});

// ── Disconnect ────────────────────────────────────────────────
router.post("/disconnect", requireAuth, requireGuardian, async (_req: AuthRequest, res) => {
  try {
    const upsert = async (key: string, value: string) => {
      await db.insert(settings).values({ key, value })
        .onConflictDoUpdate({ target: settings.key, set: { value } });
    };
    await upsert("gcal_connected",     "false");
    await upsert("gcal_email",         "");
    await upsert("gcal_access_token",  "");
    await upsert("gcal_refresh_token", "");
    res.json({ ok: true });
  } catch (e) {
    console.error("[gcal] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Create a calendar event (blocked time or shift) ───────────
router.post("/events", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { summary, description, date, startTime, endTime, attendeeEmail, colorId } = req.body;
    const { calendar, calendarId } = await getCalendarClient();

    const event: Record<string, unknown> = {
      summary,
      description,
      start: { dateTime: `${date}T${startTime}:00`, timeZone: "Europe/Stockholm" },
      end:   { dateTime: `${date}T${endTime}:00`,   timeZone: "Europe/Stockholm" },
      colorId,  // 11=tomato (blocked), 9=blueberry (assigned), 5=banana (open)
    };

    if (attendeeEmail) {
      event.attendees = [{ email: attendeeEmail }];
      event.sendUpdates = "all";
    }

    const { data } = await calendar.events.insert({
      calendarId,
      requestBody: event,
      sendUpdates: attendeeEmail ? "all" : "none",
    } as Parameters<typeof calendar.events.insert>[0]);

    res.json({ eventId: data.id, htmlLink: data.htmlLink });
  } catch (e) {
    console.error("[gcal] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Update an event ───────────────────────────────────────────
router.put("/events/:eventId", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { summary, status } = req.body;
    const { calendar, calendarId } = await getCalendarClient();
    const { data } = await calendar.events.patch({
      calendarId,
      eventId: req.params.eventId,
      requestBody: { summary, status },
    });
    res.json({ ok: true, eventId: data.id });
  } catch (e) {
    console.error("[gcal] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Delete an event ───────────────────────────────────────────
router.delete("/events/:eventId", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { calendar, calendarId } = await getCalendarClient();
    await calendar.events.delete({ calendarId, eventId: req.params.eventId });
    res.json({ ok: true });
  } catch (e) {
    console.error("[gcal] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── List upcoming events from Google Calendar ─────────────────
router.get("/events", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { start, end } = req.query as Record<string, string>;
    const { calendar, calendarId } = await getCalendarClient();
    const { data } = await calendar.events.list({
      calendarId,
      timeMin: start ? new Date(start).toISOString() : new Date().toISOString(),
      timeMax: end   ? new Date(end).toISOString()   : undefined,
      singleEvents: true,
      orderBy: "startTime",
      maxResults: 100,
    });
    res.json(data.items ?? []);
  } catch (e) {
    console.error("[gcal] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
