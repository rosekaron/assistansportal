---
phase: 07-foundation-schema-cleanup
plan: 04
status: complete
subsystem: ui
tags: [settings, dialog, collapsible-section, swedish-i18n, forms, fk-beslut, assistants, profile, phase-7]
commits:
  - 9eec206
  - f285f01
requirements: [SCHEMA-03]
dependency_graph:
  requires:
    - 07-01 (assistants + profile schema columns)
    - 07-02 (PUT whitelists accept the new field names)
    - 07-03 (Scheduling card removed — clean page rhythm for new sections)
  provides:
    - Guardian-facing edit surface for all 10 new assistants columns + 5 new profile columns
    - Reusable `CollapsibleSection` local helper (stateless; parent owns open state)
    - Swedish-verbatim label table per UI-SPEC.md copywriting contract (D-12)
  affects:
    - Plan 07-05 SetupWizard (reuses PATIENT_RELATION_OPTIONS + date-input patterns)
    - Phase 8 EMP (consumes profile.patient_requires_representative via UI-entered value)
    - Phase 9 SLIP (consumes assistants.bank_clearing / bank_account / iban / skattetabell / tax_scheme via UI-entered values)
    - Phase 10 DATA (enters real values through this UI — DATA-02 assistants, DATA-01 profile)
tech_stack:
  added: []
  patterns:
    - "CollapsibleSection helper: stateless React component, parent owns open state, aria-expanded + chevron rotation (ChevronRight ↔ ChevronDown)"
    - "Two-section collapsible dialog pattern (D-10/D-11): Personuppgifter open-by-default; secondary section collapsed-by-default"
    - "max-w-lg dialog exception (UI-SPEC.md §Spacing): reserved for Assistants edit dialog only; other dialogs stay max-w-md/sm"
    - "Enum-to-label mapping constants (TAX_SCHEME_OPTIONS, PATIENT_RELATION_OPTIONS) collocated with Settings.tsx for single-file locality"
    - "Empty-string date → null coercion before mutation payload (aligns with nullable Date columns from Plan 07-01)"
key_files:
  created: []
  modified:
    - client/src/pages/Settings.tsx
key_decisions:
  - "D-11 honored: Personuppgifter open-by-default, secondary section (FK-beslut / Anställning & ekonomi) collapsed-by-default"
  - "Reused existing SettingsField / ToggleRow / Input / Select / Dialog primitives — zero new components introduced (UI-SPEC.md §Design System contract)"
  - "Guardian name field kept in Personuppgifter section per D-09 (single-line address retained on profile edit)"
  - "taxScheme defaults to 'a-skatt' on new-assistant state — matches Swedish anhörig-model norm"
  - "Dialog width raised max-w-md → max-w-lg exclusively for Assistants edit dialog (17 fields across 2 grid-cols-2 rows justify ~32rem); invite + remove-confirm + self-register dialogs untouched"
patterns_established:
  - "Collapsible section: `<button aria-expanded>` + chevron glyph + conditional body render in parent-owned state tuple `{ person: bool, fk|employment: bool }`"
  - "Two-dialog, two-source-of-truth saves: profileApi.update vs assistantsApi.update both accept the new whitelisted columns from Plan 07-02 with no client-side transformation beyond empty-string → null for date fields"
requirements_completed: [SCHEMA-03]
metrics:
  duration: "~12 minutes (build + verify) + human verification window"
  completed: "2026-04-18"
  tasks: 3
  files_modified: 1
---

# Phase 7 Plan 4: Settings Collapsible Sections + New Field Surface Summary

**Settings.tsx gains two-section collapsible UI for Profile and Assistants edit dialog; 15 new guardian-editable fields (5 FK-beslut on profile, 10 Anställning & ekonomi on assistants) wired to existing mutations with Swedish labels verbatim from UI-SPEC.md.**

## Performance

- **Duration:** ~12 minutes of agent time across Tasks 1–2 plus a human verification window on Task 3
- **Started:** 2026-04-18T21:45:31+02:00 (Task 1 commit timestamp)
- **Completed:** 2026-04-18T21:47:48+02:00 (Task 2 commit timestamp); Task 3 human-verify resumed with signal "verified"
- **Tasks:** 3 (2 code + 1 human-verify checkpoint)
- **Files modified:** 1 (`client/src/pages/Settings.tsx`)

