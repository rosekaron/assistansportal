---
phase: 07-foundation-schema-cleanup
plan: 01
status: complete
commits:
  - 5b3674a
  - 7ca87bf
  - cba68e5
requirements: [SCHEMA-01, SCHEMA-02, SCHEMA-03, CLEAN-02, CLEAN-03]
---

## One-liner
Added 23 new columns + 3 enums across assistants/profile/payroll_records, dropped `open_slots` table, removed 3 dead scheduling keys from `seedDefaults()`, and resolved pre-existing v1.0 schema drift — live Postgres now matches schema.ts.

## What was built

### Enums added (3)
- `tax_scheme` — `"a-skatt" | "f-skatt"` (D-15)
- `patient_relation` — `"parent-child" | "spouse" | "adult-child" | "legal-guardian" | "god_man" | "other"` (D-16)
- `salary_model_snapshot` — `"anhörig" | "fremia" | "custom"` (for Phase 9 payroll snapshot)

### assistants — 13 new columns (D-07, D-15, D-17)
| Column | Type | Default |
|---|---|---|
| `address_street` | text | `''` |
| `address_zip` | text | `''` |
| `address_city` | text | `''` |
| `skattetabell` | integer | null |
| `tax_scheme` | enum tax_scheme | `'a-skatt'` |
| `bank_clearing` | text | `''` |
| `bank_account` | text | `''` |
| `iban` | text | `''` |
| `employment_start_date` | date | null |
| `employment_end_date` | date | null |
| `citizenship` | text | `''` |
| `residence_permit_expiry` | date | null |
| `notes` | text | `''` |

### profile — 8 new columns (D-02, D-03, D-07, D-09, D-16, SCHEMA-02)
| Column | Type | Default |
|---|---|---|
| `address_street` | text | `''` |
| `address_zip` | text | `''` |
| `address_city` | text | `''` |
| `fk_decision_start` | date | null |
| `fk_decision_end` | date | null |
| `dubbel_assistans_approved` | boolean | `false` |
| `patient_relation_to_guardian` | enum patient_relation | `'parent-child'` |
| `patient_requires_representative` | boolean | `false` |

### payroll_records — 2 snapshot columns (for Phase 9 SLIP-07)
| Column | Type | Default |
|---|---|---|
| `salary_model_used` | enum salary_model_snapshot | `'anhörig'` |
| `hourly_rate_used` | real | `0` |

### Removed (authorized per plan + CONTEXT D-13)
- `open_slots` table (entire definition + `OpenSlot` type export)
- `seedDefaults()` keys: `allow_self_book`, `self_book_approval`, `booking_window_days`
- `sourceEnum "self_book"` value **preserved** per D-14 (still used by `clock.ts:182`)

## Deviations from plan

### Drift cleanup (scope expansion, authorized mid-push)
Phase 7 inherited pre-existing schema drift from v1.0 → v1.0.1 archive. These 7 columns were present in the live DB but not declared in schema.ts (someone cleaned up schema at archive time but never ran `db:push` to drop them — commit `2dfb91e`'s message called it out explicitly). User authorized drops after confirming no v1.0.1 code references any of them.

| Table | Column(s) dropped | Rows lost |
|---|---|---|
| `entries` | `clocked_in_at`, `clocked_out_at`, `actual_hours`, `guardian_adjusted` | 85 each (superseded by `clock_events` table) |
| `assistants` | `guardian_auth_id`, `family_label` | 2 each (superseded by `assistant_guardian_links`) |
| `profile` | `auth_id` | 1 (unused) |

### Timestamptz drift fix (commit `cba68e5`)
Initial `db:push` attempt flagged a data-loss type change on `assistant_guardian_links.created_at` that would have truncated the 2 existing rows. Investigation showed `clock_events.created_at`, `clock_events.timestamp`, and `assistant_guardian_links.created_at` were pushed as `timestamptz` in v0 (via pg-client direct DDL per commit `2dfb91e`), but schema.ts declared them as plain `timestamp`. Added `{ withTimezone: true }` modifier to match live DB — no truncate needed.

### Apply-path deviation
Plan specified `npm run db:push` with interactive confirmation. Drizzle-kit 0.21.4 lacks a `--force` flag, so the push was driven interactively by the user (with guidance on rename-vs-create for each prompt, since drizzle's rename heuristic matched similarly-named columns like `address_street` against unrelated existing columns). All prompts answered as **create** (never rename).

## key-files

### created
_(none — all changes were edits to existing files)_

### modified
- `server/src/db/schema.ts` — new enums + columns + openSlots removed + timestamptz fixes
- `server/src/db/index.ts` — 3 dead scheduling keys removed from `seedDefaults()`

## Verification

24/24 programmatic checks passed against live Postgres:
- All 17 new column additions present
- All 3 new enums registered in `pg_type`
- `open_slots` table no longer exists
- All 7 drifted columns dropped
- `sourceEnum` still contains `"self_book"` value (D-14 preserved)

## Known transitional state

`server/src/routes/misc.ts:3` and `server/src/routes/assistant.ts:3` still import `openSlots` from `schema.ts`, which now fails to typecheck:
```
src/routes/assistant.ts(3,40): error TS2305: Module '"../db/schema"' has no exported member 'openSlots'
src/routes/misc.ts(3,10):      error TS2305: Module '"../db/schema"' has no exported member 'openSlots'
```

These are **expected and scheduled for removal in Plan 07-03** (CLEAN-01/CLEAN-02 — removes the API + client surface that referenced `openSlots`). Server will not boot cleanly with `npm run dev` until Plan 07-03 lands. `db:push` works because it only reads schema.ts.

## Self-Check: PASSED

- [x] All 3 tasks executed (schema additions, seed cleanup, live push)
- [x] Each task committed atomically (`5b3674a`, `7ca87bf`, `cba68e5`)
- [x] Live DB matches schema (24-check verification)
- [x] No unauthorized data loss (only drift-cleanup drops, user-authorized after grep verification)
- [x] sourceEnum "self_book" preserved (D-14)
