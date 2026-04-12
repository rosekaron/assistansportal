import { Router } from "express";
import { PDFDocument } from "pdf-lib";
import { spawnSync } from "child_process";
import { db } from "../db";
import { entries, assistants, profile, absences, payrollRecords } from "../db/schema";
import { eq, and, gte, lte, or, isNull } from "drizzle-orm";
import { buildForm4805Fields, Form4805Input } from "../lib/form4805-utils";
import { requireAuth, requireGuardian, AuthRequest } from "../middleware/auth";
import { filterBillableEntries } from "../lib/absence-utils";
import path from "path";
import fs from "fs";
import os from "os";

const router = Router();

// Resolve forms/ directory
const FORMS_DIR = (() => {
  const candidates = [
    path.join(__dirname, "../../../forms"),
    path.join(__dirname, "../../forms"),
    path.join(process.cwd(), "../forms"),
    path.join(process.cwd(), "forms"),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) { console.log("📁 Forms dir:", c); return c; }
  }
  console.warn("⚠️  forms/ not found");
  return candidates[0];
})();

async function decryptAndFill(formPath: string, fields: Record<string, string>): Promise<Buffer> {
  const tmpOut = path.join(os.tmpdir(), `fk_decrypted_${Date.now()}.pdf`);

  try {
    // Decrypt using qpdf (via node-qpdf2) — handles owner-password-only FK forms
    const result = spawnSync("qpdf", ["--decrypt", formPath, tmpOut]);
    if (result.status !== 0) {
      throw new Error(`qpdf: ${result.stderr?.toString() ?? result.stdout?.toString()}`);
    }

    const formBytes = fs.readFileSync(tmpOut);
    const pdfDoc    = await PDFDocument.load(formBytes);
    const form      = pdfDoc.getForm();

    for (const [name, value] of Object.entries(fields)) {
      try { form.getTextField(name).setText(value); } catch { /* skip unknown field */ }
    }

    form.flatten();
    return Buffer.from(await pdfDoc.save());
  } finally {
    try { fs.unlinkSync(tmpOut); } catch {}
  }
}

