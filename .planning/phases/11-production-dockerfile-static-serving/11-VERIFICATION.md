---
phase: 11-production-dockerfile-static-serving
verified: 2026-05-01T00:00:00Z
status: human_needed
score: 4/5 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Confirm REQUIREMENTS.md CONT-05 checkbox and traceability row are intentionally left unchecked, or update them to checked/Complete"
    expected: "CONT-05 row reads '- [x]' and traceability shows 'Complete (11-03)'"
    why_human: "REQUIREMENTS.md still shows CONT-05 as unchecked and 'Pending' despite SMOKE.md recording PASS and 11-03-SUMMARY closing the requirement. This is an administrative inconsistency only a human can resolve — either by updating the file or confirming intentional deferral of the checkbox update to a later commit."
  - test: "Confirm ROADMAP.md Phase 11 progress table and 11-03-PLAN.md checkbox are intentionally left at '2/3 plans complete / In progress' despite all three plans being executed"
    expected: "ROADMAP.md progress table updated to '3/3 / Complete' and 11-03-PLAN.md checkbox marked [x]"
    why_human: "ROADMAP.md shows '11-03-PLAN.md' as '[ ]' and the progress table as '2/3 plans complete, In progress'. 11-03-SUMMARY and SMOKE.md confirm the plan ran to completion. Only a human can confirm whether this is an intentional snapshot state or an oversight."
---

# Phase 11: Production Dockerfile & Static Serving — Verification Report

