---
phase: 09
plan: 02
type: execute
wave: 2
depends_on: ["09-01"]
files_modified:
  - server/package.json
  - server/package-lock.json
  - server/src/lib/payrollSlipUtils.ts
  - server/src/lib/payrollSlipUtils.test.ts
  - server/src/lib/pdfSlipRenderer.ts
autonomous: true
requirements: [SLIP-03, SLIP-04, SLIP-07]
must_haves:
  truths:
    - "buildAnhorigSlip() returns a SlipFields object whose numeric fields (grossPay, bruttoLön, prelimSkatt, nettoTillBank) equal the snapshotted values on payroll_records (no recomputation from billableHours × hourlyRateUsed)"
    - "buildAnhorigSlip() calls resolveEmployerRepresentation(profile, reportPeriodEnd) where reportPeriodEnd is the LAST day of the report month (not today, not first day)"
    - "SlipFields.representative is null when the patient is an adult without override, and populated when patient is a minor OR override flag is true"
    - "SlipFields.hours.vabYtdUsed equals 120 - vabBalance(absences, assistantId, year) for the report year"
    - "SlipFields.bankLine is null when all three bank fields (bankClearing, bankAccount, iban) are empty; non-null with the formatted string otherwise"
    - "renderAnhorigSlipPdf(fields) returns a non-empty Buffer; buffer starts with `%PDF-` magic bytes"
    - "pdfkit renders å/ä/ö characters without substitution (smoke-test output compares byte-length of Swedish vs ASCII-only text to detect missing glyphs)"
    - "Swedish number formatting produces '54 631,50 kr' for 54631.5 (space thousands separator, comma decimal)"
    - "buildAnhorigSlip() never references arbetsgivaravgifter or totalEmployerCost on the output (SLIP-03 regression guard)"
  artifacts:
    - path: "server/src/lib/payrollSlipUtils.ts"
      provides: "Pure buildAnhorigSlip(input) → SlipFields; no DB, no pdfkit, no side effects"
      exports: ["buildAnhorigSlip", "SlipFields", "formatKr"]
      min_lines: 120
    - path: "server/src/lib/payrollSlipUtils.test.ts"
      provides: "Vitest suite for SLIP-03 + SLIP-04 cases"
      contains: "describe.*buildAnhorigSlip"
      min_lines: 180
    - path: "server/src/lib/pdfSlipRenderer.ts"
      provides: "renderAnhorigSlipPdf(fields) → Promise<Buffer> using pdfkit"
      exports: ["renderAnhorigSlipPdf"]
      min_lines: 120
    - path: "server/package.json"
      provides: "pdfkit and @types/pdfkit dependencies"
      contains: "pdfkit"
  key_links:
    - from: "server/src/lib/payrollSlipUtils.ts"
      to: "server/src/lib/employer-representation.ts"
      via: "resolveEmployerRepresentation import"
      pattern: "from.*employer-representation"
    - from: "server/src/lib/payrollSlipUtils.ts"
      to: "server/src/lib/absence-utils.ts"
      via: "vabBalance import"
      pattern: "from.*absence-utils"
    - from: "server/src/lib/pdfSlipRenderer.ts"
      to: "pdfkit"
      via: "PDFDocument import"
      pattern: "import PDFDocument from .pdfkit."
---

<objective>
Ship the pure field-map builder + pdfkit renderer that Plan 03's endpoints call. Split into two modules so the builder is a plain object-to-object pure function testable without rendering.

Purpose: The slip is a composition of (a) frozen payroll_records snapshot values, (b) absences aggregated into per-type day counts + VAB year-to-date, (c) employer representation from Phase 8 helper. Decoupling field assembly from PDF drawing keeps the test surface sharp and lets the renderer be swapped later without re-testing the business logic.

Output: `buildAnhorigSlip(input) → SlipFields` with full test coverage for SLIP-03 (numeric + absence correctness) and SLIP-04 (minor/adult/override header branching), plus `renderAnhorigSlipPdf(fields) → Buffer` and pdfkit as a new server dependency. SLIP-07 covered by the builder's read-only consumption of `payroll_records.salaryModelUsed` + `hourlyRateUsed` (already shipped by Phase 7).
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-salary-slip/09-CONTEXT.md
@.planning/phases/09-salary-slip/09-RESEARCH.md
@.planning/phases/09-salary-slip/09-UI-SPEC.md
@server/src/lib/employer-representation.ts
@server/src/lib/employer-representation.test.ts
@server/src/lib/absence-utils.ts

