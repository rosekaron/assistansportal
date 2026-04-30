# Phase 10: Real Data Entry & End-to-End Verification - Context

**Gathered:** 2026-04-20
**Status:** Ready for planning

<domain>
## Phase Boundary

Populate real data into Profile + both assistants via the v1.0.1 Settings surfaces, then verify three generated PDFs (FK 3057, SKV 4805, Salary Slip) contain zero placeholder strings for at least one assistant. No new code is expected — this phase proves the v1.0.1 pipeline (Phases 7 + 8 + 9) works on live data.

**In scope:**
- Data writes to `profile` (address split, FK decision period, any remaining placeholders) and `assistants` (addresses + bank details for Rose + Mikael)
- PDF walkthrough for Rose for reporting month `2026-03`
- Placeholder detection and UAT sign-off via the standard GSD `/gsd-verify-work` flow

**Out of scope:**
- Any new schema columns or endpoints (Phases 7–9 shipped those)
- Mikael's PDF walkthrough (ROADMAP criterion 3 allows sampling — see D-05)
- Fresh-month issuance testing (a second approved payroll is not a prerequisite)
- UI changes, bug fixes, or placeholder-removal code edits (if placeholders surface from code defects rather than data, that's a gap → new phase/plan)

</domain>

<decisions>
## Implementation Decisions

### Data-entry method
- **D-01:** **Claude drives via API.** Updates go through `PUT /api/profile` and `PUT /api/assistants/:id` with real values supplied by the guardian inline. No direct SQL. This exercises the existing Phase 7 whitelists and catches any lurking validation bugs.
- **D-02:** **Legacy `profile.address` stays populated AND the new split fields (`address_street` / `address_zip` / `address_city`) are filled to reflect the same real current address.** Both representations reflect current reality — no null-out, no migration.
- **D-03:** **Order: Profile → Assistants → Verify.** Matches dependency order: profile drives employer / representative lines on FK 3057 + SKV 4805; assistants drive the per-assistant address/bank block.

### Walkthrough scope
- **D-04:** **Rose-only quick-pass PDF walkthrough for 2026-03.** Verify FK 3057 (one, month-parameterised) + Rose's SKV 4805 + Rose's salary slip. Three PDFs total. This is a sampling choice — data-entry covers BOTH assistants (ROADMAP criterion 2), but the PDF eyeball step only iterates Rose. If Rose's PDFs are clean and Mikael's data was entered through the same whitelists, the Mikael PDFs are treated as passing transitively.
- **D-05:** **Month: `2026-03`.** Already has approved payroll + one issued salary slip (`LS-2026-03-001`). Re-downloading the slip after data updates tests D-06 rebuild-on-download (Phase 9) — i.e., new address/bank fields should surface in the rebuilt PDF while `pay_date` stays frozen per D-09. No fresh payroll approval required.
- **D-06:** **Placeholder detection: automated `pdftotext` grep + visual, run inside a standard `/gsd-verify-work` UAT.** Each test in `10-UAT.md` downloads a PDF, runs grep for the placeholder pattern set (see D-07), prints matching lines + a full text snippet, and the guardian confirms pass/issue. Structured exactly like Phase 9's `09-UAT.md`.
- **D-07:** **Placeholder pattern set for grep:** `TBD`, `000000-0000`, `TBD-FK-DECISION`, any all-same-digit pno (e.g., `231231231231`), empty address rows rendering as `", ,"` or double-comma artefacts, literal word `placeholder`, and the current known placeholder string `23123123123123` (current `profile.fk_decision_no` value). Case-insensitive grep.

### Claude's Discretion
- **Bank details in git.** Real bank clearing/account/IBAN for Rose + Mikael lives in Postgres only. Any committed planning doc (`10-PLAN.md`, `10-UAT.md`, summaries) references the fields by name and by format-validity, never the actual digits. The `PUT` bodies sent during `/gsd-execute-phase` will include real values passed in at runtime by the guardian — Claude does not save them to the repo.
- **FK 3059 inclusion.** Not required by ROADMAP criterion 3, but the same `resolveEmployerRepresentation()` helper drives its header. If the guardian requests a 4th PDF check during UAT, Claude adds a test inline; otherwise omit.
- **Recovery workflow if grep hits.** If placeholder patterns surface, Claude first checks whether the hit is a data gap (fix with another PUT) or a code defect (file as UAT issue → diagnosis → fix plan — same auto-diagnose flow as `/gsd-verify-work` in Phase 9).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 10 scope anchor
- `.planning/ROADMAP.md` §"Phase 10: Real Data Entry & End-to-End Verification" — Goal, DATA-01/02/03, three success criteria
- `.planning/REQUIREMENTS.md` lines 42–44 — DATA-01/02/03 acceptance text

### Prior-phase decisions that carry forward
- `.planning/phases/07-foundation-schema-cleanup/07-CONTEXT.md` — Settings 2-section UI, split-address columns, 1–28 pay-day clamp
- `.planning/phases/08-employer-representation-helper/08-CONTEXT.md` — `resolveEmployerRepresentation(profile, asOfDate)` contract; FK 3057 / FK 3059 / SKV 4805 / slip consumers
- `.planning/phases/09-salary-slip/09-CONTEXT.md` — D-05 audit-metadata-only, D-06 rebuild-on-download, D-09 pay-date freeze at issuance

### Endpoint surfaces used for data entry
- `server/src/routes/profile.ts` — `PUT /` whitelist (guardian fields + `defaultPayDay` + split-address + FK decision fields)
- `server/src/routes/assistants.ts` — `PUT /:id` whitelist (address split + bank clearing/account/iban + salary fields)

### PDF download surfaces used for verification
- `server/src/routes/pdf.ts` — `POST /api/pdf/fk3057`, `POST /api/pdf/fk3057/4805`, `POST /api/pdf/lonespec`
- `server/src/routes/assistant.ts` — `GET /api/assistant/slips` (assistant listing, used if guardian chooses assistant-side view)

### UAT/verification pattern reference
- `.planning/phases/09-salary-slip/09-UAT.md` — The canonical GSD UAT shape this phase's `10-UAT.md` should mirror (frontmatter + Current Test + Tests with evidence + Summary + Gaps)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `PUT /api/profile` (profile.ts): accepts the extended Phase 7 whitelist including `patientRequiresRepresentative`, `patientRelationToGuardian`, `addressStreet/Zip/City`, `fkDecisionNo/Start/End`, `weeklyHours`, `defaultPayDay`.
- `PUT /api/assistants/:id` (assistants.ts): accepts extended whitelist — names, pno, phone, `addressStreet/Zip/City`, `taxScheme`, `bankClearing/Account`, `iban`, `salaryModel`, `hourlyRateOverride`, `paymentMethod`, etc.
- `POST /api/pdf/fk3057`, `/fk3057/4805`, `/lonespec` — all three PDFs return `application/pdf` with `%PDF-` bytes, driven by current profile + assistant rows (D-06 rebuild-on-download).
- `gsd-verify-work` + `render-checkpoint` templates already tuned from Phase 9.

### Established Patterns
- Settings writes through existing PUT endpoints — no new endpoints in v1.0.1 (Phase 7 D-19 pattern).
- `resolveEmployerRepresentation()` makes employer-name vs representative logic consistent across all three PDFs — same data gap will show up identically.
- Postgres is the single source of truth; no client-side caching that could show stale placeholders.

### Integration Points
- JWT-signed API calls (as used in Phase 9 `09-UAT.md` automation) can drive both data writes and PDF fetches without an interactive login — re-use the same JWT signing approach via `.env` `JWT_SECRET`.
- Existing `payment_slips` row (`slipd706cf57 / LS-2026-03-001`) lets D-06 rebuild-on-download behaviour be observed without re-issuing (new assistant fields should appear in rebuilt PDF; `pay_date` must NOT change).

### Known current data gaps (from 2026-04-20 DB scan)
- `profile.fk_decision_no = "23123123123123"` — placeholder-ish
- `profile.fk_decision_start` and `fk_decision_end` — both NULL
- `profile.address_street/zip/city` — all empty (legacy `profile.address` is populated)
- `assistants.address_street/zip/city` — all empty for both Rose + Mikael
- `assistants.bank_clearing/bank_account/iban` — all empty for both Rose + Mikael

</code_context>

<specifics>
## Specific Ideas

- Verification must run under the GSD framework — the guardian explicitly wants `/gsd-verify-work` used for this phase, mirroring Phase 9's `09-UAT.md`.
- Real bank details are Rose's own. They're acceptable in Postgres but must not land in git via planning docs or commit messages.

</specifics>

<deferred>
## Deferred Ideas

- **Mikael's full PDF walkthrough.** Data-entry covers him; PDF eyeball step does not. If a future phase needs airtight per-assistant verification, add a plan that iterates all assistants.
- **Fresh-month issuance smoke test.** Issuing a salary slip for a month that has no `payment_slips` row tests the full issue-or-reuse + unique-index path. Phase 9's 21-test integration suite already covers this in mocked form; Phase 10 does not run it on live data. Backlog candidate.
- **FK 3059 (omprövning) placeholder check.** Uses the same `resolveEmployerRepresentation()` helper — if it hits placeholders, the other three PDFs would too, so a redundant check. Add if scope creeps during UAT.
- **Synthetic test-data fixture for CI.** Data entered by hand during this phase is one-off. A future milestone could codify a seed script for repeatable E2E runs. Out of scope for v1.0.1.

</deferred>

---

*Phase: 10-real-data-entry*
*Context gathered: 2026-04-20*
