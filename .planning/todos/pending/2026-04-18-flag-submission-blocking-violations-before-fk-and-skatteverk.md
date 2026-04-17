---
created: 2026-04-18T00:00:00Z
title: Flag submission-blocking violations before FK and Skatteverket report download
area: ui
planned_milestone: v1.2
files:
  - client/src/pages/Monthly.tsx
  - client/src/pages/Records.tsx
  - server/src/lib/submissionValidator.ts  # NEW — proposed pure-function module
  - server/src/routes/pdf.ts
  - server/src/lib/form4805-utils.ts
  - .planning/compliance/2026-03-advisor-brief.md
---

> **Milestone assignment (2026-04-18):** This design is scoped for **v1.2 — Submission Readiness Gate**. See ROADMAP.md "Future Milestones" section. Promote via `/gsd-new-milestone v1.2` after v1.0 archives.


## Problem

The Monthly page lets the guardian click "Download FK 3057 / FK 3059 / SKV 4805" and the PDF generates — even when the form data would be rejected by the receiving authority. During March 2026 retroactive prep, every single PDF that would have been generated had at least one rejection-blocker (placeholder pno, blank FK beslutsnummer, missing address, etc.), but the system produced no warning whatsoever. The guardian only learns about rejection after posting to FK or uploading to Skatteverket — by which time the monthly deadline may have already passed and late-submission penalties apply.

**Distinct from the Home-page notification todo** — that one is about *operational / scheduling* violations (ATL dygnsvila, övertid, FK coverage) that are preventable at scheduling time. **This todo is about *submission-time* blockers** — the form data itself is invalid regardless of the underlying schedule. Two separate walls of checks, fired at different moments in the workflow.

## Solution

Add a **"Submission readiness"** panel on the Monthly page (and on Records → FK Submissions / Payroll tabs) that runs pre-flight validation on every PDF before allowing download. Each form has its own checklist of required fields; a blocker in any one of them disables the corresponding download button and explains why.

### Blocker matrix (v1)

Per receiving authority × per form × per assistant/month:

#### FK 3057 (assistansersättning räkning)

| Blocker ID | Field | Why it blocks | Where to fix |
|------------|-------|---------------|--------------|
| `FK-3057-BRUKARE-PNO` | `profile.patientPno` empty or placeholder `000000-0000` | FK rejects without valid brukare pno | Settings → Profile |
| `FK-3057-BRUKARE-NAME` | `profile.patientName` empty or starts with `"TBD"` | Header invalid | Settings → Profile |
| `FK-3057-BESLUTSNUMMER` | `profile.fkDecisionNo` empty or starts with `"TBD"` | FK rejects without beslutsnummer | Settings → Profile |
| `FK-3057-GUARDIAN-PNO` | `profile.guardianPno` empty | Required for vårdnadshavare identification | Settings → Profile |
| `FK-3057-GUARDIAN-NAME` | `profile.guardianName` empty | Signatory block blank | Settings → Profile |
| `FK-3057-ZERO-HOURS` | No approved entries for the month | No bill to submit | Monthly Step 1-2 |
| `FK-3057-DECISION-EXPIRED` | Current month outside `profile.fkDecisionStart/End` window | Bill will be rejected as outside decision period | Settings → Profile (renew decision) |
| `FK-3057-HOURS-EXCEED-DECISION` | Total approved hours > `profile.fkDecisionHoursPerDay × daysInMonth` | FK won't pay excess; flag so guardian chooses to trim or accept partial | Monthly Step 1 (trim entries) |
| `FK-3057-PNO-FORMAT` | Any pno field fails Luhn/format check | Format rejection at intake | Corresponding field |

#### FK 3059 (tidredovisning)

| Blocker ID | Field | Why it blocks |
|------------|-------|---------------|
| `FK-3059-ASSISTANT-PNO` | Any assistant with approved entries this month has empty/placeholder pno | Each assistant block on 3059 requires their pno |
| `FK-3059-ASSISTANT-NAME` | Any assistant has empty name | Form header blank |
| (shared with 3057) | brukare pno, beslutsnummer | Same header as 3057 |

Note: FK 3059 itself requires handwritten assistant signatures on paper. That can't be pre-flighted — it's a manual step. But the pre-filled form should at least be valid so signatures aren't spent on a rejected document.

#### SKV 4805 (Förenklad arbetsgivardeklaration)

| Blocker ID | Field | Why it blocks |
|------------|-------|---------------|
| `SKV-4805-EMPLOYER-PNO` | `profile.patientPno` empty/placeholder (brukare is the legal employer for personal assistance) | Skatteverket rejects |
| `SKV-4805-ASSISTANT-PNO` | `assistants.pno` empty/placeholder | Form invalid |
| `SKV-4805-ASSISTANT-ADDRESS` | `assistants.address` empty/`"TBD"` | Required field |
| `SKV-4805-PAYROLL-NOT-APPROVED` | Corresponding `payrollRecords.status !== "approved"` | 4805 derives from payroll — already enforced (409), restate as UI blocker |
| `SKV-4805-TAX-TABLE-MISSING` | `assistants.skattetabell` empty AND flat `preliminary_tax_rate` not confirmed | Flat 30% is a schablon; Skatteverket prefers per-individual table. Warn if not configured. |
| `SKV-4805-PERIOD-OUT-OF-EMPLOYMENT` | Declaration month outside `assistants.employmentStart/End` | Invalid period |

### UX

Mock — a card at the top of Monthly (above the stepper) or inline in Step 4:

```
┌─ Submission readiness ─────────────────────────────────┐
│                                                        │
│  FK 3057 (March 2026)                                  │
│  ❌ 3 blockers — cannot submit                         │
│     • Patient personnummer is missing (Settings)       │
│     • FK beslutsnummer is missing (Settings)           │
│     • Patient name contains placeholder "TBD" (Settings) │
│                                                        │
│  FK 3059 (March 2026)                                  │
│  ❌ 4 blockers — cannot submit                         │
│     • 3 from FK 3057 above                             │
│     • Mikael Karon's personnummer is missing (Assistants)│
│                                                        │
│  SKV 4805 — Rose Karon (March 2026)                    │
│  ❌ 2 blockers                                         │
│     • Address is "TBD" (Assistants → Rose → Edit)      │
│     • Employer personnummer is missing (Settings)      │
│                                                        │
│  SKV 4805 — Mikael Karon (March 2026)                  │
│  ❌ 3 blockers                                         │
│     • 2 from Rose's 4805 above                         │
│     • Mikael's personnummer is missing                 │
│                                                        │
│  [ Go to Settings → ]                                  │
└────────────────────────────────────────────────────────┘
```

- **Red (error)**: download button disabled. Tooltip: "Fix the blockers above before downloading".
- **Amber (warning)**: button still enabled but confirmation modal on click. Example: "hours exceed FK decision — are you sure?"
- Each blocker row is clickable and deep-links to the field that needs filling (Settings with the field pre-focused, or Assistants → Edit dialog pre-opened on the right tab).

### Server-side enforcement

Don't trust the client. Mirror the same checks on POST `/api/pdf/4805`, `/api/pdf/fk3057`, `/api/pdf/fk3059`:
- If any `error`-severity blocker fires, return `422 Unprocessable Entity` with the blocker list in the response body.
- Client PDF handler surfaces the server-reported blockers if somehow a stale UI allowed the click through.

### Implementation sketch

**1. New pure-function module** `server/src/lib/submissionValidator.ts`:

```ts
export type Blocker = {
  formId: "fk3057" | "fk3059" | "skv4805";
  assistantId?: string;   // 4805 and 3059 are per-assistant
  blockerId: string;
  severity: "error" | "warning";
  message: string;
  fixLocation: { page: "settings" | "assistants" | "monthly"; focus?: string };
};

export function validateFK3057(month, profile, entries): Blocker[] { ... }
export function validateFK3059(month, profile, assistants, entries): Blocker[] { ... }
export function validateSKV4805(month, profile, assistant, payrollRecord): Blocker[] { ... }
```

Each function is a pure filter — given the inputs, return the list of blockers. Fully unit-testable.

**2. New endpoint** `GET /api/submissions/readiness?month=YYYY-MM`:
- Loads profile, assistants, approved entries, approved payroll for the month
- Runs all three validators
- Returns a structured object the client can render

**3. Refactor existing PDF routes** to reuse the validator — return 422 on any error. Keep the existing 409 on "payroll not approved" (already checked).

**4. Client Monthly.tsx** queries `/api/submissions/readiness` on mount + whenever entries/payroll/settings invalidate. Renders the card above Step 4.

**5. Records.tsx "FK Submissions" tab** mirrors the card for historical months, so the guardian can see retroactively which submissions were valid at the time and catch stale records.

### Why separate from the Home-page violations card

| | Home card (other todo) | Monthly card (this todo) |
|---|---|---|
| When fires | On every schedule change | On month approaching submission |
| What checks | Scheduling rules (ATL §5/§13, FK coverage) | Form-data completeness (pno, addresses, beslutsnummer) |
| Blocks | Approving entries | Downloading PDFs |
| Fix path | Adjust shifts | Fill Settings data |
| Timeframe | The working week | The month being filed |

They're complementary — the Home card prevents bad schedules from being approved; the Monthly card prevents bad approved data from being submitted.

### Sequencing

- **Phase v1.1** (if shipped with the schema additions) — covers all FK 3057 and 4805 blockers that depend on already-existing fields plus the new ones. Requires the companion schema-additions todo to land first.
- **Phase v1.1 lite** (no schema change) — ships ~6 of 12 blockers that need no new columns (patient pno, brukare name, beslutsnummer, guardian pno, guardian name, zero-hours, assistant pno, assistant address). Ship this first; enable the schema-dependent blockers as the columns arrive.

## Acceptance criteria

- Given all required fields populated: panel is green "Ready to submit", download buttons enabled.
- Given any `error`-severity blocker: relevant download button is disabled with hover tooltip listing blockers.
- Given `warning`-severity blocker: button enabled; click shows a confirmation modal listing warnings.
- Clicking a blocker row deep-links to the fix location (Settings → field focused, or Assistants → edit dialog on the right assistant).
- Server endpoint matches client checks — bypassing client returns 422 with the same blocker list.
- Records.tsx → FK Submissions tab shows historical readiness per month.

## Related

- Triggered by: [.planning/compliance/2026-03-advisor-brief.md](../../compliance/2026-03-advisor-brief.md) (every March PDF would have shipped with placeholder pno → rejected)
- Depends on schema: [2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md](2026-04-18-capture-missing-assistant-and-profile-fields-for-fk-and-skat.md) — the FK-decision-expired + employment-period blockers need new columns. Ship the data-only blockers first.
- Complements: [2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md](2026-04-18-home-notification-for-labor-law-and-fk-schedule-violations.md) — schedule-level vs submission-level split. Both together = end-to-end compliance awareness.
