---
created: 2026-04-18T00:00:00Z
title: Verify and fix payroll calculation — deduct employer tax and costs from FK allocation correctly
area: api
files:
  - server/src/lib/payroll-utils.ts
  - server/src/lib/payroll-utils.test.ts
  - server/src/routes/payroll.ts:38
  - client/src/pages/Monthly.tsx
  - .planning/compliance/2026-03-advisor-brief.md
  - .planning/phases/04-tax-reporting-agi/04-01-PLAN.md
---

## Problem (reported by guardian 2026-04-18)

> "Payroll calculation is not correct — employer tax as well as costs should be deducted from the money paid out by FK."

The guardian is signalling that the numbers shown on Monthly don't match their understanding of how assistansersättning accounting works. Needs to be reconciled against the actual code + the regulatory reality before any change.

## What the code does today

In [server/src/lib/payroll-utils.ts](../../../server/src/lib/payroll-utils.ts):

```
fkAllocation       = billableHours × hourlyRate        // 215 × 334 = 71,810 SEK
netAfterCosts      = fkAllocation − costsSum           // 71,810 − 0      = 71,810 SEK
grossPay           = netAfterCosts / (1 + taxRate)     // 71,810 / 1.3142 = 54,641.61 SEK
employerContribs   = grossPay × taxRate                // 54,641.61 × 0.3142 = 17,168.39 SEK
totalEmployerCost  = grossPay + employerContribs       // 54,641.61 + 17,168.39 = 71,810.00 SEK
```

Algebraically this **does** deduct both employer tax and costs from the FK allocation:

```
fkAllocation = grossPay + employerContribs + costsSum
           = totalEmployerCost + costsSum
```

So for March 2026 (costs=0): FK pays 71,810 → split as 17,168 arbetsgivaravgifter to Skatteverket + 54,642 bruttolön to assistants. If costs were 5,000, the split becomes 4,977 arbetsgivaravgifter + 15,833 bruttolön? No — let me redo: `netAfterCosts = 66,810; grossPay = 50,838; empContribs = 15,973; total 66,810 + 5,000 costs = 71,810`. Math balances.

**So the formula as written appears arithmetically consistent with what the user described.** Something else is wrong — either the UX, the definition of "costs", the tax rate, the missing preliminärskatt display, or a conceptual mismatch. Need to triage before changing code.

## Hypotheses for what's actually broken

### H1 — UX presentation, not the math

Monthly.tsx may show `totalEmployerCost` = 71,810 and the guardian reads that as "the assistant got 71,810" (wrong) or "FK paid us 71,810 and we still owe taxes on top" (wrong interpretation, math is right).

**Check**: what does Monthly.tsx actually label each number? Is there a clear line for "FK pays → X", "− Employer tax → Y", "− Costs → Z", "= Gross to assistant → W", "− Preliminärskatt → V", "= Net to assistant"?

### H2 — Costs model is wrong / incomplete

`costsSum` is a free-form ledger (`costs` table, amount_sek per assistant per month). The guardian may be expecting specific deductions that aren't being captured as `costs` rows:
- **Pension (tjänstepension / avsättning för pension)** — per kollektivavtal, typically 4–5% of gross
- **Sjuklönereserv** — 1.8% reserve for assistant sick-pay obligation first 14 days
- **Föräldralönereserv**, **försäkringar** (AGS, AGB, TFA) — per Fremia/Kommunal agreement
- **Semesterlön / semesterersättning reserv** — 12% of gross
- **Utbildningskostnader**, arbetsmiljö
- **Administrationspåslag** (guardian overhead budget per FK schablon — ~6-12% of schablon depending on model)

**If these aren't entered as costs rows, the guardian sees "overskott" that doesn't actually exist.** That would feel like "my calculation is wrong" even though the formula is correct — the inputs aren't complete.

### H3 — Employer tax rate is the wrong number

Current default is 0.3142 (31.42%) — standard Swedish arbetsgivaravgift for 2026. But it ignores:
- **Age 67+ reduced rate: 10.21%** — if one of the assistants is 67+, using 31.42% overstates the obligation
- **Age 19–23 reduced rate: 17.77%** (April 2026+) — partial relief
- **Nedsatt avgift** for first-time employers, certain regions, or research/development roles

If an assistant falls in a reduced-rate band, the calculation over-deducts employer tax, which inflates apparent costs.

### H4 — Preliminärskatt is not being surfaced

