# Domain Pitfalls: Swedish LSS Assistansersättning Payroll & Compliance

**Domain:** Swedish personal assistance (assistansersättning) self-management platform with FK 3057/3059 form generation, AGI reporting, and payroll calculation.
**Researched:** 2026-04-06
**Confidence:** MEDIUM (validated against existing codebase issues; Swedish regulatory details from official sources, general payroll patterns; specific LSS calculation rules need phase-specific validation)

---

## Critical Pitfalls

These mistakes cause data loss, regulatory non-compliance, or major rewrites.

### Pitfall 1: Guardian Data Leaking Across Multi-Tenant Boundaries

**What goes wrong:**
One guardian's payroll data, time entries, assistant profiles, or payment records become visible to another guardian. A query lacking proper `guardian_id` filtering, a race condition in batch processing, or a bug in JWT parsing allows assistant accounts to access guardian-only endpoints.

**Why it happens:**
- Initial single-tenant development skips consistent `guardian_id` filtering at the query layer
- Role middleware (`requireGuardian`) is defined but never applied server-side — only client-side routing prevents assistants from calling guardian endpoints
- Multi-tenant data scoping is only enforced at the routing layer, not at the database query level
- Shared cache keys (e.g., `latest_dashboard_stats`) used for multiple tenants result in data overwrites when batch jobs run concurrently
- Developers assume "requireAuth" is sufficient; it's not — it only verifies a token exists, not which tenant it belongs to

**Consequences:**
- Guardian A sees Guardian B's assistant hours and payroll records
- Assistant breach: a malicious or curious assistant calls `/api/entries` or `/api/pdf/fk3057` and retrieves all guardian data
- Regulatory violation: Skatteverket or FK may detect duplicate/impossible assistant IDs or payment records in submissions
- If data mutation occurs (assistant updates entries for another guardian), the dual-guardian account becomes unusable without manual database cleanup
- Massive liability exposure in a compliance-sensitive domain

**Prevention:**
1. **Enforce role middleware server-side:** Apply `requireGuardian` to ALL guardian-only routes; apply `requireAssistant` + `req.assistantId` scoping to all assistant routes.
2. **Parameterize all queries by guardian_id:** At the Drizzle ORM layer, every `.select()` on user data must include `.where(eq(table.guardian_id, guardianId))`.
3. **Unit test data scoping:** For every route, verify that user A cannot access user B's data even with a valid token.
4. **Establish a "data isolation test" suite:** Before payroll/AGI features launch, run concurrent requests from two guardians and verify zero cross-tenant data leakage.
5. **Use explicit tenant context in queries:** Pass `guardianId` from JWT to every database query function; never rely on implicit context.
6. **Audit role enforcement:** Run a code scan to verify every endpoint under `/api/` that touches user data has either `requireGuardian` or `requireAssistant` + tenant scoping.

**Detection:**
- Manual test: Register two guardian accounts, create entries/assistants in both, verify account A cannot GET account B's data.
- Automated test: Create a test suite that spawns concurrent requests from two different JWT tokens and verifies response isolation.
- Log monitoring: Add audit logs to every endpoint that writes payroll-related data; monitor for cross-tenant writes.
- Code review flag: Every new route or query must pass a "tenant scoping" checklist.

**Phase:** Should be addressed in **Stability & Correctness phase** before payroll feature ship. Multi-tenant data isolation must be proven before Skatteverket reporting.

---

### Pitfall 2: FK Form Date Range Bugs Cause Incorrect Assistance Hours Reporting

**What goes wrong:**
FK 3057 (invoice/hours report) uses hardcoded `day 31` to compute month-end dates: `lte(entries.date, "${year}-${mm}-31")`. This causes:
- **February overage:** If an entry exists on 2026-02-28, the query `<= 2026-02-31` (invalid date) produces undefined behavior in SQL or incorrectly includes/excludes the entry.
- **Short-month inclusion:** April has 30 days, but the filter `<= 2026-04-31` may include May entries by accident or miss April 30 entirely depending on database behavior.
- **Double-billing:** If May entries are included in April's FK 3057, the guardian submits duplicate hours to Försäkringskassan.
- **Under-reporting:** If the 31st of a short month is excluded, legitimate assistance hours are not invoiced.

**Why it happens:**
- Hardcoded numeric dates are brittle; FK 3059 (time tracking form) correctly uses dynamic `daysInMonth` calculation, but FK 3057 does not.
- Developer assumed all months have 31 days or that SQL would silently handle invalid dates.
- No test coverage for February or months with 30 days — the bug only manifests monthly and may be invisible in single-month test data.

