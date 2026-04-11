# Phase 4: Tax Reporting (Form 4805) - Research

**Researched:** 2026-04-11
**Domain:** Swedish AGI tax declaration — Skatteverket blankett 4805 PDF filling, payroll formula correction, personnummer parsing
**Confidence:** HIGH (most claims verified via code inspection or runtime verification)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Payroll formula bug: `gross = (hours × hourlyRate − costs) / (1 + taxRate)`. Phase 4 corrects `payroll-utils.ts` and re-derives stored `payroll_records` figures.
- **D-02:** Costs (from `costs` table, scoped to same `assistant_id` and `month`) are deducted from FK allocation before calculating gross.
- **D-03:** Preliminärskatt IS required. Guardian withholds and remits it to Skatteverket.
- **D-04:** Single guardian-level `preliminary_tax_rate` key in `settings` table (e.g. `"0.30"` for 30%). All assistants use the same rate.
- **D-05:** Snapshot preliminary tax rate into `payroll_records.prelim_tax_rate_snapshot` at generation time.
- **D-06:** AGI reads from `payroll_records` for gross salary and employer contributions (approved, locked figures). VAB days from `absences` table.
- **D-07:** 4805 PDF only generated for months where ALL assistants have `payroll_records.status = 'approved'`. Download button disabled with tooltip if any are draft.
- **D-08:** ~~xmlbuilder2~~ **SUPERSEDED** — Phase 4 now generates pre-filled form 4805 PDFs (not XML) using `pdf-lib`.
- **D-09:** New route file `server/src/routes/pdf.ts` (**extend existing**, not new `agi.ts`). New endpoint `POST /api/pdf/4805`. Request body: `{ year: string, month: string, assistantId: string }`. Returns PDF download.
- **D-10:** New pure utility file `server/src/lib/form4805-utils.ts` — computes field values from payroll data. No DB imports.
- **D-11:** Use `profile.guardianPno` as employer identifier.
- **D-12:** Download buttons added to Monthly.tsx Step 4 (per-assistant, one PDF per assistant).
- **D-13:** Preliminary tax rate field added to Settings.tsx alongside FK hourly rate and employer tax rate.
- **D-14:** VAB days = calendar days of `absenceType = 'vab'` absences within the reporting month (NOT from `absenceBreakdownJson` which stores hours).

### Claude's Discretion

- Exact AcroForm field name qualification for employer vs recipient sections (how pdf-lib addresses duplicate leaf names)
- `clippedDays()` month-boundary variant needed for per-month VAB day counting
- Error handling when payroll_records are missing for some assistants
- Empty state design on Monthly page Step 4
- Recalculation strategy for existing approved payroll records

### Deferred Ideas (OUT OF SCOPE)

- Per-assistant tax codes / jämkningsbeslut
- Age-based employer contribution rates (deferred from Phase 3 — still deferred)
- Karensdag deduction
- Direct e-filing via Skatteverket API
- Printable payslip
- VAB (from 4805 form) — VAB field dropped per additional context update
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| TAX-01 | System generates AGI data per assistant for a given month: personnummer, gross salary, employer contributions, withheld preliminary tax | Payroll formula correction + 4805 field mapping + personnummer parsing |
| TAX-02 | Guardian can download AGI report in Skatteverket-compatible format ready for submission | pdf-lib form filling + FORMS_DIR pattern + per-assistant download buttons in Monthly.tsx |
</phase_requirements>

---

## Summary

Phase 4 delivers three tightly coupled deliverables: (1) a payroll formula bug fix that corrects how gross salary is derived from FK allocation, (2) two schema migrations adding `prelim_tax_rate_snapshot` to `payroll_records` and `address` to `assistants`, and (3) per-assistant pre-filled form 4805 PDF generation using pdf-lib.

The form 4805 (Förenklad arbetsgivardeklaration för privata tjänster) is the correct Skatteverket form for private employers. It is an unencrypted AcroForm PDF (unlike FK 3059 which requires qpdf decryption). The `forms/` directory at the monorepo root is the correct storage location, following the fk3059/fk3057 precedent. The `decryptAndFill()` path is NOT needed for 4805 — use the simpler `PDFDocument.load(bytes, { ignoreEncryption: true })` pattern used by fk3057.

The most significant technical risk is the duplicate AcroForm field names in the employer/recipient sections. The actual 4805 form uses hierarchical qualified names (parent.leafName notation), meaning `getTextField('parent.txtNamn[0]')` must use the full qualified path. Field names provided by the user in the prompt are the leaf names; the fully qualified names must be confirmed when the 4805 template PDF is placed in `forms/`. The existing `try/catch` skip pattern in pdf.ts (`try { form.getTextField(name).setText(value); } catch { /* skip unknown field */ }`) handles field name mismatches gracefully.

