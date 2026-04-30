# Phase 11: Production Dockerfile & Static Serving - Pattern Map

**Mapped:** 2026-04-30
**Files analyzed:** 4 (2 new, 2 modified)
**Analogs found:** 3 / 4 (Dockerfile and .dockerignore have no codebase analog)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `Dockerfile` | config | file-I/O (build pipeline) | none in codebase | no analog |
| `.dockerignore` | config | file-I/O (build context filter) | none in codebase | no analog |
| `package.json` (root) | config | transform (script orchestration) | `server/package.json` §scripts | role-match |
| `server/src/index.ts` | middleware / server entry | request-response | `server/src/index.ts` itself (existing lines 39, 8-11) | exact (modify-in-place) |

---

## Pattern Assignments

### `Dockerfile` (config, build pipeline)

**Analog:** None exists in the codebase. Use RESEARCH.md Pattern 1 (multi-stage build) as the authoritative source. The `docker-compose.yml` (repo root) shows project naming conventions.

**docker-compose.yml naming convention** (`docker-compose.yml` lines 1-3):
```yaml
name: assistansportal

services:
  postgres:
```

**Layer caching principle from RESEARCH.md Pattern 1:**
Copy lockfiles first, run `npm ci`, then copy source — so a source-only change never invalidates the dependency layer. Three separate `npm ci` calls are required because this monorepo has three independent `package-lock.json` files and no npm workspaces.

**apt-get pattern (CONT-02)** — combine update + install + cleanup in one `RUN` to keep the layer small:
```dockerfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends qpdf && \
    rm -rf /var/lib/apt/lists/*
```

**CMD convention** — `server/package.json` line 7 shows the runtime entry point:
```json
"start": "node dist/index.js"
```
In the container flat layout (`/app` WORKDIR), this becomes:
```dockerfile
CMD ["node", "server/dist/index.js"]
```

**ENV + EXPOSE** — include both so Azin can override PORT via its own env injection (EXPOSE is documentation-only):
```dockerfile
ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
```

**Full two-stage structure** (from RESEARCH.md Pattern 1, verified against local `node:22-slim`):
```dockerfile
# ── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY server/package.json server/package-lock.json ./server/
RUN npm ci --prefix server

COPY client/package.json client/package-lock.json ./client/
RUN npm ci --prefix client

COPY server/ ./server/
COPY client/ ./client/

RUN npm run build

# ── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:22-slim AS runtime
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends qpdf && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY server/package.json server/package-lock.json ./server/
RUN npm ci --omit=dev --prefix server

COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

COPY forms/ ./forms/

ENV NODE_ENV=production
ENV PORT=3001
EXPOSE 3001
CMD ["node", "server/dist/index.js"]
```

**Placement note on root `npm ci --omit=dev` in runtime stage:** Root `package.json` currently has zero production dependencies (`concurrently` and `husky` are both devDependencies). The layer runs in ~0ms but is included for future-proofing correctness.

---

### `.dockerignore` (config, build context filter)

**Analog:** None exists in the codebase. Use RESEARCH.md Pattern 3 as the authoritative source, extended with project-specific directories visible in the repo root.

**Project-specific additions to the standard pattern:**
- `.planning/` — GSD planning artifacts (never needed in build)
- `.claude/` — Claude project memory (never needed in build)
- `server/.env` — server-level env file (confirmed present via `server/package.json` dotenv dependency)
- `docker-compose.yml` — dev-only compose file

**Full .dockerignore content** (from RESEARCH.md Pattern 3 + project additions):
```
node_modules
server/node_modules
client/node_modules
server/dist
client/dist
.env
.env.*
server/.env
*.log
.planning
.git
.claude
docker-compose.yml
```

---

### `package.json` (root) — add "build" script (D-05)

**Analog:** `server/package.json` §scripts — same `--prefix` convention already used in the root `"dev"` script.

**Existing root "dev" script pattern** (`package.json` lines 6-7):
```json
"dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\""
```

**New "build" script** — same `--prefix` idiom, no `concurrently` (sequential: client first, then server):
```json
"build": "npm run build --prefix client && npm run build --prefix server"
```

**Client build script** (`client/package.json` line 8) — confirms `build` target exists:
```json
"build": "tsc && vite build"
```

**Server build script** (`server/package.json` line 7) — confirms `build` target exists:
```json
"build": "tsc"
```

