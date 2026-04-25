// form4805-utils.ts — pure functions for building Skatteverket blankett 4805 field map.
// No DB imports. All inputs are plain objects.
// Field names confirmed via direct PDF inspection.

import { resolveEmployerRepresentation } from "./employer-representation";

export type Form4805Profile = {
  // Guardian identity — used for signature / contact / Namnfortydl (D-09)
  guardianName:  string;
  guardianPno:   string;
  guardianPhone: string;
  // Patient identity — NEW (Phase 8): consumed by employer-representation helper
  patientName:   string;
  patientPno:    string;
  patientRequiresRepresentative: boolean;
  // Address: legacy single-line + Phase 7 split columns (helper chooses)
  address:       string;
  city:          string;
  zip:           string;
  addressStreet: string;
  addressZip:    string;
  addressCity:   string;
};

export type Form4805Assistant = {
  name:    string;
  pno:     string;
  address: string;
};

export type Form4805PayrollRecord = {
  grossPay:              number;
  employerContributions: number;
  prelimTaxRateSnapshot: number;
};

export type Form4805Input = {
  yearMonth:     string;               // "YYYY-MM"
  profile:       Form4805Profile;
  assistant:     Form4805Assistant;
  payrollRecord: Form4805PayrollRecord;
};

/**
 * Extracts the birth year from a Swedish personnummer.
 * Supports 12-digit format: YYYYMMDDNNNN → first 4 digits are the year.
 * Returns null if pno is empty or too short.
 */
export function birthYearFromPno(pno: string): number | null {
  const digits = pno.replace(/\D/g, "");
  if (digits.length >= 8) {
    const year = parseInt(digits.slice(0, 4), 10);
    if (!isNaN(year)) return year;
  }
  return null;
}

/**
 * Returns the Swedish month name for a YYYY-MM string, with the first letter capitalised.
 * Example: "2026-03" → "Mars"
 */
export function swMonthName(yearMonth: string): string {
  const [year, mon] = yearMonth.split("-").map(Number);
  const name = new Intl.DateTimeFormat("sv-SE", { month: "long" }).format(new Date(year, mon - 1, 1));
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Builds the AcroForm field map for blankett 4805.
 *
 * For duplicate-named fields (txtNamn[0], txtPersNr[0], txtAdress[0]):
 *   The returned map uses internal keys "__employer__txtNamn[0]", "__recipient__txtNamn[0]"
 *   so the caller can distinguish them. The pdf.ts route must handle these specially
 *   using form.getFields().filter(f => f.getName().endsWith('txtNamn[0]')) and access by index.
 *
 * All monetary values are Math.round()ed to integers.
 */
export function buildForm4805Fields(input: Form4805Input): Record<string, string> {
  const { yearMonth, profile, assistant, payrollRecord } = input;
  const { grossPay, employerContributions, prelimTaxRateSnapshot } = payrollRecord;

  const grossRounded   = Math.round(grossPay);
  const contribRounded = Math.round(employerContributions);
  const taxWithheld    = Math.round(grossPay * prelimTaxRateSnapshot);
  const summaToBePaid  = Math.round(employerContributions + grossPay * prelimTaxRateSnapshot);

  // Compute report period end-date for helper (D-01: asOfDate = last day of period).
  // `yearMonth` is "YYYY-MM"; new Date(year, month, 0) = day 0 of NEXT month = last day of THIS month.
  const [ymYear, ymMonth] = yearMonth.split("-").map(Number);
  const lastDayOfPeriod = new Date(ymYear, ymMonth, 0);
  const rep = resolveEmployerRepresentation(profile, lastDayOfPeriod);

  const birthYear = birthYearFromPno(assistant.pno);

  const fields: Record<string, string> = {};

  // Header
  fields["txtManad[0]"]         = swMonthName(yearMonth);
  fields["txtRattelseDatum[0]"] = "";

  // Employer — the PATIENT (per Phase 8 EMP-02); helper resolves identity + address.
  // Guardian identity still appears on the SIGNATURE block below (txtNamnfortydl) per D-09.
  fields["__employer__txtNamn[0]"]   = rep.arbetsgivare.name;
  fields["__employer__txtPersNr[0]"] = rep.arbetsgivare.pno;
  fields["__employer__txtAdress[0]"] = rep.arbetsgivare.address;

  // Recipient (assistant) — caller fills index [1] of duplicate-named fields
  fields["__recipient__txtNamn[0]"]   = assistant.name;
  fields["__recipient__txtPersNr[0]"] = assistant.pno;
  fields["__recipient__txtAdress[0]"] = assistant.address;

  // Gross salary & employer contributions — age-based code selection
  if (birthYear !== null) {
    if (birthYear >= 1959) {
      // Born 1959 or later — standard rate codes
      fields["txtKod04[0]"] = String(grossRounded);
      fields["txtKod07[0]"] = String(contribRounded);
    } else if (birthYear >= 1938) {
      // Born 1938–1958 — reduced rate codes
      fields["txtKod18[0]"] = String(grossRounded);
      fields["txtKod24[0]"] = String(contribRounded);
    }
    // Born 1937 or earlier — leave all salary/contribution fields empty
  }

  // Tax withholding — ALL ages
  fields["txtKod06[0]"] = String(grossRounded);   // tax base = gross salary
  fields["txtKod09[0]"] = String(taxWithheld);     // avdragen skatt
  fields["txtKod10[0]"] = String(summaToBePaid);   // summa att betala

  // Signature block
  fields["txtNamnfortydl[0]"] = profile.guardianName;
  fields["txtNTelefon[0]"]    = profile.guardianPhone;

  return fields;
}
