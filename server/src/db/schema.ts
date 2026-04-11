import {
  pgTable, text, integer, real, boolean,
  timestamp, serial, pgEnum
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────────────
export const reqStatusEnum    = pgEnum("req_status",    ["pending","approved","rejected","cancelled"]);
export const repStatusEnum    = pgEnum("rep_status",    ["draft","pending","approved","rejected"]);
export const calStatusEnum    = pgEnum("cal_status",    ["tentative","confirmed"]);
export const sourceEnum       = pgEnum("source",        ["proposal","self_book"]);
export const inviteStatusEnum = pgEnum("invite_status", ["pending","accepted","declined","revoked"]);
export const roleEnum         = pgEnum("role",          ["guardian","assistant"]);
export const entryTypeEnum    = pgEnum("entry_type",    ["active","waiting","standby","sick"]);
export const absenceTypeEnum  = pgEnum("absence_type",  ["sjukfrånvaro","vab","semester","other"]);
export const payrollStatusEnum  = pgEnum("payroll_status",   ["draft", "approved"]);
export const paymentMethodEnum  = pgEnum("payment_method",   ["bankgiro", "swish", "kontant"]);
export const clockTypeEnum      = pgEnum("clock_type",       ["in", "out"]);

// ── Profile ───────────────────────────────────────────────────
export const profile = pgTable("profile", {
  id:            serial("id").primaryKey(),
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
  weeklyHours:   integer("weekly_hours").default(129),
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
  createdAt:      timestamp("created_at").defaultNow(),
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
  // Set to true when this entry was auto-created by a clock-out event (Plan 02).
  // Plan 06 reads this flag to show the "Verified" badge on the Monthly page.
  // Manual entries (proposals, guardian-created) remain verified=false.
  verified:    boolean("verified").default(false),
});

// ── Open slots ────────────────────────────────────────────────
export const openSlots = pgTable("open_slots", {
  id:         text("id").primaryKey(),
  date:       text("date").notNull(),
  startTime:  text("start_time").notNull(),
  endTime:    text("end_time").notNull(),
  hours:      real("hours").notNull(),
  capacity:   integer("capacity").default(1),
  activityId: text("activity_id"),
  createdAt:  timestamp("created_at").defaultNow(),
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

// ── Clock events ──────────────────────────────────────────────
// One row per clock-in or clock-out action by an assistant.
// guardian_id is the specific family the assistant is clocking in/out for.
// This is the trust anchor: server records IP + user-agent at submission time.
export const clockEvents = pgTable("clock_events", {
  id:          text("id").primaryKey(),
  assistantId: text("assistant_id").notNull().references(() => assistants.id, { onDelete: "cascade" }),
  guardianId:  integer("guardian_id").notNull(),  // auth.id of the guardian (same pattern as absences)
  clockType:   clockTypeEnum("clock_type").notNull(),
  timestamp:   timestamp("timestamp").defaultNow().notNull(),
  ip:          text("ip").default(""),
  userAgent:   text("user_agent").default(""),
  // Set to true when this clock-out event auto-created a shift report entry.
  // Allows the system to distinguish verified (clock-based) from manual entries.
  verified:    boolean("verified").default(false),
  createdAt:   timestamp("created_at").defaultNow(),
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
  createdAt:   timestamp("created_at").defaultNow(),
});

// ── Types ─────────────────────────────────────────────────────
export type Profile           = typeof profile.$inferSelect;
export type Auth              = typeof auth.$inferSelect;
export type Assistant         = typeof assistants.$inferSelect;
export type Entry             = typeof entries.$inferSelect;
export type OpenSlot          = typeof openSlots.$inferSelect;
export type Blocked           = typeof blocked.$inferSelect;
export type Invite            = typeof invites.$inferSelect;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type PasswordReset     = typeof passwordResets.$inferSelect;
export type Absence           = typeof absences.$inferSelect;
export type PayrollRecord     = typeof payrollRecords.$inferSelect;
export type Payment           = typeof payments.$inferSelect;
export type ClockEvent              = typeof clockEvents.$inferSelect;
export type AssistantGuardianLink   = typeof assistantGuardianLinks.$inferSelect;
