# Feature Landscape: Swedish Personal Assistance (Assistansersättning) Management

**Domain:** Egenvald assistans (self-managed personal assistance) compliance and payroll for Swedish guardians

**Researched:** 2026-04-06

**Confidence:** MEDIUM-HIGH

The research surveyed Försäkringskassan (FK) guidance, Skatteverket tax reporting requirements, and existing assistance management platforms (Coordinare, FAST, Aiai). This categorization reflects what guardians managing their own assistants legally must handle vs. what competitive platforms offer beyond minimum compliance.

---

## Table Stakes

Features users expect because **the platform cannot be used for real compliance without them**. A guardian cannot file with FK or Skatteverket or manage payroll if these are missing.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| FK 3059 time report generation | Mandatory monthly submission to FK listing all hours worked per assistant. Deadline: 5th of second month following service month. | Med | Forms auto-populate from approved time entries; must exclude absence entries. Must support assistant digital signature (BankID). |
| FK 3057 cost/invoice report | Mandatory monthly cost summary submitted with FK 3059. Shows total paid to all assistants, cost per assistant. Required for FK payment processing. | Low | Auto-calculated from payroll summary. Must match guardian cost submission to FK. |
| Payroll calculation (gross per assistant) | Guardian must know and be able to prove hours × hourly rate = gross pay per assistant per month. Legally required for Swedish employment. | Low | Calculate from approved hours and configured rate. Must show work performed vs. absence separately. |
| Arbetsgivaravgifter (employer social security contributions) | Swedish law mandates 31.42% employer contribution on gross salary (standard rate for most employees). Must be calculated and paid separately from gross. Guardian must report this to Skatteverket. | Low | Fixed 31.42% rate on gross pay per assistant. Guardian needs to understand this is additional cost beyond salary. |
| AGI (arbetsgivardeklaration på individnivå) monthly tax report | Individual-level employer declaration filed monthly with Skatteverket by 12th of following month. Reports gross salary, employer contributions, and tax deductions per employee. Non-filing = automatic penalties (20-40% surcharge on undeclared amounts). | Med | Auto-generate from payroll data. Must include: employee personnummer, gross salary, withheld tax (preliminärskatt), employer contributions. Must be exportable for digital submission to Skatteverket or printable for postal submission. |
| Leave/absence tracking and categorization | Guardian must record and distinguish between: sick leave (sjukdagar), VAB (vård av barn, child care), holidays (semester), and other absences. These are **excluded from billable hours** in FK 3059 and 3057. New law (2024:1300) requires employers to report VAB absence to Skatteverket in AGI. | Med | Absence entries mark which hours are non-billable. Must auto-exclude from FK calculations. VAB, sick, and holiday must be tracked separately for AGI reporting. |
| Monthly cost overview and overspending prevention | Guardian is allocated a fixed monthly assistansersättning from FK. If actual costs exceed the allocation, guardian is liable for repayment. System must show current month spending vs. allocation and flag overspending risk. | Low | Real-time or daily rollup of approved hours × rate. Show remaining budget. Warn when projected month cost exceeds allocation. |
| Guardian and assistant authentication with role separation | Guardians and assistants have different system permissions. Only guardians can approve time, access payroll, file reports. Assistants can only log hours and view their schedule. | High | Already implemented. Verify enforced server-side (not just routing). |
| Monthly form submission checklist | Guardian needs to know the regulatory deadlines and what forms are due when. FK 3059+3057 due by 5th of second month. AGI due by 12th of following month. | Low | Calendar view or in-app reminder showing "FK forms due by X date", "AGI filing due by Y date". Indicates whether forms are ready, submitted, or overdue. |

---

## Differentiators

