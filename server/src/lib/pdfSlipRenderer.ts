// pdfSlipRenderer.ts — pdfkit renderer for the anhörig-model salary slip.
//
// Responsibilities:
//   - Draw a single-page A4 lönespecifikation per 09-UI-SPEC §PDF Layout Contract
//   - Consume a fully-populated SlipFields object (no DB, no side effects beyond the
//     returned Buffer; filesystem writes are explicitly prohibited per T-09-11)
//   - Use pdfkit built-in Helvetica family — Task 1 smoke test confirmed WinAnsi
//     encoding covers Å/Ä/Ö/å/ä/ö without glyph substitution
//
// Non-responsibilities:
//   - Formatting numbers (formatKr from payrollSlipUtils handles this)
//   - Resolving employer/representative (builder handles this)
//   - Persistence (endpoint decides what to do with the Buffer)
//
// Logging discipline (T-09-10 mitigation):
//   - No verbose stdout emission — PII leakage risk (pno, bank, salary amounts)
//   - Error-path `console.error("[pdf] slip render error:", e)` is permitted

import PDFDocument from "pdfkit";
import type { SlipFields } from "./payrollSlipUtils";
import { formatKr } from "./payrollSlipUtils";

// ---------------------------------------------------------------------------
// Page geometry (09-UI-SPEC §PDF Layout Contract — A4 595.28 × 841.89 pt, 56 pt margins)
// ---------------------------------------------------------------------------

const PAGE_WIDTH = 595.28;
const MARGIN = 56;
const CONTENT_LEFT = MARGIN;
const CONTENT_RIGHT = PAGE_WIDTH - MARGIN;           // 539.28
const LABEL_WIDTH = 128;                             // 45 mm
const VALUE_X = CONTENT_LEFT + LABEL_WIDTH;          // 184

const MM = 2.834645669;                              // pt per mm

// ---------------------------------------------------------------------------
// Helpers — formatting
// ---------------------------------------------------------------------------

/** Formats a non-negative hours value as "215,0 tim" (comma decimal, one place). */
function formatHoursTim(hours: number): string {
  const str = hours.toFixed(1).replace(".", ",");
  return `${str} tim`;
}

/** Formats the hourly rate for the Grundlön line: "254,10 kr/tim". */
function formatRate(rate: number): string {
  const str = rate.toFixed(2).replace(".", ",");
  return `${str} kr/tim`;
}

// ---------------------------------------------------------------------------
// renderAnhorigSlipPdf
// ---------------------------------------------------------------------------