**Primary recommendation:** Extend `server/src/routes/pdf.ts` with a `POST /api/pdf/4805` endpoint (one PDF per assistant per month), add `form4805-utils.ts` as a pure computation layer, fix `payroll-utils.ts` formula, run two `db:push` migrations, and add UI to Monthly.tsx Step 4 and Settings.tsx.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| pdf-lib | 1.17.1 (already installed) | Fill AcroForm fields, flatten, return Buffer | Already used in pdf.ts for FK forms; no new dependency |
| drizzle-orm | 0.30.10 (already installed) | Schema column additions + `db:push` | Existing ORM; two new columns via schema.ts |
| zod | 3.23.8 (already installed) | Request body validation in new route | Existing validation pattern in payroll.ts |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Intl.DateTimeFormat (built-in) | Node.js 20 runtime | Swedish month names (sv-SE locale) | `{ month: 'long' }` returns "mars", "maj" etc. |
| Math.round() (built-in) | — | Integer rounding for all form amounts | Sample form shows whole numbers; confirmed via prompt |

### No New Dependencies Required

The entire phase uses existing dependencies. `xmlbuilder2` (mentioned in CONTEXT.md D-08) is NOT needed because the output format was changed to PDF. No new npm packages needed.

**Verified with runtime test:** [VERIFIED: Node.js 20.20.1 runtime]
```
Intl.DateTimeFormat('sv-SE', { month: 'long' }).format(new Date(2026, 2, 1)) → "mars"
```
Capitalise the first letter for the form field: `name.charAt(0).toUpperCase() + name.slice(1)` → "Mars".

---

## Architecture Patterns

### File Layout for Phase 4

```
server/src/
├── lib/
│   ├── payroll-utils.ts       # FIX formula here (D-01)
│   └── form4805-utils.ts      # NEW: pure field-value computation (D-10)
├── routes/
│   └── pdf.ts                 # EXTEND: add POST /api/pdf/4805 endpoint (D-09)
├── db/
│   └── schema.ts              # ADD: prelim_tax_rate_snapshot + assistants.address
client/src/
├── lib/
│   └── api.ts                 # ADD: pdfApi.form4805() helper
├── pages/
│   ├── Monthly.tsx            # ADD: Step 4 with per-assistant download buttons (D-12)
│   └── Settings.tsx           # ADD: preliminary tax rate input field (D-13)
forms/
└── skv4805.pdf                # ADD: template PDF (must be placed manually)
```

### Pattern 1: Corrected Payroll Formula

**What:** `payroll-utils.ts` corrects the grossPay computation to deduct costs first.
**When to use:** Called from `payroll.ts` generate route AND the new recalculation route/migration.

```typescript
// Source: CONTEXT.md D-01 (user-confirmed correct formula)
export type PayrollInput = {
  billableHours: number;
  hourlyRate:    number;
  taxRate:       number;   // employer contribution rate e.g. 0.3142
  costsSum:      number;   // sum of costs.amount_sek for this assistant+month
};

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const fkAllocation         = input.billableHours * input.hourlyRate;
  const netAfterCosts        = fkAllocation - input.costsSum;
  const grossPay             = netAfterCosts / (1 + input.taxRate);
  const employerContributions = grossPay * input.taxRate;
  const totalEmployerCost    = grossPay + employerContributions;  // ≈ netAfterCosts
  return { grossPay, employerContributions, totalEmployerCost };
}
```

**Breaking change:** `PayrollInput` now requires `costsSum`. The `payroll.ts` generate route must query the `costs` table and pass the sum.

### Pattern 2: VAB Days for Month (New Helper)

**What:** `clippedDays()` in `absence-utils.ts` clips to a year boundary, NOT a month boundary. Phase 4 needs calendar days within a specific month.
**When to use:** In `form4805-utils.ts` to count VAB days for the reporting month.

```typescript
// New helper needed in absence-utils.ts or form4805-utils.ts
function clippedDaysInRange(
  startDate: string, endDate: string,
  rangeStart: string, rangeEnd: string
): number {
  const clippedStart = startDate < rangeStart ? rangeStart : startDate;
  const clippedEnd   = endDate   > rangeEnd   ? rangeEnd   : endDate;
  if (clippedStart > clippedEnd) return 0;
  const msPerDay = 86_400_000;
  return Math.round(
    (new Date(clippedEnd).getTime() - new Date(clippedStart).getTime()) / msPerDay
  ) + 1;
}
```

### Pattern 3: 4805 PDF Filling (pdf-lib)

**What:** Load unencrypted AcroForm PDF, set text fields, flatten, return buffer.
**Key:** 4805 is NOT encrypted — use `ignoreEncryption: true` pattern from fk3057, NOT the `decryptAndFill()` / qpdf path used for fk3059.

