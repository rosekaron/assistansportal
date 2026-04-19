---
phase: 09
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - server/src/db/schema.ts
  - server/src/routes/assistants.ts
  - server/src/routes/profile.ts
autonomous: false
requirements: [SLIP-05, SLIP-06, SLIP-07]
must_haves:
  truths:
    - "`assistants` table has columns salary_model, hourly_rate_override, payment_method (live columns, not snapshot)"
    - "`profile` table has column default_pay_day (int, default 25)"
    - "`payment_slips` table exists with unique index on (assistant_id, report_month, sequence)"
    - "PUT /api/assistants/:id whitelist persists salaryModel, hourlyRateOverride, paymentMethod"
    - "PUT /api/profile whitelist persists defaultPayDay"
    - "drizzle-kit push has been run against the live Postgres so downstream plans see the new columns"
  artifacts:
    - path: "server/src/db/schema.ts"
      provides: "payment_slips table + 3 new assistants columns + 1 new profile column"
      contains: "paymentSlips"
    - path: "server/src/routes/assistants.ts"
      provides: "PUT whitelist extended for salary_model / hourly_rate_override / payment_method"
      contains: "hourlyRateOverride"
    - path: "server/src/routes/profile.ts"
      provides: "PUT whitelist extended for default_pay_day"
      contains: "defaultPayDay"
  key_links:
    - from: "server/src/db/schema.ts"
      to: "Postgres"
      via: "drizzle-kit push"
      pattern: "npm run db:push"
    - from: "server/src/routes/assistants.ts (PUT /:id)"
      to: "assistants table"
      via: "drizzle update .set()"
      pattern: "salaryModel:\\s+data.salaryModel"
    - from: "server/src/routes/profile.ts (PUT /)"
      to: "profile table"
      via: "drizzle update .set()"
      pattern: "defaultPayDay:\\s+data.defaultPayDay"
---

<objective>
Land the Phase 9 schema additions and route whitelist extensions required by SLIP-05/06/07. All changes are purely additive (no renames, no type changes) so drizzle-kit push is safe per Phase 7 D-05 precedent.

Purpose: Everything downstream (slip builder, endpoints, UI) reads from these columns — this plan must ship first so Plan 02's TypeScript compile against the drizzle-inferred types sees the new fields, and Plan 03's endpoints can query/insert against the live DB.

Output: Schema file with 3 new `assistants` columns, 1 new `profile` column, and 1 new `payment_slips` table; extended PUT whitelists on `assistants.ts` + `profile.ts`; live DB pushed so downstream plans see the new columns immediately.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/phases/09-salary-slip/09-CONTEXT.md
@.planning/phases/09-salary-slip/09-RESEARCH.md
@.planning/phases/09-salary-slip/09-UI-SPEC.md
@.planning/phases/07-foundation-schema-cleanup/07-01-SUMMARY.md

<interfaces>
<!-- Existing enums and types Phase 9 must reuse (from server/src/db/schema.ts). -->

From server/src/db/schema.ts:
```typescript
// Existing enums (reuse — do NOT duplicate):
export const paymentMethodEnum  = pgEnum("payment_method",   ["bankgiro", "swish", "kontant"]);
export const salaryModelSnapshotEnum = pgEnum("salary_model_snapshot", ["anhörig", "fremia", "custom"]);

// Existing assistants columns (Phase 7) — new columns appended after `notes`:
export const assistants = pgTable("assistants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // ... existing columns through `notes: text("notes").default("")`
});

// Existing profile columns (Phase 7) — new column appended after `weeklyHours`:
export const profile = pgTable("profile", {
  id: serial("id").primaryKey(),
  // ... through `weeklyHours: integer("weekly_hours").default(129)`
});

// Existing payrollRecords (Phase 7 snapshots already shipped — read-only for Phase 9):
export const payrollRecords = pgTable("payroll_records", {
  salaryModelUsed: salaryModelSnapshotEnum("salary_model_used").default("anhörig"),
  hourlyRateUsed: real("hourly_rate_used").default(0),
  // ... (SLIP-07 already satisfied by Phase 7)
});
```

