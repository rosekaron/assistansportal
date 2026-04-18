# Phase 7 — Discussion Log

**Date:** 2026-04-18
**Participants:** Rose (guardian), Claude (Sonnet)

Adaptive discussion cycle before planning Phase 7. Records the Q&A trail that produced `07-CONTEXT.md`.

---

## Initial scouting (before user interaction)

Claude ran `init phase-op 7`, `roadmap get-phase 7`, read `CONVENTIONS.md` + `schema.ts` + `drizzle.config.ts` + `db/index.ts` + `Settings.tsx` refs. Identified 5 gray areas, confirmed no blocking anti-patterns, no matching todos.

**Grep-verified zero duplicates** for 9 of the 10 new field categories:
- skattetabell, tax_scheme — 0 refs
- bank_*, iban — 0 refs
- employment_start/end_date — 0 refs
- dubbel_assistans_approved — 0 refs
- patient_relation, patient_requires_representative — 0 refs
- residence_permit_expiry, citizenship — 0 refs

**One existing field with extension relationship (not collision):** `profile.fkDecisionNo` stays; new `fk_decision_start/end/hours_per_day` would be added alongside.

**One conceptual duplication concern flagged:** `profile.weeklyHours` vs proposed `fk_decision_hours_per_day` — resolved below via research.

---

## Round 1 — Gray area selection

**Q (Claude):** Which gray areas to discuss? 4 offered: migration approach, address field strategy, Settings UI organization, dead-code cleanup atomicity.

**A (Rose):** All 4 + a 5th: "dependencies and how each change impacts the current feature sets. make sure that there are no duplicated apis or functionalities".

**Resolution:** Dependency/duplication concern addressed by grep-verified findings above + route-whitelist analysis (both `profile.ts:21` and `assistants.ts:49` use explicit whitelists — zero accidental exposure risk). Documented in CONTEXT.md "Dependencies & Impact on Current Features" section.

---

## Round 2 — FK hours research (triggered by user)

**Q (Claude):** Presented the 4 gray areas as questions.

**A (Rose):** Clarification requested on each — "i dont understand this part". Specifically asked about fk_decision_hours_per_day — what is it?

**Claude's explanation:** Distinguished `profile.weeklyHours` (existing, weekly scheduling budget) from proposed `fk_decision_hours_per_day` (new, for v1.3 rule engine coverage checks). Asked Rose to check her actual FK beslut wording.

**A (Rose):** "read up on how the hours can be used. this research has been conducted multiple times so you should capture it and document it so we can come back to it if it ever surfaces again. document these rules as a md file and commit to github for humans and llms to read. add references to the md file. refer to the file in the code. Check how the weekly hours work and how it can be used and also check the labor law in sweden, union lawes and how this impacts the schedule"

**Action taken:** 4 parallel research agents launched:
1. FK assistansersättning hour grant mechanics (51 kap SFB, Vägledning 2003:6)
2. ATL (1982:673) — §5/§6/§7/§10/§12/§13/§14/§15/§17 + §2 carve-outs
3. Kollektivavtal context (Fremia–Kommunal, Bransch G, 2026 rates)
4. Anhörigassistans rules (legal definition, caps, minor brukare, case law)

**Research output:** 4 detailed briefs with ~30 primary-source citations.

**Stitched into:** [`docs/compliance/swedish-fk-and-labor-rules.md`](../../../docs/compliance/swedish-fk-and-labor-rules.md) (451 lines, committed at `765aedc`).

**Code anchor added:** `server/src/db/schema.ts:20-22` comment pointing to the compliance doc.

---

## Round 3 — User follow-up on hour usage rules

**Q (Rose):** "is there a rule about how the weekly hours should be spent? or does that just impact payment?"

**A (Claude):** Direct answer:
- **Weekly hours = payment ceiling**, not a schedule rule. FK does not regulate daily distribution (51 kap 9§ SFB + Vägledning 2003:6). 30h Monday / 0h Sunday is legal.
- **FK does investigate genuine need.** Hours must be actually worked on real assistance; FK can issue återkrav if usage pattern doesn't reflect assistance delivery.
- **Actual scheduling constraint = labor law applied to the assistant**, not FK rules:
  - Anhörig in hushållsgemenskap → Lag 1970:943 (48h/week avg over 4 weeks)
  - Others → ATL (40h/week, 11h dygnsvila, 36h veckovila)

Documented in compliance doc §1, §2.2, §2.3, §7.

---

## Round 4 — Research-informed recommendations

**Claude's revised recommendations** (4 decisions with research backing):

