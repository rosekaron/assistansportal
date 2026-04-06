---
phase: 2
slug: leave-absence-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 2 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `server/vitest.config.ts` |
| **Quick run command** | `cd server && npm test` |
| **Full suite command** | `cd server && npm run test:coverage` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd server && npm test`
- **After every plan wave:** Run `cd server && npm run test:coverage`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** ~10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 02-01-01 | 01 | 0 | LEAV-01 | — | N/A | unit stub | `cd server && npm test` | ❌ W0 | ⬜ pending |
| 02-01-02 | 01 | 0 | LEAV-02 | — | N/A | unit stub | `cd server && npm test` | ❌ W0 | ⬜ pending |
| 02-01-03 | 01 | 0 | LEAV-03 | — | N/A | unit stub | `cd server && npm test` | ❌ W0 | ⬜ pending |
| 02-02-xx | 02 | 1 | LEAV-01 | — | guardianId scoped, type validated | unit (route mock) | `cd server && npm test` | ❌ W0 | ⬜ pending |
| 02-03-xx | 03 | 2 | LEAV-02 | — | null-assistantId exclusion works | unit (pure function) | `cd server && npm test` | ❌ W0 | ⬜ pending |
| 02-04-xx | 04 | 3 | LEAV-03 | — | VAB cap 120 days, year boundary | unit (pure function) | `cd server && npm test` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/routes/__tests__/absences.test.ts` — stubs for LEAV-01 (create, validate, auto-cancel, delete)
- [ ] `server/src/routes/__tests__/absences-billing.test.ts` — stubs for LEAV-02 (FK exclusion as pure functions)
- [ ] `server/src/routes/__tests__/absences-balance.test.ts` — stubs for LEAV-03 (VAB balance, sick YTD, cross-year clipping)

*All test files are new — Wave 0 must create all three stubs before any implementation wave.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Assistant cannot clock in on absence day | LEAV-01 | UI interaction (clock-in button state) | Record an absence for today; log in as assistant; verify clock-in button is disabled or returns an error |
| "Frånvaro" page visible in sidebar | LEAV-03 | Visual layout | Log in as guardian; verify sidebar shows "Frånvaro" link and page renders absence list |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