<interfaces>
<!-- Types the builder consumes. Extracted from the Phase 7 schema + existing lib files. -->

From server/src/db/schema.ts (after Plan 01 pushes):
```typescript
// assistants row shape (drizzle-inferred):
type Assistant = {
  id: string;
  name: string;
  pno: string | null;
  address: string | null;
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
  bankClearing: string | null;
  bankAccount: string | null;
  iban: string | null;
  salaryModel: "anhörig" | "fremia" | "custom" | null;   // new in Plan 01
  hourlyRateOverride: number | null;                       // new in Plan 01
  paymentMethod: "bankgiro" | "swish" | "kontant" | null;  // new in Plan 01
  // ... other Phase 7 fields
};

// profile row shape (drizzle-inferred):
type Profile = {
  guardianName: string | null;
  guardianPno: string | null;
  patientName: string | null;
  patientPno: string | null;
  address: string | null;
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
  patientRequiresRepresentative: boolean | null;
  defaultPayDay: number | null;                            // new in Plan 01
  // ... other fields
};

// payrollRecords row shape (Phase 7 snapshots already shipped — SLIP-07 read-only):
type PayrollRecord = {
  id: string;
  assistantId: string;
  month: string;                         // "YYYY-MM"
  billableHours: number;
  grossPay: number;                      // already frozen per PAY-02
  employerContributions: number;         // NOT displayed on slip per D-01
  totalEmployerCost: number;             // NOT displayed on slip per D-01
  salaryModelUsed: "anhörig" | "fremia" | "custom" | null;
  hourlyRateUsed: number | null;
  prelimTaxRateSnapshot: number | null;  // e.g. 0.30 for flat 30%
  status: "draft" | "approved";
  absenceBreakdownJson: string | null;   // JSON {"sjukfrånvaro": h, "vab": h, "semester": h, "other": h} (hours, not days)
};
```

From server/src/lib/employer-representation.ts (already shipped):
```typescript
export type EmployerRepresentation = {
  arbetsgivare: { name: string; pno: string; address: string };
  företrädare: { name: string; pno: string } | null;
  isMinor: boolean;
};
export function resolveEmployerRepresentation(
  profile: {
    patientName: string | null; patientPno: string | null;
    guardianName: string | null; guardianPno: string | null;
    patientRequiresRepresentative: boolean | null;
    address: string | null;
    addressStreet: string | null; addressZip: string | null; addressCity: string | null;
  },
  asOfDate: Date,
): EmployerRepresentation;
```

