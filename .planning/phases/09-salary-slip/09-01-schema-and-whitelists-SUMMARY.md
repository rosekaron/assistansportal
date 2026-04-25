---
phase: 09-salary-slip
plan: 01
subsystem: database
tags: [drizzle, postgres, schema, payment-slips, salary-model, whitelist]

requires:
  - phase: 07-foundation-schema-cleanup
    provides: "salaryModelSnapshotEnum, paymentMethodEnum, payroll_records snapshot columns, Settings 2-section UI pattern"
  - phase: 08-employer-representation
    provides: "resolveEmployerRepresentation() helper — consumed downstream in slip header (Plan 09-02), not this plan"

provides:
  - "payment_slips pgTable + 2 indexes (unique (assistantId, reportMonth, sequence) + idx (assistantId, reportMonth))"
  - "3 new assistants columns: salary_model (enum, default 'anhörig'), hourly_rate_override (real, nullable — D-12 gate), payment_method (enum, default 'bankgiro')"
  - "1 new profile column: default_pay_day (integer, default 25)"
  - "PUT /api/assistants/:id whitelist extended for salaryModel / hourlyRateOverride / paymentMethod"
  - "PUT /api/profile whitelist extended for defaultPayDay with 1–28 clamp"
  - "live Postgres schema in sync with schema.ts — all 4 artifacts visible via drizzle-kit introspect"

affects: [09-02-slip-builder-and-renderer, 09-03-endpoints-and-allocation, 09-04-ui-surfaces, 10-real-data-entry]

tech-stack:
  added: []
  patterns:
    - "Reuse existing enums with cosmetic suffixes rather than introduce parallels (salaryModelSnapshotEnum used on live column)"
    - "Whitelist-level NULL coalescing for nullable numeric columns that participate in downstream gates (hourlyRateOverride → null, never 0 or '')"
    - "Server-side clamp for bounded integer fields alongside client-side validation (defaultPayDay 1–28 fallback to 25)"

key-files:
  created:
    - ".planning/phases/09-salary-slip/09-01-SUMMARY.md"
  modified:
    - "server/src/db/schema.ts — +30 lines (payment_slips table + 4 columns + import extension)"
    - "server/src/routes/assistants.ts — +4 lines (3 whitelist fields)"
    - "server/src/routes/profile.ts — +4 lines (1 whitelist field with clamp)"

key-decisions:
  - "Reused salaryModelSnapshotEnum on assistants.salary_model instead of introducing a parallel enum — the '_snapshot' suffix is cosmetic and values match (D-07 locked)"
  - "hourly_rate_override is nullable with no DB default — Plan 09-03's 400-gate depends on the NULL signal (D-12)"
  - "payment_slips stores metadata only (no PII beyond FKs) — PDF is rebuilt on every download from snapshots (D-05, D-06)"
  - "sequence column reserves future supersede semantics (always 1 in v1.0.1)"

patterns-established:
  - "Additive-only schema migrations for v1.0.1 — drizzle db:push is safe when all mutations are '+' (no ~/- lines)"
  - "Denormalised FK fields on audit tables (assistantId + reportMonth duplicated from payrollRecords) to enable composite unique indexes"

requirements-completed: [SLIP-05, SLIP-06, SLIP-07]

duration: ~8min
completed: 2026-04-19
---

# Phase 09 Plan 01: Schema and Whitelists Summary

**payment_slips audit table + 3 assistants columns (salary_model / hourly_rate_override / payment_method) + profile.default_pay_day column shipped to live Postgres, with PUT whitelists extended and all existing enums reused.**

## Performance

- **Duration:** ~8 min (Task 1 + Task 2 authored inline; Task 3 blocking checkpoint resolved by operator)
- **Started:** 2026-04-19T23:10:00Z
- **Completed:** 2026-04-19T23:15:00Z (operator confirmed "pushed" at 23:15)
- **Tasks:** 3 (2 code, 1 human-action checkpoint)
- **Files modified:** 3

## Accomplishments

- `payment_slips` audit table shipped with both indexes — unblocks Plan 09-03's `issueOrReuseSlip` helper
- 3 live `assistants` columns shipped (`salary_model`, `hourly_rate_override`, `payment_method`) — unblocks Plan 09-02's builder and Plan 09-04's Settings dropdown
- `profile.default_pay_day` shipped — unblocks Plan 09-02's pay-date derivation (D-09)
- PUT whitelist extensions mean Plan 09-04's UI can persist through existing `Spara ändringar` / `Spara` buttons — no new endpoints needed (Phase 7 D-19 pattern preserved)
- drizzle-kit push applied cleanly to live DB with zero destructive mutations

## Task Commits

1. **Task 1: Schema additions — payment_slips table + 3 assistants columns + 1 profile column** — `53c6586` (feat)
2. **Task 2: Extend PUT whitelists — assistants.ts and profile.ts** — `63615aa` (feat)
3. **Task 3: [BLOCKING] Drizzle schema push against live Postgres** — operator-run `npm run db:push` (no commit; DB state change only)

## Files Created/Modified

