<!-- generated-by: gsd-doc-writer -->
# Deployment

This document covers how to deploy Assistansportal, including build steps, environment configuration, database migration, and operational considerations.

---

## Deployment Targets

The project ships no cloud-platform config files (`vercel.json`, `netlify.toml`, `fly.toml`, etc.). Deployment is container-based using Docker Compose. Two container configurations are present:

| Config file | Purpose |
|---|---|
| `docker-compose.yml` (project root) | PostgreSQL 16 service for all environments |
| `.devcontainer/docker-compose.yml` | VS Code Dev Container workspace overlay |
| `.devcontainer/Dockerfile` | Dev Container image (`javascript-node:dev-22-bookworm` + Playwright deps) |

There is no CI/CD pipeline configured. Deployment is performed manually. <!-- VERIFY: whether a CI/CD pipeline has been added to a hosting platform since this doc was generated -->

---

## Build Pipeline

### 1. Build the server

```bash
cd server
npm ci
npm run build
```

TypeScript is compiled from `server/src/` to `server/dist/` using `tsc`. The compiled entry point is `server/dist/index.js`.

### 2. Build the client

```bash
cd client
npm ci
npm run build
```

Vite compiles and bundles the React SPA to `client/dist/`. The output is a set of static files ready to be served by any static file host or reverse proxy.

### 3. Apply database migrations

```bash
cd server
npm run db:push
```

Drizzle Kit reads `DATABASE_URL` from the environment and pushes the current schema directly to the database. Migration SQL files are located in `server/drizzle/`.

### 4. Start the server

```bash
cd server
NODE_ENV=production node dist/index.js
```

The server listens on `PORT` (default `3001`). Serve the `client/dist/` static files from a reverse proxy (e.g., nginx) and proxy `/api/*` requests to `http://localhost:3001`.

---

## Environment Setup

All required and optional environment variables are documented in detail in [CONFIGURATION.md](CONFIGURATION.md). The following are the variables that must be set for a production deployment.

### Required (server will not start without these)

| Variable | Notes |
|---|---|
| `JWT_SECRET` | Must be a random string of at least 32 characters. The server calls `process.exit(1)` if this is missing or equals `dev_secret`. |
| `DATABASE_URL` | PostgreSQL connection string pointing at the production database. |

### Required for full functionality

| Variable | Notes |
|---|---|
| `CLIENT_URL` | Set to the public HTTPS URL of the frontend. Used by CORS, email links, and Google OAuth redirects. <!-- VERIFY: production CLIENT_URL value --> |
| `NODE_ENV` | Set to `production` to disable the dev-only `/api/auth/dev-verify` endpoint. |
| `GMAIL_USER` | Gmail address for transactional email. If unset, all email is silently skipped. |
| `GMAIL_APP_PASSWORD` | Gmail App Password for the account above. |
| `GOOGLE_CLIENT_ID` | Required only if Google Calendar integration is enabled. |
| `GOOGLE_CLIENT_SECRET` | Required only if Google Calendar integration is enabled. |
| `GOOGLE_REDIRECT_URI` | Must match the redirect URI registered in Google Cloud Console. <!-- VERIFY: production redirect URI value --> |

### Optional with defaults

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3001` | TCP port for the Express server. |
| `FK_HOURLY_RATE` | `334` | FK hourly reimbursement rate in SEK. Update annually. |
| `EMPLOYER_TAX_RATE` | `0.3142` | Swedish employer social-contribution rate. |

### System dependency: qpdf

The PDF encryption feature requires `qpdf` to be available in `PATH`. On production Linux hosts, install it via the system package manager:

```bash
apt-get install -y qpdf   # Debian / Ubuntu
```

The server prepends `/opt/homebrew/bin` to `PATH` on startup, which is the macOS Homebrew install location. On Linux this has no effect, so `qpdf` must be installed globally or its directory added to `PATH` by the process supervisor.

---

## Database

The project uses PostgreSQL 16. For local development, the database runs in Docker Compose (`docker-compose.yml`). For production, any PostgreSQL 16-compatible server is supported.

### Run Docker Compose (local / staging)

```bash
docker compose up -d
```

This starts the `assistansportal_db` container with the following credentials:

| Setting | Value |
|---|---|
| Database | `assistansportal` |
| Username | `assistans` |
| Password | `assistans_local` |
| Port | `5432` |
| Data volume | `pgdata` (named Docker volume, persists across restarts) |

### Apply schema

After the database is running and `DATABASE_URL` is set, push the schema:

```bash
cd server && npm run db:push
```

On first startup, the server's `seedDefaults()` function automatically inserts the initial `profile` row and default `settings` keys.

### Inspect data (development only)

```bash
cd server && npm run db:studio
```

Opens Drizzle Studio, a browser-based data viewer, connected to `DATABASE_URL`.

---

## Rollback Procedure

There is no automated rollback mechanism in the repository. <!-- VERIFY: whether a deployment platform with built-in rollback has been configured -->

General approach:

1. Identify the last known-good release (git tag or commit SHA).
2. Check out that commit and repeat the build steps above.
3. Redeploy the compiled `server/dist/` and `client/dist/` artifacts.
4. If the schema was changed, review the Drizzle migration files in `server/drizzle/` and apply a compensating migration manually, or restore from a database backup.

Database backups should be taken before applying any migration in production. <!-- VERIFY: backup strategy and schedule for the production database -->

---

## Monitoring

No monitoring or error-reporting library (`@sentry/*`, `dd-trace`, `@opentelemetry/*`) was detected in `package.json`. <!-- VERIFY: whether application-level monitoring has been added -->

The server exposes a health check endpoint that can be used by an external uptime monitor or load balancer:

```
GET /api/health
```

Response:

```json
{ "ok": true, "ts": "2026-04-30T10:00:00.000Z" }
```

Server startup logs report the listening port and the PostgreSQL host:

```
Server running → http://localhost:3001
Postgres       → localhost:5432
Cron          → compliance reminder job started
```

<!-- VERIFY: whether a log aggregation service (e.g., Loki, Papertrail, Logtail) is in use for the production deployment -->
