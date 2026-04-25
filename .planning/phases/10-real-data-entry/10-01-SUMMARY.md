---
phase: 10-real-data-entry
plan: 01
subsystem: database
tags: [profile, pii, put-whitelist, address-split, d-02, data-entry]

# Dependency graph
requires:
  - phase: 07-foundation-schema-cleanup
    provides: profile.address_street/zip/city columns + PUT whitelist
  - phase: 08-employer-representation-helper
    provides: consumer of profile.addressStreet/Zip/City in FK/SKV/slip renderers
provides:
  - Postgres profile row with split-address fields populated (D-02 split)
  - Legacy single-line address kept in sync with the split fields (D-02 legacy)
  - Carry-forward full-update PUT pattern demonstrated (T-10-04 mitigation exercised)
affects:
  - 10-02 (Assistants data entry)
  - 10-03 (PDF walkthrough UAT — FK 3057 header will still show deferred placeholder)
  - 10-04 (gap-closure plan to be created for FK decision no/start/end — DEFERRED)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Full-update carry-forward: read GET, mutate only target fields, re-send every whitelist field to avoid T-10-04 null-out"
    - "PII-safe execution: guardian values passed via env vars scrubbed immediately after curl, scratch /tmp files deleted post-verify, field names referenced by NAME only in all committed artefacts"

key-files:
  created:
    - .planning/phases/10-real-data-entry/10-01-SUMMARY.md
  modified: []

key-decisions:
  - "FK decision fields (fk_decision_no, fk_decision_start, fk_decision_end) explicitly DEFERRED to gap-closure plan 10-04 per guardian checkpoint response"
  - "Address-only subset of DATA-01 closed; remaining FK portion tracked as partial requirement-completion (10-04 will finish DATA-01)"
  - "D-02 legacy sync implemented: legacy address/city/zip set to the same values as the split fields to keep both representations coherent"
  - "Plan used API base :3001 (not :3000 as literal plan text suggests). Port 3000 is occupied by Remotion Studio on this dev workstation; server/src/index.ts binds to 3001. Minor plan-text discrepancy, not a code change"

patterns-established:
  - "PII routing: guardian inline → env var → curl --data-binary @file → post-PUT scrub of env + /tmp. No PII touches .planning/ or git."
  - "Acceptance-criteria runner: node one-liner that diffs before/after GET snapshots and prints PASS/FAIL per criterion without dumping values."

requirements-completed: []  # DATA-01 is PARTIALLY addressed; full close happens in plan 10-04. Not marked complete here.

# Metrics
duration: ~20min (including Task 1 baseline from prior executor + checkpoint round-trip + Task 2)
completed: 2026-04-24
---

# Phase 10 Plan 01: Profile Data Entry (Partial) Summary

**Split-address fields populated via PUT /api/profile; legacy single-line synced per D-02; FK decision fields deferred to gap-closure plan 10-04 per guardian.**

## Performance

- **Duration:** ~20 min total (baseline capture + checkpoint round-trip + PUT + verification)
- **Started:** 2026-04-24 (continuation agent resumed after guardian checkpoint response)
- **Completed:** 2026-04-24T19:39:00Z
- **Tasks:** 2 (Task 1: baseline GET, Task 2: PUT + verify)
- **Files modified:** 0 source files; 1 new SUMMARY file

## Accomplishments

- `profile.addressStreet`, `addressZip`, `addressCity` populated (D-02 split fields filled)
- `profile.address`, `profile.city`, `profile.zip` synced to match the split fields (D-02 legacy kept coherent)
- All 12 carry-forward fields preserved byte-for-byte (T-10-04 full-update mitigation verified)
- FK decision fields left unchanged per explicit guardian decision; deferred to gap-closure plan 10-04

## Task Commits

1. **Task 1: Baseline GET capture** — no git artifact (terminal-only per plan, `/tmp/profile-before.json` scrubbed post-verify)
2. **Task 2: PUT /api/profile (address fields only; FK fields preserved)** — see plan-close commit below

**Plan-close commit** — data-entry-only plan, so the Task 2 commit and the plan-metadata commit coincide (the SUMMARY + STATE/ROADMAP updates are the only git-visible artefacts of this plan).

## Files Created/Modified

- `.planning/phases/10-real-data-entry/10-01-SUMMARY.md` — this file
- `.planning/STATE.md` — Current Position → Plan 10-01 complete (partial DATA-01), next Plan 10-02
- `.planning/ROADMAP.md` — Phase 10 row progress updated

**Zero source files changed.** Profile row mutations live only in Postgres.

## Decisions Made

1. **FK decision fields deferred to plan 10-04.** Guardian does not have the FK paper handy at checkpoint time. Rather than block the phase, the three fields (`fkDecisionNo`, `fkDecisionStart`, `fkDecisionEnd`) are left at their current values (`23123123123123` / `null` / `null`) and will be closed in a dedicated gap-closure plan 10-04 after Phase 10's main flow completes. Guardian acknowledged and accepted the consequence in option B below.

2. **Known consequence for Plan 10-03 (FK 3057 PDF UAT):** the D-07 grep pattern set includes the literal `23123123123123`. Since that value is still in the profile row, the FK 3057 header render test in 10-03 will flag it. This is expected; the 10-03 UAT will document the hit and route it into plan 10-04 rather than failing the whole phase.