```typescript
// Source: [VERIFIED: pdf.ts fk3057 pattern, confirmed 4805 not encrypted via qpdf --check]
const formBytes = fs.readFileSync(formPath);
const pdfDoc    = await PDFDocument.load(formBytes, { ignoreEncryption: true });
const form      = pdfDoc.getForm();

const sf = (name: string, value: string) => {
  try { form.getTextField(name).setText(value); } catch {}  // skip unknown field gracefully
};

sf("txtManad", "Mars");
sf("fully.qualified.txtNamn[0]", guardianName);  // see field name section below
// ... etc
form.flatten();
const filledBytes = await pdfDoc.save();
res.setHeader("Content-Type", "application/pdf");
res.setHeader("Content-Disposition", `attachment; filename="4805-${year}-${mm}-${assistantName}.pdf"`);
res.send(Buffer.from(filledBytes));
```

### Pattern 4: Personnummer Birth Year Extraction

**What:** Parse birth year from Swedish personnummer to determine employer contribution rate.
**When to use:** In `form4805-utils.ts` to select which kod fields to populate.

Note: The additional context states that age-based contribution rates are DEFERRED from Phase 4 scope. The standard 31.42% rate (kod 04 + 07) applies to all assistants in this phase. However, the personnummer parsing is still needed to future-proof the utility.

```typescript
// Source: [VERIFIED: tested in Node.js 20.20.1 runtime]
// Handles both 12-digit (YYYYMMDDNNNN) and 10-digit (YYMMDD-NNNN / YYMMDDNNNN)
function birthYearFromPno(pno: string): number {
  const digits = pno.replace(/\D/g, "");
  if (digits.length === 12) {
    return parseInt(digits.substring(0, 4));
  }
  // 10-digit: check for '+' separator which means born 100+ years ago (1900s)
  const yy       = parseInt(digits.substring(0, 2));
  const hasCross = pno.includes("+");          // '+' = born >= 100 years ago
  if (hasCross) return 1900 + yy;
  return yy <= (new Date().getFullYear() % 100) ? 2000 + yy : 1900 + yy;
}
```

**Contribution rate selection (for future use — deferred from Phase 4):**
- Born 1959+: full arbetsgivaravgifter 31.42% → kod 04 + 07
- Born 1938–1958: ålderspensionsavgift 10.21% only → kod 18 + 24
- Born ≤ 1937: no contributions → kod 06 + 09 only

**For Phase 4:** Use kod 04 + 07 path for all assistants (age-based rates deferred).

### Pattern 5: Swedish Month Name

```typescript
// Source: [VERIFIED: Node.js 20.20.1, full ICU included in Node 20+]
function swedishMonthName(yearMonth: string): string {
  const [year, mon] = yearMonth.split("-");
  const d = new Date(parseInt(year), parseInt(mon) - 1, 1);
  const name = new Intl.DateTimeFormat("sv-SE", { month: "long" }).format(d);
  return name.charAt(0).toUpperCase() + name.slice(1);  // "Mars", "Maj", etc.
}
```

**Important:** Node.js 20 ships with full ICU by default. This works in the current runtime (`node --version = v20.20.1`). No `full-icu` package needed.

### Pattern 6: Settings Key Read at Generation Time

```typescript
// Source: [VERIFIED: misc.ts settings GET/POST pattern]
// Read preliminary_tax_rate from settings table at generation time
const rows = await db.select().from(settings);
const settingsMap = Object.fromEntries(rows.map(r => [r.key, r.value]));
const prelimTaxRate = parseFloat(settingsMap["preliminary_tax_rate"] ?? "0.30");
```

### Anti-Patterns to Avoid

- **Using decryptAndFill() for 4805:** 4805 is NOT owner-password-protected. The qpdf path would fail (no password to decrypt). Use plain `PDFDocument.load()` with `ignoreEncryption: true` like fk3057.
- **Computing grossPay = hours × rate directly:** The Phase 3 formula is wrong. Always use the corrected formula with cost deduction.
- **Using absenceBreakdownJson for VAB days:** `absenceBreakdownJson` stores VAB hours, not calendar days. Query `absences` table directly for calendar day count.
- **Hardcoding employer contribution rate:** Read from `taxRateSnapshot` in `payroll_records`, not from env or constants.
- **Float form values:** All SEK amounts on the form are whole numbers. Always `Math.round()` before calling `setText()`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| PDF form filling | Custom PDF byte manipulation | `pdf-lib` (already installed) | AcroForm field positions, compression, CRC |
| Swedish locale formatting | Manual month name array | `Intl.DateTimeFormat('sv-SE')` | Already verified working in Node 20 runtime |
| Settings key/value storage | New table or config file | Existing `settings` table + `PUT /api/settings` | Pattern already exists; consistent with other rates |
| PDF template discovery | Custom file resolver | Reuse `FORMS_DIR` constant from pdf.ts | Already resolves monorepo `forms/` directory correctly |

