# User Stories — Kalinga Assistansportal
> Version: v0.1 | Last updated: 2026-04-02 (FK 3057 form review)

---

## Design Decisions

> Decisions made during user story review that changed the scope or direction of the product.

| Date | Decision | Reason |
|------|----------|--------|
| 2026-03-28 | Removed self-booking scheduling UI (US-13c) from Settings | Scheduling is handled entirely through a dedicated Google Calendar shared between the guardian and assistants. Building a custom self-booking flow would duplicate what Google Calendar already does well. |
| 2026-03-28 | Google Calendar integration model changed from push-only to dedicated shared calendar | The guardian creates a dedicated care calendar (e.g. "Mikael Care") and shares it with assistants. Kalinga reads from it — all events are treated as shifts. No tagging or custom scheduling UI required. |
| 2026-03-28 | Assistant app (clock in/out, schedule view) moved to v0.2 | Guardian-only scope for v0.1. Guardian logs shifts by adjusting the schedule. The guardian fallback remains a permanent feature in v0.2. |
| 2026-03-28 | US-00b moved from Group 1 (Registration) to Group 4 (Assistants), renamed US-07b | Assistant invite/setup is the completion of the add-assistant flow (US-07), not a self-registration flow. Grouping by user journey is more useful for testing. |
| 2026-03-28 | US-13 and US-14 merged into one story | Weekly hours and FK decision number live in the same Settings section as the patient profile. One story covers all care details. |
| 2026-03-28 | Assistant deletion triggers outstanding report flow, not hard delete without warning | Deleting an assistant with unfinalized hours would silently lose FK-reportable data. Deletion gates on the guardian handling any outstanding report first. Deleted assistants remain visible in historical reports for FK compliance. |
| 2026-03-28 | Calendar disconnect preserves existing logged hours and synced shifts | Wiping data on disconnect would put FK compliance at risk. Disconnect only stops future syncing. Alternative schedule input methods (e.g. CSV import) are planned for v0.2+. |
| 2026-03-28 | FK deadline treated as a payment deadline, not just a compliance formality | Missing the deadline means the guardian and assistants do not get paid for that month. This justifies prominent, escalating warnings in the UI (amber at 7 days, red when overdue). |
| 2026-04-02 | FK 3059 Section 3 (Kollektivavtal) intentionally left blank | Egna arbetsgivare almost never have a collective agreement. Adding a Settings field for an edge case that doesn't apply to the MVP user adds complexity with no practical benefit. Guardians who do have one can fill it manually on the printed form. |
| 2026-04-02 | FK 3057 has no FK decision number field | Form inspection confirmed: FK identifies the case by patient personnummer only. Removed "FK decision number is present" from US-19a acceptance criteria. |
| 2026-04-02 | FK 3057 shows aggregate time totals, not per-assistant rows | Form inspection confirmed: FK 3057 has three total fields (aktivtid, väntetid, beredskapstid) — no individual assistant breakdown. US-19b rewritten accordingly. |
| 2026-04-02 | FK 3057 deductions entered at generation time, not stored | Hospital stays and activity absences (barnomsorg/skola/daglig verksamhet) are entered in the generation dialog and written directly to the PDF. Not persisted in the database. |
| 2026-04-02 | FK 3057 page 2 cost amounts left blank in v0.1 | Requires FK schablonbelopp (annual rate) which changes yearly. Future accounting integration will handle this. Guardian completes page 2 manually. |
| 2026-04-02 | FK 3057 is not blocked by draft assistant reports | Blocking would prevent the guardian from acting at all if one assistant is slow to finalise. Instead, the guardian is warned which assistants are missing and can choose to proceed with approved reports only or wait. |
| 2026-03-28 | 7-day coverage grid removed from dashboard (US-03) | The weekly grid duplicated the Schedule page. The dashboard was redesigned as an action centre: who is working today, what needs action, upcoming reports. Identified during sprint planning review. |
| 2026-03-28 | Assistant-to-shift attribution uses Google Calendar guest invites | Rather than naming conventions or per-assistant calendars, the guardian invites the assistant's email as a guest on each shift event. Kalinga matches the guest email to the assistant in the system. Events with no matching guest are flagged as unassigned. |

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

### US-00b — First-run onboarding
**As a** new guardian who has just registered,
**I want to** be guided through the steps needed to set up the app,
**so that** I know what to do first and don't land on a blank, confusing screen.

**Acceptance Criteria:**
- Given I have just registered and completed my patient profile
- When I arrive on the dashboard for the first time
- Then I see a setup checklist with three steps:
  1. Complete patient profile ✓ (already done)
  2. Connect your care calendar (links to Settings → US-13b)
  3. Add your first assistant (links to Assistants → US-07)
- And completed steps are visually marked as done
- And incomplete steps are clearly actionable with a direct link

- Given I complete all three setup steps
- When I return to the dashboard
- Then the setup checklist is no longer shown
- And the dashboard shows the normal action-oriented view (US-03)

- Given I dismiss the checklist before completing all steps
- When I return to the dashboard
- Then the checklist is shown again until all steps are complete