From server/src/routes/assistants.ts (PUT /:id, lines 45-71):
```typescript
router.put("/:id", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  const { id } = req.params;
  const data = req.body;
  const [row] = await db.update(assistants).set({
    // ... existing whitelist through `notes: data.notes ?? ""`
  }).where(eq(assistants.id, id)).returning();
  res.json(row);
});
```

From server/src/routes/profile.ts (PUT /, lines 13-50):
```typescript
router.put("/", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  // ... existing whitelist through `setupDone: data.setupDone ?? false`
});
```
</interfaces>
</context>

<tasks>

<task type="auto" tdd="false">
  <name>Task 1: Schema additions — payment_slips table + 3 assistants columns + 1 profile column</name>
  <files>server/src/db/schema.ts</files>
  <read_first>
    - server/src/db/schema.ts (full file — must see existing column layout of `assistants`, `profile`, `payments`, and the enum declarations to avoid duplicating)
    - .planning/phases/09-salary-slip/09-CONTEXT.md (§D-07 schema addition spec, authoritative)
    - .planning/phases/07-foundation-schema-cleanup/07-01-SUMMARY.md (Phase 7 column-addition conventions for naming + default values)
  </read_first>
  <action>
Add to `server/src/db/schema.ts`:

1. **Reuse the existing enum** `salaryModelSnapshotEnum` (schema:23) for the live `assistants.salary_model` column. Do NOT introduce a parallel enum — the `_snapshot` suffix is cosmetic and the three values (`"anhörig" | "fremia" | "custom"`) match exactly. This is the locked choice for D-07.

2. **Append to the `assistants` pgTable** (after the existing `notes` column, before `createdAt`):
```typescript
  // v1.0.1 Phase 9 additions (SLIP-06 / D-07)
  salaryModel:         salaryModelSnapshotEnum("salary_model").default("anhörig"),
  hourlyRateOverride:  real("hourly_rate_override"),                              // nullable, no default — D-12 gate
  paymentMethod:       paymentMethodEnum("payment_method").default("bankgiro"),
```

3. **Append to the `profile` pgTable** (after `weeklyHours`, before `setupDone`):
```typescript
  // v1.0.1 Phase 9 addition (SLIP-05 pay-date derivation / D-07, D-09)
  defaultPayDay:       integer("default_pay_day").default(25),   // 1–28; range enforced client-side per D-09
```

4. **Append a new `paymentSlips` pgTable** at the end of the file (after the `payments` table, keeping the existing ordering convention):
```typescript
// ── Payment slips ─────────────────────────────────────────────
// Metadata-only audit table for issued lönespecifikationer (D-05, D-06).
// PDF is rebuilt on every download from snapshots — this table freezes only the
// identifying information (documentNumber, issuedAt, payDate, payMethod) so a
// re-download produces the same header.
// Unique (assistantId, reportMonth, sequence) enforces one row per slip issue;
// sequence reserves future supersede semantics (always 1 in v1.0.1).
export const paymentSlips = pgTable("payment_slips", {
  id:              text("id").primaryKey(),
  payrollRecordId: text("payroll_record_id").notNull().references(() => payrollRecords.id, { onDelete: "cascade" }),
  assistantId:     text("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),  // denormalised (mirrors payments:229)
  reportMonth:     text("report_month").notNull(),                       // YYYY-MM, denormalised from payrollRecords for unique-index
  documentNumber:  text("document_number").notNull(),                    // "LS-YYYY-MM-NNN"
  sequence:        integer("sequence").notNull().default(1),             // NNN portion — always 1 in v1.0.1
  issuedAt:        timestamp("issued_at").defaultNow().notNull(),
  payDate:         text("pay_date").notNull(),                           // YYYY-MM-DD, frozen at issue (D-09)
  payMethod:       paymentMethodEnum("pay_method").notNull(),            // frozen at issue (D-10)
  createdAt:       timestamp("created_at").defaultNow(),
}, (t) => ({
  uniqAssistantMonthSeq: uniqueIndex("payment_slips_assistant_month_seq_uniq").on(t.assistantId, t.reportMonth, t.sequence),
  idxAssistantMonth:     index("payment_slips_assistant_month_idx").on(t.assistantId, t.reportMonth),
}));
```

