# User Stories — Kalinga Assistansportal
> Version: v0.1 | Last updated: 2026-03-26

---

## Roles

| Role | Description |
|------|-------------|
| **Guardian** | The parent or patient who employs assistants directly (egna arbetsgivaren model) |
| **Assistant** | A personal assistant employed by the guardian |

---

## Test Type Key

| Tag | Meaning |
|-----|---------|
| `🔁 Automated` | Verified programmatically — UI state, page content, redirects, API responses |
| `✋ Manual` | Requires human inspection — printed output, visual layout, mathematical spot-checks |
| `🔁/✋ Mixed` | Some criteria automated, some manual |

---

## 1. Registration

### US-00a — Guardian registration
**As a** new guardian,
**I want to** create an account with my details,
**so that** I can set up the portal for my care arrangement.

**Acceptance Criteria:**
- Given I am on the registration page
- When I fill in my name, email, and a password and submit
- Then my account is created
- And I am redirected to the dashboard
- And I am prompted to complete my patient profile (patient name, weekly approved hours)

- Given I enter an email that is already registered
- When I submit
- Then I see an error message telling me the email is already in use
- And I am not redirected

- Given I enter a password that does not meet the minimum requirements
- When I submit
- Then I see a clear error message describing the requirement
- And the form is not submitted

> 🔁 **Automated** — form submission, error messages, and redirect can all be verified via browser tools

---

### US-00b — Assistant account setup (invite-based)
**As an** assistant who has been added by a guardian,
**I want to** receive an invitation and set up my account,
**so that** I can log in and be part of the care arrangement.

**Acceptance Criteria:**
- Given a guardian has added me via the Assistants page (US-07)
- When I receive the invitation email
- Then the email contains a link to set up my account

- Given I click the invitation link
- When I set my password and submit
- Then my account is activated
- And I am redirected to the dashboard
- And I can log in with my email and new password from that point on

- Given the invitation link has expired
- When I click it
- Then I see a message telling me the link is no longer valid
- And I am given an option to request a new one

> 🔁/✋ **Mixed** — account activation and redirect are automated; email delivery and link expiry must be confirmed manually by checking the inbox

---

## 2. Authentication

### US-01 — Login
**As a** guardian or assistant,
**I want to** log in with my email and password,
**so that** I can access the portal securely.

**Acceptance Criteria:**
- Given I am on the login page
- When I enter a valid email and password and submit
- Then I am redirected to the dashboard
- And my name is shown in the navigation

- Given I enter an incorrect password
- When I submit
- Then I see an error message
- And I am not redirected

> 🔁 **Automated**

---

### US-02 — Session persistence
**As a** guardian,
**I want to** stay logged in between visits,
**so that** I don't have to log in every time I open the app.

**Acceptance Criteria:**
- Given I am logged in
- When I close and reopen the browser tab
- Then I am still authenticated and redirected to the dashboard

> 🔁 **Automated**

---

## 3. Dashboard

### US-03 — Weekly coverage overview
**As a** guardian,
**I want to** see which days this week have assistant coverage,
**so that** I can quickly spot gaps before they become a problem.

**Acceptance Criteria:**
- Given I am on the dashboard
- When the page loads
- Then I see a 7-day grid for the current week
- And each day shows whether coverage is scheduled
- And days with no coverage are visually distinct

> 🔁/✋ **Mixed** — grid presence and day count are automated; visual distinction of uncovered days must be confirmed manually

---

### US-04 — FK deadline countdown
**As a** guardian,
**I want to** see how many days remain until the FK submission deadline,
**so that** I don't miss it.

**Acceptance Criteria:**
- Given today is within any month
- When I view the dashboard
- Then I see the FK deadline (5th of the 2nd month after the work month)
- And I see a countdown in days
- And the deadline is correct — e.g. for January work, the deadline is March 5th

> 🔁 **Automated** — deadline date and countdown value can be verified against today's date programmatically

---

### US-05 — Pending approvals indicator
**As a** guardian,
**I want to** see if there are reports waiting for my approval,
**so that** I can act on them without navigating to the Reports page first.

**Acceptance Criteria:**
- Given one or more reports have been submitted by assistants
- When I view the dashboard
- Then I see a count of pending approvals
- And clicking it takes me to the Reports page

