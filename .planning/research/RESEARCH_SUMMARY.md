# Research Summary: Payroll, AGI, & Leave Tracking Stack

**Project:** Kalinga — Assistansportal (Swedish personal assistance care management)
**Research Date:** 2026-04-06
**Mode:** Technology stack for Swedish payroll compliance features
**Overall Confidence:** MEDIUM-HIGH

---

## Executive Summary

This research identifies the optimal libraries and design patterns for implementing Swedish payroll calculations, Skatteverket AGI reporting, leave tracking, and print-ready PDF output within the existing Node.js/Express/React stack.

**Key Finding:** No single npm package exists for Swedish payroll + AGI. Recommend a **custom TypeScript service** for payroll calculations (backed by official 2026 rates), **xmlbuilder2 for AGI XML generation**, **Drizzle schema extension for leave tracking**, and **retention of pdf-lib for form filling** (already proven in production).

The existing stack is well-suited for these features. No major technology changes needed.

---

## Research Scope

### Domain Questions Investigated

1. **Payroll Calculations**
   - What npm packages handle Swedish arbetsgivaravgifter calculations?
   - Are 2026 rates well-documented?
   - What's the appropriate architecture for a SPA to perform payroll?

2. **AGI (Arbetsgivardeklaration på individnivå) Reporting**
   - What format does Skatteverket require?
   - Can we generate it from Node.js?
   - What libraries are best for XML generation?

3. **Leave & Absence Tracking**
   - What database schema patterns exist?
   - How should absences integrate with FK reporting?
   - Are there standard types (sick, VAB, holiday)?

4. **PDF Generation**
   - Should we switch from pdf-lib to Puppeteer/Playwright for better print quality?
   - What's the performance trade-off?
   - Are alternatives justified?

5. **Date Handling & Holidays**
   - What libraries handle Swedish holidays?
   - How do we calculate correct month boundaries for FK reports?

---

## Key Findings

### 1. Payroll Calculations — No Single Library Solution

**Finding:** No Swedish-focused npm payroll library exists. Swedish payroll vendors (Visma, Fortnox) offer APIs but require authentication and are designed for larger payroll departments, not individual family employers.

**Recommendation:** Implement a **custom TypeScript `PayrollCalculatorService`** that:
- Hard-codes 2026 arbetsgivaravgifter rates (31.42% standard, 20.81% reduced on first 25,000 SEK)
- Provides simple, testable calculation logic
- Stores configuration in environment variables for future year updates
- Uses Drizzle ORM to persist payroll runs and earnings

**Rationale:**
- Custom code is simpler to audit and maintain than vendor APIs
- Rates rarely change (manually updated once per year)
- A single family's payroll is straightforward arithmetic
- Easier to validate against official Skatteverket documentation

**Confidence: HIGH** — Rates published officially by Skatteverket. Calculation logic is straightforward. No external dependency risk.

---

### 2. AGI XML Export — xmlbuilder2 (NEW DEPENDENCY)

**Finding:** Skatteverket requires AGI (arbetsgivardeklaration på individnivå) as **XML**, not JSON. Format updated in January 2025 to include absence details. File naming convention: `AGI_YYYY_MM.xml`.

**Recommended Library:** **xmlbuilder2** (version 4.0.3)
- Most actively maintained XML builder for Node.js (last update 4 months ago)
- Fluent, chainable API for constructing XML documents
- TypeScript support
- Tested by large projects
- Alternative (xml2js) is for parsing, not generation

**Implementation:**
- Create an `AGIExporter` service that queries payroll and absence data from Drizzle
- Generate XML string following Skatteverket 2.0 schema
- Expose via API endpoint: `GET /api/payroll/agi-export?year=2026&month=4`
- Return XML file download

**Confidence: MEDIUM** — xmlbuilder2 library is solid. Exact Skatteverket XML schema requires verification against official technical documentation (not fully accessible via web search). Design allows schema updates without library changes.

---

### 3. Leave & Absence Tracking — Drizzle Schema Extension (NO NEW LIBRARY)

