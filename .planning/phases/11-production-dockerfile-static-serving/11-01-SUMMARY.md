---
phase: 11-production-dockerfile-static-serving
plan: "01"
subsystem: infrastructure
tags: [docker, build, monorepo, qpdf, static-serving]
dependency_graph:
  requires: []
  provides: [Dockerfile, .dockerignore, root-build-script]
  affects: [server, client, forms]
tech_stack:
  added: [node:22-slim Docker image, qpdf (apt), multi-stage Docker build]
  patterns: [multi-stage Dockerfile, docker layer caching via lockfile-first COPY, npm --omit=dev for runtime stage]
key_files:
  created:
    - Dockerfile
    - .dockerignore
  modified:
    - package.json
decisions:
  - "node:22-slim selected over node:22-alpine to avoid musl libc native binary issues (qpdf, bcryptjs)"
  - "Three independent npm ci layers in builder stage for optimal Docker layer caching (D-06)"
  - "Client devDependencies excluded from runtime stage — only client/dist copied from builder (~200MB saved)"
  - "USER node directive deferred to v1.0.3 security hardening (T-11-05 accepted per Azin isolated VM model)"
  - "Sequential build (client first, then server) matches D-05 for readable log output"
metrics:
  duration: "85 seconds"
  completed: "2026-04-30T21:42:46Z"
  tasks_completed: 3
  tasks_total: 3
  files_created: 2
  files_modified: 1
---

# Phase 11 Plan 01: Docker Build Infrastructure Summary

**One-liner:** Multi-stage Dockerfile (node:22-slim builder + runtime) with qpdf via apt, three npm ci layer-cache layers, and root build script orchestrating client-then-server TypeScript compilation.

---

## Tasks Completed

| # | Task | Commit | Files |
|---|------|--------|-------|
| 1 | Create root .dockerignore | `7971492` | `.dockerignore` (created) |
| 2 | Add "build" script to root package.json | `8c5b4e3` | `package.json` (modified) |
| 3 | Create root Dockerfile (multi-stage builder + runtime) | `e3eb204` | `Dockerfile` (created, 54 lines) |

---

## Verification Results

- `test -f Dockerfile && test -f .dockerignore && node -e "require('./package.json').scripts.build"` → PASS
- `npm run build` → PASS (produces `client/dist/index.html` and `server/dist/index.js`)
- Dockerfile line count: 54 lines
- All grep-verifiable acceptance criteria: ALL PASS (see details below)

### .dockerignore verification

All 13 entries confirmed present via grep:
- node_modules, server/node_modules, client/node_modules
- server/dist, client/dist
- .env, .env.*, server/.env
- *.log, .planning, .git, .claude
- docker-compose.yml
- `.env.sample` NOT present (correct — it's a template, not a secret)

### package.json build script verification

- Script value: `"npm run build --prefix client && npm run build --prefix server"` (exact match)
- All 4 pre-existing scripts preserved: dev, devcontainer:up, devcontainer:down, prepare
- `npm run build` exits 0; builds `client/dist/index.html` and `server/dist/index.js`

### Dockerfile verification

- FROM count: exactly 2 `FROM node:22-slim` lines
- Stage 1 (builder): `AS builder` — three lockfile-first npm ci layers + source COPY + `RUN npm run build`
- Stage 2 (runtime): `AS runtime` — qpdf via apt in single RUN with cache cleanup
- COPY --from=builder for server/dist and client/dist
- COPY forms/ for PDF static assets
- `npm ci --omit=dev --prefix client` NOT present (correct — only client/dist needed in runtime)
- CMD: exec form `["node", "server/dist/index.js"]`
- NODE_ENV=production, PORT=3001, EXPOSE 3001
- node:22-alpine NOT present; node:20 NOT present; USER node NOT present

---

## STRIDE Threat Mitigations

| Threat | Status |
|--------|--------|
| T-11-01 — .env secrets in build context | MITIGATED — .dockerignore excludes .env, .env.*, server/.env |
| T-11-02 — devDependencies in runtime image | MITIGATED — runtime stage uses --omit=dev; client devDeps excluded entirely |
| T-11-03 — .git history in image (pre-existing PII) | MITIGATED — .dockerignore excludes .git |
| T-11-04 — .planning directory in image | MITIGATED — .dockerignore excludes .planning and .claude |
| T-11-05 — Container runs as root | ACCEPTED — deferred to v1.0.3; Azin isolates tenants in VMs |
| T-11-06 — apt-get cache bloat | MITIGATED — rm -rf /var/lib/apt/lists/* in same RUN as apt-get install |

---

## Deviations from Plan

None — plan executed exactly as written.

---

## Known Stubs

None — no placeholder data, hardcoded values, or TODO markers introduced.

---

## Threat Flags

None — no new network endpoints, auth paths, or trust-boundary surface beyond what the plan's threat model already covers.

---

## Self-Check: PASSED

- `Dockerfile` exists: FOUND
- `.dockerignore` exists: FOUND
- `package.json` build script: FOUND (verified via node -e)
- `client/dist/index.html` exists: FOUND
- `server/dist/index.js` exists: FOUND
- Commit 7971492 exists: CONFIRMED
- Commit 8c5b4e3 exists: CONFIRMED
- Commit e3eb204 exists: CONFIRMED
