import {
  pgTable, text, integer, real, boolean,
  timestamp, serial, pgEnum, date, uniqueIndex, index
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────────────
export const reqStatusEnum    = pgEnum("req_status",    ["pending","approved","rejected","cancelled"]);
export const repStatusEnum    = pgEnum("rep_status",    ["draft","pending","approved","rejected"]);
export const calStatusEnum    = pgEnum("cal_status",    ["tentative","confirmed"]);
// NOTE: "self_book" value retained per D-14 — used by clock.ts as clock-origin marker, NOT for self-booking UX (removed in CLEAN-01).
export const sourceEnum       = pgEnum("source",        ["proposal","self_book"]);
export const inviteStatusEnum  = pgEnum("invite_status",  ["pending","accepted","declined","revoked"]);
export const linkStatusEnum    = pgEnum("link_status",    ["pending","accepted","declined"]);
export const roleEnum         = pgEnum("role",          ["guardian","assistant"]);
export const entryTypeEnum    = pgEnum("entry_type",    ["active","waiting","standby","sick"]);
export const absenceTypeEnum  = pgEnum("absence_type",  ["sjukfrånvaro","vab","semester","other"]);
export const payrollStatusEnum  = pgEnum("payroll_status",   ["draft", "approved"]);
export const paymentMethodEnum  = pgEnum("payment_method",   ["bankgiro", "swish", "kontant"]);
export const clockTypeEnum      = pgEnum("clock_type",       ["in", "out"]);

// v1.0.1 Phase 7 additions
export const taxSchemeEnum           = pgEnum("tax_scheme",           ["a-skatt", "f-skatt"]);                                                               // D-15
export const patientRelationEnum     = pgEnum("patient_relation",     ["parent-child", "spouse", "adult-child", "legal-guardian", "god_man", "other"]);       // D-16
export const salaryModelSnapshotEnum = pgEnum("salary_model_snapshot", ["anhörig", "fremia", "custom"]);                                                      // for payroll_records snapshot; live logic ships Phase 9

// ── Profile ───────────────────────────────────────────────────
// NOTE: weeklyHours below = FK beslut hour entitlement (stated per week per 51 kap 9§ SFB).
// FK does NOT set a daily cap — labor law does (ATL or Lag 1970:943).
// See docs/compliance/swedish-fk-and-labor-rules.md for the complete rule set.
export const profile = pgTable("profile", {
  id:            serial("id").primaryKey(),
  authId:        integer("auth_id"),          // FK to auth.id — which guardian owns this profile (null = legacy global)
  guardianName:  text("guardian_name").default(""),
  guardianPno:   text("guardian_pno").default(""),
  guardianEmail: text("guardian_email").default(""),
  guardianPhone: text("guardian_phone").default(""),
  patientName:   text("patient_name").default(""),
  patientPno:    text("patient_pno").default(""),
  address:       text("address").default(""),
  city:          text("city").default(""),
  zip:           text("zip").default(""),
  fkDecisionNo:  text("fk_decision_no").default(""),
  // v1.0.1 Phase 7 additions (SCHEMA-02 / D-02, D-03, D-07 (split address), D-09, D-16, D-17)
  // Split household address columns added alongside existing `address` (D-07 fallback).
  // weeklyHours stays as the single source of truth for FK hour entitlement (D-01, D-04).
  // See docs/compliance/swedish-fk-and-labor-rules.md §7.3 for why fk_decision_hours_per_day is NOT added.
  addressStreet:                 text("address_street").default(""),
  addressZip:                    text("address_zip").default(""),
  addressCity:                   text("address_city").default(""),
  fkDecisionStart:               date("fk_decision_start"),                                                     // D-02
  fkDecisionEnd:                 date("fk_decision_end"),                                                       // D-02
  dubbelAssistansApproved:       boolean("dubbel_assistans_approved").default(false),                           // D-03
  patientRelationToGuardian:     patientRelationEnum("patient_relation_to_guardian").default("parent-child"),   // D-16
  patientRequiresRepresentative: boolean("patient_requires_representative").default(false),                     // SCHEMA-02 / Phase 8 dependency
  weeklyHours:   integer("weekly_hours").default(129),
  // v1.0.1 Phase 9 addition (SLIP-05 pay-date derivation / D-07, D-09)
  defaultPayDay:       integer("default_pay_day").default(25),   // 1–28; range enforced client-side per D-09
  setupDone:     boolean("setup_done").default(false),
  createdAt:     timestamp("created_at").defaultNow(),
  updatedAt:     timestamp("updated_at").defaultNow(),
});

// ── Auth ──────────────────────────────────────────────────────
export const auth = pgTable("auth", {
  id:            serial("id").primaryKey(),
  email:         text("email").notNull().unique(),
  passwordHash:  text("password_hash").notNull(),
  role:          roleEnum("role").default("guardian"),
  emailVerified: boolean("email_verified").default(false),
  assistantId:   text("assistant_id"),
  createdAt:     timestamp("created_at").defaultNow(),
});

// ── Email verifications ───────────────────────────────────────
export const emailVerifications = pgTable("email_verifications", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull(),
  token:     text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Password resets ───────────────────────────────────────────
export const passwordResets = pgTable("password_resets", {
  id:        serial("id").primaryKey(),
  userId:    integer("user_id").notNull(),
  token:     text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  used:      boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Assistants ────────────────────────────────────────────────
export const assistants = pgTable("assistants", {
  id:             text("id").primaryKey(),
  name:           text("name").notNull(),
  initials:       text("initials").default(""),
  color:          text("color").default("#6366f1"),
  email:          text("email").default(""),
  pno:            text("pno").default(""),
  phone:          text("phone").default(""),
  minWeeklyHours: integer("min_weekly_hours").default(0),
  isFlexible:     boolean("is_flexible").default(false),
  inviteStatus:   inviteStatusEnum("invite_status").default("pending"),
  authId:         integer("auth_id"),
  // Multi-family (from origin/main): which guardian created this record + display label for the family
  guardianAuthId: integer("guardian_auth_id"),                          // FK to auth.id of the guardian
  familyLabel:    text("family_label").default(""),                     // patient name from guardian profile (for fast display)
  address:        text("address").default(""),
  // v1.0.1 Phase 7 additions (SCHEMA-01 / D-07, D-15, D-17)
  addressStreet:         text("address_street").default(""),            // D-07 — new split address; existing single-line `address` kept for fallback
  addressZip:            text("address_zip").default(""),
  addressCity:           text("address_city").default(""),
  skattetabell:          integer("skattetabell"),                        // D-17 — null OK; flat 30% remains until v1.4 closes H3
  taxScheme:             taxSchemeEnum("tax_scheme").default("a-skatt"), // D-15
  bankClearing:          text("bank_clearing").default(""),              // D-17
  bankAccount:           text("bank_account").default(""),
  iban:                  text("iban").default(""),
  employmentStartDate:   date("employment_start_date"),                  // D-17 — null OK until guardian fills it
  employmentEndDate:     date("employment_end_date"),                    // null = tillsvidare
  citizenship:           text("citizenship").default(""),
  residencePermitExpiry: date("residence_permit_expiry"),                // null for EU/EES medborgare
  notes:                 text("notes").default(""),                      // D-17 — free-form
  // v1.0.1 Phase 9 additions (SLIP-06 / D-07)
  salaryModel:         salaryModelSnapshotEnum("salary_model").default("anhörig"),
  hourlyRateOverride:  real("hourly_rate_override"),                              // nullable, no default — D-12 gate
  paymentMethod:       paymentMethodEnum("payment_method").default("bankgiro"),
  createdAt:      timestamp("created_at").defaultNow(),
});

// ── Auth ↔ Assistants (many-to-many) ──────────────────────────
// One assistant auth account can be linked to multiple assistant records (one per family)
export const authAssistants = pgTable("auth_assistants", {
  id:          text("id").primaryKey(),
  authId:      integer("auth_id").notNull(),      // FK to auth.id (assistant role)
  assistantId: text("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  status:      linkStatusEnum("status").default("pending"),
  createdAt:   timestamp("created_at").defaultNow(),
});

// ── Schedule entries ──────────────────────────────────────────
export const entries = pgTable("entries", {
  id:          text("id").primaryKey(),
  assistantId: text("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  date:        text("date").notNull(),
  startTime:   text("start_time").notNull(),
  endTime:     text("end_time").notNull(),
  hours:       real("hours").notNull(),
  entryType:   entryTypeEnum("entry_type").default("active"),
  reqStatus:   reqStatusEnum("req_status").default("pending"),
  repStatus:   repStatusEnum("rep_status").default("draft"),
  source:      sourceEnum("source").default("proposal"),
  calStatus:   calStatusEnum("cal_status"),
  activityId:  text("activity_id"),
  gcalEventId: text("gcal_event_id"),
  createdAt:   timestamp("created_at").defaultNow(),
  updatedAt:   timestamp("updated_at").defaultNow(),
  // Set to true when this entry was auto-created by a clock-out event (clock.ts).
  // Plan 06 reads this flag to show the "Verified" badge on the Monthly page.
  // Manual entries (proposals, guardian-created) remain verified=false.
  // Per Decision #2 (2026-04-25): main's parallel clock-column approach
  // (clockedInAt/clockedOutAt/actualHours/guardianAdjusted) was DROPPED — milestone's
  // separate `clock.ts` route + this `verified` flag is the authoritative implementation.
  verified:    boolean("verified").default(false),
});

// ── Blocked time ──────────────────────────────────────────────
export const blocked = pgTable("blocked", {
  id:        text("id").primaryKey(),
  date:      text("date").notNull(),
  startTime: text("start_time").notNull(),
  endTime:   text("end_time").notNull(),
  reason:    text("reason").default(""),
  createdAt: timestamp("created_at").defaultNow(),
});

// ── Invites ───────────────────────────────────────────────────
export const invites = pgTable("invites", {
  id:             text("id").primaryKey(),
  name:           text("name").notNull(),
  email:          text("email").notNull(),
  minWeeklyHours: integer("min_weekly_hours").default(0),
  isFlexible:     boolean("is_flexible").default(false),
  status:         inviteStatusEnum("status").default("pending"),
  message:        text("message").default(""),
  sentAt:         timestamp("sent_at").defaultNow(),
  createdAt:      timestamp("created_at").defaultNow(),
});

// ── Costs ─────────────────────────────────────────────────────
export const costCategoryEnum = pgEnum("cost_category", [
  "wages", "employer_tax", "sick_leave", "training", "adaptation", "other",
]);

export const costs = pgTable("costs", {
  id:          text("id").primaryKey(),
  month:       text("month").notNull(),          // YYYY-MM
  category:    costCategoryEnum("category").notNull(),
  assistantId: text("assistant_id"),             // optional link to assistant
  amountSek:   real("amount_sek").notNull(),
  description: text("description").default(""),
  createdAt:   timestamp("created_at").defaultNow(),
});

// ── Settings ──────────────────────────────────────────────────
export const settings = pgTable("settings", {
  key:   text("key").primaryKey(),
  value: text("value").notNull().default(""),
});

// ── Absences ──────────────────────────────────────────────────
export const absences = pgTable("absences", {
  id:          text("id").primaryKey(),
  guardianId:  integer("guardian_id").notNull(),
  // null = absence applies to ALL assistants for this guardian (e.g. public holiday)
  // NOTE: single-tenant deployment; guardianId = req.userId from JWT (auth.id)
  assistantId: text("assistant_id"),
  absenceType: absenceTypeEnum("absence_type").notNull(),
  startDate:   text("start_date").notNull(),  // YYYY-MM-DD
  endDate:     text("end_date").notNull(),     // YYYY-MM-DD
  createdAt:   timestamp("created_at").defaultNow(),
});

// ── Payroll records ───────────────────────────────────────────
// One row per assistant per month. Rates are snapshotted at generation time (D-02).
// No guardianId column — single-tenant; isolation via requireGuardian middleware (D-03).
export const payrollRecords = pgTable("payroll_records", {
  id:                    text("id").primaryKey(),
  assistantId:           text("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  month:                 text("month").notNull(),           // YYYY-MM
  billableHours:         real("billable_hours").notNull(),
  hourlyRateSnapshot:    real("hourly_rate_snapshot").notNull(),  // snapshotted from FK_HOURLY_RATE at generation (D-02)
  taxRateSnapshot:       real("tax_rate_snapshot").notNull(),     // snapshotted from EMPLOYER_TAX_RATE at generation (D-02)
  prelimTaxRateSnapshot: real("prelim_tax_rate_snapshot").default(0),  // snapshotted preliminary tax rate at generation (D-05)
  // v1.0.1 Phase 7 additions — snapshot at generation time; live logic in Phase 9 (SLIP-07)
  salaryModelUsed:       salaryModelSnapshotEnum("salary_model_used").default("anhörig"),
  hourlyRateUsed:        real("hourly_rate_used").default(0),
  grossPay:              real("gross_pay").notNull(),
  employerContributions: real("employer_contributions").notNull(),
  totalEmployerCost:     real("total_employer_cost").notNull(),
  absenceBreakdownJson:  text("absence_breakdown_json"),          // JSON: {"sjukfrånvaro":h,"vab":h,"semester":h,"other":h} — per-type absence hours snapshotted at generate time (PAY-02)
  status:                payrollStatusEnum("status").default("draft"),
  approvedAt:            timestamp("approved_at"),
  createdAt:             timestamp("created_at").defaultNow(),
  updatedAt:             timestamp("updated_at").defaultNow(),
});

// ── Payments ──────────────────────────────────────────────────
// One row per payment recorded against a payroll record.
export const payments = pgTable("payments", {
  id:              text("id").primaryKey(),
  payrollRecordId: text("payroll_record_id").notNull().references(() => payrollRecords.id, { onDelete: "cascade" }),
  assistantId:     text("assistant_id").notNull(),  // denormalised from payrollRecord for query convenience
  date:            text("date").notNull(),           // YYYY-MM-DD
  amountSek:       real("amount_sek").notNull(),
  method:          paymentMethodEnum("method").notNull(),
  createdAt:       timestamp("created_at").defaultNow(),
});

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

// ── Clock events ──────────────────────────────────────────────
// One row per clock-in or clock-out action by an assistant.
// guardian_id is the specific family the assistant is clocking in/out for.
// This is the trust anchor: server records IP + user-agent at submission time.
export const clockEvents = pgTable("clock_events", {
  id:          text("id").primaryKey(),
  assistantId: text("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  guardianId:  integer("guardian_id").notNull(),  // auth.id of the guardian (same pattern as absences)
  clockType:   clockTypeEnum("clock_type").notNull(),
  // timestamp + created_at are timestamptz in live DB (from v0 multi-family push) — preserve.
  timestamp:   timestamp("timestamp", { withTimezone: true }).defaultNow().notNull(),
  ip:          text("ip").default(""),
  userAgent:   text("user_agent").default(""),
  // Set to true when this clock-out event auto-created a shift report entry.
  // Allows the system to distinguish verified (clock-based) from manual entries.
  verified:    boolean("verified").default(false),
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Assistant–Guardian links ───────────────────────────────────
// One row per (assistant, guardian) working relationship.
// active=false means the link was created (invite sent) but not yet accepted.
// active=true means the assistant accepted and can clock in/out for this family.
// This is the multi-family support table: one assistant can have N active links.
export const assistantGuardianLinks = pgTable("assistant_guardian_links", {
  id:          text("id").primaryKey(),
  assistantId: text("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  guardianId:  integer("guardian_id").notNull(),  // auth.id of the guardian
  active:      boolean("active").default(false).notNull(),
  // created_at is timestamptz in live DB (from v0 multi-family push) — preserve to avoid truncate on push.
  createdAt:   timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ── Types ─────────────────────────────────────────────────────
export type Profile           = typeof profile.$inferSelect;
export type Auth              = typeof auth.$inferSelect;
export type Assistant         = typeof assistants.$inferSelect;
export type AuthAssistant     = typeof authAssistants.$inferSelect;
export type Entry             = typeof entries.$inferSelect;
export type Blocked           = typeof blocked.$inferSelect;
export type Invite            = typeof invites.$inferSelect;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type PasswordReset     = typeof passwordResets.$inferSelect;
export type Absence           = typeof absences.$inferSelect;
export type PayrollRecord     = typeof payrollRecords.$inferSelect;
export type Payment           = typeof payments.$inferSelect;
export type ClockEvent              = typeof clockEvents.$inferSelect;
export type AssistantGuardianLink   = typeof assistantGuardianLinks.$inferSelect;