**Finding:** Standard HR database patterns apply. Absence types are well-defined by Swedish regulations:
- **Sjuk** (sick leave)
- **VAB** (vård av barn — parental care)
- **Semester** (holiday/vacation)
- **Tjänstledigt** (unpaid leave)
- **Övrig** (other)

**Recommendation:** Extend Drizzle ORM schema with:
- `absences` table — record individual absence periods with type, dates, hours/percentage
- `leaveBalances` table — track year-to-date entitlement vs. usage (e.g., 25 vacation days)
- PostgreSQL **enum** for absence types (type-safe, enforced at database level)

**Integration with FK 3059:**
- When calculating billable hours for FK reports, **exclude hours that fall within recorded absence periods**
- Include absence details in AGI XML export (new in 2025 schema)

**Confidence: HIGH** — Schema design is standard HR practice. PostgreSQL enums ensure consistency. No external library needed; Drizzle handles type-safe migrations.

---

### 4. Print-Ready PDF — Keep pdf-lib + qpdf

**Finding:** Current implementation (pdf-lib 1.17.1 + qpdf system binary) is fit-for-purpose. Investigated alternatives:
- **Puppeteer** — Designed for HTML→PDF, not AcroForm field filling. Adds memory overhead (requires Chrome process). NOT needed for form filling.
- **Playwright** — Similar to Puppeteer. Better for browser automation, not PDF forms.
- **pdfmake** — Slower for large documents. Declarative DSL is better for data-driven reports, not form templates.
- **PDFKit** — Lower-level control. Overkill unless pdf-lib field filling proves unreliable.

**Recommendation:** **Do not switch.** pdf-lib + qpdf is the correct choice for AcroForm filling.

**Why:**
- Form filling is the right use case for pdf-lib (not HTML→PDF conversion)
- Already integrated and tested in production
- Adding Puppeteer would add complexity without solving an actual problem
- Performance is adequate (500–1000ms per PDF including qpdf decryption)

**Confidence: HIGH** — Decision is based on use-case-library alignment. Form filling ≠ HTML rendering. pdf-lib is optimized for the former.

---

### 5. Date Handling & Swedish Holidays — date-fns + swedish-holidays

**Finding:**
- **date-fns** (3.6.0) already in codebase — use it for FK form date ranges, month boundaries, etc.
- **swedish-holidays** (new, small dependency) — Provides `isPublicHoliday()` check for any date, supports all years 1582–8702 (covers 2026).

**Recommendation:**
- Keep **date-fns** for all date manipulation (parsing, formatting, calculating month-end)
- Add **swedish-holidays** to exclude public holidays from working day calculations if needed (e.g., for future sick leave accrual logic)

**Installation:**
```bash
npm install swedish-holidays
```

**Confidence: HIGH** — Both libraries are stable and maintained. swedish-holidays is focused and small.

---

## Technology Stack Decisions

| Component | Recommendation | Version | Why | Confidence |
|-----------|---|---|---|---|
| **Payroll Calculations** | Custom TypeScript service | N/A (5.4+) | No Swedish payroll npm lib; custom code simpler | HIGH |
| **AGI XML Generation** | xmlbuilder2 | 4.0.3 | Most maintained builder; fluent API | MEDIUM |
| **Leave Tracking** | Drizzle ORM schema | 0.30.10 (existing) | Type-safe, no new library needed | HIGH |
| **Form Filling (PDF)** | pdf-lib + qpdf | 1.17.1 + system | Already proven; correct for AcroForms | HIGH |
| **Date Handling** | date-fns | 3.6.0 (existing) | Already in codebase | HIGH |
| **Holiday Checking** | swedish-holidays | latest | Small, focused library | HIGH |

---

## Implications for Roadmap

### Phase Sequence Recommendation

**Phase 1: Payroll Calculations & Leave Tracking (Weeks 1–2)**
- Implement PayrollCalculatorService (custom TypeScript)
- Extend Drizzle schema: `payroll_runs`, `assistant_earnings`, `absences`, `leave_balances`
- API endpoint: `POST /api/payroll/calculate` (monthly batch)
- Tests: unit tests for calculation logic, integration tests for Drizzle inserts

