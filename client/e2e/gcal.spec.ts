/**
 * E2E tests — Google Calendar integration (Phase 6)
 *
 * All API calls are mocked via page.route() so these tests run without real Google credentials,
 * a running server, or a live database. Authentication is faked by injecting a token into
 * localStorage before page load.
 *
 * Covers:
 * - Settings: connect button redirects with JWT in query param
 * - Settings: ?gcal_connected=true callback cleans URL and refreshes state
 * - Settings: calendar picker shows API-fetched calendars when connected
 * - Settings: selecting a calendar auto-saves to the settings API
 * - Settings: disconnect resets card to unconnected state
 * - Home: connect prompt shown when GCal not connected
 * - Home: events from Google Calendar appear in week grid when connected
 * - AssistantDashboard: schedule events from guardian's calendar are displayed
 */

import { test, expect, Page } from "@playwright/test";

// ── Auth helpers ──────────────────────────────────────────────────────────────

// Auth uses Zustand `persist` — stores state under localStorage["auth"],
// not just localStorage["token"]. Inject the full persisted shape.
async function injectGuardianToken(page: Page) {
  await page.addInitScript(() => {
    const auth = { state: { token: "fake-guardian-token", role: "guardian", assistantId: null, activeView: "guardian" }, version: 0 };
    localStorage.setItem("auth", JSON.stringify(auth));
    localStorage.setItem("token", "fake-guardian-token"); // for axios interceptor
  });
}

async function injectAssistantToken(page: Page) {
  await page.addInitScript(() => {
    const auth = { state: { token: "fake-assistant-token", role: "assistant", assistantId: "asst_01", activeView: "assistant" }, version: 0 };
    localStorage.setItem("auth", JSON.stringify(auth));
    localStorage.setItem("token", "fake-assistant-token"); // for axios interceptor
  });
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

type GcalState = {
  connected?: boolean;
  email?: string;
  calendarId?: string;
};

async function mockSettingsApi(page: Page, gcal: GcalState = {}) {
  const { connected = false, email = "", calendarId = "primary" } = gcal;
  await page.route("**/api/settings", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        json: {
          gcal_connected:      connected ? "true" : "false",
          gcal_email:          email,
          gcal_calendar_id:    calendarId,
          gcal_sync_enabled:   "true",
          gcal_reminders:      "true",
          gcal_reminder_hours: "24",
        },
      });
    } else {
      await route.fulfill({ json: { ok: true } });
    }
  });
}

async function mockGuardianCommon(page: Page) {
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({ json: { id: 1, email: "guardian@test.se", role: "guardian" } })
  );
  await page.route("**/api/profile", (r) =>
    r.fulfill({ json: { patientName: "Test Patient", weeklyHours: 40 } })
  );
  await page.route("**/api/assistants", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/invites", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/entries", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/payroll*", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/absences*", (r) => r.fulfill({ json: [] }));
}

// ── Settings: connect flow ────────────────────────────────────────────────────

test.describe("Settings — connect flow", () => {
  test("Connect button redirects to /api/gcal/connect with JWT in query param", async ({ page }) => {
    await injectGuardianToken(page);
    await mockGuardianCommon(page);
    await mockSettingsApi(page, { connected: false });

    // Intercept the OAuth redirect before it leaves the app
    let capturedUrl = "";
    await page.route("**/api/gcal/connect**", async (route) => {
      capturedUrl = route.request().url();
      // Prevent actual navigation to Google OAuth
      await route.fulfill({ status: 200, body: "" });
    });

    await page.goto("/settings");
    await page.getByRole("button", { name: /connect google calendar/i }).click();

    // Allow a moment for the navigation to fire
    await page.waitForTimeout(300);

    expect(capturedUrl).toContain("/api/gcal/connect");
    expect(capturedUrl).toContain("token=fake-guardian-token");
  });

  test("?gcal_connected=true param is stripped from URL after mount", async ({ page }) => {
    await injectGuardianToken(page);
    await mockGuardianCommon(page);
    await mockSettingsApi(page, { connected: true, email: "user@gmail.com", calendarId: "primary" });
    await page.route("**/api/gcal/calendars", (r) => r.fulfill({ json: [] }));

    await page.goto("/settings?gcal_connected=true");

    // URL should clean itself on mount
    await expect(page).toHaveURL(/\/settings(?!\?gcal_connected)/, { timeout: 3000 });
    expect(page.url()).not.toContain("gcal_connected");
  });

  test("Connected state shows Google account email, not portal login email", async ({ page }) => {
    await injectGuardianToken(page);
    await mockGuardianCommon(page);
    await mockSettingsApi(page, { connected: true, email: "mygoogleaccount@gmail.com" });
    await page.route("**/api/gcal/calendars", (r) => r.fulfill({ json: [] }));

    await page.goto("/settings");

    // Should show the Google account email
    await expect(page.getByText("mygoogleaccount@gmail.com")).toBeVisible({ timeout: 3000 });
  });
});