**Consequences:**
- Assistance hours not paid to assistants (underpayment, regulatory breach under Swedish employment law)
- Overpayment if May entries leak into April submission (financial exposure, FK audit flag)
- FK rejects the form as malformed or flags the guardian account for manual review
- If Skatteverket cross-checks FK data against AGI reports, date discrepancies trigger tax authority investigation
- Guardian loses trust in the platform; re-enters data manually, defeating automation value

**Prevention:**
1. **Use proper date math:** Replace hardcoded `"${year}-${mm}-31"` with `lastDayOfMonth(year, month)` or equivalent using a library like `date-fns` or `dayjs`.
2. **Test month-end edge cases:** Create regression tests for Feb 28, Feb 29 (leap year), April 30, Dec 31.
3. **FK 3057 date calculation audit:** Verify the exact algorithm matches FK's official guidance document (link: https://assistanskoll.se/_up/ifyllnad-3057.pdf).
4. **Cross-check against FK 3059:** Both forms must use the same month-end logic; if they diverge, one will be wrong.
5. **Add a "date range" parameter check:** Log the actual start/end dates used in every FK form generation; compare to the calendar month in the form header.

**Detection:**
- February test failure: Generate FK 3057 for February; verify it does not include March entries.
- April test failure: Generate FK 3057 for April; verify it does not include May entries.
- Unit test: `test('FK3057 date filter for Feb 2026', () => { ... expect(dateFilter).toBe('2026-02-28') ... })`
- Manual audit: Print the SQL WHERE clause and verify it matches calendar math.

**Phase:** Critical bug in **Stability & Correctness phase**. Must be fixed before any FK form generation in production.

---

### Pitfall 3: Hardcoded FK Hourly Rate and Employer Tax Rate Cause Annual Deploy Cycle

**What goes wrong:**
FK hourly rate (334 SEK per assistance hour in 2026) and employer tax rate (31.42% arbetsgivaravgifter) are hardcoded in the client-side Reports page component. When Försäkringskassan updates the rate (annually), the guardian's payroll calculations become incorrect until the code is re-deployed.

- **Rate change Feb 2026:** FK updates the hourly rate to 340 SEK. The system still calculates payroll at 334 SEK until next deploy.
- **Tax rate change:** Swedish employer contribution rates can shift (e.g., youth reduction from April 2026); if the platform hardcodes 31.42%, it will not reflect the reduced rate for young employees.
- **Silent calculation error:** The guardian does not see a warning that rates are stale; paychecks are generated at the old rate, assistants are underpaid, and the error is only discovered during reconciliation or tax filing.

**Why it happens:**
- Rapid prototype MVP hardcoded these values; migration to a configurable `settings` table was deferred as tech debt.
- Frontend developer assumed rates change infrequently and that updating code was acceptable.
- No alerting mechanism warns guardians when rates are out of date.

**Consequences:**
- Assistants underpaid or overpaid depending on direction of rate change.
- FK invoicing uses the official rate, but the guardian's payroll calculations use stale rates — reconciliation fails.
- If AGI is filed with incorrect employer tax rates, Skatteverket flags the account for audit.
- Guardian must manually recalculate payroll for affected months, defeating automation value.
- Assistants lose confidence in pay accuracy; potential labor disputes.

**Prevention:**
1. **Move FK rates to `settings` table:** Implement a Settings page where guardians can view and update `fk_hourly_rate`, `employer_tax_rate`, and other configurable compliance parameters.
2. **Add rate-change alerting:** When the platform detects a rate change (manual setting update or system default update), notify the guardian and require explicit acknowledgment before payroll is calculated.
3. **Audit trail for rate changes:** Log every rate change with timestamp, old/new values, and who changed it (system, user, or FK authority).
4. **Validate rates against official sources:** At startup or monthly, fetch the official FK hourly rate and tax rates; warn if local rates diverge.
5. **Version payroll calculations:** Include `fk_rate_version` and `tax_rate_version` in every payroll record so historical corrections can be audited.

**Detection:**
- Code review: Grep for hardcoded numeric rates; any found should be moved to config.
- Test: Create payroll for a known rate, change the rate in settings, recalculate, and verify the new rate is used.
- Monitoring: Alert if `settings.fk_hourly_rate` is not updated within 30 days of an official FK rate change announcement.

