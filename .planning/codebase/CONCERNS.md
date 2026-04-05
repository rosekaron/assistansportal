# Codebase Concerns

**Analysis Date:** 2026-04-06

---

## Security Considerations

**Hard-coded fallback JWT secret in production code:**
- Risk: If `JWT_SECRET` env var is absent, the server signs all tokens with the literal string `"dev_secret"`. Any JWT forged with this secret would be accepted as valid.
- Files: `server/src/routes/auth.ts` line 12, `server/src/middleware/auth.ts` line 15
- Current mitigation: None — no startup check enforces the env var's presence.
- Recommendations: Throw a fatal error at startup if `JWT_SECRET` is missing or equals `"dev_secret"`. Never silently fall back.

**`/api/auth/dev-verify` endpoint is live in production:**
- Risk: This endpoint lets any caller verify an email without ever receiving the email link — it only requires the verification token (which is also returned in the register response as `devVerifyToken`). In a real deployment the register response exposes `devVerifyToken` unconditionally.
- Files: `server/src/routes/auth.ts` lines 44, 69–82; `client/src/lib/api.ts` line 38; `client/src/pages/Login.tsx` line 37
- Current mitigation: None — the endpoint has no environment guard.
- Recommendations: Gate the endpoint behind `NODE_ENV !== "production"` and strip `devVerifyToken` from the register response in production.

**Google OAuth tokens stored unencrypted in the `settings` database table:**
- Risk: The Google Calendar access token and refresh token are stored as plain text rows under the keys `gcal_access_token` and `gcal_refresh_token`. Anyone with read access to the database (or via the `/api/settings` endpoint, which returns all settings to any authenticated user) can extract live OAuth tokens.
- Files: `server/src/routes/gcal.ts` lines 57–59, 77–79, 85–87; `server/src/routes/misc.ts` lines 90–94
- Current mitigation: `/api/settings` requires `requireAuth`, but any authenticated user (including assistants) gets all keys.
- Recommendations: Encrypt tokens at rest; exclude `gcal_access_token` and `gcal_refresh_token` from the settings GET response; restrict settings write to guardians only.

**Role middleware (`requireGuardian`, `requireAssistant`) is defined but never used:**
- Risk: All guardian-only data endpoints (entries, assistants, profile, costs, PDF, slots, blocked, invites) rely solely on `requireAuth`, which any authenticated user — guardian or assistant — passes. An authenticated assistant can currently call `POST /api/entries`, `DELETE /api/assistants/:id`, `GET /api/pdf/fk3057`, and every other guardian endpoint.
- Files: `server/src/middleware/auth.ts` lines 27–35; all route files under `server/src/routes/`
- Current mitigation: Client routing redirects assistants away, but there is no server-side enforcement.
- Recommendations: Apply `requireGuardian` to all guardian-facing routes; apply `requireAssistant` (or at minimum scope responses to `req.assistantId`) on assistant self-service routes.

**No rate limiting on authentication endpoints:**
- Risk: `/api/auth/login`, `/api/auth/register`, `/api/auth/forgot-password`, and `/api/auth/resend-verification` are exposed with no brute-force protection. Login allows unlimited password guesses.
- Files: `server/src/routes/auth.ts`; `server/src/index.ts`
- Current mitigation: None — `express-rate-limit` and `helmet` are absent from `server/package.json`.
- Recommendations: Add `express-rate-limit` with a low threshold on auth routes; add `helmet` for standard HTTP security headers.

**Raw internal error messages sent to API callers:**
- Risk: Every route's catch block does `res.status(500).json({ error: String(e) })`, which leaks Postgres error messages, internal stack context, or ORM query details to the client.
- Files: All files in `server/src/routes/` — 25+ occurrences
- Current mitigation: None.
- Recommendations: Return a generic "Internal server error" message in production; log the actual error server-side only.

**`process.env.PATH` mutated at process start to include Homebrew:**
- Risk: Hardcodes a macOS-specific Homebrew path (`/opt/homebrew/bin`) into the server's PATH. This will silently have no effect (or interfere) in any non-macOS deployment (Linux containers, CI, production).
- Files: `server/src/index.ts` line 8
- Current mitigation: None — the `qpdf` dependency is also absent from `package.json` (it is expected to be a system binary).
- Recommendations: Use an environment variable for the `qpdf` binary path; verify `qpdf` availability at startup and fail with a clear message if absent.