// ── Settings: calendar picker ─────────────────────────────────────────────────

test.describe("Settings — calendar picker", () => {
  test("Picker shows calendar names fetched from API", async ({ page }) => {
    await injectGuardianToken(page);
    await mockGuardianCommon(page);
    await mockSettingsApi(page, { connected: true, email: "user@gmail.com", calendarId: "cal_1" });
    await page.route("**/api/gcal/calendars", (r) =>
      r.fulfill({
        json: [
          { id: "cal_1", summary: "Personal Calendar", primary: true  },
          { id: "cal_2", summary: "Assistance Schedule", primary: false },
        ],
      })
    );

    await page.goto("/settings");

    // The select trigger should show the selected calendar
    await expect(page.getByText("Personal Calendar")).toBeVisible({ timeout: 3000 });
  });

  test("Selecting a different calendar calls settings API to save the new calendar ID", async ({ page }) => {
    await injectGuardianToken(page);
    await mockGuardianCommon(page);
    await mockSettingsApi(page, { connected: true, email: "user@gmail.com", calendarId: "cal_1" });
    await page.route("**/api/gcal/calendars", (r) =>
      r.fulfill({
        json: [
          { id: "cal_1", summary: "Personal Calendar", primary: true  },
          { id: "cal_2", summary: "Assistance Schedule", primary: false },
        ],
      })
    );

    // Capture the settings PUT to verify calendar ID is saved
    const savedCalendarId: string[] = [];
    await page.route("**/api/settings", async (route) => {
      if (route.request().method() === "PUT") {
        const body = route.request().postDataJSON();
        if (body?.gcal_calendar_id) savedCalendarId.push(body.gcal_calendar_id);
        await route.fulfill({ json: { ok: true } });
      } else {
        await route.fulfill({
          json: {
            gcal_connected: "true", gcal_email: "user@gmail.com",
            gcal_calendar_id: "cal_1", gcal_sync_enabled: "true",
            gcal_reminders: "true", gcal_reminder_hours: "24",
          },
        });
      }
    });

    await page.goto("/settings");

    // Open the calendar picker and select the second option
    await page.getByText("Personal Calendar").click();
    await page.getByRole("option", { name: "Assistance Schedule" }).click();

    await expect.poll(() => savedCalendarId, { timeout: 3000 }).toContain("cal_2");
  });
});

// ── Settings: disconnect ──────────────────────────────────────────────────────

test.describe("Settings — disconnect", () => {
  test("Disconnect button calls API and resets card to unconnected state", async ({ page }) => {
    await injectGuardianToken(page);
    await mockGuardianCommon(page);
    await mockSettingsApi(page, { connected: true, email: "user@gmail.com" });
    await page.route("**/api/gcal/calendars", (r) => r.fulfill({ json: [] }));

    let disconnectCalled = false;
    await page.route("**/api/gcal/disconnect", async (route) => {
      disconnectCalled = true;
      await route.fulfill({ json: { ok: true } });
    });

    await page.goto("/settings");

    // Should show Disconnect button when connected
    await expect(page.getByRole("button", { name: /disconnect/i })).toBeVisible({ timeout: 3000 });
    await page.getByRole("button", { name: /disconnect/i }).click();

    // API must have been called
    expect(disconnectCalled).toBe(true);

    // Card should return to unconnected state — Connect button visible
    await expect(page.getByRole("button", { name: /connect google calendar/i })).toBeVisible({ timeout: 3000 });
  });
});