export function renderAnhorigSlipPdf(fields: SlipFields): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN },
        info: {
          Title: `Lönespecifikation ${fields.documentNumber}`,
          Author: "Kalinga Assistansportal",
        },
      });
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (e) => reject(e));

      // -------------------------------------------------------------------
      // Title row
      // -------------------------------------------------------------------
      doc.font("Helvetica-Bold").fontSize(14)
         .text("LÖNESPECIFIKATION", CONTENT_LEFT, MARGIN, { lineBreak: false });
      doc.font("Helvetica").fontSize(10)
         .text(`Nr: ${fields.documentNumber}`, CONTENT_LEFT, MARGIN + 2, {
           width: CONTENT_RIGHT - CONTENT_LEFT,
           align: "right",
           lineBreak: false,
         });

      let y = MARGIN + 14 + 8 * MM;   // title height + 8 mm gap

      // -------------------------------------------------------------------
      // Header block — label column 45 mm / value column 125 mm, 13 pt leading
      // -------------------------------------------------------------------
      const HEADER_LEADING = 13;
      const drawHeaderRow = (label: string, value: string) => {
        doc.font("Helvetica-Bold").fontSize(10)
           .text(label, CONTENT_LEFT, y, { width: LABEL_WIDTH, lineBreak: false });
        doc.font("Helvetica").fontSize(10)
           .text(value, VALUE_X, y, { width: CONTENT_RIGHT - VALUE_X, lineBreak: false });
        y += HEADER_LEADING;
      };

      // Arbetsgivare — 2 lines (name/pno then address) when address is non-empty
      const employerLine1 = `${fields.employer.name}, ${fields.employer.pno}`;
      drawHeaderRow("Arbetsgivare:", employerLine1);
      if (fields.employer.address) {
        // Second line uses empty label (continuation of the same field)
        doc.font("Helvetica").fontSize(10)
           .text(fields.employer.address, VALUE_X, y, {
             width: CONTENT_RIGHT - VALUE_X,
             lineBreak: false,
           });
        y += HEADER_LEADING;
      }

      // Företrädd av — conditional
      if (fields.representative !== null) {
        drawHeaderRow("Företrädd av:", `${fields.representative.name}, ${fields.representative.pno}`);
      }

      drawHeaderRow("Anställd:",        `${fields.employee.name}, ${fields.employee.pno}`);
      drawHeaderRow("Period:",          fields.reportPeriodLabel);
      drawHeaderRow("Utbetalningsdag:", fields.payDateLabel);
      drawHeaderRow("Utbetalningssätt:", fields.payMethodLabel);
      drawHeaderRow("Avtalsmodell:",    fields.avtalsmodellLabel);

      // Bank — conditional
      if (fields.bankLine !== null) {
        drawHeaderRow("Bank:", fields.bankLine);
      }

      y += 10 * MM - HEADER_LEADING;   // 10 mm gap (minus one leading already applied)

      // -------------------------------------------------------------------
      // Working-time section
      // -------------------------------------------------------------------
      doc.font("Helvetica-Bold").fontSize(11)
         .text("ARBETSTID", CONTENT_LEFT, y, { lineBreak: false });
      y += 11 + 4 * MM;

      const ROW_LEADING = 13;
      const ROW_GAP = 2 * MM;
      const drawAmountRow = (label: string, value: string) => {
        doc.font("Helvetica").fontSize(10)
           .text(label, CONTENT_LEFT, y, { lineBreak: false });
        doc.font("Helvetica").fontSize(10)
           .text(value, CONTENT_LEFT, y, {
             width: CONTENT_RIGHT - CONTENT_LEFT,
             align: "right",
             lineBreak: false,
           });
        y += ROW_LEADING + ROW_GAP;
      };

      drawAmountRow("Arbetade timmar", formatHoursTim(fields.hours.worked));
      drawAmountRow("Sjukfrånvaro",    `${fields.hours.sjuk} dagar`);
      drawAmountRow("VAB",             `${fields.hours.vab} dagar (år till dato: ${fields.hours.vabYtdUsed}/120)`);
      drawAmountRow("Semester",        `${fields.hours.semester} dagar (tagna i år: ${fields.hours.semester})`);
      drawAmountRow("Annan frånvaro",  `${fields.hours.other} dagar`);

      y += 8 * MM - ROW_GAP;

      // -------------------------------------------------------------------
      // LÖN section
      // -------------------------------------------------------------------
      doc.font("Helvetica-Bold").fontSize(11)
         .text("LÖN", CONTENT_LEFT, y, { lineBreak: false });
      y += 11 + 4 * MM;

      const drawKrRow = (label: string, amount: number, suffix = "") => {
        doc.font("Helvetica").fontSize(10)
           .text(label, CONTENT_LEFT, y, { lineBreak: false });
        doc.font("Helvetica").fontSize(10)
           .text(`${formatKr(amount)}${suffix}`, CONTENT_LEFT, y, {
             width: CONTENT_RIGHT - CONTENT_LEFT,
             align: "right",
             lineBreak: false,
           });
        y += ROW_LEADING + ROW_GAP;
      };

      const grundlonLabel = `Grundlön ${formatHoursTim(fields.hours.worked).replace(" tim", "")} × ${formatRate(fields.hourlyRate)}`;
      drawKrRow(grundlonLabel, fields.lön.gross);
      drawKrRow("Sjuklön",     fields.lön.sjukLön,     " *");
      drawKrRow("VAB-lön",     fields.lön.vabLön,      " *");
      drawKrRow("Semesterlön", fields.lön.semesterLön, " *");

      // Thin horizontal rule
      y += 1 * MM;
      doc.lineWidth(0.3)
         .moveTo(CONTENT_LEFT, y).lineTo(CONTENT_RIGHT, y).stroke();
      y += 2 * MM;

      // BRUTTOLÖN bold row
      doc.font("Helvetica-Bold").fontSize(10)
         .text("BRUTTOLÖN", CONTENT_LEFT, y, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(10)
         .text(formatKr(fields.lön.bruttoLön), CONTENT_LEFT, y, {
           width: CONTENT_RIGHT - CONTENT_LEFT,
           align: "right",
           lineBreak: false,
         });
      y += 14 + 8 * MM;

      // -------------------------------------------------------------------
      // Deductions section
      // -------------------------------------------------------------------
      doc.font("Helvetica-Bold").fontSize(11)
         .text("AVDRAG", CONTENT_LEFT, y, { lineBreak: false });
      y += 11 + 4 * MM;

      const ratePct = Math.round(fields.avdrag.prelimSkattRate * 100);
      drawKrRow(`Preliminärskatt ${ratePct}% (schablon)`, fields.avdrag.prelimSkatt);

      // Thin rule + net-to-bank bold row
      y += 1 * MM;
      doc.lineWidth(0.3)
         .moveTo(CONTENT_LEFT, y).lineTo(CONTENT_RIGHT, y).stroke();
      y += 2 * MM;

      doc.font("Helvetica-Bold").fontSize(10)
         .text("NETTO TILL BANK", CONTENT_LEFT, y, { lineBreak: false });
      doc.font("Helvetica-Bold").fontSize(10)
         .text(formatKr(fields.avdrag.nettoTillBank), CONTENT_LEFT, y, {
           width: CONTENT_RIGHT - CONTENT_LEFT,
           align: "right",
           lineBreak: false,
         });
      y += 14 + 10 * MM;

      // -------------------------------------------------------------------
      // Footer — asterisk explanation
      // -------------------------------------------------------------------
      doc.font("Helvetica-Oblique").fontSize(9)
         .fillColor("#4C4C4C")
         .text(
           "* Ingen ersättning vid sjukdom, VAB eller semester enligt överenskommelse (anhörigmodell).",
           CONTENT_LEFT, y,
           { width: CONTENT_RIGHT - CONTENT_LEFT },
         );

      doc.end();
    } catch (e) {
      console.error("[pdf] slip render error:", e);
      reject(e);
    }
  });
}
