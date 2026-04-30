# Phase 11: Production Dockerfile & Static Serving - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-30
**Phase:** 11-Production Dockerfile & Static Serving
**Areas discussed:** Container layout, Static serving code, Build orchestration

---

## Container Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Flat /app | /app/server, /app/client, /app/forms. __dirname relative path works as-is. | ✓ |
| Flat /app + FORMS_DIR env var | Same layout but explicit FORMS_DIR env var replaces relative path. | |
| Minimal /app (server only) | Only compiled server + forms, tighter image. | |

**User's choice:** Flat /app
**Notes:** No code change needed for forms path — __dirname relative navigation resolves correctly in this layout.

---

| Option | Description | Selected |
|--------|-------------|----------|
| node:20-slim | Debian slim, qpdf via apt-get, common production choice. | |
| node:20-bookworm-slim | Pinned to Debian 12, more reproducible. | |
| node:20 | Full Debian, largest. | |
| node:22-slim | User specified Node 22. | ✓ |

**User's choice:** node:22-slim (both build and runtime stages)
**Notes:** User explicitly chose Node 22 over Node 20.

---

## Static Serving Code

| Option | Description | Selected |
|--------|-------------|----------|
| Only in production (NODE_ENV guard) | if (NODE_ENV=production) block. Dev workflow unchanged. | ✓ |
| Always active | Serve client/dist unconditionally. Dev startup logs errors if dist missing. | |

**User's choice:** Only in production
**Notes:** Guard keeps the existing dev workflow (Vite dev server) working without changes.

---

| Option | Description | Selected |
|--------|-------------|----------|
| /app/client/dist | Matches flat /app layout. path.join(__dirname, '../../client/dist') from server/dist. | ✓ |
| CLIENT_DIST env var | Configurable path via env var. | |

**User's choice:** /app/client/dist
**Notes:** Consistent with flat /app container layout decision.

---

## Build Orchestration

| Option | Description | Selected |
|--------|-------------|----------|
| Root build script | Add 'build' to root package.json, one RUN in Dockerfile. | ✓ |
| Separate RUN steps | cd client && npm build + cd server && npm build in Dockerfile stages. | |

**User's choice:** Root build script
**Notes:** Useful for local production build testing too, not just Docker.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Install all three separately | npm ci in root, server/, client/ with layered COPY for caching. | ✓ |
| Install only server and client | Skip root (only has devDependencies not needed at runtime). | |

**User's choice:** Install all three separately
**Notes:** Best Docker layer caching; deps only rebuild when lockfiles change.

---

## Claude's Discretion

- `.dockerignore` content
- Multi-stage Dockerfile structure and layer ordering
- `apt-get` install command for qpdf (flags, cache cleanup)
- Local smoke verification commands for CONT-05

## Deferred Ideas

None — discussion stayed within phase scope