Features that are **not legally required** but provide competitive advantage over paper/spreadsheet or make the compliance workflow dramatically easier. These reduce the cognitive load on guardians and prevent errors.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Automated absence exclusion from FK forms | When an absence is marked, it's automatically removed from billable hours in FK 3059/3057 calculations. Guardian doesn't manually recount. | Low | Absence entries set `isBillable: false`. FK form generators skip non-billable rows. Reduces errors and manual recalculation. |
| Pre-filled AGI export in Skatteverket format | System generates a CSV or structured export that matches Skatteverket's expected AGI input format. Guardian can upload directly to Skatteverket e-service or forward to accountant with minimal manual adjustment. | Med | Must map internal payroll data to official AGI field structure (personnummer, gross, contributions, tax). Test against Skatteverket import requirements. |
| One-click form download bundle | Guardian can download all three forms (FK 3059, FK 3057, AGI) as a single PDF or a folder of files, print-ready, with signatures ready for assistant and guardian sign-off. | Med | Coordinate PDF generation (already exists for FK forms). Bundle for easy printing and physical filing/submission. |
| Payment tracking and reconciliation | Guardian logs actual payments made to assistants (e.g., "Paid Assistant A 50,000 SEK on 2026-04-15"). System compares against calculated gross pay and flags mismatches or late payments. | Med | Log payment date, amount, method per assistant. Compare to expected monthly gross. Alert if unpaid balance. Helps guardian verify money actually left the account. |
| Payroll summary report (per assistant, per month) | One-page view per assistant showing: hours worked, hours in absence (by type), gross pay, arbetsgivaravgifter, net pay (if applicable for display). Printable or exportable. | Low | Aggregate approved hours, apply rate, calculate 31.42% contribution. Format as invoice-like summary. Useful for transparency to assistants and for guardian's own records. |
| Monthly compliance checklist | In-app checklist: "Approve time entries [ ]", "Generate FK 3059 [ ]", "Generate FK 3057 [ ]", "Calculate AGI data [ ]", "Submit to FK by 5th [ ]", "Submit AGI to Skatteverket by 12th [ ]". Tracks completion and shows what's ready vs. pending. | Low | Static or semi-dynamic checklist linked to form generation status. Reduces cognitive load of remembering what's due. |
| Email or SMS reminders for filing deadlines | System sends guardian an email/SMS on a configured date (e.g., 1st of month) reminding them FK forms are due by 5th, AGI due by 12th. Includes direct link to relevant form. | Low | Cron job or scheduled notification. Configurable reminder dates. Low complexity but high UX value for busy guardians. |
| Multi-week schedule view (week/month grid) | Guardian sees all assistants' shifts in a single grid (week or month view), not individual schedules. Useful for capacity planning and ensuring coverage. | Med | UI component to render schedule matrix. Already conceptually in PROJECT.md scope. |
| Copy-previous-week schedule shortcut | Guardian can duplicate the prior week's schedule to new week with one click, then adjust. Reduces manual entry for recurring schedules. | Low | Duplicate shift records with new dates. Allow inline editing. High UX value, low complexity. |
| Cost projection for the month | Given current spending and days remaining, project total month cost. Alert if projected cost will exceed allocation. | Low | Simple math: (current cost / days elapsed) × days in month. Alert if projection > allocation. |
| Bulk absence entry | Guardian can mark multiple assistants as absent on the same day (e.g., "Office closed for holiday") rather than entering absence one-by-one. | Low | Multi-select assistants + single absence entry. Useful for holidays or team absences. |
| Import/export for multi-month audit | Guardian can export all forms and payroll records for a given month as a bundle (PDF, CSV). Useful for audits by FK or tax authorities. | Med | Package forms + payroll CSV + payment logs as downloadable zip. Critical for compliance documentation. |
| Sick leave and VAB accrual/balance tracking | Track remaining VAB days per assistant per year (max 120 days per child per year). Track used sick days (first 14 days paid by employer at 80%). Show available balance. | Med | Maintain accrual ledger per assistant. Display remaining balance. Warn if approaching limits. VAB complex because child-specific; sick leave simpler. |

---

## Anti-Features

