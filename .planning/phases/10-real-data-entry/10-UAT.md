---
status: in-progress
phase: 10-real-data-entry
source:
  - 10-01-SUMMARY.md
  - 10-02-SUMMARY.md
started: 2026-04-24T22:00:00Z
updated: 2026-04-24T22:00:00Z
runner: claude (interactive — PDF download + pdftotext grep; guardian sign-off per test)
---

## Current Test

[testing not started]

## Tests

### 1. FK 3057 — reporting month 2026-03 contains zero placeholders
expected: POST /api/pdf/fk3057 {year:"2026",month:"3"} returns 200 application/pdf; pdftotext output contains zero D-07 placeholder pattern hits (TBD | 000000-0000 | TBD-FK-DECISION | 23123123123123 | placeholder | 6+-digit-run | double-comma | ", ,").
result: pass (after fix)
evidence: |
  First attempt: HTTP 500 — server crash in /fk3057 route. Reproduction in a standalone node script surfaced the root cause: `fk3057.pdf` is owner-password-encrypted by Försäkringskassan; the route was loading it with `PDFDocument.load(..., {ignoreEncryption: true})` which yielded 0 accessible form fields and crashed on `pdfDoc.save()`. Commit 509f9cb (Phase 8) had refactored /fk3059 and /4805 to use the `decryptAndFill` (qpdf) helper but missed /fk3057.

  Fix committed in this session: /fk3057 route now uses `decryptAndFill(formPath, fields)` — same pattern as /fk3059. 16 insertions / 24 deletions, zero behavioral change for field values.

  Retry after fix: HTTP 200, 791078 bytes, first 4 bytes = %PDF-.
  pdftotext run: 0 placeholder hits across D-07 pattern set (refined regex: `(\d)\1{5,}` digit-only, not the original `(.)\1{5,}` which false-positives on PDF whitespace runs).
  131 text lines extracted, Swedish locale glyphs (å/ä/ö) render OK.
  Patient identity, month/year digits, guardian contact fields visible in pdftotext output at category level (not transcribed).

  Non-obvious discovery: the /fk3057 route does NOT reference `fk_decision_no`, `fk_decision_start`, or `fk_decision_end` anywhere. Those three fields exist only on the schema + `PUT /api/profile` whitelist; no PDF route consumes them. That means the Phase 10 CONTEXT.md premise "FK 3057 header will flag the `23123123123123` placeholder" was incorrect — the placeholder stays in DB but doesn't propagate to any generated PDF. Plan 10-04 (FK decision fields gap-closure) is likely unnecessary for DATA-03 / v1.0.1 scope; needs confirmation.

### 2. SKV 4805 — Rose Karon for 2026-03 contains zero placeholders
expected: POST /api/pdf/4805 {year:"2026",month:"3",assistantId:$ROSE_ID} returns 200 application/pdf; pdftotext output contains zero D-07 placeholder pattern hits; employer block resolves to patient identity per Phase 8 EMP-01/02 (not guardian).
result: pass
evidence: |
  HTTP 200, 28796 bytes, first 4 bytes = %PDF-
  pdftotext run: 0 placeholder hits across D-07 pattern set
    (TBD | 000000-0000 | TBD-FK-DECISION | 23123123123123 | placeholder |
     `(\d)\1{5,}` 6+-same-digit-run | `,, ` double-comma | `, ,` triple-empty).
  148 text lines extracted, Swedish locale glyphs (å/ä/ö) render OK — category-level confirm, full text not transcribed.
  Employer section visually corresponds to patient identity per Phase 8 EMP-01/02 (category-level confirm, not transcribed).
  Recipient section shows Rose Karon identity (category-level confirm).
  Note on D-07 regex: plan literal `(.)\1{5,}` was too broad — matched PDF whitespace-run layout artifacts (103/148 lines false-positive). Refined to `(\d)\1{5,}` (digit-only) to preserve the rule's original intent (detect all-same-digit pno placeholders). Zero hits with refined pattern.

### 3. Lönespec re-download — LS-2026-03-001 rebuilds with new data, audit fields frozen (D-06)
expected: POST /api/pdf/lonespec {year:"2026",month:"03",assistantId:$ROSE_ID} returns 200 application/pdf; pdftotext output contains zero D-07 placeholder pattern hits; payment_slips row (id, document_number, issued_at, pay_date) unchanged pre/post (D-06 freeze); rebuilt PDF surfaces new address + bank content entered via Settings UI (D-06 rebuild-on-download).
result:
evidence: |
  TBD

## Summary

total: 3
passed: 0
issues: 0
pending: 3
skipped: 0
blocked: 0

## Gaps

[TBD]

## Notes

- Driven by JWT-signed curls against `http://localhost:3001` using `server/.env` `JWT_SECRET` (substituted from plan's `:3000` literal since that port is Remotion Studio on this workstation; plan 10-01 confirmed `:3001` is the correct API port).
- `pdftotext` from poppler (`brew install poppler`).
- `psql` is NOT installed on this workstation; Test 3's D-06 freeze check runs via a one-shot `node` script using the project's `pg` dependency + `DATABASE_URL` from `server/.env`.
- Real values (addresses, pno, bank clearing/account/IBAN) exist only in Postgres per CONTEXT.md Claude's Discretion — never in this UAT file, plan bodies, or commit messages.
- Mode context: Phase 10 switched mid-flight from agentic PUT pipeline to guardian-driven manual E2E. Assistant data (Rose + Mikael) was entered via the Settings UI rather than through executor-driven `PUT /api/assistants/:id` calls (plan 10-02 superseded — see `10-02-SUMMARY.md`). Profile FK fields (`fk_decision_no`, `fk_decision_start`, `fk_decision_end`) were also entered via Settings during the same E2E session, potentially closing plan 10-04 inline.
- Mikael PDF walkthrough deferred per D-04 (sampling decision — data-entry covers both assistants but the PDF eyeball step only iterates Rose).
