# HANDOFF — Kalinga Assistansportal (v1.0.1 paused 2026-04-20)

> **You are picking up paused work.** A fresh LLM / fresh session can resume from here without loss. All work is committed and pushed to `origin/milestone/v1.0.1`.

## TL;DR

- **Milestone:** v1.0.1 (Salary Slip + Foundation Cleanup)
- **Progress:** 75% — Phases 7, 8, 9 ✅ shipped + UAT-clean. Phase 10 is next.
- **Current state:** Phase 10 CONTEXT.md is captured. Plans not authored.
- **Resume command:** `/gsd-plan-phase 10`
- **Git:** branch `milestone/v1.0.1`, HEAD `850ecbb`, pushed to origin. No PR open against `main` yet (hold until Phase 10 ships).

## Read order on resume

1. **This file.**
2. [STATE.md](STATE.md) — frontmatter shows `status: paused`, `resume_action: /gsd-plan-phase 10`.
3. [ROADMAP.md](ROADMAP.md) HANDOFF section — project context (what v1.0.1 is, why, the 8 binding decisions from 2026-04-18).
4. [PROJECT.md](PROJECT.md) — product vision, users, anhörigassistans arrangement.
5. [REQUIREMENTS.md](REQUIREMENTS.md) — 18 v1.0.1 requirements, current statuses (15 Complete / 3 Pending under DATA-0x).
6. [phases/10-real-data-entry/10-CONTEXT.md](phases/10-real-data-entry/10-CONTEXT.md) — decisions already captured for Phase 10.

Then run `/gsd-plan-phase 10`.

## Product snapshot (memorise before coding)

- **Users:** one guardian (Rose Karon, parent), two assistants (Rose + Mikael, both parents of the patient). Patient is the legal employer (brukare); guardian is the administrator/representative.
- **Anhörigassistans:** fixed hourly 254.10 kr/h, no paid sick leave, no VAB pay, no vacation pay, no pension. Legal because they're the patient's parents.
- **Tech stack:** React + Vite (client), Express + Drizzle + PostgreSQL (server), pdf-lib + pdfkit (PDFs), TypeScript throughout.
- **Source-of-truth duality:** schedule display (Home.tsx) reads Google Calendar; FK/payroll/invoice reads the internal `entries` table. Known design issue; v2.0 will reconcile.
- **Three binding guardian directions:** flat 30% preliminärskatt is acceptable (H3 known issue); omkostnader pot overpay accepted (H5 known issue); arbetsgivaravgifter + total kostnad must NOT appear on the assistant-facing salary slip.

## What Phase 9 shipped (so Phase 10 has a substrate)

**Live in `milestone/v1.0.1`:**

- **Schema:** `payment_slips` audit table (+2 indexes); `assistants.{salary_model, hourly_rate_override, payment_method}`; `profile.default_pay_day` (1–28 clamp).
- **Library:** `buildAnhorigSlip()` pure field builder + `renderAnhorigSlipPdf()` pdfkit renderer at `server/src/lib/`. 23 unit tests green.
- **Endpoints:**
  - `POST /api/pdf/lonespec` — guardian. Gates: D-12 NULL-rate (400) → D-08 approval (409) → 200 PDF.
  - `GET /api/pdf/lonespec/me?month=YYYY-MM` — assistant self-service. JWT-bound `assistantId` only (IDOR-safe).
  - `GET /api/assistant/slips` — JWT-bound listing.
- **UI:**
  - Monthly "Lönespecifikation" section with per-approved-assistant rows (3 disabled states: ready / Lönekörning ej godkänd / Timlön saknas).
  - AssistantDashboard "Lönespecifikationer" card (loading / error / empty / populated).
  - Settings 4 new fields (Avtalsmodell dropdown, Utbetalningssätt dropdown, Timlön number, Utbetalningsdag number).
