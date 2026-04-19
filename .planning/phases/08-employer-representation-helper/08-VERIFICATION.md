---
phase: 08-employer-representation-helper
verified: 2026-04-19T08:42:00Z
status: human_needed
score: 10/10 programmatic truths verified; 1 SC deferred to Phase 10 visual walkthrough
requirements_coverage:
  - id: EMP-01
    status: satisfied
    evidence: "server/src/lib/employer-representation.ts exports resolveEmployerRepresentation + isMinor + EmployerRepresentation type; 16 Vitest tests pass (12 resolveEmployerRepresentation + 4 isMinor) covering D-13 minor-by-pno, adult-with-override, adult-without-override (flag=false AND null), turns-18 boundary (±1 day), malformed pno, and address fallback"
  - id: EMP-02
    status: satisfied
    evidence: "form4805-utils.ts:103-105 writes rep.arbetsgivare.{name,pno,address} to __employer__ block; pdf.ts:150 writes rep.arbetsgivare.name to flt_txtNamnAnordnaren[0]; grep -rEn '(__employer__|flt_txtNamnAnordnaren)' server/src/ | grep guardianName returns empty (exit 1)"
human_verification:
  - test: "Phase 10 DATA-01 — Regenerate historical FK 3057 PDF and visually verify employer/representative fields"
    expected: "Brukare block shows patient name + pno; Namnteckning block shows guardian name"
    why_human: "Requires opening actual generated PDF and reading government form output; no headless PDF text extraction available"
  - test: "Phase 10 DATA-01 — Regenerate historical FK 3059 PDF and visually verify Anordnaren section"
    expected: "flt_txtNamnAnordnaren[0] shows patient name (not guardian); flt_txtKontaktperson[0] + flt_txtNamnteckning2[0] still show guardian name"
    why_human: "Requires visual PDF inspection to confirm PDF field values render correctly through pdf-lib.setText() + form.flatten()"
  - test: "Phase 10 DATA-01 — Regenerate historical SKV 4805 PDF and visually verify __employer__ block"
    expected: "Employer block (duplicate-named txtNamn[0] index 0) shows patient name/pno/address; signature clarification txtNamnfortydl[0] still shows guardian name"
    why_human: "Requires visual PDF inspection — duplicate-named field index [0] vs [1] dispatch in pdf.ts:423-434 is unit-tested at the field-map level but not verified end-to-end against the rendered PDF"
  - test: "Adult-with-override toggle round-trip"
    expected: "After setting patient_requires_representative=true on adult patient in Settings → regenerate SKV 4805 → företrädare block populated on document"
    why_human: "Requires UI + DB + PDF path integration — helper returns representative correctly (unit-tested) but full stack verification deferred to Phase 10"
---

# Phase 08: Employer Representation Helper Verification Report

**Phase Goal:** A single `resolveEmployerRepresentation()` helper is the authoritative source for the employer-name + representation fields on every document the platform produces — closing the latent FK 3057/3059/SKV 4805 bug where `guardianName` was used as the employer, and giving the upcoming salary slip a correct, reusable input.

