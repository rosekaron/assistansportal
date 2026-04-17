---
created: 2026-04-18T00:00:00Z
title: Resume discussion — payroll formula hypotheses before any code change
area: planning
priority: blocking
surfaces_on: gsd-next
files:
  - server/src/lib/payroll-utils.ts
  - server/src/routes/payroll.ts
  - client/src/pages/Monthly.tsx
  - .planning/todos/pending/2026-04-18-verify-and-fix-payroll-calculation-deduct-employer-tax-and-c.md
  - .planning/todos/pending/2026-04-18-triage-all-open-todos-with-guardian-before-any-implementatio.md
---

## ▶ SURFACE THIS ON NEXT `/gsd-next`

Guardian flagged the payroll calculation as "not correct — employer tax and costs should be deducted from FK money paid out". On reading the code, the formula arithmetically already does deduct both. That means the bug is somewhere else. Six hypotheses laid out; one needs to be picked before any code ships.

**Do not** jump to `/gsd-plan-phase` or `/gsd-execute-phase`. Do this discussion first.

## Context captured verbatim (2026-04-18)

Current formula ([server/src/lib/payroll-utils.ts](../../../server/src/lib/payroll-utils.ts)):

```
fkAllocation       = billableHours × hourlyRate        // 215 × 334 = 71,810 SEK
netAfterCosts      = fkAllocation − costsSum           // 71,810 − 0 = 71,810 SEK
grossPay           = netAfterCosts / (1 + taxRate)     // 71,810 / 1.3142 = 54,641.61 SEK
employerContribs   = grossPay × taxRate                // 54,641.61 × 0.3142 = 17,168.39 SEK
totalEmployerCost  = grossPay + employerContribs       // = 71,810 SEK (= netAfterCosts)
```

Algebraic identity: **`fkAllocation = grossPay + employerContribs + costsSum`** — both employer tax and costs are deducted from FK.

So the felt-wrong-ness is not a math bug. Six hypotheses:

| # | What might actually be broken | Evidence |
|---|-------------------------------|----------|
| **H5 (most likely)** | **Omkostnader pot not modelled.** FK's 334 SEK/h schablon has ~13% earmarked for assistansomkostnader (training, sick reserve, insurance, semesterlön). Current formula spends 100% of fkAllocation on bruttolön + arbetsgivaravgifter. The ~7,000 SEK/month "extra bruttolön" per assistant should have been set aside in an omkostnader pot. | 54,642 SEK gross for 215h looks high vs. what most guardians actually pay. Standard schablon-based bookkeeping would cap gross closer to 47,500. |
| H2 | Costs are a blank ledger — required categories (pension, sjuklönereserv, semesterlön, försäkringar, utbildning) aren't seeded or prompted. | No cost categories surfaced anywhere |
| H4 | Preliminärskatt not displayed — guardian's "paid out" mental model = net (after employee tax), not gross. | Monthly.tsx shows gross; prelim tax is snapshotted but not rendered |
| H3 | Per-assistant tax rates (age 67+ = 10.21%, age 19–23 = 17.77%) not supported. Flat 31.42% over-deducts for some. | Global env-var default, not per-assistant field |
| H1 | UX labelling makes correct math look wrong. | Needs to look at actual Monthly.tsx render |
| H6 | FK schablon components (löne/omkostnader/admin) never shown — all 334 treated as bruttolön fuel. | Full breakdown never surfaced in UI |

## Proposed revised formula (H5 variant) — for discussion only, not to ship yet

```
fkAllocation     = billableHours × hourlyRate
omkostnader      = fkAllocation × omkostnaderRate        // NEW, default ~0.13, configurable per guardian
lönebudget       = fkAllocation − omkostnader − explicitCosts
grossPay         = lönebudget / (1 + taxRate)
employerContribs = grossPay × taxRate
```

Cascade the guardian sees on Monthly would become:

```
FK allocation         71,810 SEK  (215h × 334)
  − Omkostnader pot   −9,335 SEK  (13% reserve for insurance, training, sick)
  − Explicit costs    −0     SEK
  = Lönebudget        62,475 SEK
     Gross pay         47,537 SEK  → assistant's bruttolön
      + Arbetsgivaravgifter  14,937 SEK  → Skatteverket
     Total lönekostnader 62,475 SEK  ✓
  = Överskott          0      SEK
```

For the assistant view: `grossPay 47,537 − preliminärskatt (30% = 14,261) = 33,276 SEK net to bank account`.

## What's needed before coding

Answer these with the guardian in a short conversation:

1. **Which hypothesis (H1–H6) matches what you're actually seeing?** If unsure, walk through `/monthly` together and point at what looks wrong. Multiple can be true.
2. **Is the omkostnader pot concept (H5) how you want to bookkeep?** Or do you expect the whole 334 SEK/h to be paid out as bruttolön + employer tax with costs only coming out when explicitly entered? (The answer determines ~80% of the fix.)
3. **Per-assistant skattetabell (H3):** important now, or backlog? Affects accuracy but only for assistants in age brackets with reduced rates.
4. **Net pay display (H4):** add a "net to bank" line on Monthly, or leave as gross-only?
5. **Schablon breakdown (H6):** show FK's own allocation split, or keep the current single-number view?

## Path forward

Only after the above are answered:
- If H5 is the answer → new GSD phase "Payroll formula: omkostnader pot" (schema column for rate, migration that preserves approved records, updated formula, tests, Monthly UI update)
- If H4 / H1 is the answer → Monthly.tsx UX-only pass, no formula change
- If H2 is the answer → cost category seeding + Settings UI + Monthly prompts
- If H3 is the answer → ties to the schema-additions todo (per-assistant tax rate)
- If H6 is the answer → breakdown surfacing, possibly combined with H5

**Do not combine all six into a single mega-phase.** Ship the targeted fix that matches the real problem.

## Why this is logged as "surface on gsd-next"

The /gsd-next routing rules currently advance by phase progress, which would have pushed the next session into the milestone archive flow. That would have silently skipped over the payroll discussion the guardian explicitly asked for. This todo + the triage-gate todo together are the correct answer for "what's actually next" — they need to take priority over the automated routing until resolved.

Companion: [2026-04-18-triage-all-open-todos-with-guardian-before-any-implementatio.md](2026-04-18-triage-all-open-todos-with-guardian-before-any-implementatio.md) — broader triage gate; this todo is the specific payroll discussion within that gate.

## Archive this todo when…

- The guardian has chosen which hypothesis (or combination) to fix
- A plan has been written for the chosen fix
- The plan has been reviewed
- Then this todo → `.planning/todos/completed/` with a link to the phase spawned

## Resume script (for next session)

When `/gsd-next` runs and sees this todo, it should:

1. Output: "Before anything else: we paused mid-triage on 2026-04-18. Payroll formula discussion is blocking. Resume now?"
2. If yes → read this file + the payroll-formula todo + the triage-gate todo, present the hypothesis table to the guardian, ask question #1 ("which hypothesis matches what you see?").
3. Only after answered → proceed with whatever the guardian chooses (plan, more discussion, drop).