**Full modified scripts block** (lines 5-10 of root `package.json` after change):
```json
"scripts": {
  "dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\"",
  "build": "npm run build --prefix client && npm run build --prefix server",
  "devcontainer:up": "npx @devcontainers/cli up --workspace-folder .",
  "devcontainer:down": "npx @devcontainers/cli down --workspace-folder .",
  "prepare": "husky"
}
```

---

### `server/src/index.ts` — two surgical changes (CONT-02 + CONT-04)

**Analog:** `server/src/index.ts` itself — both changes are modifications to the existing file.

#### Change 1: Remove Homebrew PATH hack (CONT-02)

**Current lines 13-14** (to be deleted):
```typescript
// Ensure Homebrew binaries (qpdf etc.) are in PATH
process.env.PATH = `/opt/homebrew/bin:${process.env.PATH}`;
```

**Action:** Delete both lines entirely. qpdf is provided by `apt-get` in the runtime stage.

**Placement context** — these lines sit between the JWT guard and the db/route imports (lines 7-16 of the current file):
```typescript
// Startup guard: refuse to start with missing or insecure JWT secret
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev_secret") {
  console.error("FATAL: JWT_SECRET not set or uses insecure default 'dev_secret'. Aborting.");
  process.exit(1);
}

// ← DELETE the two lines here (lines 13-14)

import { seedDefaults } from "./db";
```

#### Change 2: Add production static serving block (CONT-03, CONT-04)

**Existing analog — `/forms` static route** (`server/src/index.ts` line 39):
```typescript
app.use("/forms", express.static(path.join(__dirname, "../../forms")));
```
This is the exact same `express.static()` + `path.join(__dirname, ...)` pattern used for the client SPA block. Copy the idiom.

**Existing startup guard pattern** (`server/src/index.ts` lines 8-10) — confirms the `process.env.NODE_ENV` guard style already used in this file:
```typescript
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev_secret") {
  // ...
}
```

**New production static block** — insert AFTER `app.get("/api/health", ...)` (current line 56), BEFORE `async function main()`:
```typescript
// Serve compiled React SPA in production (NODE_ENV=production)
// Must be placed after all /api/* route registrations and /api/health
// to prevent the catch-all intercepting API requests
if (process.env.NODE_ENV === 'production') {
  const clientDist = path.join(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}
```

**Path resolution confirmed:** At runtime, `__dirname` in compiled `server/dist/index.js` is `/app/server/dist` (per `server/tsconfig.json` `outDir: "./dist"`). Therefore `path.join(__dirname, '../../client/dist')` resolves to `/app/client/dist` — matching the flat `/app` container layout (D-01).

**Full insertion point context** (lines 56-58 of current file, showing before/after):
```typescript
app.get("/api/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

// ← INSERT production static block here

async function main() {
```

**`path` is already imported** (`server/src/index.ts` line 3):
```typescript
import path from "path";
```
No new imports needed.

---

## Shared Patterns

### JWT Startup Guard
**Source:** `server/src/index.ts` lines 8-11
**Apply to:** Production static serving block must be placed AFTER this guard (no conflict; guard exits process before any middleware runs if secret is bad)
```typescript
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev_secret") {
  console.error("FATAL: JWT_SECRET not set or uses insecure default 'dev_secret'. Aborting.");
  process.exit(1);
}
```

### express.static() + path.join(__dirname) Pattern
**Source:** `server/src/index.ts` line 39
**Apply to:** Production SPA static block in the same file
```typescript
app.use("/forms", express.static(path.join(__dirname, "../../forms")));
```
The client dist block mirrors this with `path.join(__dirname, '../../client/dist')`.

### npm --prefix Script Convention
**Source:** Root `package.json` line 6 ("dev" script)
**Apply to:** Root `package.json` new "build" script (D-05)
```json
"dev": "concurrently \"npm run dev --prefix server\" \"npm run dev --prefix client\""
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `Dockerfile` | config | file-I/O (build pipeline) | No Dockerfile exists in the codebase; RESEARCH.md Pattern 1 is the authoritative reference |
| `.dockerignore` | config | file-I/O (build context filter) | No .dockerignore exists in the codebase; RESEARCH.md Pattern 3 is the authoritative reference |

---

## Metadata

**Analog search scope:** `/Users/rosekaron/Desktop/Kalinga/assistansportal/` (root, server/, client/)
**Files scanned:** server/src/index.ts, package.json (root), server/package.json, client/package.json, server/tsconfig.json, docker-compose.yml
**Pattern extraction date:** 2026-04-30