Features to **deliberately NOT build** because they create liability, distract from core mission, or duplicate external systems better suited for the task.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Real-time chat between guardian and assistants | High complexity (messages, notifications, moderation), creates liability for platform (message disputes, conflicts), low value for compliance workflow. Assistants and guardians need to coordinate, but not via this system. | Use email or SMS. Recommend Slack, WhatsApp, or other established tools. Platform need not mediate this. |
| Integrated bank payment processing (ACH, Swish, direct debit) | High complexity + regulatory burden (PCI compliance, fraud liability). Guardians have their own bank accounts and can transfer payments manually. Platform should record payments logged by guardian, not move money. | Guardian manually transfers salary to each assistant's account. System records "payment made" for reconciliation, not actual transfer. |
| Expense/invoice receipt storage | Assistants or guardians upload receipts for meals, transport, equipment. Creates scope creep (image storage, security, audit) and is not part of FK or Skatteverket requirements. FK only cares about total hours and cost. | Guardians keep receipts in their own filing system. Platform focuses on time and cost summary, not receipt management. |
| Real-time budget alerts (SMS/email notifications for every transaction) | Overkill for most guardians. Monthly cost overview is sufficient. Real-time alerts add alert fatigue and operational overhead. | Monthly digest email with current spending vs. allocation. Daily or weekly budget view in app. No push notifications. |
| Multi-language support (English, Arabic, other languages) | FK and Skatteverket forms are Swedish-only by law. Training guardians in non-Swedish is out of scope. Swedish-only keeps UX focused and eliminates translation debt. | Swedish language only. If guardians need translation, they use external resources. |
| Direct API filing with FK or Skatteverket (e-filing without manual submission) | FK still requires physical signatures on FK 3059 (each assistant must sign). Skatteverket AGI can be filed digitally, but only by guardians with Swedish e-ID (BankID, etc.). System can't represent guardian in signing. Legal signature requirement makes end-to-end API integration infeasible for FK. | Generate forms in Skatteverket-compatible format. Guardian submits digitally via Skatteverket portal themselves (requires their BankID). FK forms print, sign, and mail. |
| Automated bank reconciliation (pulling transactions from guardian's bank) | Requires integrating with Swedish banks (Swedbank, SEB, Nordea APIs), which require separate agreements and security audits per bank. High friction, low ROI. Guardian manually records payment. | Guardian logs payments in system. System compares logged vs. expected. Mismatch alerts guide manual reconciliation. |
| Work environment agreements or conflict resolution tools | Assistants and guardians are in an employment relationship. Disputes over hours, pay, or conduct are employment matters, not platform matters. Platform is not an arbitrator. | Encourage guardians and assistants to use employment law resources or union (if assistant is unionized). Platform is administrative, not legal. |
| Scheduling optimization (AI/ML-driven shift recommendations) | Over-engineered for the domain. Most guardians have recurring schedules or know their needs. Complexity adds little value. | Manual scheduling UI. Copy-previous-week shortcut. Done. |
| Absence replacement/substitute assistant matching | Assistants call in sick; guardian finds a replacement. This is operational coordination, not compliance. Out of platform scope. | Guardians manage replacement via email/Slack. Platform just records absence and adjusted schedule. |

---

## Feature Dependencies

Some features logically depend on others. Implementation order should respect these:

```
Guardian Authentication
  ↓
Assistant Management (add/invite assistants)
  ↓
Scheduling & Time Entry (schedule shifts, log hours)
  ↓
Time Approval (guardian approves hours)
  ↓
Payroll Calculation (hours × rate + arbetsgivaravgifter)
  ↓
FK 3059/3057 Form Generation (depends on payroll)
  ↓
AGI Report Generation (depends on payroll + leave data)

Leave Tracking (categorize absences)
  ↓
Payroll Calculation (must exclude non-billable hours)
  ↓
FK Form Exclusions (auto-exclude absences)

Payment Recording (log actual payments)
  ↓
Payment Reconciliation (compare logged vs. expected)

Form Bundle Export
  ↓
Requires: FK 3059, FK 3057, AGI all generated first
```

---

## MVP Recommendation

**Prioritize for first compliance cycle:**

1. **Payroll calculation with arbetsgivaravgifter** (Med complexity) — Guardian must calculate and pay contributions correctly. Missing this = incorrect AGI filing and potential back-taxes.
2. **AGI export in Skatteverket format** (Med complexity) — Monthly AGI filing is mandatory. Currently missing. High impact on compliance risk.
3. **Leave/absence tracking with FK exclusion** (Med complexity) — Absence handling is complex and critical. Manual recalculation is error-prone. New law (2024:1300) requires VAB reporting.
4. **Monthly compliance checklist** (Low complexity) — Minimal effort, high UX value. Guides guardian through all required steps.
5. **Payment recording and reconciliation** (Med complexity) — Guardian needs to verify payments went out. Helps with audits and detecting overpayment.

**Defer (post-MVP, but important):**

- **Payroll summary report per assistant** — Can be generated on-demand from payroll data. Not blocking compliance, but nice to have for transparency.
- **Sick leave / VAB balance tracking** — Complex accrual logic. Post-MVP refinement. Can use simpler manual tracking initially.
- **Multi-week schedule grid** — Nice to have for guardian UX. Current individual schedule view is sufficient for MVP.
- **Bulk absence entry** — Convenience feature. Can use single-entry form initially.
- **Email reminders** — Helpful but not blocking. Can be manual email from guardian's own calendar initially.

---

## Regulatory Context Summary

**Försäkringskassan (FK):**
- Guardian must submit FK 3059 (time report) and FK 3057 (cost/invoice) monthly.
- Deadline: 5th of second month following service month.
- Time reports must be signed by each assistant (digitally via BankID or physically).
- Absence must be documented and excluded from billable hours. New rule (2024:1300) requires VAB absence reported separately to Skatteverket.

**Skatteverket (Tax Authority):**
- Individual employers (guardians managing their own assistants) must file AGI (arbetsgivardeklaration på individnivå) monthly.
- Deadline: 12th of month following payment month.
- Must report per assistant: gross salary, employer contributions (31.42%), tax deductions (preliminärskatt if withheld).
- Non-filing or incorrect filing = automatic penalties (20-40% surcharge on undeclared amounts) + interest accrual.

**Employment Law:**
- Guardians are employers. Assistants are employees.
- Gross pay = hours worked × hourly rate. Employer contributions = 31.42% of gross (standard rate; reductions apply for employees 67+, ages 19-23 as of April 2026).
- Sick leave (first 14 days): employer pays 80% of wage. From day 15-90: employee applies for sickness benefits from FK.
- VAB (vård av barn): employee entitled to leave for child care up to 120 days/year. Guardian continues paying salary during VAB (but VAB is reported to tax authorities separately).
- Holidays: Employees entitled to 25 working days/year. Accrual period April-March.

**Compliance Risk:**
- FK is increasing audit scrutiny. Cost overspending, undocumented hours, or incorrect form submissions can result in recovery claims (återkrav) of multi-million SEK amounts.
- Guardians are liable for repayment if assistansersättning is used for non-compliant purposes (e.g., paying for administration when those costs should be covered by other means).
- Legal insecurity: FK assessments can be inconsistent, but platform can mitigate by ensuring all forms are correctly filled and submitted on time.

---

## Sources

- [Försäkringskassan — Assistansersättning vägledning 2003:6 Version 35](https://www.forsakringskassan.se/download/18.7b234aa517b3a0b7f372a5/1765877448325/assistansersattning-vagledning-2003-06.pdf) — Official guidance (Swedish)
- [Försäkringskassan — Privat assistansanordnare (Self-managed assistance)](https://www.forsakringskassan.se/myndigheter-och-samarbetspartner/for-dig-som-ar-assistansanordnare/privat-assistansanordnare)
- [Försäkringskassan — Instruktionsfilmer (instructional videos on time reporting)](https://www.forsakringskassan.se/privatperson/funktionsnedsattning/assistansersattning-for-vuxna/for-dig-som-anstaller-assistenter-sjalv/instruktionsfilmer-om-tidsredovisning-och-anmalan-om-assistenten)
- [Skatteverket — Arbetsgivardeklaration på individnivå (AGI)](https://www.skatteverket.se/foretag/arbetsgivare/lamnaarbetsgivardeklaration.4.41f1c61d16193087d7fcaeb.html) — Official tax filing guide
- [Skatteverket — Employer contributions](https://www.skatteverket.se/servicelankar/otherlanguages/englishengelska/businessesandemployers/startingandrunningaswedishbusiness/declaringtaxesbusinesses/filingapayereturn/employercontributions.4.2fb39afe18dabf1e4d24a3d.html)
- [Redovisning.ai — AGI guide 2026](https://redovisning.ai/guider/arbetsgivardeklaration) — Commercial accounting guide
- [Fortnox — AGI documentation](https://www.fortnox.se/fortnox-foretagsguide/driva-foretag/lon/allt-om-arbetsgivardeklaration-pa-individniva-agi)
- [Assistanskoll — Personal assistance information portal](https://assistanskoll.se/) — Swedish advocacy/information site for assistance users
- [Coordinare — Assistance management platform](https://www.coordinare.se/sv) — Existing competitor system (Swedish)
- [FAST system — Personal assistance management](https://fasttid.se/) — Existing competitor system
- [Aiai — Assistance administration and scheduling system](https://aiai.se/) — Existing competitor system
- [Swedish labor law and VAB/sick leave references](https://www.informationsverige.se/en) — Information om Sverige (Swedish employment law)
- [Swedish Annual Leave Act 1977:480](https://www.government.se/contentassets/eaf3467d4f484c9fb7274a067484c759/1977_480-annual-leave-act.pdf)
- [CE Sweden — Arbetsgivardeklaration filing guide](https://www.ce.se/a-step-by-step-guide-to-filing-your-arbetsgivardeklaration-employers-return-with-skatteverket/)
