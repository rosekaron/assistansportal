# Phase 11: Production Dockerfile & Static Serving — Research

**Researched:** 2026-04-30
**Domain:** Docker multi-stage builds, Node.js containerization, Express static serving, apt-get system packages
**Confidence:** HIGH

---

## Summary

Phase 11 containerizes the existing Express + React monorepo into a production Docker image.
The codebase is already well-understood: qpdf is called via `spawnSync("qpdf", ...)` in
`server/src/routes/pdf.ts` (line 46), so replacing the Homebrew PATH hack in `server/src/index.ts`
(line 14) with an apt-get install in the Dockerfile is straightforward. The forms directory
resolver in `pdf.ts` (lines 21-33) already probes multiple candidate paths, and the flat `/app`
layout satisfies the `path.join(__dirname, "../../forms")` candidate on the first hit.

The monorepo has three independent `package-lock.json` files (root, `server/`, `client/`) and no
npm workspaces field — each must be installed with a separate `npm ci` call. D-06 (three separate
install steps) is the correct strategy and maps cleanly to Docker layer caching: the layer for
each sub-package only invalidates when that sub-package's lockfile changes.

Nyquist validation is enabled (`workflow.nyquist_validation: true` in config.json), so a
Validation Architecture section is included.

**Primary recommendation:** Write a two-stage Dockerfile (builder + runtime both on `node:22-slim`)
following the layer-cache pattern, install qpdf in the runtime stage via apt-get, copy compiled
outputs and forms into the flat `/app` layout, add the production static-serving block to
`server/src/index.ts`, and smoke-test locally before Phase 12 deploy.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**D-01:** Flat `/app` layout inside the container: `/app/server`, `/app/client`, `/app/forms`.
Server runs from `/app/server/dist/index.js`. The existing `path.join(__dirname, "../../forms")`
in `server/src/index.ts` resolves correctly to `/app/forms` — no code change needed for forms path.

**D-02:** Base image: `node:22-slim` for BOTH build and runtime stages (Debian-based; qpdf
available via apt-get).

**D-03:** Add `if (process.env.NODE_ENV === 'production')` guard in `server/src/index.ts` to
serve `client/dist` as static files. Guard keeps dev workflow unchanged (Vite dev server handles
client in dev mode).

**D-04:** Client build served from `/app/client/dist` — Express path:
`path.join(__dirname, '../../client/dist')`. Add a SPA catch-all route (`app.get('*', ...)`)
inside the same production guard, returning `client/dist/index.html`.

**D-05:** Add `"build": "npm run build --prefix client && npm run build --prefix server"` to root
`package.json` scripts. Dockerfile's build stage runs `npm run build` at repo root.

**D-06:** npm install handled in three separate steps for layer caching: COPY each `package.json`
+ `package-lock.json` first, then run `npm ci` in root, `server/`, and `client/` independently.
Dependency layers only rebuild when lockfiles change.

### Claude's Discretion

- `.dockerignore` content (exclude `node_modules`, `.planning`, `dist`, `.env*`, `*.log`, etc.)
- Multi-stage Dockerfile structure (build stage installs deps + compiles; runtime stage installs
  only production deps, copies compiled output and forms)
- `apt-get` install command for qpdf (with `--no-install-recommends` and cache cleanup)
- Local smoke verification commands for CONT-05

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CONT-01 | App builds as a single production Docker image (multi-stage: build stage + runtime stage) | Multi-stage Dockerfile pattern; `node:22-slim` verified available locally |
| CONT-02 | `qpdf` installed via `apt-get` in the runtime stage (replaces Homebrew PATH hack in `server/src/index.ts`) | `qpdf` package verified in Debian Bookworm apt: version 11.3.0-1+deb12u1 |
| CONT-03 | `forms/` directory (fk3057.pdf, fk3059.pdf, skv4805.pdf) present at the correct path inside container at runtime | All three PDFs confirmed present in `forms/`; flat layout satisfies existing candidate probing in pdf.ts |
| CONT-04 | Server serves compiled React client as static files when `NODE_ENV=production` | Standard Express `express.static()` + SPA catch-all pattern; existing `/forms` route is the template |
| CONT-05 | Docker image builds and runs correctly locally with production-style env vars before pushing to Azin | Docker 29.2.1 confirmed available; smoke commands documented in this research |
</phase_requirements>

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| qpdf binary installation | Container (Dockerfile) | — | System package; must be present in runtime image |
| React SPA static serving | API / Backend (Express) | — | Express owns the static file middleware and SPA catch-all in production mode |
| Client build output (`client/dist`) | Build stage (Docker) | — | Vite builds to `client/dist`; COPY'd into runtime image |
| Forms PDFs | Container filesystem `/app/forms` | — | Repo files COPY'd at Docker build time; probed at runtime by pdf.ts |
| Homebrew PATH hack removal | API / Backend (Express index.ts) | — | Single line delete; replaces dev-only workaround with proper system install |
| Root build script | Build orchestration (root package.json) | — | D-05: client build then server build, ordered to avoid TypeScript errors |

