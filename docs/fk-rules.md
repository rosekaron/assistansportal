# FK Rules — Assistansersättning Hour Limits

> Reference for compliance logic in Kalinga. Last updated: 2026-03-28.
> Source: Försäkringskassan guidance, Arbetstidslagen (ATL, SFS 1982:673), Lagen om arbetstid i husligt arbete (1970:943).

---

## Two Separate Systems

| Dimension | Governed by | What it measures |
|-----------|-------------|-----------------|
| **Care recipient's approved hours** (beviljade assistanstimmar) | Försäkringskassan / LSS / SFB | Total weekly/monthly need — the size of the care package |
| **Individual assistant's working hours** | Labor law / kollektivavtal | Each assistant's personal employment limits |

These are independent. FK withholds payment for any assistant's hours that exceed their personal limit — regardless of the care recipient's total approved package.

---

## Care Recipient's Approved Hours

- Set by FK based on the individual's assessed needs
- Stored in Kalinga as **weekly approved hours** (Settings → FK Decision)
- Total across all assistants combined — not per assistant
- No FK-imposed cap on the total; it reflects assessed need

---

## Per-Assistant Hour Limits (Egna Arbetsgivare)

Kalinga users are **egna arbetsgivare** (direct employers with no agency). Their assistants are covered by **Lagen om arbetstid i husligt arbete (1970:943)**, not the standard Arbetstidslagen (ATL).

### Weekly Limits

| Type | Limit | Calculation period |
|------|-------|--------------------|
| Ordinary working hours | 40 h/week | — |
| Overtime (övertid) | Up to 12 h/week | Rolling 4-week period |
| **Maximum per assistant** | **~52 h/week** | 4-week average |
| Annual overtime cap | 300 h/year | Calendar year |

### Daily Rest (Dygnsvila)

- Minimum **11 consecutive hours** of rest within every 24-hour period
- Weekly rest: minimum **36 consecutive hours** per 7-day period

> ℹ️ Daily rest rules are not currently enforced in Kalinga v0.1 (shift-level data is available but rest-period calculations are out of scope). Flagged for v0.2.

### Overtime Rules

- Overtime is for genuinely exceptional circumstances — it cannot be routinely pre-scheduled
- Emergency overtime (nödfallsövertid) is accepted for unforeseeable events (accident, acute illness)
- FK has actively withheld payment for hours exceeding these limits since **2020**

---

## FK Enforcement (Since 2020)

FK tracks each individual assistant's reported hours on **form FK 3059** (tidsredovisning). If a single assistant's hours exceed the legal limit:

- FK withholds payment for the excess hours from **that assistant's reported time**
- The care recipient's total approved package is unaffected in principle
- The employer (guardian) is left paying assistant wages without reimbursement for the excess

---

## Kalinga Compliance Logic

### Block conditions (PDF generation blocked)
1. Any assistant's hours in a 4-week rolling period exceed **52 hours/week average**
2. Any assistant's annual overtime (hours above 40h/week) exceeds **300 hours**
3. Total logged hours across all assistants exceed the **weekly approved hours** (care package total) for the month

### Warning conditions (PDF generation allowed but warning shown)
1. Any assistant's weekly hours are between **40–52 h** (in overtime range)
2. Total monthly hours are approaching the care package limit

---

---

## FK 3057 — Räkning för Utförd Assistans

FK 3057 is the monthly invoice/claim submitted to FK to request payment for assistance performed. One form per care recipient per month, covering all assistants combined.

### What it covers

| Section | Fields | Notes |
|---------|--------|-------|
| Year/month | `flt_txtAr1–4`, `flt_txtMan1–2` | Same split-digit pattern as FK 3059 |
| Patient | `flt_txtFnamnEnamnBrukare`, `flt_txtPersonNrBrukare` | |
| Employer checkbox | `ksr_kryssrutaArbetsgivare` | Check = "I am the employer (egna arbetsgivare)" |
| LSS vs SFB | `rbListAssistansLSS` | Radio 1=LSS, 2=SFB/LASS — affects which law applies |
| Time totals | see below | Aktivtid, väntetid, beredskapstid each have separate h/min fields |
| Hospital deduction | `rbListSjukhus`, `flt_datFromSjukhus[0–2]`, `flt_datTomSjukhus[0–2]` | Up to 3 hospital periods; hours during hospitalisation are deducted by FK |
| Activity deductions | `ksr_Barnomsorg`, `ksr_Skola`, `ksr_DagligVerksamhet` | Check if patient was in childcare/school/daglig verksamhet during the period |
| Guardian type | `ksr_radioForvaltare`, `ksr_radioGodMan`, `ksr_radioVardnadshavare` | Tick one; affects legal authority context |
| Guardian identity | `flt_txtNamnfortydligande`, `flt_txtPersonNrStallforetradare` | Guardian name + PNO |
| Signature | `flt_txtNamnteckning`, `flt_datum`, `flt_txtTel` | |
| Page 2 — costs | `flt_numBelopp1–6`, `flt_numBelopp1a–6a` | SEK + öre for each cost line (hourly rate × hours per period); typically calculated by the employer using current FK schablonbelopp |
| Page 2 — repayment | `rbListBetalaTillbaka` | Radio 1=yes, 2=no; "do you owe FK money back?" — almost always no |

### Time total fields

| Type | Hours field | Minutes field |
|------|------------|---------------|
| Aktivtid (active) | `flt_numaktivtid_tim` | `flt_numaktivtid_min` |
| Väntetid (waiting) | `flt_numvantetid_tim` | `flt_numvantetid_min` |
| Beredskapstid (standby) | `flt_numberedskapstid_tim` | `flt_numberedskapstid_min` |

### Fields currently NOT filled by Kalinga (gaps)

- `flt_tid[0]` through `flt_tid6[0]` — 6 unlabelled time fields; purpose unclear without rendering the form. Likely sub-period rows (e.g. partial months if FK decision changed mid-month).
- Hospital deduction dates — Kalinga has no hospitalisation tracking
- Activity deduction checkboxes — Kalinga has no barnomsorg/skola/daglig verksamhet tracking
- Guardian PNO (`flt_txtPersonNrStallforetradare`) — not in Settings profile
- Guardian type checkboxes — not in Settings profile
- Page 2 cost amounts — FK schablonbelopp rate not stored; amounts not calculated

### FK Schablonbelopp

FK sets an hourly rate (schablonbelopp) each year used to calculate the payment claim on FK 3057 page 2. The guardian multiplies total approved hours by this rate to arrive at the claim amount. Rate changes annually; must be confirmed against the current FK decision letter.

---

## Sources

- [Försäkringskassan — Vara arbetsgivare för egna assistenter](https://www.forsakringskassan.se/privatperson/vuxen-med-funktionsnedsattning/assistansersattning/vara-arbetsgivare-for-egna-assistenter)
- [Försäkringskassan — Vägledning 2003:6 Assistansersättning](https://www.forsakringskassan.se/download/18.7b234aa517b3a0b7f372a5/1715781233879/assistansersattning-vagledning-2003-06.pdf)
- Lagen om arbetstid i husligt arbete (1970:943)
- Arbetstidslagen (ATL, SFS 1982:673)
