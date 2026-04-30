---
phase: 11-production-dockerfile-static-serving
plan: "02"
subsystem: infra
tags: [express, typescript, spa, static-serving, nodejs, docker]

# Dependency graph
requires:
  - phase: 11-production-dockerfile-static-serving/11-01
    provides: Multi-stage Dockerfile that copies client/dist into /app/client/dist and sets NODE_ENV=production at runtime

provides:
  - Express server in production mode serves compiled React SPA from client/dist via express.static()
  - SPA catch-all (app.get("*")) returns index.html for all unmatched GET routes, enabling React Router client-side routing
  - macOS Homebrew PATH hack removed from server startup code (qpdf now provisioned by apt-get in Dockerfile)

affects:
  - 11-03-PLAN.md (local smoke test will verify SPA is served at / when docker run is executed with NODE_ENV=production)
  - 12-PLAN.md (production Azin deployment assumes this static-serving configuration)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "NODE_ENV=production guard: API route registrations always precede the static block; catch-all always last"
    - "path.join(__dirname, '../../client/dist') resolves to /app/client/dist inside the container given outDir=./dist and WORKDIR=/app"

key-files:
  created: []
  modified:
    - server/src/index.ts

key-decisions:
  - "Placed static block AFTER all app.use('/api/...') registrations AND AFTER app.get('/api/health') to prevent catch-all from intercepting API requests"
  - "Used app.get('*') with Express 4 string pattern (not /* or regex) as specified in research patterns"
  - "Homebrew PATH hack removed entirely — qpdf is now apt-get installed in the Dockerfile runtime stage, making the macOS-only path prepend both incorrect and misleading"

patterns-established:
  - "Pattern 1: Production SPA guard — wrap express.static + catch-all in if (process.env.NODE_ENV === 'production') so Vite dev server proxy remains unaffected in development"
  - "Pattern 2: Static block ordering — health endpoint line < production block line < async function main() line (awk ordering invariant)"

requirements-completed: [CONT-04]

# Metrics
duration: 5min
completed: 2026-04-30
---

# Phase 11 Plan 02: Server Static Serving Changes Summary

**Express server wired to serve compiled React SPA from client/dist via express.static() + SPA catch-all, guarded by NODE_ENV=production; Homebrew PATH hack removed**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-04-30T21:45:00Z
- **Completed:** 2026-04-30T21:50:00Z
- **Tasks:** 2 (both already partially applied; Task 2 committed in this execution)
- **Files modified:** 1

## Accomplishments

- Homebrew PATH hack (`process.env.PATH = /opt/homebrew/bin:...`) fully removed from server/src/index.ts (Task 1, committed as refactor in prior session as `98b8732`)
- Production static-serving block inserted after `/api/health` and before `async function main()` (Task 2, committed as `fc7b87f`)
- Block ordering verified: health=line 53, production block=line 58, main()=line 66
- `npx tsc --noEmit` exits 0 — no TypeScript errors

## Task Commits

Each task was committed atomically:

1. **Task 1: Remove Homebrew PATH hack** - `98b8732` (refactor)
2. **Task 2: Add production static-serving block** - `fc7b87f` (feat)

**Plan metadata:** (docs commit will follow)

## Files Created/Modified

- `server/src/index.ts` — Removed Homebrew PATH hack (lines 13-14 from original); inserted 11-line production static-serving block between `/api/health` handler and `async function main()`; final line count: 76 lines (up from 65 after Task 1, up 11 from Task 2)

## New Block — Line Numbers and Content

Lines 55-64 of the final `server/src/index.ts`:

```typescript
// Serve compiled React SPA in production (NODE_ENV=production).
// Must be placed AFTER all /api/* route registrations and /api/health
// to prevent the catch-all intercepting API requests.
if (process.env.NODE_ENV === "production") {
  const clientDist = path.join(__dirname, "../../client/dist");
  app.use(express.static(clientDist));
  app.get("*", (_req, res) => {
    res.sendFile(path.join(clientDist, "index.html"));
  });
}
```

## Decisions Made

- Used `path.join(__dirname, "../../client/dist")` exactly as specified — resolves to `/app/client/dist` inside the container given `outDir: "./dist"` and `WORKDIR /app` flat layout
- Used double-quote string literals throughout to match existing file style
- Used `app.get("*")` string pattern (Express 4 style) — not `"/*"` or a regex

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None. Both tasks were clean surgical edits. TypeScript compiled without errors after both edits.

## Known Stubs

None. The static-serving block references `client/dist` which is a real build artifact produced by `npm run build` at the root. No placeholder values or TODO comments introduced.

## Threat Flags

No new threat surface introduced beyond what was analyzed in the plan's threat model. The three threats (T-11-07, T-11-08, T-11-09) were mitigated by:
- T-11-07: Block placed after all `/api/*` registrations and `/api/health` (awk ordering invariant: health=53 < prod=58 < main=66)
- T-11-09: `clientDist` is a fixed path with no user-controlled segments; express.static is sandboxed to that directory

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 11-02 complete: server will serve the compiled React SPA at `/` when running inside the Docker container with `NODE_ENV=production`
- Plan 11-03 (local smoke verification) can now proceed: `docker build` + `docker run` with `NODE_ENV=production` should yield a working SPA at the container's exposed port
- The two changes in this plan satisfy CONT-04 requirement fully

---
*Phase: 11-production-dockerfile-static-serving*
*Completed: 2026-04-30*