- Given I am a returning guardian who completed setup previously
- When I log in
- Then I never see the setup checklist

> 🔁 **Automated**

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

### US-01b — Forgot / Reset Password
**As a** guardian or assistant who has forgotten their password,
**I want to** request a reset link by email,
**so that** I can regain access to my account without needing support.

**Acceptance Criteria:**
- Given I click "Forgot password?" on the login page
- When I enter my registered email and submit
- Then I see a confirmation message (whether or not the email exists in the system)
- And a reset link is sent to my inbox

- Given I click the reset link
- When I set a new password (minimum 8 characters, confirmed)
- Then my password is updated
- And I am redirected to the login page

- Given the reset link has already been used or has expired
- When I click it
- Then I see a clear error message
- And I am given an option to request a new one

> 🔁/✋ **Mixed** — token validation, redirect, and error states are automated; email delivery must be confirmed manually

---

### US-02 — Session persistence
**As a** guardian,
**I want to** stay logged in between visits,
**so that** I don't have to log in every time I open the app.

**Acceptance Criteria:**
- Given I am logged in
- When I close and reopen the browser tab
- Then I am still authenticated and redirected to the dashboard

- Given my session has expired (after 30 days)
- When I try to access any page in the app
- Then I am redirected to the login page

> 🔁 **Automated**

---

### US-02b — Logout
**As a** guardian or assistant,
**I want to** log out of the portal,
**so that** my account is secure when I am done.

**Acceptance Criteria:**
- Given I am logged in as a guardian
- When I click the logout button in the sidebar
- Then my session is ended
- And I am redirected to the login page
- And I cannot access any protected page without logging in again

- Given I am logged in as an assistant
- When I click the logout button on my dashboard
- Then my session is ended
- And I am redirected to the login page

> 🔁 **Automated**

---

## 3. Dashboard

### US-03 — Action-oriented dashboard
**As a** guardian,
**I want to** see at a glance who is working today, what needs my attention right now, and what reports are coming up,
**so that** I can act immediately without navigating through the app.

**Acceptance Criteria:**
- Given I am on the dashboard
- When the page loads
- Then I see which assistant(s) are scheduled to work today
- And I see a count of any items needing action (approved reports with no PDF, overdue reports, broken calendar connection)
- And I see upcoming reports that need to be approved and sent before the next FK deadline
- And each action item links directly to where I need to go to resolve it

- Given there is nothing requiring action today
- When I view the dashboard
- Then I see a clear empty state — not a blank page

> 🔁/✋ **Mixed** — presence of today's coverage, action counts, and links are automated; visual layout and empty state must be confirmed manually

> ℹ️ **Design decision:** The 7-day coverage grid was removed. Showing a full week of coverage on the dashboard duplicated what the Schedule page already does. The dashboard is now an action centre — today and what needs doing, not a calendar view.

---

### US-04 — FK deadline countdown
**As a** guardian,
**I want to** see how many days remain until the FK submission deadline,
**so that** I don't miss it and lose payment for that month.

**Acceptance Criteria:**
- Given today is within any month
- When I view the dashboard
- Then I see the FK deadline (5th of the 2nd month after the work month)
- And I see a countdown in days
- And the deadline is correct — e.g. for January work, the deadline is March 5th

- Given 7 or fewer days remain until the FK deadline
- When I view the dashboard
- Then the countdown is shown in amber as a warning

- Given the FK deadline has passed and a report has not been marked as sent
- When I view the dashboard
- Then the countdown is shown in red
- And I see a clear message that the deadline has passed

> 🔁 **Automated** — deadline date, countdown value, and threshold states can be verified against today's date programmatically

---

### US-05 — Approved reports awaiting PDF generation
**As a** guardian,
**I want to** see if there are approved reports that I haven't yet generated a PDF for, or months where FK 3057 hasn't been generated,
**so that** I don't miss mailing anything to FK before the deadline.

**Acceptance Criteria:**
- Given one or more FK 3059 reports have been approved but no PDF has been generated
- When I view the dashboard
- Then I see a count of those reports
- And clicking it takes me to the Reports page

- Given all assistant reports for a month are approved but no FK 3057 has been generated for that month
- When I view the dashboard
- Then I see an indicator that the FK 3057 for that month is missing
- And clicking it takes me to the monthly summary for that month

- Given all approved reports have had PDFs generated and FK 3057 has been generated
- When I view the dashboard
- Then the indicator is not shown

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
- And each entry shows the assistant's name, email, and status

> 🔁 **Automated**

---

### US-07 — Add an assistant
**As a** guardian,
**I want to** add a new assistant to the portal,
**so that** they can be included in scheduling and reporting.

**Acceptance Criteria:**
- Given I am on the Assistants page
- When I fill in the assistant's name and email and submit
- Then the assistant appears in the list with a "pending" status
- And they receive an invitation to set up their account

- Given an assistant has a "pending" status
- When I view their entry in the Assistants list
- Then I see a "Resend invitation" option
- And clicking it sends a new invitation email to their address
- And the previous invitation link is invalidated

> 🔁/✋ **Mixed** — assistant appearing in list and resend action are automated; invitation email delivery must be confirmed manually