**Phase:** **Payroll calculation phase**. Must be addressed during payroll feature implementation.

---

### Pitfall 4: Absence/Leave Deductions Not Properly Excluded from FK and AGI Reporting

**What goes wrong:**
Assistants record absences (sick leave, VAB, holiday) but the guardian forgets to flag them as "non-billable hours" or the system does not properly exclude them from FK form generation. The platform submits invoices to FK that include hours the assistant was absent, inflating claimed assistance costs.

- **Scenario:** Assistant logs 40 hours in April, but 5 of those hours were sick leave. The guardian records the absence but FK 3057 still includes all 40 hours as billable assistance.
- **FK rejection:** FK notices the invoiced hours exceed reasonable assistance limits for the person's condition and rejects the claim for manual review.
- **AGI over-reporting:** If AGI is filed with inflated hours, the employer tax and wage deductions are overstated, triggering Skatteverket audit.

**Why it happens:**
- Absence tracking is a new feature; existing entry records lack an `absence_type` field.
- The system calculates "billable hours" but does not properly subtract absence hours before generating forms.
- Guardian UI does not visually separate absence entries from worked hours.
- No validation prevents invoicing entries marked as absence.

**Consequences:**
- FK rejects the invoice for manual review, delaying payment.
- Skatteverket audit if AGI is filed with inflated wages and employer contributions.
- If detected after payment, FK may require repayment of incorrectly invoiced amounts.
- Guardian loses trust; manually recalculates forms, defeating automation.

**Prevention:**
1. **Absence type field mandatory:** Add `absence_type` enum (SICK, VAB, HOLIDAY, NONE) to entries table; make it required, default NONE.
2. **Billable hours calculation:** Compute `billable_hours = total_hours - absence_hours` explicitly in payroll and form generation logic.
3. **Visual separation in UI:** On the Hours page, display absence entries in a distinct color/section; clearly label them "Not billable."
4. **Form generation validation:** Before generating FK 3057, validate that `absence_hours` is accounted for; fail the form generation with a clear error if absent hours > 0 and `billable_hours` is not recalculated.
5. **Absence policy guidance:** Document Swedish rules (25 paid vacation days/year, 90 days sick leave with 80% pay from employer after 1-day deductible, VAB, etc.) in the guardian UI.

**Detection:**
- Unit test: Create entry with `absence_type='SICK'`, generate FK 3057, verify it is not included in billable hours.
- Integration test: Create a full month with 10 hours sick leave, verify FK 3057 shows `total_billable_hours = monthly_hours - 10`.
- Audit trail: Log every entry's `absence_type` in the form generation output for manual verification.

**Phase:** **Leave & Absence phase**. This feature has regulatory impact and must be tested thoroughly before any FK filing.

---

### Pitfall 5: Field Name Inconsistency (camelCase vs snake_case) Causes Silent Data Access Bugs

**What goes wrong:**
The API returns camelCase field names (Drizzle ORM default) but client code defensively checks both camelCase and snake_case: `e.reqStatus ?? e.req_status`. Over time, developers forget which is correct, some pages use only snake_case, and when the field name shape changes, bugs surface silently instead of failing at compile time.

- **Current bug:** Hours page accesses `e.req_status` (snake_case) but API returns `e.reqStatus` (camelCase), so `pendingReps` count is always 0.
- **Future bug:** If a developer refactors to return snake_case, pages using only camelCase will break without warning.

**Why it happens:**
- Initial ORM setup used Drizzle defaults (camelCase); form filling logic expects snake_case.
- No TypeScript types defined for API responses — everything is `Record<string, any>`.
- Field name inconsistency is treated as a "minor cosmetic issue" rather than a data integrity bug.

**Consequences:**
- Hours page displays incorrect pending entry counts, leading guardians to think entries are missing.
- If payroll calculations use the wrong field name, gross pay may be calculated from the wrong hours.
- Regressions introduced silently; no compile-time error when field names change.
- Debugging becomes difficult because type-checking provides no safety net.

**Prevention:**
1. **Establish a single naming convention:** Choose camelCase or snake_case for the entire stack. Drizzle defaults to camelCase for database returns; use it consistently.
2. **Define TypeScript types for all API responses:** Export interfaces from `server/src/db/schema.ts` or create `shared/types.ts` with proper response types for every endpoint.
3. **Remove all fallback checks:** Once types are defined, use only the correct field name; remove `field ?? field_snake` patterns.
4. **Strict type checking:** Enable `noImplicitAny` and `strictNullChecks` in `tsconfig.json` to catch undefined field accesses at compile time.
5. **API contract test:** For each endpoint, define expected response shape and validate against it in tests.