- **Key invariants (memorise):**
  - D-05 audit-metadata-only (payment_slips never holds PII beyond FKs).
  - D-06 rebuild-on-download (every PDF regenerates from current DB on every fetch).
  - D-08 approval gate (payroll must be `status='approved'` else 409).
  - D-09 pay-date freeze at issuance (stored on the slip row; changing `profile.default_pay_day` afterwards does NOT mutate issued slips).
  - D-12 hourly_rate_override NULL → 400 BEFORE approval check (guardian's fix is to set the rate, not re-approve payroll).
- **Tests:** 23 unit + 21 route-integration + UAT 9/9 (see [phases/09-salary-slip/09-UAT.md](phases/09-salary-slip/09-UAT.md)).

## Phase 10 (the next phase) — where it stands

**Context is captured at [phases/10-real-data-entry/10-CONTEXT.md](phases/10-real-data-entry/10-CONTEXT.md). Decisions locked:**

- **D-01** Claude drives data entry via `PUT /api/profile` + `PUT /api/assistants/:id` (user supplies real values inline).
- **D-02** Legacy `profile.address` kept populated AND new split `address_street/zip/city` filled to mirror it — both reflect current reality.
- **D-03** Order: Profile → Assistants → Verify.
- **D-04** PDF walkthrough samples Rose only (FK 3057 + Rose SKV 4805 + Rose salary slip). Data-entry covers BOTH Rose and Mikael.
- **D-05** Walkthrough month: `2026-03` (approved payroll + slip already issued; re-download tests D-06 rebuild-on-download against updated data).
- **D-06** Placeholder detection: `pdftotext` grep + visual, run inside `/gsd-verify-work` UAT (same pattern as `09-UAT.md`).
- **D-07** Placeholder pattern set: `TBD`, `000000-0000`, `TBD-FK-DECISION`, all-same-digit pno, `23123123123123`, `placeholder`, empty-address artefacts (case-insensitive).

**Known dev-data gaps to close (already diagnosed):**

- `profile.fk_decision_no = "23123123123123"` (placeholder)
- `profile.fk_decision_start`, `fk_decision_end` both NULL
- `profile.address_street/zip/city` all empty (legacy `profile.address` is "Warfvinges väg 23 LGH 1201")
- `assistants.address_street/zip/city` all empty for both Rose + Mikael
- `assistants.bank_clearing/bank_account/iban` all empty for both Rose + Mikael
- `mikael@karon.se` auth row has `assistant_id = NULL` (password-auth signup, not invite-link). Not part of Phase 10's 3 criteria, but means the positive IDOR test for Mikael can't run; negative side (query injection blocked) is already verified.

**Next command on resume:** `/gsd-plan-phase 10`.

## Environment facts a resumer will need

- **Working directory:** `/Users/rosekaron/Desktop/Kalinga/assistansportal`
- **Ports:** server 3001 (Express), client 5173 (Vite)
- **DB:** `localhost:5432/assistansportal` via `server/.env` `DATABASE_URL`
- **Auth secret:** `server/.env` `JWT_SECRET` (used by Phase 9's UAT to forge role-scoped tokens for automated API tests — same trick works for Phase 10)
- **Dev accounts in `auth` table:**
  - `rose@karon.se` — role=guardian, assistant_id=`a59ff89a2`
  - `mikael@karon.se` — role=assistant, assistant_id=NULL (see gap note above)
- **Dev start:** from repo root `npm run dev` runs server+client concurrently
- **Preview tooling:** `.claude/launch.json` defines the Vite server for the `Claude_Preview` MCP (`assistansportal` config name, port 5173)
- **One existing payment_slip row:** `slipd706cf57 / LS-2026-03-001` for Rose 2026-03, pay_date=2026-04-25, issued_at=2026-04-19T20:52:31.277Z. D-06 rebuild-on-download + D-09 pay-date freeze both verified against this row in Phase 9's UAT.

## Git state at pause

```
Branch:   milestone/v1.0.1
HEAD:     850ecbb docs(10): capture phase context
Pushed:   origin/milestone/v1.0.1 ✓
Untracked (not mine): .planning/compliance/2026-03-smoke-test/
PR:       NONE. Strategy is to hold until Phase 10 ships, then open v1.0.1 → main
```

Recent commits for orientation:

```
850ecbb docs(10): capture phase context           ← Phase 10 discuss
ad13a6a test(09): complete UAT — 9/9 passed       ← Phase 9 verified
b7105fb docs(09): close out phase — SUMMARY + ROADMAP/STATE to 100%
3ce1676 docs(09-04): close out UI surfaces plan — 6/6 human-verify subtests passed
1a1cc0a feat(09-04): add Settings fields for salary model, rate, payment method, pay day
9a9e094 feat(09-04): add AssistantDashboard Lönespecifikationer section
07531ac feat(09-04): add Monthly Lönespec download row with 3 disabled states
```

## Resuming — quickstart commands

```bash
# 1. Sync
cd /Users/rosekaron/Desktop/Kalinga/assistansportal
git checkout milestone/v1.0.1
git pull origin milestone/v1.0.1

# 2. Confirm DB + server boot cleanly (optional sanity)
cd server && npm run dev
# expect: ✅ Server running → http://localhost:3001, Postgres → localhost:5432/assistansportal

# 3. Start planning Phase 10
# (from inside Claude Code)
/gsd-plan-phase 10
```

## If something went wrong during pause

- **`origin/milestone/v1.0.1` is the source of truth.** Local HEAD should match `850ecbb`.
- **No uncommitted changes are expected.** `git status` should be clean except for the pre-existing untracked `.planning/compliance/2026-03-smoke-test/` directory.
- **If STATE.md conflicts with something remembered from the CLI state tool:** trust STATE.md body. The CLI `gsd state json` output is occasionally behind because it indexes directories; the markdown body is the canonical human record.

---

*Handoff written: 2026-04-20*
*Paused by: user request ("pause development ... make sure I don't lose any of the work")*
*Resume point: `/gsd-plan-phase 10` — Phase 10 CONTEXT.md ready, no open threads.*
