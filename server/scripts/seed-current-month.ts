/**
 * Seed script — adds mock schedule data for the CURRENT month
 * for Rose and Mikael: ~30h/week each
 *
 * Run: npx tsx scripts/seed-current-month.ts
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

const SHIFTS: [number, number][] = [
  [7,3],[7,4],[8,3],[8,4],[10,3],[10,4],
  [12,4],[14,4],[16,4],[18,4],[7,6],[14,6],
];

function pad(n: number) { return String(n % 24).padStart(2,"0"); }
function hhmm(h: number) { return `${pad(h)}:00`; }
function newId() { return `e_${Date.now()}_${Math.random().toString(36).slice(2,8)}`; }
function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random()*arr.length)]; }

function monthDates(year: number, month: number): string[] {
  const days = new Date(year, month + 1, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= days; d++) out.push(`${year}-${pad(d > 9 ? d : d)}-${String(d).padStart(2,"0")}`);
  // Fix: proper padding
  return Array.from({length: days}, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  });
}

function toWeeks(dates: string[]): string[][] {
  const weeks: string[][] = [];
  let week: string[] = [];
  for (const d of dates) {
    week.push(d);
    if (new Date(d).getDay() === 0 || d === dates.at(-1)) {
      weeks.push(week); week = [];
    }
  }
  if (week.length) weeks.push(week);
  return weeks;
}

async function main() {
  const now   = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth(); // 0-indexed

  const monthName = now.toLocaleString("en-GB", { month: "long" });
  console.log(`\n🗓  Seeding ${monthName} ${year}\n`);

  const all = await db.select().from(schema.assistants);
  if (!all.length) { console.error("❌ No assistants found. Add them first."); process.exit(1); }

  console.log("Available assistants:");
  all.forEach(a => console.log(`  - ${a.name} (${a.id})`));
  console.log("");

  const rose   = all.find(a => a.name.toLowerCase().includes("rose"));
  const mikael = all.find(a => a.name.toLowerCase().includes("mikael"));

  if (!rose)   { console.error(`❌ "Rose" not found`);   process.exit(1); }
  if (!mikael) { console.error(`❌ "Mikael" not found`); process.exit(1); }

  console.log(`✅ ${rose.name}   → ${rose.id}`);
  console.log(`✅ ${mikael.name} → ${mikael.id}\n`);

  const weeks = toWeeks(monthDates(year, month));
  const rows: typeof schema.entries.$inferInsert[] = [];

  for (const week of weeks) {
    for (const asst of [rose, mikael]) {
      let total = 0;
      const target = 30;
      const days = [...week].sort(() => Math.random() - 0.5);

      for (const date of days) {
        if (total >= target) break;
        const remaining = target - total;
        const eligible = SHIFTS.filter(([,dur]) => dur <= remaining + 1);
        if (!eligible.length) break;

        const [startH, dur] = pick(eligible);
        const reqStatus = Math.random() < 0.65 ? "approved" : "pending";
        const repStatus = reqStatus === "approved" && Math.random() < 0.5 ? "pending" : "draft";
        const calStatus = reqStatus === "approved" ? "confirmed" : "tentative";

        rows.push({
          id:          newId(),
          assistantId: asst.id,
          date,
          startTime:   hhmm(startH),
          endTime:     hhmm(startH + dur),
          hours:       dur,
          reqStatus:   reqStatus as "pending" | "approved",
          repStatus:   repStatus as "draft" | "pending",
          source:      "proposal",
          calStatus:   calStatus as "tentative" | "confirmed",
          activityId:  pick(ACTIVITIES),
        });
        total += dur;
      }
      console.log(`  ${asst.name.padEnd(14)} week of ${week[0]}: ${total}h`);
    }
  }

  console.log(`\n⬆️  Inserting ${rows.length} shifts...`);
  for (let i = 0; i < rows.length; i += 25) {
    await db.insert(schema.entries).values(rows.slice(i, i + 25));
  }

  console.log(`\n✅ Done! ${rows.length} shifts added for ${monthName} ${year}.`);
  console.log(`   Open FK Reports → ${monthName} ${year} to see them.\n`);
  await pool.end();
}

main().catch(e => { console.error("❌", e); process.exit(1); });