**Detection:**
- TypeScript strict mode error: "Property 'req_status' does not exist on type 'Entry'."
- Code review: Flag any field access with `??` fallback as a code smell.
- Test: Generate response, attempt to access wrong field name, expect compile-time error.

**Phase:** **Stability & Correctness phase**. This is tech debt that blocks safe refactoring of payroll-related fields.

---

## Moderate Pitfalls

These cause operational friction or compliance issues but not immediate data loss.

### Pitfall 6: Role Middleware Not Enforced Server-Side

**What goes wrong:**
The `requireGuardian` and `requireAssistant` middleware functions are defined in `server/src/middleware/auth.ts` but never applied to any routes. All endpoints rely only on `requireAuth`, which passes for any authenticated user (guardian or assistant).

**Consequences:**
- An authenticated assistant can call `POST /api/entries`, `DELETE /api/assistants/:id`, `GET /api/pdf/fk3057` and execute guardian-only operations.
- Client-side routing redirects assistants away, but the server has no enforcement.
- In a multi-tenant scenario, data scoping bugs combined with missing role checks are catastrophic.

**Prevention:**
Apply `requireGuardian` to all guardian-facing routes; apply `requireAssistant` to assistant self-service routes.

**Phase:** **Stability & Correctness phase**, before payroll features.

---

### Pitfall 7: AGI and Skatteverket Field Format Mismatches

**What goes wrong:**
Skatteverket's AGI (arbetsgivardeklaration på individnivå) report has strict formatting requirements for wage amounts, dates, tax deductions, and employee IDs. If the platform generates AGI with misaligned decimal places, malformed dates, or truncated employee names, Skatteverket rejects the submission and flags the account for manual review.

**Why it happens:**
- AGI field specifications are complex and change with tax law updates; developers may implement an outdated version.
- Rounding of wage amounts (e.g., 1234.567 SEK truncated to 1234.56 vs. rounded to 1234.57) differs between systems.
- Date format (2026-04-06 vs. 06-04-2026 vs. 060426) may not match Skatteverket's parser.
- Employee ID field may have length constraints; if an assistant's name exceeds the field width, data is truncated silently.

**Consequences:**
- Skatteverket rejects the AGI submission as malformed.
- Guardian must manually re-file, losing automation value.
- Tax agency investigation if format errors are repeated across multiple submissions.
- Wage and tax reporting delays if not resolved quickly.

**Prevention:**
1. **Validate AGI output against Skatteverket schema:** Define a schema (JSON, XSD, or informal spec) for AGI fields; validate every generated AGI before allowing download.
2. **Test against real Skatteverket test environment:** If available, submit test AGI to Skatteverket's staging API to verify format acceptance.
3. **Document all field requirements:** Create a mapping table for every AGI field (name, format, length, decimal places, date format) and reference it in code comments.
4. **Regression test for field formats:** Create test data with edge cases (long names, fractional wages, leap year dates) and verify AGI output formatting.

**Detection:**
- Skatteverket rejects submission with format error message.
- Manual inspection: Generate AGI, compare field-by-field against official template.
- Automated test: Parse generated AGI, verify field lengths, date formats, decimal places.

**Phase:** **Skatteverket Reporting phase**. Must be validated before any real AGI filing.

---

### Pitfall 8: Multi-Assistant Payroll Summary Doesn't Aggregate Correctly

**What goes wrong:**
When the guardian views a monthly payroll summary covering multiple assistants, the system fails to correctly aggregate hours, gross pay, or employer contributions. This can happen if:

- Aggregate queries use `GROUP BY` without proper filters, combining data across multiple guardians.
- Floating-point math accumulates rounding errors across multiple assistants (e.g., 10 assistants × 0.1 SEK rounding error = 1 SEK discrepancy).
- Assistant records are soft-deleted but still included in aggregates.
- Absence hours are not properly subtracted before aggregation.

**Consequences:**
- Guardian sees incorrect total payroll cost; budgeting and payment planning fails.
- If the guardian exports payroll summary for bank transfer instructions, payment amounts are wrong.
- Reconciliation with actual assistants' payment records reveals discrepancies.

