<!-- generated-by: gsd-doc-writer -->
# API Reference

The Assistansportal backend exposes a REST API served by an Express server running on port `3001` by default (configurable via the `PORT` environment variable). All endpoints are prefixed with `/api`.

---

## Authentication

The API uses **JWT Bearer tokens** for authentication. Tokens are issued by the `/api/auth/login` and `/api/auth/accept-invite` endpoints and expire after **30 days**.

Include the token in the `Authorization` header of every authenticated request:

```
Authorization: Bearer <token>
```

### Roles

The JWT payload embeds a `role` claim. Two roles exist:

| Role | Description |
|---|---|
| `guardian` | Primary account holder — manages assistants, entries, payroll, and FK forms |
| `assistant` | Personal assistant — views own shifts, accepts/rejects proposals, clocks in/out |

Some clock-in/out endpoints also accept guardians who have registered themselves as assistants (`requireAssistantAccess` middleware).

### Error responses

All protected endpoints return the following shapes on auth failure:

```json
{ "error": "Unauthorized" }           // 401 — missing or malformed token
{ "error": "Invalid token" }          // 401 — token signature invalid or expired
{ "error": "Guardian access required" } // 403 — role mismatch
{ "error": "Assistant access required" } // 403 — role mismatch
```

---

## Endpoints Overview

### Authentication — `/api/auth`

| Method | Path | Description | Auth Required |
|---|---|---|---|
| POST | `/api/auth/register` | Register a new guardian account | No |
| GET | `/api/auth/verify-email` | Verify email via link token | No |
| POST | `/api/auth/dev-verify` | Verify email without email (dev only, disabled in production) | No |
| POST | `/api/auth/login` | Log in and receive a JWT | No |
| POST | `/api/auth/resend-verification` | Resend verification email | No |
| POST | `/api/auth/forgot-password` | Request a password-reset link | No |
| POST | `/api/auth/reset-password` | Set a new password using a reset token | No |
| POST | `/api/auth/accept-invite` | Accept an assistant invite and create an account | No |
| POST | `/api/auth/send-invite-email` | Resend an invite email to an assistant | Guardian |
| GET | `/api/auth/me` | Get the current authenticated user | Any |

### Profile — `/api/profile`

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/profile` | Get the guardian's profile | Guardian |
| PUT | `/api/profile` | Create or update the guardian's profile | Guardian |

### Assistants — `/api/assistants`

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/assistants` | List all assistants | Guardian |
| GET | `/api/assistants/:id` | Get a single assistant by ID | Any |
| POST | `/api/assistants` | Create a new assistant record | Guardian |
| PUT | `/api/assistants/:id` | Update assistant details | Guardian |
| DELETE | `/api/assistants/:id` | Delete an assistant record | Guardian |
| POST | `/api/assistants/register-self` | Guardian registers themselves as an assistant | Guardian |
| POST | `/api/assistants/link-existing` | Send a multi-family link request to an existing assistant account | Guardian |
| GET | `/api/assistants/:id/link-status` | Check pending link requests for an assistant record | Guardian |

### Assistant Self-Service — `/api/assistant`