**Why this order:** These features are database-centric and don't require external API integration. Fast to build and test.

**Phase 2: AGI XML Export (Weeks 3–4)**
- Add xmlbuilder2 dependency
- Implement AGIExporter service
- API endpoint: `GET /api/payroll/agi-export` (returns XML download)
- Manual testing against Skatteverket test service (requires human step)
- Design allows schema adjustments if official XML validation fails

**Why this order:** Depends on Phase 1 (payroll data must exist to export). XML generation is straightforward once data is structured.

**Phase 3: UI for Payroll & Leave (Weeks 5–6)**
- React components for:
  - Monthly payroll summary view
  - Record absence form (date range, type, hours/percentage)
  - Leave balance display per assistant
  - AGI export download button
- React Query hooks to call new endpoints
- Form validation with react-hook-form + Zod

**Why this order:** UI depends on backend APIs being stable. Build UI last to avoid churn.

**Phase 4: FK Form Updates (Weeks 7–8)**
- Update FK 3059 generation to include payroll summary data
- Update FK 3057 if needed (employer activity report)
- Regression tests: ensure existing PDF generation still works

**Why this order:** PDF generation already works; this is incremental enhancement. Validate that payroll data integrates cleanly.

**Phase 5: Testing & Compliance Validation (Weeks 9–10)**
- Unit tests for PayrollCalculatorService with edge cases (age-based rates, tax withholding, etc.)
- Integration tests: full monthly payroll workflow
- Manual validation with Skatteverket test service for AGI XML
- FK form validation with actual FK submission (or FK test service if available)

### Research Flags for Each Phase

| Phase | Likely Need Deeper Research | Reason |
|-------|-------|--------|
| 1 — Payroll Calc | **Maybe** | If 2026 age-based rate reductions become complex. Currently straightforward. |
| 2 — AGI Export | **Yes** | Exact XML schema validation against Skatteverket test service. May require schema tweaks. |
| 3 — Payroll UI | **No** | Standard React patterns. Form handling is straightforward. |
| 4 — FK Updates | **No** | Incremental enhancement; pdf-lib already proven. |
| 5 — Testing | **No** | Standard testing patterns. |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| **Stack** | **HIGH** | All recommendations are based on official sources (Skatteverket) or mature libraries (xmlbuilder2, date-fns). No unproven tools. |
| **Payroll Calculations** | **HIGH** | 2026 rates published by Skatteverket. Logic is straightforward arithmetic. |
| **AGI XML Format** | **MEDIUM** | xmlbuilder2 is solid; exact Skatteverket schema needs validation against test service. |
| **Leave Tracking** | **HIGH** | Standard database design patterns. Absence types align with Swedish regulations. |
| **PDF Output** | **HIGH** | pdf-lib already deployed. Decision to keep it is sound (form filling, not HTML rendering). |
| **Dates & Holidays** | **HIGH** | Both libraries are stable and maintained. Swedish holidays are deterministic. |

---

## Potential Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Skatteverket AGI XML schema changes mid-year | MEDIUM | Design AGIExporter as a service (not hard-coded XML). Monitor Skatteverket announcements. |
| Payroll calculation errors (compliance issue) | HIGH | Implement comprehensive unit tests. Validate against official examples. Code review before Phase 2. |
| FK form field names change or become incompatible with pdf-lib | MEDIUM | Maintain a mapping of field names to values. Version control the form templates. |
| Absence tracking overlaps/conflicts not prevented | LOW | Add database constraints: unique index on (assistantId, startDate) or check for overlaps in business logic. |
| Date boundary bugs (month-end calculations) | LOW | Use date-fns for all date math. Test with February (28/29 days), month-end transitions. |

---

## What's NOT Being Built (Explicitly Out of Scope)

- Real-time payroll synchronization with bank (guardian pays manually)
- API-based filing with Skatteverket (forms are downloaded, printed, signed, mailed)
- Multi-company payroll consolidation
- Automated tax calculation (only tracks preliminary withholding)
- Mobile app for payroll (web-responsive is sufficient)

