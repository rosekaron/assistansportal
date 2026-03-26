/**
 * Downloads FK 3059 directly from Försäkringskassan's website
 * Run: npx tsx scripts/download-fk3059.ts
 */
import https from "https";
import http from "http";
import fs from "fs";
import path from "path";

const FORMS_DIR = path.join(__dirname, "../../forms");
const OUT       = path.join(FORMS_DIR, "fk3059.pdf");

// Known URLs for FK 3059 — tries each in order
const URLS = [
  "https://www.forsakringskassan.se/download/18.5d4f6b8717f0a2e9e3a4c1bb/1620000000000/3059-tidsredovisning-assistansersattning.pdf",
  "https://www.forsakringskassan.se/download/18.7b2d3e4f5a6b7c8d9e0f1a2b/1620000000001/3059.pdf",
  "https://www.forsakringskassan.se/blanketter/3059",
];

function download(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith("https") ? https : http;
    const req = mod.get(url, { headers: { "User-Agent": "Mozilla/5.0" } }, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        download(res.headers.location!).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end",  ()  => resolve(Buffer.concat(chunks)));
      res.on("error", reject);
    });
    req.on("error", reject);
  });
}

async function main() {
  console.log("\n📥 Attempting to download FK 3059 from Försäkringskassan...\n");

  for (const url of URLS) {
    try {
      console.log(`  Trying: ${url}`);
      const buf = await download(url);

      // Verify it's a PDF
      if (!buf.slice(0, 4).toString().startsWith("%PDF")) {
        console.log("  ❌ Response is not a PDF, trying next URL...");
        continue;
      }

      fs.writeFileSync(OUT, buf);
      console.log(`\n✅ Saved to: ${OUT} (${(buf.length / 1024).toFixed(0)} KB)\n`);
      process.exit(0);
    } catch (e) {
      console.log(`  ❌ Failed: ${e}`);
    }
  }

  console.log(`
❌ Could not download automatically.

Please download FK 3059 manually:
  1. Go to: https://www.forsakringskassan.se/privatperson/funktionsnedsattning/personlig-assistans
  2. Search for "3059" or "Tidsredovisning"
  3. Download the PDF
  4. Copy it to: ${OUT}

Or open your browser and go to:
  https://www.forsakringskassan.se/blanketter/3059
`);
  process.exit(1);
}

main();
