import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export const db = drizzle(pool, { schema });

// ── Seed defaults on first run ────────────────────────────────
export async function seedDefaults() {
  // Ensure single profile row exists
  const existing = await db.select().from(schema.profile).limit(1);
  if (existing.length === 0) {
    await db.insert(schema.profile).values({});
  }

  // Default settings
  const defaultSettings = [
    { key: "allow_self_book",       value: "true" },
    { key: "self_book_approval",    value: "require-approval" },
    { key: "booking_window_days",   value: "14" },
    { key: "gcal_connected",        value: "false" },
    { key: "gcal_email",            value: "" },
    { key: "gcal_calendar_id",      value: "" },
    { key: "gcal_sync_enabled",     value: "true" },
    { key: "gcal_reminders",        value: "true" },
    { key: "gcal_reminder_hours",   value: "24" },
  ];

  for (const s of defaultSettings) {
    await db
      .insert(schema.settings)
      .values(s)
      .onConflictDoNothing();
  }
}