All routes require authentication with role `assistant` or `guardian` (via `requireAssistantAccess`).

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/assistant/me` | Get the assistant's own record, linked families, and patient info | Assistant / Guardian |
| GET | `/api/assistant/entries` | List the assistant's own shift entries | Assistant / Guardian |
| GET | `/api/assistant/schedule` | Read-only view of the guardian's Google Calendar | Assistant / Guardian |
| PUT | `/api/assistant/entries/:id/accept` | Accept a proposed shift | Assistant / Guardian |
| PUT | `/api/assistant/entries/:id/reject` | Reject a proposed shift | Assistant / Guardian |
| PUT | `/api/assistant/entries/:id/submit-report` | Submit a shift report for guardian review | Assistant / Guardian |
| GET | `/api/assistant/slips` | List issued salary slips for this assistant | Assistant / Guardian |
| GET | `/api/assistant/families` | List all families (assistant records) linked to this account | Assistant / Guardian |
| POST | `/api/assistant/families/:assistantId/leave` | Leave a family (remove the multi-family link) | Assistant / Guardian |
| GET | `/api/assistant/link-requests` | List pending link requests sent to this assistant | Assistant / Guardian |
| POST | `/api/assistant/link-requests/:linkId/accept` | Accept a pending link request | Assistant / Guardian |
| POST | `/api/assistant/link-requests/:linkId/decline` | Decline a pending link request | Assistant / Guardian |

### Shift Entries — `/api/entries`

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/entries` | List entries with optional `?start=`, `?end=`, `?assistantId=` filters | Guardian |
| POST | `/api/entries` | Create a single shift entry | Guardian |
| POST | `/api/entries/bulk` | Bulk-create entries (week proposals) | Guardian |
| PUT | `/api/entries/:id` | Update entry fields | Guardian |
| DELETE | `/api/entries/:id` | Delete a shift entry | Guardian |

### Absences — `/api/absences`

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/absences` | List absences with optional `?assistantId=`, `?year=`, `?month=` filters | Guardian |
| GET | `/api/absences/balance/:assistantId` | Get VAB remaining days and sick days YTD for an assistant | Guardian |
| POST | `/api/absences` | Create an absence record (auto-cancels overlapping approved shifts) | Guardian |
| DELETE | `/api/absences/:id` | Delete an absence record | Guardian |

### Clock In/Out — `/api/clock`

All routes require authentication with role `assistant` or `guardian` (via `requireAssistantAccess`).

| Method | Path | Description | Auth Required |
|---|---|---|---|
| POST | `/api/clock/in` | Clock in for a family; body `{ guardianId: number }` | Assistant / Guardian |
| POST | `/api/clock/out` | Clock out; auto-creates a verified shift entry | Assistant / Guardian |
| GET | `/api/clock/status` | Check clock-in state; query `?guardianId=N` | Assistant / Guardian |

### Payroll — `/api/payroll`

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/payroll` | List payroll records for `?month=YYYY-MM` | Guardian |
| POST | `/api/payroll/generate` | Generate (or regenerate draft) payroll records for all assistants for a month | Guardian |
| POST | `/api/payroll/recalculate-drafts` | Recalculate all draft payroll records (admin utility) | Guardian |
| POST | `/api/payroll/:id/approve` | Approve a payroll record (one-way: draft → approved) | Guardian |

### Payments — `/api/payments`

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/payments` | List payments for `?payrollRecordId=XXX` | Guardian |
| POST | `/api/payments` | Record a payment against a payroll record | Guardian |
| DELETE | `/api/payments/:id` | Delete a payment record | Guardian |

### Costs — `/api/costs`

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/costs` | List costs with optional `?month=YYYY-MM` filter | Guardian |
| POST | `/api/costs` | Create a cost record | Guardian |
| DELETE | `/api/costs/:id` | Delete a cost record | Guardian |

### PDF Generation — `/api/pdf`

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/pdf/forms` | List available FK form files and whether they exist on disk | Guardian |
| POST | `/api/pdf/fk3059` | Generate a filled FK 3059 Tidsredovisning PDF for one assistant | Guardian |
| POST | `/api/pdf/fk3057` | Generate a filled FK 3057 Räkning PDF for the month | Guardian |
| POST | `/api/pdf/4805` | Generate a filled SKV 4805 employer declaration PDF | Guardian |
| POST | `/api/pdf/lonespec` | Generate a salary slip (lönespecifikation) PDF for an assistant (guardian path) | Guardian |
| GET | `/api/pdf/lonespec/me` | Download own salary slip as assistant; query `?month=YYYY-MM` | Assistant / Guardian |

### Google Calendar Integration — `/api/gcal`

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/gcal/connect` | Redirect to Google OAuth consent screen | Guardian |
| GET | `/api/gcal/callback` | OAuth callback — stores tokens and redirects to app | None (OAuth redirect) |
| GET | `/api/gcal/status` | Get connection status, linked email, and calendar ID | Guardian |
| GET | `/api/gcal/calendars` | List the guardian's Google calendars | Guardian |
| POST | `/api/gcal/disconnect` | Revoke the stored Google Calendar connection | Guardian |
| GET | `/api/gcal/events` | List calendar events for a date range; query `?start=` `?end=` | Guardian |
| POST | `/api/gcal/events` | Create a calendar event (shift or blocked time) | Guardian |
| PUT | `/api/gcal/events/:eventId` | Update an existing calendar event | Guardian |
| DELETE | `/api/gcal/events/:eventId` | Delete a calendar event | Guardian |
| GET | `/api/gcal/health` | Check whether the stored Google token is still valid | Any |

