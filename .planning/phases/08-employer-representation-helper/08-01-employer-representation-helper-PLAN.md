---
phase: 08-employer-representation-helper
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - server/src/lib/employer-representation.ts
  - server/src/lib/employer-representation.test.ts
  - server/src/lib/form4805-utils.ts
  - server/src/lib/form4805-utils.test.ts
  - server/src/routes/pdf.ts
autonomous: true
requirements:
  - EMP-01
  - EMP-02
security_enforcement: true
block_on: high

must_haves:
  truths:
    - "resolveEmployerRepresentation(profile, asOfDate) returns { arbetsgivare, företrädare, isMinor } with patient identity as arbetsgivare in every case"
    - "Minor patient (end-of-period age < 18) always returns non-null företrädare regardless of patient_requires_representative flag (D-03)"
    - "Adult patient (end-of-period age >= 18) with patient_requires_representative=true returns non-null företrädare (D-04)"
    - "Adult patient with patient_requires_representative=false/null returns företrädare=null (D-04)"
    - "Patient turning 18 during report month is classified adult for the whole month because asOfDate is end-of-period (D-02)"
    - "SKV 4805 employer block (form4805-utils.ts __employer__ fields) writes patient name/pno/address, not guardian"
    - "FK 3059 flt_txtNamnAnordnaren[0] (pdf.ts:140) writes patient name, not guardian"
    - "Guardian signature/contact fields (form4805-utils.ts:120 txtNamnfortydl, pdf.ts:141 Kontaktperson, pdf.ts:147 Namnteckning2, pdf.ts:303 Namnteckning) remain guardian-sourced (D-09)"
    - "No source file under server/src/ references profile.guardianName for any employer-name field (D-14 grep passes)"
    - "Unit test suite covers minor-by-pno, adult-with-override, adult-without-override, turns-18-during-period, malformed-pno, address-fallback cases (D-13)"
    - "Existing form4805-utils.test.ts tests still pass after Form4805Profile extension"
    - "cd server && npm run build exits 0 — tsc clean, no type errors introduced"
  artifacts:
    - path: "server/src/lib/employer-representation.ts"
      provides: "resolveEmployerRepresentation helper + isMinor function + EmployerRepresentation type"
      exports: ["resolveEmployerRepresentation", "isMinor", "EmployerRepresentation"]
      min_lines: 50
    - path: "server/src/lib/employer-representation.test.ts"
      provides: "Vitest unit tests covering D-13 cases + malformed + address fallback"
      contains: "describe(\"resolveEmployerRepresentation\""
      min_lines: 60
    - path: "server/src/lib/form4805-utils.ts"
      provides: "Form4805Profile type extended with patientName, patientPno, addressStreet/Zip/City, patientRequiresRepresentative; buildForm4805Fields writes patient as employer"
      contains: "resolveEmployerRepresentation"
    - path: "server/src/routes/pdf.ts"
      provides: "FK 3059 Anordnaren field and SKV 4805 input use helper; signatures remain guardian"
      contains: "resolveEmployerRepresentation"
  key_links:
    - from: "server/src/lib/form4805-utils.ts:91"
      to: "resolveEmployerRepresentation"
      via: "imported from ./employer-representation; called with profile + asOfDate=last-day-of-yearMonth"
      pattern: "rep\\.arbetsgivare\\.(name|pno|address)"
    - from: "server/src/routes/pdf.ts:140"
      to: "resolveEmployerRepresentation"
      via: "called in /fk3059 handler with profile + asOfDate=end-of-month"
      pattern: "flt_txtNamnAnordnaren\\[0\\].*rep\\.arbetsgivare\\.name"
    - from: "server/src/routes/pdf.ts (around :370)"
      to: "Form4805Profile extended shape"
      via: "input.profile now carries patientName/Pno/addressStreet/Zip/City/patientRequiresRepresentative"
      pattern: "patientRequiresRepresentative"
---