5. **Add missing imports** at the top of the file. The existing import line from `drizzle-orm/pg-core` imports `pgTable, text, integer, real, boolean, timestamp, serial, pgEnum, date`. Extend it to also import `uniqueIndex, index`:
```typescript
import {
  pgTable, text, integer, real, boolean,
  timestamp, serial, pgEnum, date, uniqueIndex, index
} from "drizzle-orm/pg-core";
```

Do NOT alter any existing column, enum, or table. Do NOT rename. All Phase 9 changes are additive.
  </action>
  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/server && npx tsc --noEmit -p tsconfig.json 2>&1 | head -40</automated>
  </verify>
  <acceptance_criteria>
    - `grep -nE "salaryModel:\s+salaryModelSnapshotEnum" server/src/db/schema.ts` returns exactly 2 lines (one on assistants, one already on payroll_records)
    - `grep -n "hourlyRateOverride:\s+real" server/src/db/schema.ts` returns exactly 1 line on the assistants table (no default clause — nullable)
    - `grep -n "paymentMethod:\s+paymentMethodEnum" server/src/db/schema.ts` returns at least 1 line on the assistants table with `.default("bankgiro")`
    - `grep -n "defaultPayDay:\s+integer" server/src/db/schema.ts` returns exactly 1 line with `.default(25)`
    - `grep -n "export const paymentSlips = pgTable" server/src/db/schema.ts` returns exactly 1 match
    - `grep -n "uniqueIndex(\"payment_slips_assistant_month_seq_uniq\")" server/src/db/schema.ts` returns exactly 1 match
    - `grep -n "index(\"payment_slips_assistant_month_idx\")" server/src/db/schema.ts` returns exactly 1 match
    - `grep -nE "uniqueIndex|index" server/src/db/schema.ts | head -1` confirms import exists at top of file (line <= 10)
    - `npx tsc --noEmit -p server/tsconfig.json` exits 0 (no type errors introduced)
  </acceptance_criteria>
  <done>All three new `assistants` columns and the new `profile.default_pay_day` column exist in schema.ts; `paymentSlips` table exists with the documented unique + secondary indexes; TypeScript compiles clean.</done>
</task>

<task type="auto" tdd="false">
  <name>Task 2: Extend PUT whitelists — assistants.ts and profile.ts</name>
  <files>
    server/src/routes/assistants.ts
    server/src/routes/profile.ts
  </files>
  <read_first>
    - server/src/routes/assistants.ts (full file — focus lines 45-71 for the PUT /:id whitelist; Phase 7 added fields following a specific nullable-handling pattern you MUST mirror)
    - server/src/routes/profile.ts (full file — focus lines 13-50 for the PUT / whitelist)
    - server/src/db/schema.ts (freshly modified — confirm new column camelCase names match exactly)
    - .planning/phases/09-salary-slip/09-CONTEXT.md (§D-07 defaults + D-13 field list)
  </read_first>
  <action>
Extend the two PUT handlers so the UI in Plan 04 can persist the new fields through the existing `Spara ändringar` and Profile `Spara` buttons (no new endpoints — Phase 7 D-19 pattern).

**a) `server/src/routes/assistants.ts`** — inside the existing `.set({ ... })` block of `router.put("/:id", ...)` (lines 48-70), append three new fields after `notes: data.notes ?? ""` and before the closing `})`:

```typescript
    // v1.0.1 Phase 9 additions (SLIP-06 / D-07)
    salaryModel:        data.salaryModel        ?? "anhörig",           // D-07: default "anhörig"; Fremia/Custom scaffold-only in v1.0.1
    hourlyRateOverride: data.hourlyRateOverride ?? null,                 // D-07: nullable, NO default — D-12 gate depends on this being NULL
    paymentMethod:      data.paymentMethod      ?? "bankgiro",           // D-10: default "bankgiro"
```

Important: `hourlyRateOverride` MUST coalesce to `null` (not `0`, not `""`). A NULL override triggers the 400 error in Plan 03 (D-12). If the client sends the empty string for an unset value, the `??` must preserve NULL. If the existing convention on numeric columns coerces `""` to something else, wrap: `hourlyRateOverride: data.hourlyRateOverride === "" || data.hourlyRateOverride == null ? null : Number(data.hourlyRateOverride),`.

