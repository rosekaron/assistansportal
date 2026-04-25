---
phase: 07-foundation-schema-cleanup
plan: 05
status: complete
subsystem: client/setup-wizard
tags: [setup-wizard, onboarding, fk-decision, patient-relation, swedish-i18n, phase-7]
commits:
  - 6e09db6
requirements: [SCHEMA-03]
dependency_graph:
  requires:
    - 07-01 (profile schema columns fk_decision_start/end + patient_relation_to_guardian must exist)
    - 07-02 (PUT /api/profile whitelist must accept the 3 new field names)
  provides:
    - First-time-setup capture of fk_decision_start, fk_decision_end, patient_relation_to_guardian
  affects:
    - Phase 8 EMP (unblocks derivation of patient_requires_representative default from pno + relation)
    - Phase 9 SLIP (needs fk_decision_start/end for period gating)
tech_stack:
  added: []
  patterns:
    - "Minimal-wizard discipline: only 3 SCHEMA-02 fields added; bank/skatt/anställning deferred to Settings per UI-SPEC §Inventory"
    - "Reuse of PATIENT_RELATION_OPTIONS enum-to-label mapping pattern from Plan 07-04 Settings.tsx"
    - "Empty-string date coercion delegated to server whitelist (`|| null` in profile.ts PUT handler)"
key_files:
  created: []
  modified:
    - client/src/pages/SetupWizard.tsx
decisions:
  - "Kept STEPS array at 4 steps (`Guardian`, `Child & FK`, `Assistants`, `Done`) — no new step, 3 fields appended to existing Step 1 FK Decision block"
  - "`patientRelationToGuardian` defaults to `parent-child` (Kalinga's real brukare relation; matches anhörigassistans norm)"
  - "Date fields are OPTIONAL (no `required` attribute, no Next-button validation block) — guardian can complete onboarding even if FK decision dates are not yet at hand"
  - "No client-side empty-string → null coercion in finish(); server whitelist (Plan 07-02) handles it via `|| null`"
  - "Scope-disciplined: bank details, skattetabell, IBAN, citizenship, employment dates, residence permit expiry, dubbel-assistans flag, patient-requires-representative toggle, split-address fields all intentionally absent from wizard (filled via Settings later)"
metrics:
  duration: "~3 minutes"
  completed: "2026-04-18"
  tasks: 1
  files_modified: 1
---

# Phase 7 Plan 5: SetupWizard Minimal Additions Summary

## One-liner

Extended SetupWizard Step 1 ("Child & FK") with 3 minimal SCHEMA-02 fields (`fkDecisionStart`, `fkDecisionEnd`, `patientRelationToGuardian`) so fresh guardian onboarding captures enough data to unblock Phase 8 (employer representation derivation) and Phase 9 (FK decision period gating); all other Phase 7 new columns intentionally deferred to Settings edit per UI-SPEC §Inventory.

## What was built

### SetupWizard.tsx — exact changes

1. **Imports (line 7 new):**
   ```ts
   import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/controls";
   ```

2. **Constants (lines 14–21 new):** `PATIENT_RELATION_OPTIONS` array with 6 UI-SPEC Swedish labels (Förälder → barn, Make/maka, Barn → vuxet barn, God man, Förvaltare, Annan).

3. **`ProfileForm` interface extension (lines 29–34):**
   ```ts
   interface ProfileForm {
     /* …existing fields… */
     fkDecisionStart: string;
     fkDecisionEnd: string;
     patientRelationToGuardian: string;
   }
   ```

4. **Initial state extension (line 66):**
   ```ts
   fkDecisionStart: "", fkDecisionEnd: "", patientRelationToGuardian: "parent-child",
   ```

5. **Step 1 JSX extension — 3 new inputs inside the existing `FK Decision` block**, placed immediately after the Decision-number / Weekly-hours row:
   - `<Input type="date">` bound to `profile.fkDecisionStart` with label "Beslutet gäller från"
   - `<Input type="date">` bound to `profile.fkDecisionEnd` with label "Beslutet gäller t.o.m."
   - `<Select>` bound to `profile.patientRelationToGuardian` with label "Relation till brukaren", 6 options, helper text "Vanligaste valet: Förälder → barn (anhörigassistans för minderårig)."

6. **`finish()` contract comment (lines 83–85 new):**
   ```ts
   // Wizard sends minimal SCHEMA-02 fields: fkDecisionStart, fkDecisionEnd, patientRelationToGuardian.
   // All other Phase 7 profile fields (addressStreet/Zip/City, dubbelAssistansApproved,
   // patientRequiresRepresentative) use schema defaults; filled later via Settings.
   ```
   The existing `profileApi.update({ ...profile, weeklyHours: weekly, setupDone: true })` call spreads the entire `profile` state object, so the 3 new fields are sent automatically — no change to the call body.

7. **STEPS array unchanged:** `["Guardian","Child & FK","Assistants","Done"]` — no new step; wizard still renders 4 steps preserving the ~2-minute onboarding flow.

### Round-tripping to Settings

The 3 fields persist to `profile.fk_decision_start`, `profile.fk_decision_end`, `profile.patient_relation_to_guardian` columns (added in Plan 07-01) via the PUT `/api/profile` whitelist (extended in Plan 07-02). After finish() → /dashboard → Settings → "Konto & vårdinformation" card → expand "FK-beslut" section → the 3 fields are present with the values entered in the wizard (Plan 07-04 Settings UI reads from the same columns).

## Phase 7 new fields intentionally NOT added to the wizard (scope discipline evidence)

