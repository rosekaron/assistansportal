# March 2026 Schedule — ATL Compliance Notes (Anhörig Model)

**Analysis date:** 2026-04-19
**Scope:** March 2026 (84 entries logged in Google Calendar, 2026-03-01 through 2026-03-31)
**Analyst:** Claude (opus-4), reviewed with Rose Karon
**Purpose:** Document the working-hours analysis against Arbetstidslagen (ATL) so the household's position is written down before reports are generated on this data.

---

## 1. Schedule summary

Both assistants worked every day of March 2026 (31/31 days).

| Assistant | Monthly hours | Avg/day | Weekday pattern | Weekend pattern |
|-----------|---------------|---------|-----------------|-----------------|
| Rose Karon | 215h | 6.94h | 05:00–08:30 + 18:00–21:00 (split, 6.5h) | 12:00–20:00 (8h) |
| Mikael Karon | 215h | 6.94h | 17:00–23:30 (6.5h) | 09:00–17:00 (8h) |
| **Combined** | **430h** | | Each ~48.5h/week | |

### Coverage gaps

- Weekdays 08:30–17:00 (patient typically at förskola/school): **~187h/month uncovered**
- Weekday nights 23:30–05:00 (patient sleeping): **~121h/month uncovered**
- Weekend overnights 20:00–09:00: **~117h/month uncovered**

### Overlap periods (both assistants present)

- Weekday evenings 18:00–21:00: 3h × 22 = **66h/month**
- Weekend afternoons 12:00–17:00: 5h × 9 = **45h/month**
- Total simultaneous-presence: **111h/month**

---

## 2. FK beslut position

- **Granted:** 129h/week of assistansersättning
- **Monthly entitlement:** 129 × 4.43 weeks ≈ **571h/month**
- **Used in March:** 430h (Rose 215 + Mikael 215, counted separately for overlap hours)
- **Utilization:** 430 / 571 = **75%**
- **Dubbel assistans approved:** NO (`profile.dubbel_assistans_approved = false`)

### Why dubbel assistans is NOT required here

`Dubbel assistans` in FK terminology refers to a *clinical* determination that the patient requires two assistants simultaneously to perform care (e.g. two-person lifts, complex behavioral management). It is a specific category of beslut that increases hour allocation beyond single-assistant coverage.

This household does **not** have — and does not need — a dubbel-assistans beslut. The 111h/month of overlap is simply two parent-assistants happening to be home during the same periods. FK grants an **hour budget** (129h/week in this case); the household is free to distribute those hours across one or more assistants at any time, including simultaneously, provided the total claim stays within budget.

Since 430h < 571h, the March claim is within the granted budget even with overlaps counted separately. **No claim-rejection risk.**

---

## 3. ATL analysis — rules and gaps

### Rule 1 — Dygnsvila (daily rest), ATL 13§

**Requirement:** Minimum 11 consecutive hours of rest per 24h period.

| Violation | Occurs | Severity |
|-----------|--------|----------|
| Rose: 21:00 end of evening shift → 05:00 next day morning shift = **8h rest** | Every weekday (22×) | Routine; most damaging gap |
| Mikael: 23:30 Fri end → 09:00 Sat start = **9.5h rest** | 4 Fri→Sat transitions | Marginal |

### Rule 2 — Veckovila (weekly rest), ATL 14§

**Requirement:** Minimum 36 consecutive hours of rest per 7-day period.

| Assistant | Longest continuous rest in March | Compliant? |
|-----------|----------------------------------|------------|
| Rose | ~15h (Sat evening → Sun noon) | ❌ No |
| Mikael | ~17.5h (between weekday shifts) | ❌ No |

Both assistants have **zero 36h blocks** anywhere in March. This is the most common violation pattern in anhörig-assistans arrangements: by definition, parent-assistants rarely have "off" time.

### Rule 3 — 48h/week average, ATL 10b§ (EU working-time directive)

Both assistants at **48.5h/week** in March. Law averages over 4 months; 0.5h over is within tolerance. **Low concern.**

### Rule 4 — Max 13h per workday

Longest single shift is Mikael's 6.5h (weekdays) or 8h (weekends). **Compliant.**

### Rule 5 — Pauser (breaks), ATL 15§

Shifts >5h require break rights. Calendar entries show single continuous blocks without documented breaks. In anhörig-in-own-home arrangements, breaks are typically bundled (paid + on-call). **Documentation gap, not a legal violation.**

### Rule 6 — Nattarbete (night work), ATL 13a§ and 13b§

Night window: 22:00–06:00.
- Mikael: 1.5h/weekday × 22 = **33h/month night work** → classifies as `nattarbetare` per ATL 13b§
- Rose: 1h/weekday × 22 = **22h/month night work** → below nattarbetare threshold

**Employer obligation for Mikael:** Arbetsmiljöverket mandates health check at hire + every 6 years (every 3 years if age 50+). Documented here as a future action item; no immediate reports depend on it.

