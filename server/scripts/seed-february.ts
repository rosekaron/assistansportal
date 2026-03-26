/**
 * Seed script — adds mock February 2025 schedule data
 * for Rose and Mikael: ~30h/week each, randomly distributed
 *
 * Run from server/ folder:
 *   npx tsx scripts/seed-february.ts
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db   = drizzle(pool, { schema });

const ACTIVITIES = [
  "bathing", "feeding", "personal_care", "school",
  "companionship", "active", "overnight", "other",
];

// Shift blocks [startHour, durationHours]
const SHIFTS: [number, number][] = [
  [7,  3], [7,  4], [8,  3], [8,  4],
  [10, 3], [10, 4], [12, 4], [14, 4],
  [16, 4], [18, 4], [7,  6], [14, 6],
];

function pad(n: number) { return String(n % 24).padStart(2, "0"); }
function hhmm(h: number) { return `${pad(h)}:00`; }
function newId() { return `e_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

function febDates(): string[] {
  const out: string[] = [];
  for (let d = 1; d <= 28; d++) out.push(`2025-02-${String(d).padStart(2,"0")}`);
  return out;
}

// Split dates into Mon-Sun weeks
function toWeeks(dates: string[]): string[][] {
  const weeks: string[][] = [];
  let week: string[] = [];
  for (const d of dates) {
    week.push(d);
    // Sunday = end of week, or last date
    if (new Date(d).getDay() === 0 || d === dates.at(-1)) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length) weeks.push(week);
  return weeks;
}

async function main() {
  console.log("🔍 Looking up assistants in database...\n");

  const all = await db.select().from(schema.assistants);

  if (all.length === 0) {
    console.error("❌ No assistants found. Please complete the setup wizard first and add Rose and Mikael.");
    process.exit(1);
  }

  console.log("Available assistants:");
  all.forEach(a => console.log(`  - ${a.name} (${a.id})`));
  console.log("");

  const rose   = all.find(a => a.name.toLowerCase().includes("rose"));
  const mikael = all.find(a => a.name.toLowerCase().includes("mikael"));

  if (!rose) {
    console.error(`❌ No assistant named "Rose" found.\nPlease add Rose via the Assistants page first, then re-run this script.`);
    process.exit(1);
  }
  if (!mikael) {
    console.error(`❌ No assistant named "Mikael" found.\nPlease add Mikael via the Assistants page first, then re-run this script.`);
    process.exit(1);
  }

  console.log(`✅ Rose   → ${rose.id}`);
  console.log(`✅ Mikael → ${mikael.id}\n`);

  const weeks  = toWeeks(febDates());
  const rows: typeof schema.entries.$inferInsert[] = [];

  for (const week of weeks) {
    for (const asst of [rose, mikael]) {
      let total = 0;
      const target = 30;
      const days = [...week].sort(() => Math.random() - 0.5); // randomise day order

      for (const date of days) {
        if (total >= target) break;
        const remaining = target - total;

        // Pick a shift that fits remaining budget (+1h tolerance)
        const eligible = SHIFTS.filter(([, dur]) => dur <= remaining + 1);
        if (!eligible.length) break;

        const [startH, dur] = pick(eligible);
        const activity       = pick(ACTIVITIES);
        const reqStatus      = Math.random() < 0.65 ? "approved" : "pending";
        const repStatus      = reqStatus === "approved" && Math.random() < 0.5 ? "pending" : "draft";
        const calStatus      = reqStatus === "approved" ? "confirmed" : "tentative";

        rows.push({
          id:          newId(),
          assistantId: asst.id,
          date,
          startTime:   hhmm(startH),
          endTime:     hhmm(startH + dur),
          hours:       dur,
          reqStatus:   reqStatus as "pending" | "approved",
          repStatus:   repStatus as "draft"   | "pending",
          source:      "proposal",
          calStatus:   calStatus as "tentative" | "confirmed",
          activityId:  activity,
        });

        total += dur;
      }

      const weekLabel = week[0];
      console.log(`  ${asst.name.padEnd(10)} week of ${weekLabel}: ${total}h across ${week.length} days`);
    }
  }

  console.log(`\n⬆️  Inserting ${rows.length} shifts...`);

  // Insert in batches of 25 to avoid query size limits
  for (let i = 0; i < rows.length; i += 25) {
    await db.insert(schema.entries).values(rows.slice(i, i + 25));
  }

  console.log(`\n✅ Done! ${rows.length} February shifts added for ${rose.name} and ${mikael.name}.`);
  console.log(`   Go to /calendar, navigate back to February 2025 to see them.\n`);

  await pool.end();
}

main().catch(e => {
  console.error("❌ Seed failed:", e);
  process.exit(1);
});