**Prevention:**
1. **Use decimal types for monetary calculations:** Avoid floating-point math; use `Decimal` library or store amounts as integer cents.
2. **Explicit aggregation logic:** When calculating monthly payroll summary, use SQL aggregates (`SUM`, `COUNT`) rather than application-level loops.
3. **Verify aggregates in tests:** Create test data with multiple assistants, calculate summary, verify sums match line-by-line calculations.
4. **Audit trail for summary calculations:** Log the calculation formula and component values (total hours, absence hours, rate, tax) so discrepancies can be traced.

**Detection:**
- Test: Create 3 assistants with known hours/rates, calculate summary, verify totals match manual calculation.
- Monitoring: Compare exported payroll summary against individual assistant payment records; flag mismatches.

**Phase:** **Payroll calculation phase**.

---

### Pitfall 9: Hardcoded Values in Database Schema or Migrations

**What goes wrong:**
Database migrations hardcode default values (e.g., `DEFAULT fk_hourly_rate = 334`) or enum constraints that later need to change. When FK updates the rate or Swedish tax law changes, the schema must be updated but the migration system is manual and fragile (using `drizzle-kit push` with no rollback history).

**Consequences:**
- Rate changes cannot be made without a schema migration and potential data re-migration.
- No clear audit trail of when/why schema defaults changed.
- Risk of data loss if migrations are not carefully planned.

**Prevention:**
Use `settings` table (not schema defaults) for all configurable rates and thresholds. Migrations should be generated, versioned, and applied via `drizzle-kit generate` and `drizzle-kit migrate`.

**Phase:** **Foundation** — must be addressed during initial schema design.

---

## Minor Pitfalls

These cause inefficiency or minor bugs but are not regulatory or data-integrity critical.

### Pitfall 10: No Input Validation on API Routes (Zod Installed but Unused)

**What goes wrong:**
`Zod` is installed but never used; all API routes accept inputs without validation. Malformed or malicious inputs (e.g., negative hours, invalid email, oversized strings) cause ORM errors or unexpected database behavior.

**Prevention:**
Define Zod schemas for all request bodies; validate at route entry point.

**Phase:** **Stability & Correctness phase**.

---

### Pitfall 11: N+1 Query Problems in Open-Slots and Dashboard Endpoints

**What goes wrong:**
`GET /api/assistant/open-slots` runs one database query per slot to compute fill count; as slot count grows, the endpoint becomes slow.

**Prevention:**
Use SQL aggregates or JOINs instead of application-level loops.

**Phase:** **Performance optimization** — low priority for MVP but essential before scaling.

---

### Pitfall 12: Self-Booking Race Condition (Check-Then-Act Not Atomic)

**What goes wrong:**
Two assistants simultaneously see available capacity, both check passes, both insert entries for the same slot, exceeding capacity.

**Prevention:**
Wrap check-and-insert in a database transaction with row-level lock on the slot.

**Phase:** **Scheduling Improvements phase**.

---

### Pitfall 13: Missing or Inconsistent Indexes on High-Query Tables

**What goes wrong:**
Entries table is frequently filtered by `assistant_id`, `date`, `req_status`, `rep_status` but has no indexes. As data grows, queries become sequential scans.

**Prevention:**
Add indexes: `entries(assistant_id)`, `entries(date)`, `entries(req_status)`, `entries(rep_status)`.

**Phase:** **Performance optimization** — low priority for MVP.

---

### Pitfall 14: PDF Generation Fragility (System Binary Dependency)

**What goes wrong:**
FK form PDF generation relies on system `qpdf` binary; if not installed or not on PATH, the entire PDF generation fails with unclear error messages. PATH is hardcoded to macOS Homebrew path, breaking on Linux containers.

**Prevention:**
Check for `qpdf` availability at startup; fail loudly with installation instructions if absent. Use environment variable for binary path.

**Phase:** **Stability & Correctness phase**.

---

### Pitfall 15: Google OAuth CSRF Vulnerability

**What goes wrong:**
`/api/gcal/callback` does not validate OAuth `state` parameter; an attacker can trick an authenticated user's browser into completing the OAuth flow with an attacker-controlled Google account.

**Prevention:**
Generate random `state` nonce in `/connect`, store in session or DB, verify in `/callback`.

**Phase:** **Stability & Correctness phase** — security issue but low exploitability for a single-family MVP.

---

## Phase-Specific Warnings

