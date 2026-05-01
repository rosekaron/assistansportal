# Phase 11 — Local Smoke Log (CONT-05)

**Run on:** 2026-04-30
**Image tag:** assistansportal:local
**Docker version:** Docker version 29.2.1, build a5c7197

## Step A — Build

Command: `docker build -t assistansportal:local .`
Result: PASS (exit 0)
Build duration: ~15s (builder stage), ~11s total with layers cached
Image size: 459MB

Note: Build required a Dockerfile patch (Rule 1 auto-fix) — `npm ci --omit=dev --ignore-scripts` added to runtime stage root install to prevent the husky `prepare` script from failing when husky is absent (it is a devDependency omitted in production). See deviation log in SUMMARY.md.

## Step B — qpdf binary present (CONT-02)

Command: `docker run --rm assistansportal:local which qpdf`
Expected: `/usr/bin/qpdf`
Actual: `/usr/bin/qpdf`
Result: PASS

## Step C — Forms PDFs present (CONT-03)

Command: `docker run --rm assistansportal:local ls /app/forms`
Expected: fk3057.pdf, fk3059.pdf, skv4805.pdf (all three present)
Actual:
```
fk3057.pdf
fk3059.pdf
skv4805.pdf
```
Result: PASS

## Step D — Image size sanity

Size: 459MB
Within 200–500MB range: YES
Notes: Within expected range. Client devDependencies were correctly excluded from the runtime stage (only `client/dist` copied from builder). The 459MB breakdown includes: node:22-slim base (~200MB), server production dependencies (~130MB), qpdf + libs (~4MB), compiled dist (~5MB), forms PDFs (~120MB).

## Step F — Postgres available

Command: `docker compose up -d postgres`
Result: PASS
Notes: Container assistansportal_db was already running; docker compose confirmed "Running".

## Step G — App container started

Image: assistansportal:local
Env vars: NODE_ENV=production, DATABASE_URL (host.docker.internal:5432), JWT_SECRET (32 chars), FK_HOURLY_RATE=254.10, EMPLOYER_TAX_RATE=0.3142, CLIENT_URL=http://localhost:3001, PORT=3001
Result: PASS
Notes: Container started in detached mode on host port 3002 (port 3001 was occupied by the local dev server already running; host port remapped to 3002 for the smoke run — container still bound to internal port 3001). Server bound within 10 seconds; no startup errors.

Additional Rule 2 auto-fix applied: added `/api` 404 guard middleware in `server/src/index.ts` placed after all API route registrations and before the SPA catch-all. This ensures undefined `/api/*` routes return 404 JSON instead of the SPA `index.html`. Image was rebuilt after the fix.

## Step H — SPA served at GET / (CONT-04)

Command: `curl -s -o /tmp/smoke-root.html -w "%{http_code}" http://localhost:3002/`
Expected: HTTP 200, response body begins with `<!DOCTYPE html>`
Actual HTTP code: 200
First line of body: `<!DOCTYPE html>`
Result: PASS

## Step I — Health endpoint

Command: `curl -s http://localhost:3002/api/health`
Expected: JSON containing `"ok":true`
Actual: `{"ok":true,"ts":"2026-04-30T21:51:41.437Z"}`
Result: PASS

## Step J — API 404 isolation (catch-all does not mask API)

Command: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/api/this-route-does-not-exist`
Expected: 404
Actual: 404
Result: PASS

## Step K — Container logs

Last 20 lines of `docker logs assistansportal-smoke`:
```
📁 Forms dir: /app/forms
(node:1) [DEP0040] DeprecationWarning: The `punycode` module is deprecated. Please use a userland alternative instead.
(Use `node --trace-deprecation ...` to show where the warning was created)
  Cron          → compliance reminder job started

✅  Server running → http://localhost:3001
   Postgres       → host.docker.internal:5432/assistansportal
```
Contains `Server running`: YES
Contains `FATAL`: NO
Result: PASS

## Step N — Manual browser verification (human-verify checkpoint)

Verified by: MRK
Date: 2026-05-01

- a) Page loads, React mounts: PASS
- b) Console: no red errors: PASS
- c) Network: all assets 200, correct content-types: PASS
- d) Client-side navigation works: PASS
- e) Hard-refresh on /monthly returns index.html and React rehydrates: PASS

Final phase verdict (CONT-05): PASS
Notes: All five browser checks passed. Guardian approved manually.
