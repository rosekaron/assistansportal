---
status: complete
phase: 04-tax-reporting-agi
source: [04-01-SUMMARY.md, 04-02-SUMMARY.md, 04-03-SUMMARY.md]
started: 2026-04-11T23:05:00Z
updated: 2026-04-11T23:06:00Z
---

## Current Test

[testing complete]

## Tests

### 1. Monthly page — 4-step stepper
expected: Navigate to http://localhost:5173/monthly. The progress stepper shows 4 steps: 1 Daily reports, 2 Payroll, 3 FK forms, 4 AGI (4805).
result: pass

### 2. Monthly page — Step 4 locked when payroll not fully approved
expected: If any payroll record is still in draft status, Step 4 shows a locked/dimmed state with the message "Approve all payroll records to unlock AGI download."
result: pass

### 3. Monthly page — Step 4 unlocked with per-assistant cards
expected: When all payroll records for the month are approved, Step 4 shows a grid of assistant cards. Each card shows the assistant name, gross pay, and estimated tax withheld.
result: pass

### 4. Monthly page — Download 4805 button state
expected: Approved assistant → button reads "Download 4805" and is clickable. Draft/unapproved assistant → button reads "Payroll pending" and is disabled (greyed out).
result: pass

### 5. Settings — Payroll Rates section visible
expected: Navigate to http://localhost:5173/settings. A "Payroll rates" section appears with a "Preliminary tax rate (preliminärskatt)" number input and a "Save rate" button.
result: pass

### 6. Settings — Prelim tax rate saves and persists
expected: Enter "30" in the preliminary tax rate input and click "Save rate". Reload the page — the field still shows "30".
result: pass

### 7. Settings — Assistant edit dialog has Address field
expected: In Settings > Active assistants, click the pencil (edit) icon on any assistant. The edit dialog contains an "Address" input field.
result: pass

### 8. Settings — Assistant address saves and persists
expected: Enter "Testgatan 1, 123 45 Stockholm" in the address field and save. Reopen the edit dialog for the same assistant — the address field shows the saved value.
result: pass

### 9. Download 4805 — button triggers PDF download
expected: With skv4805.pdf placed in forms/ and an approved payroll record for the current month: clicking "Download 4805" downloads a file named 4805-YYYY-MM-AssistantName.pdf. The PDF opens and shows the correct month name in Swedish, guardian name, and assistant name in their respective fields.
result: pass

## Summary

total: 9
passed: 9
issues: 0
pending: 0
skipped: 0
skipped: 0
blocked: 0

## Gaps

[none — Test 3 issue resolved: data issue (no payroll records for current month), not a code defect. April payroll generated and approved via API.]
