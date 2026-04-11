// form4805-utils.ts — pure functions for building Skatteverket blankett 4805 field map.
// No DB imports. All inputs are plain objects.
// Field names confirmed via direct PDF inspection.

export type Form4805Profile = {
  guardianName:  string;
  guardianPno:   string;
  guardianPhone: string;
  address:       string;
  city:          string;
  zip:           string;
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

  // Employer address: "{address}, {zip} {city}"
  const guardianAddress = [
    profile.address,
    [profile.zip, profile.city].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ").trim();

  const birthYear = birthYearFromPno(assistant.pno);

  const fields: Record<string, string> = {};

  // Header
  fields["txtManad[0]"]         = swMonthName(yearMonth);
  fields["txtRattelseDatum[0]"] = "";

  // Employer (guardian) — caller fills index [0] of duplicate-named fields
  fields["__employer__txtNamn[0]"]   = profile.guardianName;
  fields["__employer__txtPersNr[0]"] = profile.guardianPno;
  fields["__employer__txtAdress[0]"] = guardianAddress;

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