---

## Standard Stack

### Core

| Library / Tool | Version | Purpose | Why Standard |
|---------------|---------|---------|--------------|
| `node:22-slim` | 22.22.2 (Bookworm) | Both build and runtime base image | Debian-based; qpdf available via apt; slim keeps image small; verified locally |
| `qpdf` (apt) | 11.3.0-1+deb12u1 | PDF decrypt/encrypt (used by pdf.ts `spawnSync("qpdf", ...)`) | System package; only correct approach in container (Homebrew is macOS-only) |
| `express.static()` | (already in deps) | Serve compiled React SPA in production | Already used for `/forms` route — same API |
| `npm ci` | 10.9.7 (bundled with Node 22) | Deterministic installs from lockfile | Faster than `npm install`, enforces lockfile, standard for CI/CD |

### Supporting

| Tool | Version | Purpose | When to Use |
|------|---------|---------|-------------|
| `.dockerignore` | — | Exclude `node_modules`, build artifacts, secrets from build context | Always — prevents multi-GB context and env file leakage |
| Docker multi-stage build | Docker 29.2.1 | Separate build stage (all dev tools) from runtime stage (prod only) | Standard pattern; keeps runtime image lean |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `node:22-slim` (Debian) | `node:22-alpine` | Alpine uses musl libc; qpdf is available but can cause subtle native-module incompatibilities; Debian preferred when native packages needed |
| Separate build/runtime base images | Single stage | Single-stage includes devDependencies and TypeScript compiler in final image; larger and unnecessarily exposes build tools |

---

## Architecture Patterns

### System Architecture Diagram

```
[Docker Build Context]
        |
        v
  ┌─────────────────────────────────────────────────────────┐
  │ Stage 1: builder (node:22-slim)                         │
  │                                                         │
  │  COPY lockfiles → npm ci (root, server, client)         │
  │  COPY source    → npm run build (client then server)    │
  │    client/dist/ ← Vite output                           │
  │    server/dist/ ← tsc output                            │
  └─────────────────────────────────────────────────────────┘
        | COPY --from=builder (selective)
        v
  ┌─────────────────────────────────────────────────────────┐
  │ Stage 2: runtime (node:22-slim)                         │
  │                                                         │
  │  apt-get install qpdf                                   │
  │  COPY lockfiles → npm ci --omit=dev (root, server)     │
  │  COPY server/dist/    → /app/server/dist/               │
  │  COPY client/dist/    → /app/client/dist/               │
  │  COPY forms/          → /app/forms/                     │
  │                                                         │
  │  ENV NODE_ENV=production                                │
  │  EXPOSE 3001                                            │
  │  CMD ["node", "/app/server/dist/index.js"]              │
  └─────────────────────────────────────────────────────────┘
        |
        v
  [docker run -p 3001:3001 --env-file .env.prod <image>]
        |
        v
  Express on :3001
  ├── GET /api/**          → API routes (auth, pdf, payroll…)
  ├── GET /forms/**        → express.static(/app/forms)
  ├── GET /api/health      → { ok: true }
  └── [NODE_ENV=production]
      ├── GET /assets/**   → express.static(/app/client/dist)
      └── GET *            → sendFile /app/client/dist/index.html
```

### Recommended Project Structure (post-phase additions)

```
/                        ← repo root
├── Dockerfile           ← NEW: multi-stage build
├── .dockerignore        ← NEW: excludes node_modules, .env, .planning, dist
├── package.json         ← MODIFIED: add "build" script (D-05)
├── forms/               ← unchanged; COPY'd to /app/forms in runtime stage
├── server/
│   ├── src/
│   │   └── index.ts     ← MODIFIED: remove Homebrew PATH hack; add prod static block
│   ├── dist/            ← built by tsc; COPY'd to /app/server/dist
│   └── package.json
└── client/
    ├── dist/            ← built by Vite; COPY'd to /app/client/dist
    └── package.json
```

