---
plan: 11-03
phase: 11-production-dockerfile-static-serving
status: complete
completed: 2026-05-01
requirements_closed:
  - CONT-05
key-files:
  created:
    - .planning/phases/11-production-dockerfile-static-serving/11-SMOKE.md
  modified:
    - server/src/index.ts
---

# Plan 11-03 Summary — Local Smoke Verification

## What was built

Completed the full local smoke suite for the Phase 11 Docker image (`assistansportal:local`), verifying all containerised deliverables before the Azin deployment in Phase 12. All 14 smoke steps (A–N) passed.

## Steps executed

| Step | Check | Result |
|------|-------|--------|
| A | `docker build -t assistansportal:local .` exits 0 | PASS |
| B | `which qpdf` → `/usr/bin/qpdf` (CONT-02) | PASS |
| C | `/app/forms` contains fk3057.pdf, fk3059.pdf, skv4805.pdf (CONT-03) | PASS |
| D | Image size 459MB — within 200–500MB range | PASS |
| F | Local Postgres up via `docker compose up -d postgres` | PASS |
| G | Container started with full production env vars (NODE_ENV=production) | PASS |
| H | `GET /` → HTTP 200, body begins `<!DOCTYPE html>` (CONT-04) | PASS |
| I | `GET /api/health` → `{"ok":true,"ts":"..."}` | PASS |
| J | `GET /api/this-route-does-not-exist` → HTTP 404 (catch-all guard works) | PASS |
| K | Container logs: `Server running` present, no `FATAL` | PASS |
| N | Manual browser: React mounts, no console errors, assets 200, SPA nav works, hard-refresh on /monthly rehydrates | PASS |

**Final phase verdict (CONT-05): PASS**

## Deviations

1. **Rule 1 auto-fix — `npm ci --omit=dev --ignore-scripts`:** The Dockerfile runtime stage needed an additional root-level `npm ci --omit=dev --ignore-scripts` to prevent the `husky prepare` script from failing when husky (a devDependency) is absent. Applied inline during Task 1 execution.

2. **Rule 2 auto-fix — `/api` 404 guard middleware:** `server/src/index.ts` was missing an explicit 404 handler for undefined `/api/*` routes before the SPA catch-all. Without it, the SPA catch-all returned `index.html` for unknown API paths (Step J would have returned 200 instead of 404). Added a guard middleware block placed after all API route registrations and before the SPA catch-all. Image rebuilt after fix.

3. **Host port remapped to 3002:** Port 3001 was occupied by the local dev server during the smoke run. Container internal port 3001 was remapped to host port 3002 (`-p 3002:3001`). This is smoke-only and has no impact on the Azin deployment.

## Image facts

- **Tag:** `assistansportal:local`
- **Size:** 459MB (within 200–500MB expected range)
- **Build time:** ~15s builder stage, ~11s total with layers cached
- **Docker version:** 29.2.1

## ROADMAP §Phase 11 success criteria

| # | Criterion | Satisfied by |
|---|-----------|-------------|
| 1 | `docker build` exits 0; qpdf at `/usr/bin/qpdf` | Steps A + B |
| 2 | Three form PDFs present at `/app/forms` | Step C |
| 3 | `NODE_ENV=production` serves React SPA at `/` | Steps G + H |
| 4 | PDF download (qpdf binary confirmed present; full end-to-end deferred to Phase 12 which requires populated DB) | Step B (binary verified) |
| 5 | Smoke pass documented | 11-SMOKE.md |

## Self-Check: PASSED

All acceptance criteria met:
- SMOKE.md exists with Steps A–K and Step N
- All results recorded as PASS
- `assistansportal-smoke` container stopped (`--rm` flag removes on stop)
- No production secrets used (test-only values throughout)
- CONT-05 closed