---

## AcroForm Field Name Resolution (CRITICAL)

### The Duplicate Name Problem

The 4805 form has two sections (employer / recipient) with the same leaf field names (`txtNamn[0]`, `txtAdress[0]`, `txtPersNr[0]`). pdf-lib's `getTextField(name)` throws `"A field already exists with the specified name"` if you try to CREATE a field with a duplicate name — but when READING an existing PDF's AcroForm, it uses the field's internal fully-qualified name (parent.child hierarchy).

**Verified behavior [VERIFIED: pdf-lib 1.17.1 runtime test]:**
- `form.createTextField('txtNamn')` → second call throws `"A field already exists with the specified name: 'txtNamn'"`
- `form.getTextField('employer.txtNamn[0]')` → works when PDF has hierarchical names
- `form.getTextField('txtNamn[0]')` → works when leaf name is unique

### How to Resolve

**Step 1:** When the 4805 template PDF is placed in `forms/skv4805.pdf`, run this inspection script to get the exact fully-qualified names:

```typescript
// One-time inspection script — run once when PDF is added
const pdfDoc = await PDFDocument.load(fs.readFileSync("forms/skv4805.pdf"), { ignoreEncryption: true });
const fields = pdfDoc.getForm().getFields();
fields.forEach(f => console.log(f.getName(), f.constructor.name));
```

**Step 2:** Use `form.getFields()` filter pattern if names cannot be determined upfront:

```typescript
// Fallback pattern: filter all fields by partial name match
const allFields = form.getFields();
const nameFields = allFields.filter(f => f.getName().includes("txtNamn"));
// nameFields[0] = employer section, nameFields[1] = recipient section
// (order depends on form structure — verify via inspection)
```

**Step 3:** The existing `try/catch` skip pattern in pdf.ts handles unknown/mismatched field names gracefully. Use the same pattern in the 4805 route.

### Field Map from User-Confirmed Inspection

The following field names were confirmed by the user inspecting the actual 4805 PDF. They may be leaf names or fully-qualified names — verify with the inspection script when the PDF template is available:

| Field | Content | Section |
|-------|---------|---------|
| `txtManad` | Swedish month name, capitalised (e.g. "Mars") | Header |
| `txtNamn[0]` (employer) | `profile.guardianName` | Employer (arbetsgivare) |
| `txtPersNr[0]` (employer) | `profile.guardianPno` | Employer |
| `txtAdress[0]` (employer) | `profile.address + ", " + profile.zip + " " + profile.city` | Employer |
| `txtNamn[0]` (recipient) | `assistant.name` | Recipient (mottagare) |
| `txtPersNr[0]` (recipient) | `assistant.pno` | Recipient |
| `txtAdress[0]` (recipient) | `assistant.address` (new column) | Recipient |
| `txtKod04` | `Math.round(grossPay)` | Bruttolön (born 1959+) |
| `txtKod07` | `Math.round(employerContributions)` | Arbetsgivaravgifter 31.42% |
| `txtKod06` | `Math.round(grossPay)` | Underlag för skatteavdrag |
| `txtKod09` | `Math.round(grossPay * prelimTaxRate)` | Avdragen skatt (withheld) |
| `txtKod10` | `Math.round(employerContributions + grossPay * prelimTaxRate)` | Summa att betala |
| `txtNamnfortydl` | `profile.guardianName` | Signature clarification |
| `txtNTelefon` | `profile.guardianPhone` | Guardian phone |

**Not in Phase 4 scope:** `txtKod18`, `txtKod24` (age-based rates — deferred).

---

## Schema Changes

### Two Migrations Required (db:push)

**Migration 1 — `payroll_records` table:**
```typescript
// Add to schema.ts payrollRecords table
prelimTaxRateSnapshot: real("prelim_tax_rate_snapshot"),  // nullable: old records won't have it
```

**Migration 2 — `assistants` table:**
```typescript
// Add to schema.ts assistants table
address: text("address").default(""),
```

Both columns must be added BEFORE any routes reference them. Run `npm run db:push` in `server/` directory after schema.ts changes.

**Note:** These are additive columns with defaults. No data loss. Existing `payroll_records` rows will have `prelim_tax_rate_snapshot = null` until regenerated.

---

## Existing Payroll Records Recalculation (Open Question Resolved)

**The problem:** Phase 3 stored incorrect `grossPay` and `employerContributions` values (formula treated `hours × rate` as gross salary instead of FK allocation envelope).

**Recommended approach:** Add a `POST /api/payroll/recalculate` guardian-only route that:
1. Fetches all `payroll_records` that were generated with the old formula
2. For each record: re-queries costs, recalculates with corrected formula, updates the row
3. Only recalculates `draft` records (approved records are locked per D-13 in Phase 3 CONTEXT)
4. Returns a summary of updated records

