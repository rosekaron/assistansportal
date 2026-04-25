# Swedish Payroll Rates & Regulations 2026

**Updated:** 2026-04-06
**Source:** Skatteverket (Swedish Tax Agency) official announcements
**Applies to:** Personal assistance (assistansersättning) employers under LSS

---

## Arbetsgivaravgifter (Employer Social Security Contributions)

### Standard Rates (2026)

| Salary Range | Rate | Notes |
|--------------|------|-------|
| **0 – 25,000 SEK/month** | 20.81% | Half of employer contribution (reduced rate) |
| **> 25,000 SEK/month** | 31.42% | Full employer contribution (standard rate) |

### Two-Tier Calculation

For a salary of **30,000 SEK**:
- First 25,000 SEK × 20.81% = 5,202.50 SEK
- Remaining 5,000 SEK × 31.42% = 1,571.00 SEK
- **Total arbetsgivaravgifter: 6,773.50 SEK**

### Special Cases

#### Age > 67 Years
- Only **pension contribution (10.21%)** is required
- Other contributions are waived
- Implementation: Deferred to Phase 2+ if needed

#### Youth Reduction (April 1 – September 30, 2026)
- Temporary reduction for employees aged 19–23
- Maximum ~2,700 SEK/month per employee
- Implementation: Deferred to Phase 2+ if applicable

#### Redundant Employment
- If employee has multiple jobs, each employer pays full contribution on their portion
- Not directly relevant to personal assistance (single employer per assistant typically)

---

## Components of Arbetsgivaravgifter

| Component | Rate | Purpose |
|-----------|------|---------|
| **Pension (Ålderspension)** | 10.21% | Mandatory pension contribution |
| **Other contributions** (half) | 10.60% | Social insurance, half rate for <25k |
| **Other contributions** (full) | 21.21% | Social insurance, full rate for >25k |

---

## Income Taxes & Preliminary Withholding

### Preliminärskatt (Preliminary Tax Withholding)

Employers may be required to withhold preliminary tax on employee salaries. For personal assistance sector:
- **Standard rate: ~10-15%** of gross salary (varies by individual)
- Amounts withheld are credited against employee's annual tax return
- Guardian is responsible for remitting to Skatteverket monthly

**Implementation in Assistansportal:**
- Track tax withheld per assistant in `assistant_earnings.taxWithheld`
- Include in AGI export to Skatteverket
- Display to guardian in payroll summary for transparency

### State Income Tax (Statlig inkomstskatt)

- **Rate: 20%** on annual income > 643,100 SEK (2026 threshold)
- Applied on top of municipal income tax
- **Not calculated by Assistansportal** (falls below threshold for typical assistants)

---

## Monthly Filing Requirements

### AGI (Arbetsgivardeklaration på individnivå)

| Requirement | Details |
|-------------|---------|
| **Filing Deadline** | 10th of following month |
| **Format** | XML (version 2.0 as of Jan 2025) |
| **Submission Method** | E-filing via Skatteverket portal (physical signature still required) |
| **Included Fields** | Employee ID, gross salary, tax withheld, absences (new 2025) |

### Absence Reporting (NEW — January 2025)

AGI export now includes detailed absence information per employee:

| Absence Type | Swedish Code | Notes |
|--------------|--------------|-------|
| **Sick Leave** | `sjuk` | Doctor's certificate often required for >3 days |
| **Parental Care (VAB)** | `vab` | Vård av barn — parent staying home with sick child |
| **Holiday/Vacation** | `semester` | Paid vacation days |
| **Unpaid Leave** | `tjänstledigt` | Temporary unpaid leave (e.g., further education) |
| **Other** | `övrig` | Sabbatical, religious observance, etc. |

**Format in AGI XML:**
```xml
<Frånvaro>
  <FrånvaroTyp>sjuk</FrånvaroTyp>
  <StartDatum>2026-04-01</StartDatum>
  <SlutDatum>2026-04-03</SlutDatum>
  <AntalTimmar>24</AntalTimmar>  <!-- OR -->
  <ProcentsatsArbetsTid>100</ProcentsatsArbetsTid>  <!-- Percent of work time -->
</Frånvaro>
```

---

## Vacation & Leave Entitlements

### Mandatory Vacation (Semester)

| Category | Days/Year | Swedish Name |
|----------|-----------|--------------|
| **Minimum** | 25 calendar days | Lagstadgad semester |
| **Typical** | 25–30 days | Depending on collective agreement |

**For personal assistance:**
- Assistants are entitled to 25 vacation days/year minimum
- Assistansportal should track vacation balance
- Vacation is paid (at regular hourly rate, typically)