**Verified:** 2026-04-19T08:42:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #   | Truth | Status | Evidence |
| --- | ----- | ------ | -------- |
| 1 | Helper returns structured shape with arbetsgivare always = patient identity | VERIFIED | server/src/lib/employer-representation.ts:85-98 returns `{arbetsgivare:{name,pno,address}, företrädare, isMinor}` with patientName/patientPno sourced from profile; 16 tests assert shape |
| 2 | Minor patient always returns non-null företrädare regardless of flag (D-03) | VERIFIED | employer-representation.ts:80-84 `needsRep = minor || override`; test (a) line 21-28 asserts minor + flag=false → företrädare populated |
| 3 | Adult + patient_requires_representative=true returns non-null företrädare (D-04) | VERIFIED | test (b) lines 30-39 asserts adult pno + flag=true → företrädare.name="Rose Karon" |
| 4 | Adult + flag=false/null returns företrädare=null (D-04) | VERIFIED | tests (c) lines 41-48 and (c') lines 50-57 both assert företrädare toBeNull |
| 5 | Patient turning 18 during report month classified adult end-of-period (D-02) | VERIFIED | test (d) lines 59-67 uses pno 200803151234 + asOfDate 2026-03-31 → isMinor=false; sibling test (d') lines 69-77 uses 2026-03-14 → isMinor=true |
| 6 | SKV 4805 `__employer__` block writes patient (not guardian) | VERIFIED | form4805-utils.ts:103-105 assigns rep.arbetsgivare.{name,pno,address}; form4805-utils.test.ts:172-174 asserts "Liam Karon" / "201501011234" / split address |
| 7 | FK 3059 flt_txtNamnAnordnaren[0] writes patient name | VERIFIED | pdf.ts:150 `fields["...flt_txtNamnAnordnaren[0]"] = rep.arbetsgivare.name`; grep confirms no guardianName on this line |
| 8 | Guardian signature/contact fields remain guardian-sourced (D-09) | VERIFIED | pdf.ts:151 flt_txtKontaktperson, :157 flt_txtNamnteckning2, :313 flt_txtNamnteckning all = `prof?.guardianName`; form4805-utils.ts:132 txtNamnfortydl = profile.guardianName; form4805-utils.test.ts:192 asserts "Anna Svensson" |
| 9 | EMP-02 grep regression gate empty | VERIFIED | `grep -rEn "(__employer__\|flt_txtNamnAnordnaren)" server/src/ \| grep guardianName` returns empty (exit 1) |
| 10 | Unit test suite covers D-13 cases + edges + build clean | VERIFIED | 16 tests pass in employer-representation.test.ts; `npm test` → 118 passed / 12 skipped / 130 total; `npm run build` → tsc clean |

**Programmatic Score:** 10/10 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
| -------- | -------- | ------ | ------- |
| `server/src/lib/employer-representation.ts` | Helper + isMinor + EmployerRepresentation type | VERIFIED | 99 lines; exports confirmed via Grep: `export function resolveEmployerRepresentation`, `export function isMinor`, `export type EmployerRepresentation` |
| `server/src/lib/employer-representation.test.ts` | 11+ Vitest tests covering D-13 + edges | VERIFIED | 180 lines; 12 `it(...)` blocks in resolveEmployerRepresentation describe + 4 in isMinor describe = 16 tests pass |
| `server/src/lib/form4805-utils.ts` | Form4805Profile extended; helper called; __employer__ block uses patient | VERIFIED | Type extended to 12 fields (line 7-23 shows 6 guardian/legacy + 6 Phase 8 additions); line 5 imports helper; line 91 calls `resolveEmployerRepresentation(profile, lastDayOfPeriod)`; lines 103-105 write rep.arbetsgivare.* |
| `server/src/routes/pdf.ts` | FK 3059 Anordnaren + SKV 4805 input use helper; signatures stay guardian | VERIFIED | Line 8 imports helper; line 119 calls helper with defensive null-fallback object (lines 119-124); line 150 writes rep.arbetsgivare.name; lines 151, 157, 313 preserve guardianName; lines 383-395 build extended Form4805Profile |

### Key Link Verification

| From | To | Via | Status | Details |
| ---- | -- | --- | ------ | ------- |
| form4805-utils.ts:91 | resolveEmployerRepresentation | imported from ./employer-representation; called once inside buildForm4805Fields with profile + new Date(ymYear, ymMonth, 0) | WIRED | Import at line 5; call at line 91; rep.arbetsgivare.name/pno/address flow to lines 103-105 |
| pdf.ts:119 (inside /fk3059) | resolveEmployerRepresentation | imported from ../lib/employer-representation; called with prof ?? defensive-fallback and new Date(end) | WIRED | Import at line 8; call at lines 119-124; rep.arbetsgivare.name written to line 150 |
| pdf.ts /4805 handler | Form4805Profile extended shape | input.profile at lines 382-396 carries 6 new patient/override/split-address fields | WIRED | Lines 390-395 spread `prof?.patientName`, `prof?.patientPno`, `prof?.patientRequiresRepresentative`, `prof?.addressStreet/Zip/City` (with ?? fallbacks) |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
| -------- | ------------- | ------ | ------------------ | ------ |
| form4805-utils.ts buildForm4805Fields | profile (Form4805Profile) | Caller passes Form4805Input — populated in pdf.ts:382-396 from `prof` Drizzle row | Yes — pdf.ts:377 `db.select().from(profile).limit(1)` | FLOWING |
| pdf.ts /fk3059 rep | prof (Profile row) | `db.select().from(profile).limit(1)` at line 84 | Yes — live DB query | FLOWING |
| pdf.ts /4805 input.profile | prof (Profile row) | `db.select().from(profile).limit(1)` at line 377 | Yes — live DB query | FLOWING |
| form4805-utils.test.ts baseProfile | Test fixture | Hardcoded with "Liam Karon" / "201501011234" + split address | N/A (test fixture — by design) | FLOWING (fixture) |

All data-flow checks pass. The helper is called inside handlers that fetch live profile rows from Postgres via Drizzle. Tests use representative hardcoded fixtures by design.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
| -------- | ------- | ------ | ------ |
| Helper unit tests | `cd server && npm test -- employer-representation` | 1 file / 16 tests passed in 121ms | PASS |
| Full server suite | `cd server && npm test` | 15 files / 118 passed / 12 skipped (130 total) in 582ms | PASS |
| TypeScript build | `cd server && npm run build` | tsc exits 0, no output | PASS |
| EMP-02 grep regression | `grep -rEn "(__employer__\|flt_txtNamnAnordnaren)" server/src/ \| grep guardianName` | empty (exit 1) | PASS |
| D-09 signature preservation | Signature/contact fields grep | 6 matches (pdf.ts:151/157/313; form4805-utils.ts:102/132; test assertion) — well above threshold ≥ 4 | PASS |
| Module exports shape | `grep export` on helper | 3 exports: `resolveEmployerRepresentation`, `isMinor`, `EmployerRepresentation` | PASS |
| Commit trace | `git log --oneline` | 189c135 (Task 1), 1b3b7b2 (Task 2), 509f9cb (Task 3), 153cf61 (docs) all present | PASS |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
| ----------- | ---------- | ----------- | ------ | -------- |
| EMP-01 | 08-01 | `resolveEmployerRepresentation()` helper returns correct `{arbetsgivareName, arbetsgivarePno, företrädareName, företrädarePno, isMinor}` based on minor-status derived from patient pno + `patient_requires_representative` override | SATISFIED | Helper at server/src/lib/employer-representation.ts; 16 tests cover all D-13 cases + null-handling + address fallback + malformed pno. **Note:** The literal REQUIREMENTS.md shape describes flat fields; CONTEXT D-06 overrode this to structured `{arbetsgivare:{name,pno,address}, företrädare:{name,pno}\|null, isMinor}` — semantically equivalent; decision locked in planning. |
| EMP-02 | 08-01 | FK 3057, FK 3059, SKV 4805, and salary slip renderers all use the helper — zero direct `profile.guardianName` references for the employer field | SATISFIED | FK 3059 pdf.ts:150 + SKV 4805 form4805-utils.ts:103-105 call helper; FK 3057 has no employer field per D-10 (Brukare at pdf.ts:306-307 already patient-sourced since before Phase 8); salary slip is Phase 9 scope. EMP-02 grep regression gate returns empty. |

No orphaned requirements. REQUIREMENTS.md traceability (lines 111-112) maps EMP-01 + EMP-02 to Phase 8 and marks both Complete; plan frontmatter at 08-01-employer-representation-helper-PLAN.md:14-16 declares both IDs.

### Anti-Patterns Scan

Files scanned: `server/src/lib/employer-representation.ts`, `server/src/lib/employer-representation.test.ts`, `server/src/lib/form4805-utils.ts`, `server/src/lib/form4805-utils.test.ts`, `server/src/routes/pdf.ts`

| File | Line | Pattern | Severity | Impact |
| ---- | ---- | ------- | -------- | ------ |
| employer-representation.ts | — | No TODO/FIXME/HACK/stub comments; no empty implementations; no hardcoded placeholder fallbacks beyond graceful `??""` null-handling | — | — |
| pdf.ts | 119-124 | Defensive fallback object with 9 null fields passed when `prof` is undefined | INFO | Documented in SUMMARY — type-completeness artifact; not a stub (profile table has a single row by design in single-tenant v1, so `prof` undefined would indicate profile not yet created, not a data-flow bug). Increments pdf.ts `guardianName` count from expected 4 → 5 (line 121 is `guardianName: null` as type filler). |
| pdf.ts | 418, 426 | `__employer__` string literals in dispatch logic | INFO | These are form4805-utils' internal key convention, not guardianName references — correctly excluded from EMP-02 grep gate by the composite `| grep guardianName` filter. |

No blocker or warning anti-patterns. The defensive null-fallback is an intentional TypeScript type-completeness artifact documented in SUMMARY §Deviations.

### Human Verification Required

The goal is programmatically achieved for all checkable truths. One Success Criterion (SC-1 from ROADMAP §Phase 8 — "Guardian regenerates FK 3057, FK 3059, and SKV 4805 PDFs for a historical month and the employer field shows the patient's name + pno") requires visual inspection of rendered government PDF output and is explicitly deferred to Phase 10 DATA-01 per CONTEXT.md D-14 and VALIDATION.md line 68.

**Test credentials for Phase 10 walkthrough:**
- Host: https://localhost:3000 (dev) / production-host TBD
- Guardian login: credentials per Kalinga .env / Settings DB row (not documented in verification scope)

#### 1. FK 3057 visual regeneration (SC-1)

**Test:** Log in as guardian → Monthly → select a historical month (e.g. 2026-03) → click "Generate FK 3057" → download PDF → open in Preview/Acrobat.
**Expected:**
- "Brukare" section: patient name + patient pno (unchanged — was already patient-sourced pre-Phase 8)
- Signature "Namnteckning" row: guardian name (D-09 preservation)
- No employer/Anordnaren field on FK 3057 per D-10
**Why human:** Requires rendering + opening PDF; no headless text-extraction tool configured.

#### 2. FK 3059 visual regeneration (SC-1)

**Test:** Monthly → select historical month → "Generate FK 3059" for a specific assistant → download PDF → open.
**Expected:**
- `flt_txtNamnAnordnaren[0]` (Anordnaren / employer name): **patient name** (Phase 8 change)
- `flt_txtKontaktperson[0]` (Kontaktperson): guardian name (D-09)
- `flt_txtNamnteckning2[0]` (employer signature): guardian name (D-09)
**Why human:** Same as (1) — visual PDF field-by-field inspection.

#### 3. SKV 4805 visual regeneration (SC-1)

**Test:** Monthly → select month with approved payroll → "Generate 4805" for an assistant → download PDF → open.
**Expected:**
- Employer block (`txtNamn[0]` index 0): patient name, patient pno, patient address (Phase 8 change via `__employer__` prefix dispatch)
- Recipient block (`txtNamn[0]` index 1): assistant name, pno, address (unchanged)
- Signature clarification (`txtNamnfortydl[0]`): guardian name (D-09)
**Why human:** duplicate-named AcroForm field dispatch happens in pdf.ts:423-434 via `getFields().filter(...)` + index [0]/[1] — unit-tested at field-map level, not at rendered-output level.

#### 4. Adult-with-override integration round-trip

**Test:** In Settings → Profile, set patient pno to an adult date (e.g. 197001011234), toggle `patient_requires_representative` = true → save → generate SKV 4805 → verify employer block shows adult patient + "Företrädd av" line (if slip adds it in Phase 9) shows guardian.
**Expected:** Helper returns `företrädare` non-null; Phase 9 slip will render the line. Phase 8 PDFs don't yet render a separate "företrädd av" row on FK/SKV forms (government-fixed field set has no such slot) — only the patient appears as employer + guardian as signer, which is the correct-for-compliance pre-Phase-9 behavior.
**Why human:** UI + DB + PDF full-stack test; helper behavior unit-verified.

### Gaps Summary

No programmatic gaps. All 10 observable truths pass, both requirements satisfied, all key links wired, all artifacts substantive, all spot-checks green, no blocker anti-patterns. EMP-02 regression gate empty; D-09 preservation gate passes with margin (6 ≥ 4). 118/130 full suite tests pass (12 skipped are pre-existing and unrelated to Phase 8).

Status is `human_needed` because ROADMAP SC-1 requires visual PDF inspection of regenerated government forms — explicitly deferred to Phase 10 DATA-01 per D-14. This is a planned handoff, not a gap.

---

*Verified: 2026-04-19T08:42:00Z*
*Verifier: Claude (gsd-verifier)*