---

### US-07b — Assistant account setup (invite-based)
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

### US-08 — View assistant details
**As a** guardian,
**I want to** view the details of an individual assistant,
**so that** I can check their profile and how many hours they have logged this month.

**Acceptance Criteria:**
- Given I am on the Assistants page
- When I click on an assistant's name
- Then I see their profile including name, email, and status
- And I see the total hours they have logged for the current month

> 🔁 **Automated**

---

### US-08c — Edit assistant details
**As a** guardian,
**I want to** edit an assistant's details after they have been added,
**so that** their profile is complete and accurate for FK reporting.

**Acceptance Criteria:**
- Given I am viewing an assistant's profile (US-08)
- When I click Edit
- Then I can update their name, email, personal ID number (PNO), and phone number
- And when I save, the updated details are reflected immediately in their profile
- And any future PDF generated for that assistant uses the updated details

- Given I update an assistant's PNO or phone
- When a PDF is next generated for that assistant
- Then the PDF contains the updated values

- Given I change an assistant's email address
- When I save
- Then I see a warning explaining that future calendar events invited to the old email will appear as unassigned in the schedule
- And I am reminded to update the calendar invites to use the new email going forward
- And past shifts already attributed to this assistant are not affected

> 🔁/✋ **Mixed** — profile updates and warning display are automated; calendar invite behaviour must be confirmed manually

> ⚠️ **See BUG-04:** The add assistant form only collects name and email. PNO and phone must be added via this edit flow. Any PDF generated before editing will have blank PNO and phone fields.

---

### US-08d — Delete an assistant
**As a** guardian,
**I want to** delete an assistant who is no longer part of my care arrangement,
**so that** they no longer appear in my active roster or schedule.

**Acceptance Criteria:**
- Given I click Delete on an assistant who has hours logged in the current month that have not yet been approved
- When I confirm the deletion
- Then I am taken to the report for that assistant's current month before deletion proceeds
- And I am prompted to review, approve, and generate a PDF for any outstanding hours
- And deletion does not complete until the outstanding report has been handled or explicitly dismissed

- Given I click Delete on an assistant with no outstanding hours
- When I confirm the deletion
- Then the assistant is removed from the active roster
- And they no longer appear in the schedule or the assistant list

- Given an assistant has been deleted
- When I view a past report that includes their hours
- Then their name and hours are shown as normal
- And the report remains valid and downloadable

> 🔁/✋ **Mixed** — deletion, roster removal, and report preservation are automated; outstanding report prompt flow must be confirmed manually

---

### US-08b — View the care schedule
**As a** guardian,
**I want to** see the schedule populated from my connected Google Calendar,
**so that** I have a clear view of upcoming and past shifts before making any edits.

**Acceptance Criteria:**
- Given I have connected a care calendar (US-13b)
- When I navigate to the Schedule page
- Then I see all events from the connected calendar displayed as shifts
- And each shift shows the date, start time, end time, and assistant name
- And I can navigate forward and backward by week or month

- Given a calendar event has an assistant's email in the guest list
- When the schedule loads
- Then that shift is attributed to the matching assistant in Kalinga
- And the assistant's name is shown on the shift

- Given a calendar event has no guests, or a guest email that does not match any assistant in Kalinga
- When the schedule loads
- Then the shift is shown as unassigned
- And it is visually flagged so the guardian can correct it
- And unassigned shifts are not included in any assistant's monthly report until assigned


- Given a calendar event has multiple assistant emails in the guest list
- When the schedule loads
- Then one shift is created per assistant
- And each assistant's hours are tracked independently

- Given no calendar has been connected
- When I navigate to the Schedule page
- Then I see a prompt to connect a calendar
- And clicking it takes me to Settings (US-13b)

- Given the connected calendar has no events for the selected period
- When I view that period
- Then I see an empty state message — not a blank page

> 🔁/✋ **Mixed** — event display, guest matching, unassigned flagging, and navigation are automated; visual layout and shift legibility must be confirmed manually

---

### US-08e — Assign an unassigned shift
**As a** guardian,
**I want to** manually assign an unassigned shift to an assistant from within Kalinga,
**so that** I can correct missing or unrecognised guest invites without going back to edit every calendar event.

**Acceptance Criteria:**
- Given an unassigned shift is visible in the schedule
- When I click on it
- Then I see a dropdown of my active assistants
- And I can select one to assign the shift to

- Given I select an assistant and confirm
- Then the shift is attributed to that assistant
- And it is included in their monthly report
- And the unassigned flag is cleared

- Given I assign a shift that falls in a month with an already-approved report
- When I confirm the assignment
- Then I see a warning that the approved report will be affected
- And the report status is reset to draft
- And I am prompted to re-approve before generating a new PDF

> 🔁 **Automated**

---

## 5. Reports

### US-09a — Auto-generated monthly draft report
**As a** guardian,
**I want to** see a draft report automatically created for each assistant each month,
**so that** I don't have to manually initiate reporting — the data is just there when I need it.