### Parental Leave (VAB)

- Up to **10 days/year** per child (age 0–12)
- Paid by employer (or via Försäkringskassan if employer qualifies)
- Must be reported as `vab` in AGI

### Sick Leave (Sjukfrånvaro)

- First **14 days**: Employer responsible (pay sick benefit)
- Days 15+: Försäkringskassan (social insurance) pays
- Paid at **80% of regular salary** (employer pays the 80%)
- Must be reported in AGI

---

## FK (Försäkringskassan) Forms

### FK 3059 — Arbetsgivarblanketten (Monthly Time Report)

| Field | Content | Notes |
|-------|---------|-------|
| **Period** | Month dates | Must use correct month-end date (not hardcoded day 31) |
| **Employee Name & ID** | Assistant's name + personnummer | Must be exact match to FK records |
| **Hours Worked** | Total billable hours | Exclude absences (sick, VAB, holiday) |
| **Rate** | Hourly rate in SEK | Configured by guardian |
| **Employer Signature** | Guardian's digital/physical signature | Physical signature required per current regulations |

**Data Source in Assistansportal:**
- Hours: `entries` table (approved entries minus absences)
- Absences: `absences` table (use to filter out non-billable hours)
- Rate: `profiles.hourlyRate` (guardian setting)

### FK 3057 — Försäkringskassans Arbetsgivarrapport (Employer Activity Report)

| Field | Content |
|-------|---------|
| **Reporting Period** | Month |
| **Employees** | List of all active assistants |
| **Changes** | New hires, terminations, rate changes |
| **Certification** | Guardian's signature |

---

## Compliance Checklist for Assistansportal

- [ ] **Payroll Rates** — Hard-code 2026 rates (31.42% / 20.81% threshold 25k SEK)
- [ ] **Two-Tier Calculation** — Correctly apply reduced rate to first 25k, standard to remainder
- [ ] **Month-End Dates** — Use actual last day of month (Feb 28/29, not hardcoded 31)
- [ ] **Absence Exclusion** — Don't count sick leave, VAB, holiday as billable hours in FK reports
- [ ] **AGI Export** — Include absences in XML (new 2025 requirement)
- [ ] **Tax Withholding** — Track preliminary tax per assistant; remit to Skatteverket monthly
- [ ] **Vacation Balance** — Maintain running balance (25 days/year entitlement)
- [ ] **Audit Trail** — Log who calculated payroll, when, and what rates were applied

---

## Documentation & References

### For Guardians (in-app help text)

```
Arbetsgivaravgifter är sociala avgifter som arbetsgivaren betalar för
varje anställd. År 2026:
- 20,81% på lönen upp till 25 000 kr/månad
- 31,42% på lönen över 25 000 kr/månad

Exempel: Om assistanten tjänar 30 000 kr:
- Första 25 000 kr × 20,81% = 5 202,50 kr
- Resterande 5 000 kr × 31,42% = 1 571 kr
- Total arbetsgivaravgift: 6 773,50 kr

Total kostnad för arbetsgivaren = lön + arbetsgivaravgift
```

### For Code Comments

```typescript
/**
 * 2026 Arbetsgivaravgifter (Swedish employer contributions)
 * Source: Skatteverket official announcement
 *
 * Two-tier system:
 * - 20.81% on salary up to 25,000 SEK/month (reduced rate)
 * - 31.42% on salary above 25,000 SEK/month (standard rate)
 *
 * Example: Salary 30,000 SEK
 * - Reduced: 25,000 × 0.2081 = 5,202.50 SEK
 * - Standard: 5,000 × 0.3142 = 1,571.00 SEK
 * - Total: 6,773.50 SEK
 */
```

---

## Version History

| Date | Version | Changes | Source |
|------|---------|---------|--------|
| 2026-04-06 | 1.0 | Initial 2026 rates | Skatteverket official |
| 2025-01-01 | — | AGI schema v2.0 (absences added) | Skatteverket announcement |
| 2026-04-01 | — | Temporary youth reduction (19–23 years) | Skatteverket policy |

---

## When to Update This Document

- **Quarterly:** Check Skatteverket announcements for mid-year policy changes
- **Annually (Jan 1):** Verify rates for next year; update all hard-coded values
- **On Legislation Change:** Monitor Swedish government official gazette (Regeringskansliet)

---

## Related Documentation

- `.planning/research/STACK.md` — Technology recommendations
- `.planning/research/PAYROLL_AGI_TECHNICAL_SPEC.md` — Implementation details
- `PROJECT.md` — Overall project scope and constraints

---

*Compliance reference: 2026-04-06*
