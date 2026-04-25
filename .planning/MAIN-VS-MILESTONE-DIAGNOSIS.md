---
title: main ↔ milestone/v1.0.1 divergence diagnosis
written: 2026-04-25
context: discovered while attempting to merge PR #7 (milestone/v1.0.1 → main)
status: open — pending guardian decision before any code merge
---

# main ↔ milestone/v1.0.1 — divergence diagnosis

## TL;DR

`main` and `milestone/v1.0.1` are **two parallel development tracks** that diverged on 2026-03-26 and never reconciled. Both branches have real, complementary code added to the same files (`server/src/db/schema.ts`, `assistant.ts`, `assistants.ts`, `pdf.ts`). Neither branch is a strict subset of the other.

PR #7 (this session's milestone ship) cannot auto-merge — `gh pr merge` returned `not mergeable` because of these conflicts.

**No code changes made today to resolve this.** This document exists so a future session can decide.

## Branch topology

```
                    558c577  (2026-03-26)
                    Merge PR #5: devcontainer
                         │
                ┌────────┴────────┐
                │                 │
       (origin/main HEAD)   (milestone/v1.0.1 HEAD)
       30 commits           276 commits
       last: 2026-04-11     last: 2026-04-25
       4c5df71              9f4a005
```

**Common ancestor:** `558c577` (2026-03-26 — Merge PR #5 from `mikaelkaron/devcontainer`)

**`origin/main`:**
- 30 divergent commits between 2026-03-28 and 2026-04-11 (~2 weeks of work)
- Activity froze around 2026-04-11 — last 4 commits are README cleanup (`Delete what-are-claude-skills-blog.md`, `Update README to include roadmap`, `Remove installation prerequisites`, `Add gratitude note`)
- Substantive code work happened earlier in April (US-13b/13c real Google OAuth, US-24/25/26 multi-family, US-23 missed-clock fix, clock-in/out columns, AssistantDetail page, dashboard rewrites)

**`milestone/v1.0.1`:**
- 276 divergent commits between 2026-04-06 and 2026-04-25 (~3 weeks of GSD-driven work)
- Hosts the v1.0.1 milestone: Phase 7 (Foundation + Schema), Phase 8 (Employer Helper), Phase 9 (Salary Slip), Phase 10 (Real Data Entry & E2E). All four shipped + UAT-clean as of 2026-04-25.

**Hypothesis:** Around 2026-04-11, the project transitioned from linear development on `main` to GSD-driven milestone branches. `main` went dormant for code (only README edits since). Meanwhile `milestone/v1.0.1` was likely cut from `milestone/v1.0-mvp` (the v1.0 ship branch) which itself probably never merged back to `main`. Result: `main` has v1.0-era features that the milestone branches never inherited, and milestone branches have v1.0.1 features that main never saw.

## What `main` has that `milestone/v1.0.1` does NOT

### Code (substantial — 30 commits, +2613/-930 lines, 20 files)

**Database schema (`server/src/db/schema.ts`):**
- `linkStatusEnum` (`pending`/`accepted`/`declined`)
- `profile.authId` — FK to auth.id (multi-guardian preparation)
- `assistants.guardianAuthId` + `familyLabel` (multi-family display)
- New `authAssistants` table — many-to-many auth ↔ assistants pivot
- `entries.clockedInAt`, `clockedOutAt`, `actualHours`, `guardianAdjusted` (clock-in/out feature on entries themselves)

**Routes / features:**
- Real Google Calendar OAuth flow with broken-connection warning (US-13b/13c) — `server/src/routes/gcal.ts`, `client/src/pages/Settings.tsx`
- Multi-family assistant support (US-24/25/26) — assistants can serve multiple guardians, switch active context
- Guardian fixes missed clock-in/out times (US-23) — `server/src/routes/assistant.ts` extended +217 lines
- Clock-in / clock-out UI on assistant view, auto-submit on clock-out (US-18, US-20, US-21)
- New page: `client/src/pages/AssistantDetail.tsx` (98 lines)
- Reports rewrite: `client/src/pages/Reports.tsx` (+167 lines)
- AssistantDashboard rewrite: `client/src/pages/AssistantDashboard.tsx` (494 lines on main vs 584 on milestone — they're DIFFERENT implementations)

**Docs:**
- `docs/fk-rules.md` (130 lines) — FK rules reference
- `docs/user-stories.md` (1,194 lines added) — comprehensive user-story doc
- `ROADMAP.md` (top-level, 91 lines added — separate from `.planning/ROADMAP.md`)
- `forms/fk3057.pdf` (775 KB binary updated)
- README.md (rewritten — see file-level comparison below)

### File-level summary (main → milestone diff)

| File | Lines changed (main) | Note |
|------|---------------------|------|
| `client/src/pages/AssistantDashboard.tsx` | +567 | Different implementation than milestone's |
| `docs/user-stories.md` | +1194 | Doesn't exist on milestone at all |
| `docs/fk-rules.md` | +130 | New file on main only |
| `server/src/routes/assistant.ts` | +217 | US-18..23 feature work |
| `client/src/pages/Reports.tsx` | +167 | Different from milestone's `Records.tsx` |
| `client/src/pages/Settings.tsx` | +213 | OAuth UI, multi-family switcher |
| `client/src/pages/AssistantDetail.tsx` | +98 | New page on main only |
| `server/src/routes/pdf.ts` | +126 | Earlier FK form fixes (BUG-01..05, väntetid totals) |
| `server/src/routes/assistants.ts` | +86 | Multi-family endpoints |
| `client/src/pages/Dashboard.tsx` | +155 | Different from milestone's `Home.tsx` |
| `server/src/db/schema.ts` | +52 | Multi-family + clock-in/out columns |
| `client/src/pages/Assistants.tsx` | +25 | (milestone may not have this file) |
| `client/src/lib/api.ts` | +38 | Multi-family API helpers |
| `server/src/routes/gcal.ts` | +25 | Real OAuth flow |
| `client/src/App.tsx` | +4 | Routing for new pages |

## What `milestone/v1.0.1` has that `main` does NOT

### Code (276 commits, full v1.0.1 milestone)

**Database schema:**
- `reqStatusEnum` extended with `"cancelled"` value
- New enums: `absenceTypeEnum`, `payrollStatusEnum`, `paymentMethodEnum`, `clockTypeEnum`, `taxSchemeEnum`, `patientRelationEnum`, `salaryModelSnapshotEnum`
- `profile`: split address (street/zip/city), FK decision dates (start/end), `dubbelAssistansApproved`, `patientRelationToGuardian`, `patientRequiresRepresentative`, `defaultPayDay` (1–28 clamp)
- `assistants`: split address, `taxScheme`, `bankClearing`/`bankAccount`/`iban`, `skattetabell`, `employmentStartDate`/`End`, `citizenship`, `residencePermitExpiry`, `notes`, `salaryModel`, `hourlyRateOverride`, `paymentMethod`
- New tables: `paymentSlips` (audit), `absences`, `payrollRecords`
- `entries.cancelled` flag

**Routes / features:**
- `server/src/lib/employer-representation.ts` — `resolveEmployerRepresentation()` helper (Phase 8) — 23 unit tests
- `server/src/lib/payrollSlipUtils.ts` — `buildAnhorigSlip()` field builder
- `server/src/lib/pdfSlipRenderer.ts` — `renderAnhorigSlipPdf()` pdfkit renderer
- `POST /api/pdf/lonespec` (guardian) — salary slip download with approval gate, audit, freeze invariants
- `GET /api/pdf/lonespec/me` (assistant) — IDOR-safe slip download
- `GET /api/assistant/slips` — slip listing
- Settings UI rebuilt with collapsible sections (Phase 7) — 4 new fields (Avtalsmodell, Utbetalningssätt, Timlön, Utbetalningsdag)
- Monthly "Lönespecifikation" stepper section
- AssistantDashboard "Lönespecifikationer" card (different from main's rewrite)
- `clock.ts` (268 lines) — milestone's OWN clock-in/out implementation (different from main's `entries.clockedInAt` approach)

**Planning artefacts (`.planning/`):**
- 4 phase directories with PLAN.md, SUMMARY.md, VERIFICATION.md per plan
- 18 requirements documented + traceability
- HANDOFF.md, STATE.md, ROADMAP.md (separate from main's top-level ROADMAP.md), REQUIREMENTS.md
- Phase 10 UAT evidence + diagnosis files (this document, deferred-items, 10-04 drop recommendation, etc.)

### Files only on milestone (not on main)

- `server/src/lib/employer-representation.ts` + tests
- `server/src/lib/payrollSlipUtils.ts`
- `server/src/lib/pdfSlipRenderer.ts`
- `server/src/routes/clock.ts` (main has a 1-line stub)
- The entire `.planning/` directory tree
- `client/src/pages/Home.tsx` (main has `Dashboard.tsx` instead — different implementations)
- `client/src/pages/Records.tsx` (main has `Reports.tsx` instead)

## Auto-merged (clean, no conflict on these)

These files differ on both branches but git can auto-merge them:
- `server/src/routes/entries.ts`
- `server/src/routes/gcal.ts`
- (Plus all of milestone's brand-new files which simply don't exist on main and arrive cleanly via merge.)

## Files with TEXT conflicts (5)

These need manual resolution — both branches edited the same regions:

1. **`README.md`** — main has marketing-curated version, milestone has older ops-heavy version
2. **`server/src/db/schema.ts`** — both added different columns to `profile` and `assistants`
3. **`server/src/routes/assistant.ts`** — main added US-23 features, milestone added Phase 9/10 endpoints
4. **`server/src/routes/assistants.ts`** — main added multi-family endpoints, milestone added Phase 7 whitelist extensions
5. **`server/src/routes/pdf.ts`** — main fixed earlier FK bugs (BUG-01..05, väntetid totals), milestone refactored to `decryptAndFill` + added lönespec endpoint + just-fixed `/fk3057` decryption

## What this means

- `gh pr merge 7 --merge` will not auto-resolve.
- Force-replacing main with milestone (`git push origin milestone/v1.0.1:main --force-with-lease`) **destroys the multi-family + clock-in/out + real OAuth + AssistantDetail features on main**. Whether that's acceptable depends on whether those features have already been re-implemented on milestone in some other shape, or whether they're work that's been quietly forgotten about.
- Force-replacing milestone with main destroys the entire v1.0.1 milestone work. Almost certainly not the right choice.
- A real reconciliation merge — keeping both branches' contributions to the conflicting files — is **2-4 hours of careful manual editing** plus integration testing (does main's `entries.clockedInAt` clock-in flow play with milestone's `clock.ts`-based flow? Are the two AssistantDashboard implementations both needed? Etc.).

## Open questions for the guardian

1. **Multi-family (US-24/25/26): ✓ DECIDED 2026-04-25 — REAL, must survive reconciliation.**
   Implication: keep `authAssistants` table, `profile.authId`, `assistants.guardianAuthId` + `familyLabel`, and main's multi-family endpoints. The merged schema must include both these AND milestone's Phase 7 columns.
2. **Clock in/out: ✓ DECIDED 2026-04-25 — `clock.ts` (milestone) wins.**
   Implication: keep milestone's `server/src/routes/clock.ts` (268 lines). DROP main's `entries.clockedInAt`, `clockedOutAt`, `actualHours`, `guardianAdjusted` columns. Whatever main's `assistant.ts` extensions did with those columns needs to be dropped or rewritten to call clock.ts.
3. **Real Google OAuth (US-13b/13c): ✓ DECIDED 2026-04-25 — milestone's `gcal.ts` already covers it.**
   Implication: drop main's `gcal.ts` parallel edits at merge.
4. **All UI: ✓ DECIDED 2026-04-25 — milestone's UI wins (whole track).**
   Implication: keep milestone's `AssistantDashboard.tsx` (584), `Home.tsx`, `Records.tsx`, `Settings.tsx`. Drop main's `AssistantDashboard.tsx` (494), `Dashboard.tsx`, `Reports.tsx`, and main-only `AssistantDetail.tsx`. Resolves the AssistantDashboard ↔ clock-columns ripple — milestone's AssistantDashboard already reads from milestone's `clock.ts`, so no rewrite needed. (Original Decision #4 said "main's wins" — REVERSED 2026-04-25 same-session after guardian noted milestone is more updated on UI.)
5. **`docs/user-stories.md` and `docs/fk-rules.md`: ✓ DECIDED 2026-04-25 — keep both.**
   Implication: docs/ stays at repo root, `.planning/` stays where it is. They serve different audiences (product/external vs engineering/internal).
6. **Two `ROADMAP.md` files: ✓ DECIDED 2026-04-25 — keep both.**
   Implication: top-level `ROADMAP.md` (public-facing) and `.planning/ROADMAP.md` (GSD-managed) coexist. Cross-reference each other where appropriate.

## Reconciliation plan (derived from decisions 1–6)

### Schema (`server/src/db/schema.ts`)
**Take BOTH branches' additions:**
- `profile` gets: main's `authId` + all milestone's columns (split address, FK decision dates, `dubbelAssistansApproved`, `patientRelationToGuardian`, `patientRequiresRepresentative`, `defaultPayDay`)
- `assistants` gets: main's `guardianAuthId` + `familyLabel` + all milestone's columns (split address, `taxScheme`, bank fields, employment dates, etc.)
- New tables: `authAssistants` (main) + `paymentSlips`, `absences`, `payrollRecords` (milestone)
- New enums: `linkStatusEnum` (main) + `absenceType`, `payrollStatus`, `paymentMethod`, `clockType`, `taxScheme`, `patientRelation`, `salaryModelSnapshot` (milestone). `reqStatusEnum` extended with `"cancelled"`.

**Drop from `entries` (per Decision #2):**
- `clockedInAt`, `clockedOutAt`, `actualHours`, `guardianAdjusted`

### Routes
- `clock.ts`: take milestone's 268-line implementation. Drop main's 1-line stub.
- `assistant.ts`: take milestone's Phase 9/10 endpoints. Drop main's US-23 missed-clock-fix code that touches the removed `entries.clockedInAt` columns. The clock-in/out workflow is fully covered by milestone's `clock.ts` + UI; main's parallel approach is superseded.
- `assistants.ts`: take BOTH — main's multi-family endpoints + milestone's Phase 7 whitelist extensions.
- `pdf.ts`: take milestone's `decryptAndFill` + lönespec + the just-fixed `/fk3057`. Cherry-pick main's earlier FK fixes (BUG-01..05, väntetid totals) only if they survive the `decryptAndFill` refactor — most likely already covered.
- `gcal.ts`: take milestone's. Drop main's edits (per Decision #3).
- `entries.ts`: auto-merged cleanly earlier; accept that result.

### Client (per Decision #4 reversal: milestone wins all UI)
- Keep: milestone's `AssistantDashboard.tsx` (584), `Home.tsx`, `Records.tsx`, `Settings.tsx`.
- Drop: main's `AssistantDashboard.tsx` (494), `Dashboard.tsx`, `Reports.tsx`, `AssistantDetail.tsx`.
- `App.tsx` routing: take milestone's (already wired for Home/Records/AssistantDashboard).
- Net effect: **no UI ripples remain**. Milestone's UI already reads clock data from milestone's `clock.ts`.

### Docs
- `README.md`: take main's curated version.
- Top-level `ROADMAP.md`, `docs/user-stories.md`, `docs/fk-rules.md`: keep all (main's).
- `.planning/` tree: keep all (milestone's).

## Effort estimate (post all 6 decisions)

- **Schema merge + drizzle migration:** 30 min
- **Route conflict resolution (assistant, assistants, pdf):** 60-90 min
- **Drop main UI files + reconcile App.tsx routing:** 15 min
- **Boot/build/typecheck verification:** 30 min
- **Smoke testing the merged build:** 30-60 min

**Total: 2.5–3.5 hours of careful work** (down from 3-5 hours after Decision #4 reversal eliminated the AssistantDashboard rewrite). Plus risk premium for unanticipated drizzle migration issues with the merged schema (existing dev data in Postgres needs to survive the new column set).

**Total: 3–5 hours of careful work**, plus risk premium for unanticipated drizzle migration issues with the merged schema (existing dev data in Postgres needs to survive the new column set).

## What I did NOT do today (to be picked up later)

- No merge commit was created.
- No force push.
- No code changes outside the v1.0.1 milestone work + the inline `/fk3057` decryption fix + the dialog scroll fix (all of which are inside the milestone branch only).
- PR #7 remains open with a "not mergeable" status on GitHub.

The session committed:
- `9f4a005` (last commit on milestone/v1.0.1) — `docs: route PR #7 review findings into v1.0.2 hardening backlog`

## Recommended next session

When the guardian resumes:

1. Read this file top to bottom.
2. Walk through the 6 open questions above and decide each one.
3. Pick a path:
   - **(a) Reconciliation merge:** spawn a focused session that does the manual merge of the 5 conflicting files, preserving both sides' features. Expect 2-4 hours + integration testing.
   - **(b) Force-replace main:** if all of main's parallel work is genuinely stale or superseded. (Verify by walking through main's 30 commits one at a time first.)
   - **(c) Cherry-pick reconciliation:** identify the 5-10 commits on main that have unique value, cherry-pick them onto a fresh branch off milestone HEAD, then PR that to main. Cleanest if main's parallel work is small and discrete.
4. Only after the path is chosen, attempt the merge again.

PR #7 can stay open meanwhile — it's not blocking anyone else.
