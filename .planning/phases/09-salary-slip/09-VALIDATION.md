---
phase: 09
slug: salary-slip
status: approved
nyquist_compliant: true
wave_0_complete: true
created: 2026-04-19
approved: 2026-04-19
---

# Phase 09 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.2 (server/ and client/ both, per `server/package.json:vitest ^4.1.2`) |
| **Config file** | `server/vitest.config.ts` (existing, shared by all `server/src/**/*.test.ts`) |
| **Quick run command** | `cd server && npm test -- --run payrollSlipUtils` |
| **Full suite command** | `cd server && npm test && cd ../client && npm test` |
| **Estimated runtime** | Quick: ~2s (single file). Full server: ~20-30s. Full both: ~60s. |

---

## Sampling Rate

- **After every task commit:** `cd server && npm test -- --run payrollSlipUtils` (or the nearest relevant `--run` filter for the task)
- **After every plan wave:** `cd server && npm test` (full server suite) plus `cd client && npm test` when client code touched in the wave
- **Before `/gsd-verify-work`:** Both full suites must be green
- **Max feedback latency:** ~2 seconds on the quick unit suite; ~60 seconds on the full cross-project run

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| T-09-01 | 01 | 1 | SLIP-05, SLIP-06, SLIP-07 | — | Additive schema push; no data loss | schema/invariant | `cd server && npx tsc --noEmit -p tsconfig.json && npm run db:push -- --dry-run` | ✅ schema.ts exists | ⬜ pending |
| T-09-02 | 01 | 1 | SLIP-06 | T-09 V5 (Input Validation) | PUT whitelist gates the 3 new fields (client-side spoof ignored) | integration | `cd server && npm test -- --run assistants-put profile-put` | ❌ W0 — may extend existing tests | ⬜ pending |
| T-09-03 | 01 | 1 | SLIP-05, SLIP-06, SLIP-07 | — | drizzle-kit push is idempotent | manual/schema | `cd server && npm run db:push` then `psql -c '\d payment_slips'` | n/a | ⬜ pending |
| T-09-04 | 02 | 2 | — | — | Wave 0 smoke: pdfkit renders å/ä/ö | smoke | `cd server && node -e "require('pdfkit')"` plus render smoke script | ❌ W0 — pdfkit install | ⬜ pending |
| T-09-05 | 02 | 2 | SLIP-03, SLIP-04, SLIP-07 | T-09 V7 (no PII logging) | `buildAnhorigSlip` pure; no console.log on fields/pno | unit | `cd server && npm test -- --run payrollSlipUtils` | ❌ W0 — `server/src/lib/payrollSlipUtils.test.ts` | ⬜ pending |
| T-09-06 | 02 | 2 | SLIP-03 | — | Renderer returns Buffer starting with `%PDF-` | unit | `cd server && npm test -- --run pdfSlipRenderer` | ❌ W0 — smoke integrated into payrollSlipUtils.test.ts or colocated | ⬜ pending |
| T-09-07 | 03 | 3 | SLIP-01, SLIP-05 | T-09-22, T-09-23, T-09-24, T-09-28 | 409 approval gate, 400 rate-NULL gate, idempotent slip allocation, 401 on missing JWT | integration | `cd server && npm test -- --run pdf-lonespec` | ❌ W0 — `server/src/routes/__tests__/pdf-lonespec.test.ts` | ⬜ pending |
| T-09-08 | 03 | 3 | SLIP-02 | T-09-20, T-09-21, T-09-28 | JWT-only assistantId read (no query/body leak), listing scoped to req.assistantId | integration | `cd server && npm test -- --run "pdf-lonespec\|assistant-slips"` | ❌ W0 — may merge into pdf-lonespec.test.ts | ⬜ pending |
| T-09-09 | 04 | 4 | SLIP-01, SLIP-02 | — | Typed client helpers; auth header attached by existing fetch wrapper | type/compile | `cd client && npx tsc --noEmit` | ✅ api.ts exists | ⬜ pending |
| T-09-10 | 04 | 4 | SLIP-01 | — | Disabled-state labels reflect server-enforced gates | component/manual | `cd client && npm test -- --run Monthly` (if suite exists) + checkpoint T-09-13 | ⚠️ Optional unit; manual-verified | ⬜ pending |
| T-09-11 | 04 | 4 | SLIP-02 | T-09-20 | List displays only JWT-bound assistant's slips (server-enforced; UI renders what server returns) | component/manual | `cd client && npm test -- --run AssistantDashboard` (if suite exists) + checkpoint T-09-13 | ⚠️ Optional unit; manual-verified | ⬜ pending |
| T-09-12 | 04 | 4 | SLIP-06 | T-09 V5 | Settings persists the 3 assistant fields + defaultPayDay through existing save mutations | component/manual | `cd client && npm test -- --run Settings` (if suite exists) + checkpoint T-09-13 | ⚠️ Optional unit; manual-verified | ⬜ pending |
| T-09-13 | 04 | 4 | SLIP-01, SLIP-02, SLIP-06 | — | Visual confirmation of all four UI surfaces on real data | manual checkpoint | checkpoint:human-verify (see Manual-Only Verifications below) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Note: Task IDs use a plan.task composite (e.g. T-09-07 = Plan 03 Task 1) rather than sequential-across-phase numbering, matching how the plans reference them.*