| Phase | Topic | Likely Pitfall | Mitigation |
|-------|-------|----------------|------------|
| Stability & Correctness | Role enforcement | Assistants bypass guardian endpoints | Apply `requireGuardian` server-side; unit test data scoping across two accounts |
| Stability & Correctness | FK 3057 date range | Month-end date bugs (Feb, short months) | Regression test for Feb 28, April 30; use dynamic date math, not hardcoded day 31 |
| Stability & Correctness | Field name consistency | camelCase/snake_case mismatch causes silent bugs | Define TypeScript types for all API responses; enable strict mode |
| Payroll Calculation | Rate configuration | Hardcoded FK rate and tax rate require annual deploys | Move rates to settings table; add rate-change alerting |
| Payroll Calculation | Multi-tenant aggregation | Payroll summary combines data across guardians or uses wrong hours | Test payroll aggregates with multiple assistants; use SQL aggregates, not app-level loops |
| Leave & Absence | Absence deductions | Absence hours invoiced to FK; over-reporting to Skatteverket | Mandatory `absence_type` field; validate billable hours before form generation |
| Skatteverket Reporting | AGI format | Field mismatches (decimal places, date format, length) cause rejection | Validate AGI output against schema; test with real assistant/wage data |
| Multi-Tenant | Data scoping | Guardian A sees Guardian B's data | Enforce `guardian_id` in all queries at Drizzle layer; test concurrent access from two accounts |

---

## Summary: High-Priority Pitfalls for Roadmap

**Before launching Payroll + Skatteverket features:**
1. ✓ Enforce role middleware server-side (Pitfall 6 + 1)
2. ✓ Fix FK 3057 date range bug (Pitfall 2)
3. ✓ Move FK rates to configurable settings (Pitfall 3)
4. ✓ Verify multi-tenant data isolation with real test (Pitfall 1)

**Before Leave & Absence feature:**
5. ✓ Implement absence type field and billable hours filtering (Pitfall 4)

**Before Skatteverket AGI filing:**
6. ✓ Validate AGI field formats against official specification (Pitfall 7)

**Ongoing / Lower Priority:**
- Input validation (Zod schemas) — Pitfall 10
- Query optimization (indexes, aggregates) — Pitfalls 11, 13
- Race condition fix for self-booking — Pitfall 12
- PDF generation robustness — Pitfall 14
- OAuth CSRF fix — Pitfall 15

---

## Sources

- [Försäkringskassan: FK 3059 Time Reporting Form](https://assistanskoll.se/_up/3059-tidredovisning-for-assistansersattning.pdf)
- [Försäkringskassan: FK 3057 Instructions](https://assistanskoll.se/_up/ifyllnad-3057.pdf)
- [Skatteverket: Employer Contributions](https://www.skatteverket.se/servicelankar/otherlanguages/otherlanguages/englishengelska/businessesandemployers/startingandrunningaswedishbusiness/declaringtaxesbusinesses/filingapayereturn/employercontributions.4.2fb39afe18dabf1e4d24a3d.html)
- [Mercans: Sweden Employer Social Contribution Rules 2026](https://mercans.com/resources/statutory-alerts/sweden-employer-social-contribution-rules-updated-for-2026-age-based-rate-change-for-67/)
- [Revea: Tax Reporting for IT & Tech Sector 2026](https://www.revea.se/en/news/tax-reporting-for-the-it-and-tech-sector-in-sweden--key-trends-and-legal-changes-for-2026)
- [Payroll in Sweden: Complete Employer Guide](https://asanify.com/global-employer-of-record/sweden/payroll/)
- [Brave/Medium: Multi-Tenant Data Leakage & Row-Level Security](https://medium.com/@instatunnel/multi-tenant-leakage-when-row-level-security-fails-in-saas-da25f40c788c)
- [Multi-Tenant SaaS Testing Guide 2026](https://blog.qatestlab.com/2026/04/02/multi-tenant-saas-testing-guide-ensuring-performance-and-scalability/)
- [HiveDesk: Time to Decimal Conversion for Payroll](https://www.hivedesk.com/blog/time-tracking/time-to-decimal-conversion-chart)
- [TimeDoctor: Timesheet Conversion Guide](https://www.timedoctor.com/blog/timesheet-conversion/)
- [Sweden PTO: Paid Time Off & Leave Management](https://trackingtime.co/pto-absence-management-software/global-pto/pto-policies/sweden)
- [Lano: Running Payroll in Sweden](https://www.lano.io/global-payroll-guide/sweden)
- [RemotePass: Sweden Payroll & EOR Guide 2025](https://www.remotepass.com/country/sweden)

*Pitfalls audit: 2026-04-06*
