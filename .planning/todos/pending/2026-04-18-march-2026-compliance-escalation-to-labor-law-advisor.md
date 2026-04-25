---
created: 2026-04-18T00:00:00Z
title: March 2026 compliance escalation to labor-law advisor
area: compliance
planned_milestone: external (not a code change)
files:
  - .planning/compliance/2026-03-advisor-brief.md
  - server/src/lib/payroll-utils.ts
  - server/src/lib/form4805-utils.ts
  - server/src/routes/pdf.ts
---

> **External track (2026-04-18)** — This todo requires human legal/kollektivavtal advisor review, not code work. Deferred indefinitely pending guardian's advisor consultation. Advisor brief lives at [.planning/compliance/2026-03-advisor-brief.md](../../compliance/2026-03-advisor-brief.md). Not blocking any shippable milestone — v1.0.1 through v1.5 can proceed independently.


## Problem

Retroactive March 2026 filing (FK 3057/3059 + SKV 4805) was attempted during v1.0 milestone close-out. Import from Google Calendar landed 84 shifts / 430h cleanly, but compliance validation surfaced:

- **48 dygnsvila (§13 ATL) violations** — rest-between-shift < 11h. Structural in both Rose and Mikael's schedules.
- **Systematic veckovila (§14 ATL) shortfall** — Rose's weekly rest maxes at 35h, need 36h.
- **Weekly hours exceed 40h ordinarie tid (§5 ATL)** — 48.5h/week every full week = ~34h/month övertid per assistant that may not be paid correctly.
- **FK filing blocked** by placeholder brukare pno, guardian name, FK beslutsnummer, Mikael pno, addresses.
- **Potential dubbel-assistans issue** — weekday evenings have 3h of Rose+Mikael overlap that may not be covered by FK beslut.
- **Preliminary tax** set to flat 30% not each assistant's skattetabell.

Full analysis and per-week/per-shift numbers in `.planning/compliance/2026-03-advisor-brief.md`.

## Solution

**Step 1 — Advisor consult** (blocking):
Send `.planning/compliance/2026-03-advisor-brief.md` to a kollektivavtal / labor-law advisor (Fremia/Kommunal or equivalent for "Personlig assistans"). Advisor needs to rule on:
- Does the current schedule violate ATL, or is it covered by a kollektivavtal exception?
- How should the övertid-looking 8.5h/week be paid?
- Is dubbel-assistans approved in the FK beslut?
- Anhörigassistans rules for Rose (if she is guardian + assistant)?
- Skattetabell per assistant vs flat 30%?

**Step 2 — Fix data gaps** (blocking for FK/Skatteverket submission):
Enter in Settings:
- Brukare personnummer + name
- Guardian personnummer + name
- FK beslutsnummer
- Mikael's personnummer
- Both assistants' physical addresses
- Per-assistant preliminary tax rate

**Step 3 — Operational decisions** (based on advisor output):
Either (a) adjust the March hours retroactively to match what's actually legally-billable, or (b) file as-is with documented compensatory-rest and övertid classification. This is a human decision, not software.

**Step 4 — Re-run generation**:
Once (1)–(3) are resolved, re-approve the 84 March entries, regenerate payroll, approve payroll records, and download FK 3057 / FK 3059 / SKV 4805 PDFs. All code paths are verified working — the blocker is data + legal interpretation, not software.

## Current DB state

- 84 March entries exist in `entries` as `reqStatus=pending / repStatus=draft` (reverted during this analysis so nothing looks ready-to-bill).
- Zero March payroll records.
- No PDFs generated.
- Nothing submitted.
