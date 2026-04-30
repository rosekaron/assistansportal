# Phase 7: Foundation — Schema & Cleanup — Context

**Gathered:** 2026-04-18
**Status:** Ready for planning
**Milestone:** v1.0.1 — Salary Slip + Foundation Cleanup

## Phase Boundary

All new `assistants` and `profile` columns exist and are editable in Settings; dead scheduling scaffolding (Settings "Scheduling" card, `openSlots` table, self-book endpoints + client helpers) is removed so the codebase is a clean foundation for salary-slip work (Phase 9) and downstream v1.2 / v1.3 milestones.

**Requirements in scope:** SCHEMA-01, SCHEMA-02, SCHEMA-03, CLEAN-01, CLEAN-02, CLEAN-03

**Out of scope for this phase:**
- Any PDF generation or form rendering (Phase 8/9)
- Any `resolveEmployerRepresentation()` helper logic (Phase 8)
- Any lönespec endpoint or UI (Phase 9)
- Real data entry by guardian — field is present but filling it is Phase 10
- Live Fremia / Custom salary-model logic (v1.4 / v1.5)

---

## Implementation Decisions

### FK decision hour fields (revised from original ROADMAP scope)

- **D-01:** **Do NOT add `fk_decision_hours_per_day`.** Research confirmed FK beslut are stated per week (51 kap 9§ SFB), and there is no standard per-day figure on a beslut. v1.3's ATL rule engine can derive a soft daily cap from `weeklyHours / 7` if ever needed. Rationale documented in [`docs/compliance/swedish-fk-and-labor-rules.md`](../../../docs/compliance/swedish-fk-and-labor-rules.md) §2.2 and §7.3.
- **D-02:** **Keep `fk_decision_start` and `fk_decision_end`.** Beslut dates are real and needed for downstream period-expiry checks.
- **D-03:** **Keep `dubbel_assistans_approved`.** Real beslut field; v1.3 rule engine dependency.
- **D-04:** **Existing `profile.weeklyHours` remains the single source of truth for FK hour entitlement.** No redundant column.

### Migration strategy

- **D-05:** **Use `drizzle-kit push` (`npm run db:push`)** for all v1.0.1 schema changes. Consistent with every prior schema change in the project (Phases 1–6.1). No migration files. Empty `drizzle/` directory confirms this convention.
- **D-06:** **No manual migration script needed** for CLEAN-02's `openSlots` drop — `db:push` handles destructive DROP TABLE automatically when the table disappears from `schema.ts`.

### Address field strategy

- **D-07:** **Add 3 new columns + keep existing `address` nullable** on both `assistants` and `profile`. New columns: `address_street`, `address_zip`, `address_city` (text, nullable, default `""`). Read-path prefers new columns when populated; falls back to `address` for backward-compat during the transition.
- **D-08:** **No auto-migration of existing single-line addresses into 3 parts.** Guardian re-enters on first Settings visit (only a handful of assistants to update). Avoids brittle regex parsing.
- **D-09:** **Profile keeps single household address** (not split into household/patient/guardian triplets). The Kalinga household shares one address; the ROADMAP's optional triplet approach is deferred until a household where patient lives separately actually shows up.

### Settings UI organization

- **D-10:** **Collapsible sections pattern** for both Settings → Profile and Settings → Assistants edit dialog. **Two sections** per dialog (revised 2026-04-18 — see DISCUSSION-LOG.md for rationale: most fields are set-once-at-hire, so fewer cards = faster scan when looking for the one thing to change).

  **Assistants edit dialog** (17 fields, 2 sections):
  - **Personuppgifter** (7) — name, pno, phone, email, address_street, address_zip, address_city
  - **Anställning & ekonomi** (10) — employment_start_date, employment_end_date, citizenship, residence_permit_expiry, notes, skattetabell, tax_scheme, bank_clearing, bank_account, iban

  **Profile edit** (different fields — patient is not an employee, so no skatt/bank/anställning):
  - **Personuppgifter** — name, pno, phone, email, address (existing single-line, per D-09)
  - **FK-beslut** — fk_decision_no [existing], fk_decision_start, fk_decision_end, dubbel_assistans_approved, patient_relation_to_guardian, patient_requires_representative
- **D-11:** **Collapsed by default.** Guardian expands to edit; avoids cognitive overload of 17 fields visible at once.
- **D-12:** **Swedish labels throughout.** Continuation of existing Settings.tsx convention (sv-SE locale).

### Dead-code cleanup