Per UI-SPEC.md §Inventory point 4 ("SetupWizard minimal additions"):

| Field | Table | Deferred to |
|-------|-------|-------------|
| `addressStreet`, `addressZip`, `addressCity` | profile | Settings edit (existing single-line `address` retained) |
| `dubbelAssistansApproved` | profile | Settings FK-beslut section (default `false`) |
| `patientRequiresRepresentative` | profile | Settings FK-beslut section (default `false`) |
| `skattetabell`, `taxScheme` | assistants | Settings Assistants edit dialog (default `null` / `a-skatt`) |
| `bankClearing`, `bankAccount`, `iban` | assistants | Settings Assistants edit dialog (default `""`) |
| `employmentStartDate`, `employmentEndDate` | assistants | Settings Assistants edit dialog (default `null`) |
| `citizenship`, `residencePermitExpiry` | assistants | Settings Assistants edit dialog (default `""` / `null`) |
| `notes` | assistants | Settings Assistants edit dialog (default `""`) |
| `addressStreet/Zip/City` | assistants | Settings Assistants edit dialog (default `""`) |

All 16 deferred columns rely on schema defaults from Plan 07-01 at wizard-close time.

## Verification

### Typecheck

```
cd client && npx tsc --noEmit -p tsconfig.json
```
Completed with zero errors — no stdout / stderr output.

### Acceptance criteria (12/12 pass)

- OK: `PATIENT_RELATION_OPTIONS` present
- OK: Swedish labels `Beslutet gäller från`, `Beslutet gäller t.o.m.`, `Relation till brukaren` present
- OK: Field names `fkDecisionStart`, `fkDecisionEnd`, `patientRelationToGuardian` present
- OK: `SelectItem` imported and used
- OK absent: `skattetabell` (UI-SPEC: skipped in wizard)
- OK absent: `bankClearing` (skipped)
- OK absent: `iban` (skipped)
- OK: STEPS array literal unchanged (`["Guardian","Child & FK","Assistants","Done"]`)

### Round-trip verification

Recommended manual check (not executed here; deferred to Phase 10 DATA-01 end-to-end test):
1. Fresh DB + fresh guardian account
2. Log in → redirected to `/setup`
3. Complete 4 wizard steps; in Step 1 enter values for `fkDecisionStart`, `fkDecisionEnd`, `patientRelationToGuardian`
4. Finish → `/dashboard`
5. Navigate to Settings → Konto & vårdinformation → FK-beslut section → confirm all 3 values pre-populated

## Deviations from Plan

None — plan executed exactly as written. All 8 action steps, all 12 acceptance criteria, zero auto-fix rules triggered.

## Threat Flags

None — this plan adds 3 DOM inputs inside an existing authenticated `/setup` route guarded by `RequireAuth`. All 4 STRIDE entries in the plan's `<threat_model>` remain dispositioned as planned:
- T-07-05-01 (enum tampering): mitigated by Postgres enum at the DB layer (Plan 07-01)
- T-07-05-02 (date disclosure): accept (already guardian's own data)
- T-07-05-03 (wizard DoS via validation block): mitigated — all 3 fields optional, no `required` attribute, empty defaults safe
- T-07-05-04 (pre-setupDone spoofing): mitigated — existing `RequireAuth` JWT gate unchanged

## Known Stubs

None — the 3 fields are fully wired: user input → React state → spread into profileApi.update body → server whitelist (Plan 07-02) → Drizzle `.set()` → Postgres columns (Plan 07-01). No placeholder data, no mocked responses, no TODO markers.

## key-files

### created
_(none)_

### modified

- `client/src/pages/SetupWizard.tsx` — +53 lines: Select import, PATIENT_RELATION_OPTIONS constant, ProfileForm extension, initial-state extension, 3 new Step 1 inputs (2 date + 1 Select), finish() contract comment

## Task Commits

1. **Task 1: Add 3 new fields to SetupWizard Step 1 (Child & FK) and include them in finish() payload** — `6e09db6` (feat)

**Plan metadata commit:** (this SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md bundled atomically)

## Self-Check: PASSED

- [x] `client/src/pages/SetupWizard.tsx` modified (verified via `git show --stat 6e09db6` — 1 file changed, 53 insertions)
- [x] Commit `6e09db6` present in git log (verified `feat(07-05): add 3 minimal Phase 7 fields…`)
- [x] All 8 acceptance-criteria presence greps pass
- [x] All 3 exclusion greps pass (skattetabell, bankClearing, iban absent)
- [x] STEPS array literal unchanged
- [x] `npx tsc --noEmit` exits with zero errors
- [x] No unauthorized scope expansion — only 3 of 21 Phase 7 new columns added to wizard; rest deferred to Settings per UI-SPEC.md

## Next Phase Readiness

Phase 7 complete (5/5 plans). Ready for Phase 8 — Employer Representation Helper:

- **SCHEMA-03 satisfied:** guardian can enter `patient_relation_to_guardian` at first-run setup (wizard) AND during later edits (Settings Plan 07-04)
- **EMP-01 / EMP-02 unblocked:** `resolveEmployerRepresentation()` has real data to derive employer/representative from; `profile.patient_requires_representative` is writeable from Settings and defaults to `false` for new guardians
- **Phase 9 SLIP unblocked on the schema front:** `fk_decision_start` / `fk_decision_end` are captured at onboarding → slip generation can gate on decision validity period

---

*Phase: 07-foundation-schema-cleanup*
*Plan: 05*
*Completed: 2026-04-18*