- `server/src/db/schema.ts` — added payment_slips pgTable (10 columns + 2 indexes), 3 columns to assistants table, 1 column to profile table, extended drizzle-orm/pg-core import with uniqueIndex + index
- `server/src/routes/assistants.ts` — PUT /:id whitelist extended with salaryModel (default 'anhörig'), hourlyRateOverride (null-coalesced for D-12 gate), paymentMethod (default 'bankgiro')
- `server/src/routes/profile.ts` — PUT / whitelist extended with defaultPayDay (1–28 clamp, fallback to 25)

### Exact column list added (name / type / default / nullability)

| Table          | Column                | Type                          | Default    | Nullable |
|----------------|-----------------------|-------------------------------|------------|----------|
| assistants     | salary_model          | salary_model_snapshot enum    | 'anhörig'  | no       |
| assistants     | hourly_rate_override  | real                          | (none)     | yes      |
| assistants     | payment_method        | payment_method enum           | 'bankgiro' | no       |
| profile        | default_pay_day       | integer                       | 25         | no       |
| payment_slips  | id                    | text PRIMARY KEY              | (none)     | no       |
| payment_slips  | payroll_record_id     | text FK→payroll_records CASC. | (none)     | no       |
| payment_slips  | assistant_id          | text FK→assistants CASC.      | (none)     | no       |
| payment_slips  | report_month          | text (YYYY-MM)                | (none)     | no       |
| payment_slips  | document_number       | text (LS-YYYY-MM-NNN)         | (none)     | no       |
| payment_slips  | sequence              | integer                       | 1          | no       |
| payment_slips  | issued_at             | timestamp                     | now()      | no       |
| payment_slips  | pay_date              | text (YYYY-MM-DD)             | (none)     | no       |
| payment_slips  | pay_method            | payment_method enum           | (none)     | no       |
| payment_slips  | created_at            | timestamp                     | now()      | yes      |

**Indexes on payment_slips:**
- `payment_slips_assistant_month_seq_uniq` UNIQUE on (assistant_id, report_month, sequence) — enforces one-row-per-slip-issue
- `payment_slips_assistant_month_idx` on (assistant_id, report_month) — secondary lookup

### Enums reused vs. introduced

| Enum                          | Reused from       | New?    |
|-------------------------------|-------------------|---------|
| salary_model_snapshot         | schema.ts:23      | reused  |
| payment_method                | schema.ts (existing) | reused |

**No new enums introduced.** The `_snapshot` suffix on `salary_model_snapshot` is cosmetic — values `'anhörig' | 'fremia' | 'custom'` match exactly between the live column (assistants.salary_model) and the payroll snapshot (payroll_records.salary_model_used).

### drizzle-kit push summary

- Run manually by operator via `cd server && npm run db:push` after tasks 1–2 committed
- Operator confirmed "pushed" (all additive — zero `~` modify, zero `-` drop lines)
- Post-push introspect via `npx drizzle-kit introspect`: 16 tables, 166 columns, 2 indexes, 7 FKs fetched successfully
- Verified all 4 artifacts present in the introspected `drizzle/schema.ts`:
  - `assistants.salary_model` (line 49, default `anhörig`)
  - `assistants.hourly_rate_override` (line 50, nullable)
  - `assistants.payment_method` (line 51, default `bankgiro`)
  - `profile.default_pay_day` (line 153, default 25)
  - `payment_slips` table (line 196) with both indexes (lines 210–211)

## Decisions Made

None beyond what was already locked in 09-CONTEXT.md (D-05 audit-metadata-only, D-06 rebuild-on-download, D-07 reuse enum + defaults, D-09 default_pay_day=25 range 1–28, D-10 payment_method default, D-12 hourly_rate_override=NULL gates 400).

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None. The only blocking point was the expected human-action checkpoint (Task 3) for `npm run db:push`, resolved by operator with "pushed" signal.

## User Setup Required

None — the operator ran `npm run db:push` once as Task 3 of this plan. No recurring external configuration.

## Known Stubs

None — this plan ships schema + whitelists only. No UI stubs, no mock data. Downstream plans (09-02 builder, 09-03 endpoints, 09-04 UI) wire these artifacts.

## Next Phase Readiness

- **09-02 (slip builder + renderer):** Ready — TypeScript now sees `paymentSlips`, `salaryModel`, `hourlyRateOverride`, `paymentMethod`, `defaultPayDay` from drizzle-inferred types.
- **09-03 (endpoints + allocation):** Ready — `issueOrReuseSlip` can query/insert against `payment_slips` live table. D-12 NULL-gate behaves as designed because whitelist preserves NULL.
- **09-04 (UI surfaces):** Ready — Settings → Assistants dropdown + rate field can persist through existing PUT /:id handler; Settings → Profile default-pay-day input persists through existing PUT /.

## Self-Check: PASSED

**Files verified:**
- FOUND: server/src/db/schema.ts (committed 53c6586)
- FOUND: server/src/routes/assistants.ts (committed 63615aa)
- FOUND: server/src/routes/profile.ts (committed 63615aa)
- FOUND: server/drizzle/schema.ts — introspected live DB shows all 4 artifacts

**Commits verified:**
- FOUND: 53c6586 (Task 1 — schema additions)
- FOUND: 63615aa (Task 2 — whitelist extensions)

**Live DB verification:**
- FOUND: payment_slips table (10 cols + 2 indexes)
- FOUND: assistants.salary_model, hourly_rate_override, payment_method
- FOUND: profile.default_pay_day

---
*Phase: 09-salary-slip*
*Completed: 2026-04-19*
