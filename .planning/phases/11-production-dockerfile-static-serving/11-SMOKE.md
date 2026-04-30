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
