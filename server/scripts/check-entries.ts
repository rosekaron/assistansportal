import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "../src/db/schema";
import * as dotenv from "dotenv";
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db   = drizzle(pool, { schema });

async function main() {
  const all = await db.select().from(schema.entries);
  console.log(`\nTotal entries in DB: ${all.length}`);

  // Specifically check March 2026
  const march = all.filter(e => e.date.startsWith("2026-03"));
  console.log(`March 2026 entries: ${march.length}`);

  if (all.length === 0) {
    console.log("❌ No entries at all — seed did not persist.");
    await pool.end(); return;
  }

  // Show date range
  const dates = all.map(e => e.date).sort();
  console.log(`Date range: ${dates[0]} → ${dates[dates.length - 1]}`);

  // Count by month
  const byMonth: Record<string, number> = {};
  for (const e of all) {
    const key = e.date.slice(0, 7);
    byMonth[key] = (byMonth[key] ?? 0) + 1;
  }
  console.log("\nEntries by month:");
  Object.entries(byMonth).sort().forEach(([m, c]) => console.log(`  ${m}: ${c} entries`));

  // Show first 3 entries with all fields
  console.log("\nFirst 3 entries (raw):");
  all.slice(0, 3).forEach(e => console.log(JSON.stringify(e, null, 2)));

  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
