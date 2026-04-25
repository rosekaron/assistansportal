# Phase 9: Salary Slip (Anhörig Model) — Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-19
**Phase:** 09-salary-slip
**Areas discussed:** Visual fidelity, Slip numbering + replay, PDF persistence, Pay date/method + rate fallback + historical, Pay-period convention (raised mid-discussion)

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| How the slip looks | Branding, layout polish, fields shown | ✓ |
| Slip numbering + replay | Sequence scope, re-download/edit semantics | ✓ |
| Save PDF vs rebuild | Persistence model | ✓ |
| Pay date/method + historical slips | Where values come from, eligibility rules | ✓ |

**User picked all 4.**

---

## Visual Style

| Option | Description | Selected |
|--------|-------------|----------|
| Plain, clean, text-only | Match ROADMAP mock literally; no logo, no branding | ✓ |
| Light branding | App-name text header + dividers, no logo image | |
| Full branding with logo | Logo image in header | |

**User's choice:** Plain, clean, text-only.

## Header Fields (multiSelect)

| Option | Description | Selected |
|--------|-------------|----------|
| Employer's (patient's) full address | From Phase 7 split address columns via Phase 8 helper | ✓ |
| Assistant's bank clearing + account | Verification line; hidden when not set | ✓ |
| Assistant's full address | Less common on Swedish slips | |
| Skattetabell number | Only meaningful when per-assistant skattetabell ships (v1.4) | |

**User's choice:** Address + bank.
**Notes:** User asked Claude to add "skattetabell on slip" to v1.4 + v1.5 ROADMAP entries as proof of deferral, then show the proof. Edits applied to ROADMAP.md lines 403 (v1.4) and 421 (v1.5). Proof shown inline in conversation.

---

## Slip Numbering — Sequence Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Per-assistant-per-month | Each assistant has its own NNN sequence per month | ✓ |
| Global-per-month | Single household sequence across all assistants per month | |
| Global-per-year | One sequence across the whole year | |

**User's choice:** Per-assistant-per-month.

## Replay Semantics

| Option | Description | Selected |
|--------|-------------|----------|
| Re-download reuses; edit issues NEW number + archives old | Bokföringslagen-strict supersede pattern | |
| Re-download reuses; edit OVERWRITES same number | One (assistant, month) = one number forever | ✓ |
| Every download = new number | Heaviest audit trail | |

**User's choice:** Re-download reuses; edit overwrites the same number.
**Notes:** Schema reserves a `sequence` column so future supersede semantics can ship without migration; logic is deferred.

---

## PDF Persistence

| Option | Description | Selected |
|--------|-------------|----------|
| Rebuild every time from payroll snapshot | Metadata-only payment_slips; deterministic regen | ✓ |
| Save PDF blob, rebuild only if missing | Cached output; overwritten on edit | |
| Save PDF blob immutably | 7-year frozen file; conflicts with overwrite-on-edit | |

**User's choice:** Rebuild every time. Aligns with the overwrite-on-edit choice from the previous question.

---

## Pay Date / Pay Method

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-default, no guardian input | "Banköverföring" + 25th of following month, hardcoded | |
| Guardian types both at issue time | Per-download dialog | |
| Pay date auto, pay method per-assistant in Settings | Hybrid | |
| **Configured in Settings (user-typed)** | One-time setup in Settings; revisit with Fremia/Custom | ✓ |

**User's choice:** "guardian fills it at settings time. then we revisit it when we add fremia and custom pay calculation which is already part of the roadmap. contradict me if this doesnt make sense"

**Claude's contradictions:** (a) one global pay-day means changing Settings to issue a one-off month on a different day; (b) v1.0.1 won't shift pay date back to preceding banking day if it falls on weekend/red day. User accepted both trade-offs; both captured as deferred.

**Follow-up clarification:**

| Option | Description | Selected |
|--------|-------------|----------|
| Guardian types pay date + pay method per-download (dialog) | | |
| **Guardian fills in Settings once, slip uses defaults** | | ✓ |

**Resolution:**
- `profile.default_pay_day` integer 1–28, default 25 (in Settings → Profile)
- `assistants.payment_method` reuses existing paymentMethodEnum (bankgiro/swish/kontant), default bankgiro (in Settings → Assistants edit)
- Both frozen onto `payment_slips` row at issue time

---

## Historical Slip Eligibility

| Option | Description | Selected |
|--------|-------------|----------|
| Yes, with defaults filled in | Phase 7 already defaulted salaryModelUsed='anhörig' | ✓ |
| Only post-Phase-9 payroll | Refuse generation on legacy records | |
| Yes with 'regenerated from estimate' watermark | Most transparent | |

**User's choice:** Yes, with defaults filled in.

---

## Hourly Rate Fallback

| Option | Description | Selected |
|--------|-------------|----------|
| payroll_records.hourlyRateUsed snapshot | Use snapshot, fall back to FK_HOURLY_RATE env if 0 | |
| assistants.hourly_rate_override at generation time | Live value, risks drift | |
| **Error if override is null** | Hard gate; force conscious data entry | ✓ |

**User's choice:** Error out if `hourly_rate_override` is null. Returns 400 with Swedish error message; planner has discretion on exact wording.

---

## Pay-period Convention (raised by user mid-discussion)

User asked: "how is the pay calculated is it from 26 of the previous month to the 25th of the current month?"

Claude clarified that the codebase has used calendar-month boundaries since v1.0 Phase 3 — `monthStart = "${month}-01"`, `monthEnd = "${month}-{daysInMonth}"` (server/src/routes/payroll.ts:57-59). Phase 9 displays whatever payroll computed; period semantics are not in Phase 9 scope.

| Option | Description | Selected |
|--------|-------------|----------|
| Keep calendar month for v1.0.1 | Phase 9 ships as planned; the 26-to-25 convention would be a future payroll refactor | ✓ |
| Add a 'switch to 26-to-25' phase BEFORE Phase 9 | ~1–2 days payroll refactor + v1.0 Phase 3/4 retest | |
| Something else | | |

**User's choice:** Keep calendar month for v1.0.1.
**Notes:** Per user request, neither the period clarification nor a deferred entry for the 26-to-25 alternative were retained in CONTEXT.md. The decision history is preserved here in this audit log only.

---

## Claude's Discretion (recorded in CONTEXT.md D-section)

- Final TypeScript signature of `buildAnhorigSlip()`
- File location of slip builder (`payrollSlipUtils.ts` recommended)
- pdfkit-vs-alternative library if pdfkit unsuitable
- Exact Swedish error message wording (D-12)
- pdf font/size/spacing within "plain, no branding" envelope
- AssistantDashboard list density + empty-state copy
- Where `default_pay_day` lives in Settings → Profile collapsibles
- Plan decomposition (one plan vs multiple)

## Deferred Ideas (recorded in CONTEXT.md)

- Banking-day pay-date shift
- Per-month pay-date override
- Supersede-on-edit slip versioning
- Storing PDF blobs for 7-year retention
- Skattetabell on slip (added to ROADMAP v1.4 + v1.5 as proof during this session)
