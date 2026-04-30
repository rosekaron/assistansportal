---
phase: 8
slug: employer-representation-helper
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-18
---

# Phase 8 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 |
| **Config file** | `server/vitest.config.ts` |
| **Quick run command** | `cd server && npm test -- employer-representation` |
| **Full suite command** | `cd server && npm test` |
| **Estimated runtime** | ~5 seconds (quick) / ~15 seconds (full) |

---

## Sampling Rate

- **After every task commit:** Run `cd server && npm test -- employer-representation`
- **After every plan wave:** Run `cd server && npm test`
- **Before `/gsd-verify-work`:** Full suite must be green + grep absence check passes + `cd server && npm run build` clean
- **Max feedback latency:** 5 seconds (quick) / 15 seconds (full)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 8-01-01 | 01 | 0 | EMP-01 | — | N/A | unit (scaffold) | `cd server && npm test -- employer-representation` | ❌ W0 | ⬜ pending |
| 8-01-02 | 01 | 1 | EMP-01(a) | — | N/A | unit | `cd server && npm test -- employer-representation -t "minor-by-pno"` | ❌ W0 | ⬜ pending |
| 8-01-03 | 01 | 1 | EMP-01(b) | — | N/A | unit | `cd server && npm test -- employer-representation -t "adult-with-override"` | ❌ W0 | ⬜ pending |
| 8-01-04 | 01 | 1 | EMP-01(c) | — | N/A | unit | `cd server && npm test -- employer-representation -t "adult-without-override"` | ❌ W0 | ⬜ pending |
| 8-01-05 | 01 | 1 | EMP-01(d) | — | N/A | unit | `cd server && npm test -- employer-representation -t "turns 18"` | ❌ W0 | ⬜ pending |
| 8-01-06 | 01 | 1 | EMP-01 | — | N/A | unit | `cd server && npm test -- employer-representation -t "malformed"` | ❌ W0 | ⬜ pending |
| 8-01-07 | 01 | 1 | EMP-01 | — | N/A | unit | `cd server && npm test -- employer-representation -t "address fallback"` | ❌ W0 | ⬜ pending |
| 8-01-08 | 01 | 2 | EMP-02 | — | N/A | regression | `cd server && npm test -- form4805-utils` | ✅ | ⬜ pending |
| 8-01-09 | 01 | 2 | EMP-02 | — | N/A | type-check | `cd server && npm run build` | ✅ | ⬜ pending |
| 8-01-10 | 01 | 2 | EMP-02 | — | N/A | regression (shell grep) | See Grep Absence Check in RESEARCH.md §Validation Architecture | ✅ (shell) | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `server/src/lib/employer-representation.ts` — the helper itself (created in Wave 1, stubbed in Wave 0 if needed)
- [ ] `server/src/lib/employer-representation.test.ts` — 4 D-13 cases + malformed-pno + address-fallback test stubs
- [ ] No framework install needed — Vitest 4.1.2 already present in `server/package.json`

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Regenerating historical FK 3057/3059/SKV 4805 PDFs shows patient as employer (minor case) or patient-only (adult without override) | SC-1 (success criterion) | Requires real PDF rendering + visual inspection of government forms; deferred per D-14 to Phase 10 DATA-01 | Phase 10 DATA-01 walkthrough on historical data |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references (employer-representation.ts + .test.ts)
- [ ] No watch-mode flags (Vitest invoked via `npm test`, not `npm test -- --watch`)
- [ ] Feedback latency < 15s
- [ ] `nyquist_compliant: true` set in frontmatter (after planner fills per-task map)

**Approval:** pending