> 🔁 **Automated**

---

## 4. Assistants

### US-06 — View assistants
**As a** guardian,
**I want to** see a list of all my assistants,
**so that** I have a clear view of who is on my team.

**Acceptance Criteria:**
- Given I am logged in as a guardian
- When I navigate to the Assistants page
- Then I see all assistants associated with my account
- And each entry shows the assistant's name and status

> 🔁 **Automated**

---

### US-07 — Add an assistant
**As a** guardian,
**I want to** add a new assistant to the portal,
**so that** they can be included in scheduling and reporting.

**Acceptance Criteria:**
- Given I am on the Assistants page
- When I fill in the assistant's name and email and submit
- Then the assistant appears in the list
- And they receive an invitation to set up their account

> 🔁/✋ **Mixed** — assistant appearing in list is automated; invitation email delivery must be confirmed manually

---

### US-08 — View assistant details
**As a** guardian,
**I want to** view the details of an individual assistant,
**so that** I can check their scheduled hours and report history.

**Acceptance Criteria:**
- Given I am on the Assistants page
- When I click on an assistant's name
- Then I see their profile including name, email, and assigned hours

> 🔁 **Automated**

---

## 5. Reports

### US-09 — Submit a monthly time report
**As a** guardian,
**I want to** submit a monthly time report for each assistant,
**so that** I can document the hours worked for FK.

**Acceptance Criteria:**
- Given I am on the Reports page
- When I select a month and an assistant and fill in the hours worked per day
- And I submit the report
- Then the report status changes to "submitted"
- And it appears in the pending approvals list

> 🔁 **Automated**

---

### US-10 — Approve a report
**As a** guardian,
**I want to** approve a submitted time report,
**so that** it is marked as ready to be sent to FK.

**Acceptance Criteria:**
- Given a report has been submitted
- When I review it and click Approve
- Then the report status changes to "approved"
- And it no longer appears in the pending approvals count on the dashboard

> 🔁 **Automated**

---

### US-11 — View report history
**As a** guardian,
**I want to** see all past reports by month and assistant,
**so that** I have a record of what was submitted.

**Acceptance Criteria:**
- Given I am on the Reports page
- When I view the report list
- Then I see reports grouped or filterable by month and assistant
- And each report shows its status (submitted / approved)

> 🔁 **Automated**

---

### US-12 — Generate a PDF report
**As a** guardian,
**I want to** export an approved report as a PDF,
**so that** I can print it, sign it, and mail it to FK.

**Acceptance Criteria:**
- Given a report has been approved
- When I click Generate PDF
- Then a PDF is downloaded to my device
- And the PDF contains the assistant's name, the work month, and the daily hours breakdown
- And there is a signature field for the assistant

> 🔁/✋ **Mixed** — file download is automated; content and signature field require manual inspection (see US-12a–US-12g)

---

## 5b. PDF Content Verification

> These stories go deeper than "did the PDF download." They verify the data inside the file is correct, complete, and FK-compliant.
>
> **How to test:** Open the downloaded PDF and manually check each criterion. For automated checks, PDF text content is extracted and compared against source data in the database.

---

### US-12a — PDF contains correct patient information
**As a** guardian,
**I want to** see the patient's name and FK case details in the PDF,
**so that** FK can identify who the report belongs to.

**Acceptance Criteria:**
- Given I generate a PDF for an approved report
- When I open the PDF
- Then the patient's full name is present
- And the FK personal number or case reference is present (if stored in Settings)
- And the information matches exactly what is saved in the patient profile

> 🔁 **Automated** — patient name extracted from PDF text and compared against Settings data

---

### US-12b — PDF contains correct assistant information
**As a** guardian,
**I want to** see each assistant's name clearly on their report,
**so that** FK knows which assistant the hours relate to.

**Acceptance Criteria:**
- Given a report is generated for a specific assistant
- When I open the PDF
- Then the assistant's full name appears on the document
- And no other assistant's name appears on the same document

> 🔁 **Automated** — generate PDFs for two assistants in the same month; verify name isolation programmatically

---

### US-12c — PDF shows the correct work month
**As a** guardian,
**I want to** see the correct month and year on the PDF,
**so that** it matches the period being reported to FK.