From server/src/lib/absence-utils.ts (already shipped):
```typescript
export type AbsenceRow = {
  assistantId: string | null;
  startDate: string;
  endDate: string;
  absenceType: "sjukfrånvaro" | "vab" | "semester" | "other";
};
export function vabBalance(absences: AbsenceRow[], assistantId: string, year: number): number;
// Returns REMAINING days (120 - used). vabYtdUsed on slip = 120 - return value.
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Install pdfkit + @types/pdfkit and render a smoke-test PDF</name>
  <files>
    server/package.json
    server/package-lock.json
  </files>
  <read_first>
    - server/package.json (confirm existing deps layout and version pinning convention)
    - .planning/phases/09-salary-slip/09-RESEARCH.md (§Standard Stack — pdfkit 0.18.0, @types/pdfkit 0.17.6; §Pitfall 3 — Swedish character smoke test)
  </read_first>
  <action>
From `server/`, run:
```bash
npm install pdfkit@^0.18.0
npm install -D @types/pdfkit@^0.17.6
```

Then create a temporary smoke test `server/tmp-pdfkit-smoke.ts` (this file is NOT committed — delete after verify passes):
```typescript
import PDFDocument from "pdfkit";
import { writeFileSync } from "fs";
const doc = new PDFDocument({ size: "A4" });
const chunks: Buffer[] = [];
doc.on("data", c => chunks.push(c));
doc.on("end", () => {
  const buf = Buffer.concat(chunks);
  writeFileSync("tmp-pdfkit-smoke.pdf", buf);
  console.log("smoke-size:", buf.length);
  console.log("magic:", buf.slice(0, 5).toString());
  // pdfkit WinAnsi handling test — if glyphs are missing the byte-length between
  // the Swedish line and the ASCII-only line will be suspicious (equal despite
  // å/ä/ö being single-byte in WinAnsi). Fail loudly.
});
doc.font("Helvetica").fontSize(10).text("ASCII only baseline");
doc.text("Svensk text: ÅÄÖåäö — sjukfrånvaro, företrädd av");
doc.end();
```

Run it:
```bash
cd server && npx tsx tmp-pdfkit-smoke.ts
```

Expected output: `smoke-size: N` (N > 1000), `magic: %PDF-`. Open `server/tmp-pdfkit-smoke.pdf` in a PDF viewer and visually confirm the Swedish line shows `Svensk text: ÅÄÖåäö — sjukfrånvaro, företrädd av` correctly (no `?` glyphs, no missing characters).

If any Swedish character renders as `?` or a missing-glyph square, IMMEDIATELY flag a blocker and add a TTF-registration step to Task 3. Per RESEARCH Pitfall 3, pdfkit's built-in Helvetica with WinAnsi encoding should cover the full Swedish Latin-1 set, but this is assumption A1 and must be verified.

After successful verify, delete `server/tmp-pdfkit-smoke.ts` and `server/tmp-pdfkit-smoke.pdf` so they do not ship.
  </action>
  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/server && grep -q '"pdfkit"' package.json && grep -q '"@types/pdfkit"' package.json && echo "pdfkit-installed" || echo "missing"</automated>
  </verify>
  <acceptance_criteria>
    - `grep "\"pdfkit\":" server/package.json` returns a line with version `^0.18.0` or higher (not `^0.17` — 0.18 is the researched baseline)
    - `grep "\"@types/pdfkit\":" server/package.json` returns a line with version `^0.17.6` or higher
    - `ls server/node_modules/pdfkit/package.json` exists
    - Smoke test produced a PDF starting with `%PDF-` and the Swedish characters rendered without substitution (human-verified during this task)
    - `server/tmp-pdfkit-smoke.ts` and `server/tmp-pdfkit-smoke.pdf` are NOT present in the repo after the task completes (they are scratch artifacts, not committed)
  </acceptance_criteria>
  <done>pdfkit + @types/pdfkit installed at researched versions; Swedish character rendering smoke-tested and confirmed visually; no scratch files left behind.</done>
</task>

<task type="auto" tdd="true">
  <name>Task 2: Pure slip builder — server/src/lib/payrollSlipUtils.ts (+ colocated Vitest suite)</name>
  <files>
    server/src/lib/payrollSlipUtils.ts
    server/src/lib/payrollSlipUtils.test.ts
  </files>
  <read_first>
    - server/src/lib/employer-representation.ts (exact helper signature + JSDoc about asOfDate pitfall)
    - server/src/lib/employer-representation.test.ts (test shape — baseProfile fixture + named `it()` blocks per decision; payrollSlipUtils.test.ts mirrors this exactly)
    - server/src/lib/absence-utils.ts (vabBalance signature + AbsenceRow type)
    - server/src/db/schema.ts (post-Plan-01 — confirm new column names match the Assistant/Profile types the builder consumes)
    - .planning/phases/09-salary-slip/09-CONTEXT.md (§D-01 layout, §D-02 header fields, §D-03 pdfkit, §D-04 doc number)
    - .planning/phases/09-salary-slip/09-UI-SPEC.md (§PDF Layout Contract — Swedish number/date formatting + conditional bank/företrädd-av)
    - .planning/phases/09-salary-slip/09-RESEARCH.md (§Code Examples Ex.1 — `SlipFields` type exemplar; §Pitfall 1 — report-period-end asOfDate; §Pitfall 2 — rate-fallback policy)
  </read_first>
  <behavior>
    - Test 1 (SLIP-03 golden): Anhörig slip for 215h, gross 54631.5, prelimRate 0.30 → bruttoLön 54631.5, prelimSkatt -16389.45, nettoTillBank 38242.05. All decimal results use exact 2-place arithmetic (rounded via `Math.round(x*100)/100`).
    - Test 2 (SLIP-03 zero absences): absences=[] → hours.sjuk=0, hours.vab=0, hours.semester=0, hours.other=0, hours.vabYtdUsed=0.
    - Test 3 (SLIP-03 VAB YTD): 3 VAB days in January + 5 VAB days in March of same year → hours.vabYtdUsed=8, and vabBalance inverse would give 112. Builder consumes vabBalance from absence-utils and derives YTD as `120 - remaining`.
    - Test 4 (SLIP-03 absence counting): Test absenceDaysInMonth helper — 2 sjuk days within report month + 3 sjuk days outside → hours.sjuk=2. Also 1 semester day within + 1 "other" day → hours.semester=1, hours.other=1.
    - Test 5 (SLIP-03 bank line omitted): assistant with all three bank fields empty → bankLine === null.
    - Test 6 (SLIP-03 bank line — bankgiro only): bankClearing="1234", bankAccount="567890" → bankLine === "Bankgiro 1234-567890".
    - Test 7 (SLIP-03 bank line — IBAN only): iban="SE4550000000058398257466" → bankLine === "IBAN SE4550000000058398257466".
    - Test 8 (SLIP-03 bank line — all set): all three → bankLine === "1234-567890 (IBAN SE45…)".
    - Test 9 (SLIP-03 regression guard): SlipFields keys — JSON.stringify(result) MUST NOT contain the substrings "employerContributions", "totalEmployerCost", "arbetsgivaravgifter" (SLIP-03 excludes employer-side numbers).
    - Test 10 (SLIP-03 skattetabell regression): JSON.stringify(result) MUST NOT contain "skattetabell" key — deferred to v1.4.
    - Test 11 (SLIP-04 minor patient): patientPno born 2015 (minor as of 2026-03-31) → representative !== null, representative.name === guardianName.
    - Test 12 (SLIP-04 adult without override): patientPno born 1990, patientRequiresRepresentative=false → representative === null.
    - Test 13 (SLIP-04 adult with override): patientPno born 1990, patientRequiresRepresentative=true → representative !== null.
    - Test 14 (SLIP-04 report-period-end): Patient with 18th birthday on 2026-04-15. Generating March 2026 slip → reportPeriodEnd=2026-03-31 (patient still minor) → representative !== null. Generating April 2026 slip → reportPeriodEnd=2026-04-30 (patient now adult) → representative === null (assuming override=false). Verifies Pitfall 1.
    - Test 15 (Swedish number formatting): formatKr(54631.5) === "54 631,50 kr" (regular space, comma decimal). formatKr(0) === "0,00 kr". Negative: formatKr(-16389.45) uses U+2212 minus → "−16 389,45 kr".
    - Test 16 (rate fallback — Pitfall 2): payrollRecord.hourlyRateUsed=0 (pre-Phase-7 legacy) + assistant.hourlyRateOverride=254.10 → builder uses 254.10 for the Grundlön line calculation. (Per D-12 the endpoint guards against NULL override; the builder trusts the override when the snapshot is 0.)
  </behavior>
  <action>
Create `server/src/lib/payrollSlipUtils.ts` as a pure module (no DB, no pdfkit, no fs, no Date.now-defaulted params):

1. **Define `SlipFields` type** matching the shape in 09-RESEARCH.md Code Examples Ex.1:
```typescript
export type SlipFields = {
  documentNumber: string;           // "LS-2026-03-001" — caller provides (D-05)
  reportPeriodLabel: string;        // "1 mars – 31 mars 2026"
  payDateLabel: string;             // "25 april 2026"
  payMethodLabel: string;           // "Bankgiro" | "Swish" | "Kontant"
  avtalsmodellLabel: string;        // HARDCODED for v1.0.1: "Anhörigassistans (fast timlön, ej sjuk/sem)" (D-02)
  employer: { name: string; pno: string; address: string };
  representative: { name: string; pno: string } | null;   // D-02 conditional
  employee: { name: string; pno: string };
  bankLine: string | null;          // null = omit entire row (D-02)
  hours: {
    worked: number;
    sjuk: number;      // DAYS (mock: "0 dagar")
    vab: number;       // DAYS
    semester: number;  // DAYS
    other: number;     // DAYS
    vabYtdUsed: number;  // DAYS, 0–120
  };
  lön: {
    gross: number;       // Grundlön — hours.worked × effectiveRate
    sjukLön: number;     // always 0 in anhörig model (D-02)
    vabLön: number;      // always 0
    semesterLön: number; // always 0
    bruttoLön: number;   // = payrollRecord.grossPay (authoritative SLIP-07 snapshot)
  };
  avdrag: {
    prelimSkatt: number;      // = -bruttoLön × prelimTaxRateSnapshot (signed negative)
    prelimSkattRate: number;  // = prelimTaxRateSnapshot (e.g. 0.30)
    nettoTillBank: number;    // = bruttoLön + prelimSkatt
  };
};
```

2. **Define builder signature** accepting explicit `documentNumber`, `payDate`, `payMethod` so the pure function does NOT allocate sequence numbers (Plan 03 handles allocation):
```typescript
export function buildAnhorigSlip(input: {
  profile: ProfileLike;          // subset of profile row columns actually used
  assistant: AssistantLike;      // subset of assistants row columns actually used
  payrollRecord: PayrollRecordLike;
  absences: AbsenceRow[];
  documentNumber: string;        // "LS-YYYY-MM-NNN" — caller allocates
  payDate: string;               // "YYYY-MM-DD" — caller pre-computed + frozen (D-09)
  payMethod: "bankgiro" | "swish" | "kontant";  // frozen (D-10)
}): SlipFields;
```

Define `ProfileLike`, `AssistantLike`, `PayrollRecordLike` inline as narrow interface subsets — do NOT depend on the full drizzle-inferred row type so tests can pass literal fixtures without all optional fields.

3. **Implementation rules:**
- `reportPeriodEnd`: `new Date(year, month, 0)` — zero day of (month+1) = last day of (month). Pass this to `resolveEmployerRepresentation`.
- `reportPeriodLabel`: use `Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long" })` for start/end pieces + explicit year concat to produce `"1 mars – 31 mars 2026"` with en-dash `\u2013` between dates.
- `payDateLabel`: parse `input.payDate` (YYYY-MM-DD) → `Intl.DateTimeFormat("sv-SE", { day: "numeric", month: "long", year: "numeric" })`.
- `payMethodLabel`: `{ bankgiro: "Bankgiro", swish: "Swish", kontant: "Kontant" }[input.payMethod]`.
- `avtalsmodellLabel`: hardcoded string `"Anhörigassistans (fast timlön, ej sjuk/sem)"`.
- `bankLine`: helper function applying the 4 conditions from 09-UI-SPEC.md §PDF Layout Contract §Bank line conditional rendering. Returns `null` when all three fields are empty/null.
- `hours.worked`: `payrollRecord.billableHours`.
- `hours.{sjuk,vab,semester,other}`: count DAYS within the report month for that assistant (including null-assistantId absences per Phase 2 convention). Implement as local helper `absenceDaysInMonthByType(absences, assistantId, year, month, type)` using date-range clipping (mirror the `clippedDays` pattern in `absence-utils.ts:20-30` but clip to month bounds, not year bounds).
- `hours.vabYtdUsed`: `120 - vabBalance(absences, assistantId, year)`.
- Effective rate for `lön.gross`: prefer `assistant.hourlyRateOverride` when non-null (D-12 invariant + Pitfall 2 fallback). Fall back to `payrollRecord.hourlyRateUsed` only when override is null (should not happen at the builder level — endpoint guards, but defensive).
- `lön.gross` = `Math.round(hours.worked × effectiveRate × 100) / 100`.
- `lön.bruttoLön` = `payrollRecord.grossPay` (authoritative SLIP-07 snapshot). Do NOT recompute.
- `avdrag.prelimSkatt` = `-Math.round(bruttoLön × prelimTaxRateSnapshot × 100) / 100` (signed negative).
- `avdrag.nettoTillBank` = `Math.round((bruttoLön + avdrag.prelimSkatt) × 100) / 100`.