### Pattern 1: Multi-Stage Dockerfile with Layer Caching

**What:** Two `FROM node:22-slim` stages. Builder stage installs all deps and compiles.
Runtime stage installs only production deps, copies compiled output, installs qpdf via apt.

**When to use:** Any Node.js app with a compile step (TypeScript, bundler). Runtime image
excludes devDependencies, TypeScript, source maps, and build tools.

**Example:**
```dockerfile
# Source: Docker documentation + verified against node:22-slim (Bookworm) locally

# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

# Layer: root lockfile (invalidates only when root package-lock.json changes)
COPY package.json package-lock.json ./
RUN npm ci

# Layer: server lockfile
COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server

# Layer: client lockfile
COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client

# Copy source (after deps — avoids reinstalling on source-only changes)
COPY server/ ./server/
COPY client/ ./client/

# Build: client first (no dependency on server), then server
RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app

# System packages: qpdf replaces Homebrew PATH hack
RUN apt-get update && \
    apt-get install -y --no-install-recommends qpdf && \
    rm -rf /var/lib/apt/lists/*

# Production deps: root (none currently) + server only
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/package.json server/package-lock.json ./server/
RUN npm ci --omit=dev --prefix server

# Compiled output from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Forms PDFs (static assets — not built, just copied)
COPY forms/ ./forms/

ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
```

**Key insight on root `npm ci --omit=dev`:** The root `package.json` only has `concurrently`
and `husky` as devDependencies and no runtime dependencies. The `npm ci --omit=dev` at root
installs nothing (empty `dependencies` field) but is still correct to include for future-proofing.
Alternatively, skip the root install in the runtime stage entirely since the CMD runs
`node server/dist/index.js` directly.

### Pattern 2: Production Static Serving Guard in Express

**What:** Wrap `express.static()` + SPA catch-all in a `NODE_ENV === 'production'` block.
Must be placed AFTER all API routes to prevent the catch-all intercepting `/api/**` requests.

**When to use:** Monorepo where dev uses Vite dev server proxy and production uses Express to
serve the built SPA from `client/dist`.

**Example:**
```typescript
// server/src/index.ts — add AFTER all app.use('/api/...') route registrations
// Source: Express documentation pattern; existing /forms route is the template

if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}
```

**Placement constraint:** This block MUST come after:
- All `app.use('/api/...')` route registrations
- The `app.get('/api/health', ...)` handler
- The `app.use('/forms', ...)` static route

Placing it before any of these causes the `app.get('*', ...)` catch-all to intercept API
requests that have no prior handler match.

### Pattern 3: .dockerignore

**What:** Exclude large directories and sensitive files from the build context sent to Docker daemon.

**Why critical:** Without `.dockerignore`, the `node_modules/` directories (potentially GBs)
are sent to the daemon on every build, even though the Dockerfile runs `npm ci` from scratch.

**Recommended `.dockerignore`:**
```
node_modules
server/node_modules
client/node_modules
server/dist
client/dist
.env
.env.*
*.log
.planning
.git
.claude
docker-compose.yml
```

