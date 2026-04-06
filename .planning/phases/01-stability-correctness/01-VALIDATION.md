---
phase: 1
slug: stability-correctness
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 1 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest + supertest (server), vitest + @testing-library/react (client) |
| **Config file** | none — Wave 0 installs |
| **Quick run command** | `npm test` (in server/ or client/) |
| **Full suite command** | `cd server && npm test && cd ../client && npm test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test` in the affected workspace (server/ or client/)
- **After every plan wave:** Run `cd server && npm test && cd ../client && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 1-W0-01 | 01 | 0 | STAB-01 | — | N/A | infra | `cd server && npm test` | ❌ W0 | ⬜ pending |
| 1-W0-02 | 01 | 0 | STAB-02 | — | N/A | infra | `cd client && npm test` | ❌ W0 | ⬜ pending |
| 1-01-01 | 01 | 1 | STAB-01 | — | Assistants get 403 on guardian routes | integration | `cd server && npm test -- --reporter=verbose` | ❌ W0 | ⬜ pending |
| 1-01-02 | 01 | 1 | STAB-01 | — | catch blocks return sanitized error | unit | `cd server && npm test` | ❌ W0 | ⬜ pending |
| 1-02-01 | 02 | 1 | STAB-02 | — | Last day of Feb is 28/29, not 31 | unit | `cd server && npm test` | ❌ W0 | ⬜ pending |
| 1-03-01 | 03 | 1 | STAB-03 | — | Env vars loaded at startup | unit | `cd server && npm test` | ❌ W0 | ⬜ pending |
| 1-03-02 | 03 | 1 | STAB-03 | — | JWT guard exits on missing/weak secret | unit | `cd server && npm test` | ❌ W0 | ⬜ pending |
| 1-03-03 | 03 | 1 | STAB-03 | — | dev-verify returns 404 in production | integration | `cd server && npm test` | ❌ W0 | ⬜ pending |
| 1-04-01 | 04 | 2 | STAB-04 | — | camelCase fields compile with strict TS | unit | `cd client && npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/routes/__tests__/role-enforcement.test.ts` — stubs for STAB-01 role middleware (Plan 01 Task 2)
- [ ] `server/src/routes/__tests__/pdf.test.ts` — stubs for STAB-02 date calculation (Plan 01 Task 2)
- [ ] `server/src/routes/__tests__/env.test.ts` — stubs for STAB-03 env var + JWT guard (Plan 01 Task 2)
- [ ] `client/src/lib/__tests__/entry-types.test.ts` — stubs for STAB-04 camelCase field access (Plan 01 Task 2)
- [ ] `server/vitest.config.ts` — vitest configuration for server workspace (Plan 01 Task 1)
- [ ] `client/vitest.config.ts` — vitest configuration for client workspace (Plan 01 Task 1)
- [ ] `npm install -D vitest supertest @types/supertest` in server/ (Plan 01 Task 1)
- [ ] `npm install -D vitest @testing-library/react @testing-library/jest-dom` in client/ (Plan 01 Task 1)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Server actually restarts clean after JWT_SECRET removed | STAB-03 | Process exit cannot be asserted in a test without special exit-code trapping | Remove JWT_SECRET from .env, run `npm run dev`, observe fatal error in stdout |
| FK 3057 PDF renders correct date in browser | STAB-02 | PDF rendering requires browser | Generate a report for February, download PDF, verify last day is 28 |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
