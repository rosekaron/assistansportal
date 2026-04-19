// payrollSlipUtils.ts — Pure builder for the anhörig-model salary slip (lönespecifikation).
//
// Responsibilities (pure, no DB / no pdfkit / no fs / no Date.now):
//   - Assemble a SlipFields object from:
//       * frozen payroll_records snapshot values (SLIP-07 — authoritative numbers)
//       * absences filtered to the report month (per-type day counts + VAB YTD)
//       * employer representation resolved via Phase 8 helper at report-period-end
//   - Emit Swedish currency + date strings for downstream pdfkit renderer
//
// Non-responsibilities (belong to Plan 09-03 endpoints):
//   - Allocating document_number sequences
//   - Computing pay_date from profile.defaultPayDay
//   - Gating on status='approved' or null hourlyRateOverride
//   - Writing to payment_slips table
//
// Locked decisions honored:
//   D-01  Layout is plain text, no branding
//   D-02  Hardcoded avtalsmodellLabel "Anhörigassistans (fast timlön, ej sjuk/sem)"
//   D-12  Builder trusts hourly_rate_override (endpoint gates NULL; Pitfall 2 fallback)
//   SLIP-03  No employer-side contributions or total cost fields on slip output;
//            table-based progressive tax deferred to v1.4 (snapshot flat rate only)
//   SLIP-04  Representative resolved via Phase 8 helper at reportPeriodEnd (Pitfall 1)
//   SLIP-07  grossPay consumed from snapshot — never recomputed

import { resolveEmployerRepresentation } from "./employer-representation";
import { vabBalance, type AbsenceRow } from "./absence-utils";

// ---------------------------------------------------------------------------
// SlipFields output type
// ---------------------------------------------------------------------------

export type SlipFields = {
  documentNumber: string;           // "LS-2026-03-001"
  reportPeriodLabel: string;        // "1 mars – 31 mars 2026"
  payDateLabel: string;             // "25 april 2026"
  payMethodLabel: string;           // "Bankgiro" | "Swish" | "Kontant"
  avtalsmodellLabel: string;        // D-02 hardcoded
  employer: { name: string; pno: string; address: string };
  representative: { name: string; pno: string } | null;   // D-02 conditional
  employee: { name: string; pno: string };
  bankLine: string | null;          // null = omit row entirely
  hourlyRate: number;               // effective rate (override preferred; Pitfall 2 fallback)
  hours: {
    worked: number;
    sjuk: number;        // DAYS
    vab: number;         // DAYS
    semester: number;    // DAYS
    other: number;       // DAYS
    vabYtdUsed: number;  // DAYS, 0–120
  };
  lön: {
    gross: number;       // Grundlön — hours.worked × hourlyRate
    sjukLön: number;     // always 0 in anhörig model
    vabLön: number;      // always 0
    semesterLön: number; // always 0
    bruttoLön: number;   // = payrollRecord.grossPay (SLIP-07 snapshot)
  };
  avdrag: {
    prelimSkatt: number;      // signed negative
    prelimSkattRate: number;  // 0.30 etc
    nettoTillBank: number;    // = bruttoLön + prelimSkatt (signed)
  };
};

// ---------------------------------------------------------------------------
// Narrow input interfaces (subset of drizzle-inferred row types)
// ---------------------------------------------------------------------------

export type ProfileLike = {
  patientName: string | null;
  patientPno: string | null;
  guardianName: string | null;
  guardianPno: string | null;
  patientRequiresRepresentative: boolean | null;
  address: string | null;
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
};

export type AssistantLike = {
  id: string;
  name: string;
  pno: string | null;
  bankClearing: string | null;
  bankAccount: string | null;
  iban: string | null;
  salaryModel: "anhörig" | "fremia" | "custom" | null;
  hourlyRateOverride: number | null;
  paymentMethod: "bankgiro" | "swish" | "kontant" | null;
};