4. **Export a `formatKr(n)` helper** for the renderer to consume:
```typescript
const krFmt = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: true });
export function formatKr(n: number): string {
  const abs = krFmt.format(Math.abs(n)).replace(/\u00A0/g, " ");
  return n < 0 ? `\u2212${abs} kr` : `${abs} kr`;
}
```

5. **Write `server/src/lib/payrollSlipUtils.test.ts`** with the 16 test cases enumerated in `<behavior>`. Mirror the structure of `employer-representation.test.ts`: module-level `baseProfile`, `baseAssistant`, `basePayrollRecord` fixtures + nested `describe` blocks per SLIP-XX requirement, + individual `it()` blocks per behavior. Each assertion uses exact numeric equality (`toBe`, `toEqual`) — avoid `toBeCloseTo` since the builder performs explicit 2-decimal rounding.

**Do NOT:**
- Import pdfkit (this module is pure).
- Import `db` from `../db` (pure function, caller passes data).
- Use `new Date()` without an explicit parameter.
- Compute employer contributions or total employer cost (SLIP-03 regression guard).
- Display skattetabell anywhere (deferred v1.4).
  </action>
  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/server && npm test -- --run payrollSlipUtils 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `server/src/lib/payrollSlipUtils.ts` exists and exports `buildAnhorigSlip`, `SlipFields`, `formatKr`
    - `grep -n "import PDFDocument" server/src/lib/payrollSlipUtils.ts` returns 0 matches (pure module, no pdfkit)
    - `grep -nE "import.*from.*\\.\\./db" server/src/lib/payrollSlipUtils.ts` returns 0 matches (no DB imports)
    - `grep -n "resolveEmployerRepresentation" server/src/lib/payrollSlipUtils.ts` returns at least 1 import + 1 call site
    - `grep -n "vabBalance" server/src/lib/payrollSlipUtils.ts` returns at least 1 import + 1 call site
    - `grep -nE "employerContributions|totalEmployerCost|arbetsgivaravgifter|skattetabell" server/src/lib/payrollSlipUtils.ts` returns 0 matches (SLIP-03 regression guard)
    - `grep -c "^\\s*it\\(" server/src/lib/payrollSlipUtils.test.ts` returns >= 16 (one per behavior)
    - `npm test -- --run payrollSlipUtils` reports all tests passing with 0 failures
    - `npx tsc --noEmit -p server/tsconfig.json` exits 0
  </acceptance_criteria>
  <done>Pure builder module ships with all 16 behavior tests green; no DB or pdfkit imports in the pure file; SLIP-03 + SLIP-04 requirement coverage complete.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 3: pdfkit renderer — server/src/lib/pdfSlipRenderer.ts</name>
  <files>server/src/lib/pdfSlipRenderer.ts</files>
  <read_first>
    - server/src/lib/payrollSlipUtils.ts (just written — confirm SlipFields shape you consume)
    - .planning/phases/09-salary-slip/09-UI-SPEC.md (§PDF Layout Contract — Page section, Vertical rhythm, Spacing, Numeric formatting, Bank line conditional, Företrädd-av conditional, Header field exact labels)
    - .planning/phases/09-salary-slip/09-CONTEXT.md (§D-01 plain text no branding)
    - .planning/phases/09-salary-slip/09-RESEARCH.md (§Code Examples Ex.2 — pdfkit skeleton; §Pitfall 3 — font handling)
  </read_first>
  <action>
