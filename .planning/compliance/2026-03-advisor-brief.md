---
period: 2026-03
status: pending_legal_review
created: 2026-04-18
by: Claude (v1.0 milestone close-out)
scope: March 2026 schedule imported from Google Calendar for retroactive FK/Skatteverket filing
recommendation: DO NOT FILE until kollektivavtal + FK beslut review is complete
---

# March 2026 — Compliance Brief for Legal / Kollektivavtal Advisor

## Purpose

Retroactive filing prep for March 2026 personal-assistance compliance (FK 3057, FK 3059, SKV 4805) was started automatically by importing 84 Google Calendar events into the internal schedule. During numeric validation, multiple issues were found that require human legal review before any submission is made.

**Current DB state** (as of 2026-04-18 after rollback):
- 84 March entries exist in `entries` table as **draft** (reqStatus=pending, repStatus=draft)
- **No** approved payroll records
- **No** PDFs generated
- **Nothing** has been submitted

## The schedule imported

| Assistant | Shifts | Total hours | Pattern |
|-----------|--------|-------------|---------|
| Rose Karon (pno 8011155069) | 53 | 215.0h | Weekdays: 05:00–08:30 (3.5h) + 18:00–21:00 (3h); Weekends: 12:00–20:00 (8h) |
| Mikael Karon (pno missing) | 31 | 215.0h | Weekdays: 17:00–23:30 (6.5h); Weekends: 09:00–17:00 (8h) |
| **Total** | **84** | **430.0h** | |

Daily total coverage on weekdays = 13h (3.5 + 3 + 6.5); weekends = 16h (8 + 8). Night hours 00:00–05:00 appear to be **uncovered** unless a third assistant is scheduled.

## Labor-law red flags (Arbetstidslagen SFS 1982:673)

### 1. Weekly hours exceed ordinarie arbetstid (§5 ATL) — both assistants

ATL §5 caps ordinarie arbetstid at **40h/week** averaged over a reference period.

| ISO week | Rose | Mikael | Limit | Excess |
|----------|------|--------|-------|--------|
| 2026-W10 (Mar 2–8) | 48.5h | 48.5h | 40h | +8.5h each |
| 2026-W11 (Mar 9–15) | 48.5h | 48.5h | 40h | +8.5h each |
| 2026-W12 (Mar 16–22) | 48.5h | 48.5h | 40h | +8.5h each |
| 2026-W13 (Mar 23–29) | 48.5h | 48.5h | 40h | +8.5h each |

Each assistant has **~34h of potential övertid** across March. ATL §8 allows up to 48h övertid / 4 weeks without special permit — so **within statutory limits** but only if classified as overtime with övertid compensation. If these hours are being paid at the regular hourly rate only, that is likely a wage violation under the applicable kollektivavtal (Fremia/Kommunal "Personlig assistans" or equivalent).

**Advisor to confirm:** Are these hours being paid as övertid (with corresponding övertidstillägg) or as ordinarie tid? What is the applicable kollektivavtal?

### 2. Dygnsvila violations (§13 ATL) — 48 instances in 31 days

ATL §13 requires **11h continuous rest** in every 24h period. Our data shows 48 cases where the rest between one shift end and the next shift start is less than 11h.

**Rose's daily pattern is structurally non-compliant:**
- 05:00–08:30 morning → 18:00–21:00 evening: rest = 9.5h
- 18:00–21:00 evening → next-day 05:00 morning: rest = 8h

Both gaps violate §13 as written. Either:
- (a) The split-shift schedule needs to change (e.g. consolidate into one daily block), or
- (b) A kollektivavtal exception covers this pattern and ensures compensatory rest

**Mikael's pattern violates on weekend transitions:**
- Fri 17:00–23:30 → Sat 09:00–17:00: rest = 9.5h
- Every weekend of March shows this gap (Mar 6→7, 13→14, 20→21, 27→28)

**Advisor to confirm:** Is there a kollektivavtal exception for personal-assistance shift patterns? Has the compensatory rest (sammanhängande ledighet) actually been taken?

### 3. Night work (§13a ATL)

Neither assistant crosses the 3h night-work threshold (22:00–06:00) with enough consistency to trigger "nattarbetare" classification, but:
- Mikael's weekday 17:00–23:30 includes 1.5h night work (22:00–23:30)
- 00:00–05:00 appears **uncovered** — if the care recipient requires 24h assistance, who is present?

**Advisor to confirm:** Is overnight coverage (00:00–05:00) part of the FK beslut? If yes, who is actually providing it? If it's unpaid-family-time, the FK hours claimed may be less than entitlement.

### 4. Veckovila (§14 ATL)

ATL §14 requires **36h continuous rest per 7 days**. Rose's pattern has no full 36h break in any week — longest gap is 18:00 Sun → 05:00 Mon = 35h (fails by 1h) every week. This is a systematic violation.

**Advisor to confirm:** Whether the assistant has actually taken weekly rest outside the recorded schedule (annan veckovila).

## FK (Försäkringskassan) red flags

### Blocking: filings will be rejected