## Accomplishments

- Assistants edit dialog now renders 2 collapsible sections: **Personuppgifter** (7 fields, open by default) + **Anställning & ekonomi** (10 new fields, collapsed by default) — 17 fields total across `grid-cols-2` paired rows per UI-SPEC.md layout rules
- Profile "Konto & vårdinformation" card now renders as single Card with 2 collapsible sections: **Personuppgifter** (guardian + patient + address, open) + **FK-beslut** (5 new fields, collapsed)
- All 15 new fields persist round-trip via existing `profileApi.update` / `assistantsApi.update` mutations (server whitelists from Plan 07-02 accept the payload, DB columns from Plan 07-01 store it)
- Dialog width raised `max-w-md` → `max-w-lg` exclusively for the Assistants edit dialog per UI-SPEC.md justification
- Zero new primitive components introduced — `CollapsibleSection` is a thin stateless local helper reusing existing `ChevronRight` / `ChevronDown` glyphs and `SectionLabel` typography token

## Rendered field counts

### Assistants edit dialog (17 fields, 2 sections)

| Section | Count | Fields |
|---------|-------|--------|
| Personuppgifter (open) | 7 | Fullständigt namn *, Personnummer, Telefon, E-post, Gatuadress, Postnummer, Ort |
| Anställning & ekonomi (collapsed) | 10 | Anställningsstart, Anställning slutar, Medborgarskap, Uppehållstillstånd giltigt t.o.m., Skattetabell, Skatteform (A-skatt/F-skatt), Clearingnummer, Kontonummer, IBAN, Anteckningar |

### Profile "Konto & vårdinformation" (14 fields, 2 sections)

| Section | Count | Fields |
|---------|-------|--------|
| Personuppgifter (open) | 9 | Fullständigt namn, Personnummer, E-post, Telefon, Brukarens namn, Brukarens personnummer, Gatuadress, Ort, Postnummer |
| FK-beslut (collapsed) | 5 new + 2 existing = 7 | Beslutsnummer, Beslutet gäller från, Beslutet gäller t.o.m., Relation till brukaren (6-value Select), Veckotimmar enligt beslut, Dubbel assistans beviljad (ToggleRow), Brukaren företräds av guardian (ToggleRow) |

## Initial state (verified visually by orchestrator)

- Profile card `aria-expanded="true"` on Personuppgifter header, `aria-expanded="false"` on FK-beslut header on first paint
- Assistants edit dialog opens with `aria-expanded="true"` on Personuppgifter, `aria-expanded="false"` on Anställning & ekonomi — resets to this state on every `editTarget` change via `setEditSectionOpen({ person: true, employment: false })` inside the populate-effect
- Chevron glyph toggles `ChevronRight` ↔ `ChevronDown` on click; entire header row is keyboard-focusable `<button type="button">`

## Round-trip persistence (verified)

Two round-trip confirmations captured during Task 3 human-verify:

1. **Profile:** Set `Beslutet gäller från = 2026-01-01` → click **Spara** → `PUT /api/profile` 200 OK → page refresh → value present in the date input.
2. **Assistants:** Set `IBAN = SE35 5000 0000 0549 1000 0003`, `Skattetabell = 33` → click **Spara ändringar** → `PUT /api/assistants/:id` 200 OK → close + reopen dialog → both values pre-populated from server.

## Task Commits

1. **Task 1: Add collapsible sections + 10 new fields to Assistants edit dialog (max-w-lg)** — `9eec206` (feat)
2. **Task 2: Refactor Profile into 2 collapsible sections + add 5 FK-beslut fields** — `f285f01` (feat)
3. **Task 3: Human-verify checkpoint** — no code commit (verification-only gate); orchestrator resumed with signal "verified"

**Plan metadata commit:** (this SUMMARY.md + STATE.md + ROADMAP.md + REQUIREMENTS.md bundled atomically)

## Files Created/Modified

