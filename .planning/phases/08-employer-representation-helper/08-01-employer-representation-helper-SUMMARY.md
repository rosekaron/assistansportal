---
phase: 08
plan: 01
subsystem: employer-representation-helper
tags: [helper, pdf, compliance, fk-3057, fk-3059, skv-4805, refactor]
dependency-graph:
  requires:
    - phase-07 (patient_requires_representative + split address columns)
  provides:
    - resolveEmployerRepresentation helper (used by Phase 9 salary slip)
  affects:
    - server/src/lib/form4805-utils.ts
    - server/src/routes/pdf.ts
tech-stack:
  added: []
  patterns:
    - pure-function helper (lib/*.ts + co-located .test.ts)
    - end-of-period asOfDate computed by caller (no new Date() default)
    - structured return shape (arbetsgivare / företrädare objects, not pre-formatted strings)
key-files:
  created:
    - server/src/lib/employer-representation.ts
    - server/src/lib/employer-representation.test.ts
  modified:
    - server/src/lib/form4805-utils.ts
    - server/src/lib/form4805-utils.test.ts
    - server/src/routes/pdf.ts
decisions:
  - "Extend Form4805Profile with 6 new fields rather than restructure input contract (RESEARCH Open Q#2)"
  - "asOfDate computed by callers (new Date(end) for /fk3059; new Date(year, month, 0) inside buildForm4805Fields)"
  - "Kept 'Företrädd av' Swedish label default — not used in Phase 8 code, surfaces in Phase 9"
  - "FK 3057 /fk3057 handler untouched per D-10 (no Anordnaren field)"
metrics:
  duration-minutes: 3
  completed-date: 2026-04-19
  tasks-completed: 3
  commits: 3
  tests-added: 16
requirements:
  - EMP-01
  - EMP-02
---

# Phase 08 Plan 01: Employer Representation Helper Summary

Extracted `resolveEmployerRepresentation(profile, asOfDate)` as the authoritative source for employer + representative identity across FK 3059 and SKV 4805 renderers, closing the latent `guardianName`-as-employer bug while preserving guardian signatures per D-09.

## Files Created

- `server/src/lib/employer-representation.ts` — pure helper + `isMinor()` + `EmployerRepresentation` type (~95 lines)
- `server/src/lib/employer-representation.test.ts` — 16 Vitest unit tests covering D-13 cases + edges

## Files Modified

- `server/src/lib/form4805-utils.ts` — `Form4805Profile` extended from 6 to 12 fields; `buildForm4805Fields` calls helper once with end-of-period `asOfDate`; `__employer__` block writes `rep.arbetsgivare.*`; signature (`txtNamnfortydl`) remains guardian per D-09
- `server/src/lib/form4805-utils.test.ts` — fixture extended with 6 new patient/address fields; employer-block assertion updated to expect patient identity; added EMP-02 canary test
- `server/src/routes/pdf.ts` — `/fk3059` handler imports helper and writes `rep.arbetsgivare.name` to `flt_txtNamnAnordnaren[0]`; `/4805` handler's `Form4805Input.profile` gains 6 new fields; `/fk3057` intentionally untouched (D-10)

## Commits

| Task | Description | Hash |
|------|-------------|------|
| 1 | feat(08-01): add resolveEmployerRepresentation helper + unit tests | `189c135` |
| 2 | refactor(08-01): SKV 4805 employer block resolves to PATIENT via helper (EMP-02) | `1b3b7b2` |
| 3 | refactor(08-01): pdf.ts FK 3059 + /4805 use helper; signatures stay guardian | `509f9cb` |

## Decision Resolutions

### D-08 line-number discrepancy (RESEARCH Open Question #1)

CONTEXT D-08 labelled `flt_txtNamnAnordnaren[0]` (pdf.ts:140) as belonging to "FK 3057". Direct code inspection confirmed the field lives inside the `/fk3059` handler (lines 67–234, the Tidsredovisning form), NOT the `/fk3057` handler. The refactor is correct regardless of which physical PDF carries the label — EMP-02 requires that ZERO `guardianName` references remain on employer-adjacent fields, which is now the case. FK 3057's `/fk3057` handler was intentionally left unmodified per D-10 (no Anordnaren field on FK 3057; only Brukare name/pno which were already patient-sourced, and a signature at line 303 which stays guardian per D-09).

### Form4805Profile extension (RESEARCH Open Question #2)

Chose type extension (6 new fields) over input-contract restructure. Minimal diff at the pdf.ts call site (only the `profile` object literal at lines ~382–394 was extended); existing test fixture updated in the same commit. All existing `buildForm4805Fields` assertions remained green after the refactor.

### asOfDate construction (RESEARCH Open Question #3)

Callers compute the date; helper signature is strictly `(profile, Date) → Representation` with no `new Date()` default (prevents historical-regen bug per RESEARCH Pitfall 6):

- `/fk3059` route: `new Date(end)` where `end` is the already-computed YYYY-MM-DD last-day-of-month (pdf.ts:81)
- `buildForm4805Fields`: `new Date(ymYear, ymMonth, 0)` — day 0 of next month = last day of this month

### D-11 Swedish label

Kept CONTEXT default "Företrädd av". Research surfaced "Ställföreträdare" as a more formal alternative but rejected as too formal for a lönespec. Label is not used in Phase 8 code; it surfaces in Phase 9's salary slip renderer.

## Test Count

- `employer-representation.test.ts`: **16 tests** passing (12 `resolveEmployerRepresentation` + 4 `isMinor`)
- `form4805-utils.test.ts`: **17 tests** passing (16 pre-existing + 1 new EMP-02 canary)
- Full server suite: **118 passed / 12 skipped / 130 total** across 15 test files

### D-13 named cases — all green independently

```bash
$ cd server && npm test -- employer-representation -t "minor-by-pno"
  ✓ 1 passed | 15 skipped
$ npm test -- employer-representation -t "adult-with-override"
  ✓ 1 passed | 15 skipped
$ npm test -- employer-representation -t "adult-without-override"
  ✓ 2 passed | 14 skipped   # includes the null-flag sibling case
$ npm test -- employer-representation -t "turns 18"
  ✓ 1 passed | 15 skipped
```

## Grep Gates

### EMP-02 regression gate (D-14) — PASS

```bash
$ grep -rEn "(__employer__|flt_txtNamnAnordnaren)" server/src/ | grep guardianName
# (empty — no employer-adjacent guardianName remains)
```

### D-09 signature preservation gate — PASS (5 ≥ 4)

```bash
$ grep -cE "(txtNamnfortydl|flt_txtKontaktperson|flt_txtNamnteckning)" \
    server/src/routes/pdf.ts server/src/lib/form4805-utils.ts
server/src/routes/pdf.ts:3         # Kontaktperson (:151), Namnteckning2 (:157), Namnteckning (:313)
server/src/lib/form4805-utils.ts:2 # txtNamnfortydl type mention + signature line (:132)
```

### guardianName inventory post-refactor

| File | Count | Lines | Purpose |
|------|-------|-------|---------|
| server/src/routes/pdf.ts | 5 | 121 (helper-fallback object), 151 (Kontaktperson), 157 (Namnteckning2), 313 (FK 3057 Namnteckning), 383 (SKV 4805 input.profile → form4805-utils:132 signature) | All non-employer uses; D-09 preservation |
| server/src/lib/form4805-utils.ts | 2 | 9 (type decl), 132 (signature `txtNamnfortydl`) | Type declaration + signature per D-09 |

The pdf.ts count is 5 rather than the plan's predicted 4 because Task 3 introduced a defensive null-fallback object (line 121) to satisfy the helper's `Pick<Profile, ...>` shape when `prof` is undefined. This is a type-completeness artifact, not an employer-field use.

## Build

```bash
$ cd server && npm run build
> server@1.0.0 build
> tsc
# exits 0, no output — tsc clean
```

## Deviations from Plan

**None** — plan executed exactly as written. Minor corrections:

- **[Rule 3 - Fixture adjustment]** The form4805-utils.test.ts `baseProfile` originally only had legacy `address`/`city`/`zip`. After extending the type with split columns, the helper (per D-07 split-preference) would have used the empty split columns first and then fall back to the legacy single-line — breaking the pre-existing assertion `"Storgatan 1, 11111 Stockholm"`. Populated the split columns in the fixture to match the expected formatted string. No behavior change; test remained green after fixture alignment.

## Downstream Handoff

Phase 9 salary slip renderer can call:

```typescript
import { resolveEmployerRepresentation } from "../lib/employer-representation";

const rep = resolveEmployerRepresentation(profile, lastDayOfPeriod);
// rep.arbetsgivare → "Arbetsgivare: {name} ({pno})"
// if (rep.företrädare) → "Företrädd av: {name} ({pno})"
```

to populate the slip header block (ROADMAP §Phase 9 SC-4). The helper's return shape is deliberately structured (not pre-formatted strings) so the Phase 9 slip layout can decide formatting independently.

## Authentication Gates

None occurred during execution.

## Known Stubs

None. No hardcoded empty values or placeholder text were introduced by this plan. The helper gracefully handles malformed/missing pno per Pitfall 3 (returns `isMinor=false`, representative depends on flag) — this is intentional per T-8-03 graceful-degradation disposition, to be caught visually by Phase 10 DATA-01.

## Threat Flags

None. No new security-relevant surface introduced. The helper is a pure function called from existing renderers (no new network endpoints, no new auth paths, no file access, no schema changes). The threat register's T-8-01 (compliance/disclosure) and T-8-02 (tampering/regression) mitigations are all in place: D-13 unit tests cover the 4 named cases + malformed pno; D-14 grep gate green; D-09 preservation gate green.

## Self-Check: PASSED

- FOUND: server/src/lib/employer-representation.ts
- FOUND: server/src/lib/employer-representation.test.ts
- FOUND: commit 189c135 (Task 1)
- FOUND: commit 1b3b7b2 (Task 2)
- FOUND: commit 509f9cb (Task 3)
- PASS: `cd server && npm test` → 118 passing / 12 skipped
- PASS: `cd server && npm run build` → tsc clean
- PASS: EMP-02 grep absence check (empty result)
- PASS: D-09 preservation gate (5 ≥ 4)