3. **D-02 sync direction.** Both the split fields AND the legacy single-line fields point at the same real current address. Chose to populate legacy from the split fields (not the reverse) because the v1.0.1 renderers (FK/SKV/slip) read `addressStreet/Zip/City` first; legacy is kept only for backward-compat reads elsewhere in the codebase.

4. **Port 3001 vs plan's literal `:3000`.** Server binds to `PORT || 3001` (server/src/index.ts); port 3000 on the dev workstation is a Remotion Studio. Not a code change — just a clarification for the 10-02 and 10-03 executors that API calls target `:3001`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 — Blocking] API port is 3001, not 3000**
- **Found during:** Task 1 baseline capture
- **Issue:** Plan text says `http://localhost:3000/api/profile`; actual API listens on `:3001` (port 3000 is Remotion Studio on this machine)
- **Fix:** Used `:3001` for both GET and PUT; confirmed HTTP 200 + 24-key response body
- **Files modified:** none (runtime-only)
- **Verification:** GET returned 24 fields matching the profile row; PUT returned 200 with updated row

---

**Total deviations:** 1 auto-fixed (1 blocking port mismatch)
**Impact on plan:** Zero. Runtime-only clarification; downstream plans 10-02 and 10-03 should also target `:3001`.

## Issues Encountered

- **FK gap deferral created a new downstream plan.** The guardian's "keep as-is" choice on the three FK fields means DATA-01 is only partially satisfied by 10-01. Plan 10-04 (to be created) will close the remaining FK portion. STATE.md and ROADMAP reflect this: plan 10-01 is DONE, but DATA-01 is NOT marked complete in REQUIREMENTS.md until 10-04 ships.

## Known Stubs

- `profile.fkDecisionNo = "23123123123123"` — known placeholder intentionally retained this run. Routing: plan 10-04 (gap-closure) will collect the real FK beslutsnummer from the guardian and issue a second PUT. Flagged here so the 10-03 verifier does not mistake it for a regression.
- `profile.fkDecisionStart = null`, `profile.fkDecisionEnd = null` — same routing. Required for 10-03's FK 3057 rendering to show a valid decision period; will be filled in 10-04.

## Acceptance Criteria Evidence

All 22 automated criteria evaluated via node one-liner diffing pre-PUT vs post-PUT GET snapshots. Results (names only, values never echoed):

| # | Criterion | Result |
|---|-----------|--------|
| 1 | `addressStreet` non-empty | PASS |
| 2 | `addressZip` matches `^[0-9]{3}[ ]?[0-9]{2}$` (Swedish postcode shape) | PASS |
| 3 | `addressCity` non-empty | PASS |
| 4 | Legacy `address === addressStreet` (D-02 sync) | PASS |
| 5 | Legacy `city === addressCity` (D-02 sync) | PASS |
| 6 | Legacy `zip === addressZip` (D-02 sync) | PASS |
| 7 | `fkDecisionNo` unchanged (deferred to 10-04) | PASS (value unchanged as expected) |
| 8 | `fkDecisionStart` still `null` (deferred to 10-04) | PASS (unchanged as expected) |
| 9 | `fkDecisionEnd` still `null` (deferred to 10-04) | PASS (unchanged as expected) |
| 10–21 | 12 carry-forward fields byte-for-byte preserved (`guardianName/Pno/Email/Phone`, `patientName/Pno`, `weeklyHours`, `defaultPayDay`, `setupDone`, `dubbelAssistansApproved`, `patientRelationToGuardian`, `patientRequiresRepresentative`) | PASS (all 12) |
| 22 | `guardianName` non-empty after PUT (T-10-04 sanity) | PASS |

**Overall:** PASS (22/22).

## PII Leakage Verification

- `/tmp/profile-{before,after,after-put,put-body}.json` scrubbed post-verify — confirmed absent at plan-close
- Env vars `GV_STREET`, `GV_ZIP`, `GV_CITY` unset immediately after the curl
- Grep sweep on staged diff confirmed zero hits for the address string literals

## Next Phase Readiness

- **Plan 10-02 (Assistants data entry)** can proceed now. Use API base `:3001`. Same carry-forward PUT pattern (T-10-04 safe).
- **Plan 10-03 (PDF walkthrough UAT)** will flag the placeholder FK number in the FK 3057 header — expected, routes to 10-04.
- **Plan 10-04 (new, gap-closure)** needs to be created to close the remaining FK portion of DATA-01. Suggested scope: collect real `fkDecisionNo`, `fkDecisionStart` (≤ 2026-03-01), `fkDecisionEnd` (≥ 2026-03-31) from guardian; issue PUT; rerun the 10-03 FK 3057 grep.

## Self-Check: PASSED

- `.planning/phases/10-real-data-entry/10-01-SUMMARY.md` — FOUND
- `.planning/phases/10-real-data-entry/deferred-items.md` — FOUND
- `.planning/STATE.md` — modified, milestone fields corrected back to v1.0.1
- `.planning/ROADMAP.md` — Phase 10 row updated (10-01 partial; 10-04 noted)
- `.planning/REQUIREMENTS.md` — DATA-01 set to Partial
- PII grep (street-name + postcode substrings the guardian supplied at runtime) across all committed content: 0 hits. Exact regex kept out of this file to avoid false-positives on future grep sweeps.
- Pre-existing PII leak in `HANDOFF.md:70` noted in `deferred-items.md` (not touched by 10-01 — predates this work)

---
*Phase: 10-real-data-entry*
*Completed: 2026-04-24*
