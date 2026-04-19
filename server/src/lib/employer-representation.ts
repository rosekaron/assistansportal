// employer-representation.ts — single source of truth for arbetsgivare (employer) and
// företrädare (representative) identity on every government document the platform produces.
// Pure function: no DB access, no side effects. Minor-status is a pure function of
// (patient_pno, report_period_end_date) per CONTEXT.md specifics.
//
// Locked decisions honored:
//   D-01: age derived from patient pno, relative to report period END
//   D-02: patient turning 18 during month → adult for the whole month (end-of-period wins)
//   D-03: override flag applies ONLY to adults; minors always get representative
//   D-04: adult + flag=true → representative present; adult + flag=false/null → representative null
//   D-06: structured return shape (objects with name/pno), NOT pre-formatted strings
//   D-07: split address columns preferred, single-line address fallback

export type EmployerRepresentation = {
  arbetsgivare: { name: string; pno: string; address: string };
  företrädare: { name: string; pno: string } | null;
  isMinor: boolean;
};

/**
 * Returns true when the patient is under 18 as of `asOfDate`.
 * Canonical pno storage format in this codebase is 12-digit YYYYMMDDNNNN (Phase 7 D-18).
 * Malformed / too-short pno returns false (treat as adult → representative depends on flag).
 * Phase 10 DATA-01 will catch placeholder "000000-0000" values during visual inspection.
 *
 * IMPORTANT: Pass the LAST day of the report period, not today's date. Regenerating
 * historical months must use that month's end-of-period or the minor→adult transition
 * will be evaluated against the wrong calendar point (RESEARCH.md Pitfall 6).
 */
export function isMinor(pno: string, asOfDate: Date): boolean {
  const digits = pno.replace(/\D/g, "");
  if (digits.length < 8) return false;
  const year  = parseInt(digits.slice(0, 4), 10);
  const month = parseInt(digits.slice(4, 6), 10);
  const day   = parseInt(digits.slice(6, 8), 10);
  if (!year || !month || !day) return false;
  // 18th birthday as a calendar Date. asOfDate < birthday18 → minor.
  const birthday18 = new Date(year + 18, month - 1, day);
  return asOfDate < birthday18;
}

/**
 * Builds the employer-address string. Prefers the Phase 7 split columns
 * (addressStreet / addressZip / addressCity) when any is non-empty. Falls back to
 * the legacy single-line `address` column for records that predate Phase 7.
 * Format matches form4805-utils.ts:77-80 convention: "{street}, {zip} {city}"
 */
function buildPatientAddress(p: {
  address: string | null;
  addressStreet: string | null;
  addressZip: string | null;
  addressCity: string | null;
}): string {
  const street = (p.addressStreet ?? "").trim();
  const zip    = (p.addressZip    ?? "").trim();
  const city   = (p.addressCity   ?? "").trim();
  const hasSplit = !!(street || zip || city);
  if (hasSplit) {
    const tail = [zip, city].filter(Boolean).join(" ");
    const line = [street, tail].filter(Boolean).join(", ").trim();
    if (line) return line;
  }
  return (p.address ?? "").trim();
}

export function resolveEmployerRepresentation(
  profile: {
    patientName: string | null;
    patientPno: string | null;
    guardianName: string | null;
    guardianPno: string | null;
    patientRequiresRepresentative: boolean | null;
    address: string | null;
    addressStreet: string | null;
    addressZip: string | null;
    addressCity: string | null;
  },
  asOfDate: Date,
): EmployerRepresentation {
  const minor    = isMinor(profile.patientPno ?? "", asOfDate);
  const override = profile.patientRequiresRepresentative === true;
  // D-03: override applies only to adults; minors always get representative.
  // Simplified: minor || override is equivalent because minor case already forces needsRep.
  const needsRep = minor || override;
  return {
    arbetsgivare: {
      name:    profile.patientName ?? "",
      pno:     profile.patientPno  ?? "",
      address: buildPatientAddress(profile),
    },
    företrädare: needsRep
      ? {
          name: profile.guardianName ?? "",
          pno:  profile.guardianPno  ?? "",
        }
      : null,
    isMinor: minor,
  };
}