`assistants.prelimTaxRateSnapshot` exists on payroll_records (30% default). But:
- The code calculates `grossPay` (what the assistant earns on paper)
- It does NOT calculate `netPay = grossPay × (1 − prelimTaxRate)` and display "what assistant actually receives in their bank account"
- From the guardian's perspective, "what I pay out" might mean net (after preliminärskatt) rather than gross

If Monthly.tsx shows gross but the guardian's mental "money paid out" is net, numbers feel wrong.

### H5 — "Overhead / överskott" not modelled

FK pays 71,810 SEK for 215h. In many accounting models, a **portion** of that (often ~12–15%) is designated as **assistansomkostnader** — a pot for training, sick-leave cover, equipment, etc. — which is separate from lönekostnader.

Current code lumps everything into "costs" as a free-form ledger. If the guardian operates on the schablon-based split where:
- **~87% of schablon → lönekostnader (gross + arbetsgivaravgifter)**
- **~13% of schablon → assistansomkostnader (pot)**

then the expected gross is more like `71,810 × 0.87 / 1.3142 ≈ 47,537 SEK`, not 54,642. The 7,000 SEK "extra" the current formula gives to bruttolön should have been earmarked for the omkostnader pot.

This is the most likely real bug: **the current formula spends the entire FK allocation on bruttolön + arbetsgivaravgifter (minus explicit costs rows)**, leaving zero for omkostnader pot unless costs are manually entered. That feels wrong from the guardian's standpoint.

### H6 — FK schablon has multiple components

The 334 SEK/h schablon for 2026 is already an aggregate. FK publishes a schablon-breakdown:
- Lönekostnader (incl. arbetsgivaravgifter): ~87%
- Omkostnader: ~8%
- Administration: ~3%
- Arbetsmiljöinsatser: ~2%

Possibly the guardian expects the code to do this breakdown automatically rather than treating the full 334 as bruttolön+arbetsgivaravgifter fuel.

## Next steps

1. **Clarify with guardian**: show them the current formula side-by-side with what they expect — which hypothesis matches their model? (H5 is the likely winner but must be confirmed.)
2. **Check Monthly.tsx labelling**: make sure every number is explicitly captioned so accidental misreading is ruled out.
3. **Depending on outcome, one of**:
   - **H1/H4 fix**: expand Monthly.tsx to show a full cascade — `FK allocation → arbetsgivaravgifter → costs → gross → preliminärskatt → net`. No formula change; UX clarity.
   - **H2 fix**: seed standard cost categories (pension, sjuklönereserv, semesterersättning, försäkringar) on profile setup + prompt guardian monthly to enter the numbers. Possibly auto-compute defaults from gross × standard percentages.
   - **H3 fix**: per-assistant `taxRate` field (already flagged in the schema-additions todo); payroll.ts reads that instead of the env default for each assistant.
   - **H5 fix (most likely needed)**: introduce an `omkostnader_pot` concept — a percentage of the schablon (configurable per guardian, default 13%) that is set aside before the lönekostnader calculation. Revised formula:
     ```
     fkAllocation   = billableHours × hourlyRate
     omkostnader    = fkAllocation × omkostnaderRate        // NEW
     lönebudget     = fkAllocation − omkostnader − explicitCosts
     grossPay       = lönebudget / (1 + taxRate)
     employerContribs = grossPay × taxRate
     ```
   - **H6 fix**: expose the full schablon breakdown at generation time (Lönekostnader / Omkostnader / Administration) so the guardian sees where every FK krona goes.

4. **Tests**: payroll-utils.test.ts needs cases for each fix with known-good numbers (ideally cross-referenced with Fremia or IfA published worked examples).

5. **Migration concern**: changing the formula retroactively alters numbers on any already-approved payroll records. Approved records must not be overwritten. Apply change to *new* months only, or produce a clear "adjusted" delta record if old months need restatement.

## Priority

**High** — this is money being paid out and declared to Skatteverket. Wrong numbers here produce actual legal and financial exposure, not just cosmetic bugs. Block any further payroll approvals until triaged.

## Related

- Formula origin (D-01): [.planning/phases/04-tax-reporting-agi/04-01-PLAN.md](../../phases/04-tax-reporting-agi/04-01-PLAN.md)
- Companion compliance concern: [.planning/compliance/2026-03-advisor-brief.md](../../compliance/2026-03-advisor-brief.md) (March numbers driven by this formula)
- Schema gaps: [2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md](2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md) — per-assistant tax rate, pension, assistansomkostnader would live here
