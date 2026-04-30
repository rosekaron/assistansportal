# Phase 8: Employer Representation Helper - Research

**Researched:** 2026-04-18
**Domain:** TypeScript pure-function helper (server-side) + refactor of 3 existing PDF renderers (FK 3057, FK 3059, SKV 4805)
**Confidence:** HIGH

## Summary

Phase 8 extracts a single pure function `resolveEmployerRepresentation(profile, asOfDate)` that becomes the authoritative source for the `arbetsgivare` (employer) and `företrädare` (representative) fields on every document the platform produces. Today `profile.guardianName` is hardcoded as the employer in 2 source files at 7 call sites — correct for Kalinga's actual minor-patient case but silently wrong for any adult patient. The helper closes this latent bug and gives Phase 9's salary slip a clean, reusable input.

All prerequisite infrastructure is in place: Phase 7 shipped `profile.patient_requires_representative` (schema.ts:52, verified in live DB), the Settings UI exposes it (Settings.tsx:790), and the PUT whitelist accepts it (profile.ts:39). An existing `birthYearFromPno()` in form4805-utils.ts:38 parses the 12-digit format the codebase uses — the new helper can either reuse or supersede it. Test framework is Vitest, co-located `*.test.ts` pattern, all driven by `npm test` from `server/`.

**Primary recommendation:** Place the helper at `server/src/lib/employer-representation.ts` with a co-located `employer-representation.test.ts`. Keep `birthYearFromPno` export from form4805-utils.ts for backwards compatibility, add a new `isMinor(pno, asOfDate)` to the new file. Refactor the 3 PDF renderers to call the helper for employer-name fields only (per D-08); signature / Kontaktperson / Namnteckning fields remain guardian-sourced per D-09. Ship in one plan — scope is ~5 touchpoints, ~4 test cases, no new dependencies.

## User Constraints (from CONTEXT.md)

### Locked Decisions

**Minor detection**
- **D-01:** Parse the patient's age from `profile.patientPno` using the standard Swedish personnummer format (YYMMDD-XXXX or YYYYMMDD-XXXX). Compute age relative to the report period's **end date** (not current date, not start-of-period).
- **D-02:** If the patient turns 18 during a report month, that month is treated as **adult** (end-of-period age ≥ 18 → adult). Locks the 18th-birthday transition to a clean month boundary.

**Override flag semantics**
- **D-03:** `profile.patient_requires_representative` applies **only to adult patients**. For minor patients the representative is always shown regardless of the flag.
- **D-04:** For adult patients: flag `true` → helper returns guardian as representative. Flag `false/null` → representative fields are null, only the patient appears.
- **D-05:** The flag is a **stopgap** until a richer roles model ships. Helper contract is designed so a future roles system can replace this flag without renaming the returned shape.

