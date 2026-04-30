<!-- generated-by: gsd-doc-writer -->
# Configuration

This document covers all environment variables, configuration files, and per-environment settings for Assistansportal.

---

## Environment Variables

The canonical list of environment variables lives in `.env.sample` at the project root. Copy it to create your local configuration:

```bash
cp .env.sample server/.env
```

The server reads its `.env` file via `dotenv` at startup. The client (Vite) uses no `.env` file — all runtime configuration is provided by the API server.

| Variable | Required | Default | Description |
|---|---|---|---|
| `JWT_SECRET` | **Required** | — | Secret key used to sign and verify JSON Web Tokens. Must be a random string of at least 32 characters. The server refuses to start if this is missing or set to `dev_secret`. |
| `DATABASE_URL` | **Required** | — | PostgreSQL connection string. Format: `postgres://user:password@host:port/dbname`. Used by Drizzle ORM and `drizzle-kit`. |
| `NODE_ENV` | Optional | `development` | Runtime environment. Set to `production` to disable the dev-only `/api/auth/dev-verify` endpoint and the `devVerifyToken` field in registration responses. |
| `PORT` | Optional | `3001` | TCP port the Express server listens on. |
| `CLIENT_URL` | Optional | `http://localhost:5173` | Base URL of the React client. Used by CORS configuration, email verification links, password-reset links, and Google Calendar OAuth redirect targets. |
| `FK_HOURLY_RATE` | Optional | `334` | Swedish Försäkringskassan hourly reimbursement rate (SEK). Exposed via `GET /api/rates` and used in payroll calculations. Update when FK publishes a new rate. |
| `EMPLOYER_TAX_RATE` | Optional | `0.3142` | Swedish employer social-contribution rate as a decimal (default 31.42%). Used in payroll and lön calculations. |
| `GMAIL_USER` | Optional | — | Gmail address used as the sender for transactional email (verification, password reset, invite, compliance reminder). If unset, email sending is skipped silently. |
| `GMAIL_APP_PASSWORD` | Optional | — | Gmail App Password (not the account password) for the `GMAIL_USER` account. Generate this in Google Account → Security → App Passwords. |
| `GOOGLE_CLIENT_ID` | Optional | — | OAuth 2.0 client ID for Google Calendar integration. Obtain from Google Cloud Console. |
| `GOOGLE_CLIENT_SECRET` | Optional | — | OAuth 2.0 client secret for Google Calendar integration. |
| `GOOGLE_REDIRECT_URI` | Optional | `http://localhost:3001/api/gcal/callback` | Authorized redirect URI registered in Google Cloud Console for the OAuth flow. Must match exactly what is registered in your Google project. |
| `NODE_PASSWORD` | Optional | — | Password for the `node` system user inside the Dev Container. Used only by the devcontainer `postStartCommand.sh` script. Has no effect outside Docker. |

---

## Required vs Optional Settings

### Startup-blocking requirements

The server performs a startup guard in `server/src/index.ts`. It calls `process.exit(1)` with a fatal error message if either condition is true:

- `JWT_SECRET` is not set
- `JWT_SECRET` equals the insecure placeholder value `dev_secret`

All other variables have safe fallback defaults and will not block startup.

### Minimum working configuration

To run the server locally without email or Google Calendar features:

```
DATABASE_URL=postgres://assistans:assistans_local@localhost:5432/assistansportal
JWT_SECRET=<random-32-char-string>
```

---

## Defaults

Variables with hardcoded fallback values in source:

| Variable | Default value | Set in |
|---|---|---|
| `PORT` | `3001` | `server/src/index.ts` |
| `CLIENT_URL` | `http://localhost:5173` | `server/src/index.ts`, `server/src/lib/email.ts` |
| `FK_HOURLY_RATE` | `334` | `server/src/routes/misc.ts`, `server/src/routes/payroll.ts` |
| `EMPLOYER_TAX_RATE` | `0.3142` | `server/src/routes/misc.ts`, `server/src/routes/payroll.ts` |
| `JWT_SECRET` (auth middleware fallback) | `dev_secret` | `server/src/middleware/auth.ts` — **never use this in production** |
| `GOOGLE_REDIRECT_URI` | `http://localhost:3001/api/gcal/callback` | implied by Google OAuth setup |

---

## Config File Format

### `.env.sample` (project root)

The sample file documents the development defaults:

```dotenv
NODE_PASSWORD=node
DATABASE_URL=postgres://assistans:assistans_local@postgres:5432/assistansportal
JWT_SECRET=replace-with-a-long-random-string-minimum-32-chars
FK_HOURLY_RATE=334
EMPLOYER_TAX_RATE=0.3142
NODE_ENV=development
PORT=3001
CLIENT_URL=http://localhost:5173
```

Note: the `DATABASE_URL` host in `.env.sample` is `postgres` (the Docker Compose service name). When running outside Docker, use `localhost` instead — the `server/.env` file uses `localhost` for direct local development.

### `server/drizzle.config.ts`

Drizzle Kit reads `DATABASE_URL` from the environment to run migrations:

```typescript
export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
}
```

### `client/vite.config.ts`

The Vite dev server proxies all `/api` requests to `http://localhost:3001`, so the client requires no environment variables of its own:

```typescript
server: {
  port: 5173,
  proxy: {
    "/api": { target: "http://localhost:3001", changeOrigin: true },
  },
},
```

---

## Per-Environment Overrides

There are no `.env.development` or `.env.production` files in the repository. Environment-specific values are managed by creating the appropriate `.env` file directly:

| Context | File to create | Notable differences |
|---|---|---|
| Local dev (native) | `server/.env` | `DATABASE_URL` host = `localhost` |
| Local dev (Docker / devcontainer) | `server/.env` or root `.env` | `DATABASE_URL` host = `postgres` (Compose service name) |
| Production | Set via deployment platform secrets <!-- VERIFY: deployment platform secret manager name and process --> | `NODE_ENV=production`, strong `JWT_SECRET`, real `CLIENT_URL`, Gmail credentials |

The only code path that branches on `NODE_ENV` is in `server/src/routes/auth.ts`: when `NODE_ENV === "production"`, the `/api/auth/dev-verify` endpoint returns 404 and the registration response omits the `devVerifyToken` field.

---

## Database Configuration (Docker Compose)

The `docker-compose.yml` at the project root defines the local PostgreSQL service. Its credentials must match `DATABASE_URL`:

| Setting | Value |
|---|---|
| Image | `postgres:16-alpine` |
| Container name | `assistansportal_db` |
| Database | `assistansportal` |
| Username | `assistans` |
| Password | `assistans_local` |
| Host port | `5432` |
| Data volume | `pgdata` (named Docker volume) |

---

## Application-Level Settings (Database-Stored)

Beyond environment variables, the application stores a small number of operational settings in the `settings` database table. These are managed through the guardian UI and the `PUT /api/settings` endpoint. Known keys include:

| Key | Description |
|---|---|
| `guardian_name` | Display name of the legal guardian / employer |
| `patient_name` | Name of the care recipient |
| `reminder_day` | Day of the month (1–28) when the monthly compliance reminder email is sent |

`reminder_day` is validated server-side; values outside `1–28` are rejected with HTTP 400.