<objective>
Extract `resolveEmployerRepresentation(profile, asOfDate)` into `server/src/lib/employer-representation.ts` as the single source of truth for employer-name + representation fields on every government document the platform produces (SKV 4805, FK 3059, FK 3057, and Phase 9's salary slip). Refactor the two existing consumers — `form4805-utils.ts` and `pdf.ts` — so SKV 4805's `__employer__` block and FK 3059's `flt_txtNamnAnordnaren[0]` resolve to the PATIENT identity rather than the guardian identity, while signature/contact fields remain guardian-sourced per D-09.

**Purpose:** Closes the latent v1.0 bug flagged in [v1.0-MILESTONE-AUDIT.md](.planning/milestones/v1.0-MILESTONE-AUDIT.md) — `profile.guardianName` was hardcoded as the employer on SKV 4805 + FK 3059 renderers. Correct for minor patients (Kalinga's current use), silently wrong for any adult patient. Phase 9 salary slip depends on this helper for its header block (ROADMAP §Phase 9 SC-4).

**Output:**
- New pure helper + co-located Vitest unit tests (Vitest ^4.1.2 — already present; no new deps)
- Extended `Form4805Profile` type (adds patient fields + split address + override flag)
- Refactored `form4805-utils.ts:91–93` (employer block) — writes patient from helper
- Refactored `form4805-utils.ts:120` stays unchanged — signature is guardian per D-09
- Refactored `pdf.ts` /fk3059 handler (line 140) — writes patient name for Anordnaren
- Refactored `pdf.ts` /4805 handler (line 370–390) — builds Form4805Input with extended shape
- Refactored `pdf.ts` /fk3057 handler (line 246+) — calls helper for consistency even though FK 3057 has no Anordnaren field (for future-proofing + grep symmetry); signature at :303 stays guardian per D-09
- Grep absence check passes: zero employer-adjacent `guardianName` uses remain
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/ROADMAP.md
@.planning/STATE.md
@.planning/REQUIREMENTS.md
@.planning/phases/08-employer-representation-helper/08-CONTEXT.md
@.planning/phases/08-employer-representation-helper/08-RESEARCH.md
@.planning/phases/08-employer-representation-helper/08-VALIDATION.md
@.planning/phases/07-foundation-schema-cleanup/07-01-SUMMARY.md
@server/src/db/schema.ts
@server/src/lib/form4805-utils.ts
@server/src/lib/form4805-utils.test.ts
@server/src/routes/pdf.ts

<interfaces>
<!-- Key types and contracts the executor MUST use verbatim. Extracted from server/src/db/schema.ts and server/src/lib/form4805-utils.ts. -->
<!-- Executor should NOT go exploring — contracts are here. -->

From server/src/db/schema.ts (current state after Phase 7 — the profile row shape the helper reads):
```typescript
// Relevant columns on profile table (not exhaustive — helper only reads these):
//   patientName                      text
//   patientPno                       text              // 12-digit format YYYYMMDDNNNN (Phase 7 D-18)
//   guardianName                     text
//   guardianPno                      text
//   guardianPhone                    text
//   address                          text              // legacy single-line fallback
//   addressStreet                    text              // Phase 7 split column
//   addressZip                       text              // Phase 7 split column
//   addressCity                      text              // Phase 7 split column
//   patientRequiresRepresentative    boolean           // Phase 7 SCHEMA-02 — default null/false
//   city                             text              // legacy (still populated for 4805 fallback)
//   zip                              text              // legacy (still populated for 4805 fallback)
// Inferred TS type:
export type Profile = typeof profile.$inferSelect;
```

From server/src/lib/form4805-utils.ts (lines 5-12 — the type the executor MUST extend):
```typescript
// BEFORE (current):
export type Form4805Profile = {
  guardianName:  string;
  guardianPno:   string;
  guardianPhone: string;
  address:       string;
  city:          string;
  zip:           string;
};

// AFTER (Task 2 extends this; additions are ALL required, not optional, so every caller must populate them):
export type Form4805Profile = {
  // Guardian identity — used for signature / contact / Namnfortydl (D-09 keeps these as-is)
  guardianName:  string;
  guardianPno:   string;
  guardianPhone: string;
  // Patient identity — NEW, consumed by helper to produce the __employer__ block
  patientName:   string;
  patientPno:    string;
  patientRequiresRepresentative: boolean;
  // Address fields — helper prefers split columns, falls back to single-line
  address:       string;      // legacy single-line
  city:          string;      // legacy
  zip:           string;      // legacy
  addressStreet: string;      // Phase 7 split
  addressZip:    string;      // Phase 7 split
  addressCity:   string;      // Phase 7 split
};
```

From server/src/lib/employer-representation.ts (Task 1 creates this — exact exported shapes):
```typescript
export type EmployerRepresentation = {
  arbetsgivare: { name: string; pno: string; address: string };
  företrädare: { name: string; pno: string } | null;
  isMinor: boolean;
};

export function isMinor(pno: string, asOfDate: Date): boolean;

export function resolveEmployerRepresentation(
  profile: {
    patientName: string | null;
    patientPno: string | null;
    guardianName: string | null;
    guardianPno: string | null;
    patientRequiresRepresentative: boolean | null;
    address: string | null;
    addressStreet: string | null;
    addressZip: string | null;
    addressCity: string | null;
  },
  asOfDate: Date,
): EmployerRepresentation;
```

From pdf.ts:67-234 (`/fk3059` handler — line 140 is where refactor happens):
```typescript
// Line 140 current:
fields["form1[0].#subform[0].flt_txtNamnAnordnaren[0]"] = prof?.guardianName  ?? "";
// Line 140 after Task 3:
// const rep = resolveEmployerRepresentation(prof ?? {...}, new Date(end));
// fields["form1[0].#subform[0].flt_txtNamnAnordnaren[0]"] = rep.arbetsgivare.name;
// Lines 141 + 147 stay as prof?.guardianName (D-09).
```

From pdf.ts:370-390 (`/4805` handler — Form4805Input build):
```typescript
// Current build — extend this object with the 6 new Form4805Profile fields
const input: Form4805Input = {
  yearMonth,
  profile: {
    guardianName:  prof?.guardianName  ?? "",
    guardianPno:   prof?.guardianPno   ?? "",
    guardianPhone: prof?.guardianPhone ?? "",
    address:       prof?.address       ?? "",
    city:          prof?.city          ?? "",
    zip:           prof?.zip           ?? "",
    // NEW — Task 3 adds these 6 fields:
    patientName:                    prof?.patientName                    ?? "",
    patientPno:                     prof?.patientPno                     ?? "",
    patientRequiresRepresentative:  prof?.patientRequiresRepresentative  ?? false,
    addressStreet:                  prof?.addressStreet                  ?? "",
    addressZip:                     prof?.addressZip                     ?? "",
    addressCity:                    prof?.addressCity                    ?? "",
  },
  assistant: { ... },
  payrollRecord: { ... },
};
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="true">
  <name>Task 1: Create resolveEmployerRepresentation helper + isMinor + unit tests (Wave 0 + Wave 1 combined)</name>
  <files>server/src/lib/employer-representation.ts, server/src/lib/employer-representation.test.ts</files>

  <read_first>
    - server/src/lib/form4805-utils.ts (full file — reference implementation pattern: co-located tests, birthYearFromPno at line 38, address format at 77-80)
    - server/src/lib/form4805-utils.test.ts (full file — Vitest fixture and describe/it style to mirror)
    - server/src/db/schema.ts (lines 29-57 for profile column types — Profile type inference)
    - server/vitest.config.ts (confirms test glob picks up src/**/*.test.ts)
    - .planning/phases/08-employer-representation-helper/08-CONTEXT.md (locked decisions D-01 through D-14 — MUST all be honored)
    - .planning/phases/08-employer-representation-helper/08-RESEARCH.md (§Code Examples lines 288-346 for helper skeleton, lines 371-417 for test scaffold, §Pitfalls 1-6 for edge cases to guard)
  </read_first>

  <behavior>
    - Test 1 (a) "minor-by-pno, flag false → representative present": patient pno 201501011234, asOfDate 2026-03-31, flag false → isMinor=true, arbetsgivare.name="Liam Karon", företrädare.name="Rose Karon", företrädare.pno="198011155069" per D-03
    - Test 2 (b) "adult-with-override → representative present": patient pno 197001011234, flag true → isMinor=false, företrädare is non-null with guardian identity per D-04 (god-man case)
    - Test 3 (c) "adult-without-override → representative null": patient pno 197001011234, flag false → isMinor=false, företrädare is null per D-04
    - Test 4 (c') "adult-without-override, flag=null → representative null": patient pno 197001011234, flag null → företrädare is null (null treated as false per D-04)
    - Test 5 (d) "turns 18 during report month → adult at end-of-period": patient pno 200803151234 (born 2008-03-15), asOfDate 2026-03-31 (18th birthday 2026-03-15) → isMinor=false, företrädare=null (flag false) per D-02
    - Test 6 (d') "one day before 18th birthday → still minor": patient pno 200803151234, asOfDate 2026-03-14 → isMinor=true, företrädare non-null
    - Test 7 "malformed pno (empty string)" → does not throw; isMinor=false; företrädare=null when flag false; arbetsgivare.name populated from profile; Phase 10 catches visually
    - Test 8 "malformed pno (too short, 7 digits)" → does not throw; isMinor=false; same degradation as empty
    - Test 9 "address fallback: split columns populated" → arbetsgivare.address = "Storgatan 1, 11122 Stockholm" (format: "{street}, {zip} {city}")
    - Test 10 "address fallback: split columns empty, legacy address set" → arbetsgivare.address = "Storgatan 1" (trimmed from profile.address)
    - Test 11 "address fallback: all address fields empty/null" → arbetsgivare.address = "" (no crash)
    - Test 12 (isMinor unit) "isMinor('201501011234', new Date('2026-03-31'))" returns true; "isMinor('197001011234', new Date('2026-03-31'))" returns false; "isMinor('', new Date('2026-03-31'))" returns false
  </behavior>

  <action>
Create `server/src/lib/employer-representation.ts` with EXACTLY this content (lifted verbatim from RESEARCH.md §Code Examples lines 288-346, with Profile import adjusted to use a local Pick since Profile is inferred from Drizzle):

```typescript
// employer-representation.ts — single source of truth for arbetsgivare (employer) and
// företrädare (representative) identity on every government document the platform produces.
// Pure function: no DB access, no side effects. Minor-status is a pure function of
// (patient_pno, report_period_end_date) per CONTEXT.md specifics.
//
// Locked decisions honored:
//   D-01: age derived from patient pno, relative to report period END
//   D-02: patient turning 18 during month → adult for the whole month (end-of-period wins)
//   D-03: override flag applies ONLY to adults; minors always get representative
//   D-04: adult + flag=true → representative present; adult + flag=false/null → representative null
//   D-06: structured return shape (objects with name/pno), NOT pre-formatted strings
//   D-07: split address columns preferred, single-line address fallback

export type EmployerRepresentation = {
  arbetsgivare: { name: string; pno: string; address: string };
  företrädare: { name: string; pno: string } | null;
  isMinor: boolean;
};

/**
 * Returns true when the patient is under 18 as of `asOfDate`.
 * Canonical pno storage format in this codebase is 12-digit YYYYMMDDNNNN (Phase 7 D-18).
 * Malformed / too-short pno returns false (treat as adult → representative depends on flag).
 * Phase 10 DATA-01 will catch placeholder "000000-0000" values during visual inspection.
 *
 * IMPORTANT: Pass the LAST day of the report period, not today's date. Regenerating
 * historical months must use that month's end-of-period or the minor→adult transition
 * will be evaluated against the wrong calendar point (RESEARCH.md Pitfall 6).
 */
export function isMinor(pno: string, asOfDate: Date): boolean {
  const digits = pno.replace(/\D/g, "");
  if (digits.length < 8) return false;
  const year  = parseInt(digits.slice(0, 4), 10);
  const month = parseInt(digits.slice(4, 6), 10);
  const day   = parseInt(digits.slice(6, 8), 10);
  if (!year || !month || !day) return false;
  // 18th birthday as a calendar Date. asOfDate < birthday18 → minor.
  const birthday18 = new Date(year + 18, month - 1, day);
  return asOfDate < birthday18;
}

/**
 * Builds the employer-address string. Prefers the Phase 7 split columns
 * (addressStreet / addressZip / addressCity) when any is non-empty. Falls back to
 * the legacy single-line `address` column for records that predate Phase 7.
 * Format matches form4805-utils.ts:77-80 convention: "{street}, {zip} {city}"
 */
function buildPatientAddress(p: {
  address: string | null;
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
}): string {
  const street = (p.addressStreet ?? "").trim();
  const zip    = (p.addressZip    ?? "").trim();
  const city   = (p.addressCity   ?? "").trim();
  const hasSplit = !!(street || zip || city);
  if (hasSplit) {
    const tail = [zip, city].filter(Boolean).join(" ");
    const line = [street, tail].filter(Boolean).join(", ").trim();
    if (line) return line;
  }
  return (p.address ?? "").trim();
}

export function resolveEmployerRepresentation(
  profile: {
    patientName: string | null;
    patientPno: string | null;
    guardianName: string | null;
    guardianPno: string | null;
    patientRequiresRepresentative: boolean | null;
    address: string | null;
    addressStreet: string | null;
    addressZip: string | null;
    addressCity: string | null;
  },
  asOfDate: Date,
): EmployerRepresentation {
  const minor    = isMinor(profile.patientPno ?? "", asOfDate);
  const override = profile.patientRequiresRepresentative === true;
  const needsRep = minor || (!minor && override);  // D-03: override applies only to adults
  return {
    arbetsgivare: {
      name:    profile.patientName ?? "",
      pno:     profile.patientPno  ?? "",
      address: buildPatientAddress(profile),
    },
    företrädare: needsRep
      ? {
          name: profile.guardianName ?? "",
          pno:  profile.guardianPno  ?? "",
        }
      : null,
    isMinor: minor,
  };
}
```

Create `server/src/lib/employer-representation.test.ts` with tests covering the 12 behaviors listed above. Use Vitest (`import { describe, it, expect } from "vitest"`). Mirror the style of `server/src/lib/form4805-utils.test.ts`. Use the fixture pattern from RESEARCH.md lines 378-383:

```typescript
import { describe, it, expect } from "vitest";
import { resolveEmployerRepresentation, isMinor } from "./employer-representation";

const baseProfile = {
  patientName: "Liam Karon",
  patientPno: "201501011234",
  guardianName: "Rose Karon",
  guardianPno: "198011155069",
  address: "Storgatan 1",
  addressStreet: "",
  addressZip: "",
  addressCity: "",
  patientRequiresRepresentative: false,
} as const;
```

Write one `describe("resolveEmployerRepresentation", ...)` block containing all 11 resolveEmployerRepresentation behaviors (tests 1–11 above), and a second `describe("isMinor", ...)` block for test 12. Every assertion uses `expect(...).toBe(...)` or `expect(...).toBeNull()` — no subjective checks.

For test (d') ("one day before 18th birthday"), use `new Date(2026, 2, 14)` (March 14) or `new Date("2026-03-14T12:00:00")` to avoid timezone edge cases (note: `new Date(year, monthIndex, day)` constructs local-midnight; `new Date("YYYY-MM-DD")` constructs UTC-midnight — pick one convention and use consistently. The helper uses `new Date(year + 18, month - 1, day)` which is local-midnight, so prefer `new Date(2026, 2, 15)` style in tests to stay consistent).

Do NOT yet refactor form4805-utils.ts or pdf.ts in this task — those land in Tasks 2 and 3.
  </action>

  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/server && npm test -- employer-representation</automated>
  </verify>

  <acceptance_criteria>
    - File exists: `server/src/lib/employer-representation.ts`
    - File exists: `server/src/lib/employer-representation.test.ts`
    - `grep -c "export function resolveEmployerRepresentation(" server/src/lib/employer-representation.ts` returns 1
    - `grep -c "export function isMinor(" server/src/lib/employer-representation.ts` returns 1
    - `grep -c "export type EmployerRepresentation" server/src/lib/employer-representation.ts` returns 1
    - `grep -c "it(" server/src/lib/employer-representation.test.ts` returns >= 11
    - `grep -c "minor-by-pno\|adult-with-override\|adult-without-override\|turns 18\|malformed\|address fallback" server/src/lib/employer-representation.test.ts` returns >= 6 (the named D-13 cases + malformed + fallback)
    - `cd server && npm test -- employer-representation` exits 0
    - `cd server && npm test -- employer-representation -t "minor-by-pno"` exits 0 (case a green)
    - `cd server && npm test -- employer-representation -t "adult-with-override"` exits 0 (case b green)
    - `cd server && npm test -- employer-representation -t "adult-without-override"` exits 0 (case c green)
    - `cd server && npm test -- employer-representation -t "turns 18"` exits 0 (case d green)
    - `cd server && npm test -- employer-representation -t "malformed"` exits 0
    - `cd server && npm test -- employer-representation -t "address fallback"` exits 0
    - `cd server && npm run build` exits 0 (tsc clean — helper type-checks against Profile subset)
    - NO refactors applied to `server/src/lib/form4805-utils.ts` or `server/src/routes/pdf.ts` yet (those are Task 2/3)
    - `grep -n "guardianName" server/src/lib/form4805-utils.ts` still shows lines 91 and 120 (unchanged baseline — Task 2 changes line 91)
  </acceptance_criteria>

  <done>
Helper + tests file exist, 11+ tests pass including all 4 named D-13 cases (minor-by-pno, adult-with-override, adult-without-override, turns 18), malformed-pno is non-throwing, address fallback exercises both split and legacy paths, `isMinor` directly tested for 3 cases, full project build is clean. Consumers (form4805-utils / pdf.ts) are unchanged — the baseline grep still shows `guardianName` at the 7 original sites.
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Refactor form4805-utils.ts to call helper — __employer__ block resolves to patient; signature stays guardian (D-09)</name>
  <files>server/src/lib/form4805-utils.ts, server/src/lib/form4805-utils.test.ts</files>

  <read_first>
    - server/src/lib/form4805-utils.ts (full file — Tasks 1 did not modify; baseline still has line 91 = guardianName)
    - server/src/lib/form4805-utils.test.ts (full file — existing fixture at lines 13-19 needs extending with the 6 new Form4805Profile fields)
    - server/src/lib/employer-representation.ts (Task 1 output — signature and export list the executor calls)
    - .planning/phases/08-employer-representation-helper/08-CONTEXT.md (D-06, D-07, D-08, D-09, D-12)
    - .planning/phases/08-employer-representation-helper/08-RESEARCH.md (§Code Examples lines 348-368 for consumer refactor shape, §Pitfall 1 for type-drift in fixtures)
  </read_first>

  <behavior>
    - Form4805Profile now has 12 fields (6 existing + 6 new: patientName, patientPno, patientRequiresRepresentative, addressStreet, addressZip, addressCity)
    - buildForm4805Fields calls resolveEmployerRepresentation(profile, lastDayOf(yearMonth)) exactly once
    - Line 91: `fields["__employer__txtNamn[0]"]` is now `rep.arbetsgivare.name` (patient), NOT `profile.guardianName`
    - Line 92: `fields["__employer__txtPersNr[0]"]` is now `rep.arbetsgivare.pno` (patient), NOT `profile.guardianPno`
    - Line 93: `fields["__employer__txtAdress[0]"]` is now `rep.arbetsgivare.address`, NOT `guardianAddress`
    - Line 120: `fields["txtNamnfortydl[0]"]` remains `profile.guardianName` (D-09: signature stays guardian)
    - Line 121: `fields["txtNTelefon[0]"]` remains `profile.guardianPhone` (unchanged)
    - Existing test fixture (form4805-utils.test.ts:13-19) is extended with the 6 new fields so `Form4805Input` type-checks
    - All pre-existing `form4805-utils.test.ts` assertions still pass
    - A new test is added asserting `fields["__employer__txtNamn[0]"]` equals the fixture's `patientName` (NOT `guardianName`)
  </behavior>

  <action>
1. Extend the `Form4805Profile` type definition at `server/src/lib/form4805-utils.ts:5-12` to this EXACT shape:

```typescript
export type Form4805Profile = {
  // Guardian identity — used for signature / contact / Namnfortydl (D-09)
  guardianName:  string;
  guardianPno:   string;
  guardianPhone: string;
  // Patient identity — NEW (Phase 8): consumed by employer-representation helper
  patientName:   string;
  patientPno:    string;
  patientRequiresRepresentative: boolean;
  // Address: legacy single-line + Phase 7 split columns (helper chooses)
  address:       string;
  city:          string;
  zip:           string;
  addressStreet: string;
  addressZip:    string;
  addressCity:   string;
};
```

2. Add import at the top of the file:

```typescript
import { resolveEmployerRepresentation } from "./employer-representation";
```

3. Inside `buildForm4805Fields` (currently lines 67–124), BEFORE the `fields["__employer__..."]` assignments at lines 91-93, compute the representation using the report period's end-of-month. Add this helper immediately above the fields object initialization:

```typescript
// Compute report period end-date for helper (D-01: asOfDate = last day of period)
const [ymYear, ymMonth] = yearMonth.split("-").map(Number);
const lastDayOfPeriod = new Date(ymYear, ymMonth, 0);  // day 0 of NEXT month = last day of this month
const rep = resolveEmployerRepresentation(profile, lastDayOfPeriod);
```

4. Replace lines 91-93 EXACTLY:

```typescript
// BEFORE:
//   fields["__employer__txtNamn[0]"]   = profile.guardianName;
//   fields["__employer__txtPersNr[0]"] = profile.guardianPno;
//   fields["__employer__txtAdress[0]"] = guardianAddress;
// AFTER:
fields["__employer__txtNamn[0]"]   = rep.arbetsgivare.name;
fields["__employer__txtPersNr[0]"] = rep.arbetsgivare.pno;
fields["__employer__txtAdress[0]"] = rep.arbetsgivare.address;
```

5. Line 120 is UNCHANGED — `fields["txtNamnfortydl[0]"] = profile.guardianName` stays exactly as-is per D-09. Do NOT substitute it with the helper. This is the signature-clarification field — the guardian signs as the patient's representative.

6. The old `guardianAddress` local (currently computed at lines 77-80 from `profile.address`, `profile.zip`, `profile.city`) is no longer used by the `__employer__` block. Delete the unused variable to avoid lint/tsc warnings. Verify no other code path reads it (grep in this file).

7. Update `server/src/lib/form4805-utils.test.ts`:
   - Extend the `baseProfile` (or whatever fixture name is used — current code at lines 13-19 uses a literal) with the 6 NEW Form4805Profile fields:
     ```typescript
     patientName:                    "Liam Karon",
     patientPno:                     "201501011234",   // MINOR pno
     patientRequiresRepresentative:  false,
     addressStreet:                  "",
     addressZip:                     "",
     addressCity:                    "",
     ```
   - Add ONE new assertion inside an existing test (or a new `it(...)` block) that verifies `fields["__employer__txtNamn[0]"]` equals `"Liam Karon"` (the patientName), NOT the guardianName from the fixture. This is the canary that proves the refactor took effect.
   - Verify the pre-existing assertions (assistant name, kod fields, tax withheld, etc.) still pass — only the employer block's expected values change from guardian → patient.

8. Run `cd server && npm test -- form4805-utils` to confirm green. Run `cd server && npm run build` to confirm tsc is clean.
  </action>

  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/server && npm test -- form4805-utils && npm run build</automated>
  </verify>

  <acceptance_criteria>
    - `grep -n "patientName:" server/src/lib/form4805-utils.ts` returns a line inside the `Form4805Profile` type (type extension applied)
    - `grep -n "patientRequiresRepresentative:" server/src/lib/form4805-utils.ts` returns a line inside the type
    - `grep -n "addressStreet:\|addressZip:\|addressCity:" server/src/lib/form4805-utils.ts` returns 3 lines (all split columns added)
    - `grep -c "import.*resolveEmployerRepresentation.*employer-representation" server/src/lib/form4805-utils.ts` returns 1
    - `grep -c "resolveEmployerRepresentation(profile" server/src/lib/form4805-utils.ts` returns 1 (called exactly once inside buildForm4805Fields)
    - `grep -n "__employer__txtNamn" server/src/lib/form4805-utils.ts` shows the line assigning `rep.arbetsgivare.name` (NOT `profile.guardianName`)
    - `grep -E "__employer__.*guardianName" server/src/lib/form4805-utils.ts` returns empty (no residual guardianName in employer block)
    - `grep -n "txtNamnfortydl" server/src/lib/form4805-utils.ts` shows `profile.guardianName` still in use (D-09 signature preserved)
    - `grep -c "guardianName" server/src/lib/form4805-utils.ts` returns 1 (ONLY the txtNamnfortydl signature line — employer line is gone)
    - `grep -n "patientName:" server/src/lib/form4805-utils.test.ts` returns at least 1 match (fixture extended)
    - `cd server && npm test -- form4805-utils` exits 0 (all pre-existing + new assertion green)
    - `cd server && npm test -- employer-representation` exits 0 (Task 1 tests still green — no regression)
    - `cd server && npm run build` exits 0 (tsc clean)
    - pdf.ts is NOT yet modified — baseline `grep -c "guardianName" server/src/routes/pdf.ts` still returns 5 (lines 140, 141, 147, 303, 373)
  </acceptance_criteria>

  <done>
Form4805Profile type extended with 6 new fields. buildForm4805Fields now calls the helper exactly once and writes the PATIENT identity to the __employer__ block. The signature-clarification line (txtNamnfortydl at original line 120) remains guardian-sourced per D-09. Existing test suite passes unchanged, plus one new assertion confirms employer name = patientName. tsc is clean. pdf.ts is untouched (its refactor is Task 3).
  </done>
</task>

<task type="auto" tdd="true">
  <name>Task 3: Refactor pdf.ts — FK 3059 Anordnaren field + SKV 4805 input build; signatures/contact stay guardian (D-09); grep regression check</name>
  <files>server/src/routes/pdf.ts</files>

  <read_first>
    - server/src/routes/pdf.ts (full file — all 5 guardianName refs at lines 140, 141, 147, 303, 373)
    - server/src/lib/employer-representation.ts (Task 1 exports — signature to call)
    - server/src/lib/form4805-utils.ts (Task 2 output — Form4805Profile shape the /4805 handler must populate)
    - .planning/phases/08-employer-representation-helper/08-CONTEXT.md (D-08, D-09, D-10)
    - .planning/phases/08-employer-representation-helper/08-RESEARCH.md (§Code Site Inventory table lines 155-166 — per-line action matrix; §Validation Architecture lines 494-514 — grep absence check)
  </read_first>

  <behavior>
    - `/fk3059` handler (lines 67-234) computes `rep = resolveEmployerRepresentation(prof, endOfMonthDate)` once and writes `rep.arbetsgivare.name` to `flt_txtNamnAnordnaren[0]` (line 140). Lines 141 (Kontaktperson) + 147 (Namnteckning2) stay `prof.guardianName` per D-09.
    - `/fk3057` handler (lines 237-316) — per D-10 FK 3057 has no Anordnaren field; only Brukare (already patient-sourced at lines 296-297) + signature (line 303). Signature at 303 stays `prof.guardianName` per D-09. No new field writes are needed here. Executor MUST still call the helper in this handler (for grep-symmetry + future-proofing) OR skip it. **Chosen: SKIP** — do not add an unused call. Leave `/fk3057` untouched.
    - `/4805` handler (lines 328-431) — build the `Form4805Input.profile` object with the 6 new fields pulled from the Drizzle profile row. The helper is called INSIDE `buildForm4805Fields` (Task 2), not here. This handler's sole change is the input shape.
    - Grep absence check from RESEARCH.md lines 494-514 passes: `grep -rE "(__employer__|flt_txtNamnAnordnaren)" server/src/ | grep guardianName` returns EMPTY.
    - Grep sanity check: `grep -c "guardianName" server/src/routes/pdf.ts` returns 4 (lines 141, 147, 303 stay; line 140 is replaced; line 373 was replaced BUT the new shape still references `prof?.guardianName` to populate the `guardianName` field of Form4805Profile — so the count is actually 4, not 3).
  </behavior>

  <action>
1. **FK 3059 handler (`/fk3059`, pdf.ts lines 67-234)** — replace line 140's assignment.

   Add import at the top of the file (keep existing imports untouched):
   ```typescript
   import { resolveEmployerRepresentation } from "../lib/employer-representation";
   ```

   Inside the handler, AFTER `const [prof] = await db.select().from(profile).limit(1);` (line 83) and AFTER `end` is computed (line 81), add:
   ```typescript
   // Resolve employer / representative per D-01 (asOfDate = last day of report period)
   // `end` is already "YYYY-MM-DD" for the last day of the month (line 81).
   const rep = resolveEmployerRepresentation(prof ?? {
     patientName: null, patientPno: null, guardianName: null, guardianPno: null,
     patientRequiresRepresentative: null, address: null,
     addressStreet: null, addressZip: null, addressCity: null,
   }, new Date(end));
   ```

   Replace line 140 EXACTLY:
   ```typescript
   // BEFORE:
   //   fields["form1[0].#subform[0].flt_txtNamnAnordnaren[0]"] = prof?.guardianName  ?? "";
   // AFTER:
   fields["form1[0].#subform[0].flt_txtNamnAnordnaren[0]"] = rep.arbetsgivare.name;
   ```

   Lines 141 (`flt_txtKontaktperson[0]` = `prof?.guardianName`) and 147 (`flt_txtNamnteckning2[0]` = `prof?.guardianName`) are UNCHANGED per D-09 — guardian is the contact + signer.

2. **FK 3057 handler (`/fk3057`, pdf.ts lines 237-316)** — NO CHANGES.

   Per D-10 + RESEARCH.md §Code Site Inventory: FK 3057 has no `Anordnaren` field. Lines 296-297 already write patient name/pno to `flt_txtFnamnEnamnBrukare[0]` / `flt_txtPersonNrBrukare[0]`. Line 303 signature stays `prof?.guardianName` per D-09. Do NOT add a helper call here; an unused call would only add noise. Leave the handler untouched.

   **Sanity-check note for the executor (record in SUMMARY, do not code around it):** RESEARCH.md Open Question #1 flagged that CONTEXT D-08 labeled `flt_txtNamnAnordnaren[0]` (pdf.ts:140) as belonging to "FK 3057" while the code places it inside `/fk3059`. The code is authoritative — that field is on FK 3059 (the Tidsredovisning form). Inspect `forms/fk3057.pdf` and `forms/fk3059.pdf` to visually confirm which form's "arranger name" slot is populated. Record the resolution in the Task 3 / plan SUMMARY. Regardless of which form it belongs to, replacing it with `rep.arbetsgivare.name` is the correct action per EMP-02.

3. **SKV 4805 handler (`/4805`, pdf.ts lines 328-431)** — extend the `Form4805Input.profile` build at lines 370-390.

   Replace the current `profile:` block with this EXACT shape (6 new field additions; the helper call happens inside `buildForm4805Fields` per Task 2):
   ```typescript
   profile: {
     guardianName:  prof?.guardianName  ?? "",
     guardianPno:   prof?.guardianPno   ?? "",
     guardianPhone: prof?.guardianPhone ?? "",
     address:       prof?.address       ?? "",
     city:          prof?.city          ?? "",
     zip:           prof?.zip           ?? "",
     // Phase 8 — patient identity for employer-representation helper
     patientName:                    prof?.patientName                    ?? "",
     patientPno:                     prof?.patientPno                     ?? "",
     patientRequiresRepresentative:  prof?.patientRequiresRepresentative  ?? false,
     addressStreet:                  prof?.addressStreet                  ?? "",
     addressZip:                     prof?.addressZip                     ?? "",
     addressCity:                    prof?.addressCity                    ?? "",
   },
   ```

   Line 373 (`guardianName: prof?.guardianName ?? ""`) stays — the guardian identity is still needed for the 4805 signature block (form4805-utils.ts:120 per D-09). This is NOT a regression of the employer bug; the helper inside `buildForm4805Fields` now uses `patientName` for the employer block. Grep absence check (step 4 below) discriminates between the employer-adjacent `guardianName` uses (must be gone) and signature-adjacent uses (must remain).

4. **Run the grep absence check from RESEARCH.md lines 497-513** (EMP-02 regression gate). Create a one-line equivalent the executor can run directly (no script file needed):

   ```bash
   # Employer-adjacent guardianName must be ZERO:
   grep -rEn "(__employer__|flt_txtNamnAnordnaren)" server/src/ | grep guardianName
   # Expected output: empty. If ANY line is emitted, refactor is incomplete.
   ```

   Additionally confirm the D-09 signature lines still exist (must NOT be over-refactored):

   ```bash
   # Signature fields must STILL reference guardianName:
   grep -cE "(txtNamnfortydl|flt_txtKontaktperson|flt_txtNamnteckning)" server/src/routes/pdf.ts server/src/lib/form4805-utils.ts
   # Expected >= 4 (at minimum: pdf.ts:141, pdf.ts:147, pdf.ts:303, form4805-utils.ts:120)
   ```

5. Run the full server test suite + build:
   ```bash
   cd server && npm test && npm run build
   ```

6. After all checks pass, verify the full list of remaining `guardianName` references under `server/src/` matches the expected post-refactor baseline (table from RESEARCH.md §Code Site Inventory):

| File | Line (approx, may shift ±1) | Purpose | Post-refactor state |
|---|---|---|---|
| pdf.ts | ~141 | FK 3059 Kontaktperson | KEEP (D-09) |
| pdf.ts | ~147 | FK 3059 Namnteckning2 | KEEP (D-09) |
| pdf.ts | ~303 | FK 3057 Namnteckning | KEEP (D-09) |
| pdf.ts | ~373 | SKV 4805 input.profile.guardianName | KEEP (populates signature via form4805-utils:120) |
| form4805-utils.ts | ~120 | txtNamnfortydl (signature) | KEEP (D-09) |
| auth.ts, misc.ts, email.ts, schema.ts, form4805-utils.test.ts | various | Email templates, column definition, test fixture | OUT OF SCOPE (not employer fields) |
  </action>

  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/server && npm test && npm run build && ! (grep -rEn "(__employer__|flt_txtNamnAnordnaren)" src/ | grep guardianName)</automated>
  </verify>

  <acceptance_criteria>
    - `grep -c "import.*resolveEmployerRepresentation.*employer-representation" server/src/routes/pdf.ts` returns 1
    - `grep -c "resolveEmployerRepresentation(prof" server/src/routes/pdf.ts` returns 1 (called once inside /fk3059)
    - `grep -n "flt_txtNamnAnordnaren\[0\]" server/src/routes/pdf.ts` shows the line assigning `rep.arbetsgivare.name` (NOT `prof?.guardianName`)
    - `grep -n "flt_txtKontaktperson\[0\]" server/src/routes/pdf.ts` shows `prof?.guardianName` (D-09 kept)
    - `grep -n "flt_txtNamnteckning2\[0\]" server/src/routes/pdf.ts` shows `prof?.guardianName` (D-09 kept)
    - `grep -n "flt_txtNamnteckning\[0\]" server/src/routes/pdf.ts` shows `prof?.guardianName` at the FK 3057 handler signature site (D-09 kept)
    - `grep -n "patientName:" server/src/routes/pdf.ts` returns at least 1 line inside the /4805 handler's Form4805Input.profile block
    - `grep -n "patientRequiresRepresentative:" server/src/routes/pdf.ts` returns at least 1 line inside the /4805 handler's profile block
    - `grep -n "addressStreet:\|addressZip:\|addressCity:" server/src/routes/pdf.ts` returns 3 lines inside the /4805 profile block
    - **EMP-02 regression gate:** `grep -rEn "(__employer__|flt_txtNamnAnordnaren)" server/src/ | grep guardianName` returns EMPTY (exit code 1 from grep is OK — means no matches)
    - **D-09 preservation gate:** `grep -cE "(txtNamnfortydl|flt_txtKontaktperson|flt_txtNamnteckning)" server/src/routes/pdf.ts server/src/lib/form4805-utils.ts` returns >= 4
    - `grep -c "guardianName" server/src/routes/pdf.ts` returns 4 (lines ~141, ~147, ~303, ~373 — line 140's employer use is gone; 373 remains because it populates the signature field through form4805-utils:120)
    - `grep -c "guardianName" server/src/lib/form4805-utils.ts` returns 1 (only txtNamnfortydl at ~line 120)
    - `cd server && npm test` exits 0 (full suite: employer-representation.test, form4805-utils.test, payroll-utils.test, deadlineUtils.test, reminderCron.test all green)
    - `cd server && npm run build` exits 0 (tsc clean — no type errors from the Form4805Profile shape change at the pdf.ts call site)
    - FK 3057 handler is UNMODIFIED except for the new import at the top of the file (line 303 signature unchanged, no helper call added inside /fk3057)
  </acceptance_criteria>

  <done>
pdf.ts `/fk3059` handler writes patient name to `flt_txtNamnAnordnaren[0]` via the helper. pdf.ts `/4805` handler populates the extended Form4805Profile with 6 new patient/override/split-address fields; the helper is invoked INSIDE `buildForm4805Fields` (Task 2) and writes patient to the `__employer__` block. All signature/contact fields (pdf.ts:141, 147, 303; form4805-utils.ts:120) remain guardian-sourced per D-09. EMP-02 grep regression gate is green (no employer-adjacent guardianName remains). Full server test suite + tsc build green. FK 3057 handler is intentionally untouched — no Anordnaren field per D-10. Phase 8 requirements EMP-01 and EMP-02 are now satisfied by code.
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| DB → renderer | profile row read from Postgres, consumed by pdf.ts and form4805-utils.ts to produce government PDFs. Trust: HIGH (single-tenant, guardian-owned data). |
| Renderer → government form | Generated PDF becomes a compliance document. Trust: **regulatory** — incorrect employer identity is a compliance risk even though it's not a security risk. |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-8-01 | Information Disclosure / Compliance | resolveEmployerRepresentation return value → SKV 4805 / FK 3059 PDFs | mitigate | Incorrect employer resolution would list the wrong legal party as arbetsgivare on a government filing (regulatory / labor-law compliance risk, not a confidentiality risk — data is guardian's own). Mitigations: (a) D-13 unit tests cover minor-by-pno + adult-with-override + adult-without-override + turns-18-during-period + malformed-pno (Task 1); (b) pure function — no DB state drift; (c) asOfDate required parameter, no `new Date()` fallback, prevents historical-regen bug (RESEARCH §Pitfall 6); (d) D-14 grep absence check (Task 3) ensures zero `__employer__`/`Anordnaren`-adjacent `guardianName` remains after refactor. |
| T-8-02 | Tampering / Regression | pdf.ts signature fields (141, 147, 303) + form4805-utils.ts:120 | mitigate | Over-refactoring could delete the guardian's signature-name from the signature-clarification field, leaving the PDF unsigned (also a compliance failure). Mitigations: (a) D-09 signature preservation gate — `grep -cE "(txtNamnfortydl\|flt_txtKontaktperson\|flt_txtNamnteckning)" ... >= 4` (Task 3); (b) existing form4805-utils.test.ts assertions on the signature block still pass post-refactor (Task 2 acceptance criteria). |
| T-8-03 | Tampering / Malformed Input | isMinor / resolveEmployerRepresentation with malformed pno | accept (with graceful degradation) | Malformed pno (< 8 digits, all zeros, empty) should NOT throw — the PDF must still render so Phase 10 DATA-01's visual walkthrough catches the placeholder. Helper returns `isMinor=false`, `företrädare=null` (unless flag true); arbetsgivare.name populated from profile verbatim. Rationale: this is not an attack vector — profile.patientPno is guardian-entered via Settings, and the `000000-0000` placeholder is a known transition state until Phase 10. Test 7/8 in Task 1 cover this. |
| T-8-04 | Denial of Service / Type Drift | Form4805Profile extension breaks callers not updated | mitigate | TypeScript compile error would surface at `cd server && npm run build` (Task 2 + Task 3 gate). All `Form4805Input.profile` construction sites searched via grep during Task 3 — only `pdf.ts:370-390` builds this input in production; test fixture in `form4805-utils.test.ts:13-19` is the other site and is updated in Task 2. |

**Block severity:** `high` — any `T-8-01` or `T-8-02` residual after Task 3 gates the phase (grep absence check + D-09 preservation gate + full suite green).
</threat_model>

<verification>
## Phase-Level Verification Gates

After Task 3 completes, all of the following MUST be green for Phase 8 to be considered complete:

1. **Unit test suite:** `cd server && npm test` exits 0. New file `employer-representation.test.ts` contributes >= 11 passing tests; existing suites (`form4805-utils.test.ts`, `payroll-utils.test.ts`, `deadlineUtils.test.ts`, `reminderCron.test.ts`) remain green.
2. **D-13 named cases:** All four named cases exit 0 independently:
   - `cd server && npm test -- employer-representation -t "minor-by-pno"`
   - `cd server && npm test -- employer-representation -t "adult-with-override"`
   - `cd server && npm test -- employer-representation -t "adult-without-override"`
   - `cd server && npm test -- employer-representation -t "turns 18"`
3. **EMP-02 regression gate (D-14 grep absence check):** The exact command from RESEARCH.md §Validation Architecture emits NO output:
   ```bash
   grep -rEn "(__employer__|flt_txtNamnAnordnaren)" server/src/ | grep guardianName
   ```
4. **D-09 preservation gate (no over-refactor):**
   ```bash
   grep -cE "(txtNamnfortydl|flt_txtKontaktperson|flt_txtNamnteckning)" server/src/routes/pdf.ts server/src/lib/form4805-utils.ts
   ```
   Returns >= 4 (guardian signatures/contact still wired).
5. **Type-check:** `cd server && npm run build` exits 0.
6. **Artifact shape gates:**
   - `server/src/lib/employer-representation.ts` exists and exports `resolveEmployerRepresentation`, `isMinor`, `EmployerRepresentation`.
   - `server/src/lib/employer-representation.test.ts` exists with >= 11 `it(...)` blocks.
   - `server/src/lib/form4805-utils.ts` `Form4805Profile` type has 12 fields including `patientName`, `patientPno`, `patientRequiresRepresentative`, `addressStreet`, `addressZip`, `addressCity`.
   - `server/src/routes/pdf.ts` /fk3059 handler imports and calls `resolveEmployerRepresentation`; /4805 handler's `Form4805Input.profile` has the 6 new fields.

## Manual-Only Verifications (deferred to Phase 10)

SC-1 from ROADMAP §Phase 8 ("Guardian regenerates FK 3057, FK 3059, and SKV 4805 PDFs for a historical month and the employer field shows the patient's name + pno") is a visual check on generated government PDFs. Per D-14 + VALIDATION.md line 68, this is deferred to Phase 10 DATA-01's end-to-end walkthrough. No checkpoint in Phase 8.
</verification>

<success_criteria>
Phase 8 is complete when:

1. **EMP-01 (helper correctness):** `resolveEmployerRepresentation()` returns structured `{ arbetsgivare: {name, pno, address}, företrädare: {name, pno} | null, isMinor }` with:
   - `arbetsgivare` always = patient identity (name from `profile.patientName`, pno from `profile.patientPno`, address from split columns with single-line fallback per D-07)
   - `företrädare` non-null when `(minor OR (adult AND patient_requires_representative=true))`; null otherwise
   - `isMinor` = pure function of (pno, asOfDate) per D-01
   - 4 named D-13 unit tests green + malformed-pno + address-fallback tests green + `isMinor` unit tests green
2. **EMP-02 (consumer refactor):**
   - `form4805-utils.ts` `__employer__` block (formerly lines 91-93) writes `rep.arbetsgivare.*` from helper — NOT `profile.guardianName`
   - `pdf.ts` /fk3059 handler's `flt_txtNamnAnordnaren[0]` (line 140) writes `rep.arbetsgivare.name` from helper — NOT `prof?.guardianName`
   - `pdf.ts` /4805 handler builds `Form4805Input.profile` with 6 new fields (patient identity + override + split address)
   - Grep absence check `grep -rEn "(__employer__|flt_txtNamnAnordnaren)" server/src/ | grep guardianName` returns empty
3. **D-09 signature preservation:** `form4805-utils.ts:120` (txtNamnfortydl) + `pdf.ts:141` (Kontaktperson) + `pdf.ts:147` (Namnteckning2) + `pdf.ts:303` (FK 3057 Namnteckning) all remain `profile.guardianName` / `prof?.guardianName`
4. **Build + full test suite green:** `cd server && npm test && npm run build` both exit 0
5. **Backward compatibility:** existing `form4805-utils.test.ts` assertions for assistant, kod fields, tax withheld, signature block remain green after fixture extension
</success_criteria>

<output>
After completion, create `.planning/phases/08-employer-representation-helper/08-01-SUMMARY.md` containing:

- Files created: `server/src/lib/employer-representation.ts`, `server/src/lib/employer-representation.test.ts`
- Files modified: `server/src/lib/form4805-utils.ts`, `server/src/lib/form4805-utils.test.ts`, `server/src/routes/pdf.ts`
- Decision resolutions:
  - D-08 line-number discrepancy (RESEARCH Open Question #1): confirmed that `flt_txtNamnAnordnaren[0]` at pdf.ts:140 lives inside the `/fk3059` handler (the Tidsredovisning form). Refactored regardless. Record the final physical PDF this field belongs to after visual inspection of `forms/fk3057.pdf` vs `forms/fk3059.pdf`.
  - D-11 Swedish label: kept CONTEXT default "Företrädd av" (research found "Ställföreträdare" as formal alternative; rejected as too formal for lönespec). Label is not used in Phase 8 code — surfaces in Phase 9 slip renderer.
  - Form4805Profile extension (RESEARCH Open Question #2): extended type with 6 new fields (chosen over input-contract restructure for minimal caller diff).
  - asOfDate construction (RESEARCH Open Question #3): computed by callers — `/fk3059` uses `new Date(end)`; `buildForm4805Fields` computes `new Date(year, month, 0)` from yearMonth.
- Test count: X passing in employer-representation.test.ts; Y passing in form4805-utils.test.ts (pre-existing baseline + 1 new employer-block canary).
- Grep gates: both EMP-02 absence check and D-09 preservation check green with exact command outputs captured.
- Full test suite: `cd server && npm test` passing count snapshot.
- tsc: `cd server && npm run build` clean.
- Downstream handoff: Phase 9 salary slip renderer can now call `resolveEmployerRepresentation(profile, lastDayOfPeriod)` to populate the slip header's `Arbetsgivare:` + optional `Företrädd av:` lines (ROADMAP §Phase 9 SC-4).
</output>