**Helper contract (semantics locked; TypeScript shape is Claude's discretion)**
- **D-06:** Return shape carries structured data, not pre-formatted strings. At minimum:
  - `arbetsgivare`: `{ name, pno, address }` — always populated, always = patient identity
  - `företrädare`: `{ name, pno } | null` — populated when patient is minor OR (adult AND override flag true)
- **D-07:** Address handling uses split columns (`profile.address_street`, `address_zip`, `address_city`) with fallback to single-line `profile.address`.

**Form-field mapping (locked per compliance scout)**
- **D-08:** Only these government-fixed PDF fields change their source from guardian → patient:
  - SKV 4805: `__employer__txtNamn[0]`, `__employer__txtPersNr[0]`, `__employer__txtAdress[0]` (form4805-utils.ts:91–93)
  - FK 3057: `form1[0].#subform[0].flt_txtNamnAnordnaren[0]` (pdf.ts:140)
- **D-09:** Signature / contact fields stay guardian-sourced: `Kontaktperson` (pdf.ts:141), `Namnteckning` on FK 3057 (pdf.ts:147, 303), SKV 4805 (form4805-utils.ts:120), and `flt_txtNamnteckning2[0]` (pdf.ts:147).
- **D-10:** FK 3059 has NO employer field — only `Namnteckning` (guardian signs). No PDF-mapping change needed. Helper is still called for future slip cross-reference consistency.

**Swedish labels**
- **D-11:** Slip representative line defaults to **"Företrädd av: [name] ([pno])"**. Research can override if a better convention is found.
- **D-12:** FK/SKV PDF field labels are government-fixed — never edited. Only the VALUE changes.

**Test coverage**
- **D-13:** Helper unit tests MUST cover: (a) minor-by-pno (no flag), (b) adult-with-override (flag=true), (c) adult-without-override (flag=false/null). Plus (d) end-of-period boundary (patient turns 18 during report month).
- **D-14:** Grep check that no source file under `server/src/` references `profile.guardianName` for any employer field listed in D-08. Integration-level PDF regeneration tests NOT required this phase.

### Claude's Discretion
- Exact TypeScript function signature + file location (likely `server/src/lib/employer-representation.ts`; reuse `form4805-utils.ts:6-22` type pattern).
- How to share the helper between `form4805-utils.ts` and `pdf.ts` without circular imports.
- Plan decomposition (single plan vs split).
- Exact Swedish label variants on the slip if research surfaces a better term than "Företrädd av".
- Pno parsing implementation detail.

### Deferred Ideas (OUT OF SCOPE)
- **Roles system:** multi-admin for both parents, admin-transfer when child becomes adult, god-man as admin role. Target: v1.2+ or dedicated roles milestone.
- **Integration-level PDF regeneration tests:** deferred — Phase 10 DATA-01 will exercise on real data.

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| EMP-01 | `resolveEmployerRepresentation()` helper returns correct `{arbetsgivareName, arbetsgivarePno, företrädareName, företrädarePno, isMinor}` based on minor-status + override | Pure-function pattern (existing in form4805-utils.ts); Vitest co-located unit tests (established); 12-digit pno century parsing already solved by `birthYearFromPno` (form4805-utils.ts:38) |
| EMP-02 | FK 3057, FK 3059, SKV 4805, and salary slip renderers all use the helper — zero direct `profile.guardianName` references for the employer field | 5 refactor sites inventoried below (pdf.ts:140 employer + FK 4805 lines 91–93); grep regression check possible via simple shell command per D-14 |

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Vitest | ^4.1.2 | Test runner for helper + co-located tests | [VERIFIED: server/package.json:47] — already used project-wide (form4805-utils.test.ts, payroll-utils.test.ts, deadlineUtils.test.ts, reminderCron.test.ts) |
| TypeScript | ^5.4.5 | Type-safe helper contract | [VERIFIED: server/package.json:46] — entire project is TS |
| drizzle-orm | ^0.30.10 | Profile type inference (`Profile = typeof profile.$inferSelect`) | [VERIFIED: server/src/db/schema.ts:270] — existing pattern |

### Supporting
No new libraries required. Helper is pure TS, zero dependencies.

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Pure function + Vitest | Zod schema for input validation | Overkill — Profile type already inferred; inputs are trusted (come from DB select). [ASSUMED] |
| Standalone pno library | [personnummer](https://www.npmjs.com/package/personnummer) npm package | Would add a dep for ~20 lines of parsing. Existing `birthYearFromPno` already works for the 12-digit stored format. Skip. [CITED: form4805-utils.ts:38] |

**Installation:** None required.

**Version verification:** Not applicable — no new packages.

## Architecture Patterns

### Recommended Project Structure
```
server/src/lib/
├── employer-representation.ts       # NEW — the helper + its types + isMinor()
├── employer-representation.test.ts  # NEW — 4 unit test cases per D-13
├── form4805-utils.ts                # REFACTOR — lines 91–93, 120 call helper
└── ... (existing files unchanged)

server/src/routes/
└── pdf.ts                           # REFACTOR — lines 140 (FK 3057 employer), 372–379 (4805 input build)
```

**Rationale for `lib/` placement:**
- Follows existing convention — all 4 co-located tests (`form4805-utils.test.ts`, `payroll-utils.test.ts`, `deadlineUtils.test.ts`, `reminderCron.test.ts`) live in `server/src/lib/`.
- No circular-import risk — the helper is a LEAF. Both `form4805-utils.ts` and `pdf.ts` import FROM it; it imports nothing from them.
- Vitest config picks up `src/**/*.test.ts` automatically (vitest.config.ts:7).

### Pattern 1: Pure function returning structured data
**What:** Single function, no DB access, no side effects. Takes `profile` + `asOfDate`, returns `{ arbetsgivare, företrädare }`.
**When to use:** Always for this helper — makes it trivially unit-testable and locks the "minor-status is a pure function of (pno, date)" invariant per CONTEXT specifics.
**Example:**
```typescript
// Source: Pattern established by form4805-utils.ts:38-45 (pure, no DB)
// PROPOSED — not implementation; planner decides final signature
export type EmployerRepresentation = {
  arbetsgivare: { name: string; pno: string; address: string };
  företrädare: { name: string; pno: string } | null;
  isMinor: boolean;
};

export function resolveEmployerRepresentation(
  profile: Pick<Profile, "patientName" | "patientPno" | "guardianName" | "guardianPno"
    | "address" | "addressStreet" | "addressZip" | "addressCity"
    | "patientRequiresRepresentative">,
  asOfDate: Date,  // use report period END per D-01
): EmployerRepresentation { ... }
```

### Pattern 2: Return shape matches slip header contract
**What:** Phase 9 salary slip header (ROADMAP §Phase 9 SC-4) needs `"Arbetsgivare: [patient name + pno]"` and `"Företrädd av: [guardian name + pno]"`. The helper's return shape with structured `{ name, pno }` objects makes this trivial: one line per object, skip the representative line when `företrädare === null`.
**When to use:** Ensures every consumer (FK 3057, SKV 4805, slip) composes strings from the same raw fields — consistency by construction.

### Pattern 3: Address fallback per D-07
**What:** Prefer split columns `address_street` + `address_zip` + `address_city` when any of them is non-empty; fall back to single-line `address` for legacy records. Format matches the existing 4805 address composition (form4805-utils.ts:77–80: `"{address}, {zip} {city}"`).
**When to use:** Every helper call — the employer record is the patient's address.

### Anti-Patterns to Avoid
- **Storing `isMinor` as a column:** Rejected — CONTEXT specifics explicitly warn against "stale `is_minor` column drifts from actual age" bugs. Keep as pure function.
- **Throwing on malformed pno:** CONTEXT code_context requires graceful handling — return `{ arbetsgivare: { name: "", pno: "", address }, företrädare: null, isMinor: false }` or similar degradation that lets the PDF still render. The Phase 10 DATA-01 walkthrough will catch the empty value during visual inspection.
- **Calling the helper from route handlers (outside the renderers):** Call it INSIDE the existing renderers (form4805-utils.ts and inside the fk3057/fk3059 handlers in pdf.ts). Do not add a new route.
- **Applying the override flag to minors:** Per D-03, minor → representative always present regardless of the flag. Don't `||` the flag into the minor branch.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Swedish personnummer century/year extraction | Custom regex spanning 10-digit and 12-digit forms | Existing `birthYearFromPno(pno)` in form4805-utils.ts:38 (parses first 4 digits of 12-digit storage) | Already proven with 3 unit tests (form4805-utils.test.ts:41–52). The codebase stores 12-digit format per Phase 7 D-18 HTML5 pattern `YYYYMMDD-XXXX`. Reuse or inline the same 4-digit-slice logic. [VERIFIED: form4805-utils.ts:38-45, form4805-utils.test.ts:41-52] |
| Age comparison across month/year boundaries | Hand-computed "year − birthYear ± boundary" | Compare birth date to `asOfDate`: `const minor = (asOfDate.getFullYear() - birthYear) * 12 + asOfDate.getMonth() - (birthMonth - 1) < 18 * 12 ...` OR — much simpler — compute the 18th-birthday `Date` and compare `asOfDate < birthday18` | Straightforward once pno is parsed into (year, month, day). [ASSUMED — standard age-math]. Spec the helper to take `asOfDate` as the report-period END date per D-01/D-02. |
| Address formatting | Rebuild the `"{street}, {zip} {city}"` string with new logic | Match existing convention at form4805-utils.ts:77–80 | Visual consistency across 4805, FK 3057, and slip; avoids regression. [VERIFIED: form4805-utils.ts:77-80] |

**Key insight:** Every primitive this helper needs already exists in the codebase — the phase is almost entirely about *replacing hardcoded sources*, not new logic.

## Code Site Inventory (D-14 grep baseline)

All 7 `profile.guardianName` references under `server/src/` as of 2026-04-18 (from Grep results):

| File | Line | Purpose | D-08 says | Action |
|------|------|---------|-----------|--------|
| `server/src/routes/pdf.ts` | 140 | FK 3057 `flt_txtNamnAnordnaren[0]` ("Anordnaren" = the arranger = employer) | Change to patient | **REFACTOR** — call helper, use `rep.arbetsgivare.name` |
| `server/src/routes/pdf.ts` | 141 | FK 3057 `flt_txtKontaktperson[0]` (contact person) | Keep guardian | **KEEP** — guardian is contact |
| `server/src/routes/pdf.ts` | 147 | FK 3059 `flt_txtNamnteckning2[0]` (signature line 2) | Keep guardian | **KEEP** — guardian signs |
| `server/src/routes/pdf.ts` | 303 | FK 3057 `flt_txtNamnteckning[0]` (signature) | Keep guardian | **KEEP** — guardian signs |
| `server/src/routes/pdf.ts` | 373 | SKV 4805 input — `profile.guardianName` passed into `Form4805Input.profile` | Change to patient | **REFACTOR** — replace with helper output OR refactor input type |
| `server/src/lib/form4805-utils.ts` | 91 | SKV 4805 `__employer__txtNamn[0]` writes `profile.guardianName` | Change to patient | **REFACTOR** — write `rep.arbetsgivare.name` |
| `server/src/lib/form4805-utils.ts` | 120 | SKV 4805 `txtNamnfortydl[0]` (signature name clarification) | Keep guardian | **KEEP** — guardian signs |

**Outside `server/src/` (reference only, out of phase scope):**
- `server/src/routes/auth.ts:265` — `"Your guardian"` email placeholder (unrelated to employer)
- `server/src/routes/misc.ts:57,59` — invite email ("Your guardian has invited you") (unrelated)
- `server/src/db/schema.ts:31` — column definition (must remain)
- `server/src/lib/email.ts:45,54` — invite email template (unrelated)
- `server/src/lib/form4805-utils.test.ts:13` — test fixture (will need updating only if types change)

**For D-14 grep check, the planner's automated test is:**
```bash
# Passes when ALL employer-field call sites have been migrated
# (i.e. no employer-adjacent use of guardianName remains in server/src/)
#
# Must match lines 91 (form4805-utils employer block) and 140 (pdf.ts Anordnaren)
# but allow lines 120/141/147/303 (signature/contact — per D-09).
grep -n "profile\.guardianName\|prof?\.guardianName\|\.guardianName" server/src/routes/pdf.ts server/src/lib/form4805-utils.ts \
  | grep -v "Namnteckning\|Kontaktperson\|txtNamnfortydl"
```
This command should emit NOTHING after the refactor.

### FK 3057 Shape (pdf.ts:237–316)
- Data passed in: single `profile` row (db.select().from(profile).limit(1)) + computed billable hours.
- Employer fields it writes: `flt_txtNamnAnordnaren[0]` (name), `flt_txtFnamnEnamnBrukare[0]` (patient name — ALREADY correct, uses `patientName`), `flt_txtPersonNrBrukare[0]` (patient pno — ALREADY correct).
- **No pno field for the employer** on FK 3057 — only name changes per D-08 (Anordnaren). Patient pno already flows through `flt_txtPersonNrBrukare[0]`.
- Signature: `flt_txtNamnteckning[0]` (guardian per D-09), `flt_txtTel[0]` (guardian phone).

### FK 3059 Shape (pdf.ts:67–234)
- Data passed in: profile + assistant + monthly entries + absences.
- Per D-10: NO employer field on FK 3059. The only employer-adjacent field was `flt_txtNamnAnordnaren[0]` (pdf.ts:140) — wait, verify: line 140 is **in the FK 3059 handler** (lines 67–234 scope). Re-reading: pdf.ts:140 IS inside the `/fk3059` handler. Correcting:
  - **pdf.ts:140** `flt_txtNamnAnordnaren[0]` — this IS on FK 3059, in "Section 5: Guardian / employer" per the code comment. D-10 said "FK 3059 has no employer field" — but the form DOES have a `flt_txtNamnAnordnaren[0]` slot. Checking CONTEXT D-10 more carefully: CONTEXT refers to "only `Namnteckning` (guardian signs)" on FK 3059 signature block, while D-08 explicitly lists `flt_txtNamnAnordnaren[0]` under **FK 3057** (pdf.ts:140). The line numbers in D-08 and D-10 may have been written assuming one is for 3057, one for 3059. **Actual code location:** pdf.ts:140 is in `/fk3059` (lines 67–234). pdf.ts:303 is in `/fk3057` (lines 237–316).

  **[ASSUMED interpretation]** — The planner should verify directly with the code, but the likely resolution is:
  - CONTEXT D-08 second bullet ("FK 3057: flt_txtNamnAnordnaren[0] → patient name") actually targets the field on **FK 3059** (where it lives per code). FK 3057 has no `Anordnaren` field — only `Brukare` fields (already correct) and the `Namnteckning`/`Tel` signature block.
  - CONTEXT D-10 ("FK 3059 has no employer field") is technically incorrect if "Anordnaren" is considered the employer — OR D-10 means "no employer PDF slot DISTINCT from what the helper produces". Either way the correct semantic is: the Anordnaren field at pdf.ts:140 should show the PATIENT per EMP-01.

  **Flagged for planner confirmation at plan time — this phrasing discrepancy needs a one-line sanity check against the actual PDFs.** Safe default: refactor pdf.ts:140 to helper, keep 141/147 as guardian. This satisfies both D-08 and EMP-02.

### SKV 4805 Shape (form4805-utils.ts:67–124)
- Input type: `Form4805Input = { yearMonth, profile: Form4805Profile, assistant, payrollRecord }` where `Form4805Profile` already carries only the fields needed (guardianName, guardianPno, guardianPhone, address, city, zip).
- Employer fields written via `__employer__` prefix (handled specially in pdf.ts:406–417 because SKV 4805 has duplicate field names across employer/recipient sections).
- **Recommended refactor approach (Claude's discretion per CONTEXT):** Extend `Form4805Profile` with patient identity fields, OR build a new input shape where the helper's return value is passed in directly. The former is less invasive (keeps the caller pattern at pdf.ts:370–390 intact).

## Minor Detection Logic

**Canonical pno format in this codebase:** 12-digit string `YYYYMMDDXXXX` (no separator), per:
- `form4805-utils.ts:38-45` — `birthYearFromPno` slices `digits.slice(0, 4)` as year
- Phase 7 D-18 — HTML5 `pattern` on UI inputs is `YYYYMMDD-XXXX`
- Test fixtures: `197001011234`, `199001011234` (form4805-utils.test.ts:13–24)

**Recommended implementation (Claude's discretion — planner decides final form):**
```typescript
// PROPOSED — co-located in server/src/lib/employer-representation.ts
export function isMinor(pno: string, asOfDate: Date): boolean {
  const digits = pno.replace(/\D/g, "");
  if (digits.length < 8) return false;  // malformed → treat as adult, representative depends on flag
  const year  = parseInt(digits.slice(0, 4), 10);
  const month = parseInt(digits.slice(4, 6), 10);
  const day   = parseInt(digits.slice(6, 8), 10);
  if (isNaN(year) || isNaN(month) || isNaN(day)) return false;
  // 18th birthday is (year+18)-month-day. asOfDate < birthday18 → minor.
  const birthday18 = new Date(year + 18, month - 1, day);
  return asOfDate < birthday18;
}
```

**D-02 boundary:** If a patient's 18th birthday is 2026-03-15 and the report period is 2026-03-01 → 2026-03-31, `asOfDate = 2026-03-31`, `birthday18 = 2026-03-15`, `asOfDate >= birthday18` → **adult** for the whole month. Matches D-02 locked behavior.

**10-digit pno handling (not used in this codebase's storage but guardians may paste):** CONTEXT code_context notes no existing `parsePno()` — and `patientPno` comes from DB which is populated via Settings UI with HTML5 `pattern` for 12-digit. Helper should gracefully return `false` (treat as adult, flag decides) when length < 8 digits. Phase 10 DATA-01 catches the 000000-0000 placeholder case.

## Swedish Label Research (D-11)

**"Företrädd av"** — the CONTEXT default — is correct and standard.

**Alternative conventions found:**
- **"Ställföreträdare"** — formal term used by Skatteverket for legal-guardian contexts ("legal representative"). More precise but less colloquial than "Företrädd av". Applies to both vårdnadshavare (parent-guardian) and god man / förvaltare (adult-guardian) cases. [CITED: docs/compliance/swedish-fk-and-labor-rules.md:283 uses "god man/förvaltare" in that register]
- **"Vårdnadshavare"** — only correct for minor + parent, not for adult-with-god-man. Rejected as universal label.
- **"Företrädd av"** — literally "represented by". Works for both cases per CONTEXT analysis. Neutral and user-friendly.

**Recommendation:** Keep CONTEXT default "Företrädd av" — it is (a) already locked in CONTEXT D-11 as default, (b) correct for both legal cases this helper covers (minor-with-parent and adult-with-god-man per D-04), (c) more human than "Ställföreträdare" on a lönespec. No override to CONTEXT.

**Confidence:** MEDIUM — based on reading the project's own compliance doc. Planner/guardian can confirm during Phase 9 slip UI review if desired.

## Common Pitfalls

### Pitfall 1: Type drift in Form4805Profile
**What goes wrong:** `form4805-utils.ts:5-12` defines `Form4805Profile` with guardian-only fields. Refactoring to accept patient fields means either (a) extending this type or (b) passing the helper's output directly. The test fixtures at `form4805-utils.test.ts:13-19` only populate guardian fields and will need updating.
**Why it happens:** Mechanical rename doesn't catch test fixture drift.
**How to avoid:** Update the test fixtures in the SAME commit as the type change. Run `npm test` BEFORE committing.
**Warning signs:** `tsc` emits property-missing errors on `Form4805Profile`; existing test fails on field-not-found.

### Pitfall 2: Circular import via co-location
**What goes wrong:** If the helper imports `Form4805Profile` from `form4805-utils.ts`, and `form4805-utils.ts` imports the helper, there is a cycle.
**Why it happens:** TS module resolution doesn't crash on cycles at compile time, but it can cause undefined-at-runtime bugs.
**How to avoid:** Keep the helper's TYPES local to `employer-representation.ts`. Consumers (form4805-utils.ts, pdf.ts) import the helper's types. Never the other direction. [VERIFIED by CONTEXT code_context: "No existing helper file with this name; no circular-import risk if placed in server/src/lib/"]
**Warning signs:** "Cannot access X before initialization" at runtime; strange Vitest import errors.

### Pitfall 3: Placeholder `000000-0000` pno
**What goes wrong:** Current DB has `patientPno: "000000-0000"` placeholder (Phase 10 DATA-01 will replace). Helper parses this as birthday year 0000 → everyone born 18 years after year 0 is adult → isMinor returns false regardless of actual status → currently-minor patients LOSE the företrädare line until real pno is entered.
**Why it happens:** CONTEXT code_context line 86 explicitly warns: "Helper must gracefully handle empty / malformed pno — returns `null representative + patient name empty` rather than throwing, so PDFs still render".
**How to avoid:** Detect obviously-invalid pno (all zeros, too short) and fall back to "adult without override" semantics — representative null unless flag is true. Phase 10 DATA-01 walkthrough will hit the placeholder in visual inspection. Document as acceptable v1.0.1 behavior.
**Warning signs:** Minor patient with placeholder pno + flag false → slip has no "Företrädd av" line. Only matters during placeholder phase.

### Pitfall 4: Applying override to minors
**What goes wrong:** D-03 says override is adult-only. Writing `const minor = isMinorByPno || flag` collapses the two cases and breaks the contract when a minor has `flag=false` (should STILL have representative).
**Why it happens:** Easy to over-simplify by merging the two booleans.
**How to avoid:** Explicitly gate: `const needsRep = isMinorByPno(pno, asOfDate) || (!isMinorByPno(pno, asOfDate) && flag === true);` — which is equivalent to `isMinor || flag` in current semantics BUT makes the intent explicit. Test case (b) in D-13 catches this: adult-with-override flag=true → representative present; test case (a) minor-by-pno-no-flag → representative present. If the boolean were ANDed instead of ORed, case (a) would fail.
**Warning signs:** D-13 test case (a) fails — representative is null for a minor with flag=false.

### Pitfall 5: Year-end / month-end asOfDate
**What goes wrong:** D-01 locks `asOfDate` to the report period END date. Report period "2026-03" → end date must be `2026-03-31` (not start, not current). If the caller passes the wrong date, the boundary month (patient's 18th birthday month) flips the wrong direction.
**Why it happens:** Each caller constructs the date differently. `pdf.ts:80-81` computes `end = ${year}-${mm}-${String(daysInMonth).padStart(2,"0")}` for FK 3059 already. FK 3057 at line 253 also computes `daysInMonth`. SKV 4805 has `yearMonth` ("YYYY-MM") but not an explicit end-date — will need to compute.
**How to avoid:** Helper accepts `asOfDate: Date` and callers MUST construct it as "last day of report month". Consider making the helper also accept a convenience `YYYY-MM` string that computes the end date internally — but CONTEXT D-06 says callers pass in structured data, not formatted strings. Keep `Date` as canonical input; let callers build it.
**Warning signs:** D-13 test case (d) — 18th birthday during report month — comes out wrong when start-of-period date is accidentally passed.

### Pitfall 6: asOfDate uses `new Date()` (today) inside the renderer
**What goes wrong:** When guardian regenerates a HISTORICAL month (e.g., regenerates 2026-01 SKV 4805 in April), the helper gets today's date and flips minor→adult even though the report is for January when patient was still a minor.
**Why it happens:** It's tempting to just call `new Date()` because "current time".
**How to avoid:** Helper signature REQUIRES `asOfDate` as a parameter. No default. Documentation comment explicitly states "use the last day of the report period, not today".
**Warning signs:** SC-1 fails — regenerating a historical month for a minor patient produces an adult-shaped PDF.

## Code Examples

### Helper skeleton (PROPOSED — planner finalizes)
```typescript
// Source: Pattern from form4805-utils.ts; PROPOSED structure.
// File: server/src/lib/employer-representation.ts

import type { Profile } from "../db/schema";

export type EmployerRepresentation = {
  arbetsgivare: { name: string; pno: string; address: string };
  företrädare: { name: string; pno: string } | null;
  isMinor: boolean;
};

export function isMinor(pno: string, asOfDate: Date): boolean {
  const digits = pno.replace(/\D/g, "");
  if (digits.length < 8) return false;
  const year  = parseInt(digits.slice(0, 4), 10);
  const month = parseInt(digits.slice(4, 6), 10);
  const day   = parseInt(digits.slice(6, 8), 10);
  if (!year || !month || !day) return false;
  const birthday18 = new Date(year + 18, month - 1, day);
  return asOfDate < birthday18;
}

function buildPatientAddress(p: Pick<Profile,
  "address" | "addressStreet" | "addressZip" | "addressCity">): string {
  // D-07: prefer split columns; fall back to single-line address.
  const hasSplit = !!(p.addressStreet || p.addressZip || p.addressCity);
  if (hasSplit) {
    const line = [p.addressStreet, [p.addressZip, p.addressCity].filter(Boolean).join(" ")]
      .filter(Boolean).join(", ").trim();
    if (line) return line;
  }
  return (p.address ?? "").trim();
}

export function resolveEmployerRepresentation(
  profile: Pick<Profile,
    "patientName" | "patientPno" | "guardianName" | "guardianPno"
    | "address" | "addressStreet" | "addressZip" | "addressCity"
    | "patientRequiresRepresentative">,
  asOfDate: Date,
): EmployerRepresentation {
  const minor    = isMinor(profile.patientPno ?? "", asOfDate);
  const override = profile.patientRequiresRepresentative === true;
  const needsRep = minor || override;       // D-03, D-04
  return {
    arbetsgivare: {
      name:    profile.patientName ?? "",
      pno:     profile.patientPno  ?? "",
      address: buildPatientAddress(profile),
    },
    företrädare: needsRep
      ? { name: profile.guardianName ?? "", pno: profile.guardianPno ?? "" }
      : null,
    isMinor: minor,  // keep as a separate field — slip label logic may vary per D-11
  };
}
```

### Consumer refactor at form4805-utils.ts:91
```typescript
// Source: form4805-utils.ts current state (lines 67–124).
// PROPOSED refactor — planner decides whether to (a) extend Form4805Profile
// with patient fields and call the helper INSIDE buildForm4805Fields,
// or (b) pass the helper's output through a new input field.
// Option (a) is less invasive to pdf.ts:370–390 — recommended.

// BEFORE (line 91):
// fields["__employer__txtNamn[0]"]   = profile.guardianName;
// fields["__employer__txtPersNr[0]"] = profile.guardianPno;
// fields["__employer__txtAdress[0]"] = guardianAddress;

// AFTER (conceptual):
// const rep = resolveEmployerRepresentation(profile, lastDayOf(input.yearMonth));
// fields["__employer__txtNamn[0]"]   = rep.arbetsgivare.name;
// fields["__employer__txtPersNr[0]"] = rep.arbetsgivare.pno;
// fields["__employer__txtAdress[0]"] = rep.arbetsgivare.address;
// // signature (line 120) stays guardian per D-09:
// fields["txtNamnfortydl[0]"] = profile.guardianName;
```

### Test scaffold per D-13
```typescript
// File: server/src/lib/employer-representation.test.ts
// PROPOSED — 4 cases per D-13 (a)(b)(c)(d).

import { describe, it, expect } from "vitest";
import { resolveEmployerRepresentation, isMinor } from "./employer-representation";

const baseProfile = {
  patientName: "Liam Karon", patientPno: "201501011234",
  guardianName: "Rose Karon", guardianPno: "198011155069",
  address: "Storgatan 1", addressStreet: "", addressZip: "", addressCity: "",
  patientRequiresRepresentative: false,
} as const;

describe("resolveEmployerRepresentation", () => {
  it("(a) minor-by-pno, flag false → representative present", () => {
    const rep = resolveEmployerRepresentation(baseProfile, new Date("2026-03-31"));
    expect(rep.isMinor).toBe(true);
    expect(rep.arbetsgivare.name).toBe("Liam Karon");
    expect(rep.företrädare?.name).toBe("Rose Karon");
  });

  it("(b) adult pno, flag true → representative present (god-man case)", () => {
    const rep = resolveEmployerRepresentation(
      { ...baseProfile, patientPno: "197001011234", patientRequiresRepresentative: true },
      new Date("2026-03-31"));
    expect(rep.isMinor).toBe(false);
    expect(rep.företrädare?.name).toBe("Rose Karon");
  });

  it("(c) adult pno, flag false → representative null", () => {
    const rep = resolveEmployerRepresentation(
      { ...baseProfile, patientPno: "197001011234", patientRequiresRepresentative: false },
      new Date("2026-03-31"));
    expect(rep.isMinor).toBe(false);
    expect(rep.företrädare).toBeNull();
  });

  it("(d) turns 18 during report month → adult at end-of-period", () => {
    // Born 2008-03-15 → turns 18 on 2026-03-15. Report period 2026-03 ends 2026-03-31.
    const rep = resolveEmployerRepresentation(
      { ...baseProfile, patientPno: "200803151234" },
      new Date("2026-03-31"));
    expect(rep.isMinor).toBe(false);              // D-02: end-of-period wins
    expect(rep.företrädare).toBeNull();           // flag is false
  });
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Hardcode `profile.guardianName` as employer in every renderer | Central helper returns structured `{ arbetsgivare, företrädare }` | Phase 8 (this phase) | Single source of truth; fixes latent adult-patient bug; unblocks Phase 9 slip |
| `birthYearFromPno` lives in form4805-utils (scoped to 4805) | Promote minor-detection to a shared helper file (or leave birthYearFromPno in place and add isMinor in new file) | Phase 8 | Avoid cross-file dependency from pdf.ts to form4805-utils just for pno parsing |

**Deprecated/outdated:** Nothing — this is new code against an existing, current stack.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | D-08 line references for FK 3057/3059 are slightly misaligned with actual code (pdf.ts:140 is inside `/fk3059` handler) — safe interpretation is "refactor pdf.ts:140 regardless of which form label it carries" | Code Site Inventory | LOW — the grep + visual check in the plan will catch any ambiguity; the refactor is correct either way |
| A2 | "Företrädd av" is the right Swedish label for both minor-parent and adult-god-man cases on the slip | Swedish Label Research | LOW — CONTEXT D-11 already lets planner override if a better term is found; default is neutral |
| A3 | 10-digit pno will not appear in `profile.patientPno` because Phase 7 HTML5 pattern enforces 12-digit storage | Minor Detection Logic | LOW — graceful-fallback handling in helper means wrong-length pno degrades to "adult, flag decides" rather than crashing |
| A4 | Extending `Form4805Profile` with patient fields is less invasive than restructuring the input contract | Code Examples | LOW — both shapes are viable; planner can decide |
| A5 | No 10-digit + century-marker parsing needed (no `+` separator for age ≥ 100) | Minor Detection Logic | LOW — anhörig-model patients in this product are minors or working-age adults; a 100-year-old brukare using personal assistance is out of scope |

## Open Questions

1. **Line-number discrepancy in CONTEXT D-08 for FK 3057 vs FK 3059.**
   - What we know: D-08 lists `flt_txtNamnAnordnaren[0]` at pdf.ts:140 as FK 3057; actual code places that line inside the `/fk3059` handler (lines 67–234). FK 3057 handler (lines 237–316) has no Anordnaren field — only Brukare (already correct) and Namnteckning (stays guardian per D-09).
   - What's unclear: Whether D-08 means "FK 3057 PDF form" (in which case the refactor site is different) or "the file pdf.ts at line 140" (in which case the form is actually FK 3059).
   - Recommendation: Planner should open the FK 3057 and FK 3059 official PDFs (both exist at `forms/fk3057.pdf` and `forms/fk3059.pdf`) and confirm which one has the `flt_txtNamnAnordnaren[0]` field. Refactor at pdf.ts:140 regardless — per EMP-02, ZERO `guardianName` references should remain for employer fields under `server/src/`.

2. **Should `Form4805Profile` be extended or replaced?**
   - What we know: Current shape has only guardian + address fields. Helper needs patient name/pno too.
   - What's unclear: Whether to keep the existing call convention (pdf.ts:370–390 builds Form4805Input) or refactor the input contract.
   - Recommendation: Extend `Form4805Profile` with `patientName`, `patientPno`, `patientRequiresRepresentative` and call the helper inside `buildForm4805Fields`. Minimal diff at the pdf.ts call site (only lines 373 need updating). Revisit if Phase 9 slip renderer wants a cleaner contract.

3. **Where should `asOfDate` come from for SKV 4805?**
   - What we know: FK 3057/3059 handlers already compute `start` and `end = YYYY-MM-{daysInMonth}`. SKV 4805 has `yearMonth: "YYYY-MM"` and the helper needs a `Date`.
   - What's unclear: Compute in caller or helper?
   - Recommendation: Compute `asOfDate` in each caller (consistent with existing handlers at pdf.ts:80–81, pdf.ts:253). Helper stays strictly `(profile, Date) → Representation`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Vitest | Unit tests for helper | ✓ | ^4.1.2 | — |
| TypeScript | Helper compilation | ✓ | ^5.4.5 | — |
| drizzle-orm Profile type | Helper input type | ✓ | ^0.30.10 | Inline Pick<> subset |
| PostgreSQL with `patient_requires_representative` column | Runtime read | ✓ | Phase 7 shipped — schema.ts:52 verified, Settings.tsx:790 wired, profile.ts:39 whitelist | — |
| qpdf (system binary) | FK PDF decryption (existing — unchanged by Phase 8) | ✓ (existing dependency — not touched by Phase 8) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `server/vitest.config.ts` |
| Quick run command | `cd server && npm test -- employer-representation` |
| Full suite command | `cd server && npm test` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| EMP-01(a) | Minor-by-pno, flag false → representative present (guardian) | unit | `cd server && npm test -- employer-representation -t "minor-by-pno"` | ❌ Wave 0 |
| EMP-01(b) | Adult pno, flag true → representative present (god-man case) | unit | `cd server && npm test -- employer-representation -t "adult-with-override"` | ❌ Wave 0 |
| EMP-01(c) | Adult pno, flag false/null → representative null | unit | `cd server && npm test -- employer-representation -t "adult-without-override"` | ❌ Wave 0 |
| EMP-01(d) | Patient turns 18 during report month → adult at end-of-period (D-02) | unit | `cd server && npm test -- employer-representation -t "turns 18"` | ❌ Wave 0 |
| EMP-01 | isMinor helper handles empty/short/malformed pno without throwing | unit | `cd server && npm test -- employer-representation -t "malformed"` | ❌ Wave 0 |
| EMP-01 | Address falls back to single-line when split columns empty (D-07) | unit | `cd server && npm test -- employer-representation -t "address fallback"` | ❌ Wave 0 |
| EMP-02 | No `profile.guardianName` used for employer-name field anywhere in `server/src/` (signatures/contact exempt per D-09) | regression (shell) | See Grep Absence Check below | ❌ Wave 0 |
| EMP-02 | `form4805-utils.test.ts` existing tests still pass after refactor | regression | `cd server && npm test -- form4805-utils` | ✓ exists |
| EMP-02 | `npm run build` (tsc) clean after refactor — no type errors in pdf.ts / form4805-utils.ts | type-check | `cd server && npm run build` | ✓ exists |
| SC-1 | Regenerating historical FK 3057/3059/SKV 4805 PDFs shows patient as employer (minor case) or patient-only (adult without override) | manual-only | Phase 10 DATA-01 walkthrough | deferred per D-14 |

### Grep Absence Check (D-14 regression)
```bash
# Script — EMP-02 automated check.
# PASSES when no employer-adjacent use of guardianName remains.

# 1. Employer-field sites that MUST be migrated (blocks if ANY match):
UNMIGRATED=$(grep -nE "(__employer__|flt_txtNamnAnordnaren)" server/src/ -r \
  | grep -E "guardianName" || true)
if [ -n "$UNMIGRATED" ]; then
  echo "FAIL: guardianName still used for employer field:"; echo "$UNMIGRATED"; exit 1
fi

# 2. Signature / contact sites MUST remain guardianName (sanity — prevents over-refactor):
MUST_REMAIN=$(grep -cE "guardianName" server/src/routes/pdf.ts server/src/lib/form4805-utils.ts \
  | awk -F: '{sum+=$2} END {print sum}')
if [ "$MUST_REMAIN" -lt 4 ]; then
  echo "FAIL: too few guardianName refs remaining — over-refactored signatures"; exit 1
fi

echo "PASS: EMP-02 grep invariants hold"
```

### Sampling Rate
- **Per task commit:** `cd server && npm test -- employer-representation` (unit tests only, < 5s)
- **Per wave merge:** `cd server && npm test` (full server suite — form4805-utils.test.ts, payroll-utils.test.ts, deadlineUtils.test.ts, reminderCron.test.ts + new employer-representation.test.ts)
- **Phase gate:** Full suite green + grep absence check green + `cd server && npm run build` clean (tsc)

### Wave 0 Gaps
- [ ] `server/src/lib/employer-representation.ts` — the helper itself
- [ ] `server/src/lib/employer-representation.test.ts` — 4 D-13 cases + fallback cases
- [ ] No framework install needed — Vitest already present

## Project Constraints (from CLAUDE.md)

No `./CLAUDE.md` file exists at the project root. No project-wide Claude directives apply beyond what CONTEXT.md and canonical refs in the phase docs establish.

No `.claude/skills/` or `.agents/skills/` directories exist. (`.claude/` contains only `launch.json` and `settings.local.json`, no SKILL.md files.)

Effective constraints from the planning artifacts (already reflected in this research):
- TypeScript throughout (server/package.json)
- Vitest for all tests (vitest.config.ts)
- No new libraries in v1.0.1 (STATE.md: "No breaking changes to stack; TypeScript throughout")
- Drizzle ORM schema-driven types (`typeof table.$inferSelect`)
- Pure-function pattern for helpers (established by form4805-utils.ts, payroll-utils.ts)
- No new route surface for this phase (CONTEXT code_context: "No new route surface")

## Sources

### Primary (HIGH confidence)
- `server/src/lib/form4805-utils.ts` — existing helper pattern, `birthYearFromPno` implementation, address-format convention (lines 38–45, 77–80, 91–93, 120)
- `server/src/lib/form4805-utils.test.ts` — Vitest co-location and fixture pattern (lines 1–178)
- `server/src/routes/pdf.ts` — FK 3057 (lines 237–316), FK 3059 (lines 67–234), SKV 4805 (lines 328–431) call sites + all 5 `guardianName` usages
- `server/src/routes/profile.ts` — PUT whitelist confirming `patientRequiresRepresentative` writeable (line 39)
- `server/src/db/schema.ts` — profile table definition with `patientRequiresRepresentative` column (line 52) and all address/pno fields (lines 29–57)
- `server/vitest.config.ts` — test config (picks up `src/**/*.test.ts`)
- `server/package.json` — Vitest 4.1.2, TypeScript 5.4.5, test command `npm test`
- `.planning/phases/08-employer-representation-helper/08-CONTEXT.md` — all locked decisions D-01 through D-14
- `.planning/phases/07-foundation-schema-cleanup/07-VERIFICATION.md` — confirms Phase 7 shipped the column (line 31)

### Secondary (MEDIUM confidence)
- `docs/compliance/swedish-fk-and-labor-rules.md:283` — "god man/förvaltare" legal terminology (Swedish labor law reference)
- `.planning/ROADMAP.md` §Phase 9 — slip header format spec that shapes helper return contract

### Tertiary (LOW confidence)
- [ASSUMED] 10-digit pno with `+` century separator is out of scope (no evidence in codebase of anyone over 100 using anhörig assistans; filing will reject invalid pno anyway)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries pinned in package.json, no new deps
- Architecture: HIGH — pattern established by 4 existing lib/*.test.ts files
- Pitfalls: HIGH — direct reading of target source files, explicit line numbers
- Swedish labels: MEDIUM — based on internal compliance doc; planner/guardian can confirm during Phase 9
- Line-number alignment of D-08 labels: MEDIUM — discrepancy noted in Open Questions; safe-interpretation refactor is correct regardless

**Research date:** 2026-04-18
**Valid until:** 2026-05-18 (30 days — stable stack, no fast-moving deps)
