# Phase 10 — Deferred Items

Items discovered during Phase 10 execution that are out of scope for the
current plan and need to be addressed in a follow-up.

---

## Items logged by plan 10-01

### 1. Pre-existing PII leak in HANDOFF.md (guardian decision needed)

- **File:** `.planning/HANDOFF.md`
- **Line:** 70
- **Content:** mentions the previous-assumed household address (full street + LGH number)
  in plain text — committed before Phase 10 started (see commit `9c38efc`, "docs: pause
  v1.0.1 at 75%")
- **Why out of scope for 10-01:** the security rules for 10-01 require that THIS plan's
  runtime PII never land in `.planning/`. This particular string was already there before
  10-01 started, and it is technically a different address (old household), but it is
  still PII and deserves redaction.
- **Suggested fix:** replace the parenthetical with something like `(legacy profile.address
  was populated with a pre-split single-line value)` and commit as a dedicated
  `chore(10): redact pre-existing PII from HANDOFF.md` — or let the guardian confirm
  redaction scope before acting.
- **Discovered by:** 10-01 continuation executor
- **Priority:** low-to-medium (already committed to origin; history rewrite not
  recommended for a single string that is no longer the current household address,
  but future HANDOFF diffs should avoid the pattern).

### 2. FK decision fields gap (guardian explicit defer — becomes plan 10-04)

- **Requirement:** DATA-01 (profile.fk_decision_no real, start/end dates present)
- **Current state after 10-01:** `fkDecisionNo = "23123123123123"` placeholder,
  `fkDecisionStart/End = null`
- **Why deferred:** guardian did not have FK beslut paper handy at 10-01's Task 2
  checkpoint; chose option B (address-only update now, FK closure later).
- **Acknowledged consequence:** 10-03's FK 3057 PDF UAT will catch the placeholder
  in the header render step. That is expected, NOT a regression.
- **Proposed resolution:** new plan **10-04 Gap-closure: FK decision fields** to be
  created after the main Phase 10 flow (10-02 Assistants → 10-03 PDFs) completes.
  Scope:
  1. Collect real `fkDecisionNo`, `fkDecisionStart` (≤ 2026-03-01),
     `fkDecisionEnd` (≥ 2026-03-31) from guardian.
  2. Issue a second full-update PUT /api/profile.
  3. Rerun the 10-03 FK 3057 header grep to confirm clean.
  4. Mark DATA-01 complete in REQUIREMENTS.md.

---