**b) `server/src/routes/profile.ts`** — inside the existing `.set({ ... })` block of `router.put("/", ...)` (lines 20-43), append one field after `setupDone: data.setupDone ?? false` and before `updatedAt:`:

```typescript
        // v1.0.1 Phase 9 addition (D-07, D-09)
        defaultPayDay: typeof data.defaultPayDay === "number" && data.defaultPayDay >= 1 && data.defaultPayDay <= 28
          ? data.defaultPayDay
          : 25,
```

Numeric clamp to 1–28 mirrors Phase 7 D-18 client-validation-only stance while still preventing obvious server-side bad values. Values outside range fall back to the default 25.

Do NOT add new fields not in the schema. Do NOT rename existing fields. Do NOT touch the existing `router.get` / `router.post` / `router.delete` handlers.
  </action>
  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/server && npx tsc --noEmit -p tsconfig.json 2>&1 | head -40</automated>
  </verify>
  <acceptance_criteria>
    - `grep -n "salaryModel:\s*data.salaryModel" server/src/routes/assistants.ts` returns exactly 1 match inside the PUT /:id handler
    - `grep -n "hourlyRateOverride:" server/src/routes/assistants.ts` returns exactly 1 match whose RHS evaluates to null when input is null/empty string (verified by reading the line)
    - `grep -n "paymentMethod:\s*data.paymentMethod" server/src/routes/assistants.ts` returns exactly 1 match with fallback `"bankgiro"`
    - `grep -n "defaultPayDay:" server/src/routes/profile.ts` returns exactly 1 match with the 1–28 clamp visible in the same statement
    - `npx tsc --noEmit -p server/tsconfig.json` exits 0
  </acceptance_criteria>
  <done>Both PUT handlers persist the new Phase 9 fields following the existing Phase 7 whitelist pattern; TypeScript compiles clean.</done>
</task>

<task type="checkpoint:human-action" gate="blocking">
  <name>Task 3: [BLOCKING] Drizzle schema push against live Postgres</name>
  <files>N/A — DB state change only</files>
  <read_first>
    - .planning/phases/07-foundation-schema-cleanup/07-01-SUMMARY.md (confirms db:push was the Phase 7 mechanism and that all new columns are additive = safe push with no destructive prompts)
    - server/package.json (confirm `db:push` script alias)
  </read_first>
  <what-built>Schema additions from Task 1 (3 `assistants` columns + 1 `profile` column + new `payment_slips` table with 2 indexes). These are additive-only; drizzle-kit push should show only `+` mutations.</what-built>
  <how-to-verify>
    1. Run `cd server && npm run db:push` (falls back to `cd server && npx drizzle-kit push --force` if the interactive prompt appears and the operator confirms no destructive changes are listed — additive `+` only).
    2. After push completes, run `cd server && npx drizzle-kit introspect 2>&1 | grep -E "payment_slips|hourly_rate_override|default_pay_day|salary_model"` — expect lines showing all four artifacts.
    3. Alternatively connect to the dev Postgres and run `\\d payment_slips` — expect a table listing with columns id, payroll_record_id, assistant_id, report_month, document_number, sequence, issued_at, pay_date, pay_method, created_at and the unique index `payment_slips_assistant_month_seq_uniq`.
    4. Run `\\d assistants` — expect `salary_model`, `hourly_rate_override`, `payment_method` columns present.
    5. Run `\\d profile` — expect `default_pay_day` column present with default `25`.
  </how-to-verify>
  <action>Operator runs `cd server && npm run db:push` and confirms the output shows ONLY additive mutations (lines starting with `+` or equivalent drizzle-kit markers). If any `~` (modify) or `-` (drop) lines appear, STOP and report to planner — Phase 9 should never introduce destructive changes.</action>
  <verify>
    <automated>cd /Users/rosekaron/Desktop/Kalinga/assistansportal/server && npx drizzle-kit introspect 2>&1 | grep -cE "payment_slips|hourly_rate_override|default_pay_day"</automated>
  </verify>
  <acceptance_criteria>
    - drizzle-kit push output contains ZERO lines matching `~` (modify) or `-` (drop)
    - drizzle-kit push output contains at least 4 additive lines (3 assistants columns + 1 profile column + payment_slips table)
    - `\d payment_slips` in psql lists all 10 columns and both indexes (payment_slips_assistant_month_seq_uniq, payment_slips_assistant_month_idx)
    - `\d assistants` lists `salary_model`, `hourly_rate_override`, `payment_method`
    - `\d profile` lists `default_pay_day` with default 25
  </acceptance_criteria>
  <done>Schema state in live Postgres matches the schema.ts state committed in Tasks 1-2 with zero destructive changes applied.</done>
  <resume-signal>Type "pushed" once the db:push completes cleanly and the introspection shows all four artifacts. Type "failed: {reason}" if drizzle-kit prompts for destructive changes or the introspection does not show all artifacts.</resume-signal>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| client→server PUT /api/assistants/:id | Untrusted guardian input crosses here; whitelist is the gate |
