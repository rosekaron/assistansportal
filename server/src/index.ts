import express from "express";
import cors from "cors";
import path from "path";
import * as dotenv from "dotenv";
dotenv.config();

// Startup guard: refuse to start with missing or insecure JWT secret
if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "dev_secret") {
  console.error("FATAL: JWT_SECRET not set or uses insecure default 'dev_secret'. Aborting.");
  process.exit(1);
}

// Ensure Homebrew binaries (qpdf etc.) are in PATH
process.env.PATH = `/opt/homebrew/bin:${process.env.PATH}`;

import { seedDefaults } from "./db";
import authRoutes            from "./routes/auth";
import profileRoutes         from "./routes/profile";
import assistantRoutes       from "./routes/assistants";
import assistantSelfRoutes   from "./routes/assistant";
import gcalRoutes            from "./routes/gcal";
import entriesRoutes         from "./routes/entries";
import miscRoutes            from "./routes/misc";
import pdfRoutes             from "./routes/pdf";
import costsRoutes           from "./routes/costs";
import absencesRoutes        from "./routes/absences";
import payrollRoutes         from "./routes/payroll";
import paymentsRoutes        from "./routes/payments";
import clockRoutes           from "./routes/clock";

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/forms", express.static(path.join(__dirname, "../../forms")));

app.use("/api/auth",        authRoutes);
app.use("/api/profile",     profileRoutes);
app.use("/api/assistants",  assistantRoutes);
app.use("/api/assistant",   assistantSelfRoutes);
app.use("/api/gcal",        gcalRoutes);
app.use("/api/entries",     entriesRoutes);
app.use("/api",             miscRoutes);
app.use("/api/pdf",         pdfRoutes);
app.use("/api/costs",       costsRoutes);
app.use("/api/absences",    absencesRoutes);
app.use("/api/payroll",    payrollRoutes);
app.use("/api/payments",   paymentsRoutes);
app.use("/api/clock",     clockRoutes);

app.get("/api/health", (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

async function main() {
  await seedDefaults();
  app.listen(PORT, () => {
    console.log(`\n✅  Server running → http://localhost:${PORT}`);
    console.log(`   Postgres       → ${process.env.DATABASE_URL?.split("@")[1] ?? "localhost:5432"}\n`);
  });
}

main().catch(console.error);
