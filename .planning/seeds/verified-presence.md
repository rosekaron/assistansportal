---
name: Verified Presence / Anti-Fraud Clock-In
type: seed
status: idea
trigger: Phase 5 complete
captured: 2026-04-10
---

# Verified Presence — Phase 6 Concept

## The Problem
Care companies inflate reported hours vs. actual hours worked. This is fraud against FK (Försäkringskassan) reimbursements. Families using this platform need to prove that logged hours reflect real presence.

## The Opportunity
If clock-in/out can be verified as coming from the assistant themselves at the care address, the platform provides tamper-resistant evidence that:
1. The assistant was physically present
2. The hours were logged by the assistant (not the guardian or care company)
3. The guardian approved the hours before FK submission

## Mechanisms to Explore
- **Device binding** — assistant's phone/account is the only authorized clock-in device
- **Geolocation at clock-in/out** — GPS confirmation of presence at registered care address
- **Biometric confirmation** — Face ID / fingerprint on mobile as clock-in trigger
- **Immutable log** — no editing of approved entries; corrections require explicit amendment workflow
- **FK-ready export** — clock-in/out records exportable in a format suitable for FK audit response

## Why This Matters for the Roadmap
This feature transforms the platform from "admin tool" to "fraud-prevention infrastructure" — a much stronger value proposition for both individual families and potential sale to Humana/Attendo as a compliance layer.

## Dependencies
- Phase 1: Role enforcement (assistant vs guardian) ✓
- Phase 2: Absence tracking (reduces fraudulent sick-day claims) ✓
- Phase 3: Payroll recording (the financial layer being protected) — in progress
- Phase 5: Scheduling (shifts provide the expected clock-in windows)