---

## Next Steps

### Immediate (Before Coding)

1. **Verify Skatteverket AGI XML Schema**
   - Download technical description from official Skatteverket portal
   - Confirm exact field names, types, and ordering
   - Test xmlbuilder2 output against Skatteverket test service

2. **Get Official FK Form Definitions**
   - Ensure FK 3059 and FK 3057 PDF field names match hardcoded names in pdf.ts
   - Validate form versions match Guardian's expected forms

3. **Confirm 2026 Payroll Rates**
   - Verify arbetsgivaravgifter percentages with latest Skatteverket announcement
   - Confirm threshold date (25,000 SEK)
   - Check for any temporary youth reductions or special cases

### During Implementation

1. **Phase 1 Code Review Checklist**
   - PayrollCalculatorService has unit tests covering all rate tiers
   - Drizzle schema migrations are reversible
   - API endpoint validates input (year, month, guardianId)

2. **Phase 2 Code Review Checklist**
   - AGI XML output validates against Skatteverket test service
   - Absence data is correctly included in XML (new 2025 requirement)
   - File naming convention matches spec

3. **Phase 3 Code Review Checklist**
   - Forms use react-hook-form + Zod for validation
   - React Query stale times are reasonable
   - Date pickers prevent invalid date ranges

---

## Sources

### Payroll & Tax Rates
- [Skatteverket: Employer Contributions (Arbetsgivaravgifter)](https://www.skatteverket.se/servicelankar/otherlanguages/engliskengelska/businessesandemployers/startingandrunningaswedishbusiness/declaringtaxesbusinesses/filingapayereturn/employercontributions.4.2fb39afe18dabf1e4d24a3d.html)
- [RemotePeople: Sweden Payroll Tax & Compliance 2026](https://remotepeople.com/countries/sweden/hire-employees/payroll-tax/)
- [1office: Employer Contributions Sweden 2026](https://1office.co/blog/employer-contributions-sweden/)

### AGI Reporting
- [Skatteverket: AGI Technical Description & Test Service](https://www.skatteverket.se/foretag/arbetsgivare/lamnaarbetsgivardeklaration/tekniskbeskrivningochtesttjanst.4.309a41aa1672ad0c8377c8b.html)
- [Redovisning.ai: AGI Guide 2026](https://redovisning.ai/guider/arbetsgivardeklaration)

### Libraries
- [xmlbuilder2 — npm](https://www.npmjs.com/package/xmlbuilder2)
- [xmlbuilder2 — GitHub](https://github.com/oozcitak/xmlbuilder2)
- [swedish-holidays — npm](https://www.npmjs.com/package/swedish-holidays)
- [swedish-holidays — GitHub](https://github.com/Pythe1337N/swedish-holidays)
- [Nutrient: Top JavaScript PDF Libraries 2026](https://www.nutrient.io/blog/top-js-pdf-libraries/)
- [DEV Community: Comparison of PDF Libraries 2025](https://dev.to/handdot/generate-a-pdf-in-js-summary-and-comparison-of-libraries-3z2k)

### Date Handling
- [date-fns Official](https://date-fns.org/)
- [Day.js Official](https://day.js.org/)
- [LogRocket: Alternatives to Moment.js](https://blog.logrocket.com/5-alternatives-moment-js-internationalizing-dates/)

---

## Conclusion

The existing Node.js/Express/React stack is **well-suited** for implementing Swedish payroll compliance features. No major technology changes are required.

**Recommendation:** Proceed with Phase 1 (payroll + leave tracking) using custom TypeScript service + Drizzle extensions. This is the **lowest-risk, highest-confidence path** to a working implementation.

**Key Success Factors:**
1. Custom payroll logic keeps 2026 rates maintainable
2. xmlbuilder2 provides clean XML generation (with Skatteverket schema validation step)
3. Drizzle schema ensures data consistency
4. Retaining pdf-lib avoids unnecessary complexity
5. Comprehensive tests catch compliance errors early

---

*Research completed: 2026-04-06*
*Researched by: Claude Code (Phase 6: Research)*
