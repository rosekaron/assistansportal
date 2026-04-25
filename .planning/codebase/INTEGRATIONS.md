# External Integrations

**Analysis Date:** 2026-04-06

## APIs & External Services

**Google Calendar:**
- Service: Google Calendar API v3 + Google OAuth2
- SDK/Client: `googleapis` 140.0.1 (`server/src/routes/gcal.ts`)
- Auth: OAuth2 Authorization Code flow with offline access (refresh tokens)
- Env vars: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`
- Scopes requested: `calendar`, `calendar.events`, `userinfo.email`
- Tokens stored: `gcal_access_token`, `gcal_refresh_token`, `gcal_token_expiry` saved to the `settings` DB table
- Features: create, patch, delete, list events; send attendee invites via `sendUpdates: "all"`
- Timezone: events created with `Europe/Stockholm`

**Gmail (SMTP via Nodemailer):**
- Service: Gmail SMTP
- SDK/Client: `nodemailer` 6.9.13 (`server/src/lib/email.ts`)
- Auth: Gmail App Password (not OAuth)
- Env vars: `GMAIL_USER`, `GMAIL_APP_PASSWORD`
- Emails sent:
  - Account email verification (`sendVerificationEmail`) — token valid 24 hours
  - Password reset (`sendPasswordResetEmail`) — token valid 1 hour
  - Assistant invite (`sendAssistantInviteEmail`) — token valid 7 days

## Data Storage

**Databases:**
- Type/Provider: PostgreSQL 16 (via Docker in development: `docker-compose.yml`)
- Connection: `DATABASE_URL` env var (e.g. `postgres://user:pass@host:5432/db`)
- Client: Drizzle ORM (`drizzle-orm/node-postgres`) with `pg` pool (`server/src/db/index.ts`)
- Schema defined in: `server/src/db/schema.ts`
- Tables: `profile`, `auth`, `email_verifications`, `password_resets`, `assistants`, `entries`, `open_slots`, `blocked`, `invites`, `costs`, `settings`
- Migrations/push: `drizzle-kit push` (dev), `drizzle-kit generate` (migrations)

**File Storage:**
- Local filesystem only — uploaded files go to `uploads/` directory at project root
- Multer configured for multipart uploads (`server/` — `multer` package present)
- PDF forms stored in `forms/` directory at project root; served statically at `/forms` (`server/src/index.ts`)

**Caching:**
- None detected

## Authentication & Identity

**Auth Provider:**
- Custom — email + password, managed entirely within the application
- Implementation:
  - Registration: bcrypt (cost 12) password hashing, email verification token flow
  - Login: compares bcrypt hash, issues a signed JWT
  - JWT: signed with `JWT_SECRET` env var (falls back to `"dev_secret"` if not set)
  - Token placed in `Authorization: Bearer <token>` header by client (`client/src/lib/api.ts`)
  - Token also persisted in `localStorage` via Zustand persist middleware (`client/src/store/auth.ts`)
  - Roles: `guardian` (admin) and `assistant` (limited self-service access)
  - Middleware: `requireAuth`, `requireGuardian`, `requireAssistant` in `server/src/middleware/auth.ts`
  - Email verification tokens: stored in `email_verifications` table, 24-hour expiry
  - Password reset tokens: stored in `password_resets` table, 1-hour expiry, single-use (`used` flag)
  - Assistant invite tokens: generated via `crypto.randomBytes`, 7-day expiry

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Datadog, or similar integration detected

**Logs:**
- `console.log` / `console.error` / `console.warn` throughout server code
- No structured logging framework

## CI/CD & Deployment

**Hosting:**
- Not configured — no deployment manifests, Procfiles, or platform-specific config detected

**CI Pipeline:**
- None detected — no GitHub Actions, CircleCI, or similar workflows present

**Dev Container:**
- Dev environment uses VS Code Dev Containers (`.devcontainer/`)
- Workspace image: `mcr.microsoft.com/devcontainers/javascript-node:dev-22-bookworm`
- Anthropic Claude Code feature installed: `ghcr.io/anthropics/devcontainer-features/claude-code:1.0`
- Postgres service auto-started via devcontainer `runServices: ["postgres"]`

## Environment Configuration

**Required env vars (server):**
- `DATABASE_URL` — PostgreSQL connection string
- `JWT_SECRET` — JWT signing secret (defaults to insecure `"dev_secret"` if missing)
- `GMAIL_USER` — Gmail address for transactional email
- `GMAIL_APP_PASSWORD` — Gmail App Password for SMTP auth
- `GOOGLE_CLIENT_ID` — Google OAuth2 client ID (Google Calendar)
- `GOOGLE_CLIENT_SECRET` — Google OAuth2 client secret
- `GOOGLE_REDIRECT_URI` — OAuth2 callback URL (e.g. `http://localhost:3001/api/gcal/callback`)
- `CLIENT_URL` — Frontend URL for CORS and email links (defaults to `http://localhost:5173`)
- `PORT` — Server port (defaults to `3001`)

**Secrets location:**
- `server/.env` (not committed; `.env.sample` at root contains example with DB vars only)
- `.env` at root used by devcontainer workspace

## Webhooks & Callbacks

**Incoming:**
- `GET /api/gcal/callback` — Google OAuth2 redirect callback after user grants Calendar access (`server/src/routes/gcal.ts`)
- `GET /api/auth/verify-email` — Email verification link callback from verification emails (`server/src/routes/auth.ts`)

**Outgoing:**
- None — no outgoing webhooks to external services

---

*Integration audit: 2026-04-06*
