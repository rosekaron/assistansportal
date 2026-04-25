# Phase 8: Employer Representation Helper - Context

**Gathered:** 2026-04-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Extract a single `resolveEmployerRepresentation()` helper as the authoritative source for employer-name + representation fields across every document the platform produces: FK 3057, FK 3059, SKV 4805, and the upcoming v1.0.1 salary slip (Phase 9). Closes the latent bug where `profile.guardianName` was hardcoded as the employer field — correct for Kalinga's current use (minor patient) but silently wrong for any adult patient. Out of scope: any roles/multi-admin system, any Settings UX changes (the `patient_requires_representative` toggle and relation enum already ship from Phase 7).

</domain>

<decisions>
## Implementation Decisions

### Minor detection
- **D-01:** Parse the patient's age from `profile.patientPno` using the standard Swedish personnummer format (YYMMDD-XXXX or YYYYMMDD-XXXX). Compute age relative to the report period's **end date** (not current date, not start-of-period).
- **D-02:** If the patient turns 18 during a report month, that month is treated as **adult** (end-of-period age ≥ 18 → adult). Locks the 18th-birthday transition to a clean month boundary: the month that contains the birthday is the first month the patient is the direct employer on paper.

### Override flag semantics
- **D-03:** `profile.patient_requires_representative` (added in Phase 7) applies **only to adult patients**. For minor patients the representative is always shown regardless of the flag — parent-as-representative is legally required, not optional.
- **D-04:** For adult patients: flag `true` → helper returns guardian as representative (god-man / legal-representative / no-legal-capacity case). Flag `false/null` → representative fields are null, only the patient appears.
- **D-05:** The flag is a **stopgap** until a richer roles model ships (see Deferred Ideas). Helper contract is designed so a future roles system can replace this flag without renaming the returned shape.

### Helper contract (Claude's discretion on final TypeScript shape; semantics below are locked)
- **D-06:** Return shape carries structured data, not pre-formatted strings. Each renderer (FK/SKV/slip) decides how to display. At minimum:
  - `arbetsgivare`: `{ name, pno, address }` — always populated, always = patient identity
  - `företrädare`: `{ name, pno } | null` — populated when patient is minor OR (patient is adult AND override flag is true)
- **D-07:** Address handling on the employer record uses the split address columns added in Phase 7 (`profile.address_street`, `address_zip`, `address_city`) with fallback to the single-line `profile.address` for legacy records.

### Form-field mapping (locked per compliance scout)
- **D-08:** Only these government-fixed PDF fields change their source from guardian → patient:
  - **SKV 4805:** `__employer__txtNamn[0]`, `__employer__txtPersNr[0]`, `__employer__txtAdress[0]` (form4805-utils.ts:91–93) → patient identity
  - **FK 3057:** `form1[0].#subform[0].flt_txtNamnAnordnaren[0]` (pdf.ts:140) → patient name
- **D-09:** Signature and contact fields intentionally remain guardian-sourced: `Kontaktperson` (FK 3057:141), `Namnteckning` on both FK 3057 (pdf.ts:147, 303) and SKV 4805 (form4805-utils.ts:120), and `flt_txtNamnteckning2[0]` (pdf.ts:147). The guardian signs as the patient's representative; the guardian is not the employer.
- **D-10:** FK 3059 has no employer field — only `Namnteckning` (guardian signs). No changes needed to FK 3059's PDF mapping. Helper is still called to resolve the representative for any future slip-of-slip cross-reference.