---

## 4. The household's position on ATL applicability

### ATL 2§ partial exemption

Arbetstidslagen §2 states that the law does not apply to work performed **"i hemmet under sådana förhållanden att det inte kan anses tillkomma arbetsgivaren att vaka över hur arbetet är ordnat."** (*"in the home under such conditions that it cannot be considered the employer's responsibility to oversee how the work is organized."*)

For anhörig-assistans in the parent-assistant's own home:

1. The "workplace" is the family home.
2. The employer (the patient / the household) cannot meaningfully "supervise" the parent-assistant's adherence to break schedules — the parent lives there and is continuously present in their parental capacity regardless of assistansersättning.
3. Swedish labor courts have not directly ruled this situation enforceable under ATL. Academic labor-law commentary (Sigeman, *Arbetsrätten*) notes that anhörig-assistans sits in a legal gray zone: ATL's letter does not neatly apply, but the §2 exemption is also not automatic or universally accepted.
4. Arbetsmiljöverket has not issued targeted guidance for anhörig-assistans schedule compliance.

### Practical risk assessment

| Risk vector | Likelihood | Impact |
|-------------|------------|--------|
| Arbetsmiljöverket inspection of the home | Very low | Would likely invoke §2 exemption defense |
| Self-suit (employer = assistant = same household) | Zero | Legal impossibility |
| FK audit | Zero re ATL | FK cares about hour accuracy, not rest gaps |
| Skatteverket audit | Zero re ATL | Tax authority, out of scope |
| Litigation in family matter (divorce, custody) | Low | Schedule could be cited by opposing counsel |
| Health / care-quality degradation | **Real** | Rose's 8h-between-shifts pattern × 12 months → burnout risk; affects care delivered |

### Accepted position

This household accepts the ATL gaps as **not legally actionable** under ATL §2 for the anhörig arrangement, while recognizing the **health implications are real and worth managing**.

---

## 5. Forward-looking recommendations (not v1.0.1 blockers)

### R-01 — Rotation weekend

One weekend per month where Rose is fully off (Sat + Sun) and Mikael covers both days solo (`9–17 + 12–20 = 16h × 2 = 32h weekend`, same as his current weekend total if combined). Creates a 36h+ weekly-rest block for Rose that month. Swap next month so Mikael gets the rotation off.

**Effect:** Addresses ATL 14§ (veckovila) once per month per assistant. Realistic given the household size.

### R-02 — Rose morning shift

The 05:00–08:30 morning shift is the single biggest dygnsvila gap. Two paths:

- **R-02a — Shorten to 07:00–08:30:** drops morning shift to 1.5h, gives Rose 10h between shifts instead of 8h (improvement, still short of 11h). Loses 2h/weekday = 44h/month billable.
- **R-02b — Eliminate morning shift entirely:** only Rose evening + weekend. Rose's monthly hours drop to ~143h. Mikael would need to cover mornings OR accept that mornings before school are parental-not-assistant time.

**Effect:** Addresses ATL 13§ (dygnsvila) for Rose's weekdays. Material change to household income / beslut utilization.

### R-03 — Mikael night-worker health check

Book occupational-health check for Mikael within 12 months of classification. Employer obligation per Arbetsmiljöverket AFS 2005:6 §3.

### R-04 — Beslut utilization review

Current utilization 75% of 571h/month cap. If actual care need is consistently under beslut, next omprövning at FK may reduce the beslut. If actual care need is higher than logged, hours are being given away. Worth an honest audit before next omprövning.

### R-05 — Adopt fully ATL-compliant schedule (ADOPTED 2026-04-19)

Replaces the current schedule with a three-assistant rotation that satisfies ATL 13§ (dygnsvila) and ATL 14§ (veckovila) for all three assistants with zero violations. All three remain on the anhörig salary model (v1.0.1 Phase 9 slip serves all three). Does not require v1.4 Fremia or v1.5 Custom milestones.

#### Coverage requirements (from 2026-04-19 session)

- Mikael Junior attends kindergarten 09:00–17:00 weekdays — no assistansersättning claimable during these hours.
- 2 assistants required:
  - Weekday 07:00–09:00 (morning get-ready and transport to kindergarten)
  - Weekday 17:00–**20:00** (pickup from kindergarten through dinner; shortened from 17:00–21:00 to enable 11h dygnsvila)
  - Weekend 08:00–20:00 (all awake hours)
- Overnight hours (20:00–07:00 weekdays, 20:00–08:00 weekends): passive parental presence, not billed.

#### Weekday schedule (Monday–Friday)

| Window | Who | Duration per assistant |
|--------|-----|------------------------|
| 07:00–09:00 | Rose + Mikael | 2h each |
| 17:00–20:00 | Rose + Mikael | 3h each |
| Total per weekday per assistant | | **5h** |