- **D-13:** **One atomic commit** removes all scheduling scaffolding end-to-end: client UI (Settings.tsx `sched` state + Scheduling card + `saveSched` mutation), client API (`slotsApi`, `assistantApi.selfBook`, `assistantApi.openSlots`), server routes (`/api/slots` GET/POST/DELETE, `/api/assistant/self-book/:slotId`, `/api/assistant/open-slots`), schema (`openSlots` table + `seedDefaults` dead keys). Single diff; clean revert if needed.
- **D-14:** **Keep `sourceEnum "self_book"` value** — still referenced by `clock.ts:182` as a clock-origin marker. Deleting the enum value would be a gratuitous breaking change.

### Schema enum decisions

- **D-15:** **`tax_scheme`** = `pgEnum("tax_scheme", ["a-skatt", "f-skatt"])`. Swedish canonical values; English-lowercase for enum safety.
- **D-16:** **`patient_relation_to_guardian`** = `pgEnum("patient_relation", ["parent-child", "spouse", "adult-child", "legal-guardian", "god_man", "other"])`. English kebab/snake values as specified in ROADMAP. Swedish labels provided via UI translation map.
- **D-17:** **Column types:** `skattetabell` integer (null OK — many assistants won't have one set); `bank_clearing`, `bank_account`, `iban` text with `""` default; dates use `date` (not `timestamp`) for employment / FK decision / residence permit; booleans default `false`; `notes` text default `""`.

### Validation strictness

- **D-18:** **Client-side validation only** for new fields in Phase 7. Input patterns (HTML5) for pno format (YYYYMMDD-XXXX), IBAN rough pattern, date inputs. Required vs optional only enforced server-side. Strict validation (IBAN checksum, pno control-digit, skattetabell range 29–40) deferred until a field's data actually reaches a filing — the filing flow will reject bad data anyway.
- **D-19:** **Server-side** new route additions: extend existing `profile.ts` PATCH whitelist (line 21) and `assistants.ts` PUT whitelist (line 49) with the new fields. No new endpoints.

### Claude's discretion

- Exact Swedish wording of new field labels (will match terminology in existing Settings.tsx)
- Tailwind spacing / card shadow values — follow Phase 2.5 design system
- Form input components — use existing `SettingsField` / `Input` primitives
- Test coverage breakdown (whether to add regression tests for address-split read-path)
- Whether to wrap collapsible-section expansion in URL state (`?section=skatt`) — discretionary enhancement

---

## Specific Ideas

### Compliance anchoring
The weeklyHours vs fk_decision_hours_per_day decision surfaced for the third time in a discuss cycle. To stop losing this context, a durable reference was created at [`docs/compliance/swedish-fk-and-labor-rules.md`](../../../docs/compliance/swedish-fk-and-labor-rules.md). **Future LLMs and humans: read that doc before touching any scheduling/payroll/FK logic.** `schema.ts:20-22` has a pointer comment that leads there.

### Patient-vs-guardian address (deferred)
ROADMAP raised the option of splitting `profile` address into household / patient / guardian triplets for cases where the patient doesn't live with the guardian. Kalinga's current household shares one address — deferred until a household where they differ actually appears. Single `profile.address_street/zip/city` is what ships in Phase 7.

---

## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Compliance / legal foundation
- [`docs/compliance/swedish-fk-and-labor-rules.md`](../../../docs/compliance/swedish-fk-and-labor-rules.md) — complete FK + ATL + Lag 1970:943 + kollektivavtal + anhörig rule set with 30+ primary-source citations. **Read before making any decision that encodes assistance-hour limits, shift constraints, sjuklön, semesterlön, or employer-representation rules.**
- [`docs/compliance/swedish-fk-and-labor-rules.md`](../../../docs/compliance/swedish-fk-and-labor-rules.md) §7 — practical implications table for Kalinga's current user base

### Roadmap and requirements
- [`.planning/ROADMAP.md`](../../ROADMAP.md) §"v1.0.1 Design Reference" — original detailed scope from 2026-04-18 planning session
- [`.planning/ROADMAP.md`](../../ROADMAP.md) — Phase 7 goal, depends-on, success criteria
- [`.planning/REQUIREMENTS.md`](../../REQUIREMENTS.md) — SCHEMA-01/02/03 + CLEAN-01/02/03 definitions
- [`.planning/PROJECT.md`](../../PROJECT.md) — core value + stack constraints

### Codebase conventions (still authoritative from v1.0)
- [`.planning/codebase/CONVENTIONS.md`](../../codebase/CONVENTIONS.md) — naming, types, formatting, imports
- [`.planning/codebase/STRUCTURE.md`](../../codebase/STRUCTURE.md) — monorepo layout
- [`.planning/codebase/STACK.md`](../../codebase/STACK.md) — TypeScript/Express/Drizzle/PostgreSQL baseline

### Prior art (v1.0 patterns to mirror)
- `server/src/db/schema.ts` — existing pgEnum + pgTable patterns, section separator comments
- `server/src/db/index.ts` — `seedDefaults()` pattern for settings
- `server/src/routes/profile.ts:21` — existing profile PATCH whitelist pattern
- `server/src/routes/assistants.ts:49` — existing assistants PUT whitelist pattern
- `client/src/pages/Settings.tsx` — existing SectionLabel + SettingsField composition

---

## Existing Code Insights

### Reusable assets
- `SectionLabel` component in Settings.tsx — use for collapsible section headers (add expand/collapse chevron)
- `SettingsField` primitive in Settings.tsx — reuse for all new text/number fields
- `Input`, `Select` from `@/components/ui/inputs` — standard form primitives
- `newId()` from `server/src/lib/id` — for any new ID fields (though Phase 7 adds no new entity tables)

### Zero-duplicate verification (scout pass 2026-04-18)

Grep over `server/src` + `client/src` confirmed the following fields do NOT exist anywhere yet:
- `skattetabell`, `tax_scheme`
- `bank_clearing`, `bank_account`, `iban`
- `employment_start_date`, `employment_end_date`
- `dubbel_assistans_approved`
- `patient_relation_to_guardian`
- `patient_requires_representative`
- `residence_permit_expiry`, `citizenship`

**Existing field that EXTENDS, not collides:** `profile.fkDecisionNo` stays; new columns `fk_decision_start`, `fk_decision_end` are added alongside.

**Existing field that was nearly duplicated but isn't (see D-01):** `fk_decision_hours_per_day` dropped from scope; `profile.weeklyHours` remains sole hour-entitlement column.

### Files expected to change
- `server/src/db/schema.ts` — add columns, new enums, drop `openSlots`
- `server/src/db/index.ts` — remove 3 dead `seedDefaults` entries
- `server/src/routes/profile.ts` — extend PATCH whitelist
- `server/src/routes/assistants.ts` — extend PUT whitelist
- `server/src/routes/misc.ts` — delete `/slots` routes
- `server/src/routes/assistant.ts` — delete `/self-book/*` + `/open-slots` routes
- `client/src/pages/Settings.tsx` — delete Scheduling card + `sched` state + `saveSched`; add collapsible sections with new fields
- `client/src/lib/api.ts` — delete `slotsApi`, `assistantApi.selfBook`, `assistantApi.openSlots`
- `client/src/pages/SetupWizard.tsx` — add new field prompts (minimal — just the must-have ones for first-time setup)

---

## Dependencies & Impact on Current Features

(User explicitly asked to verify no duplicated APIs or functionality.)

### What this phase touches that's live in production

| Live feature | Phase 7 impact | Risk |
|---|---|---|
| Settings → Profile form | ADD new fields (collapsible sections) | Low — additive |
| Settings → Assistants edit dialog | ADD new fields | Low — additive |
| Settings → Scheduling card | DELETE (dead code — no server route gates on it) | None — verified unreachable |
| Profile PATCH `/api/profile` | EXTEND body whitelist | Low — new fields ignored if client doesn't send |
| Assistants PUT `/api/assistants/:id` | EXTEND body whitelist | Low — same |
| `openSlots` table | DROP | None — unreachable from current IA |
| `/api/slots` routes | DELETE | None — no client call sites |
| `/api/assistant/self-book/*` routes | DELETE | None — no client call sites |
| `seedDefaults()` dead keys | REMOVE | None — unused keys |
| FK 3057 / SKV 4805 renderers | NO CHANGE (Phase 8 territory) | N/A |
| Payroll calculation | NO CHANGE | N/A |
| Clock-in/out | NO CHANGE — keeps `sourceEnum "self_book"` value per D-14 | None |
| `sourceEnum` values | UNCHANGED — "self_book" stays (used by clock.ts) | None |

### Verified no duplicate APIs

- No existing helpers overlap with new field purposes (grep-verified for all 18 new field names)
- Profile / assistants routes use explicit whitelists → no accidental column exposure
- No planned route additions; all changes are whitelist extensions

### Downstream unblocks

- Phase 8 uses `profile.patient_requires_representative` for helper logic
- Phase 9 uses `assistants.salary_model`, `assistants.hourly_rate_override`, `payrollRecords.salary_model_used`, `payrollRecords.hourly_rate_used`, and the new `payment_slips` table
- Phase 10 needs all new fields editable for the real-data-entry walkthrough
- Future v1.2 / v1.3 rely on `fk_decision_start/end`, `dubbel_assistans_approved`, and the split address columns

---

## Next Step

Run `/gsd-research-phase 7` for deep research (optional — scope is well-defined) or go straight to `/gsd-plan-phase 7` for task breakdown.

**Recommendation:** Skip research — this is infrastructure work with no novel domain unknowns. Context is complete.