### Swedish labels (Claude's discretion)
- **D-11:** On the v1.0.1 salary slip (Phase 9 implements the layout, but the header is specified in this helper's consumer contract), the representative line defaults to **"Företrädd av: [name] ([pno])"**. The research phase is free to surface a more precise Swedish convention (e.g., different wording for minor-parent vs. adult-god-man case) — if research finds one, planner can override this default. Default is neutral and works for both cases.
- **D-12:** FK/SKV PDF field labels are government-fixed — never edited. Only the VALUE changes.

### Test coverage
- **D-13:** Helper unit tests MUST cover the three cases called out in the phase Success Criteria: (a) minor-by-pno (no flag), (b) adult-with-override (flag=true), (c) adult-without-override (flag=false/null). Plus a fourth case: end-of-period boundary (patient turns 18 during report month).
- **D-14:** Beyond unit tests: a grep check that no source file under `server/src/` references `profile.guardianName` for any of the employer fields listed in D-08. Integration-level PDF regeneration tests are **not required** for this phase — they can be added later if needed. Rationale: the Phase 10 DATA-01 end-to-end verification will exercise the full path on real data.

### Claude's Discretion
- Exact TypeScript function signature + file location (likely `server/src/lib/employer-representation.ts`; reuse the existing `form4805-utils.ts:6-22` type pattern).
- How to share the helper between `form4805-utils.ts` and `pdf.ts` without circular imports.
- Plan decomposition — planner decides whether to ship helper + 3 renderer-refactors in one plan, or split across multiple plans.
- Exact Swedish label variants on the slip if research surfaces a better term than "Företrädd av".

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Compliance & Swedish labor law (for the representative concept)
- `docs/compliance/swedish-fk-and-labor-rules.md` — Swedish FK + labor law reference. Particularly relevant for the "minor patient → parent is legal representative" rule and for adult-with-god-man cases.

### Phase 7 foundation (consumed by this phase)
- `.planning/phases/07-foundation-schema-cleanup/07-CONTEXT.md` — Locks the Phase 7 decisions this helper builds on, especially D-02 (fk_decision_start/end semantics), D-03 (dubbel_assistans_approved), and D-09 (keep single-line `address` as fallback).
- `.planning/phases/07-foundation-schema-cleanup/07-01-SUMMARY.md` — Exact list of new `profile` columns available (`patient_requires_representative`, `patient_relation_to_guardian` enum, split address).
- `.planning/phases/07-foundation-schema-cleanup/07-02-SUMMARY.md` — Confirms the PUT whitelist already admits `patient_requires_representative` writes from Settings.

### v1.0 known-issue context
- `.planning/milestones/v1.0-MILESTONE-AUDIT.md` (§Accepted as v1.0 Known Issues) — Documents the latent `guardianName` bug this phase closes; "silently wrong for any adult brukare".

### Source files to refactor (pre-reading for planner)
- `server/src/lib/form4805-utils.ts:91,120` — SKV 4805 employer-name bug site.
- `server/src/routes/pdf.ts:140,141,147,303,373` — FK 3057 / FK 3059 employer-name and signature sites. Distinguish "Anordnaren" (fixes to patient) from "Kontaktperson" / "Namnteckning" (stay guardian).
- `server/src/db/schema.ts:45–52` — `profile` columns the helper reads (split address, patient_relation_to_guardian, patient_requires_representative).

### Downstream consumer (informs return shape)
- `.planning/ROADMAP.md` §Phase 9 — Salary slip success criterion #4 specifies the header format: `"Arbetsgivare: [patient name + pno]"` followed optionally by `"Företrädd av: [guardian name + pno]"`. The helper's return shape must make this trivial.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Type pattern at `server/src/lib/form4805-utils.ts:6-22` (the existing `FormFields` / input type structure) — new helper types should follow this shape so the refactor diff is minimal.
- Swedish personnummer is already stored and rendered across the app; parsing YYMMDD / YYYYMMDD is straightforward. No existing `parsePno()` utility found — creating one in this phase is fine (one-off, or live inside `employer-representation.ts`).
- `profile.patient_pno` has no validation today per Phase 7 D-18 (client-side HTML5 only). Helper must gracefully handle empty / malformed pno — returns `null representative + patient name empty` rather than throwing, so PDFs still render (the placeholder catches it during Phase 10 DATA-01).

### Established Patterns
- PDF renderers in `pdf.ts` and `form4805-utils.ts` take a `profile` object + a `payrollRecord` and produce a field map. Helper should be called INSIDE these functions (or the caller), not replace them. No new route surface.
- Existing tests under `server/src/lib/*.test.ts` use Vitest. Mirror that for `employer-representation.test.ts`.
- No existing helper file with this name; no circular-import risk if placed in `server/src/lib/`.

### Integration Points
- Called from `form4805-utils.ts` when building the SKV 4805 field map (replaces `profile.guardianName` on line 91).
- Called from `pdf.ts` when building FK 3057 field map (replaces `profile.guardianName` on line 140).
- Called from Phase 9's slip renderer (not yet written) to produce the header block.
- Not called from FK 3059 today (no employer field), but the helper is available if future compliance rules add one.

</code_context>

<specifics>
## Specific Ideas

- Helper return shape should be friendly to render destinations where "representative" is conditionally rendered as a separate line — i.e., `representative: null` → skip the line cleanly, no empty-string artifact in PDFs.
- Minor-status should be a pure function of `(patient_pno, report_period_end_date)` — no DB state. Makes testing trivial and avoids "stale `is_minor` column drifts from actual age" bugs.

</specifics>

<deferred>
## Deferred Ideas

### Roles system (captured 2026-04-18 during Phase 8 discuss)

The `patient_requires_representative` flag + `patient_relation_to_guardian` enum are **stopgaps** for the general concept of "who is authorized to act on behalf of the patient-employer". Rose explicitly wants a richer model in a future phase (not v1.0.1):

- Multi-admin: both parents should be able to administer (Rose + Mikael are both listed as assistants AND Rose acts as the guardian-admin — the current model collapses these).
- Admin role transfer: when the patient turns 18, the adult child may take over as admin — needs a flow, not just a flag flip.
- God-man as admin role: if an adult is appointed a god man (Swedish legal guardianship for adults lacking capacity), that person becomes the admin — richer than a boolean flag.
- Possibly generalizes to: care team roles (primary guardian, secondary guardian/parent, legal god man, estate administrator after patient's death, etc.).

Implication for Phase 8: the helper's return shape (`{ arbetsgivare, företrädare }`) is designed so that a future roles system can change the SOURCE of `företrädare` without changing the contract. No UI work, no schema work for this in Phase 8 or v1.0.1.

Target milestone: likely v1.2 or a dedicated roles milestone. Not v1.0.1.

### Integration-level PDF regeneration tests
Unit tests cover the helper per SC#4. Integration tests that regenerate a PDF and assert the `arbetsgivare` field contents would catch regressions in the renderer wiring. Deferred because Phase 10 DATA-01 will do this manually on real data, and adding golden PDF fixtures is its own infrastructure investment.

</deferred>

---

*Phase: 08-employer-representation-helper*
*Context gathered: 2026-04-18*