### Settings, Blocked Times, and Invites — `/api`

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/settings` | Get all settings as a key-value map | Guardian |
| PUT | `/api/settings` | Upsert one or more settings by key | Guardian |
| GET | `/api/rates` | Get FK hourly rate and employer tax rate (from env vars) | Guardian |
| GET | `/api/blocked` | List blocked time slots | Guardian |
| POST | `/api/blocked` | Create a blocked time slot | Guardian |
| DELETE | `/api/blocked/:id` | Delete a blocked time slot | Guardian |
| GET | `/api/invites` | List all assistant invites | Guardian |
| POST | `/api/invites` | Create and send an assistant invite | Guardian |
| PUT | `/api/invites/:id` | Update invite status | Guardian |
| DELETE | `/api/invites/:id` | Delete an invite | Guardian |

### Guardian-Assistant Links — `/api/guardian-links`

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/guardian-links` | List all guardian-assistant links for the authenticated guardian | Guardian |
| POST | `/api/guardian-links` | Create a new (inactive) guardian-assistant link | Guardian |
| GET | `/api/guardian-links/my-families` | List active links for the authenticated assistant | Assistant |
| POST | `/api/guardian-links/:id/accept` | Assistant accepts a link request (activates it) | Assistant |

### Health Check

| Method | Path | Description | Auth Required |
|---|---|---|---|
| GET | `/api/health` | Server health check — returns `{ ok: true, ts: "<ISO timestamp>" }` | No |

---

## Request and Response Formats

All request and response bodies use JSON. Set `Content-Type: application/json` on write operations.

### Login

```json
// POST /api/auth/login
// Request
{
  "email": "guardian@example.com",
  "password": "mypassword"
}

// Response 200
{
  "token": "<jwt>",
  "userId": 1,
  "role": "guardian",
  "assistantId": null
}
```

### Create a shift entry

```json
// POST /api/entries
// Request
{
  "assistantId": "a_abc123",
  "date": "2026-04-01",
  "startTime": "08:00",
  "endTime": "16:00",
  "hours": 8,
  "entryType": "active",
  "reqStatus": "pending",
  "repStatus": "draft",
  "source": "proposal"
}

// Response 201
{
  "id": "e_xyz789",
  "assistantId": "a_abc123",
  "date": "2026-04-01",
  "startTime": "08:00",
  "endTime": "16:00",
  "hours": 8,
  "entryType": "active",
  "reqStatus": "pending",
  "repStatus": "draft",
  "source": "proposal",
  "calStatus": null,
  "activityId": null,
  "gcalEventId": null,
  "verified": false,
  "updatedAt": "2026-04-30T10:00:00.000Z"
}
```

### Create an absence

```json
// POST /api/absences
// Request
{
  "assistantId": "a_abc123",
  "absenceType": "sjukfrånvaro",
  "startDate": "2026-04-10",
  "endDate": "2026-04-12"
}

// Response 201
{
  "id": "ab_001",
  "guardianId": 1,
  "assistantId": "a_abc123",
  "absenceType": "sjukfrånvaro",
  "startDate": "2026-04-10",
  "endDate": "2026-04-12"
}
```