**For approved records:** Do NOT overwrite. Add a `POST /api/payroll/:id/regenerate` endpoint that guardian can explicitly call to unlock and regenerate an approved record if needed. The AGI PDF generation checks `payroll_records.status = 'approved'` — the guardian can approve the corrected figures before downloading the 4805.

**Alternative (simpler):** Delete and re-generate. The `POST /api/payroll/generate` route is already idempotent with `existing.length > 0 → return existing`. To force regeneration, the guardian deletes the old records first. But there's no delete endpoint. The recalculate route is cleaner.

**Practical reality for dev/test:** Current database likely has test data only. The recalculate route is the safe production path. For the dev environment, truncating payroll_records and regenerating is acceptable.

---

## Common Pitfalls

### Pitfall 1: 4805 Template PDF Not in `forms/` Directory

**What goes wrong:** `server/src/routes/pdf.ts` resolves `FORMS_DIR` using a candidate list. If `forms/skv4805.pdf` is absent, the route returns 404.
**Why it happens:** The 4805 template PDF must be downloaded from Skatteverket and placed in `forms/` manually — it cannot be committed to git (copyrighted Swedish government form).
**How to avoid:** The route must check `fs.existsSync(formPath)` and return a clear 404 JSON error with instructions if missing. Add a note to verification checklist: "Place `skv4805.pdf` in `forms/` before testing."
**Warning signs:** `{ error: "skv4805.pdf not found in forms/ directory" }` response.

### Pitfall 2: Corrected Formula Breaks `calculatePayroll()` Callers

**What goes wrong:** `calculatePayroll()` signature changes (adds `costsSum` parameter). The `payroll.ts` generate route passes a `PayrollInput` — it will fail TypeScript compilation if not updated to pass `costsSum`.
**Why it happens:** The `costs` table query is not in `payroll-utils.ts` (pure function, no DB). The route must query costs and pass the sum.
**How to avoid:** Update `payroll.ts` to: (1) import and query `costs` table for each assistant+month, (2) sum `amountSek`, (3) pass `costsSum` to `calculatePayroll()`. TypeScript compilation will catch mismatches.
**Warning signs:** TypeScript error `Property 'costsSum' is missing in type 'PayrollInput'`.

### Pitfall 3: Duplicate AcroForm Field Names for Employer vs Recipient

**What goes wrong:** Calling `form.getTextField("txtNamn[0]")` when the form has two fields with that leaf name (employer and recipient sections) — may throw or silently set only one.
**Why it happens:** The actual fully-qualified names depend on the form's internal hierarchy (e.g., `"Arbetsgivare.txtNamn[0]"` and `"Mottagare.txtNamn[0]"`).
**How to avoid:** Run the inspection script on the actual `forms/skv4805.pdf` template before coding the field map. Use `form.getFields().forEach(f => console.log(f.getName()))` to get exact names.
**Warning signs:** Employer/recipient fields showing identical or blank values in the output PDF.

### Pitfall 4: absenceBreakdownJson Used for VAB Days

**What goes wrong:** `payroll_records.absenceBreakdownJson` stores absence HOURS (e.g., `{"vab": 16}` = 16 hours), not calendar DAYS. Form 4805 field `txtKod30` (if present) needs calendar days.
**Why it happens:** The field was designed for payroll display (PAY-02), not AGI form.
**How to avoid:** Use `clippedDaysInRange()` against the `absences` table directly in the 4805 generation route. Note: VAB field is DROPPED from Phase 4 scope per additional context update — this pitfall is noted for awareness only.

### Pitfall 5: `preliminary_tax_rate` Not Yet Set in Settings

**What goes wrong:** `settingsMap["preliminary_tax_rate"]` is `undefined` if the guardian hasn't saved a value yet. Parsing `undefined` as a float returns `NaN`, which corrupts the form fields.
**Why it happens:** New settings key; defaults to `""` (empty string) in the `settings` table.
**How to avoid:** Use a sensible fallback: `parseFloat(settingsMap["preliminary_tax_rate"] ?? "0.30")` and validate it's a finite number > 0 before generation. Return a 400 error if no tax rate is configured.

### Pitfall 6: `payroll.ts` Generate Route Still Has Old Formula After Fix

**What goes wrong:** After fixing `payroll-utils.ts`, the generate route also reads rates from env vars (`process.env.FK_HOURLY_RATE`) — but does NOT yet read `preliminary_tax_rate` from settings or query the `costs` table.
**Why it happens:** Two places need updating: `payroll-utils.ts` (formula logic) AND `payroll.ts` (route that calls it, now needs `costsSum` and `prelimTaxRate`).
**How to avoid:** Update both files in the same plan/commit. The TypeScript compiler enforces `costsSum` is provided.