**Hardcoded server URL in client:**
- Risk: `http://localhost:3001` is hardcoded as the Google Calendar OAuth redirect target. This will break in any non-local deployment.
- Files: `client/src/pages/Calendar.tsx` line 96
- Current mitigation: None.
- Recommendations: Derive the server origin from a `VITE_API_URL` env var or from `window.location.origin` plus a known path prefix.

---

## Tech Debt

**No database migration workflow — schema managed via `drizzle-kit push`:**
- Issue: The only db command is `db:push`, which applies schema changes destructively (no rollback, no migration history). There is no `migrations/` directory.
- Files: `server/drizzle.config.ts`; `server/package.json`
- Impact: Any schema change in production requires manual coordination; schema drift across environments is not detectable.
- Fix approach: Run `drizzle-kit generate` to create SQL migration files; commit them; use `drizzle-kit migrate` in CI/CD.

**Duplicate camelCase / snake_case field handling throughout the frontend:**
- Issue: The database returns camelCase (Drizzle ORM default), but many client pages defensively access both `e.reqStatus ?? e.req_status`, `e.startTime ?? e.start_time`, etc. Some pages still use only `e.req_status` (snake_case). This is inconsistent and fragile.
- Files: `client/src/pages/Hours.tsx` lines 27, 71, 76, 81; `client/src/pages/Reports.tsx` lines 125–168, 643, 666, 720; `client/src/pages/Calendar.tsx` lines 167–172
- Impact: If the API response shape ever changes, bugs will appear silently in the half-and-half dual access.
- Fix approach: Define proper TypeScript types for API responses (matching the exact camelCase Drizzle output) and remove all snake_case fallbacks.

**All data types from API responses are `Record<string, string | number | null | undefined>`:**
- Issue: Pages cast API results to wide untyped records (`type Entry = Record<string, string | number | null | undefined>`). TypeScript provides no safety for field access; mistyped field names fail silently at runtime.
- Files: `client/src/pages/Dashboard.tsx` lines 12–13; `client/src/pages/Calendar.tsx` lines 16–17; `client/src/pages/Hours.tsx` lines 16–17; `client/src/pages/Reports.tsx` lines 45–46
- Impact: Regressions in API shape are not caught at compile time; refactoring is unsafe.
- Fix approach: Export typed interfaces from `server/src/db/schema.ts` into a shared types package, or manually define matching client-side interfaces and use them throughout.

**`/api/auth/send-invite-email` reads the first profile row with no user scoping:**
- Issue: `db.select().from(profile).limit(1)` retrieves the single global profile. This works for a single-tenant deployment but silently returns wrong data if the schema ever expands to multi-tenant.
- Files: `server/src/routes/auth.ts` line 191
- Impact: Low now; breaking if multi-tenancy is ever added.
- Fix approach: Pass `guardianId` or user context to the profile query.

**Invite email not sent from `POST /api/invites` — explicit TODO:**
- Issue: Creating an invite via `POST /api/invites` only inserts the database record and logs to console. The actual invite email is sent only via a second explicit call to `POST /api/auth/send-invite-email`. If the second call is skipped, the invited assistant never receives anything.
- Files: `server/src/routes/misc.ts` line 73 (`// TODO: send actual email via SMTP / SendGrid`)
- Impact: Fragile two-step flow; easy to create "ghost" invites that are never delivered.
- Fix approach: Send the email atomically inside `POST /api/invites`, or document the required two-step flow explicitly in the API contract.

**FK hourly rate hard-coded in client-side source:**
- Issue: `const FK_HOURLY_RATE = 334;` (SEK per assistance hour) with a comment "update annually or make configurable in Settings" is embedded in the Reports page component.
- Files: `client/src/pages/Reports.tsx` line 14
- Impact: Requires a code deploy every time the Försäkringskassan rate changes (annually).
- Fix approach: Move the rate to the `settings` table so it can be updated via the Settings page without a deploy.