Valid `absenceType` values: `"sjukfrånvaro"`, `"vab"`, `"semester"`, `"other"`.

### Generate payroll

```json
// POST /api/payroll/generate
// Request
{ "month": "2026-04" }

// Response 201 — array of payroll records
[
  {
    "id": "pr_001",
    "assistantId": "a_abc123",
    "month": "2026-04",
    "billableHours": 120.5,
    "hourlyRateSnapshot": 334,
    "taxRateSnapshot": 0.3142,
    "prelimTaxRateSnapshot": 0,
    "grossPay": 40247,
    "employerContributions": 12641.6,
    "totalEmployerCost": 52888.6,
    "absenceBreakdownJson": "{\"sjukfrånvaro\":0,\"vab\":0,\"semester\":0,\"other\":0}",
    "status": "draft",
    "approvedAt": null
  }
]
```

### Record a payment

```json
// POST /api/payments
// Request
{
  "payrollRecordId": "pr_001",
  "assistantId": "a_abc123",
  "date": "2026-05-25",
  "amountSek": 40247,
  "method": "bankgiro"
}
```

Valid `method` values: `"bankgiro"`, `"swish"`, `"kontant"`.

---

## Error Codes

All error responses use the shape `{ "error": "<message>" }`. Some responses also include a `code` field for machine-readable handling.

| HTTP Status | Meaning |
|---|---|
| 400 | Bad request — missing or invalid field |
| 401 | Unauthorized — missing, expired, or invalid JWT |
| 403 | Forbidden — insufficient role or no active guardian-assistant link |
| 404 | Not found — resource does not exist (or belongs to another account) |
| 409 | Conflict — duplicate record, or invalid state transition |
| 500 | Internal server error |

### Notable machine-readable `code` values

| Code | Endpoint | Meaning |
|---|---|---|
| `EMAIL_NOT_VERIFIED` | `POST /api/auth/login` | Account exists but email has not been verified |
| `NO_ACCOUNT` | `POST /api/assistants/link-existing` | No assistant account found with the given email |

---

## Rate Limits

No rate limiting middleware is configured in the application code. Deployments behind a reverse proxy or cloud platform may enforce their own limits. <!-- VERIFY: whether the production deployment (e.g., Fly.io, Railway, or Nginx) applies external rate limiting -->

---

## PDF Endpoints — Additional Notes

PDF endpoints return a binary PDF file with `Content-Type: application/pdf` and a `Content-Disposition: attachment` header rather than JSON. They require the corresponding FK form files to be present in the `forms/` directory at the project root:

- `forms/fk3057.pdf` — FK 3057 Räkning
- `forms/fk3059.pdf` — FK 3059 Tidsredovisning
- `forms/skv4805.pdf` — SKV 4805 Förenklad arbetsgivardeklaration

The `/api/pdf/4805` and `/api/pdf/lonespec` endpoints additionally require the payroll record for the requested month to have status `"approved"` before they will generate a PDF. An unapproved record returns `409 Conflict`.

The `/api/pdf/lonespec` endpoint returns `400` if the assistant's `hourlyRateOverride` is `NULL`; the rate must be set in the assistant record before a salary slip can be generated.

---

## Google Calendar — OAuth Flow

1. The guardian navigates to `GET /api/gcal/connect` (can pass the JWT as a `?token=` query parameter instead of an `Authorization` header, since this is a browser redirect).
2. The server redirects the browser to Google's OAuth consent screen.
3. Google redirects back to `GET /api/gcal/callback?code=...`.
4. The server exchanges the code for tokens and stores them in the `settings` table under keys `gcal_access_token`, `gcal_refresh_token`, etc.
5. Subsequent calendar operations use the stored refresh token, which is auto-refreshed as needed.

<!-- VERIFY: GOOGLE_REDIRECT_URI value configured for the production deployment -->
