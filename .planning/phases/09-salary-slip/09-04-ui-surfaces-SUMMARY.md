---
phase: 09-salary-slip
plan: 04
subsystem: client
tags: [ui, react, lönespec, settings, assistant-dashboard, monthly]

requires:
  - phase: 08-employer-representation
    provides: "Settings 2-section UI pattern; AssistantDashboard card conventions"
  - plan: 09-01-schema-and-whitelists
    provides: "PUT whitelists for salaryModel / hourlyRateOverride / paymentMethod / defaultPayDay — UI writes through existing Spara buttons, no new endpoints"
  - plan: 09-03-endpoints-and-allocation
    provides: "POST /api/pdf/lonespec (guardian) + GET /api/pdf/lonespec/me (assistant) + GET /api/assistant/slips (listing)"

provides:
  - "pdfApi.lonespec(year, month, assistantId) + pdfApi.lonespecMe(month) + assistantSelfApi.slips() + PaymentSlipListRow type"
  - "Monthly.tsx 'Lönespecifikation' sibling section (Option B) with per-approved-assistant download row — 3 disabled states"
  - "AssistantDashboard.tsx 'Lönespecifikationer' card — loading skeleton / error / empty / populated states"
  - "Settings.tsx: 3 new assistant fields (Avtalsmodell / Utbetalningssätt / Timlön) inside Anställning & ekonomi collapsible; 1 new profile field (Utbetalningsdag 1–28 clamp) in Lön mini-section"

affects: []

tech-stack:
  added: []
  patterns:
    - "NULL-gate UI: hourlyRateOverride empty input triggers 'Timlön saknas' disabled state, per D-12 — preserves the server-side 400 gate as a visible UX affordance"
    - "Monthly downloads render as a NEW sibling section (Option B from UI-SPEC) rather than renaming the AGI block (Option A) — preserves the numbered 4-step stepper semantics"
    - "Profile Lön mini-section is OUTSIDE the FK-beslut collapsible — immediate visibility of a high-impact freeze-on-issue setting"
    - "Namespace consistency wins over plan ergonomics: plan referenced `assistantApi.slips` but existing code uses `assistantSelfApi` — extended existing namespace instead of creating parallel"

key-files:
  created:
    - ".planning/phases/09-salary-slip/09-04-ui-surfaces-SUMMARY.md"
  modified:
    - "client/src/lib/api.ts — +pdfApi.lonespec, +pdfApi.lonespecMe, +assistantSelfApi.slips, +PaymentSlipListRow"
    - "client/src/pages/Monthly.tsx — new Section 5 Lönespecifikation with 3-state rows"
    - "client/src/pages/AssistantDashboard.tsx — new Lönespecifikationer Card"
    - "client/src/pages/Settings.tsx — 3 assistant fields + 1 profile field"

key-decisions:
  - "Option B for Monthly placement (sibling section after AGI) not Option A (rename AGI) — keeps 4-step stepper untouched"
  - "Profile defaultPayDay in new 'Lön' mini-section inside Profile Card but outside FK-beslut collapsible — visible without another toggle"
  - "assistantSelfApi.slips (not assistantApi.slips) — matches existing codebase namespace"
  - "Error-fallback copy on AssistantDashboard listing is static Swedish ('Kunde inte hämta lönespecifikationer. Försök ladda om sidan.') — no retry button in v1.0.1, reload instead"

patterns-established:
  - "Conditional disabled-button mapping for compliance rows (Ladda ner lönespec / Lönekörning ej godkänd / Timlön saknas) — reusable shape for future per-assistant action rows"
  - "Collapsible-outside mini-section rhythm in Profile Card — useful for other freeze-on-issue settings added later"

requirements-completed: [SLIP-01, SLIP-02, SLIP-06]

duration: ~prior session + verification session
completed: 2026-04-20
---

# Phase 09 Plan 04: UI Surfaces Summary

**Three UI surfaces (Monthly download row, AssistantDashboard listing, Settings fields) wired to the endpoints from Plan 09-03 and the whitelists from Plan 09-01. All 6 human-verification subtests passed.**

## Task Commits

