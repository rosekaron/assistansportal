---
phase: 11
slug: production-dockerfile-static-serving
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-30
---

# Phase 11 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (server: ^4.1.2, client: ^4.1.2) + Docker CLI smoke commands |
| **Config file** | server/vitest.config.ts |
| **Quick run command** | `npm test --prefix server` |
| **Full suite command** | `npm test --prefix server && npm test --prefix client` |
| **Estimated runtime** | ~15 seconds (unit tests) + ~3 min (docker build smoke) |

---

## Sampling Rate

- **After every task commit:** Run `npm test --prefix server`
- **After every plan wave:** Run `npm test --prefix server && npm test --prefix client`
- **Before `/gsd-verify-work`:** Full suite must be green + all Docker smoke commands pass
- **Max feedback latency:** ~15 seconds (unit tests); ~3 minutes (full docker smoke)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 11-01-01 | 01 | 1 | CONT-01/02/03 | T-dockerignore | .env excluded from build context | smoke | `docker build -t assistansportal:local .` | ❌ W0 | ⬜ pending |
| 11-01-02 | 01 | 1 | CONT-02 | — | N/A | smoke | `docker run --rm assistansportal:local which qpdf` | ❌ W0 | ⬜ pending |
| 11-01-03 | 01 | 1 | CONT-03 | — | N/A | smoke | `docker run --rm assistansportal:local ls /app/forms` | ❌ W0 | ⬜ pending |
| 11-01-04 | 01 | 1 | CONT-04 | — | N/A | smoke | `curl -s http://localhost:3001/ \| grep DOCTYPE` | ❌ W0 | ⬜ pending |
| 11-02-01 | 02 | 1 | CONT-04 | — | N/A | unit | `npm test --prefix server` | ✅ | ⬜ pending |
| 11-03-01 | 03 | 2 | CONT-05 | T-jwt | JWT_SECRET guard blocks insecure start | manual smoke | All Pattern 4 steps from RESEARCH.md | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

> **Unconventional Wave 0 for this phase:** The "Wave 0 artifact" is the Dockerfile itself, which is created in Wave 1 execution (Plan 01). There are no pre-existing test file stubs to write before execution — the unit tests (vitest) already exist, and Docker smoke commands require the Dockerfile to exist before they can run. The `nyquist_compliant: false` and `wave_0_complete: false` flags in frontmatter correctly reflect the pre-execution state and will be updated after Wave 1 completes. All plan tasks have valid `<automated>` verify commands.

- [ ] `Dockerfile` — does not exist yet; created in Wave 1 (Plan 01)
- [ ] `.dockerignore` — does not exist yet; created alongside Dockerfile (Plan 01)
- [ ] Root `package.json` "build" script — missing; added in Wave 1 (Plan 01, D-05)

*Existing test infrastructure (vitest) covers unit test feedback. Docker smoke commands require Dockerfile to exist first — created as part of Wave 1 execution.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Full local smoke pass (CONT-05) | CONT-05 | Requires running container + local DB (docker-compose); PDF endpoint needs real JWT from a guardian user | Run all 7 steps in Pattern 4 of RESEARCH.md; document results in phase summary |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s (unit tests) / ~3min (docker smoke)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