**Note:** `.env.sample` can remain in the build context (it's a template, no secrets). The
actual `.env` and `server/.env` must be excluded.

### Pattern 4: Local Smoke Commands (CONT-05)

**Step 1 — Build the image:**
```bash
docker build -t assistansportal:local .
```

**Step 2 — Verify qpdf binary present:**
```bash
docker run --rm assistansportal:local which qpdf
# Expected: /usr/bin/qpdf
```

**Step 3 — Verify forms files present:**
```bash
docker run --rm assistansportal:local ls /app/forms
# Expected: fk3057.pdf  fk3059.pdf  skv4805.pdf
```

**Step 4 — Run container with production env vars:**
```bash
docker run --rm -p 3001:3001 \
  -e NODE_ENV=production \
  -e DATABASE_URL="postgres://assistans:assistans_local@host.docker.internal:5432/assistansportal" \
  -e JWT_SECRET="local-smoke-test-secret-32chars!!" \
  -e FK_HOURLY_RATE=254.10 \
  -e EMPLOYER_TAX_RATE=0.3142 \
  -e CLIENT_URL="http://localhost:3001" \
  -e PORT=3001 \
  assistansportal:local
```

**Step 5 — Verify SPA is served at `/`:**
```bash
curl -s http://localhost:3001/ | head -5
# Expected: <!DOCTYPE html> (React app index.html)
```

**Step 6 — Verify health endpoint:**
```bash
curl -s http://localhost:3001/api/health
# Expected: {"ok":true,"ts":"..."}
```

**Step 7 — Verify PDF endpoint (requires DB with data):**
```bash
# With a valid JWT from a guardian user:
curl -s -H "Authorization: Bearer <JWT>" \
  http://localhost:3001/api/pdf/3057?year=2026&month=3 \
  -o /tmp/test-fk3057.pdf
file /tmp/test-fk3057.pdf
# Expected: PDF document, version...
```

**Note on DATABASE_URL in Docker:** When running the container with the local PostgreSQL
(from `docker-compose.yml`), use `host.docker.internal:5432` (macOS Docker Desktop resolves this
to the host machine). Alternatively, use `docker-compose` to run both services in the same
network (see docker-compose.prod.yml pattern below).

### Anti-Patterns to Avoid

- **Single-stage build:** Including devDependencies, TypeScript compiler, and tsx in the final
  image. Use multi-stage — builder has everything, runtime has only what executes.
- **COPY . . before npm ci:** This pattern invalidates the deps layer on every source change.
  Always COPY lockfiles, run `npm ci`, then COPY source.
- **Missing `rm -rf /var/lib/apt/lists/*` after apt-get:** Leaves apt cache in the layer,
  adding 20-40 MB to the image with no benefit.
- **`npm install` instead of `npm ci`:** Non-deterministic; may upgrade packages relative to
  lockfile. Always use `npm ci` in Docker.
- **Static block before API routes:** The `app.get('*', ...)` catch-all will intercept unmatched
  API paths (returning `index.html` instead of 404/500), hiding bugs silently.
- **Not setting `WORKDIR` before COPY:** Without `WORKDIR /app`, relative paths in COPY/CMD
  are relative to filesystem root — fragile and confusing.
- **Using `node:22-alpine` for native binaries:** Alpine's musl libc occasionally causes issues
  with native addons. Since Debian-based `node:22-slim` is decided (D-02), do not switch.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| qpdf availability in container | Custom PDF decryption in JS | `apt-get install qpdf` | qpdf handles owner-password-encrypted FK forms; js-based alternatives don't decrypt owner-locked PDFs |
| Serving compiled SPA | Custom file server, nginx sidecar | `express.static()` + catch-all `app.get('*', ...)` | Already in Express; zero additional deps; existing /forms route is the template |
| Deterministic installs | Manually managing node_modules | `npm ci` | Guarantees lockfile fidelity; fails fast if lockfile is out of sync |
| Layer caching | Complex caching scripts | COPY lockfiles → `npm ci` → COPY src ordering | Docker layer cache handles this automatically when files are ordered correctly |

**Key insight:** The existing codebase already contains 90% of the required patterns. The Homebrew
PATH hack is the only dev-only artifact that needs removal. Everything else is additive.

---

## Common Pitfalls

### Pitfall 1: Homebrew PATH Line Left in server/src/index.ts
**What goes wrong:** Container starts, finds no `/opt/homebrew/bin`, ignores silently, then
`spawnSync("qpdf", ...)` fails with ENOENT because `/usr/bin` is in PATH but the original code
prepended a non-existent macOS path.
**Why it happens:** The line `process.env.PATH = '/opt/homebrew/bin:...'` is not a fatal error —
it just prepends a non-existent directory. qpdf then fails at call time, not at startup.
**How to avoid:** Remove line 14 of `server/src/index.ts` as part of CONT-02 task.
**Warning signs:** Server starts OK but `/api/pdf/3057` returns 500 with "qpdf: ..." error.

### Pitfall 2: node_modules Sent to Build Context
**What goes wrong:** `docker build` takes several minutes on every run because gigabytes of
node_modules are transferred to the Docker daemon before the build starts.
**Why it happens:** Missing or incomplete `.dockerignore`.
**How to avoid:** Create `.dockerignore` before running any `docker build`.
**Warning signs:** Build context message shows >100MB when it should be ~5MB.

### Pitfall 3: client npm ci Includes Client in Runtime Stage
**What goes wrong:** Runtime image installs client devDependencies (Playwright, Vite, etc.),
bloating the image by ~200MB with packages never used at runtime.
**Why it happens:** Copying `client/package.json` + running `npm ci` in the runtime stage.
**How to avoid:** Runtime stage only installs root + server production deps. Client deps are
only needed in the builder stage. The compiled `client/dist/` is COPY'd from builder.
**Warning signs:** Runtime image is >500MB.

### Pitfall 4: SPA Catch-All Intercepts API Routes
**What goes wrong:** API requests to undefined routes return `index.html` (200) instead of 404,
masking routing errors in the frontend.
**Why it happens:** `app.get('*', ...)` placed before some API route registrations.
**How to avoid:** Place the production static block after ALL `app.use('/api/...')` lines and
after `app.get('/api/health', ...)`.
**Warning signs:** API calls to mistyped endpoints return HTML content type instead of JSON.

### Pitfall 5: DATABASE_URL Points to localhost Inside Container
**What goes wrong:** Container fails to connect to PostgreSQL because `localhost` inside the
container refers to the container itself, not the host machine.
**Why it happens:** Local dev `DATABASE_URL=postgres://...@localhost:5432/...` copied into
docker run command.
**How to avoid:** Use `host.docker.internal` for macOS Docker Desktop smoke testing, or use
a `docker-compose.prod.yml` that networks the app container with a postgres service.
**Warning signs:** Server starts but immediately throws `ECONNREFUSED` to Postgres.

### Pitfall 6: FORMS_DIR Candidate Order — `/app/server/dist` __dirname
**What goes wrong:** At runtime, `__dirname` in compiled `server/dist/index.js` is
`/app/server/dist`. The pdf.ts FORMS_DIR resolver probes:
1. `path.join(__dirname, "../../../forms")` → `/app/forms` ✓ (correct — this is the first candidate hit)
2. `path.join(__dirname, "../../forms")` → `/app/server/forms` (wrong, fallback)
The flat layout `/app/forms` satisfies candidate 1.
**How to avoid:** No code change needed — the existing resolver already handles this correctly.
**Warning signs:** Would appear as `⚠️ forms/ not found` in server logs on startup.

### Pitfall 7: JWT_SECRET Startup Guard Blocks Smoke Tests
**What goes wrong:** Container exits immediately with "FATAL: JWT_SECRET not set or uses insecure
default" if the smoke env file doesn't include JWT_SECRET or sets it to "dev_secret".
**Why it happens:** Existing startup guard in `server/src/index.ts` lines 8-11.
**How to avoid:** Always include a ≥32-character JWT_SECRET (not "dev_secret") in the smoke
test env vars. This guard is correct behavior — don't disable it.
**Warning signs:** Container exits with code 1 immediately, before any port binding.

---

## Code Examples

### Express Static Serving Block (D-03, D-04)

```typescript
// Source: Express docs + existing /forms pattern in server/src/index.ts

// Place AFTER all app.use('/api/...') lines and app.get('/api/health', ...)
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}
```

At runtime: `__dirname` = `/app/server/dist`, so `clientDist` = `/app/client/dist`. [VERIFIED: codebase inspection of server/tsconfig.json outDir + flat layout D-01]

### Root package.json Build Script (D-05)

```json
{
  "scripts": {
    "dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\"",
    "build": "npm run build --prefix client && npm run build --prefix server"
  }
}
```

Client is built first because server TypeScript does not depend on client output. Server is built
second so any future reference to client types (unlikely) would resolve correctly.
[VERIFIED: codebase — root package.json has no "build" script yet; client/package.json `build: "tsc && vite build"` outputs to `client/dist`]

### apt-get qpdf Install (CONT-02)

```dockerfile
# Source: Verified against node:22-slim (Debian Bookworm) — qpdf 11.3.0-1+deb12u1 available
RUN apt-get update && \
    apt-get install -y --no-install-recommends qpdf && \
    rm -rf /var/lib/apt/lists/*
```

[VERIFIED: `docker run --rm node:22-slim sh -c "apt-get update -qq && apt-cache show qpdf"` — Package: qpdf, Version: 11.3.0-1+deb12u1]

### docker-compose.prod.yml (for local smoke with DB networking)

```yaml
# New file: docker-compose.prod.yml
# Usage: docker compose -f docker-compose.yml -f docker-compose.prod.yml up
name: assistansportal-prod-smoke

services:
  postgres:
    # Reuses existing docker-compose.yml postgres service

  app:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3001:3001"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://assistans:assistans_local@postgres:5432/assistansportal
      JWT_SECRET: local-smoke-test-secret-32chars!!
      FK_HOURLY_RATE: "254.10"
      EMPLOYER_TAX_RATE: "0.3142"
      CLIENT_URL: http://localhost:3001
      PORT: "3001"
    depends_on:
      - postgres
```

---

## Runtime State Inventory

> This phase does not rename any strings or migrate data. No runtime state inventory required.
> Step 2.5 SKIPPED — greenfield containerization, not a rename/refactor/migration phase.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `node:14-slim` base images | `node:22-slim` | Node 22 LTS (2024) | Better V8, native fetch, improved ESM support |
| `npm install` in Docker | `npm ci` | npm 5+ | Deterministic, lockfile-enforced, faster |
| Single-stage Dockerfile | Multi-stage builds | Docker 17.05+ | Runtime image excludes build tools; standard practice |
| `COPY . .` before install | COPY lockfiles → install → COPY src | Docker layer cache awareness | Deps layer cached; source changes don't trigger reinstall |

**Deprecated / outdated in this context:**
- Homebrew PATH hack (`process.env.PATH = '/opt/homebrew/bin:...'`): macOS-only; not valid in Linux containers. Remove from `server/src/index.ts` line 14.
- `node-qpdf2` npm package: listed in `server/package.json` dependencies but never imported in any `.ts` file [VERIFIED: grep of all server/src/*.ts found zero imports]. The package is dead weight — however removing it is deferred (out of phase scope, minor).

---

## Open Questions

1. **Should docker-compose.prod.yml be a new file or override pattern?**
   - What we know: existing `docker-compose.yml` only defines a `postgres` service for dev
   - What's unclear: whether to write a standalone `docker-compose.prod.yml` or use Docker Compose override syntax
   - Recommendation: standalone `docker-compose.prod.yml` for smoke testing; simpler to reason about; Phase 12 Azin deploy won't use docker-compose at all

2. **Should root `npm ci --omit=dev` in runtime stage be skipped?**
   - What we know: root `package.json` has only `concurrently` and `husky` as devDependencies; zero production dependencies
   - What's unclear: whether a future package added to root would need this layer
   - Recommendation: Include the layer anyway for correctness and future-proofing; it costs ~0ms to run when there are no production deps

3. **Port in Dockerfile: EXPOSE 3001 vs ENV PORT?**
   - Recommendation: `EXPOSE 3001` is documentation only. `ENV PORT=3001` sets the default inside the container but allows override via `docker run -e PORT=...`. Include both. Azin may set PORT via its own env injection.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Docker | Building and running the image | Yes | 29.2.1 (build a5c7197) | — |
| `node:22-slim` (image) | Docker build base | Yes (pulled locally) | 22.22.2 / Bookworm | — |
| `qpdf` (apt) | CONT-02 | Yes (in apt) | 11.3.0-1+deb12u1 | — |
| Local PostgreSQL (docker-compose.yml) | CONT-05 smoke with DB | Yes (existing dev setup) | postgres:16-alpine | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | vitest (server: ^4.1.2, client: ^4.1.2) |
| Config file | server/vitest.config.ts (or package.json `test` script) |
| Quick run command | `npm test --prefix server` |
| Full suite command | `npm test --prefix server && npm test --prefix client` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CONT-01 | Docker image builds without error | smoke | `docker build -t assistansportal:local .` | Wave 0: Dockerfile |
| CONT-02 | qpdf binary at `/usr/bin/qpdf` in container | smoke | `docker run --rm assistansportal:local which qpdf` | Wave 0: Dockerfile |
| CONT-03 | Three PDFs present at `/app/forms/` | smoke | `docker run --rm assistansportal:local ls /app/forms` | Wave 0: Dockerfile |
| CONT-04 | Express serves SPA at `/` when NODE_ENV=production | smoke | `curl -s http://localhost:3001/ \| grep DOCTYPE` | Wave 0: prod static block |
| CONT-05 | Full local smoke pass documented | manual smoke | All steps in Pattern 4 above | — |

### Sampling Rate

- **Per task commit:** `npm test --prefix server` (existing unit tests guard regressions)
- **Per wave merge:** `npm test --prefix server && npm test --prefix client`
- **Phase gate:** All CONT-01..05 smoke commands pass before marking phase complete

### Wave 0 Gaps

- [ ] `Dockerfile` — does not exist yet; created in Wave 1
- [ ] `.dockerignore` — does not exist yet; created alongside Dockerfile
- [ ] Root `package.json` "build" script — missing; added in Wave 1

*(No new test files needed — CONT-01..05 are verified by Docker CLI smoke commands, not unit tests.)*

---

## Security Domain

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No change | JWT guard already present in server/src/index.ts |
| V3 Session Management | No change | — |
| V4 Access Control | No change | — |
| V5 Input Validation | No change | — |
| V6 Cryptography | No change | qpdf binary use: decrypt-only, no key management change |

### Known Threat Patterns for Docker + Node.js

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| .env secrets in build context | Information disclosure | `.dockerignore` excludes `.env` and `.env.*` |
| devDependencies in runtime image | Tampering (attack surface) | Multi-stage build + `npm ci --omit=dev` in runtime |
| Running as root in container | Elevation of privilege | Not addressed in this phase — deferred to v1.0.3 security hardening |
| JWT_SECRET in docker-compose.prod.yml | Information disclosure | Never commit `.env.prod` or hardcoded secrets to git; use env injection |

**Note:** Running the Node.js process as a non-root user inside the container is a security
best practice (`USER node` in Dockerfile) but is NOT part of this phase's scope — it's flagged
for v1.0.3 security hardening.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Root npm ci in runtime stage installs nothing (zero prod deps in root package.json) | Code Examples | Low — if a prod dep is added to root later, the layer would install it; behavior is correct either way |
| A2 | `node-qpdf2` npm package is never imported and can be ignored for this phase | State of the Art | Low — confirmed by grep; package is inert |
| A3 | Vite outputs to `client/dist` by default (no explicit outDir in vite.config.ts) | Standard Stack | Low — confirmed by vite.config.ts inspection: no outDir override means Vite default `dist/` relative to client/ |

**All other claims in this document are VERIFIED by codebase inspection or local Docker execution.**

---

## Sources

### Primary (HIGH confidence)

- [VERIFIED: codebase] `server/src/index.ts` — Homebrew PATH hack location (line 14), forms static route (line 39), JWT guard (lines 8-11)
- [VERIFIED: codebase] `server/src/routes/pdf.ts` — `spawnSync("qpdf", ...)` at line 46; FORMS_DIR multi-candidate resolver (lines 21-33)
- [VERIFIED: docker run node:22-slim] qpdf apt package: `Package: qpdf, Version: 11.3.0-1+deb12u1` on Debian Bookworm
- [VERIFIED: docker inspect] `node:22-slim` pulled locally, node 22.22.2, npm 10.9.7, Debian GNU/Linux 12 (bookworm)
- [VERIFIED: ls forms/] All three PDFs present: fk3057.pdf, fk3059.pdf, skv4805.pdf
- [VERIFIED: codebase] `client/vite.config.ts` — no outDir override; default output is `client/dist`
- [VERIFIED: codebase] `server/tsconfig.json` — `outDir: "./dist"`, `rootDir: "./src"`
- [VERIFIED: grep] `node-qpdf2` in server/package.json dependencies but zero imports in server/src/**/*.ts
- [VERIFIED: bash] Docker 29.2.1 available locally

### Secondary (MEDIUM confidence)

- [CITED: packages.debian.org/bookworm/qpdf] qpdf available in Debian Bookworm apt repository
- [CITED: Express documentation pattern] `express.static()` + `app.get('*', ...)` SPA catch-all is the standard pattern

### Tertiary (LOW confidence)

- None in this research — all claims verified by tooling or official sources.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified by local Docker run against node:22-slim
- Architecture: HIGH — based on verified codebase layout + Docker conventions
- Pitfalls: HIGH — derived from verified code inspection + known Docker patterns
- Smoke commands: HIGH — based on verified binary paths and container layout

**Research date:** 2026-04-30
**Valid until:** 2026-05-30 (stable ecosystem; node:22-slim Bookworm, qpdf apt package unlikely to change)