**Employer tax rate hard-coded in client-side source:**
- Issue: `const EMPLOYER_TAX_RATE = 0.3142;` is also embedded in the Reports page.
- Files: `client/src/pages/Reports.tsx` line 43
- Impact: Requires code change when the Swedish `arbetsgivaravgifter` rate changes.
- Fix approach: Same as FK_HOURLY_RATE — move to `settings` table.

**`newId()` generates only 4 random bytes (8 hex chars):**
- Issue: IDs for all domain entities (entries, assistants, invites, slots, costs, blocked) are generated as `prefix + randomBytes(4).toString("hex")`, giving 4 294 967 296 possible values per prefix. With moderate data volumes, collision probability becomes non-negligible (birthday problem).
- Files: `server/src/lib/id.ts`
- Impact: Low at current scale; increases as more data accumulates or if bulk inserts are used.
- Fix approach: Use `randomBytes(8)` (16 hex chars) or switch to `crypto.randomUUID()` (standard 128-bit UUID).

---

## Performance Bottlenecks

**N+1 queries in `GET /api/assistant/open-slots`:**
- Problem: For every open slot, a separate `db.select().from(entries)` query is executed inside `Promise.all` to compute fill count.
- Files: `server/src/routes/assistant.ts` lines 102–109
- Cause: No JOIN or aggregation — one query per slot row.
- Improvement path: Use a single SQL query with a `COUNT` subquery or a LEFT JOIN grouped by slot.

**Dashboard loads all entries without date pagination:**
- Problem: `entriesApi.list()` in Dashboard fetches all entries with no time-range filter. As the dataset grows, this will become a large unindexed scan.
- Files: `client/src/pages/Dashboard.tsx` line 30; `server/src/routes/entries.ts` lines 10–23
- Cause: No default date range applied when no query params are provided.
- Improvement path: Apply a sensible default window (e.g., current month ± 1 month) on the server when no `start`/`end` are specified.

**Hours page loads all entries without any filter:**
- Problem: Same as Dashboard — `entriesApi.list()` with no params fetches the entire entries table.
- Files: `client/src/pages/Hours.tsx` line 23
- Improvement path: Apply week-scoped query params.

**Missing database indexes:**
- Problem: No explicit indexes are defined in the schema. The most common query patterns — filtering entries by `assistant_id`, `date`, `req_status`, `rep_status` — will use sequential scans on larger datasets.
- Files: `server/src/db/schema.ts`
- Improvement path: Add indexes on `entries(assistant_id)`, `entries(date)`, `entries(req_status)`, `entries(rep_status)`.

---

## Fragile Areas

**Self-booking race condition:**
- Files: `server/src/routes/assistant.ts` lines 81–96
- Why fragile: The check for slot capacity (`filled >= slot.capacity`) and the subsequent insert are two separate, non-atomic operations. Two assistants can simultaneously pass the capacity check and both insert entries for the same slot, exceeding capacity.
- Safe modification: Wrap the check-and-insert in a database transaction with a row-level lock on the slot.
- Test coverage: None.

**PDF generation relies on `qpdf` system binary with macOS PATH assumption:**
- Files: `server/src/routes/pdf.ts` lines 29–52; `server/src/index.ts` line 8
- Why fragile: If `qpdf` is not installed or not on PATH, the FK3059 PDF route throws a hard error with no user-friendly fallback. The PATH manipulation hardcodes `/opt/homebrew/bin` which only exists on Apple Silicon Macs.
- Safe modification: Check for `qpdf` availability at startup; return a clear 503 with installation instructions if absent.
- Test coverage: None.

**`forms/` directory lookup uses cascading path guesses:**
- Files: `server/src/routes/pdf.ts` lines 15–27
- Why fragile: The FORMS_DIR resolution tries four different candidate paths in sequence. If the actual forms directory is not among them (e.g., in a container with a different working directory), the code silently falls back to `candidates[0]` and later throws when the file is missing.
- Safe modification: Use a `FORMS_DIR` env var; fail loudly at startup if the path is not found.
- Test coverage: None.