---

## Wave 0 Requirements

Wave 0 artifacts required before Phase 9 task work starts. All ship inside the plans listed (not a separate Wave 0 plan):

- [x] `server/src/routes/__tests__/pdf-lonespec.test.ts` — integration tests for SLIP-01, SLIP-02 (/me), SLIP-05 (shipped by Plan 03 Task 1)
- [x] `server/src/routes/__tests__/assistant-slips.test.ts` — listing endpoint tests (shipped by Plan 03 Task 2; may be merged into `pdf-lonespec.test.ts` per planner discretion)
- [x] `server/src/lib/payrollSlipUtils.test.ts` — Vitest suite for SLIP-03 + SLIP-04 (shipped by Plan 02 Task 2)
- [x] `pdfkit@^0.18.0` + `@types/pdfkit@^0.17.6` — installed by Plan 02 Task 1 (Wave 2) before `pdfSlipRenderer.ts` compiles
- [x] `server/src/lib/pdfSlipRenderer.ts` smoke test confirming å/ä/ö render — shipped by Plan 02 Task 1
- [x] Extension of existing `server/src/routes/__tests__/` for SLIP-06 PUT whitelist (assistants + profile) — Plan 01 Task 2 coverage

All test scaffolds are created inside their owning plan's first task (per CLAUDE Nyquist rule — no MISSING references remain after Plan N Task 1).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Rendered PDF visually matches ROADMAP §198-228 mock (monospace-ish, black-on-white, A4, no logo) | SLIP-03, SLIP-04 | Pixel-level layout comparison is out of scope for golden-fixture testing (D-14 explicitly defers PDF goldens to Phase 10 DATA-03) | Open `/tmp/lonespec-sample.pdf` in a viewer after running the Wave 2 smoke; confirm å/ä/ö render correctly, right-aligned numeric columns align, Företrädd av line appears/absents per profile, footer asterisk note present |
| Monthly.tsx Lönespec button states render correctly (enabled / `Lönekörning ej godkänd` / `Timlön saknas`) | SLIP-01 | Requires live data fixtures + visual confirmation of disabled-state styling | Plan 04 Task 5 checkpoint: seed one approved assistant-month + one draft + one with NULL `hourlyRateOverride`; open `/monthly/2026-03`; confirm the three distinct states |
| AssistantDashboard Lönespecifikationer list shows Rose's slips only, sorted newest-first, with working download buttons | SLIP-02 | Cross-user visual check + download UX check | Plan 04 Task 5 checkpoint: log in as Rose, confirm 3 seeded slips appear in 2026-03, 2026-02, 2026-01 order; click download → PDF opens; log in as Mikael, confirm only Mikael's slips appear |
| Settings persists salary_model / hourly_rate_override / payment_method / default_pay_day through the existing Spara buttons | SLIP-06 | Existing Settings save flow is a full-form PUT — no per-field unit test exists | Plan 04 Task 5 checkpoint: open Assistants edit dialog, change all 3 fields, Spara, reload page, confirm values persisted; same for Profile default_pay_day |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave 0 dependencies (all plans audited; every `<verify>` block includes an `<automated>` command or is a `checkpoint:human-verify` with explicit manual instructions per Plan 04 Task 5)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (only T-09-13 is purely manual, sandwiched between the Plan 04 auto tasks T-09-09..T-09-12 which each have type-check or component verify)
- [x] Wave 0 covers all MISSING references (no `<automated>MISSING</automated>` blocks remain — all test files are authored in the first task of their owning plan)
- [x] No watch-mode flags (all commands use `--run` or equivalent; no `vitest --watch`)
- [x] Feedback latency < 60s on full run, < 2s on quick run
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-04-19