**Phase Goal:** Containerize the app — multi-stage Dockerfile with qpdf (apt), forms directory, client build served by Express in production mode. Verified locally before deploy.
**Verified:** 2026-05-01T00:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                   | Status     | Evidence                                                                                 |
|----|--------------------------------------------------------------------------------------------------------|------------|------------------------------------------------------------------------------------------|
| 1  | Dockerfile has two `FROM node:22-slim` stages (builder + runtime)                                      | VERIFIED   | `grep -c "^FROM node:22-slim" Dockerfile` = 2; stages named AS builder, AS runtime      |
| 2  | .dockerignore excludes node_modules, .env files, .planning, .claude, dist directories                  | VERIFIED   | All 13 required entries confirmed present; .env.sample correctly absent                  |
| 3  | Root package.json has 'build' script building client then server                                        | VERIFIED   | `"npm run build --prefix client && npm run build --prefix server"` exact match           |
| 4  | Dockerfile installs qpdf via apt-get in runtime stage with cache cleanup in same RUN layer             | VERIFIED   | apt-get + rm -rf /var/lib/apt/lists/* in single RUN; smoke confirmed `/usr/bin/qpdf`     |
| 5  | Dockerfile copies forms/ directory into /app/forms in the runtime stage                                | VERIFIED   | `COPY forms/ ./forms/` present; smoke confirmed fk3057.pdf, fk3059.pdf, skv4805.pdf     |
| 6  | Dockerfile uses three independent npm ci calls in builder stage for layer caching                      | VERIFIED   | Three separate COPY+RUN blocks for root, server, client lockfiles in builder stage       |
| 7  | server/src/index.ts no longer contains the Homebrew PATH hack                                          | VERIFIED   | `grep -c "/opt/homebrew"` = 0; `grep -c "Homebrew"` = 0; `grep -c "process.env.PATH"` = 0 |
| 8  | server/src/index.ts contains NODE_ENV=production block with express.static + SPA catch-all             | VERIFIED   | Lines 65-71 confirmed: guard, clientDist path, express.static, app.get("*"), sendFile   |
| 9  | Production static block placed AFTER /api/* routes and BEFORE async function main()                    | VERIFIED   | awk ordering: health=53 < prod=65 < main=73; exit code 0                                |
| 10 | docker build exits 0; qpdf at /usr/bin/qpdf; forms present; SPA served at /; /api/health returns JSON | VERIFIED   | SMOKE.md Steps A–K all PASS; manual browser Step N PASS; image exists at 459MB          |
| 11 | Full end-to-end PDF download against container returns valid PDF (ROADMAP SC-4)                        | UNCERTAIN  | PLAN explicitly defers to Phase 12 (requires populated DB); qpdf binary verified present |
| 12 | CONT-05 marked complete in REQUIREMENTS.md                                                             | FAILED     | REQUIREMENTS.md shows `- [ ] CONT-05` (unchecked) and traceability row = "Pending"      |

**Score:** 10/10 implementation truths verified (ROADMAP SC-4 deferred per plan; CONT-05 checkbox is administrative only)

---

### ROADMAP Success Criteria

| # | Criterion                                                              | Status   | Evidence                                                                         |
|---|------------------------------------------------------------------------|----------|----------------------------------------------------------------------------------|
| 1 | docker build exits 0; qpdf at /usr/bin/qpdf                            | VERIFIED | SMOKE Step A: PASS; Step B: actual=/usr/bin/qpdf; image tag exists (459MB)      |
| 2 | Three form PDFs present at runtime path inside container               | VERIFIED | SMOKE Step C: fk3057.pdf, fk3059.pdf, skv4805.pdf confirmed in /app/forms       |
| 3 | docker run with NODE_ENV=production serves React SPA at /              | VERIFIED | SMOKE Step H: HTTP 200, body starts with `<!DOCTYPE html>`; Step N browser PASS |
| 4 | PDF download request returns valid PDF with no HTTP 500                | DEFERRED | Plan 03 explicitly defers to Phase 12 (needs populated production DB); qpdf binary confirmed at /usr/bin/qpdf as Phase 11 proxy evidence |
| 5 | Local smoke pass documented                                            | VERIFIED | 11-SMOKE.md exists with Steps A-K, N; Final phase verdict: PASS                 |

---

### Required Artifacts

| Artifact                                                                     | Expected                              | Status   | Details                                                                     |
|------------------------------------------------------------------------------|---------------------------------------|----------|-----------------------------------------------------------------------------|
| `Dockerfile`                                                                 | Multi-stage builder + runtime         | VERIFIED | 54 lines; both FROM node:22-slim stages; all structural invariants pass     |
| `.dockerignore`                                                              | 13 build-context exclusions           | VERIFIED | All 13 entries present; .env.sample correctly absent                        |
| `package.json`                                                               | Root build orchestration script       | VERIFIED | build = "npm run build --prefix client && npm run build --prefix server"    |
| `server/src/index.ts`                                                        | Production SPA serving block          | VERIFIED | NODE_ENV guard at line 65; clientDist path; express.static; app.get("*")   |
| `.planning/phases/11-production-dockerfile-static-serving/11-SMOKE.md`      | Local smoke verification log          | VERIFIED | All steps A-K and N present; all results PASS; final verdict PASS           |

---

### Key Link Verification

| From                                   | To                                         | Via                          | Status   | Details                                                                       |
|----------------------------------------|--------------------------------------------|------------------------------|----------|-------------------------------------------------------------------------------|
| Dockerfile builder stage               | package.json root build script             | `RUN npm run build`          | VERIFIED | Line 24 of Dockerfile; package.json build script confirmed                    |
| Dockerfile runtime stage               | qpdf binary /usr/bin/qpdf                  | apt-get install qpdf         | VERIFIED | Lines 32-34 of Dockerfile; smoke Step B output = /usr/bin/qpdf               |
| Dockerfile runtime stage               | /app/forms inside container                | COPY forms/ ./forms/         | VERIFIED | Line 49 of Dockerfile; smoke Step C confirms all 3 PDFs present              |
| server/src/index.ts production block   | /app/client/dist inside container          | path.join(__dirname, "../../client/dist") | VERIFIED | __dirname=/app/server/dist resolves to /app/client/dist; confirmed by Step H |
| server/src/index.ts production block   | express.static middleware                  | app.use(express.static(clientDist)) | VERIFIED | Line 67 confirmed; SPA served at / in smoke                              |
| server/src/index.ts production block   | SPA catch-all returning index.html         | app.get("*") sendFile        | VERIFIED | Lines 68-70; Step J confirms /api/* still returns 404 (catch-all guarded)   |
| Dockerfile (Plan 01)                   | running local container                    | docker build && docker run   | VERIFIED | SMOKE Step A exit 0; Step G container started; Steps H/I/J HTTP verified     |

---

### Deviations from Plan (Documented in SUMMARY)

Two auto-fixes were applied during smoke execution and are correctly documented in 11-03-SUMMARY.md and 11-SMOKE.md:

1. **Rule 1 — `--ignore-scripts` added to Dockerfile runtime root install:** `RUN npm ci --omit=dev --ignore-scripts` (Dockerfile line 38). Plan specified `npm ci --omit=dev`. The addition prevents the husky `prepare` script from failing when husky is absent in production. This is a correct improvement, not a regression — it makes the build more robust.

2. **Rule 2 — `/api` 404 guard middleware added to server/src/index.ts:** Lines 55-60 of `server/src/index.ts`. Plan 02 did not specify this guard. It ensures undefined `/api/*` routes return 404 JSON rather than the SPA catch-all's `index.html`. Verified by SMOKE Step J (returns 404, not 200). This is a security improvement.

Both deviations improve the implementation. Neither creates a regression against any plan must-have.

---

### Data-Flow Trace (Level 4)

The phase delivers infrastructure (Dockerfile, .dockerignore, server middleware block), not a data-rendering component. Level 4 data-flow trace is not applicable. The relevant wiring — that the production block activates only under NODE_ENV=production and that the correct filesystem path resolves inside the container — was verified by smoke execution (Steps G, H, J).

---

### Behavioral Spot-Checks

| Behavior                                   | Method                                              | Result                              | Status |
|--------------------------------------------|-----------------------------------------------------|-------------------------------------|--------|
| Dockerfile structural invariants           | grep checks on Dockerfile                           | All 15 invariants pass              | PASS   |
| .dockerignore completeness                 | grep -Fxq on all 13 entries                         | All 13 present; .env.sample absent  | PASS   |
| Homebrew PATH hack absent                  | grep -c on server/src/index.ts                      | 0 matches for /opt/homebrew, PATH   | PASS   |
| Production static block ordering           | awk line-number comparison                          | health=53 < prod=65 < main=73       | PASS   |
| Docker image exists locally                | docker images assistansportal:local                 | 459MB image present                 | PASS   |
| Smoke container not running (cleaned up)   | docker ps --filter name=assistansportal-smoke       | Empty (correct)                     | PASS   |
| SMOKE.md final verdict                     | grep "Final phase verdict"                          | "CONT-05: PASS"                     | PASS   |
| git commits referenced in SUMMARY exist    | git cat-file -t on 5 hashes                        | All 5 commits exist in history      | PASS   |

---

### Requirements Coverage

| Requirement | Source Plan | Description                                                       | Status    | Evidence                                                            |
|-------------|------------|-------------------------------------------------------------------|-----------|---------------------------------------------------------------------|
| CONT-01     | 11-01       | App builds as single production Docker image (multi-stage)        | SATISFIED | Dockerfile has builder + runtime stages; image builds (SMOKE Step A)|
| CONT-02     | 11-01       | qpdf installed via apt-get in runtime stage                       | SATISFIED | Dockerfile lines 32-34; SMOKE Step B: /usr/bin/qpdf confirmed      |
| CONT-03     | 11-01       | forms/ directory present at correct runtime path                  | SATISFIED | COPY forms/ ./forms/ in Dockerfile; SMOKE Step C: all 3 PDFs      |
| CONT-04     | 11-02       | Server serves compiled React client as static files in production | SATISFIED | server/src/index.ts lines 65-71; SMOKE Step H: 200 + DOCTYPE html  |
| CONT-05     | 11-03       | Docker image builds and runs correctly locally before Azin push   | SATISFIED (evidence) / NOT CHECKED (REQUIREMENTS.md) | SMOKE.md all steps PASS; REQUIREMENTS.md checkbox still `[ ]`      |

**Note on CONT-05:** The implementation evidence is complete and the SMOKE.md records a PASS verdict. The REQUIREMENTS.md checkbox and traceability row were not updated after plan 03 completed. This is an administrative inconsistency — the implementation satisfies the requirement but the tracking document was not updated.

---

### Anti-Patterns Found

| File                   | Pattern                    | Severity | Impact                 |
|------------------------|----------------------------|----------|------------------------|
| REQUIREMENTS.md        | CONT-05 checkbox unchecked | Warning  | Administrative only — no implementation impact. Traceability shows "Pending" despite smoke completion. |
| ROADMAP.md             | Phase 11 progress "2/3" / "In progress" | Warning | Administrative only — all 3 plans executed and committed. Progress table not updated after 11-03 completed. |

No implementation anti-patterns found. No TODO/FIXME/placeholder comments. No hardcoded secrets. No stub implementations. No empty returns in production code paths.

---

### Deferred Items

Items addressed in later milestone phases, not actionable gaps in Phase 11.

| # | Item                                                          | Addressed In | Evidence                                                                             |
|---|---------------------------------------------------------------|--------------|--------------------------------------------------------------------------------------|
| 1 | Full end-to-end PDF download returns valid PDF (ROADMAP SC-4) | Phase 12     | Phase 12 SC-3: "Guardian can download a PDF (FK 3057 or lönespec) at the production URL — verifies qpdf binary executes correctly inside the Azin container" + SMOKE-02 requirement |

---

### Human Verification Required

#### 1. Update REQUIREMENTS.md CONT-05 checkbox and traceability row

**Test:** Open `.planning/REQUIREMENTS.md` and change `- [ ] **CONT-05**` to `- [x] **CONT-05**` and the traceability table row from `| CONT-05 | Phase 11 | Pending |` to `| CONT-05 | Phase 11 | Complete (11-03) |`.

**Expected:** REQUIREMENTS.md shows CONT-05 as complete, consistent with SMOKE.md verdict.

**Why human:** Only the project owner can confirm this was an oversight (update it) versus an intentional decision to defer checkbox management to a specific workflow step. The implementation is verifiably complete; only the tracking document needs alignment.

#### 2. Update ROADMAP.md Phase 11 status

**Test:** Open `.planning/ROADMAP.md` and update:
- `- [ ] 11-03-PLAN.md` to `- [x] 11-03-PLAN.md`
- Progress table row from `| 11. Production Dockerfile & Static Serving | 2/3 | In progress | - |` to `| 11. Production Dockerfile & Static Serving | 3/3 | Complete | 2026-05-01 |`
- Top-level phase checkbox from `- [ ] **Phase 11:` to `- [x] **Phase 11:`

**Expected:** ROADMAP.md reflects that Phase 11 is fully complete.

**Why human:** Same as above — project owner must confirm intent.

---

### Gaps Summary

No implementation gaps blocking goal achievement. The phase goal ("Containerize the app — multi-stage Dockerfile with qpdf (apt), forms directory, client build served by Express in production mode. Verified locally before deploy.") is fully achieved:

- Dockerfile is correct, substantive, and wired — verified by grep checks and confirmed working by the local smoke run
- .dockerignore is complete with all 13 required entries
- Root build script is correct
- server/src/index.ts has the Homebrew hack removed and the production static block correctly placed and ordered
- Local smoke verification completed with all steps A-K and N passing, including manual browser verification by the guardian (MRK, 2026-05-01)
- Docker image exists locally at 459MB within the expected size range

The two human verification items are administrative document updates (REQUIREMENTS.md and ROADMAP.md checkboxes), not implementation defects. The status is `human_needed` because the REQUIREMENTS.md tracking file and ROADMAP.md progress table are inconsistent with the completed state, and only the project owner can confirm the correct resolution.

---

_Verified: 2026-05-01T00:00:00Z_
_Verifier: Claude (gsd-verifier)_
