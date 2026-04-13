# Phase 6: Google Calendar Integration — Research

**Researched:** 2026-04-12
**Domain:** Google OAuth2, Google Calendar API v3, React OAuth return flow
**Confidence:** HIGH (backend already built; gaps are narrow and well-defined)

---

## Business Model

**Google Calendar is the source of truth for the schedule. The app never creates the schedule.**

The guardian manages shifts entirely in Google Calendar:
- Creates events named `Assistance: [assistant name]` (naming convention for clarity — app pulls all events, not filtered)
- Invites the assistant's email to each event
- The app reads those events to display the schedule

The assistant sees events in the app by the server reading the guardian's connected calendar directly
(`GET /api/assistant/schedule` calls `getCalendarClient()` with the guardian's OAuth tokens). The
assistant does NOT authenticate with Google. Whether or not the assistant accepted the calendar
invite is irrelevant to what appears in the app — the app always shows everything from the
guardian's calendar.

**Manual overrides** exist for retroactive hour logging: days when the app wasn't in use yet, or
when clock-in/out didn't happen.

---

## Summary

The backend for Phase 6 is already complete. `server/src/routes/gcal.ts` implements the full OAuth2
connect/callback flow, token storage, disconnect, calendar list, and calendar event reads using the
`googleapis` SDK (v140.0.1, installed). The route is already mounted at `/api/gcal` in `index.ts`.

**There are exactly three gaps to close:**

1. **Client:** Replace `simulateConnect()` with a real browser redirect passing the JWT as a query
   param (`/api/gcal/connect?token=<jwt>`), and detect the `?gcal_connected=true` query param when
   Settings mounts so it can re-fetch status and show the calendar picker.
2. **Server:** Add a `GET /api/gcal/calendars` endpoint that calls `calendarList.list` and returns
   the user's real calendar list so the picker can be populated dynamically.
3. **Server env:** Add `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, and
   `CLIENT_URL` to `server/.env` — none of these are present yet. The user must create OAuth
   credentials in Google Cloud Console before the connect flow can run.

**Primary recommendation:** Three focused changes — env vars, one new API endpoint, two-function
swap in Settings.tsx. No schema changes, no new dependencies, no new routes file needed.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| googleapis | 140.0.1 (installed) | Google APIs SDK — Calendar v3, OAuth2 | Official Google SDK [VERIFIED: npm registry] |
| google-auth-library | bundled with googleapis | OAuth2 token management | Included in googleapis package [VERIFIED: codebase] |

**No new dependencies required for this phase.** `googleapis` is already in `server/package.json`
and installed.

### Supporting (client-side, already installed)
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tanstack/react-query | existing | Re-fetch gcal status after callback | Already used everywhere in Settings.tsx |
| react-router-dom | existing | Read `?gcal_connected=true` search param | `useSearchParams` hook |

---

## Architecture Patterns

### OAuth2 return flow (the key pattern for this phase)

The backend already redirects to `/calendar?gcal_connected=true` after a successful OAuth callback
(line 63 of `gcal.ts`). However `/calendar` is redirected to `/home` in `App.tsx`. The redirect
destination needs to change to `/settings?gcal_connected=true` to land the user back on Settings.

**Pattern: detect callback param on mount, refresh status query**

```typescript
// Source: React Router docs — useSearchParams [ASSUMED pattern, standard React Router]
const [searchParams, setSearchParams] = useSearchParams();

useEffect(() => {
  if (searchParams.get("gcal_connected") === "true") {
    // 1. Invalidate gcal status query so it re-fetches
    qc.invalidateQueries({ queryKey: ["gcal-status"] });
    // 2. Remove the param from URL (clean history)
    setSearchParams({});
  }
}, []);
```

**Pattern: real OAuth redirect (replaces simulateConnect)**

```typescript
// Source: gcalApi.connectUrl() already returns correct URL [VERIFIED: codebase]
function connectGoogle() {
  // Full page redirect — OAuth2 requires browser navigation, not fetch
  window.location.href = gcalApi.connectUrl();
}
```

### New endpoint: GET /api/gcal/calendars

The Calendar API `calendarList.list` method returns all calendars the user has access to.

```typescript
// Source: googleapis calendarList.list docs [ASSUMED — standard googleapis usage]
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
```

**Response shape from calendarList.list** [ASSUMED — from googleapis training knowledge]:
```json
{
  "items": [
    { "id": "primary", "summary": "user@gmail.com", "primary": true },
    { "id": "abc123@group.calendar.google.com", "summary": "Assistance Schedule" }
  ]
}
```

### Calendar picker: replace hardcoded items with API data

Current Settings.tsx (line 491–494) has two hardcoded `SelectItem` entries. These must be replaced
with data from `GET /api/gcal/calendars`, fetched after `gcal.connected` becomes `true`.

```typescript
// Add to gcalApi in api.ts
calendars: () => api.get<{ id: string; summary: string; primary: boolean }[]>("/gcal/calendars"),

// In Settings.tsx — query enabled only when connected
const { data: calendarList = [] } = useQuery({
  queryKey: ["gcal-calendars"],
  queryFn:  () => gcalApi.calendars().then((r) => r.data),
  enabled:  gcal.connected,
});
```

### Disconnect function

The existing `disconnect()` function in Settings.tsx (line 212–214) calls `settingsApi.update`
directly instead of `gcalApi.disconnect()`. It should call the API endpoint which zeroes all tokens,
and then invalidate gcal-status and gcal-calendars queries.

```typescript
// Replace disconnect() in Settings.tsx
async function disconnect() {
  await gcalApi.disconnect();
  qc.invalidateQueries({ queryKey: ["gcal-status"] });
  qc.invalidateQueries({ queryKey: ["gcal-calendars"] });
  setGcal((g) => ({ ...g, connected: false, email: "", calendarId: "" }));
}
```

### Recommended project structure changes

```
server/src/routes/gcal.ts         — ADD: GET /calendars endpoint (6 lines)
server/.env                       — ADD: 4 env vars
client/src/lib/api.ts             — ADD: gcalApi.calendars()
client/src/pages/Settings.tsx     — MODIFY: simulateConnect → real redirect,
                                             gcal_connected param detection,
                                             calendar picker from API,
                                             disconnect via API
```

### Anti-Patterns to Avoid

- **Using `fetch` or `api.get` for the connect step:** OAuth2 requires a full browser redirect.
  `window.location.href = url` is correct. Calling via axios would get a 302 which axios follows
  within the SPA — the consent screen cannot render inside a fetch response.
- **Reading gcal status from local state alone:** After OAuth callback the server has the tokens,
  but local state is stale. Always re-fetch `/api/gcal/status` when `?gcal_connected=true` param
  is detected.
- **Leaving `simulateConnect` in code alongside real connect:** Remove it entirely. A partial
  implementation creates confusion and may mask auth errors.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| OAuth2 token refresh | Manual token refresh logic | googleapis built-in auto-refresh | `oauth2Client.on("tokens", ...)` already in gcal.ts line 83 — handles refresh automatically |
| Calendar list parsing | Custom calendar scraping | `calendarList.list` API | Already available via initialized calendar client |
| PKCE / state parameter | Custom state verification | googleapis generates auth URL with state support | For localhost/dev, Google's consent screen + redirect URI is sufficient |

---

## Common Pitfalls

### Pitfall 1: Redirect URI mismatch
**What goes wrong:** Google OAuth returns `redirect_uri_mismatch` error (400). The OAuth callback
fails before saving any tokens.
**Why it happens:** The URI registered in Google Cloud Console and the value in `GOOGLE_REDIRECT_URI`
env var must be byte-for-byte identical. Trailing slashes, http vs https, port numbers all matter.
**How to avoid:** For local dev, register `http://localhost:3001/api/gcal/callback` in GCP console.
Set `GOOGLE_REDIRECT_URI=http://localhost:3001/api/gcal/callback` in server/.env.
**Warning signs:** Error appears immediately on redirect back from Google, before settings are saved.

### Pitfall 2: Missing refresh_token on subsequent logins
**What goes wrong:** `tokens.refresh_token` is `null` after the second login. Token auto-refresh
fails silently; calendar API calls start returning 401 after the first access_token expires (~1h).
**Why it happens:** Google only sends `refresh_token` on the first consent grant, or when
`prompt: "consent"` is included in the auth URL. The backend already uses `prompt: "consent"` and
`access_type: "offline"` (gcal.ts line 22–23), which forces fresh token issuance. This is correct.
**How to avoid:** Confirmed — backend already handles this correctly. No change needed.
**Warning signs:** Calendar sync stops working after ~1 hour for users who connected a second time.

### Pitfall 3: gcal_connected=true but status query not refetched
**What goes wrong:** Guardian completes OAuth flow, is redirected to `/settings?gcal_connected=true`,
but the Connect button is still visible (not the connected state with calendar picker).
**Why it happens:** `useQuery(["settings"])` has already cached the pre-auth settings response.
The `?gcal_connected=true` param exists but nothing invalidates the cache.
**How to avoid:** On mount, check `useSearchParams()` for `gcal_connected=true`. If found,
call `qc.invalidateQueries({ queryKey: ["settings"] })` (or `["gcal-status"]` if using a
dedicated status query).

### Pitfall 4: /calendar redirect in App.tsx
**What goes wrong:** gcal.ts line 63 redirects to `${CLIENT_URL}/calendar?gcal_connected=true`,
but App.tsx has `<Route path="/calendar" element={<Navigate to="/home" replace />} />`.
The `gcal_connected=true` param is silently discarded. Guardian lands on Home, never sees calendar
picker.
**How to avoid:** Change gcal.ts callback redirect from `/calendar?gcal_connected=true` to
`/settings?gcal_connected=true`. This is a one-line fix in the backend.

### Pitfall 5: Localhost OAuth in test/dev vs production
**What goes wrong:** Google OAuth blocks `localhost` in some configurations; consent screen shows
an "unverified app" warning.
**Why it happens:** Apps accessing sensitive scopes (calendar) must pass Google's verification for
production. For development/test, this is expected and not an error — the user can click
"Advanced → Go to [app] (unsafe)" to proceed.
**How to avoid:** Explicitly document in the setup guide that the "unverified app" warning is
expected during local testing. For production, the app must be verified with Google.

### Pitfall 6: `gcal_calendar_id` not saved after picker selection
**What goes wrong:** Guardian selects a calendar from the dropdown after connecting, but subsequent
event operations still use "primary".
**Why it happens:** Settings.tsx currently only saves gcal_sync_enabled, gcal_reminders, and
gcal_reminder_hours in `saveGcal`. The `gcal_calendar_id` selection is not persisted.
**How to avoid:** Add `gcal_calendar_id: gcal.calendarId` to the `saveGcal` mutation payload, or
auto-save on picker change via a separate `settingsApi.update` call.

---

## Code Examples

### Full connect button change (Settings.tsx)
```typescript
// BEFORE (simulateConnect):
function simulateConnect() {
  setConnecting(true);
  setTimeout(() => { ... }, 1800);
}

// AFTER (real OAuth redirect):
// NOTE: Uses ?token= query param — NOT gcalApi.connectUrl() — because /api/gcal/connect uses
// requireGuardianOrQueryToken middleware which accepts the JWT in the query string.
// A full-page redirect cannot set Authorization headers, so the token is passed in the URL.
function connectGcal() {
  const token = localStorage.getItem("token");
  window.location.href = `${window.location.origin}/api/gcal/connect?token=${token}`;
}
// Update JSX: onClick={connectGcal}
```

### Callback detection on Settings mount
```typescript
// Source: standard React Router / React Query pattern [ASSUMED]
const [searchParams, setSearchParams] = useSearchParams();

useEffect(() => {
  if (searchParams.get("gcal_connected") === "true") {
    qc.invalidateQueries({ queryKey: ["settings"] });
    setSearchParams({}, { replace: true }); // clean URL
  }
}, []); // run once on mount
```

### Add calendars method to gcalApi (api.ts)
```typescript
// Add alongside existing gcalApi methods:
calendars: () => api.get<{ id: string; summary: string; primary: boolean }[]>("/gcal/calendars"),
```

### Calendar picker from API data (Settings.tsx)
```typescript
const { data: calendarList = [] } = useQuery({
  queryKey: ["gcal-calendars"],
  queryFn:  () => gcalApi.calendars().then((r) => r.data),
  enabled:  gcal.connected,
});

// In JSX:
<SelectContent>
  {calendarList.map((cal) => (
    <SelectItem key={cal.id!} value={cal.id!}>
      {cal.summary}{cal.primary ? " (primary)" : ""}
    </SelectItem>
  ))}
</SelectContent>
```

### Save calendarId to settings on picker change (Settings.tsx)
```typescript
onValueChange={(v) => {
  setGcal((g) => ({ ...g, calendarId: v }));
  settingsApi.update({ gcal_calendar_id: v });
}}
```

---

## Environment Setup (User Action Required)

Before this phase can be tested, the guardian must:

1. Go to [Google Cloud Console](https://console.cloud.google.com/) → Create or select a project
2. Enable the **Google Calendar API** in APIs & Services → Library
3. Create **OAuth 2.0 credentials**: APIs & Services → Credentials → Create Credentials → OAuth 2.0
   Client ID → Application type: Web application
4. Add authorized redirect URI: `http://localhost:3001/api/gcal/callback`
5. Copy the Client ID and Client Secret
6. Add to `server/.env`:
   ```
   GOOGLE_CLIENT_ID=<your-client-id>
   GOOGLE_CLIENT_SECRET=<your-client-secret>
   GOOGLE_REDIRECT_URI=http://localhost:3001/api/gcal/callback
   CLIENT_URL=http://localhost:5173
   ```

**Note:** The OAuth consent screen will show an "unverified app" warning during local testing.
This is expected. Click "Advanced → Go to [app] (unsafe)" to proceed in test.

**Note:** The scopes requested (`calendar`, `calendar.events`, `userinfo.email`) require the app to
eventually be verified by Google for production use. For MVP/testing with the guardian's own Google
account, unverified access is sufficient (Google allows up to 100 test users for unverified apps).

---

## Runtime State Inventory

> Step 2.5 check — this is not a rename/refactor/migration phase. No runtime state migration needed.

| Category | Items Found | Action Required |
|----------|-------------|-----------------|
| Stored data | settings table stores gcal_* keys via upsert — already present if user ran simulated connect previously | No migration; upsert pattern handles existing rows safely |
| Live service config | None — Google credentials are in .env, not a live service UI | None |
| OS-registered state | None | None |
| Secrets/env vars | GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET missing from server/.env | Add manually before testing |
| Build artifacts | None | None |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| googleapis npm package | OAuth2 + Calendar API calls | ✓ | 140.0.1 (installed) | — |
| PostgreSQL | Settings storage (gcal_* keys) | ✓ | assumed running (used by all previous phases) | — |
| Google Cloud credentials | OAuth2 connect flow | ✗ | — | Phase cannot run without these; user must create in GCP Console |

**Missing dependencies with no fallback:**
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` / `CLIENT_URL` — must be added to `server/.env` by the guardian before the OAuth flow can run.

**Missing dependencies with fallback:**
- None.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest (installed, configured) |
| Config file | `server/vitest.config.ts` |
| Quick run command | `cd server && npm test` |
| Full suite command | `cd server && npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GCAL-01 | `/api/gcal/calendars` returns array with id/summary/primary fields | unit | `cd server && npm test -- --reporter=verbose src/routes/__tests__/gcal.test.ts` | ❌ Wave 0 |
| GCAL-01 | `gcal.ts` callback saves tokens + redirects to `/settings?gcal_connected=true` | unit (mock googleapis) | same file | ❌ Wave 0 |
| GCAL-01 | `gcal.ts` disconnect zeroes all token fields | unit | same file | ❌ Wave 0 |
| GCAL-01 | Connect button click triggers navigation to `/api/gcal/connect` | manual only | n/a — OAuth requires real browser + Google account | manual |

> Note: The full OAuth2 round-trip (consent screen → callback → token storage) is manual-only
> because it requires a real Google account and browser. Unit tests mock the googleapis client.

### Sampling Rate
- **Per task commit:** `cd server && npm test`
- **Per wave merge:** `cd server && npm test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `server/src/routes/__tests__/gcal.test.ts` — covers GCAL-01 (calendars endpoint, callback redirect, disconnect zeroing)
- [ ] Mock strategy: use `vi.mock("googleapis")` to mock `calendarList.list` and token exchange

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | JWT already enforced; `requireAuth + requireGuardian` on all gcal routes |
| V3 Session Management | no | OAuth tokens stored server-side in settings table, not in session |
| V4 Access Control | yes | `requireGuardian` middleware on all gcal routes — assistant cannot access |
| V5 Input Validation | partial | `code` query param in callback should be validated as non-empty (already done: line 39) |
| V6 Cryptography | yes | OAuth tokens stored in plaintext in settings table — acceptable for single-tenant MVP; note for v2 encryption |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Token theft from settings table | Information Disclosure | Single-tenant PostgreSQL with server-side JWT auth; tokens never sent to client |
| CSRF on /api/gcal/connect | Spoofing | Low risk — GET endpoint initiates redirect; no state change until callback with valid code |
| Open redirect via CLIENT_URL | Tampering | `CLIENT_URL` is a server env var, not user input; callback redirect cannot be manipulated |
| Unverified `code` parameter in callback | Tampering | googleapis `getToken(code)` validates code against Google's servers; invalid codes fail at Google |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `calendarList.list` response shape has `items[].id`, `items[].summary`, `items[].primary` fields | Code Examples, Architecture Patterns | Calendar picker could fail to render if field names differ — verify against googleapis TypeScript types already installed |
| A2 | `prompt: "consent"` + `access_type: "offline"` reliably produces a refresh_token on all Google account types | Common Pitfalls | Token refresh fails after 1h for Workspace accounts with admin restrictions — low risk for single guardian |
| A3 | `/settings?gcal_connected=true` redirect (after fixing the /calendar redirect) will land user on Settings with active React Query | Architecture Patterns | If Vite SPA does not hydrate before useEffect runs, param may be missed — standard React behavior makes this safe |

---

## Open Questions

1. **OAuth consent screen — which Google account should be used?**
   - What we know: The guardian registers with `rose@karon.se` (per server/.env GMAIL_USER)
   - What's unclear: Should the GCP project use a personal Google account or a Google Workspace account? This affects verification requirements.
   - Recommendation: Use the guardian's personal Google account for GCP project. For MVP, unverified app with personal account is sufficient.

2. **calendarId persistence — auto-save or explicit save?**
   - What we know: Current `saveGcal` button saves sync/reminder settings but not calendarId.
   - What's unclear: Should selecting a calendar auto-save immediately, or wait for "Save calendar settings" button?
   - Recommendation: Auto-save on picker change (one `settingsApi.update` call on `onValueChange`) for better UX — avoids guardian forgetting to click save.

3. **Multi-tenant safety of gcal tokens**
   - What we know: The settings table is a flat key-value store with no guardianId column. All guardians share the same `gcal_*` keys.
   - What's unclear: Is this a concern for Phase 6 scope? (Project is currently single-tenant.)
   - Recommendation: Acceptable for Phase 6 single-tenant MVP. Document as v2 work if multi-tenant is added.

---

## Sources

### Primary (HIGH confidence)
- Codebase `server/src/routes/gcal.ts` [VERIFIED] — complete backend implementation read directly
- Codebase `client/src/pages/Settings.tsx` [VERIFIED] — simulateConnect and UI structure read directly
- Codebase `client/src/lib/api.ts` [VERIFIED] — gcalApi methods read directly
- Codebase `server/.env` [VERIFIED] — missing env vars confirmed by reading file
- Codebase `server/package.json` + `node_modules/googleapis/package.json` [VERIFIED] — googleapis 140.0.1 confirmed installed
- Codebase `client/src/App.tsx` [VERIFIED] — `/calendar` redirect confirmed, `/settings` route confirmed

### Secondary (MEDIUM confidence)
- googleapis npm registry — v171.4.0 latest confirmed via `npm view googleapis version` [VERIFIED: npm registry]
- Google OAuth2 redirect URI requirements — standard OAuth2 spec behavior [ASSUMED training knowledge]

### Tertiary (LOW confidence)
- `calendarList.list` response field names (`id`, `summary`, `primary`) — from training knowledge of googleapis v140 TypeScript types; verify against `node_modules/googleapis` TypeScript definitions if needed

---

## Metadata

**Confidence breakdown:**
- What already exists (backend, api.ts): HIGH — verified by reading files
- Gaps to close (3 items): HIGH — derived directly from reading the actual code
- New /calendars endpoint pattern: MEDIUM — standard googleapis usage; field names marked ASSUMED
- OAuth gotchas: MEDIUM — standard OAuth2 behavior, well-established patterns
- Google Cloud Console setup steps: MEDIUM — standard GCP OAuth setup, may have minor UI changes

**Research date:** 2026-04-12
**Valid until:** 2026-05-12 (googleapis API is stable; OAuth2 flow changes rarely)
