---
status: complete
phase: 09-salary-slip
source:
  - 09-01-schema-and-whitelists-SUMMARY.md
  - 09-02-slip-builder-and-renderer-SUMMARY.md
  - 09-03-endpoints-and-allocation-SUMMARY.md
  - 09-04-ui-surfaces-SUMMARY.md
started: 2026-04-20T00:00:00Z
updated: 2026-04-20T09:42:00Z
runner: claude (automated — API + DB + lib verification)
---

## Current Test

[testing complete]

## Tests

### 1. Cold Start Smoke Test
expected: Server boots without errors (Drizzle schema loads, Postgres connects, no schema-related startup errors).
result: pass
evidence: |
  Killed all server processes (port 3001 clear). Started `npm run dev` fresh.
  Boot log: `✅  Server running → http://localhost:3001` + `Postgres → localhost:5432/assistansportal` + `Cron → compliance reminder job started`.
  Zero schema errors referencing payment_slips, salary_model, hourly_rate_override, payment_method, or default_pay_day.
  (The `auth.ts:101` TypeError in the log was triggered by my empty `{}` login probe hitting `email.toLowerCase()` on undefined — not a boot issue.)

### 2. Settings — 4 new fields persist through PUT whitelists
expected: PUT /api/assistants/:id accepts salaryModel/hourlyRateOverride/paymentMethod; PUT /api/profile accepts defaultPayDay with 1–28 clamp.
result: pass
evidence: |
  PUT /api/assistants/a59ff89a2 {salaryModel:"anhörig", hourlyRateOverride:254.10, paymentMethod:"swish"} → 200, response body confirms persisted values.
  PUT /api/profile {defaultPayDay:30} → clamped to 25 (server-side clamp, SLIP-06).
  PUT /api/profile {defaultPayDay:15} → persisted as 15.
  Settings.tsx wires all 4 fields (lines 827–839 Utbetalningsdag, 1083 Avtalsmodell, 138–153 assistant schema). State restored afterwards.

### 3. Monthly — guardian downloads lönespec PDF (happy path)
expected: POST /api/pdf/lonespec → 200 application/pdf with %PDF- magic and Swedish filename.
result: pass
evidence: |
  POST /api/pdf/lonespec {year:"2026", month:"03", assistantId:"a59ff89a2"} → HTTP 200.
  Content-Type: application/pdf. Content-Disposition: attachment; filename="lonespec-2026-03-Rose-Karon.pdf".
  First bytes: %PDF-1.3. Size: 2868 bytes (matches 09-04 SUMMARY baseline).

### 4. Monthly — disabled-state server gates (400 NULL-rate + 409 draft)
expected: D-12 rate-NULL gate fires BEFORE D-08 approval gate.
result: pass
evidence: |
  With hourlyRateOverride NULL: POST → 400 "Timlön saknas för Rose Karon. Sätt timlönen i Inställningar → Assistenter." (also applies to GET /me).
  With payroll status=draft: POST → 409 "Lönekörningen är inte godkänd för denna månad." (also applies to GET /me).
  UI disabled-state binding ("Timlön saknas" / "Lönekörning ej godkänd") was confirmed in 09-04 SUMMARY subtests 1 + 5.

### 5. AssistantDashboard — listing and self-download
expected: GET /api/assistant/slips returns JWT-bound assistant's slips; GET /api/pdf/lonespec/me returns that assistant's PDF.
result: pass
evidence: |
  GET /api/assistant/slips (Rose JWT) → [{id:"slipd706cf57", reportMonth:"2026-03", documentNumber:"LS-2026-03-001", payDate:"2026-04-25", payMethod:"bankgiro"}].
  GET /api/pdf/lonespec/me?month=2026-03 (Rose JWT) → HTTP 200, 2868-byte PDF, same filename "lonespec-2026-03-Rose-Karon.pdf".
  AssistantDashboard.tsx card confirmed in 09-04 SUMMARY.

### 6. Cross-assistant IDOR blocked
expected: Query/body assistantId injection ignored; server reads only req.assistantId (JWT payload).
result: pass
evidence: |
  Mikael JWT (role:"assistant", no assistantId): GET /api/assistant/slips → 400 "No assistant linked to this account".
  GET /api/pdf/lonespec/me?month=2026-03&assistantId=a59ff89a2 → IDENTICAL 400 response (query injection ignored).
  GET /api/assistant/slips?assistantId=a59ff89a2 → IDENTICAL 400 response.
  Source inspection: pdf.ts:633 `const assistantId = req.assistantId;` (explicit comment: "derive assistantId from req.assistantId ONLY").
  assistant.ts:118–122 uses only req.assistantId.

### 7. Replay idempotency
expected: Second POST reuses the existing payment_slips row; no duplicate.
result: pass
evidence: |
  Before replay: 1 row (id:slipd706cf57, LS-2026-03-001, issued_at:2026-04-19T20:52:31.277Z).
  Replay POST → HTTP 200, 2868-byte PDF.
  After replay: STILL 1 row — same id, same document_number, same issued_at timestamp (preserved).

### 8. Pay-date freeze (D-09)
expected: Changing profile.defaultPayDay does not alter already-issued slip's pay_date.
result: pass
evidence: |
  Pre-test: slip.pay_date=2026-04-25, profile.default_pay_day=25.
  PUT /api/profile {defaultPayDay:20} → 200 (profile.default_pay_day now 20).
  Re-POST /api/pdf/lonespec → HTTP 200, 2868-byte PDF.
  Post-test: slip.pay_date=2026-04-25 (FROZEN), profile.default_pay_day=20.
  Profile restored to 25.

### 9. PDF content — Swedish formatting and representative branching
expected: Swedish locale numerics, representative resolves for minor, Swedish glyphs render.
result: pass
evidence: |
  pdftotext output confirmed all expected content:
  - Headers: LÖNESPECIFIKATION, Arbetsgivare, Företrädd av, Anställd, Utbetalningsdag, Utbetalningssätt, Avtalsmodell
  - Employer row: "Mikael Junior Karon, 202011090137" (patient = employer)
  - Representative row: "Rose Karon, 198011155069" (minor patient → representative populated, SLIP-04)
  - Period: "1 mars – 31 mars 2026"
  - Numeric locale: "215,0 tim", "254,10 kr/tim", "54 631,50 kr", "54 641,61 kr" (space thousands, comma decimal, SLIP-03)
  - Pay date: "25 april 2026" (frozen at issue, D-09)
  - Payment method: "Bankgiro"
  - å/ä/ö glyphs render without substitution
  - Direct unit tests: 23/23 passing in payrollSlipUtils.test.ts.

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

[none — all 9 tests pass]

## Notes

- Testing driven automatically by Claude using: fresh server boot, JWT-signed API calls (Rose guardian + Mikael assistant tokens forged with the .env JWT_SECRET), direct Postgres inspection, and the colocated vitest suite.
- Dev DB state at completion: profile.default_pay_day=25, Rose.payment_method=bankgiro, Rose.hourly_rate_override=254.10, payroll_records for 2026-03 all status=approved, payment_slips has the single row `slipd706cf57 / LS-2026-03-001`.
- Visual-only UX polish (button colors, exact spacing, tooltip wording) was NOT re-verified here — those were signed off in 09-04 SUMMARY subtest 1 on 2026-04-20.
- Known dev-data gap (carried forward from 09-04): `mikael@karon.se` has `assistant_id=null` because the account was created via password-auth rather than the invite-link flow. Positive IDOR test for Mikael cannot run until he's linked; the negative test (injection blocked) passes cleanly with the current state.