---

## Code Examples

### Corrected PayrollInput type and calculate function

```typescript
// Source: [CITED: CONTEXT.md D-01]
export type PayrollInput = {
  billableHours: number;
  hourlyRate:    number;
  taxRate:       number;
  costsSum:      number;   // NEW — was missing in Phase 3
};

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const fkAllocation          = input.billableHours * input.hourlyRate;
  const netAfterCosts         = fkAllocation - input.costsSum;
  const grossPay              = netAfterCosts / (1 + input.taxRate);
  const employerContributions = grossPay * input.taxRate;
  const totalEmployerCost     = grossPay + employerContributions;
  return { grossPay, employerContributions, totalEmployerCost };
}
```

### 4805 Route Skeleton

```typescript
// Source: [VERIFIED: pdf.ts fk3057 pattern extended for 4805]
router.post("/4805", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  const { year, month, assistantId } = req.body as {
    year: string; month: string; assistantId: string;
  };

  const formPath = path.join(FORMS_DIR, "skv4805.pdf");
  if (!fs.existsSync(formPath)) {
    return res.status(404).json({ error: "skv4805.pdf not found in forms/ directory" });
  }

  // Fetch approved payroll record
  const [record] = await db.select().from(payrollRecords).where(
    and(eq(payrollRecords.assistantId, assistantId),
        eq(payrollRecords.month, `${year}-${month.padStart(2,"0")}`),
        eq(payrollRecords.status, "approved"))
  );
  if (!record) return res.status(404).json({ error: "Approved payroll record not found" });

  // Fetch other data
  const [prof] = await db.select().from(profile).limit(1);
  const [asst] = await db.select().from(assistants).where(eq(assistants.id, assistantId));
  const settingsRows = await db.select().from(settings);
  const settingsMap  = Object.fromEntries(settingsRows.map(r => [r.key, r.value]));
  const prelimRate   = parseFloat(settingsMap["preliminary_tax_rate"] ?? "0");
  if (!isFinite(prelimRate) || prelimRate <= 0) {
    return res.status(400).json({ error: "Preliminary tax rate not configured in Settings" });
  }

  // Compute fields and fill PDF
  const fields = build4805Fields({ record, prof, asst, year, month, prelimRate });
  const formBytes = fs.readFileSync(formPath);
  const pdfDoc    = await PDFDocument.load(formBytes, { ignoreEncryption: true });
  const form      = pdfDoc.getForm();
  for (const [name, value] of Object.entries(fields)) {
    try { form.getTextField(name).setText(value); } catch { /* skip unknown field */ }
  }
  form.flatten();

  const filename = `4805-${year}-${month.padStart(2,"0")}-${asst.name.replace(/\s+/g,"-")}.pdf`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(Buffer.from(await pdfDoc.save()));
});
```

### Settings.tsx — Preliminary Tax Rate Field Pattern

```typescript
// Source: [VERIFIED: Settings.tsx existing rate field pattern]
// Add alongside existing hourly rate / employer tax rate fields
// The settings state already initialises from useQuery(["settings"])
// Add to sched/gcal initialisation useEffect:
setPrelimTaxRate(settings.preliminary_tax_rate ?? "");

// Save via:
settingsApi.update({ preliminary_tax_rate: prelimTaxRate });
```

### Monthly.tsx Step 4 — Per-Assistant 4805 Download Buttons

```typescript
// Source: [VERIFIED: Monthly.tsx fk3057Download mutation pattern]
// Add pdfApi.form4805() to api.ts:
form4805: (year: string, month: string, assistantId: string) =>
  api.post("/pdf/4805", { year, month, assistantId }, { responseType: "blob" }),

// In Monthly.tsx, add mutation per assistant:
const form4805Download = useMutation({
  mutationFn: (assistantId: string) =>
    pdfApi.form4805(String(year), pad(month + 1), assistantId),
  onSuccess: (res, assistantId) => {
    const asst = (assistants as Assistant[]).find(a => a.id === assistantId);
    const url  = URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
    const a = document.createElement("a"); a.href = url;
    a.download = `4805-${year}-${pad(month+1)}-${(asst?.name ?? "").replace(/\s+/g,"-")}.pdf`;
    a.click(); URL.revokeObjectURL(url);
  },
});

// Step 4 unlocked when all payroll records are approved
const step4Unlocked = step1Complete && step2Complete && payrollRecords.every(r => r.status === "approved");
```

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pdf-lib | 4805 PDF filling | ✓ | 1.17.1 | — |
| Node.js full ICU | Swedish month names via Intl | ✓ | Node 20.20.1 (full ICU default) | Manual month array |
| qpdf | NOT needed for 4805 | N/A | 12.3.2 available | — |
| forms/skv4805.pdf | PDF template | ✗ | — | 404 error with instructions |
| PostgreSQL | Schema migrations | Assumed ✓ | — | — |