export type PayrollRecordLike = {
  id: string;
  assistantId: string;
  month: string;                                              // "YYYY-MM"
  billableHours: number;
  grossPay: number;                                           // SLIP-07 frozen
  prelimTaxRateSnapshot: number | null;
  salaryModelUsed: "anhörig" | "fremia" | "custom" | null;
  hourlyRateUsed: number | null;
};

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

const krFmt = new Intl.NumberFormat("sv-SE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: true,
});

/**
 * Formats a kronor value as "54 631,50 kr" (regular space thousands, comma decimal).
 * Negative values use U+2212 (MINUS SIGN) rather than ASCII hyphen.
 * Intl.NumberFormat for sv-SE uses U+00A0 NBSP as group separator — we normalise to
 * regular space because the renderer and tests treat it as a plain space.
 */
export function formatKr(n: number): string {
  const abs = krFmt.format(Math.abs(n)).replace(/\u00A0/g, " ");
  return n < 0 ? `\u2212${abs} kr` : `${abs} kr`;
}

const monthNameFmt = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "long",
});

const fullDateFmt = new Intl.DateTimeFormat("sv-SE", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Counts calendar days within [monthStart, monthEnd] for a given assistant and absence
 * type. Mirrors absence-utils.clippedDays() but clips to month bounds.
 * Includes absences with null assistantId (Phase 2 public-holiday convention).
 */
function absenceDaysInMonthByType(
  absences: AbsenceRow[],
  assistantId: string,
  year: number,
  month: number,                                              // 1–12
  type: AbsenceRow["absenceType"],
): number {
  const mm = String(month).padStart(2, "0");
  const monthStart = `${year}-${mm}-01`;
  // 0th day of next month = last day of current month
  const lastDate = new Date(year, month, 0).getDate();
  const monthEnd = `${year}-${mm}-${String(lastDate).padStart(2, "0")}`;

  return absences
    .filter(a =>
      a.absenceType === type &&
      (a.assistantId === assistantId || a.assistantId === null) &&
      a.startDate <= monthEnd &&
      a.endDate   >= monthStart
    )
    .reduce((sum, a) => {
      const clippedStart = a.startDate < monthStart ? monthStart : a.startDate;
      const clippedEnd   = a.endDate   > monthEnd   ? monthEnd   : a.endDate;
      const msPerDay = 86_400_000;
      const days = Math.round(
        (new Date(clippedEnd).getTime() - new Date(clippedStart).getTime()) / msPerDay
      ) + 1;
      return sum + Math.max(0, days);
    }, 0);
}

/**
 * Formats bank details per 09-UI-SPEC §PDF Layout Contract §Bank line conditional:
 *   - All three empty/null → null (row omitted)
 *   - bankClearing + bankAccount only → "Bankgiro {clearing}-{account}"
 *   - iban only → "IBAN {iban}"
 *   - All three set → "{clearing}-{account} (IBAN {iban})"
 * Single-field edge cases (clearing without account, or account without clearing)
 * fall through to IBAN-only or null since there isn't a well-defined bankgiro string
 * with only half the pair.
 */
function formatBankLine(a: AssistantLike): string | null {
  const clearing = (a.bankClearing ?? "").trim();
  const account  = (a.bankAccount ?? "").trim();
  const iban     = (a.iban ?? "").trim();

  const hasBg = !!clearing && !!account;

  if (hasBg && iban) return `${clearing}-${account} (IBAN ${iban})`;
  if (hasBg)         return `Bankgiro ${clearing}-${account}`;
  if (iban)          return `IBAN ${iban}`;
  return null;
}

const payMethodLabels: Record<"bankgiro" | "swish" | "kontant", string> = {
  bankgiro: "Bankgiro",
  swish:    "Swish",
  kontant:  "Kontant",
};

// ---------------------------------------------------------------------------
// Main builder
// ---------------------------------------------------------------------------

export function buildAnhorigSlip(input: {
  profile: ProfileLike;
  assistant: AssistantLike;
  payrollRecord: PayrollRecordLike;
  absences: AbsenceRow[];
  documentNumber: string;
  payDate: string;                                             // "YYYY-MM-DD"
  payMethod: "bankgiro" | "swish" | "kontant";
}): SlipFields {
  const { profile, assistant, payrollRecord, absences, documentNumber, payDate, payMethod } = input;

  // Parse report month → derive period start/end (last day of month).
  const [yearStr, monthStr] = payrollRecord.month.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);   // 1–12
  // new Date(year, month, 0) = last day of `month` (JS months are 0-indexed so `month`
  // here is the NEXT month; day 0 rolls back one day → end-of-reported-month).
  const reportPeriodEnd = new Date(year, month, 0);
  const reportPeriodStart = new Date(year, month - 1, 1);

  // SLIP-04: employer + representative resolved at reportPeriodEnd (Pitfall 1).
  const rep = resolveEmployerRepresentation(profile, reportPeriodEnd);

  // Effective hourly rate: prefer live override (D-12). Fallback to snapshot when
  // override is null, but also when snapshot itself is 0 (legacy pre-Phase-7 rows)
  // defer to override regardless — per Pitfall 2.
  const override = assistant.hourlyRateOverride;
  const snapshot = payrollRecord.hourlyRateUsed ?? 0;
  const hourlyRate = override != null
    ? override
    : (snapshot || 0);

  const hoursWorked = payrollRecord.billableHours;
  const grossGrundlon = round2(hoursWorked * hourlyRate);
  const bruttoLon = round2(payrollRecord.grossPay);
  const prelimRate = payrollRecord.prelimTaxRateSnapshot ?? 0;
  const prelimSkatt = -round2(bruttoLon * prelimRate);
  const nettoTillBank = round2(bruttoLon + prelimSkatt);

  // Absence day-counts (in-month; DAYS, not hours).
  const sjukDays     = absenceDaysInMonthByType(absences, assistant.id, year, month, "sjukfrånvaro");
  const vabDays      = absenceDaysInMonthByType(absences, assistant.id, year, month, "vab");
  const semesterDays = absenceDaysInMonthByType(absences, assistant.id, year, month, "semester");
  const otherDays    = absenceDaysInMonthByType(absences, assistant.id, year, month, "other");

  // VAB YTD used: invert absence-utils.vabBalance() (returns REMAINING).
  const vabRemaining = vabBalance(absences, assistant.id, year);
  const vabYtdUsed = 120 - vabRemaining;

  // Report period label: "1 mars – 31 mars 2026" (en-dash U+2013).
  const startPiece = monthNameFmt.format(reportPeriodStart);   // "1 mars"
  const endPiece   = monthNameFmt.format(reportPeriodEnd);     // "31 mars"
  const reportPeriodLabel = `${startPiece} \u2013 ${endPiece} ${year}`;

  // Pay date label: parse YYYY-MM-DD → "25 april 2026".
  const [pYear, pMonth, pDay] = payDate.split("-").map(n => parseInt(n, 10));
  const payDateLabel = fullDateFmt.format(new Date(pYear, pMonth - 1, pDay));

  return {
    documentNumber,
    reportPeriodLabel,
    payDateLabel,
    payMethodLabel: payMethodLabels[payMethod],
    avtalsmodellLabel: "Anhörigassistans (fast timlön, ej sjuk/sem)",
    employer: rep.arbetsgivare,
    representative: rep.företrädare,
    employee: {
      name: assistant.name,
      pno:  assistant.pno ?? "",
    },
    bankLine: formatBankLine(assistant),
    hourlyRate,
    hours: {
      worked: hoursWorked,
      sjuk: sjukDays,
      vab: vabDays,
      semester: semesterDays,
      other: otherDays,
      vabYtdUsed,
    },
    lön: {
      gross: grossGrundlon,
      sjukLön: 0,
      vabLön: 0,
      semesterLön: 0,
      bruttoLön: bruttoLon,
    },
    avdrag: {
      prelimSkatt,
      prelimSkattRate: prelimRate,
      nettoTillBank,
    },
  };
}