**Google Calendar OAuth callback does not validate `state` parameter:**
- Files: `server/src/routes/gcal.ts` lines 36–68
- Why fragile: The OAuth callback (`/api/gcal/callback`) accepts any `code` from Google without verifying a `state` parameter. This makes the callback vulnerable to CSRF — an attacker could trick an authenticated user's browser into completing the OAuth flow with an attacker-controlled Google account.
- Safe modification: Generate a random `state` nonce in `/connect`, store it in the session or a short-lived DB record, and verify it in `/callback`.
- Test coverage: None.

---

## Test Coverage Gaps

**Zero test files exist:**
- What's not tested: The entire application — authentication flows, role authorization, PDF generation, self-booking logic, Google Calendar sync, entry CRUD.
- Files: All files under `server/src/` and `client/src/`
- Risk: Any refactoring or new feature can silently break existing behaviour. Regressions in auth or data integrity will not be detected before production.
- Priority: High

**No integration tests for auth edge cases:**
- What's not tested: Token expiry handling, `/dev-verify` misuse, invite acceptance with pre-existing account.
- Files: `server/src/routes/auth.ts`
- Risk: Security regressions in auth flows go undetected.
- Priority: High

**No tests for self-booking slot capacity logic:**
- What's not tested: The concurrent booking race condition described above.
- Files: `server/src/routes/assistant.ts` lines 76–96
- Risk: Over-booking goes undetected until production incident.
- Priority: High

---

## Known Bugs

**Hours page uses `req_status` / `rep_status` snake_case but API returns camelCase:**
- Symptoms: `pendingReps` count on Hours page will always be 0 because `e.req_status` is undefined; the actual field name is `e.reqStatus`.
- Files: `client/src/pages/Hours.tsx` line 27
- Trigger: Visiting the Hours page when there are approved entries with pending reports.
- Workaround: None.

**FK3057 date range uses hardcoded day 31 for month end:**
- Symptoms: `lte(entries.date, \`${year}-${mm}-31\`)` will include dates beyond the actual end of months with fewer than 31 days, but will also miss February entries when month = "02" and the 31st doesn't exist.
- Files: `server/src/routes/pdf.ts` line 215
- Trigger: Generating FK3057 for any month. Note: FK3059 correctly computes `daysInMonth`; FK3057 does not.
- Workaround: None.

**`gcal/connect` endpoint sends the JWT token as a query parameter:**
- Symptoms: The token is visible in browser history, server access logs, and the Google consent page referrer header.
- Files: `client/src/pages/Calendar.tsx` line 96
- Trigger: Connecting Google Calendar. The token is not consumed by the server (it's ignored), so this is harmless functionally but a security exposure.
- Workaround: The token is unused server-side, but it should be removed from the URL.

---

## Dependencies at Risk

**`multer` is installed but never used:**
- Risk: Dead dependency adds attack surface with no benefit.
- Impact: None currently; package vulnerability advisories would still apply.
- Migration plan: Remove from `server/package.json`.

**`node-qpdf2` is listed as a dependency but the code calls the `qpdf` CLI directly via `spawnSync`:**
- Risk: The npm package is not actually imported anywhere in the codebase. The real dependency is the system `qpdf` binary, which has no npm-managed version constraint.
- Files: `server/src/routes/pdf.ts` lines 34–37; `server/package.json`
- Impact: `node-qpdf2` provides no value; the system `qpdf` version is uncontrolled.
- Migration plan: Remove `node-qpdf2`; document the `qpdf` system requirement in README and devcontainer setup.

**`zod` is installed server-side but never used:**
- Risk: Input validation is entirely missing from all server routes (no Zod schemas are imported in any route file). Installing Zod but not using it means all API inputs are trusted as-is.
- Files: `server/package.json`; `server/src/routes/` (no Zod imports anywhere)
- Impact: Malformed or malicious inputs can cause unexpected ORM errors or DB constraint violations that surface as raw 500 errors.
- Migration plan: Define Zod schemas for all request bodies and run `.parse()` / `.safeParse()` at route entry points.

---

*Concerns audit: 2026-04-06*
