---
status: partial
phase: 08-employer-representation-helper
source: [08-VERIFICATION.md]
started: 2026-04-19T08:42:00Z
updated: 2026-04-19T08:42:00Z
---

## Current Test

[awaiting human testing — deferred to Phase 10 DATA-01 per CONTEXT D-14]

## Tests

### 1. FK 3057 visual regeneration (SC-1)
expected: Brukare section shows patient name + patient pno (unchanged); Signature "Namnteckning" row shows guardian name (D-09); No employer/Anordnaren field on FK 3057 per D-10
result: [pending]

### 2. FK 3059 visual regeneration (SC-1)
expected: `flt_txtNamnAnordnaren[0]` (Anordnaren / employer name) shows patient name (Phase 8 change); `flt_txtKontaktperson[0]` shows guardian name (D-09); `flt_txtNamnteckning2[0]` (employer signature) shows guardian name (D-09)
result: [pending]

### 3. SKV 4805 visual regeneration (SC-1)
expected: Employer block (`txtNamn[0]` index 0) shows patient name, patient pno, patient address (Phase 8 change via `__employer__` prefix dispatch); Recipient block (`txtNamn[0]` index 1) shows assistant name, pno, address (unchanged); Signature clarification (`txtNamnfortydl[0]`) shows guardian name (D-09)
result: [pending]

### 4. Adult-with-override integration round-trip
expected: In Settings → Profile, set patient pno to an adult date, toggle `patient_requires_representative = true` → save → generate SKV 4805. Helper returns `företrädare` non-null; Phase 8 PDFs show patient as employer + guardian as signer (correct pre-Phase-9 behavior). Phase 9 will render the "Företrädd av" line on the salary slip.
result: [pending]

## Summary

total: 4
passed: 0
issues: 0
pending: 4
skipped: 0
blocked: 0

## Gaps