Create `server/src/lib/pdfSlipRenderer.ts` exposing one function:

```typescript
import PDFDocument from "pdfkit";
import type { SlipFields } from "./payrollSlipUtils";
import { formatKr } from "./payrollSlipUtils";

export async function renderAnhorigSlipPdf(fields: SlipFields): Promise<Buffer>;
```

**Layout spec (strict — 09-UI-SPEC §PDF Layout Contract is authoritative; excerpt below for convenience):**

- Page: A4 (595.28 × 841.89 pt), margins 56 pt (≈20 mm) all sides. Content width = 170 mm = 481 pt.
- Title row (y=56):
  - Left: `LÖNESPECIFIKATION` Helvetica-Bold 14 pt
  - Right-aligned at x=539 (= pageWidth 595.28 − right margin 56): `Nr: {fields.documentNumber}` Helvetica 10 pt
- Gap 8 mm (≈23 pt).
- Header block: label column 45 mm wide (=128 pt), value column 125 mm (=353 pt). Helvetica-Bold 10 pt labels, Helvetica 10 pt values, leading 13 pt. Order:
  1. `Arbetsgivare:` → `{employer.name}, {employer.pno}` (first line) + 2nd line `{employer.address}` if non-empty
  2. `Företrädd av:` → `{representative.name}, {representative.pno}` — ONLY when `fields.representative !== null`, else omit line entirely
  3. `Anställd:` → `{employee.name}, {employee.pno}`
  4. `Period:` → `{fields.reportPeriodLabel}`
  5. `Utbetalningsdag:` → `{fields.payDateLabel}`
  6. `Utbetalningssätt:` → `{fields.payMethodLabel}`
  7. `Avtalsmodell:` → `{fields.avtalsmodellLabel}`
  8. `Bank:` → `{fields.bankLine}` — ONLY when `fields.bankLine !== null`, else omit line entirely
