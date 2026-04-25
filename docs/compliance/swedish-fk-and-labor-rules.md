# Swedish FK Assistansersättning + Labor Law — Reference

**Status:** Living reference. Maintained because the same rules keep coming up mid-implementation.
**Last research pass:** 2026-04-18
**Primary audience:** Humans and LLMs working on the Kalinga Assistansportal. Read this **before** making schema decisions, scheduling logic, payroll calculations, or compliance UI copy.

> **When you touch anything that encodes an assistance-hour limit, a shift constraint, a semester entitlement, a sjuklön rule, or a "what does FK expect from us" behavior — verify it against this doc first. If the doc is wrong or outdated, fix the doc in the same PR as the code change. That's the deal.**

---

## Table of Contents

1. [Quick reference — what most questions reduce to](#1-quick-reference--what-most-questions-reduce-to)
2. [How FK beslut hours work](#2-how-fk-beslut-hours-work)
3. [Labor law — Arbetstidslagen (ATL, SFS 1982:673)](#3-labor-law--arbetstidslagen-atl-sfs-1982673)
4. [Husligt arbete — the anhörig carve-out (Lag 1970:943)](#4-husligt-arbete--the-anhörig-carve-out-lag-1970943)
5. [Kollektivavtal context (Fremia–Kommunal, Bransch G)](#5-kollektivavtal-context-fremiakommunal-bransch-g)
6. [Anhörigassistans — specific rules](#6-anhörigassistans--specific-rules)
7. [What this means for Kalinga (practical implications)](#7-what-this-means-for-kalinga-practical-implications)
8. [Open questions / known gaps](#8-open-questions--known-gaps)
9. [Sources](#9-sources)
10. [Changelog](#10-changelog)

---

## 1. Quick reference — what most questions reduce to

| Question | Short answer |
|---|---|
| What unit does FK state hours in? | **Per week.** (51 kap 9§ SFB allows per-månad or longer up to 6 months, but per-week is the norm.) |
| Is there a per-day cap on FK beslut hours? | **No.** FK caps weekly total. Daily distribution is fully flexible (30h Mon, 0h Sun is legal). |
| Who sets daily/shift caps then? | **Labor law** (ATL or Lag 1970:943) — applied to the *assistant*, not the brukare. |
| Does ATL apply to Kalinga's assistants? | **Partially.** Anhöriga living in household = Lag 1970:943 (husligt arbete); others = ATL. See §4/§6. |
| Do unused FK hours carry over? | **No.** They lapse at end of beslutperiod; unused ersättning is repaid at slutavräkning. |
| Does FK pay retroactively for overuse? | **No.** FK pays only up to beviljat tak per period. |
| When are FK 3057 / FK 3059 due? | 5th of the 2nd month after work month (e.g., Jan → due March 5). |
| Is dubbel-assistans a separate pool? | **Yes.** Explicitly granted in beslut as a separate hour allotment. |
| Does Kalinga's family (Rose/Mikael) operate under a kollektivavtal? | **No.** Anhörigassistans, egen arbetsgivare, no kollektivavtal. Only statutory floors apply. |

**Takeaway for Kalinga's current setup:** Rose + Mikael are anhöriga living in hushållsgemenskap with the brukare (a minor child). That means **Lag 1970:943** governs working-time, not ATL. Effective cap: 48h/week average over 4 weeks, no dygnsvila/veckovila floor from ATL, no OB-tillägg, no semesterlön beyond statutory 12%, no tjänstepension.

---

## 2. How FK beslut hours work

### 2.1 Grant granularity

Försäkringskassan decisions are issued under **51 kap 9§ socialförsäkringsbalken (SFB, SFS 2010:110)**:

> "Assistansersättning lämnas för ett visst antal timmar per vecka, månad eller längre tid, dock längst sex månader, när den försäkrade har behov av personlig assistans för sin dagliga livsföring (beviljade assistanstimmar)."

In practice: **hours are stated per week** on the beslut. Monthly/longer formats are legal but rarely used. (Confirmed by FK's own [Vägledning 2003:6](https://www.forsakringskassan.se/download/18.7b234aa517b3a0b7f372a5/1715781233879/assistansersattning-vagledning-2003-06.pdf).)

### 2.2 Daily cap — there isn't one (from FK)

The beslut itself sets no per-day maximum. The brukare may consume a week's hours on a single day if they wanted. **Daily caps come from labor law applied to the assistant, not from the FK beslut.**

The FK beslut sometimes adds:
- **Dubbel-assistans timmar** — a separate pool for activities requiring two assistants simultaneously (lifting, bathing, transit).
- **Jourtid** — hours granted as on-call/sleeping time rather than aktiv tid.
- **Beredskap** — on-call from home (rare for personlig assistans).

### 2.3 Distribution flexibility

Legally flexible. Vägledning 2003:6 is explicit that FK does not investigate daily distribution. 30h Monday + 0h Sunday is compliant. Self-determination principle (LSS §§ 6–7 "goda levnadsvillkor") is the legal anchor.

### 2.4 Unused hours lapse (and must be repaid)

FK pays schablonbelopp (**340,50 kr/h in 2026**) per **utförd** timme, not per beviljad timme. After each beslutperiod (or every 6 months for **egen arbetsgivare**), a **slutavräkning** reconciles utförda vs utbetalda timmar. Ersättning for hours not used must be repaid. Unused hours cannot carry between beslutperioder. ([SOU 2007:73](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/statens-offentliga-utredningar/kostnader-for-personlig-assistans-skarpta-regler_gvb373/html/), [Prop. 2007/08:61](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/proposition/kostnader-for-personlig-assistans_gv0361/html/))

### 2.5 Overuse — no retroactive approval

If a week consumes more hours than beviljat, FK will not pay for the excess. There is no retroactive approval path in 51 kap SFB. Remedy: **ansökan om utökning** for the go-forward period (which assesses the incremental need; existing decision is not reduced by such an application — [Skriftlig fråga 2021/22:537](https://riksdagen.se/sv/dokument-och-lagar/dokument/skriftlig-fraga/assistansersattning--vasentligt-forandrade_H911537)).

**Nuance:** A single-week spike may wash out at slutavräkning because accounting is against the **period total**, not per-week. So if you overuse 5h one week and underuse 5h a later week within the same period, the total is unchanged. (Verify against Vägledning 2003:6 ch. 8–9 before citing authoritatively.)

### 2.6 Decision period + renewal

- Historically: 51 kap 12§ required **omprövning every 2 years**. Repealed 2018 via [Prop. 2017/18:78](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/proposition/vissa-forslag-om-personlig-assistans_H50378/html/).
- Current: FK may only revisit rätten when "väsentligt ändrade förhållanden … hänförliga till den försäkrade" occur. Beslut typically run indefinitely or 1–4 years.
- Renewal triggers: (a) ändrade förhållanden, (b) brukare's own ansökan om utökning, (c) turning 65 (limited review).

### 2.7 Reporting — FK 3057 and FK 3059

- **FK 3057 "Räkning assistansersättning"** — monthly invoice. Total utförda timmar for the month, split into aktiv tid / väntetid / beredskap, plus ersättningsberättigade kostnader. Signed by brukare or ställföreträdare.
- **FK 3059 "Tidsredovisning"** — per-assistant time report for the same month. One rad per day per assistent, with start/stop times and category (aktiv / jour / beredskap / dubbel).

**Deadline:** Both must be at FK by the **5th of the 2nd month after the utförandemånad**. Example: January → due March 5. (Efterskottsbetalning, införd 1 oktober 2016.)

### 2.8 Dubbel-assistans

Separate hour pool in the beslut. Reported in FK 3059 as two assistent-rader covering the same klocktid. FK reimburses both rader. Since HFD 2009 ([Regeringsrättsdom 2010](https://assistanskoll.se/20100701-Regeringsrattsdom-dubbelassistans-ska-raknas-grundlaggande-behov.html)), dubbel-assistans for grundläggande behov also counts toward the 20-timmar-gränsen in 51 kap 3§ SFB.

---

## 3. Labor law — Arbetstidslagen (ATL, SFS 1982:673)

Applies to employees unless the relationship falls under the husligt-arbete carve-out (§4) or kollektivavtal replaces it (§3).

Primary source: [Arbetstidslag (1982:673) — riksdagen.se](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arbetstidslag-1982673_sfs-1982-673/).

### 3.1 §5 — Ordinarie arbetstid

> "Den ordinarie arbetstiden får uppgå till högst 40 timmar i veckan. När det behövs … får arbetstiden uppgå till 40 timmar i veckan i genomsnitt för en tid av högst fyra veckor."

**40h/week ordinary, averageable over 4 weeks.** Kollektivavtal can replace via §3. EU Working Time Directive is the non-derogable floor.

### 3.2 §6 — Jourtid (on-call at workplace)

> "… jourtid får tas ut med högst 48 timmar per arbetstagare under en tid av fyra veckor eller 50 timmar under en kalendermånad. Som jourtid anses inte tid då arbetstagaren utför arbete …"

**Jourtid = present but not actively working** (typical sovande jour for nattassistans). Cap: **48h/4-week OR 50h/month**. The moment the assistant works (responds to a need), minutes become ordinary arbetstid.

### 3.3 §7–§8 — Övertid

- **§7 (allmän övertid)**: max 200h/year, 50h/month, 48h/4-week.
- **§8 (extra övertid)**: +150h/year when särskilda skäl. Allmän + extra jointly capped at 48h/4-week or 50h/month.

No Arbetsmiljöverket pre-approval needed for allmän övertid.

### 3.4 §10 — Mertid för deltidsanställda

**Not §8a** (which doesn't exist — paragraphs re-numbered 2005). Mertid: 200h/year allmän + 150h/year extra, same joint caps.

### 3.5 §13 — Dygnsvila (DAILY REST) ⭐ critical for scheduling

> "Alla arbetstagare skall ha minst elva timmars sammanhängande ledighet under varje period om tjugofyra timmar (dygnsvila). I dygnsvilan skall ingå tiden mellan midnatt och klockan 5."

**11 consecutive hours per 24h period, including 00:00–05:00.**

Practical effect: an assistant ending a shift at 22:00 cannot legally start the next shift before 09:00 (without kompensationsledighet and särskilda omständigheter).

**Important 2026 update:** Kommunal + Fremia agreed **new dygnsvila rules effective 1 Jan 2026** that close previous kollektivavtal carve-outs. ([Kommunal nyhet](https://www.kommunal.se/nyhet/nya-dygnsviloregler-pa-kommunals-kollektivavtal-med-fremia))

### 3.6 §14 — Veckovila (WEEKLY REST) ⭐ critical for scheduling

> "Arbetstagarna skall ha minst trettiosex timmars sammanhängande ledighet under varje period om sju dagar (veckovila)."

**36 consecutive hours per 7-day period.** Beredskap does NOT count. Veckovila "så långt möjligt" placed on weekend.

### 3.7 §12 — Besked om förläggning (2-week notice)

> "… besked om ändringar i fråga om den ordinarie arbetstidens och jourtidens förläggning minst två veckor i förväg. Sådant besked får dock lämnas kortare tid i förväg, om verksamhetens art eller händelser som inte har kunnat förutses ger anledning till det."

**Schedule changes need 2 weeks' notice** — with acute-need exception. PA-sector kollektivavtal routinely invoke "verksamhetens art" for shorter notice.

### 3.8 §15 / §17 — Raster and pauser

**§15:** no arbetstagare works more than **5 consecutive hours** without a rast (unpaid break). ATL sets no minimum length; Arbetsmiljöverket guidance = 30 min.

**§17:** shorter paid pauses as needed.

**In PA context:** rast typically becomes paid måltidsuppehåll because the assistant can't leave the brukare.

### 3.9 §4 — Personlig assistans carve-outs

ATL §4 lists categories where ATL does not apply, including:
- **Arbete i arbetsgivarens hushåll** → governed by **Lag 1970:943 om arbetstid m.m. i husligt arbete** instead.
- **Personlig assistans åt någon i arbetsgivarens hushåll** (close relatives living with the brukare).

This is **the** critical carve-out for Kalinga. See §4 below.

### 3.10 §3 — Kollektivavtal dispensation

A centralt kollektivavtal (or a local avtal inom ramen för ett centralt) can replace ATL entirely or deviate from §§5–7, 8a, 9, 10a, 12–14, 15 3st, 16b, 19–22. EU Working Time Directive 2003/88/EC sets the non-derogable floor:

- 11h dygnsvila
- 24h veckovila (over 14-day reference)
- 48h/week max snittarbetstid inkl. övertid
- 4-week ref. period for averaging
- Paid annual leave

---

## 4. Husligt arbete — the anhörig carve-out (Lag 1970:943)

**This is the single most important rule for Kalinga's current user base.**

When the assistant:
1. Is a close relative (parent, spouse, adult child, etc.) of the brukare, AND
2. **Lives in hushållsgemenskap** (shared household) with the brukare,

then **[Lag (1970:943) om arbetstid m.m. i husligt arbete](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1970943-om-arbetstid-mm-i-husligt-arbete_sfs-1970-943/)** applies, **not** ATL.

### 4.1 What Lag 1970:943 requires

- **Max arbetstid: i genomsnitt 48 timmar/vecka** beräknat över fyra veckor.
- **No mandatory ATL-style 11h dygnsvila** — the strict dygnsvila rule doesn't apply.
- **No mandatory ATL-style 36h veckovila** — the veckovila rule doesn't apply.
- **Raster** still required (practical health obligation).
- **Semesterlag + Sjuklönelag + LAS** still apply in full (those are separate laws).

**Practical effect:** A parent working anhörigassistans for their own child can legally work 48h/week averaged over 4 weeks (so, e.g., 60h one week and 36h the next). They can legally work back-to-back 24h shifts if they want to, in a way ATL would forbid.

### 4.2 When the carve-out does NOT apply

- If the anhörig **does not live** with the brukare → ATL applies.
- If the brukare employs a kollektivavtal-covered anordnare → the kollektivavtal's rules apply (which are usually stricter than Lag 1970:943 anyway).
- If the assistant is not a close relative → ATL applies.

### 4.3 Hushållsgemenskap test

Not defined in statute, but FK/IVO interpret it as *actually sharing the household*, not just "related by blood". A parent living separately from their adult disabled child isn't in hushållsgemenskap.

### 4.4 FK disallowance risk

Since ~2020, **FK will not reimburse hours worked in breach of applicable working-time law** (ATL or Lag 1970:943) and can issue **återkrav** for previously paid amounts. ([New Life Assistans](https://newlife.se/2021/03/03/fakta-om-arbetstidslagen-i-personlig-assistans/), [HFD 2025](https://www.domstol.se/hogsta-forvaltningsdomstolen/nyheter/2025/02/domar-i-mal-om-assistansersattning/))

---

## 5. Kollektivavtal context (Fremia–Kommunal, Bransch G)

**Short version: Kalinga's current users have no kollektivavtal. This section is for future-proofing v1.4 (Fremia model) and v1.5 (custom).**

### 5.1 Which agreements cover personlig assistans

- **Fremia–Kommunal "Personlig assistans"** — 2025-11-01 to 2027-10-31. Covers the majority of anordnare. Replaces older KFO-avtal after the Fremia merger. ([fremia.se](https://www.fremia.se/kollektivavtal/personlig-assistans/))
- **Almega Vårdföretagarna Bransch G "Personlig assistans"** — 2025-10-01 to 2027-09-30. ([vardforetagarna.se](https://www.vardforetagarna.se/aktiviteter/nytt-avtal-vardforetagarna-bransch-personlig-assistans-g/))

### 5.2 Key figures (Fremia–Kommunal 2026)

| Component | 2026 value | Source |
|---|---|---|
| Min grundlön | 24 057 kr/mån (139,87 kr/h) | [Kommunal avtal 2025](https://www.kommunal.se/nyhet/avtal-klart-2025-fremia-personlig-assistans) |
| OB kväll | 25,68 kr/h | idem |
| OB natt | 51,79 kr/h | idem |
| OB helg | 63,91 kr/h | idem |
| OB storhelg | 128,02 kr/h | idem |
| Semesterlön timavlönad | 13% av timlön | Fremia-avtal PDF |
| Semesterdagar (trappa) | 25 → 31 | idem |
| Sjuklön dag 1–14 | 80% (lagstadgad) | Sjuklönelag 1991:1047 |
| Tjänstepension GTP | 4,5% / 30% above 7,5 IBB | [Pensionsvalet GTP](https://www.pensionsvalet.se/arbetsgivare/avtal/gtp/) |
| Dygnsvila (från 2026-01-01) | 11h (EU-direktivet, strikt) | [Kommunal nyhet](https://www.kommunal.se/nyhet/nya-dygnsviloregler-pa-kommunals-kollektivavtal-med-fremia) |

### 5.3 Shift-length rules under Fremia 2026

- **Standard pass: up to 13h** (no derogation needed).
- **Dygnspass 20–24h**: allowed only when the pass consists of both arbete and jour. Jour minst 5h, placed 22:00–08:00. Efterföljande vila måste minst motsvara passets längd.
- **Kompensationsvila** required if dygnsvila kortas till minimum 9h.

### 5.4 Lagens floor when no kollektivavtal applies

| Element | Rule |
|---|---|
| Ordinarie arbetstid | 40h/week (ATL §5) OR 48h/week avg (Lag 1970:943 if husligt arbete) |
| Övertid | 200h/year allmän + 150h/year extra (ATL §§7–8) |
| Dygnsvila | 11h (ATL §13) / not applicable under Lag 1970:943 |
| Veckovila | 36h (ATL §14) / not applicable under Lag 1970:943 |
| Semesterdagar | 25 (Semesterlag 1977:480) |
| Semesterlön rörlig lön | 12% av intjänad lön (lagstadgad) |
| Sjuklön dag 1–14 | 80%, karensavdrag 20% av veckosjuklön (Sjuklönelag) |
| OB | **None** (no statutory OB in Sweden) |
| Tjänstepension | **None** (no statutory occupational pension) |
| Minimilön | **None** (no statutory minimum wage in Sweden) |
| LAS | Uppsägningstid min 1 månad; sakliga skäl krävs |

---

## 6. Anhörigassistans — specific rules

### 6.1 No legal definition of "anhörig"

LSS (1993:387) and SFB kap 51 do not restrict who may act as assistant. LSS 9§ p. 2 simply grants "biträde av personlig assistent". In practice the relevant category for husligt-arbete purposes is those **living in hushållsgemenskap** with the brukare.

### 6.2 No LSS/SFB cap on anhörig hours or percentage

There is **no rule** in LSS or SFB capping anhöriga's hours or the percentage of total hours they may cover. The limit comes from labor law (Lag 1970:943 or ATL), not assistance law. Applied to the **assistant**, not the brukare.

### 6.3 Minor brukare — guardian is arbetsgivare

When the brukare is under 18, **the guardian (vårdnadshavaren) registers as arbetsgivare hos Skatteverket**, not the child. Skatteverket guidance:

> "Eftersom en omyndig inte själv kan betala ut lön … är det en av barnets föräldrar som anses vara utbetalare, även om barnet betalar ersättningen till sin egen förälder."

Source: [Skatteverket — Assistansersättning](https://skatteverket.se/privat/skatter/arbeteochinkomst/inkomster/assistansersattning.4.361dc8c15312eff6fd2bd0c.html).

Also: guardian must notify IVO under LSS 23§ if självvald.

**Implication for FK 3057 / SKV 4805 / lönespecifikation:** "Arbetsgivare" field on these documents should be the **patient (brukare)** with **"Företrädd av [guardian]"** for minor brukare. This is what Phase 8's `resolveEmployerRepresentation()` helper implements.

### 6.4 Adult brukare without capacity

Huvudregeln: vuxna är rättskapabla. God man/förvaltare kan biträda men **brukaren förblir legal arbetsgivare.** For the app: handled via the `patient_requires_representative` override flag on `profile` — explicit opt-in for god-man/förvaltare scenarios.

### 6.5 Obligations for egen arbetsgivare

Whether the brukare is a minor or adult, the egen-arbetsgivare household must:

1. Register as arbetsgivare at Skatteverket (verksamt.se)
2. Notify IVO under LSS 23§
3. Sign written anställningsavtal with each assistant
4. Withhold A-skatt and pay **arbetsgivaravgifter 31,42%**
5. File **arbetsgivardeklaration på individnivå (AGI)** monthly per anställd (SKV 4805 on paper for Kalinga, AGI-API for anordnare)
6. Hold statutory insurance (TFA/TGL equivalents — often via försäkringsförmedlare)
7. File FK 3057 + FK 3059 monthly to receive assistansersättning

### 6.6 Dygnsvila/veckovila for anhöriga in hushållsgemenskap

**Do not apply** (Lag 1970:943 carve-out). A parent caring for their own minor child at home can work back-to-back long shifts that ATL would forbid. **Unless** the family voluntarily opts into a kollektivavtal, in which case the kollektivavtal's rules apply.

### 6.7 Anhörigvårdbidrag ≠ anhörigassistans

Easy to confuse:
- **Anhörigvårdbidrag / hemvårdsbidrag** — kommunal ersättning till en vårdare. No salary relationship. Different benefit.
- **Anhöriganställning inom hemtjänst (SoL)** — kommunen anställer anhörig.
- **Anhörigassistans (LSS/SFB)** — anhörig = anställd personlig assistent with salary, arbetsgivaravgifter, FK assistansersättning.

Kalinga is in the third category only.

### 6.8 Case law

**HFD 2025 (Nordica Assistans)** — FK återkrav cases increasingly scrutinize whether hours claimed were actually utförda, and whether working-time rules were honored. Relevant because anhörig-timmar are often at the center of disputes. ([HFD 2025-02](https://www.domstol.se/hogsta-forvaltningsdomstolen/nyheter/2025/02/domar-i-mal-om-assistansersattning/), [HFD 2025-05](https://www.domstol.se/hogsta-forvaltningsdomstolen/nyheter/2025/05/dom-i-mal-om-assistansersattning/))

No public case found setting a percentage cap on anhöriga's hours.

---

## 7. What this means for Kalinga (practical implications)

### 7.1 Kalinga's current user profile

- **Brukare:** minor child (under 18), disabled, approved for assistansersättning under LSS
- **Guardian (arbetsgivare on paper):** parent of the brukare, registered at Skatteverket
- **Assistants:** Rose + Mikael, both parents of the brukare, living in hushållsgemenskap
- **Kollektivavtal:** none (egen arbetsgivare, anhörigassistans)
- **Tax scheme:** A-skatt, flat 30% preliminärskatt (Skatteverket-accepted fallback when no skattetabell entered)

### 7.2 Therefore

| Rule | Applies to Kalinga today? |
|---|---|
| FK beslut stated in weekly hours | ✓ Yes — `profile.weeklyHours` is correct |
| Daily cap from FK | ✗ No — FK doesn't set one |
| ATL §5 40h/week | ✗ No — Lag 1970:943 applies (48h/4-week avg) |
| ATL §13 dygnsvila 11h | ✗ No — does not apply |
| ATL §14 veckovila 36h | ✗ No — does not apply |
| OB-tillägg | ✗ No — no kollektivavtal |
| Semesterlön 12% | ✓ Yes — statutory floor (Semesterlag) |
| Sjuklön 80% dag 1–14 | ✓ Yes — statutory floor (Sjuklönelag). **Waived by mutual agreement in anhörig model (no paid sjukdagar) — this is legal.** |
| Tjänstepension | ✗ No — no kollektivavtal |
| Arbetsgivaravgifter 31,42% | ✓ Yes — always |
| AGI filing monthly | ✓ Yes — via SKV 4805 |
| FK 3057 + FK 3059 monthly | ✓ Yes — due 5th of 2nd month after |
| Guardian signs as arbetsgivare | ✓ Yes — brukare is minor |

### 7.3 Schema implications (Phase 7 onward)

- **`profile.weeklyHours`** is the single source of truth for the FK decision's hour entitlement. Keep.
- **`fk_decision_hours_per_day` is NOT needed** for Kalinga's users today. FK decisions don't set one. The field would serve only v1.3's ATL rule engine for edge cases where an assistant is NOT in hushållsgemenskap — and that's a small minority of users.
  - **Recommendation:** Do not add this column in Phase 7. If v1.3's rule engine needs a daily cap, derive from `weeklyHours / 7` or store a derived daily max only where actually relevant.
- **`fk_decision_start` / `fk_decision_end`** — still useful even though beslut often run indefinitely, since downstream logic (period reporting, slutavräkning, expiry warnings) needs these dates.
- **`dubbel_assistans_approved`** — still useful; some brukare have this and some don't; the flag gates v1.3 dubbel-assistans rule checks.
- **`patient_relation_to_guardian`** enum — still useful; determines which rules apply (anhörig carve-outs vs full ATL).
- **`patient_requires_representative`** — still useful for adult-without-capacity edge case even if current user base is only minor patients.

### 7.4 Payroll/slip implications (Phase 9)

- **Anhörigassistans slip** intentionally shows zero sjuklön / VAB / semesterlön lines — legal because mutual agreement waives them. Keep the `* Ingen ersättning vid sjukdom…` footnote.
- **Preliminärskatt flat 30%** is a Skatteverket-accepted fallback. No per-assistant skattetabell needed until v1.4.
- **Omkostnader pot (H5)** remains deferred — still not modelled. The current 100% → lönekostnader allocation overpays vs Fremia schablon; documented as v1.0 Known Issue.

### 7.5 Code references that should point here

Add comments in:
- `server/src/db/schema.ts` — on `profile.weeklyHours`, `payrollRecords.prelimTaxRateSnapshot`, any new FK-decision-related columns
- `server/src/lib/form4805-utils.ts` — on employer-name field
- `server/src/lib/payrollSlipUtils.ts` (when created in Phase 9) — on absence-waiver footnote

Format: `// See docs/compliance/swedish-fk-and-labor-rules.md §7 for why this is legal`

---

## 8. Open questions / known gaps

Items flagged during research where the public record was thin or uncertain. Verify before relying on the stated answer.

- **Single-week overuse vs period-total wash-out (§2.5).** Nuance on how FK handles a single-week spike that fits inside the period total. Verify against Vägledning 2003:6 ch. 8–9.
- **Exact 51 kap 9§ SFB post-2018 consolidated text (§2.1).** Quoted from cached search excerpts, not a fresh read of current riksdagen.se text.
- **Bransch G 2025/2026 minimilön in kronor (§5).** No public source found; figure is behind Vårdföretagarna member login.
- **Hushållsgemenskap test (§4.3).** Not statutorily defined; IVO/FK interpret case-by-case. A family where parent + adult-child brukare live in the same building but separate units could be contested.
- **Anhörig percentage cap (§6.2).** No public rule found. Could change; monitor FK Vägledning updates.

---

## 9. Sources

### Primary statutes

- [Socialförsäkringsbalk (2010:110), 51 kap — Assistansersättning](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/socialforsakringsbalk-2010110_sfs-2010-110/)
- [LSS — Lag (1993:387) om stöd och service till vissa funktionshindrade](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1993387-om-stod-och-service-till-vissa_sfs-1993-387/)
- [Arbetstidslag (1982:673)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/arbetstidslag-1982673_sfs-1982-673/)
- [Lag (1970:943) om arbetstid m.m. i husligt arbete](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-1970943-om-arbetstid-mm-i-husligt-arbete_sfs-1970-943/)
- [Semesterlag (1977:480)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/semesterlag-1977480_sfs-1977-480/)
- [Sjuklönelag (1991:1047)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-19911047-om-sjuklon_sfs-1991-1047/)
- [Lag (1982:80) om anställningsskydd (LAS)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/lag-198280-om-anstallningsskydd_sfs-1982-80/)
- [Förordning (1993:1091) om assistansersättning](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/svensk-forfattningssamling/forordning-19931091-om-assistansersattning_sfs-1993-1091/)

### FK, Skatteverket, Arbetsmiljöverket guidance

- [FK — Vägledning 2003:6 (Assistansersättning)](https://www.forsakringskassan.se/download/18.7b234aa517b3a0b7f372a5/1715781233879/assistansersattning-vagledning-2003-06.pdf)
- [FK — Vara arbetsgivare för egna assistenter](https://www.forsakringskassan.se/privatperson/vuxen-med-funktionsnedsattning/assistansersattning/vara-arbetsgivare-for-egna-assistenter)
- [FK — Karensavdrag](https://www.forsakringskassan.se/arbetsgivare/sjukdom-och-skada/om-din-medarbetare-blir-sjuk/karensavdrag)
- [FK 3059 blankett (via Assistanskoll)](https://assistanskoll.se/_up/3059-tidredovisning-for-assistansersattning.pdf)
- [Skatteverket — Assistansersättning](https://skatteverket.se/privat/skatter/arbeteochinkomst/inkomster/assistansersattning.4.361dc8c15312eff6fd2bd0c.html)
- [Skatteverket — AGI](https://www.skatteverket.se/foretag/arbetsgivare/lamnaarbetsgivardeklaration.4.41f1c61d16193087d7fcaeb.html)
- [Arbetsmiljöverket — Om arbetstidslagen](https://www.av.se/arbetsmiljoarbete-och-inspektioner/lagar-och-regler-om-arbetsmiljo/om-arbetstidslagen/)
- [IVO — Egen personlig assistans](https://www.ivo.se/egen-personlig-assistans/)

### Kollektivavtal

- [Fremia–Kommunal Personlig assistans 2025–2027 (Kommunal nyhet)](https://www.kommunal.se/nyhet/avtal-klart-2025-fremia-personlig-assistans)
- [Vårdföretagarna Bransch G 2025–2027 (Kommunal nyhet)](https://www.kommunal.se/nyhet/avtal-klart-2025-vardforetagarna-personlig-assistans-bransch-g)
- [Fremia — Personlig assistans-avtalet](https://www.fremia.se/kollektivavtal/personlig-assistans/)
- [Vårdföretagarna — Personlig assistans Bransch G](https://www.vardforetagarna.se/aktiviteter/nytt-avtal-vardforetagarna-bransch-personlig-assistans-g/)
- [Kommunal — Nya dygnsviloregler Fremia (2026-01-01)](https://www.kommunal.se/nyhet/nya-dygnsviloregler-pa-kommunals-kollektivavtal-med-fremia)

### Case law

- [HFD 2025-02 — Assistansersättning / Nordica Assistans](https://www.domstol.se/hogsta-forvaltningsdomstolen/nyheter/2025/02/domar-i-mal-om-assistansersattning/)
- [HFD 2025-05 — Assistansersättning](https://www.domstol.se/hogsta-forvaltningsdomstolen/nyheter/2025/05/dom-i-mal-om-assistansersattning/)
- [Hejaolika — Återkrav efter HFD 2025](https://hejaolika.se/artikel/aterkrav-efter-hfd-domarna-2025-regler-risker-och-skydd/)

### Propositioner & utredningar

- [Prop. 2017/18:78 — Vissa förslag om personlig assistans (2-år-omprövning avskaffad)](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/proposition/vissa-forslag-om-personlig-assistans_H50378/html/)
- [Prop. 2007/08:61 — Kostnader för personlig assistans](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/proposition/kostnader-for-personlig-assistans_gv0361/html/)
- [SOU 2007:73 — Kostnader för personlig assistans](https://www.riksdagen.se/sv/dokument-och-lagar/dokument/statens-offentliga-utredningar/kostnader-for-personlig-assistans-skarpta-regler_gvb373/html/)

### Secondary

- [Assistanskoll — TEMA Anhöriga som assistenter](https://assistanskoll.se/TEMA-anhoriga-som-assistenter.html)
- [Assistanskoll — FAKTA om Arbetstidslagen](https://assistanskoll.se/20090312-FAKTA-om-Arbetstidslagen-ATL.html)
- [Assistanskoll — Att vara egen arbetsgivare](https://assistanskoll.se/Guider-Att-vara-egen-arbetsgivare.html)
- [New Life Assistans — Fakta om ATL i personlig assistans](https://newlife.se/2021/03/03/fakta-om-arbetstidslagen-i-personlig-assistans/)
- [Hejaolika — Guide arbetstidsreglerna](https://hejaolika.se/artikel/guide-sa-klarar-du-arbetstidsreglerna/)
- [IfA — Intressegruppen för Assistansberättigade](https://intressegruppen.info/)

---

## 10. Changelog

| Date | Change | Who |
|---|---|---|
| 2026-04-18 | Initial version. Created during Phase 7 discuss cycle when the weeklyHours vs fk_decision_hours_per_day question surfaced for the third time. | Claude (Sonnet) + Rose |

---

*When updating this doc: preserve source links, note any rule changes with effective dates, update the Changelog, and commit in the same PR as any code change that relies on the updated rule.*
