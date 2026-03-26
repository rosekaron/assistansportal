import {
  pgTable, text, integer, real, boolean,
  timestamp, serial, pgEnum
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────────────
export const reqStatusEnum    = pgEnum("req_status",    ["pending","approved","rejected"]);
export const repStatusEnum    = pgEnum("rep_status",    ["draft","pending","approved","rejected"]);
export const calStatusEnum    = pgEnum("cal_status",    ["tentative","confirmed"]);
export const sourceEnum       = pgEnum("source",        ["proposal","self_book"]);
export const inviteStatusEnum = pgEnum("invite_status", ["pending","accepted","declined","revoked"]);
export const roleEnum         = pgEnum("role",          ["guardian","assistant"]);
export const entryTypeEnum    = pgEnum("entry_type",    ["active","waiting","standby","sick"]);

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
