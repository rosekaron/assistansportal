# Phase 11: Production Dockerfile & Static Serving - Context

**Gathered:** 2026-04-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Containerize the monorepo app: write a multi-stage Dockerfile, install qpdf via apt-get (replacing the Homebrew PATH hack), add Express static-serving middleware for the compiled React SPA, add a root-level build script, and verify the image runs correctly locally before Azin deploy.

</domain>

<decisions>
## Implementation Decisions

### Container Layout
- **D-01:** Use flat `/app` layout inside the container: `/app/server`, `/app/client`, `/app/forms`. Server runs from `/app/server/dist/index.js`. The existing `path.join(__dirname, "../../forms")` in `server/src/index.ts` resolves correctly to `/app/forms` — no code change needed for forms path.
- **D-02:** Base image: `node:22-slim` for BOTH build and runtime stages (Debian-based; qpdf available via apt-get).

### Static Serving
- **D-03:** Add `if (process.env.NODE_ENV === 'production')` guard in `server/src/index.ts` to serve `client/dist` as static files. Guard keeps dev workflow unchanged (Vite dev server handles client in dev mode).
- **D-04:** Client build served from `/app/client/dist` — Express path: `path.join(__dirname, '../../client/dist')`. Add a SPA catch-all route (`app.get('*', ...)`) inside the same production guard, returning `client/dist/index.html`.

### Build Orchestration
- **D-05:** Add `"build": "npm run build --prefix client && npm run build --prefix server"` to root `package.json` scripts. Dockerfile's build stage runs `npm run build` at repo root.
- **D-06:** npm install handled in three separate steps for layer caching: COPY each `package.json` + `package-lock.json` first, then run `npm ci` in root, `server/`, and `client/` independently. Dependency layers only rebuild when lockfiles change.

### Claude's Discretion
- `.dockerignore` content (exclude `node_modules`, `.planning`, `dist`, `.env*`, `*.log`, etc.)
- Multi-stage Dockerfile structure (build stage installs deps + compiles; runtime stage installs only production deps, copies compiled output and forms)
- `apt-get` install command for qpdf (with `--no-install-recommends` and cache cleanup)
- Local smoke verification commands for CONT-05

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Requirements
- `.planning/REQUIREMENTS.md` §Container — CONT-01..05: exact requirements for Dockerfile, qpdf, forms, static serving, local smoke
- `.planning/ROADMAP.md` §Phase 11 — success criteria (5 items) and acceptance tests

### Existing Server Code
- `server/src/index.ts` — current qpdf PATH hack (line 13), forms static route (line 39), CORS config (line 36). The static serving code change goes here.
- `server/tsconfig.json` — `outDir: "./dist"`, `rootDir: "./src"`. Server compiles to `server/dist/`.
- `server/package.json` §scripts — `build: tsc`, `start: node dist/index.js`
- `client/package.json` §scripts — `build: tsc && vite build`. Output lands in `client/dist/`.

### Project Root
- `package.json` — root scripts (currently no `build` entry; D-05 adds one)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `server/src/index.ts`: static middleware pattern already used for `/forms` route (`app.use("/forms", express.static(...))`) — same pattern applies for client SPA serving

### Established Patterns
- Server TypeScript compiles to `server/dist/` — `__dirname` at runtime is `/app/server/dist`; relative paths using `__dirname` navigate to `/app/` correctly with flat layout
- `JWT_SECRET` startup guard in `server/src/index.ts` — existing pattern for production guards at startup

### Integration Points
- `server/src/index.ts` lines 12-14: remove Homebrew PATH hack (`process.env.PATH = '/opt/homebrew/bin:...'`) — replaced by apt-get qpdf in Dockerfile
- `server/src/index.ts`: add production static middleware block after existing `/forms` route
- `forms/` directory at repo root: COPY'd to `/app/forms` in runtime stage
- `client/dist/` built in build stage: COPY'd to `/app/client/dist` in runtime stage

</code_context>

<specifics>
## Specific Ideas

- User confirmed `node:22-slim` for both build and runtime stages (not node:20)
- Forms path stays relative (no FORMS_DIR env var) — the flat /app layout makes the existing `../../forms` resolve work as-is

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 11-Production Dockerfile & Static Serving*
*Context gathered: 2026-04-30*