| client→server PUT /api/profile | Untrusted guardian input crosses here; whitelist is the gate |
| server→Postgres | drizzle parameterises all values; schema enforces types + unique indexes |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-09-01 | T (Tampering) | PUT /api/assistants/:id salaryModel | mitigate | drizzle pgEnum rejects values outside `"anhörig" \| "fremia" \| "custom"` at the DB layer; the whitelist fallback to `"anhörig"` prevents untyped values from reaching DB |
| T-09-02 | T | PUT /api/assistants/:id paymentMethod | mitigate | drizzle pgEnum rejects values outside `"bankgiro" \| "swish" \| "kontant"`; whitelist fallback to `"bankgiro"` |
| T-09-03 | T | PUT /api/assistants/:id hourlyRateOverride | mitigate | Whitelist coerces `""` and `null` to `null`; drizzle `real` column rejects non-numeric values; negative values accepted at schema layer but caught by UI client-side validation (Phase 7 D-18 stance) — acceptable for single-tenant single-guardian |
| T-09-04 | T | PUT /api/profile defaultPayDay | mitigate | Whitelist clamps to 1–28 range server-side; values outside range silently fall back to 25 |
| T-09-05 | I (Info Disclosure) | payment_slips table (metadata, no PII beyond FKs) | accept | Table contains no pno, no bank numbers, no salary figures — only identifiers and timestamps. Low-value target. |
| T-09-06 | E (Elevation) | PUT /api/assistants/:id (new fields) | mitigate | Pre-existing `requireAuth` + `requireGuardian` middleware on the route; assistants cannot hit the endpoint |
| T-09-07 | D (Denial of Service) | db:push against live DB | accept | Manual one-time operation during Wave 1 deploy; no recurring attack surface |
</threat_model>

<verification>
**Post-plan verification checks (run before marking plan complete):**

1. **Schema compile:** `cd server && npx tsc --noEmit -p tsconfig.json` exits 0.
2. **DB introspection:** `cd server && npx drizzle-kit introspect 2>&1 | grep -c "payment_slips"` returns non-zero; all four artifacts (3 assistants cols, 1 profile col, 1 new table) visible.
3. **Whitelist grep (assistants):** `grep -c "salaryModel\\|hourlyRateOverride\\|paymentMethod" server/src/routes/assistants.ts` returns >= 3.
4. **Whitelist grep (profile):** `grep -c "defaultPayDay" server/src/routes/profile.ts` returns >= 1.
5. **No existing code altered:** `git diff --stat server/src/db/schema.ts server/src/routes/assistants.ts server/src/routes/profile.ts` shows only additions, no deletions outside expected import-line expansion.
</verification>

<success_criteria>
- Plan compiles cleanly with `npx tsc --noEmit` (no type errors).
- `drizzle-kit push` applied cleanly to the live Postgres with zero destructive mutations.
- `\\d assistants`, `\\d profile`, `\\d payment_slips` all confirm the new shape.
- Downstream Plan 02 can import `paymentSlips` + the new column names from `../db/schema` without further schema changes.
</success_criteria>

<output>
After completion, create `.planning/phases/09-salary-slip/09-01-SUMMARY.md` documenting:
- Exact column list added (name, type, default, nullability)
- Which existing enum was reused (`salaryModelSnapshotEnum`) vs. introduced (none)
- drizzle-kit push output summary (number of additive mutations, zero destructive)
- Any deviations from the plan (should be none)
</output>