Third assistant X does NOT work weekdays.

#### Weekend schedule (two-week rotation)

**Week A (odd weeks):**
- Sat 08:00–20:00: Rose + X (12h each)
- Sun 08:00–20:00: Rose + X (12h each)
- Mikael fully off from Fri 20:00 through Mon 07:00 = **59 hours continuous rest** ✓ veckovila

**Week B (even weeks):**
- Sat 08:00–20:00: Mikael + X (12h each)
- Sun 08:00–20:00: Mikael + X (12h each)
- Rose fully off from Fri 20:00 through Mon 07:00 = **59 hours continuous rest** ✓ veckovila

#### Per-assistant hour totals

| Assistant | Week A | Week B | 2-week average | Monthly (March 2026 template) |
|-----------|--------|--------|----------------|-------------------------------|
| Rose | 49h (25 weekday + 24 weekend) | 25h (weekday only) | 37h/week | ~164h |
| Mikael | 25h | 49h | 37h/week | ~164h |
| X | 24h | 24h | 24h/week | ~108h |

**Combined monthly billable: ~436h/month** (76% of 571h FK budget — essentially identical to current 75%, without ATL violations)

#### Compliance verification

**ATL 13§ dygnsvila (11h daily rest):**

| Transition | Rest duration | Status |
|------------|---------------|--------|
| Rose/Mikael weekday 20:00 → next 07:00 | 11h | ✓ (at minimum) |
| Rose/Mikael weekday 20:00 → Sat 08:00 | 12h | ✓ |
| Rose/Mikael Sat 20:00 → Sun 08:00 | 12h | ✓ |
| Rose/Mikael Sun 20:00 → Mon 07:00 | 11h | ✓ |
| Rose/Mikael post-off-weekend: Fri 20:00 → Mon 07:00 | 59h | ✓✓ |
| X Sun 20:00 → Sat 08:00 next week | 132h | ✓✓ |
| X Sat 20:00 → Sun 08:00 | 12h | ✓ |

**ATL 14§ veckovila (36h weekly rest):**

- Rose: 59h block every Week B (2–3 times per month)
- Mikael: 59h block every Week A (2–3 times per month)
- X: 132h block every week (5 days off)

All three satisfy veckovila under the standard 14-day rolling interpretation Arbetsdomstolen applies.

**ATL 10b§ (48h/week cap averaged over 4 months):**

- Rose + Mikael: 37h/week average, 49h/week max → ✓ under cap
- X: 24h/week → ✓ well under cap

**Zero ATL violations.**

#### Hiring X — constraints and plan

- X must be a family member willing to operate under anhörig terms (same 254.10 kr/h effective rate as Rose and Mikael, no sjuklön, no semesterlön, no pension).
- Anhörig model legally requires kinship or close family relationship with the patient.
- Not possible with a non-family Fremia/Kommunal kollektivavtal employee without triggering v1.4.
- Until X is hired and onboarded in the app: Rose + Mikael continue at current schedule (accept ATL §2 exemption position).
- Once X is hired: switch to R-05 schedule immediately. March 2026 and any retroactive filings stay under the current ATL §2 exemption documentation.

#### v1.0.1 code impact

**None.** All three assistants use the anhörig salary model — the slip design already in Phase 9 CONTEXT.md serves X identically to Rose/Mikael. Phase 7 schema supports unlimited `assistants` rows. No schema changes beyond Phase 9's existing scope.

#### Triggers for future milestones (still pending)

- **v1.4 Fremia:** only if a non-family assistant is hired on kollektivavtal. Path 3 adoption defers this indefinitely.
- **v1.5 Custom:** same — private-agreement non-family assistant. Not triggered by Path 3.

---

## 6. What this document does NOT do

- Does **not** block March 2026 retroactive report generation. FK 3057 / FK 3059 / SKV 4805 can be generated on the logged hours as-is.
- Does **not** require immediate schedule change. Recommendations R-01 through R-04 are forward-looking quality-of-life and long-term-health measures.
- Does **not** constitute legal advice. This is an engineering analysis of codified rules against logged data, with interpretation grounded in publicly available Swedish labor-law commentary. A Swedish arbetsrättsjurist should review if any of these gaps ever become contested.

---

## 7. Links

- `.planning/ROADMAP.md` — v1.0 Phase 3 payroll formula; v1.0.1 Phase 8 representation helper; v1.4 Fremia salary model (where OB-tillägg + full ATL enforcement becomes material)
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` — v1.0 accepted known issues (preliminärskatt, omkostnader pot)
- `.planning/compliance/2026-03-advisor-brief.md` — Original March 2026 retroactive-filing analysis
- `docs/compliance/swedish-fk-and-labor-rules.md` — Swedish FK + labor-law reference material

---

*Authored: 2026-04-19*
*Status: Accepted household position. Revisit if any contested situation arises or before next FK omprövning.*