// ── FK 3059 Tidsredovisning — one PDF per assistant ───────────
router.post("/fk3059", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { year, month, assistantId } = req.body as {
      year: string; month: string; assistantId: string;
    };

    const formPath = path.join(FORMS_DIR, "fk3059.pdf");
    if (!fs.existsSync(formPath)) {
      return res.status(404).json({ error: "fk3059.pdf not found in forms/ directory" });
    }

    const mm    = month.padStart(2, "0");
    const start = `${year}-${mm}-01`;
    const daysInMonth = new Date(parseInt(year), parseInt(mm), 0).getDate();
    const end   = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;

    const [prof] = await db.select().from(profile).limit(1);
    const [asst] = await db.select().from(assistants).where(eq(assistants.id, assistantId));
    if (!asst) return res.status(404).json({ error: "Assistant not found" });

    const monthEntries = await db.select().from(entries)
      .where(and(
        eq(entries.assistantId, assistantId),
        gte(entries.date, start),
        lte(entries.date, end),
        eq(entries.reqStatus, "approved"),
      ))
      .orderBy(entries.date, entries.startTime);

    // Fetch absences covering this month for this assistant (including null-assistantId)
    // LEAV-02: exclude entries whose date falls within any absence range
    const monthAbsences = await db.select({
      assistantId: absences.assistantId,
      startDate:   absences.startDate,
      endDate:     absences.endDate,
      absenceType: absences.absenceType,
    }).from(absences).where(
      and(
        or(
          eq(absences.assistantId, assistantId),
          isNull(absences.assistantId),
        ),
        lte(absences.startDate, end),
        gte(absences.endDate, start),
      )
    );

    const billableEntries = filterBillableEntries(monthEntries, monthAbsences);

    // ── Build field map ───────────────────────────────────────
    const fields: Record<string, string> = {};

    // Page 1 — year/month
    fields["form1[0].#subform[0].flt_txtAr1[0]"] = year[0] ?? "";
    fields["form1[0].#subform[0].flt_txtAr2[0]"] = year[1] ?? "";
    fields["form1[0].#subform[0].flt_txtAr3[0]"] = year[2] ?? "";
    fields["form1[0].#subform[0].flt_txtAr4[0]"] = year[3] ?? "";
    fields["form1[0].#subform[0].flt_txtMan1[0]"] = mm[0];
    fields["form1[0].#subform[0].flt_txtMan2[0]"] = mm[1];

    // Section 1: Patient
    fields["form1[0].#subform[0].flt_txtFnamnEnamnBrukare[0]"] = prof?.patientName ?? "";
    fields["form1[0].#subform[0].kundPnr[0]"]                  = prof?.patientPno  ?? "";

    // Section 2: Assistant
    fields["form1[0].#subform[0].flt_txtFnamnEnamnAssistent[0]"] = asst.name;
    fields["form1[0].#subform[0].flt_txtPersonNrAssistent[0]"]   = asst.pno ?? "";

    // Section 4: Calculation period
    fields["form1[0].#subform[0].flt_datmod6_1[0]"] = start;
    fields["form1[0].#subform[0].flt_datmod6_2[0]"] = end;

    // Section 5: Guardian / employer
    fields["form1[0].#subform[0].flt_txtNamnAnordnaren[0]"] = prof?.guardianName  ?? "";
    fields["form1[0].#subform[0].flt_txtKontaktperson[0]"]  = prof?.guardianName  ?? "";
    fields["form1[0].#subform[0].flt_txtTelefon1[0]"]       = prof?.guardianPhone ?? "";

    // Section 6: Employer signature
    const today = new Date().toLocaleDateString("sv-SE");
    fields["form1[0].#subform[0].flt_datUl2[0]"]          = today;
    fields["form1[0].#subform[0].flt_txtNamnteckning2[0]"] = prof?.guardianName ?? "";

    // Page headers
    const arManad = `${year}-${mm}`;
    fields["form1[0].#subform[10].flt_txtArManad[0]"]  = arManad;
    fields["form1[0].#subform[10].kundPnr[1]"]         = prof?.patientPno ?? "";
    fields["form1[0].#subform[16].flt_txtArManad[1]"]  = arManad;
    fields["form1[0].#subform[16].kundPnr[2]"]         = prof?.patientPno ?? "";

    // ── Shift rows ────────────────────────────────────────────
    // 80 slots across 4 columns × 20 rows
    const slots = [
      ...Array.from({ length: 20 }, (_, i) => ({
        dag: `form1[0].#subform[10].raderVanster[0].rad[${i}].flt_txtDag1[0]`,
        kl1: `form1[0].#subform[10].raderVanster[0].rad[${i}].flt_txtKlocka1[0]`,
        kl2: `form1[0].#subform[10].raderVanster[0].rad[${i}].flt_txtKlocka2[0]`,
      })),
      ...Array.from({ length: 20 }, (_, i) => ({
        dag: `form1[0].#subform[10].raderHoger[0].rad[${i}].flt_txtDag1[0]`,
        kl1: `form1[0].#subform[10].raderHoger[0].rad[${i}].flt_txtKlocka1[0]`,
        kl2: `form1[0].#subform[10].raderHoger[0].rad[${i}].flt_txtKlocka2[0]`,
      })),
      ...Array.from({ length: 20 }, (_, i) => ({
        dag: `form1[0].#subform[16].raderVanster[1].rad[${i}].flt_txtDag1[0]`,
        kl1: `form1[0].#subform[16].raderVanster[1].rad[${i}].flt_txtKlocka1[0]`,
        kl2: `form1[0].#subform[16].raderVanster[1].rad[${i}].flt_txtKlocka2[0]`,
      })),
      ...Array.from({ length: 20 }, (_, i) => ({
        dag: `form1[0].#subform[16].raderHoger[1].rad[${i}].flt_txtDag1[0]`,
        kl1: `form1[0].#subform[16].raderHoger[1].rad[${i}].flt_txtKlocka1[0]`,
        kl2: `form1[0].#subform[16].raderHoger[1].rad[${i}].flt_txtKlocka2[0]`,
      })),
    ];

    // Totals per type (active=1, waiting=2, standby=3)
    const totMins = { active: 0, waiting: 0, standby: 0 };

    for (let i = 0; i < Math.min(billableEntries.length, slots.length); i++) {
      const e    = billableEntries[i];
      const slot = slots[i];
      const day  = String(parseInt(e.date.split("-")[2])); // "3" not "03"

      fields[slot.dag] = day;
      fields[slot.kl1] = e.startTime;
      fields[slot.kl2] = e.endTime;

      const type = (e.entryType ?? "active") as keyof typeof totMins;
      totMins[type] += Math.round((e.hours ?? 0) * 60);
    }

    function hm(mins: number) {
      return { h: Math.floor(mins / 60), m: mins % 60 };
    }
    const { h: h1, m: m1 } = hm(totMins.active);
    const { h: h2, m: m2 } = hm(totMins.waiting);
    const { h: h3, m: m3 } = hm(totMins.standby);

    // Totals — row 1 = active, row 2 = waiting (väntetid), row 3 = standby (beredskap)
    fields["form1[0].#subform[16].flt_numSummaTimmar1[0]"]  = String(h1);
    fields["form1[0].#subform[16].flt_numSummaMinuter1[0]"] = String(m1).padStart(2, "0");
    fields["form1[0].#subform[16].flt_numSummaTimmar2[0]"]  = String(h2);
    fields["form1[0].#subform[16].flt_numSummaMinuter2[0]"] = String(m2).padStart(2, "0");
    fields["form1[0].#subform[16].flt_numSummaTimmar3[0]"]  = String(h3);
    fields["form1[0].#subform[16].flt_numSummaMinuter3[0]"] = String(m3).padStart(2, "0");

    // All hours are logged as aktiv tid — always mark the aktiv tid checkbox
    fields["form1[0].#subform[16].ksr_aktivTid[0]"] = "Yes";

    // Section 8: assistant signs — leave date blank, pre-fill phone
    fields["form1[0].#subform[16].flt_txtTelefon2[0]"] = asst.phone ?? "";

    // ── Fill and send ─────────────────────────────────────────
    const filledBytes = await decryptAndFill(formPath, fields);
    const filename    = `FK3059-${year}-${mm}-${asst.name.replace(/\s+/g, "-")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(filledBytes);

  } catch (e) {
    console.error("[pdf] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── FK 3057 Räkning ───────────────────────────────────────────
router.post("/fk3057", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { year, month } = req.body as { year: string; month: string };
    const formPath = path.join(FORMS_DIR, "fk3057.pdf");

    if (!fs.existsSync(formPath)) {
      return res.status(404).json({ error: "fk3057.pdf not found in forms/" });
    }

    const [prof] = await db.select().from(profile).limit(1);
    const mm = month.padStart(2, "0");
    const daysInMonth = new Date(parseInt(year), parseInt(mm), 0).getDate();

    const monthEntries = await db.select().from(entries)
      .where(and(
        gte(entries.date, `${year}-${mm}-01`),
        lte(entries.date, `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`),
        eq(entries.reqStatus, "approved"),
        eq(entries.repStatus, "approved"),
      ));

    // Fetch all absences covering this month for FK 3057 (all assistants, all absence types)
    // LEAV-02: exclude entries whose date falls within any absence range
    // NOTE: FK 3057 absence query is not scoped by guardianId because the entries table
    // is also unscoped (single-tenant design per RESEARCH.md Pitfall 6). This is a known
    // v1 single-tenant assumption — tracked for MULTI-01 in a future multi-tenant phase.
    const fk3057Start = `${year}-${mm}-01`;
    const fk3057End   = `${year}-${mm}-${String(daysInMonth).padStart(2, "0")}`;
    const allAbsences = await db.select({
      assistantId: absences.assistantId,
      startDate:   absences.startDate,
      endDate:     absences.endDate,
      absenceType: absences.absenceType,
    }).from(absences).where(
      and(
        lte(absences.startDate, fk3057End),
        gte(absences.endDate, fk3057Start),
      )
    );

    const billableFk3057 = filterBillableEntries(monthEntries, allAbsences);
    const totalHours  = billableFk3057.reduce((s, e) => s + (e.hours ?? 0), 0);
    const totalMins   = Math.round((totalHours % 1) * 60);
    const totalHrsInt = Math.floor(totalHours);

    const formBytes = fs.readFileSync(formPath);
    const pdfDoc    = await PDFDocument.load(formBytes, { ignoreEncryption: true });
    const form      = pdfDoc.getForm();

    const sf = (name: string, value: string) => {
      try { form.getTextField(name).setText(value); } catch {}
    };

    sf("form1[0].#subform[0].flt_txtAr1[0]",  year[0] ?? "");
    sf("form1[0].#subform[0].flt_txtAr2[0]",  year[1] ?? "");
    sf("form1[0].#subform[0].flt_txtAr3[0]",  year[2] ?? "");
    sf("form1[0].#subform[0].flt_txtAr4[0]",  year[3] ?? "");
    sf("form1[0].#subform[0].flt_txtMan1[0]", mm[0]);
    sf("form1[0].#subform[0].flt_txtMan2[0]", mm[1]);
    sf("form1[0].#subform[0].flt_txtFnamnEnamnBrukare[0]", prof?.patientName ?? "");
    sf("form1[0].#subform[0].flt_txtPersonNrBrukare[0]",   prof?.patientPno  ?? "");
    sf("form1[0].#subform[0].flt_numaktivtid_tim[0]",      String(totalHrsInt));
    sf("form1[0].#subform[0].flt_numaktivtid_min[0]",      String(totalMins).padStart(2, "0"));

    const today = new Date().toLocaleDateString("sv-SE");
    sf("form1[0].#subform[0].flt_datum[0]",           today);
    sf("form1[0].#subform[0].flt_txtNamnteckning[0]", prof?.guardianName  ?? "");
    sf("form1[0].#subform[0].flt_txtTel[0]",          prof?.guardianPhone ?? "");

    form.flatten();
    const filledBytes = await pdfDoc.save();

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="FK3057-${year}-${mm}.pdf"`);
    res.send(Buffer.from(filledBytes));
  } catch (e) {
    console.error("[pdf] error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── List available forms ──────────────────────────────────────
router.get("/forms", requireAuth, requireGuardian, (_req: AuthRequest, res) => {
  const available = ["fk3057.pdf", "fk3059.pdf"].map(name => ({
    name,
    exists: fs.existsSync(path.join(FORMS_DIR, name)),
  }));
  res.json(available);
});

// ── Blankett 4805 Förenklad arbetsgivardeklaration ───────────────────────
router.post("/4805", requireAuth, requireGuardian, async (req: AuthRequest, res) => {
  try {
    const { year, month, assistantId } = req.body as {
      year: string; month: string; assistantId: string;
    };

    // SECURITY: validate assistantId is a non-empty string containing only
    // alphanumeric chars and hyphens to prevent path traversal / injection
    if (!assistantId || !/^[a-zA-Z0-9_-]+$/.test(assistantId)) {
      return res.status(400).json({ error: "Invalid assistantId" });
    }

    const mm        = month.padStart(2, "0");
    const yearMonth = `${year}-${mm}`;

    const formPath = path.join(FORMS_DIR, "skv4805.pdf");
    if (!fs.existsSync(formPath)) {
      return res.status(404).json({ error: "skv4805.pdf not found in forms/ directory" });
    }

    // Fetch assistant
    const [asst] = await db.select().from(assistants).where(eq(assistants.id, assistantId));
    if (!asst) return res.status(404).json({ error: "Assistant not found" });

    // Fetch approved payroll record for this assistant + month (D-07: only approved)
    const [pr] = await db.select().from(payrollRecords).where(
      and(
        eq(payrollRecords.assistantId, assistantId),
        eq(payrollRecords.month, yearMonth),
        eq(payrollRecords.status, "approved"),
      )
    );
    if (!pr) {
      return res.status(409).json({
        error: "Payroll record not found or not approved for this assistant and month. Approve payroll before generating 4805.",
      });
    }

    // Fetch guardian profile
    const [prof] = await db.select().from(profile).limit(1);

    // Build field map
    const input: Form4805Input = {
      yearMonth,
      profile: {
        guardianName:  prof?.guardianName  ?? "",
        guardianPno:   prof?.guardianPno   ?? "",
        guardianPhone: prof?.guardianPhone ?? "",
        address:       prof?.address       ?? "",
        city:          prof?.city          ?? "",
        zip:           prof?.zip           ?? "",
      },
      assistant: {
        name:    asst.name,
        pno:     asst.pno     ?? "",
        address: asst.address ?? "",
      },
      payrollRecord: {
        grossPay:              pr.grossPay,
        employerContributions: pr.employerContributions,
        prelimTaxRateSnapshot: pr.prelimTaxRateSnapshot ?? 0,
      },
    };
    const fieldMap = buildForm4805Fields(input);

    // Load and fill the 4805 PDF (unencrypted AcroForm — no qpdf needed)
    const formBytes = fs.readFileSync(formPath);
    const pdfDoc    = await PDFDocument.load(formBytes, { ignoreEncryption: true });
    const form      = pdfDoc.getForm();
    const allFields = form.getFields();

    // Handle regular unique fields
    for (const [name, value] of Object.entries(fieldMap)) {
      if (name.startsWith("__employer__") || name.startsWith("__recipient__")) continue;
      try { form.getTextField(name).setText(value); } catch { /* skip unknown */ }
    }

    // Handle duplicate-named fields (employer = index 0, recipient = index 1)
    const dupNames = ["txtNamn[0]", "txtPersNr[0]", "txtAdress[0]"] as const;
    for (const leafName of dupNames) {
      const matches = allFields.filter(f => f.getName().endsWith(leafName));
      const empKey  = `__employer__${leafName}`;
      const recKey  = `__recipient__${leafName}`;
      if (matches[0] && fieldMap[empKey] !== undefined) {
        try { (matches[0] as ReturnType<typeof form.getTextField>).setText(fieldMap[empKey]!); } catch {}
      }
      if (matches[1] && fieldMap[recKey] !== undefined) {
        try { (matches[1] as ReturnType<typeof form.getTextField>).setText(fieldMap[recKey]!); } catch {}
      }
    }

    form.flatten();
    const filledBytes = await pdfDoc.save();
    const filename    = `4805-${yearMonth}-${asst.name.replace(/\s+/g, "-")}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(Buffer.from(filledBytes));

  } catch (e) {
    console.error("[pdf] 4805 error:", e);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
