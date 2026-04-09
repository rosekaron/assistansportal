---
phase: 3
slug: payroll-calculation-recording
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-09
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest (existing, verified in package.json) |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `npm test -- --run` |
| **Full suite command** | `npm test -- --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --run`
- **After every plan wave:** Run `npm test -- --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 20 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 3-01-01 | 01 | 0 | PAY-01 | — | N/A | unit stub | `npm test -- --run payroll-utils` | ❌ W0 | ⬜ pending |
| 3-01-02 | 01 | 0 | PAY-02 | — | requireGuardian rejects unauth | unit stub | `npm test -- --run payroll.test` | ❌ W0 | ⬜ pending |
| 3-01-03 | 01 | 0 | PAY-03 | — | requireGuardian rejects unauth | unit stub | `npm test -- --run payments.test` | ❌ W0 | ⬜ pending |
| 3-01-04 | 01 | 1 | PAY-01 | — | N/A | unit | `npm test -- --run payroll-utils` | ✅ W0 | ⬜ pending |
| 3-02-01 | 02 | 1 | PAY-01 | — | requireGuardian enforced | integration | `npm test -- --run payroll.test` | ✅ W0 | ⬜ pending |
| 3-02-02 | 02 | 1 | PAY-01 | — | Duplicate record rejected | integration | `npm test -- --run payroll.test` | ✅ W0 | ⬜ pending |
| 3-02-03 | 02 | 1 | PAY-02 | — | Approve rejects if already approved | integration | `npm test -- --run payroll.test` | ✅ W0 | ⬜ pending |
| 3-03-01 | 03 | 1 | PAY-03 | — | requireGuardian enforced on payments | integration | `npm test -- --run payments.test` | ✅ W0 | ⬜ pending |
| 3-03-02 | 03 | 2 | PAY-03 | — | Delete rejects unknown payrollId | integration | `npm test -- --run payments.test` | ✅ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/routes/__tests__/payroll-utils.test.ts` — unit stubs for PAY-01 pure functions (calculatePayroll, calculateOutstandingBalance)
- [ ] `server/src/routes/__tests__/payroll.test.ts` — auth and status guard stubs for PAY-02 (GET, POST generate, POST approve)
- [ ] `server/src/routes/__tests__/payments.test.ts` — auth stubs for PAY-03 (GET, POST, DELETE)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Payroll card renders correctly in browser with sv-SE number formatting | PAY-01 | Frontend visual + locale | Load /payroll, generate payroll, verify numbers show e.g. "12 345,67 kr" not "12,345.67 kr" |
| Approve button locks card and shows "Approved ✓" | PAY-02 | UI state transition | Click Approve, verify button becomes disabled with correct label |
| Add Payment toggle shows/hides form inline | PAY-03 | UI interaction | Click "Lägg till betalning", verify form appears; click again, verify hidden |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 20s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