**Acceptance Criteria:**
- Given an assistant has at least one shift logged in a given month
- When I navigate to the Reports page for that month
- Then a draft report exists for that assistant
- And it is populated with all shifts logged for that month
- And the total hours reflect the sum of those shifts

- Given an assistant has no shifts logged in a month
- When I navigate to the Reports page for that month
- Then no report is shown for that assistant for that month

- Given a new shift is added or an existing shift is edited
- When I view the draft report
- Then the report reflects the updated hours immediately

> 🔁 **Automated**

---

### US-09 — Record actual hours by adjusting the schedule
**As a** guardian,
**I want to** adjust the schedule to reflect the actual hours an assistant worked,
**so that** the correct hours are recorded and included in the monthly report.

**Acceptance Criteria:**
- Given an assistant has completed a shift in the current or a past month
- When I update their schedule entry with the actual start and end time
- Then the logged hours are saved
- And they are counted toward that assistant's monthly total for that month
- And the change is reflected immediately in the draft report for that month

- Given I am editing a shift
- When I update the shift
- Then I can set the time type: Aktiv tid, Väntetid, or Beredskapstid
- And the time type defaults to Aktiv tid if not changed
- And the time type is saved with the shift and included in the monthly report

- Given a shift has already been included in an approved report
- When I edit that shift
- Then I see a warning that the report has been affected
- And I am prompted to re-approve the report before generating a new PDF

> 🔁 **Automated**

> ℹ️ **v0.1 note:** The guardian adjusts the schedule on behalf of the assistant. In v0.2, assistants will clock in/out directly from their own app. The guardian fallback remains as a permanent feature.