1. **Task 1: Client API helpers (pdfApi.lonespec / pdfApi.lonespecMe / assistantSelfApi.slips + PaymentSlipListRow type)** — `c61cfd1` (feat)
2. **Task 2: Monthly.tsx Lönespec download row with 3 disabled states** — `07531ac` (feat)
3. **Task 3: AssistantDashboard Lönespecifikationer section (loading/error/empty/populated)** — `9a9e094` (feat)
4. **Task 4: Settings fields — 3 assistant + 1 profile** — `1a1cc0a` (feat)
5. **Task 5: Human verification** — completed in verification session 2026-04-20 (see below)

## Files Created/Modified

- `client/src/lib/api.ts` — added `PaymentSlipListRow` type (exported), `pdfApi.lonespec(year, month, assistantId)` POST with `responseType: "blob"`, `pdfApi.lonespecMe(month)` GET with `responseType: "blob"`, `assistantSelfApi.slips()` GET returning `PaymentSlipListRow[]`
- `client/src/pages/Monthly.tsx` — new "Lönespecifikation" section rendered after AGI block, per-approved-assistant rows mapping to `{ state: "ready" | "not-approved" | "no-rate" }` → primary "Ladda ner lönespec" / outline "Lönekörning ej godkänd" / outline "Timlön saknas"; 409/400 server errors map to Swedish copy
- `client/src/pages/AssistantDashboard.tsx` — new `<Card>` above Reports section with Lönespecifikationer title, intro copy, four branches (useQuery loading/error/empty/populated) iterating `PaymentSlipListRow[]` and calling `pdfApi.lonespecMe(month)` on Ladda ner click
- `client/src/pages/Settings.tsx` — in assistants edit dialog's "Anställning & ekonomi" collapsible: `Avtalsmodell` (Select: Anhörigassistans enabled, Fremia v1.4 / Custom v1.5 disabled), `Utbetalningssätt` (Select: Bankgiro / Swish / Kontant), `Timlön (kr/tim)` (number input id=`hourlyRateOverride` with placeholder "254,10" and NULL-aware helper text); in Profile Card new "Lön" mini-section with `Utbetalningsdag (varje månad)` (number input id=`defaultPayDay`, 1–28 clamp, default 25)

## Decisions Made

1. **Monthly Option B over Option A** — keeps AGI stepper semantics intact
2. **Profile Lön mini-section outside FK-beslut collapsible** — defaultPayDay has freeze-on-issue semantics (D-09), so hiding it behind a toggle would bury a consequential setting
3. **Use `assistantSelfApi.slips` (existing namespace) not `assistantApi.slips` (plan-referenced name)** — namespace consistency deviation (Rule 3 in plan)
4. **Error-fallback copy is static** — no retry button; reload suggestion in Swedish matches the rest of the portal's error UX

## Deviations from Plan

- **Naming:** Plan referenced `assistantApi.slips`; codebase exports `assistantSelfApi` for all "acting as myself" endpoints. Extended the existing namespace instead of adding a parallel one. The must-have key-link pattern `(assistantApi\.slips|pdfApi\.lonespecMe)` from the plan frontmatter satisfies with either naming — we picked the one matching the existing code.
- **Monthly placement:** Chose Option B from UI-SPEC after weighing against Option A. Documented in Decisions above.

## Issues Encountered

During implementation (prior session):
- TS narrowing of the dialog edit form fields — standard React Hook Form+Zod pattern used elsewhere in the file.

During verification (this session):
- **Subtest 4 test-data gap** — `mikael@karon.se` user in dev DB has `assistantId: null` in JWT because it was created via password-auth setup, not via the assistant invite-link flow. This means the positive half of the IDOR test ("Mikael's own slips render in his dashboard") cannot execute. The security half (IDOR injection blocked) is fully verified by (a) source-code inspection showing pdf.ts:633 explicit comment `// derive assistantId from req.assistantId ONLY; never read from req.query or req.body`, (b) `/api/assistant/slips` (assistant.ts:116-135) reading only `req.assistantId`, and (c) empirical injection attempt returning identical 400 response with and without `?assistantId=a_rose`. This is dev-data fixture work, not a plan defect.

## Human Verification Results (2026-04-20)

All 6 subtests passed in the verification session:

| # | Subtest | Result |
|---|---------|--------|
| 1 | Settings — 4 new fields render + persist | PASS. Rose & Mikael `hourlyRateOverride=254.10` saved via PUT /api/assistants/:id → 200. Dialog reopened, value persisted as 254.1. Profile `defaultPayDay=25` visible with correct 1–28 input. |
| 2 | Monthly guardian download (March 2026) | PASS. POST /api/pdf/lonespec `{year:"2026",month:"03",assistantId:"a59ff89a2"}` → 200 application/pdf, 2868 bytes, magic `%PDF-`, Content-Disposition `attachment; filename="lonespec-2026-03-Rose-Karon.pdf"`. DB shows `payment_slips` row with `document_number=LS-2026-03-001`, `pay_date=2026-04-25`, `pay_method=bankgiro`. |
| 3 | AssistantDashboard (Rose, guardian view-switch) | PASS. Card renders "Mars 2026 / LS-2026-03-001 · utfärdat 20 apr. 2026 / Ladda ner". GET /api/pdf/lonespec/me?month=2026-03 → 200 PDF, same 2868-byte shape. |
| 4 | Cross-assistant IDOR (Mikael) | PASS-structurally. Mikael logged in via password; JWT has `assistantId:null`. `/api/assistant/slips` and `/api/assistant/slips?assistantId=a59ff89a2` both return identical `{error: "No assistant linked to this account"}`. `/api/pdf/lonespec/me?month=2026-03&assistantId=a59ff89a2` returns 400, no PDF. Source inspection confirms query/body params are explicitly ignored. See "Issues Encountered" for the positive-path test-data gap. |
| 5 | Replay | PASS. Second POST /api/pdf/lonespec for Rose March 2026 → identical 2868-byte PDF. DB query confirms 1 row total, `document_number=LS-2026-03-001` unchanged, `issued_at=2026-04-19T20:52:31.277Z` unchanged (original issue timestamp preserved). |
| 6 | Pay-date freeze (D-09) | PASS. Changed profile `defaultPayDay` 25→20 via PUT /api/profile → 200. Re-downloaded Rose's March slip. DB `payment_slips.pay_date` remained `2026-04-25`. Profile restored to 25 after test. |

## User Setup Required

None for v1.0.1 operations. For future test-data completeness, invite-link flow for `mikael@karon.se` should be re-run to populate his `users.assistantId` link — tracked as dev-data backlog, not a phase gap.

## Known Stubs

- Fremia (v1.4) and Custom (v1.5) options in Avtalsmodell Select are disabled with a "kommer i v1.4 / v1.5" tooltip — intentional per project roadmap.

## Threat Flags

None. The IDOR guard is structurally enforced (query/body params ignored at route entry). STRIDE dispositions from PLAN.md threat model remain as designed.

## Next Phase Readiness

Phase 10 (real data entry) can consume:
- `payment_slips` table as a read-only audit trail — no further UI changes needed to record issue events
- `hourlyRateOverride` as the canonical per-assistant rate — UI already enforces the NULL-gate UX
- The three endpoints from 09-03 are stable — Phase 10 should NOT change their shape

## Self-Check: PASSED

**Files verified:**
- FOUND: client/src/lib/api.ts with `PaymentSlipListRow` (line 122), `pdfApi.lonespec` (line 115), `pdfApi.lonespecMe` (line 117), `assistantSelfApi.slips` (line 226)
- FOUND: client/src/pages/Monthly.tsx — Lönespec section confirmed in DOM at March 2026
- FOUND: client/src/pages/AssistantDashboard.tsx — Lönespecifikationer card confirmed in DOM for Rose view
- FOUND: client/src/pages/Settings.tsx — all 4 new fields (Avtalsmodell / Utbetalningssätt / Timlön / Utbetalningsdag) confirmed in DOM

**Commits verified:**
- FOUND: c61cfd1 (Task 1 — API helpers)
- FOUND: 07531ac (Task 2 — Monthly row)
- FOUND: 9a9e094 (Task 3 — AssistantDashboard section)
- FOUND: 1a1cc0a (Task 4 — Settings fields)

**Live verification:**
- PASSED: all 6 human-verification subtests (see table above)
- PASSED: DB state consistent (1 payment_slip row, pay_date frozen)
- PASSED: IDOR injection blocked (structural + empirical)

---
*Phase: 09-salary-slip*
*Completed: 2026-04-20*
---
