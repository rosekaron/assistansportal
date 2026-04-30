<!-- generated-by: gsd-doc-writer -->
# Getting Started

This guide covers everything a new developer needs to go from zero to a running local instance of Assistansportal.

---

## Prerequisites

The following tools must be installed before proceeding:

| Tool | Version | Purpose |
|---|---|---|
| Node.js | `>= 22` (dev container base image uses 22) | Runs both the API server and the Vite dev server |
| npm | `>= 10` | Package management |
| Docker | Any recent version | Runs the PostgreSQL 16 database |
| Docker Compose | v2 (bundled with Docker Desktop) | Manages the `postgres` service |
| qpdf | Any recent version | PDF encryption for generated FK forms (macOS: `brew install qpdf`) |

> **Dev Container alternative:** If you use VS Code or a Devcontainer-compatible IDE, the included `.devcontainer/` configuration handles Node.js 22, Playwright dependencies, and the PostgreSQL service automatically. Run `npm run devcontainer:up` from the project root to start it.

---

## Installation Steps

1. Clone the repository:

```bash
git clone https://github.com/rosekaron/assistansportal.git
cd assistansportal
```

2. Install root, server, and client dependencies:

```bash
npm install
cd server && npm install && cd ..
cd client && npm install && cd ..
```

3. Copy the environment sample and configure required values:

```bash
cp .env.sample server/.env
```

Open `server/.env` and set at minimum:

```
DATABASE_URL=postgres://assistans:assistans_local@localhost:5432/assistansportal
JWT_SECRET=replace-with-a-long-random-string-minimum-32-chars
```

The server will refuse to start if `JWT_SECRET` is missing or left as `dev_secret`.

For a full description of every available variable see [docs/CONFIGURATION.md](CONFIGURATION.md).

---

## First Run

1. Start the PostgreSQL database (runs in the background via Docker):

```bash
docker compose up -d
```

2. Push the Drizzle schema to the database (run once after cloning, and again after any schema change):

```bash
cd server && npm run db:push && cd ..
```

3. Start both the API server and the React client in one command:

```bash
npm run dev
```

You should see output confirming both processes are running. Open:

- Frontend: `http://localhost:5173`
- API server: `http://localhost:3001`
- Health check: `http://localhost:3001/api/health`

---

## Common Setup Issues

**`FATAL: JWT_SECRET not set` on server startup**
The server performs a startup guard that aborts immediately if `JWT_SECRET` is missing or set to the insecure string `dev_secret`. Ensure `server/.env` exists and contains a real secret value (minimum 32 random characters).

**`ECONNREFUSED` when connecting to PostgreSQL**
The database container is not running. Run `docker compose up -d` from the project root and wait a few seconds for Postgres to become ready before retrying `db:push` or `npm run dev`.

**`qpdf: command not found` when generating PDF forms**
The PDF encryption step requires `qpdf` on the system PATH. On macOS install it with `brew install qpdf`. The server automatically prepends `/opt/homebrew/bin` to `PATH` at startup, so a Homebrew install is sufficient.

**Port 5432 already in use**
Another PostgreSQL instance is running locally. Either stop it (`brew services stop postgresql@16`) or change the host port mapping in `docker-compose.yml` and update `DATABASE_URL` in `server/.env` accordingly.

**Client cannot reach the API (CORS errors in browser)**
The `CLIENT_URL` variable in `server/.env` must match the origin of the Vite dev server. The default `http://localhost:5173` is correct for local development. If you changed the Vite port, update `CLIENT_URL` to match.

---

## Next Steps

Once the application is running:

- See [docs/ARCHITECTURE.md](ARCHITECTURE.md) for a technical overview of the system components and data flow.
- See [docs/CONFIGURATION.md](CONFIGURATION.md) for the full list of environment variables and their defaults.
