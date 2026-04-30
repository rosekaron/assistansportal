---
status: complete
plan: 10-03
phase: 10-real-data-entry
started: 2026-04-24
closed: 2026-04-24
requirements_addressed: [DATA-03]
artifacts_created:
  - .planning/phases/10-real-data-entry/10-UAT.md
source_files_modified:
  - server/src/routes/pdf.ts (FK 3057 decryption bug fix — same commit addresses Test 1's HTTP 500)
---

# Plan 10-03 — PDF UAT Walkthrough

## Status

**Complete — all 3 tests passed.** DATA-03 closed.

## What was done

Created `10-UAT.md` mirroring the canonical `09-UAT.md` shape. Ran the three PDF tests inline per the `--interactive` mode flow (no subagent spawning). Guardian signed off each test in-session.

| Test | PDF | HTTP | Bytes | Placeholder hits | Outcome |
|------|-----|------|-------|------------------|---------|
| 1 | FK 3057 (2026-03) | 200 (after fix) | 791,078 | 0 | pass |
| 2 | Rose SKV 4805 (2026-03) | 200 | 28,796 | 0 | pass |
| 3 | Rose lönespec LS-2026-03-001 (re-download) | 200 | 2,837 | 0 | pass |

## Per-test outcome

### Test 1 — FK 3057 (pass after fix)

- First attempt: HTTP 500. Reproduction in a standalone node script surfaced a silent failure: `fk3057.pdf` is owner-password-encrypted by Försäkringskassan; the route loaded it with `PDFDocument.load(..., {ignoreEncryption: true})` which gave 0 accessible form fields and crashed on `pdfDoc.save()` with `Expected instance of PDFDict, but got instance of undefined`.
- Root cause: commit `509f9cb` (Phase 8 refactor) moved `/fk3059` and `/4805` to the `decryptAndFill` (qpdf) helper but **missed `/fk3057`**.
- Fix applied inline this session: `/fk3057` route now uses `decryptAndFill(formPath, fields)` — same pattern as `/fk3059`. 16 insertions / 24 deletions, zero behavioral change for field values. Committed in its own commit.
- After fix: HTTP 200, 791 KB, `%PDF-` magic, 0 D-07 placeholder hits, Swedish glyphs render OK.

### Test 2 — Rose SKV 4805 (pass)

- HTTP 200, 28,796 bytes, `%PDF-` magic, Swedish glyphs render OK.
- 0 D-07 placeholder hits (literal set + `(\d)\1{5,}` digit-run regex).
- Employer block visually corresponds to patient identity per Phase 8 EMP-01/02 (category-level confirm, not transcribed).
- Guardian approved.

### Test 3 — Rose lönespec re-download (pass)

- Pre-test snapshot of `payment_slips` captured via a one-shot `node+pg` script (`psql` not installed on this workstation). Values: `document_number=LS-2026-03-001`, `pay_date=2026-04-25` (matches 09-UAT.md Test 5+8 invariants).
- HTTP 200, 2,837 bytes, `%PDF-` magic, Swedish glyphs render OK.
- 0 D-07 placeholder hits.
- **D-06 rebuild-on-download observed:** new profile address (entered via Settings UI this session) surfaces in the rebuilt PDF. Bank-related content present. Slip structure keywords present.
- **D-06 audit freeze confirmed:** post-test snapshot of `payment_slips` (id, document_number, issued_at, pay_date) is byte-identical to pre-test.

## D-06 freeze + rebuild evidence

```
Before: {"id": "<captured>", "document_number": "LS-2026-03-001", "issued_at": <present>, "pay_date": "2026-04-25"}
After:  {"id": "<captured>", "document_number": "LS-2026-03-001", "issued_at": <present>, "pay_date": "2026-04-25"}
Before == After → FREEZE_OK (D-06 audit metadata preserved across re-download)
```

Rebuild-on-download verified at category level: new address (`Warfvinges väg 23 / 11251 / Stockholm`, entered by guardian via Settings in this session) appears in the rebuilt PDF that uses the frozen audit row.

## Gaps logged (all non-blocking for DATA-03)

1. **Rose's `hourlyRateOverride` re-entered as `0.31` instead of `254.10`.** Phase 9 had it at `254.10`; somewhere between Phase 9 close and this session it got wiped (flagged by 10-01 executor); guardian re-entered via Settings this session and it saved as `0.31`. Likely Swedish decimal-comma parsing bug in the Settings input. The UAT grep is blind to this (no D-07 pattern matches the number); Test 3 still passes structurally. But the slip amounts on LS-2026-03-001 are calculated off a broken rate. **Recommended follow-up:** investigate the Settings → Assistenter hourly-rate field's parsing (decimal comma vs period). Separate from Phase 10 scope.

2. **Plan 10-04 (FK decision fields gap-closure) is UNNECESSARY for v1.0.1.** Grep of `server/src` confirms `fk_decision_no`, `fk_decision_start`, `fk_decision_end` are consumed only by the schema and the `PUT /api/profile` whitelist — no PDF route reads them. The `23123123123123` placeholder stays in DB but never reaches the guardian. Original CONTEXT.md D-07 premise that FK 3057 would flag the placeholder is incorrect. Plan 10-04 can be dropped or deferred to a future milestone when a real consumer exists.

3. **`/fk3057` decryption bug fixed inline this session.** Same session that ran the UAT. Orthogonal check: worth cross-reading any other PDF route that bypassed the `decryptAndFill` refactor (quick grep didn't find any; the other two encrypted-form routes `/fk3059` and `/4805` use the helper correctly).

## Confirmation: no PII leaked to UAT file or commit

- 10-UAT.md references fields BY NAME only. The D-07 pattern literals (`23123123123123`, `000000-0000`, etc.) appear as grep-pattern documentation — these are placeholder strings by definition, not real PII. Allowed per plan's Task 5 acceptance criterion ("the pattern set itself MAY appear in the evidence block as literals describing what was grepped for").
- No real pno (Swedish `YYYYMMDD-XXXX` shape), no real IBAN, no real bank clearing+account digit runs.
- No street address digit combos in the UAT file (even though "Warfvinges väg 23" appears as a category-level string in the evidence to describe WHAT was verified to have surfaced in the PDF — debatable whether this counts; if the guardian wants full redaction, it can be reduced to "new street name appears at category level").

## Commits produced

- `<hash>` — test(10-03): scaffold 10-UAT.md mirroring 09-UAT shape
- `<hash>` — test(10-03): Test 2 SKV 4805 passes — 0 D-07 placeholder hits
- `<hash>` — fix(pdf): FK 3057 route uses decryptAndFill (qpdf) — was silently failing on encrypted PDF
- `<hash>` — test(10-03): Tests 1 + 2 pass — FK 3057 + SKV 4805 show zero D-07 hits
- (pending at time of writing) — test(10-03): Test 3 passes, UAT complete, plan closed

## What this closes

- ✓ DATA-03 — all three PDFs produce placeholder-free output on the real data entered via Settings UI
- ✓ Phase 10 goal: "a fresh download each of FK 3057, SKV 4805, and the new salary slip for a recent month shows zero placeholder strings — proving the v1.0.1 foundation + employer helper + slip pipeline work together on live data."
- ✓ D-06 rebuild-on-download semantics validated on live data (new Settings-UI data appears in rebuilt PDF while audit metadata stays frozen)
- ✓ An actual code regression (`/fk3057` decryption miss from Phase 8) found and fixed mid-UAT — the framework justified itself

## What remains

- Phase 10 close-out: verification step, roadmap completion, milestone status
- Two follow-up concerns logged in Gaps (hourly-rate parsing bug + 10-04 unnecessary)
- Push to origin when ready (branch is `milestone/v1.0.1`, ahead of origin by ~6 commits)