- Gap 10 mm (≈28 pt).
- `ARBETSTID` divider — Helvetica-Bold 11 pt, ALL-CAPS, left-aligned.
- Gap 4 mm then 5 rows (each row: 13 pt leading, 2 mm gap between rows):
  - `Arbetade timmar` label @ x=56, value `{hours.worked.toFixed(1).replace(".",",")} tim` right-aligned at x=381 (135 mm from left margin — UI-SPEC §Numeric formatting)
  - `Sjukfrånvaro` label, value `{hours.sjuk} dagar`
  - `VAB` label, value `{hours.vab} dagar (år till dato: {hours.vabYtdUsed}/120)`
  - `Semester` label, value `{hours.semester} dagar (tagna i år: {hours.semester})` (UI-SPEC has this bracket note; include verbatim)
  - `Annan frånvaro` label, value `{hours.other} dagar`
- Gap 8 mm then `LÖN` divider.
- 4 rows (labels left, `formatKr(x)` right-aligned at x=539 / kr column 195 mm):
  - `Grundlön {hours.worked.toFixed(1).replace(".",",")} × {formatRate(effectiveRate)}` → `formatKr(lön.gross)`
  - `Sjuklön` → `formatKr(0)` + " *"
  - `VAB-lön` → `formatKr(0)` + " *"
  - `Semesterlön` → `formatKr(0)` + " *"