> ℹ️ **Time types:** FK 3059 requires each shift to be categorised as Aktiv tid (active assistance), Väntetid (waiting time at the patient's location), or Beredskapstid (standby from home). In v0.1, all shifts default to Aktiv tid. The guardian can override this per shift. Payroll rate differences between time types are deferred to v0.2.

---

### US-09b — Shifts are locked once a report is marked as sent
**As a** guardian,
**I want to** be prevented from editing shifts that belong to a report already mailed to FK,
**so that** the record in Kalinga matches exactly what was sent.

**Acceptance Criteria:**
- Given a report has been marked as sent
- When I attempt to edit a shift that belongs to that month
- Then the shift is read-only
- And I see a message explaining that the report has been sent to FK and cannot be changed

- Given a report has been marked as sent
- When I view the schedule for that month
- Then shifts from that month are visually distinct from editable shifts

> 🔁/✋ **Mixed** — lock enforcement and read-only state are automated; visual distinction of locked shifts must be confirmed manually

---

### US-10 — Approve a report
**As a** guardian,
**I want to** review and approve a monthly report,
**so that** it is marked as ready to generate a PDF and mail to FK.

**Acceptance Criteria:**
- Given I have finished logging hours for a month
- When I review the report and click Approve
- Then the report status changes to "approved"
- And the Generate PDF button becomes available

- Given a report has already been approved
- When I edit a shift that belongs to that report
- Then I see a warning that the approved report is no longer valid
- And the report status is reset to "draft"
- And any previously generated PDF is invalidated
- And I am prompted to re-approve the report before generating a new PDF

> 🔁 **Automated**

---

### US-11 — View report history
**As a** guardian,
**I want to** see this month's reports by default and browse past submissions like a bank statement,
**so that** I always know where things stand and can access any previously sent PDF.

**Acceptance Criteria:**
- Given I am on the Reports page
- When the page loads
- Then I see reports for the current month grouped by assistant
- And each row shows the assistant's name and their report status (draft / approved / sent)
- And each month shows one row per assistant — not one combined row for all assistants

- Given one or more reports are overdue (deadline passed, not yet sent)
- When I view the Reports page
- Then overdue reports are shown at the top of the list regardless of month
- And they are visually distinct from other reports

- Given a draft report for the current month contains unassigned shifts
- When I view that report in the list
- Then it is flagged to indicate unassigned shifts are present
- And clicking it takes me to the schedule to resolve them

- Given I want to check a past month
- When I navigate back through the archive
- Then I see all reports for that month, one per assistant
- And I can open or download any PDF that was previously generated and sent to FK

- Given a past month has a report with status draft or approved but no PDF
- When I view it in the archive
- Then I can still take action on it — approve it or generate a PDF

> 🔁/✋ **Mixed** — current month display, grouping, overdue surfacing, and navigation are automated; PDF retrieval and visual distinction must be confirmed manually

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

### US-12d — PDF shows all calendar days with correct hours and time types
**As a** guardian,
**I want to** see every day of the work month listed with the hours and time type logged,
**so that** the daily breakdown is complete, accurate, and FK-compliant.

**Acceptance Criteria:**
- Given a report was submitted with hours entered for specific days
- When I open the PDF
- Then every calendar day of the month is listed
- And days with hours show the correct value
- And days with no hours show 0 or are blank — not empty/missing rows
- And the total hours at the bottom matches the sum of all daily entries
- And each row includes the time type for that shift (Aktiv tid, Väntetid, or Beredskapstid)
- And shifts that were not explicitly categorised show as Aktiv tid (the default)

> 🔁/✋ **Mixed** — day count, hour values, and time type presence are automated; layout and readability of the printed table must be confirmed manually

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
- Given a report has status "draft" but not yet "approved"
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

### US-12h — Mark a report as sent
**As a** guardian,
**I want to** mark a report as sent after I have mailed the signed PDF to FK,
**so that** the archive reflects which months have been fully completed.

**Acceptance Criteria:**
- Given a PDF has been generated for an approved report
- When I click "Mark as sent"
- Then the report status changes to "sent"
- And the report moves to the sent archive in the report history

- Given a report has been marked as sent
- When I view it
- Then I can still download the previously generated PDF
- But I cannot re-approve or regenerate the report without first acknowledging a warning

> 🔁 **Automated**

---

## 5c. FK 3057 — Payment Claim (Räkning för utförd assistans)

> FK 3057 is submitted once per month covering all assistants. It is generated separately from the per-assistant FK 3059 forms. Both must be mailed to FK together with the guardian's signature.

---

### US-19 — Generate the FK 3057 payment claim
**As a** guardian,
**I want to** generate the FK 3057 form for a given month,
**so that** I can include it with the FK 3059 forms when I mail the monthly submission to FK.

**Acceptance Criteria:**
- Given all assistant reports for the month are in "approved" or "sent" status
- When I navigate to the monthly summary and click Generate FK 3057
- Then a PDF of the FK 3057 form is downloaded
- And it covers all assistants for that month

- Given one or more assistant reports for the month are still in "draft" status
- When I click Generate FK 3057
- Then I see a warning identifying which assistants' reports are not yet approved
- And I am told that those assistants will not be included in the FK 3057 until their reports are approved
- And I can choose to proceed and generate the FK 3057 with only the approved reports
- Or cancel and go approve the outstanding reports first

- Given I have already generated a FK 3057 for a month
- When I view that month
- Then I can download the previously generated PDF
- And I can regenerate if assistant reports have changed since the last generation

> 🔁/✋ **Mixed** — warning display and partial generation are automated; PDF content must be confirmed manually (see US-19a–US-19b)

> ℹ️ **Design decision:** FK 3057 is not blocked by draft reports. The guardian is warned and can choose to proceed with only the approved assistants, or cancel and finalise outstanding reports first.

---

## 5d. FK 3057 Content Verification

> These stories verify the data inside the FK 3057 is correct and FK-compliant. Open the downloaded PDF and check each criterion manually, or extract text programmatically.

---

### US-19a — FK 3057 contains correct guardian and patient information
**As a** guardian,
**I want to** see my details and the patient's details on the FK 3057,
**so that** FK can identify who is making the claim.

**Acceptance Criteria:**
- Given I generate a FK 3057 for a month
- When I open the PDF
- Then the patient's name and personal ID are present
- And the guardian's name and personal ID are present
- And the guardian type checkbox (förvaltare / god man / vårdnadshavare) matches what is saved in Settings
- And the "egna arbetsgivare" employer checkbox is ticked
- And all values match exactly what is saved in Settings

> ℹ️ **Note:** FK 3057 has no FK decision number field. FK identifies the case by patient personnummer.

> 🔁 **Automated** — field values extracted from PDF and compared against Settings data

---

### US-19b — FK 3057 contains correct aggregate time totals
**As a** guardian,
**I want to** see the correct total hours for the month on the FK 3057,
**so that** FK can verify the claim matches the sum of all per-assistant FK 3059 forms.

**Acceptance Criteria:**
- Given I generate a FK 3057 for a month
- When I open the PDF
- Then the total aktivtid (active time) in hours and minutes is correct
- And the total väntetid (waiting time) in hours and minutes is correct
- And the total beredskapstid (standby time) in hours and minutes is correct
- And each total equals the sum of that time type across all included approved assistant reports for that month
- And no hours from a different month appear

> ℹ️ **Note:** FK 3057 shows aggregate totals only — it does not list individual assistants by name. Individual breakdowns appear on the per-assistant FK 3059 forms.

> 🔁/✋ **Mixed** — totals extracted from PDF are automated; cross-check against sum of FK 3059 forms must be spot-checked manually

---

### US-19c — FK 3057 signature field is present and printable
**As a** guardian,
**I want to** see a signature line on the printed FK 3057,
**so that** I can sign the physical copy before mailing it to FK.

**Acceptance Criteria:**
- Given I generate and open the FK 3057 PDF
- When I view or print it
- Then there is a clearly labelled signature field for the guardian
- And there is space for the date of signature
- And the field is in the correct position for a physical signature

> ✋ **Manual — must not be skipped**
> 1. Download the FK 3057 PDF
> 2. Open it in Preview or a PDF viewer
> 3. Confirm there is a labelled signature field for the guardian
> 4. Confirm there is space for a date next to the signature
> 5. Print one page and confirm the field is legible and has enough physical space to sign by hand
> 6. Confirm result before this test is marked as passed

---

### US-19e — FK 3057 optional deductions at generation time
**As a** guardian,
**I want to** enter any hospital stays or activity absences when generating FK 3057,
**so that** the form reflects the correct billable hours and FK does not reject the claim.

**Acceptance Criteria:**
- Given I click Generate FK 3057
- When the generation dialog opens
- Then I see an optional section: "Hospital stays this month (sjukhusinläggning)"
- And I can enter up to 3 date ranges (from / to)
- And I see an optional section: "Activity absences"
- And I can tick any combination of: Barnomsorg, Skola, Daglig verksamhet

- Given I leave all deduction fields blank
- When I generate the FK 3057
- Then the form is generated with no hospital or activity deductions filled
- And no warning is shown (blank = none occurred)

- Given I enter one or more hospital date ranges or activity checkboxes
- When the PDF is generated
- Then those values appear in the correct FK 3057 fields
- And the values are not stored in the database — they apply to this generation only

> ✋ **Manual** — verify hospital dates and activity checkboxes appear in correct PDF fields

---

### US-19d — Mark monthly submission as sent
**As a** guardian,
**I want to** mark the FK 3057 as sent after I have mailed the signed documents to FK,
**so that** the archive shows the full monthly submission is complete.

**Acceptance Criteria:**
- Given a FK 3057 has been generated for a month
- When I click "Mark as sent"
- Then the FK 3057 status changes to "sent"
- And the monthly summary for that month shows the submission as complete

- Given the FK 3057 has been marked as sent
- When I view that month
- Then I can still download the previously generated FK 3057 PDF
- But I cannot regenerate it without first acknowledging a warning

> 🔁 **Automated**

---

## 6. Settings

### US-13 — View and edit care details
**As a** guardian,
**I want to** view and update all care-related details in Settings,
**so that** the information used in reports and FK forms is accurate.

**Acceptance Criteria:**
- Given I am on the Settings page
- When the page loads
- Then I see the guardian's name, personal ID, email, and phone
- And I see the guardian type (förvaltare / god man / vårdnadshavare) as a selectable option
- And I see the patient's name, personal ID, and address
- And I see the FK decision number and weekly approved hours
- And I can edit and save all fields

- Given the FK decision number or weekly approved hours are blank
- When I view the Settings page
- Then I see a warning that these fields are required for FK compliance
- And the warning links to the relevant fields so I can fill them in immediately

- Given I want to change my password
- When I click "Change password" in Settings
- Then I am prompted to enter my current password and a new password (minimum 8 characters, confirmed)
- And when I save, my password is updated
- And I see a confirmation message

- Given I enter an incorrect current password
- When I submit
- Then I see an error message
- And my password is not changed

- Given I want to change my email address
- When I update the email field and save
- Then I am prompted to enter my current password to confirm the change
- And a confirmation link is sent to the old email address
- And the email is not updated until I click the confirmation link
- And I see a message telling me to check my old inbox to confirm the change

- Given the confirmation link has expired before I click it
- When I try to click it
- Then I see a message that the link has expired
- And my email remains unchanged
- And I can request a new confirmation from Settings

> 🔁/✋ **Mixed** — password re-entry and error states are automated; confirmation email delivery must be verified manually

---

### US-13b — Connect a dedicated care calendar
**As a** guardian,
**I want to** connect a dedicated Google Calendar for the care arrangement,
**so that** shifts added by me or my assistants are automatically visible in the Kalinga schedule and used to generate the monthly report.

**Acceptance Criteria:**
- Given I am on the Settings page
- When I connect a Google Calendar and select the dedicated care calendar
- Then all events from that calendar appear in the Kalinga schedule view
- And those events are used as the basis for the monthly time report
- And assistants I have shared the calendar with can add and edit events

- Given I choose to disconnect the calendar
- When I click Disconnect
- Then I see a warning that new events will no longer sync
- And I confirm before the disconnection takes effect
- And any hours already logged in draft or approved reports are preserved
- And previously synced shifts remain visible in the schedule view
- And no new events are pulled after disconnection

> 🔁/✋ **Mixed** — calendar connection, event display, disconnect, and data preservation are automated; sharing the calendar with assistants and event creation from both sides must be confirmed manually

> ℹ️ **Best practice:** The guardian creates a dedicated calendar for the care arrangement (e.g. "Mikael Care") rather than connecting an existing personal calendar. All events in the connected calendar are treated as shifts — no tagging required.

> ℹ️ **How to assign shifts to assistants:** When creating a shift event in Google Calendar, invite the assistant's Kalinga email address as a guest. Kalinga matches the guest email to the assistant in the system and attributes the hours to them. Events with no matching guest are shown as unassigned in the schedule.

> ℹ️ **v0.1 scope:** Google Calendar is the only supported schedule input in v0.1. Future versions will add alternative input methods (e.g. CSV import).

---

### US-13c — Broken calendar connection warning
**As a** guardian,
**I want to** be clearly notified if my Google Calendar connection has broken,
**so that** I can reconnect before shifts stop syncing and hours go missing from my reports.

**Acceptance Criteria:**
- Given the Google Calendar OAuth token has expired or been revoked
- When Kalinga attempts to sync and fails
- Then I see a prominent warning on the dashboard that the calendar connection is broken
- And the warning includes a direct link to reconnect in Settings

- Given the same broken connection
- When I navigate to Settings
- Then the calendar connection section clearly shows the connection is broken
- And I can reconnect with one click

- Given I reconnect successfully
- When the sync resumes
- Then the warning is cleared from the dashboard
- And any events added to the calendar during the disconnection period are synced

- Given the connection has been broken for a period
- When I reconnect
- Then I am informed of the date the connection was lost
- So I can check whether any shifts were missed during that window

> 🔁/✋ **Mixed** — broken state detection, warning display, and reconnect flow are automated; email or push notification delivery (if added) must be confirmed manually

---

### US-13d — Delete account
**As a** guardian,
**I want to** permanently delete my account and all associated data,
**so that** my information is fully removed from Kalinga in line with my right to erasure under GDPR.

**Acceptance Criteria:**
- Given I want to delete my account
- When I click "Delete account" in Settings
- Then I am shown a clear warning explaining what will be permanently deleted:
  - My guardian profile and login
  - All assistant profiles
  - All shift data and reports
  - The connected calendar link
- And I am warned that this action cannot be undone

- Given I have reports that have not been marked as sent
- When I attempt to delete my account
- Then I see an additional warning that unsent reports will be lost
- And I am given the option to download all report PDFs before proceeding

- Given I confirm deletion by entering my password
- When the deletion completes
- Then all my data is permanently removed
- And my assistants receive an email notifying them their account access has been revoked
- And I am logged out and redirected to the login page

- Given I change my mind before confirming
- When I cancel
- Then nothing is deleted and I return to Settings

> 🔁/✋ **Mixed** — deletion flow, data removal, and redirect are automated; assistant notification email delivery must be confirmed manually

> ℹ️ **GDPR note:** Account deletion satisfies the right to erasure (Article 17, GDPR). All personal data is permanently deleted, not anonymised or archived.

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

### US-16 — Monthly report covers all logged shifts
**As a** guardian,
**I want to** the monthly report to include all shifts logged for an assistant during that month,
**so that** the total submitted to FK is complete and accurate.

**Acceptance Criteria:**
- Given shifts have been logged for an assistant across a month
- When the monthly report is generated
- Then it includes every logged shift
- And the total hours equal the sum of all entries

> 🔁 **Automated**

---

### US-16b — Overdue report warning
**As a** guardian,
**I want to** be clearly warned when the FK deadline has passed and a report has not been sent,
**so that** I can take urgent action before losing payment for that month.

**Acceptance Criteria:**
- Given the FK deadline for a work month has passed
- And a report for that month has not been marked as sent
- When I view the dashboard
- Then I see a prominent warning identifying which assistant and which month is overdue

- Given the same overdue condition
- When I navigate to the Reports page
- Then the overdue report is visually distinct from other reports
- And it is shown at the top of the list regardless of month order

- Given I mark the overdue report as sent
- When I return to the dashboard
- Then the overdue warning is cleared

> 🔁/✋ **Mixed** — overdue state detection and warning display are automated; visual prominence must be confirmed manually

---

### US-16c — Email notifications for FK deadlines
**As a** guardian,
**I want to** receive email notifications when the FK deadline is approaching and when a report is overdue,
**so that** I am alerted even if I haven't opened the app.

**Acceptance Criteria:**
- Given a report has not been marked as sent
- And the FK deadline for that month is 7 days away
- Then I receive an email identifying the assistant, the work month, and the deadline date
- And the email includes a direct link to the Reports page

- Given the FK deadline has passed
- And a report has not been marked as sent
- Then I receive an email telling me the deadline has passed and payment is at risk
- And the email identifies the assistant and work month
- And the email includes a direct link to the Reports page

- Given I have already marked the report as sent before the deadline
- Then I do not receive either notification for that report

> 🔁/✋ **Mixed** — notification trigger logic is automated; email delivery and link validity must be confirmed manually

> ℹ️ **v0.1 scope:** Email notifications only. Broken calendar connection notifications deferred to v0.2.

---

### US-17 — Hour limit compliance checks
**As a** guardian,
**I want to** be warned when hours are approaching legal limits and blocked from generating a PDF when limits are breached,
**so that** I never submit a report to FK that will result in withheld payment.

> ℹ️ Two separate limits apply. See `docs/fk-rules.md` for full detail.
> 1. **Care package total** — total logged hours across all assistants must not exceed the guardian's FK-approved weekly hours
> 2. **Per-assistant limit** — each assistant is capped at ~52h/week average over a rolling 4-week period and 300h annual overtime (egna arbetsgivare / husligt arbete law)

#### Layer 1 — Warning on the schedule (amber, non-blocking)

- Given an assistant's logged hours in the current 4-week rolling period are approaching 40h/week ordinary limit
- When I view the schedule
- Then I see an amber indicator on that assistant's shifts
- And a message explaining they are entering overtime territory

- Given the total logged hours across all assistants for the month are approaching the care package weekly total
- When I view the schedule
- Then I see an amber warning indicating the care package limit is close

#### Layer 2 — Hard block at PDF generation

- Given an assistant's hours in any 4-week rolling period exceed ~52h/week average
- When I attempt to generate a PDF for that month
- Then PDF generation is blocked
- And I see a clear message identifying which assistant has exceeded their personal limit
- And I am told what the limit is and by how much it has been exceeded

- Given an assistant's annual overtime hours exceed 300h
- When I attempt to generate a PDF
- Then PDF generation is blocked
- And I see a message identifying the assistant and the annual overtime breach

- Given the total logged hours across all assistants exceed the guardian's FK-approved care package total for the month
- When I attempt to generate a PDF
- Then PDF generation is blocked
- And I see a message identifying the overage against the approved total

- Given weekly approved hours have not been set in Settings
- When I attempt to generate a PDF
- Then PDF generation is allowed but I see a warning that the care package check was skipped
- And the warning tells me to complete Settings before submitting to FK

- Given all hour limits are within bounds
- When I attempt to generate a PDF
- Then PDF generation proceeds normally with no compliance warnings

> 🔁 **Automated** — all limit calculations, block conditions, and missing-settings warning are verifiable programmatically against known inputs

---

## Status Key

| Status | Meaning |
|--------|---------|
| `draft` | Hours being logged, not yet reviewed |
| `approved` | Reviewed and approved by guardian — PDF can be generated |
| `sent` | PDF generated and mailed to FK |

---

### BUG-01 — Login failure shows no error message
**Severity:** High
**Found in:** US-01 acceptance test run
**Expected:** Wrong password → error message shown, form stays populated
**Actual:** Form silently resets, no error message shown. Network confirms `POST /api/auth/login → 401` but UI does nothing.

---

### BUG-02 — Assistant detail page missing
**Severity:** High
**Found in:** US-08 acceptance test run
**Expected:** Clicking an assistant's name navigates to `/assistants/:id` with their profile
**Actual:** Route does not exist — redirects to login

---

### BUG-03 — FK Decision Number not written to FK 3057
**Severity:** High — FK compliance risk
**Found in:** PDF code review (pdf.ts) + FK 3059 form field inspection
**Expected:** `fkDecisionNo` from Settings is written to the FK 3057 PDF form
**Actual:** FK 3059 has no decision number field (FK identifies the case by patient PNO). FK 3057 is where the decision number belongs — but the FK 3057 form file (`fk3057.pdf`) is missing from the `forms/` directory. Until FK 3057 is added, the decision number cannot be filled.

---

### BUG-04 — Assistant PNO and phone not collectable at invite time
**Severity:** Medium — FK compliance risk
**Found in:** PDF code review (pdf.ts) + Assistants.tsx
**Expected:** Guardian can enter assistant PNO and phone when adding a new assistant
**Actual:** Add assistant form only collects name and email. PNO and phone can only be added later via edit. Any FK 3059 generated before the guardian edits the assistant will have blank PNO and phone fields.

---

---

## Open Questions

> Items that need external confirmation before the relevant stories or compliance rules can be finalised.

| # | Question | Affects | Status |
|---|----------|---------|--------|
| OQ-01 | How are Väntetid and Beredskapstid weighted against the weekly hours limits under lagen om arbetstid i husligt arbete? Do they count at full rate, half rate, or some other ratio toward the 40h ordinary + 12h overtime cap? | US-17, fk-rules.md | **Closed — counting 1:1 for MVP. Conservative: more likely to warn than to miss a violation. Revisit if guardians report false blocks.** |

---

## Known Bugs

> Bugs found during user story review and acceptance testing. To be migrated to GitHub Issues when the repo is set up.

---

### BUG-05 — FK 3059 page 1 section 5 employer type missing ✅ Closed
**Severity:** Medium — FK compliance risk
**Found in:** PDF code review (pdf.ts) + FK 3059 form field inspection
**Fixed:** Section 5 employer type hardcoded to '3' (privatperson/egna arbetsgivaren) — correct for all Kalinga users.
**Won't fix — Section 3 (Kollektivavtal):** Egna arbetsgivare almost never have a collective agreement. Kalinga's MVP target user will not have one. Leaving Section 3 blank is correct by design. If a user does have a kollektivavtal, they fill it in manually on the printed form before signing.

---

## 8. Assistant View

> **Scope note:** The full assistant experience (clock in/out, schedule view, notifications) is deferred to v0.2. The stories below cover only what an assistant sees in v0.1 after accepting their invitation and logging in.

### US-18 — Assistant landing view (v0.1)
**As an** assistant who has set up my account,
**I want to** see something meaningful when I log in,
**so that** I know my account is active and what I can expect in future versions.

**Acceptance Criteria:**
- Given I have accepted my invitation and set up my account
- When I log in
- Then I see my name and the name of the guardian I am employed by
- And I see a message explaining that the assistant app is coming soon
- And I am not shown any guardian-only pages (reports, settings, patient profile)

- Given I try to navigate to a guardian-only route directly
- When I access it
- Then I am redirected and see an appropriate message

> 🔁 **Automated** — role-based routing and redirect can be verified programmatically

> ℹ️ **v0.2:** Full assistant view including schedule, shift history, and clock in/out will be built once the guardian view is complete.
