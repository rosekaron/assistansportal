# Requirements: Kalinga — Assistansportal

**Defined:** 2026-04-06
**Core Value:** The guardian can complete the full monthly compliance cycle — approve hours, generate all required forms, calculate pay — without needing an HR department or assistance company.

---

## v1 Requirements

### Stability & Correctness

- [ ] **STAB-01**: Server enforces role separation — assistants cannot call guardian-only API endpoints (role middleware applied to all protected routes)
- [ ] **STAB-02**: FK 3057 date range uses the correct last day of the reporting month (not hardcoded day 31)
- [ ] **STAB-03**: FK hourly rate and employer tax rate (arbetsgivaravgifter) are configurable in Settings, not hardcoded in source code
- [ ] **STAB-04**: API response types are defined in TypeScript — camelCase field access is consistent throughout client codebase (no silent snake_case fallbacks)

### Leave & Absence

- [ ] **LEAV-01**: Guardian can record an assistant absence with type (sick leave / sjukfrånvaro, VAB / vård av barn, holiday / semester, other), start date, and end date
- [ ] **LEAV-02**: Hours marked as absence are automatically excluded from billable hours in FK 3059 and FK 3057 calculations
- [ ] **LEAV-03**: Guardian can view remaining VAB days (max 120/year) and sick leave balance per assistant

### Payroll

- [ ] **PAY-01**: System calculates gross pay per assistant for a given month (approved billable hours × configured hourly rate) and employer social security contributions (arbetsgivaravgifter, 31.42% standard rate)
- [ ] **PAY-02**: Guardian can view a payroll summary per assistant per month showing: billable hours, absence hours by type, gross pay, employer contributions, and total employer cost
- [ ] **PAY-03**: Guardian can record a payment made to an assistant (date, amount, method) and the system shows outstanding balance versus calculated gross

### Tax Reporting (AGI)

- [ ] **TAX-01**: System generates AGI (arbetsgivardeklaration på individnivå) data per assistant for a given month, including: personnummer, gross salary, employer contributions, and withheld preliminary tax (preliminärskatt) if configured
- [ ] **TAX-02**: Guardian can download the AGI report in Skatteverket-compatible format (XML or structured export) ready for submission via the Skatteverket e-service

### Scheduling

- [ ] **SCHED-01**: Guardian can view a multi-assistant week grid showing all assistants' scheduled and logged shifts in a single calendar view

### Compliance Workflow

- [ ] **COMP-01**: Guardian sees a monthly compliance checklist showing required steps (approve time entries, generate FK 3059, generate FK 3057, generate AGI) with completion status and due dates (FK: 5th of second following month; AGI: 12th of following month)
- [ ] **COMP-02**: System sends an email reminder to the guardian on a configurable date each month with links to pending FK and AGI forms

---

## v2 Requirements

These are part of the roadmap but deferred after v1.

### Scheduling & UX

- **SCHED-02**: Guardian can copy the previous week's schedule as a starting point for a new week
- **SCHED-03**: Guardian can mark multiple assistants absent on the same day in a single operation (bulk absence entry)

### Payroll & Finance

- **PAY-04**: System compares logged payments against calculated gross pay and flags outstanding or overpaid balances per assistant (reconciliation view)
- **PAY-05**: Guardian can project the current month's total cost based on hours to date and flag if the projection exceeds the FK allocation

### Compliance & Reporting

- **COMP-03**: Guardian can download a monthly form bundle (FK 3059, FK 3057, and AGI export) as a single packaged download
- **COMP-04**: Guardian can export all payroll records and form data for a given month as a compliance archive (PDF + CSV) for audit purposes

### Multi-Tenant

- **MULTI-01**: A second guardian account can register and operate fully independently, with all data scoped to their account at the database query level

### Guardian-as-Assistant (Dual Role)

- **ROLE-01**: A guardian who also works as an assistant can use a separate assistant account for v1; the system supports this two-account workflow without special handling

---

## Out of Scope

| Feature | Reason |
|---------|--------|
| Dual-role account (guardian + assistant same login) | Deferred to v2 — guardian uses separate assistant account for now; dual-role needs schema + auth rework |
| Real-time chat between guardian and assistants | High complexity, creates liability, not part of compliance workflow — use WhatsApp or email instead |
| Integrated bank payment processing | PCI compliance burden, guardians pay manually; platform records payments, doesn't move money |
| Receipt/expense document storage | Not required by FK or Skatteverket; out of compliance scope |
| Direct API e-filing with FK | FK still requires physical assistant signatures on 3059; postal submission is mandatory |
| Multi-language support | FK and Skatteverket forms are Swedish-only; platform is Swedish-only for v1 |
| Scheduling optimization (AI-driven) | Over-engineered; manual scheduling + copy-week shortcut is sufficient |
| Absence replacement / substitute matching | Operational coordination, not compliance; handled via guardian's own communication tools |
| Automated bank reconciliation (bank API integration) | Requires bank-specific agreements and security audits; manual payment logging is sufficient |

---

## Traceability

Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| STAB-01 | — | Pending |
| STAB-02 | — | Pending |
| STAB-03 | — | Pending |
| STAB-04 | — | Pending |
| LEAV-01 | — | Pending |
| LEAV-02 | — | Pending |
| LEAV-03 | — | Pending |
| PAY-01 | — | Pending |
| PAY-02 | — | Pending |
| PAY-03 | — | Pending |
| TAX-01 | — | Pending |
| TAX-02 | — | Pending |
| SCHED-01 | — | Pending |
| COMP-01 | — | Pending |
| COMP-02 | — | Pending |

**Coverage:**
- v1 requirements: 15 total
- Mapped to phases: 0 (pending roadmap)
- Unmapped: 15 ⚠️

---
*Requirements defined: 2026-04-06*
*Last updated: 2026-04-06 — initial definition*
