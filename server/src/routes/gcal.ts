import { Router } from "express";
import { google } from "googleapis";
import { db } from "../db";
import { settings } from "../db/schema";
import { requireAuth, AuthRequest } from "../middleware/auth";
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

// ── Step 1: Redirect user to Google consent screen ────────────
router.get("/connect", (_req, res) => {
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
    res.redirect(`${process.env.CLIENT_URL}/calendar?gcal_connected=true`);
  } catch (e) {
    console.error("GCal callback error:", e);
    res.redirect(`${process.env.CLIENT_URL}/calendar?gcal_error=auth_failed`);
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
router.get("/status", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select().from(settings);
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    res.json({
      connected:   s.gcal_connected === "true",
      email:       s.gcal_email ?? "",
      calendarId:  s.gcal_calendar_id ?? "primary",
    });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Disconnect ────────────────────────────────────────────────
router.post("/disconnect", requireAuth, async (_req, res) => {
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
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Create a calendar event (blocked time or shift) ───────────
router.post("/events", requireAuth, async (req, res) => {
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
    console.error("Create event error:", e);
    res.status(500).json({ error: String(e) });
  }
});

// ── Update an event ───────────────────────────────────────────
router.put("/events/:eventId", requireAuth, async (req, res) => {
  try {
    const { summary, status } = req.body;
    const { calendar, calendarId } = await getCalendarClient();
    const { data } = await calendar.events.patch({
      calendarId,
      eventId: req.params.eventId,
      requestBody: { summary, status },
    });
    res.json({ ok: true, eventId: data.id });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Delete an event ───────────────────────────────────────────
router.delete("/events/:eventId", requireAuth, async (req, res) => {
  try {
    const { calendar, calendarId } = await getCalendarClient();
    await calendar.events.delete({ calendarId, eventId: req.params.eventId });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── List user's calendars ─────────────────────────────────────
router.get("/calendars", requireAuth, async (_req, res) => {
  try {
    const { calendar } = await getCalendarClient();
    const { data } = await calendar.calendarList.list({ maxResults: 50 });
    const items = (data.items ?? []).map(c => ({ id: c.id, summary: c.summary, primary: c.primary }));
    res.json(items);
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

// ── Health check — test whether the token is still valid ──────
router.get("/health", requireAuth, async (_req, res) => {
  try {
    const rows = await db.select().from(settings);
    const s = Object.fromEntries(rows.map(r => [r.key, r.value]));
    if (s.gcal_connected !== "true") return res.json({ ok: false, reason: "not_connected" });

    const { calendar } = await getCalendarClient();
    await calendar.calendarList.list({ maxResults: 1 });
    res.json({ ok: true });
  } catch (e) {
    res.json({ ok: false, reason: "api_error", detail: String(e) });
  }
});

// ── List upcoming events from Google Calendar ─────────────────
router.get("/events", requireAuth, async (req, res) => {
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
  } catch (e) { res.status(500).json({ error: String(e) }); }
});

export default router;