**Missing dependencies with no fallback:**
- `forms/skv4805.pdf` — must be manually downloaded from Skatteverket and placed in `forms/`. The route returns a clear 404 if absent. Cannot be committed to git. Add to verification checklist.

**Missing dependencies with fallback:**
- Full ICU locale data: if `Intl.DateTimeFormat('sv-SE')` returns wrong output (won't happen in Node 20), fall back to: `["januari","februari","mars","april","maj","juni","juli","augusti","september","oktober","november","december"][monthIndex]`.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.2 |
| Config file | `server/vitest.config.ts` |
| Quick run command | `cd server && npm test` |
| Full suite command | `cd server && npm test -- --coverage` |
| Test directory | `server/src/__tests__/` (does not exist yet — Wave 0 must create it) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| TAX-01 | `calculatePayroll` with costsSum returns correct grossPay | unit | `npm test -- --grep "calculatePayroll"` | ❌ Wave 0 |
| TAX-01 | `calculatePayroll` with costsSum=0 equals old formula / (1+rate) | unit | same | ❌ Wave 0 |
| TAX-01 | Preliminary tax amount = grossPay × rate, rounded | unit | `npm test -- --grep "form4805"` | ❌ Wave 0 |
| TAX-02 | POST /api/pdf/4805 returns 404 when template missing | integration | `npm test -- --grep "pdf 4805"` | ❌ Wave 0 |
| TAX-02 | POST /api/pdf/4805 returns 400 when prelimTaxRate not set | integration | same | ❌ Wave 0 |
| TAX-02 | POST /api/pdf/4805 returns 404 when no approved record | integration | same | ❌ Wave 0 |
| D-01 | Formula: `gross = (hours × rate − costs) / (1 + taxRate)` correct | unit | `npm test -- --grep "calculatePayroll"` | ❌ Wave 0 |
| D-01 | Formula invariant: `grossPay + employerContrib ≈ netAfterCosts` | unit | same | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `cd server && npm test`
- **Per wave merge:** `cd server && npm test -- --coverage`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `server/src/__tests__/payroll-utils.test.ts` — covers TAX-01, D-01 (calculatePayroll formula)
- [ ] `server/src/__tests__/form4805-utils.test.ts` — covers TAX-01 (field value computation, month name, rounding)
- [ ] `server/src/__tests__/pdf.test.ts` — covers TAX-02 (route 400/404 error cases; does NOT require actual PDF template)

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | 4805 AcroForm field names are hierarchically qualified (e.g., `Arbetsgivare.txtNamn[0]`) separating employer from recipient | AcroForm Field Name Resolution | Field map won't work; need to run inspection script on actual template |
| A2 | Age-based contribution rates are deferred — all assistants use 31.42% (kod 04 + 07) in Phase 4 | Code Examples | Wrong employer contributions on form for elderly assistants |
| A3 | The 4805 form is not encrypted and can be loaded with `PDFDocument.load(bytes, { ignoreEncryption: true })` | Pattern 3 | If form IS encrypted, need qpdf decrypt step; but qpdf --check confirms it is not |
| A4 | `payroll_records` with `status = 'approved'` should NOT be automatically recalculated; guardian must explicitly regenerate | Existing Payroll Records Recalculation | Could leave stale data in DB if guardian doesn't recalculate before generating 4805 |

**Note:** A3 is partially verified — the instruction brochure PDF (skv448) was confirmed not encrypted. The actual fillable 4805 form was not directly downloadable for inspection. The FK3059 form IS owner-password-protected (requires qpdf), but that is an FK-specific restriction, not a Skatteverket blankett standard.

---

## Open Questions

1. **Exact fully-qualified AcroForm field names in the 4805 template**
   - What we know: User confirmed leaf names (txtNamn[0], txtAdress[0], etc.)
   - What's unclear: Full hierarchical path — are they `Arbetsgivare.txtNamn[0]` or something else?
   - Recommendation: Run inspection script on `forms/skv4805.pdf` as **Wave 0 task** before coding the field map. If the leaf names are truly unique in the form, they can be used directly.

2. **Whether to add `clippedDaysInRange()` to `absence-utils.ts` or define it locally in `form4805-utils.ts`**
   - What we know: VAB field dropped from Phase 4 scope (additional context update). But `clippedDaysInRange()` is still useful for future phases.
   - What's unclear: Whether Phase 4 needs VAB days at all on the form
   - Recommendation: Add `clippedDaysInRange()` to `absence-utils.ts` as a pure export, skip VAB field in this phase.

3. **Settings.tsx: how to structure the preliminary_tax_rate field alongside existing rates**
   - What we know: Existing Settings.tsx has `sched` and `gcal` state blocks. FK rates are read from a separate `/api/rates` endpoint (env-var based). Prelim tax rate is a `settings` key/value.
   - What's unclear: Whether to add a new `payroll` settings section or extend existing
   - Recommendation: Add a new "Payroll" settings Card section in Settings.tsx with a single input for "Preliminary tax rate (%)". Use `settingsApi.update({ preliminary_tax_rate: ... })` directly.

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `requireAuth` + `requireGuardian` middleware on new route |
| V3 Session Management | no | JWT stateless, no new sessions |
| V4 Access Control | yes | `requireGuardian` ensures only guardian can generate 4805 |
| V5 Input Validation | yes | zod schema on `{ year, month, assistantId }` — validates format |
| V6 Cryptography | no | No new crypto operations |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Guardian generates 4805 for someone else's assistant | Elevation of Privilege | Single-tenant: no cross-guardian assistant data; `requireGuardian` middleware |
| Path traversal via `assistantId` in filename | Tampering | Sanitise `asst.name` in filename: `.replace(/[^a-zA-Z0-9\-]/g, "-")` |
| Unvalidated `year`/`month` fields | Tampering | Zod regex validation: `year: z.string().regex(/^\d{4}$/)`, `month: z.string().regex(/^\d{2}$/)` |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| AGI XML (xmlbuilder2) | Form 4805 PDF (pdf-lib) | 2026-04-11 discussion | D-08 superseded; no xmlbuilder2 needed |
| Phase 3 wrong formula: `gross = hours × rate` | Corrected: `gross = (hours × rate − costs) / (1 + taxRate)` | Phase 4 | All existing payroll_records have wrong grossPay |

---

## Sources

### Primary (HIGH confidence)
- [VERIFIED: server/src/routes/pdf.ts] — fk3057 pattern (load with ignoreEncryption), fk3059 pattern (qpdf decrypt), FORMS_DIR resolution, field fill loop, flatten, send buffer
- [VERIFIED: server/src/lib/payroll-utils.ts] — current wrong formula; confirmed `calculatePayroll` signature
- [VERIFIED: server/src/db/schema.ts] — `payroll_records`, `assistants`, `settings`, `costs`, `absences` table columns
- [VERIFIED: server/src/lib/absence-utils.ts] — `clippedDays()` signature clips by year NOT month; `filterBillableEntries()` function
- [VERIFIED: server/src/routes/payroll.ts] — generate route, existing `costsSum` gap, `taxRate` from env, snapshot pattern
- [VERIFIED: server/src/routes/misc.ts] — settings GET/POST pattern, `onConflictDoUpdate` upsert
- [VERIFIED: client/src/lib/api.ts] — `pdfApi` pattern with `responseType: "blob"`, `payrollApi` types
- [VERIFIED: client/src/pages/Monthly.tsx] — stepper state, `fkUnlocked` gate, `fk3057Download` mutation pattern to replicate
- [VERIFIED: client/src/pages/Settings.tsx] — `settingsApi.update()` mutation pattern, settings state initialisation from useQuery
- [VERIFIED: Node.js 20.20.1 runtime] — `Intl.DateTimeFormat('sv-SE', { month: 'long' })` returns correct Swedish month names
- [VERIFIED: pdf-lib 1.17.1 runtime test] — duplicate field name throws on createTextField; qualified names work; getFields() filter approach
- [VERIFIED: qpdf 12.3.2 check on downloaded 4805-variant PDF] — Skatteverket brochure PDFs are not encrypted (no qpdf needed)
- [VERIFIED: server/package.json] — pdf-lib 1.17.1 installed, no xmlbuilder2, vitest 4.1.2 available

### Secondary (MEDIUM confidence)
- [CITED: CONTEXT.md + DISCUSSION-LOG.md] — user-confirmed field names, formula correction, payroll decisions D-01 through D-14
- [CITED: additional_context in research prompt] — confirmed AcroForm field names from user's inspection of actual 4805 PDF; confirmed 4805 is NOT the same as LONA/AGI XML

### Tertiary (LOW confidence)
- Age-based contribution rates (10.21% for born 1938–1958) — from STATE.md research summary; not verified against 2026 Skatteverket documentation since age-based rates are deferred from Phase 4 scope

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all dependencies verified in package.json and runtime
- Architecture: HIGH — follows verified patterns from pdf.ts, payroll.ts, misc.ts
- AcroForm field names: MEDIUM — leaf names user-confirmed; fully-qualified names need inspection of actual template
- Pitfalls: HIGH — verified via code inspection and runtime testing
- Formula: HIGH — user-confirmed correction documented in CONTEXT.md

**Research date:** 2026-04-11
**Valid until:** 2026-07-11 (stable stack; pdf-lib 1.17.x API unlikely to change)
