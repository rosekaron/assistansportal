---
phase: 5
slug: scheduling-compliance-workflow
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-14
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.1.2 (server) |
| **Config file** | `server/vitest.config.ts` |
| **Quick run command** | `cd server && npx vitest run --reporter=verbose 2>&1 \| tail -20` |
| **Full suite command** | `cd server && npx vitest run` |
| **Estimated runtime** | ~10 seconds |

---

## Sampling Rate

- **After every task commit:** Run `cd server && npx vitest run --reporter=verbose 2>&1 | tail -20`
- **After every plan wave:** Run `cd server && npx vitest run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 15 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 5-xx-01 | 01 | 0 | SCHED-01 | — | N/A | unit | `cd server && npx vitest run src/lib/scheduleUtils.test.ts` | ❌ W0 | ⬜ pending |
| 5-xx-02 | 01 | 0 | COMP-01 | T-5-01 | reminder_day clamped 1–28 | unit | `cd server && npx vitest run src/lib/deadlineUtils.test.ts` | ❌ W0 | ⬜ pending |
| 5-xx-03 | 01 | 0 | COMP-02 | T-5-02 | guardian email not logged | unit | `cd server && npx vitest run src/lib/reminderCron.test.ts` | ❌ W0 | ⬜ pending |
| 5-xx-04 | 01 | 1 | COMP-02 | T-5-01 | reminder_day validated server-side | integration | `cd server && npx vitest run src/__tests__/settings.test.ts` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/lib/deadlineUtils.test.ts` — stubs for COMP-01 deadline arithmetic (FK deadline = 5th of second following month, AGI deadline = 12th of following month, badge variant thresholds, December edge case)
- [ ] `server/src/lib/reminderCron.test.ts` — stubs for COMP-02 cron logic (day match, guardian_email missing guard, pending step detection)
- [ ] `server/src/lib/deadlineUtils.ts` — pure functions for deadline computation (extracted for testability)
- [ ] `server/src/lib/reminderCron.ts` — cron implementation module (new file)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Schedule grid renders correct assistant rows in browser | SCHED-01 | React rendering requires browser | Load Home.tsx, verify each assistant appears as a row with correct day cells |
| Email arrives in inbox on configured day | COMP-02 | Requires live SMTP + wait for cron | Set reminder_day to today's day number, trigger cron manually, check inbox |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