| Required field | Value | Status |
|----------------|-------|--------|
| Patient/brukare personnummer | `000000-0000` | ❌ placeholder |
| Patient/brukare name | `TBD Patient Name` | ❌ placeholder |
| Guardian (vårdnadshavare) name | `TBD Guardian Name` | ❌ placeholder |
| FK beslutsnummer | `TBD-FK-DECISION` | ❌ placeholder |
| FK hourly rate (assistansersättning schablon 2026) | 334 SEK | ✓ |
| Rose pno | `8011155069` | ✓ valid format |
| Mikael pno | `000000-0000` | ❌ placeholder |
| Rose address | `TBD` | ❌ placeholder |
| Mikael address | `TBD` | ❌ placeholder |

### Non-blocking: items to verify against FK decision

- **Entitled hours per day:** Do the 13h weekday / 16h weekend totals match what FK's decision approves? If FK approves e.g. 16h/day every day, the weekday 13h leaves 3h unclaimed (possibly correct if the remainder is egenvård/unpaid). If FK approves only 10h/day, weekday filing would be over-claiming.
- **Anhörigassistans restrictions:** If Rose is guardian AND assistant (same household), "anhörig-assistent"-specific rules may cap her hours or require separate paperwork.
- **Double-coverage:** Weekday evening has Rose 18:00–21:00 + Mikael 17:00–23:30 overlapping 18:00–21:00 (3h). FK generally pays for **one** assistant in a given slot unless "dubbel-assistans" is explicitly decided. 12h × 5 days = **60h of potential dubbel-assistans** across March that may not be covered by FK beslut.

**Advisor to confirm:** Is dubbel-assistans approved by FK? For which hours?

## Skatteverket (SKV 4805) red flags

### Blocking

- **Employer identification:** For personal assistance paid via FK to brukare, the brukare is the legal employer. With `patient_pno = 000000-0000`, no 4805 can be filed.
- **Mikael pno missing:** One of the two 4805 forms cannot be generated.

### Numeric calculations (derived if data were valid)

Per-assistant, per-month (flat across both because identical hours/rates):
- Billable hours: 215
- Gross pay (bruttolön): 54,641.61 SEK
  (Formula: (215 × 334 − costs) / 1.3142 — matches Phase 4 corrected formula)
- Employer contributions (arbetsgivaravgifter 31.42%): 17,168.39 SEK
- Total employer cost: 71,810.00 SEK
- Preliminary tax withheld (30% flat): 16,392.48 SEK
- Net to assistant: 38,249.13 SEK

**Advisor to confirm:**
- Preliminary tax is set to a flat 30%. Each assistant should have their own skattetabell (A-skatt). Is 30% a reasonable schablon or should we use each person's actual skattetabell?
- Rose's A-skatt / F-skatt status — is she actually on A-skatt via her employer (brukare) for this role?

## Other process issues

- **Timesheet signatures:** FK 3059 requires each assistant's physical signature on the month's timesheet. Our system generates a pre-filled PDF; actual signing is manual. Not a software issue but flagged for completeness.
- **Paper submission:** FK 3057/3059 cannot be e-filed; submitted by post. AGI/4805 is filed electronically via Skatteverket's e-service. Different submission channels; advisor should ensure both are covered.
- **Calendar as source of truth:** These 84 shifts were imported from Google Calendar. If the calendar contains any non-shift events that happened to match `Assistance: {Name}` / `Shift: {Name}` pattern, they would have been imported (none observed in this run — all 84 matched the expected pattern).

## Recommendation

**Do not proceed with filing until:**

1. A labor-law / kollektivavtal advisor reviews the dygnsvila and veckovila violations and confirms whether:
   - The schedule needs operational change going forward
   - The March hours can be filed as-is with appropriate compensatory-rest documentation
   - Övertid classification + pay is applied retroactively
2. Real personnummer, addresses, and FK beslutsnummer are entered in Settings
3. FK beslut is consulted to confirm:
   - Total daily entitlement matches the 13h/16h coverage
   - Dubbel-assistans is covered for the overlapping weekday evening hours
   - Anhörigassistans rules (if applicable to Rose) are followed
4. Preliminary tax rate for each assistant is confirmed against their individual skattetabell

## Data preservation

- All 84 March entries remain in the database with `repStatus=draft` so they are **visible for review** in Monthly UI but **not billable** — no PDFs will generate, payroll calc returns 0h.
- Raw Google Calendar events remain unchanged.
- This brief + the todo referenced below is the handoff document.

## Files that generated this data

- Import script: ran via preview browser eval against `POST /api/entries`
- Gross / contributions / net formulas: `server/src/lib/payroll-utils.ts` → `calculatePayroll()`
- FK 3057 layout: `server/src/routes/pdf.ts:237`
- FK 3059 layout: `server/src/routes/pdf.ts:67`
- SKV 4805 field mapping: `server/src/lib/form4805-utils.ts`
- Entry → billable filter: `server/src/lib/filterBillableEntries.ts` (used by all three PDFs)

*Prepared automatically from verifiable data. Any legal/regulatory interpretation is the advisor's to make — this document surfaces what the numbers say, not what they should say.*