- Thin 0.3 pt horizontal rule.
- `BRUTTOLÖN` Helvetica-Bold 10 pt → `formatKr(lön.bruttoLön)` Helvetica-Bold 10 pt, leading 14 pt.
- Gap 8 mm then `AVDRAG` divider.
- 1 row: `Preliminärskatt {Math.round(avdrag.prelimSkattRate*100)}% (schablon)` → `formatKr(avdrag.prelimSkatt)` (already signed negative; formatKr inserts U+2212 minus).
- Thin 0.3 pt rule.
- `NETTO TILL BANK` Helvetica-Bold 10 pt → `formatKr(avdrag.nettoTillBank)` Helvetica-Bold 10 pt.
- Gap 10 mm then footer note: Helvetica-Oblique 9 pt gray (#4C4C4C) text:
  `* Ingen ersättning vid sjukdom, VAB eller semester enligt överenskommelse (anhörigmodell).`

**Effective rate display**: since `fields` does NOT carry the rate directly (builder subsumed it into lön.gross), include a private helper `formatRate(gross, hours)` that computes and formats `{gross / hours}` as `{int},{decimal} kr/tim` — OR: modify the SlipFields type in Task 2 to additionally expose `hourlyRate: number` (RECOMMENDED — cleaner). If you modify Task 2, update the test file to include `hourlyRate` in assertions.

**Font handling**: Use pdfkit built-in fonts `Helvetica`, `Helvetica-Bold`, `Helvetica-Oblique`. If Task 1 smoke test revealed missing glyphs, add `doc.registerFont("Body", path.join(__dirname, "..", "..", "fonts", "DejaVuSans.ttf"))` and use `"Body"` throughout — but default to built-ins since smoke test confirmed coverage.

**Promise wrapping** (collect chunks in-memory, resolve with Buffer):
```typescript
return new Promise<Buffer>((resolve, reject) => {
  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 56, bottom: 56, left: 56, right: 56 },
    info: { Title: `Lönespecifikation ${fields.documentNumber}`, Author: "Kalinga Assistansportal" },
  });
  const chunks: Buffer[] = [];
  doc.on("data", c => chunks.push(c));
  doc.on("end", () => resolve(Buffer.concat(chunks)));
  doc.on("error", reject);

  // ... drawing code per layout spec ...

  doc.end();
});
```

**No persistence**: do NOT write to filesystem. Do NOT log `fields` or any substring of the output (PII — pno, bank, netto salary). Error handling: only `console.error("[pdf] slip render error:", e)` is permitted (matches existing pattern `pdf.ts:323`).

**Add a minimal test at the end of `payrollSlipUtils.test.ts`** (or a new `pdfSlipRenderer.test.ts` colocated — Claude's discretion): one smoke test that calls `renderAnhorigSlipPdf(goldenFields)` and asserts `result.length > 1000` + `result.slice(0,5).toString() === "%PDF-"`. No byte-comparison — D-14 skips golden PDF fixtures.
  </action>
  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/server && npm test -- --run "payrollSlipUtils|pdfSlipRenderer" 2>&1 | tail -30</automated>
  </verify>
  <acceptance_criteria>
    - `server/src/lib/pdfSlipRenderer.ts` exists and exports `renderAnhorigSlipPdf`
    - `grep -n "import PDFDocument from \"pdfkit\"" server/src/lib/pdfSlipRenderer.ts` returns 1 match
    - `grep -cE "doc\\.font\\(\"Helvetica" server/src/lib/pdfSlipRenderer.ts` returns >= 3 (Helvetica, Helvetica-Bold, Helvetica-Oblique all used)
    - `grep -n "LÖNESPECIFIKATION" server/src/lib/pdfSlipRenderer.ts` returns exactly 1 match (the title)
    - `grep -n "ARBETSTID" server/src/lib/pdfSlipRenderer.ts` returns exactly 1 match
    - `grep -n "LÖN" server/src/lib/pdfSlipRenderer.ts` returns at least 1 match (section divider — may appear in "BRUTTOLÖN" etc, that's fine)
    - `grep -n "AVDRAG" server/src/lib/pdfSlipRenderer.ts` returns exactly 1 match
    - `grep -n "NETTO TILL BANK" server/src/lib/pdfSlipRenderer.ts` returns exactly 1 match
    - `grep -n "anhörigmodell" server/src/lib/pdfSlipRenderer.ts` returns exactly 1 match (footer note verbatim)
    - `grep -n "writeFileSync\\|writeFile\\|createWriteStream" server/src/lib/pdfSlipRenderer.ts` returns 0 matches (no persistence)
    - `grep -nE "console\\.(log|info|debug)" server/src/lib/pdfSlipRenderer.ts` returns 0 matches (no PII-leaking logs; error-only logging is permitted)
    - Smoke test (first 5 bytes === `%PDF-`, length > 1000) passes as part of the Vitest suite
    - `npm test` full server suite reports 0 failures
  </acceptance_criteria>
  <done>Renderer ships with layout matching UI-SPEC §PDF Layout Contract and CONTEXT §D-01/D-02; smoke test passes; no persistence, no PII logging.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| No untrusted input at lib layer | Both modules are pure / near-pure; caller (Plan 03 endpoints) validates inputs before invoking |
| pdfkit → Buffer → Express response | No untrusted interpolation; fields originate from DB (trusted) |
| Filesystem writes | NONE — renderer streams to in-memory Buffer only |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-10 | I (Info Disclosure) | payrollSlipUtils.ts / pdfSlipRenderer.ts — logging fields | mitigate | Task 3 acceptance criteria bans console.log/info/debug; only `console.error("[pdf] slip render error:", e)` permitted |
| T-09-11 | I | Rendered PDF stored to disk | mitigate | Renderer resolves Buffer only; no fs imports allowed (acceptance criterion checks) |
| T-09-12 | T (Tampering) | Incorrect minor detection via today's date | mitigate | Builder signature requires explicit `documentNumber`, `payDate`; asOfDate for employer-representation is derived from payrollRecord.month, not `new Date()` — Test 14 verifies Pitfall 1 |
| T-09-13 | T | Using payrollRecord.hourlyRateUsed=0 (legacy) → emit 0 kr slip | mitigate | Builder prefers `assistant.hourlyRateOverride` when non-null (Test 16 confirms). Endpoint-layer gate (Plan 03) additionally refuses NULL override. |
| T-09-14 | T | Swedish character rendering failure | mitigate | Task 1 smoke test verifies WinAnsi coverage; Task 3 acceptance criteria inspects output PDF magic bytes |
| T-09-15 | D (Denial of Service) | pdfkit memory growth on repeated render | accept | Single A4 page ~500KB in-memory, ~30-80ms render. Rate limiting is infra concern. |
</threat_model>

<verification>
**Post-plan verification checks:**

1. **Builder tests green:** `cd server && npm test -- --run payrollSlipUtils` — all 16+ tests pass.
2. **Full server suite green:** `cd server && npm test` — 0 failures (confirms no regression in Phase 7/8 tests).
3. **Type check clean:** `cd server && npx tsc --noEmit -p tsconfig.json` exits 0.
4. **No DB or fs imports in builder:** `grep -nE "from .(\\.\\./db|fs|path)." server/src/lib/payrollSlipUtils.ts` returns 0 matches.
5. **No console.log in renderer:** `grep -nE "console\\.(log|info|debug)" server/src/lib/pdfSlipRenderer.ts` returns 0 matches.
6. **pdfkit installed:** `cat server/package.json | grep pdfkit` shows two entries (runtime + types).
</verification>

<success_criteria>
- `buildAnhorigSlip()` consumable by Plan 03 endpoints without further refactor.
- SLIP-03 fully covered (numeric correctness + absence breakdown + VAB YTD + bank conditional + regression guards).
- SLIP-04 fully covered (minor/adult/override + report-period-end pitfall guarded by Test 14).
- SLIP-07 coverage confirmed: builder reads `payrollRecord.salaryModelUsed` + `hourlyRateUsed` (snapshot-only; no recomputation of the bruttoLön value).
- `renderAnhorigSlipPdf()` produces a single-page A4 PDF with Swedish characters intact and all sections from the ROADMAP mock present.
</success_criteria>

<output>
After completion, create `.planning/phases/09-salary-slip/09-02-SUMMARY.md` documenting:
- `SlipFields` type definition (final shape, including any `hourlyRate` field you added during Task 3)
- Test count + which SLIP-XX requirement each describe block covers
- pdfkit version pinned in package.json
- Any deviations from the plan (e.g. if smoke test required TTF registration)
</output>