1. **Drop `fk_decision_hours_per_day`** from Phase 7 scope. FK beslut don't state a per-day figure. Rationale in compliance doc §7.3.
2. **Stay on `db:push`** for migrations. Consistent with project.
3. **Add 3 new address columns, keep old `address` nullable**. Zero data loss. Same approach for both profile and assistants.
4. **Collapsible Settings sections** + **atomic single-commit cleanup**.

**A (Rose):** "accept all 4 but show me where you documented them both in code and as a md file that you commit to github right away for a future LLM can read it"

**Action:**
- `.planning/phases/07-foundation-schema-cleanup/07-CONTEXT.md` created — 19 decisions (D-01 through D-19) with explicit rationale + cross-refs to compliance doc
- `.planning/phases/07-foundation-schema-cleanup/07-DISCUSSION-LOG.md` created — this file
- `server/src/db/schema.ts` already has comment pointing to compliance doc (from earlier round)
- All commits on `milestone/v1.0.1` branch (created during this round after Rose caught we were still on `milestone/v1.0-mvp`)

---

## Round 6 — Settings UI section count revision (during plan-phase, 2026-04-18)

**Trigger:** User entered `/gsd-plan-phase 7`, hit UI-SPEC gate, said "i dont understand anything. the swedish names dont make sense."

**Context:** D-10 originally specified 5 collapsible sections (Personligt / Skatt & bank / Adress / Anställning / FK-beslut). User asked Claude to assess whether the grouping made sense.

**Q (Claude):** How often is Skatt & bank actually edited?
**A (analysis):** Almost never after hire. skattetabell ~ rare; tax_scheme ~ never; bank fields ~ years apart. Most assistant fields are set-once-at-hire.

**Insight:** When most fields are set-and-forget, *fewer* cards = faster scan when looking for the one thing to change. 5 collapsible sections is over-engineered for ~17 fields.

**Decision:** Collapse to **2 sections per dialog**:
- Assistants: Personuppgifter (7) + Anställning & ekonomi (10)
- Profile: Personuppgifter + FK-beslut (different field set — patient is not an employee)

**Updated decisions:** D-10, D-11. D-12 (Swedish labels) unchanged.

---

## Round 5 — Branch sanity check

**Q (Rose):** "why am i seeing milestone/v1.0-mvp here? arent we working on version 1.0.1?"

**Finding:** All 5 recent v1.0.1 planning commits (`cb24512`..`765aedc`) had landed on the `milestone/v1.0-mvp` branch. The v1.0 ship state is preserved by git tag `v1.0` at commit `f6bae5c`, so nothing was lost — but going forward needed its own branch.

**Action:** `git checkout -b milestone/v1.0.1` from current HEAD. All v1.0.1 commits now live on that branch. `milestone/v1.0-mvp` still exists and points at the same commits; can be reset to tag `v1.0` later if desired (non-urgent).

---

## Key outcomes

- **1 compliance reference file created** ([`docs/compliance/swedish-fk-and-labor-rules.md`](../../../docs/compliance/swedish-fk-and-labor-rules.md)) — 451 lines, 30+ primary-source citations, will persist across the entire project lifetime.
- **19 Phase 7 decisions locked** in [`07-CONTEXT.md`](./07-CONTEXT.md).
- **Scope reduced** — dropped `fk_decision_hours_per_day` column (was in ROADMAP, research showed it's not a real FK field).
- **Branch corrected** — work now on `milestone/v1.0.1`.
- **No research agent needed for planning** — context is comprehensive; skip `/gsd-research-phase 7` and go straight to `/gsd-plan-phase 7`.

---

## Files and commits touched during discuss cycle

| File | Purpose |
|---|---|
| `docs/compliance/swedish-fk-and-labor-rules.md` | New: living compliance reference |
| `server/src/db/schema.ts` | Modified: comment pointing to compliance doc |
| `.planning/phases/07-foundation-schema-cleanup/07-CONTEXT.md` | New: phase decisions |
| `.planning/phases/07-foundation-schema-cleanup/07-DISCUSSION-LOG.md` | New: this file |
| `.planning/STATE.md` | Modified: set phase 7 in-progress |

| Commit | Content |
|---|---|
| `cb24512` | Milestone v1.0.1 kickoff (PROJECT + STATE) |
| `acffab3` | Clear v1.0 phase directories |
| `5e89323` | v1.0.1 requirements defined |
| `13c6fc0` | v1.0.1 roadmap created (Phases 7–10) |
| `765aedc` | **Compliance reference doc + schema.ts pointer** |
| (next) | Phase 7 discuss artifacts — CONTEXT + DISCUSSION-LOG + STATE |