**Acceptance Criteria:**
- Given I generate a PDF for January 2026
- When I open the PDF
- Then the month shown is January 2026
- And it is not today's date or the approval date

> 🔁 **Automated** — month extracted from PDF text and compared against the report's work month

---

### US-12d — PDF shows all calendar days with correct hours
**As a** guardian,
**I want to** see every day of the work month listed with the hours logged,
**so that** the daily breakdown is complete and accurate.

**Acceptance Criteria:**
- Given a report was submitted with hours entered for specific days
- When I open the PDF
- Then every calendar day of the month is listed
- And days with hours show the correct value
- And days with no hours show 0 or are blank — not empty/missing rows
- And the total hours at the bottom matches the sum of all daily entries

> 🔁/✋ **Mixed** — day count and hour values are automated; layout and readability of the printed table must be confirmed manually

---

### US-12e — PDF total hours are mathematically correct
**As a** guardian,
**I want to** see a correct total at the bottom of the report,
**so that** I don't submit a form with a wrong total to FK.

**Acceptance Criteria:**
- Given daily hours have been entered across a report
- When I generate the PDF
- Then the total shown equals the sum of all daily hour entries
- And if any day is zero, it does not inflate the total

> 🔁/✋ **Mixed** — sum can be verified programmatically by extracting PDF text; also verify manually with a calculator as a spot-check

---

### US-12f — PDF cannot be generated for an unapproved report
**As a** guardian,
**I want to** be prevented from generating a PDF before approval,
**so that** I don't accidentally send an unreviewed report to FK.

**Acceptance Criteria:**
- Given a report has status "submitted" but not yet "approved"
- When I view that report
- Then the Generate PDF button is either absent or disabled
- And I cannot download a PDF for it

> 🔁 **Automated**

---

### US-12g — PDF signature field is present and printable
**As a** guardian,
**I want to** see a signature line on the printed PDF,
**so that** the assistant can sign the physical copy before it is mailed to FK.

**Acceptance Criteria:**
- Given I generate and open a PDF
- When I view or print it
- Then there is a clearly labelled signature field for the assistant
- And there is space for the date of signature
- And the field is in the correct position for a physical signature

> ✋ **Manual — must not be skipped**
> 1. Download the PDF for an approved report
> 2. Open it in Preview or a PDF viewer
> 3. Confirm there is a labelled signature field for the assistant
> 4. Confirm there is space for a date next to the signature
> 5. Print one page and confirm the field is legible and has enough physical space to sign by hand
> 6. Confirm result before this test is marked as passed

---

## 6. Settings

### US-13 — View and edit patient profile
**As a** guardian,
**I want to** view and update the patient's details,
**so that** the information used in reports is accurate.

**Acceptance Criteria:**
- Given I am on the Settings page
- When the page loads
- Then I see the patient's name and weekly approved hours
- And I can edit and save changes

> 🔁 **Automated**

---

### US-14 — View weekly hours allocation
**As a** guardian,
**I want to** see how many weekly hours are approved by FK,
**so that** I know the ceiling when scheduling assistants.

**Acceptance Criteria:**
- Given the patient profile has a weekly hours value set
- When I view the Settings page
- Then the approved weekly hours are displayed clearly

> 🔁 **Automated**

---

## 7. FK Compliance

### US-15 — Correct FK deadline calculation
**As a** guardian,
**I want to** see the correct FK submission deadline,
**so that** I don't submit late and incur corrections.

**Acceptance Criteria:**
- Given the work month is January
- Then the FK deadline shown is March 5th (5th of the 2nd month after the work month)
- Given the work month is December
- Then the FK deadline shown is February 5th of the following year

> 🔁 **Automated** — deadline date calculated and verified programmatically against known month inputs

---

### US-16 — Report covers all working days
**As a** guardian,
**I want to** log hours for each calendar day of the work month,
**so that** the report is complete and accurate for FK.

**Acceptance Criteria:**
- Given I am filling in a report for a given month
- When the form loads
- Then it shows all calendar days for that month
- And I can enter hours for each day individually

> 🔁 **Automated**

---

## Status Key

| Status | Meaning |
|--------|---------|
| `draft` | Not yet submitted |
| `submitted` | Submitted, awaiting guardian approval |
| `approved` | Approved by guardian, ready to mail to FK |