// ── Home: schedule display ────────────────────────────────────────────────────

test.describe("Home — schedule display", () => {
  test("Shows connect prompt when Google Calendar is not connected", async ({ page }) => {
    await injectGuardianToken(page);
    await mockGuardianCommon(page);
    await mockSettingsApi(page, { connected: false });

    await page.goto("/home");

    // Should show some kind of connect CTA
    await expect(
      page.getByText(/connect.*calendar|sync.*calendar|link.*calendar/i).first()
    ).toBeVisible({ timeout: 3000 });
  });

  test("Shows Google Calendar events in the week grid when connected", async ({ page }) => {
    await injectGuardianToken(page);
    await mockGuardianCommon(page);
    await mockSettingsApi(page, { connected: true, calendarId: "primary" });

    // Mock events for current week — use a fixed date within the week
    await page.route("**/api/gcal/events*", (r) =>
      r.fulfill({
        json: [
          {
            id: "evt_1",
            summary: "Assistance: Anna",
            start: { dateTime: new Date().toISOString().replace(/T.*/, "T08:00:00") },
            end:   { dateTime: new Date().toISOString().replace(/T.*/, "T16:00:00") },
          },
        ],
      })
    );

    await page.goto("/home");

    // Event title should appear in the week grid
    await expect(page.getByText("Assistance: Anna")).toBeVisible({ timeout: 3000 });
  });
});

// ── AssistantDashboard: schedule display ──────────────────────────────────────

// Shared helper for assistant dashboard mocks
async function mockAssistantCommon(page: Page) {
  await page.route("**/api/auth/me", (r) =>
    r.fulfill({ json: { id: 2, email: "assistant@test.se", role: "assistant", assistantId: "asst_01" } })
  );
  // guardianId in response seeds selectedGuardianId via effectiveGuardianId fallback
  await page.route("**/api/assistant/me", (r) =>
    r.fulfill({ json: { assistant: { id: "asst_01", name: "Anna", guardianId: 1 }, patientName: "Test Patient" } })
  );
  // No multi-family — empty list so effectiveGuardianId falls back to me.assistant.guardianId
  await page.route("**/api/guardian-links/my-families", (r) => r.fulfill({ json: [] }));
  await page.route("**/api/clock/status*", (r) =>
    r.fulfill({ json: { state: "clocked_out", activeEvent: null } })
  );
  await page.route("**/api/assistant/entries*", (r) => r.fulfill({ json: [] }));
}

test.describe("AssistantDashboard — schedule from guardian's calendar", () => {
  test("Shows today's shift from guardian's Google Calendar", async ({ page }) => {
    await injectAssistantToken(page);
    await mockAssistantCommon(page);

    const todayStr = new Date().toISOString().split("T")[0];
    await page.route("**/api/assistant/schedule*", (r) =>
      r.fulfill({
        json: [
          {
            id: "evt_1",
            summary: "Assistance: Anna",
            start: { dateTime: `${todayStr}T08:00:00` },
            end:   { dateTime: `${todayStr}T16:00:00` },
          },
        ],
      })
    );

    await page.goto("/assistant");

    // Today's shift card shows the event summary (appears in both today card and upcoming tab)
    await expect(page.getByText("Assistance: Anna").first()).toBeVisible({ timeout: 5000 });
  });

  test("Shows empty state gracefully when no schedule (GCal not connected)", async ({ page }) => {
    await injectAssistantToken(page);
    await mockAssistantCommon(page);
    // Empty list — GCal not connected, server returns []
    await page.route("**/api/assistant/schedule*", (r) => r.fulfill({ json: [] }));

    await page.goto("/assistant");

    // "No shift scheduled today" message from line 302 in AssistantDashboard.tsx
    await expect(page.getByText(/no shift scheduled today/i)).toBeVisible({ timeout: 5000 });
  });
});