- `client/src/pages/Settings.tsx` — +310/-91 lines cumulative across both commits: added `CollapsibleSection` helper, `TAX_SCHEME_OPTIONS` + `PATIENT_RELATION_OPTIONS` enum mappings, extended `FormState` (5 new keys) and `editForm` (13 new keys + email), added `profileSectionOpen` / `editSectionOpen` state tuples, rewrote Profile "Konto & vårdinformation" card and Assistants edit Dialog JSX using two-section pattern, raised dialog width to `max-w-lg`, imported `ChevronDown` from lucide-react.

## Decisions Made

- **Dialog width:** Raised `max-w-md` → `max-w-lg` on Assistants edit dialog only (28rem → 32rem). Other dialogs (invite, remove-confirm, self-register) stay at their existing widths to preserve visual hierarchy. Matches UI-SPEC.md §Spacing justification.
- **Date field null coercion:** Empty-string date inputs (`employmentStartDate`, `employmentEndDate`, `residencePermitExpiry`, `fkDecisionStart`, `fkDecisionEnd`) are converted to `null` in the mutation payload — avoids Postgres rejecting empty string as invalid date literal. Aligns with nullable `date` columns from Plan 07-01.
- **skattetabell coercion:** Empty string → `null`; non-empty → `parseInt(v, 10)`. Matches `integer | null` column type.
- **Default enum values:** `taxScheme` defaults to `"a-skatt"` (matches anhörig-model norm); `patientRelationToGuardian` defaults to `"parent-child"` (matches Rose + Mikael's real relation to the brukare, Kalinga's actual users).
- **Section-open state reset:** Every time `editTarget` changes, `editSectionOpen` resets to `{ person: true, employment: false }` so each assistant's dialog opens in the canonical initial state regardless of prior session's toggle history.
- **No new primitives:** `CollapsibleSection` kept as local file-scoped helper, not moved to `@/components/ui/*`. Can be promoted later if reused outside Settings.tsx.

## Deviations from Plan

None — plan executed exactly as written. Swedish labels, field order, layout pairings, and collapsible state initialization all match UI-SPEC.md verbatim. No auto-fix rules triggered.

## Issues Encountered

None during Tasks 1–2. Task 3 human-verify checkpoint completed cleanly on first attempt; orchestrator reported regression spot-check passing (no Scheduling card, Payroll rates + Google Calendar cards intact).

## User Setup Required

None — no external service configuration required. All changes are client-side UI reusing existing API endpoints and DB columns from Plans 07-01 / 07-02.

## Self-Check: PASSED

- [x] `client/src/pages/Settings.tsx` modified (verified via `git show --stat`)
- [x] Commit `9eec206` present in git log (verified `feat(07-04): add collapsible sections…`)
- [x] Commit `f285f01` present in git log (verified `feat(07-04): refactor Profile…`)
- [x] All 10 new assistants labels present in source (Task 1 acceptance grep criteria satisfied and confirmed by orchestrator visual verification)
- [x] All 5 new profile labels present in source (Task 2 acceptance grep criteria satisfied and confirmed by orchestrator visual verification)
- [x] `max-w-lg` applied to Assistants edit dialog only
- [x] Round-trip persistence verified by orchestrator for both tables

## Next Phase Readiness

- **Plan 07-05 (SetupWizard) unblocked:** Can reuse `PATIENT_RELATION_OPTIONS` constant and date-input pattern for first-time-setup prompts (3 fields: `fkDecisionStart`, `fkDecisionEnd`, `patientRelationToGuardian`).
- **Phase 8 (EMP) unblocked:** `profile.patient_requires_representative` now editable from Settings — guardian can toggle the adult-with-god-man override that `resolveEmployerRepresentation()` will read.
- **Phase 9 (SLIP) unblocked on the UI front:** All assistant fields consumed by salary slip renderer (bank_clearing, bank_account, iban, skattetabell, tax_scheme) are now guardian-enterable. Live slip header and body still need Phase 9 code.
- **Phase 10 (DATA) unblocked:** Real brukare pno, FK beslut, bank details, and employment dates can now be entered through Settings — the DATA-01 / DATA-02 acceptance criteria (no `TBD` / `000000-0000` placeholders) become achievable via this UI.

No blockers. Phase 7 is 4 of 5 plans complete; only 07-05 (SetupWizard) remains.

---

*Phase: 07-foundation-schema-cleanup*
*Plan: 04*
*Completed: 2026-04-18*
