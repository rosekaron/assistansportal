// payrollSlipUtils.test.ts — Vitest suite for buildAnhorigSlip() + formatKr().
// Covers SLIP-03 (numeric correctness + absence breakdown + VAB YTD + bank conditional
// + regression guards) and SLIP-04 (minor/adult/override + report-period-end pitfall).
//
// Mirrors employer-representation.test.ts structure: module-level fixtures + nested
// describe blocks per SLIP-XX requirement + individual it() blocks per behavior.

import { describe, it, expect } from "vitest";
import { buildAnhorigSlip, formatKr } from "./payrollSlipUtils";
import type { AbsenceRow } from "./absence-utils";

const baseProfile = {
  patientName: "Liam Karon",
  patientPno: "201501011234",          // minor (born 2015)
  guardianName: "Rose Karon",
  guardianPno: "198011155069",
  address: "Storgatan 1, 11122 Stockholm",
  addressStreet: "Storgatan 1",
  addressZip: "11122",
  addressCity: "Stockholm",
  patientRequiresRepresentative: false,
} as const;

const baseAssistant = {
  id: "asst-1",
  name: "Rose Karon",
  pno: "198011155069",
  bankClearing: null as string | null,
  bankAccount: null as string | null,
  iban: null as string | null,
  salaryModel: "anhörig" as const,
  hourlyRateOverride: 254.10 as number | null,
  paymentMethod: "bankgiro" as const,
};

const basePayrollRecord = {
  id: "pr-1",
  assistantId: "asst-1",
  month: "2026-03",
  billableHours: 215,
  grossPay: 54631.5,
  prelimTaxRateSnapshot: 0.30,
  salaryModelUsed: "anhörig" as const,
  hourlyRateUsed: 254.10 as number | null,
};

const baseInput = {
  profile: baseProfile,
  assistant: baseAssistant,
  payrollRecord: basePayrollRecord,
  absences: [] as AbsenceRow[],
  documentNumber: "LS-2026-03-001",
  payDate: "2026-04-25",
  payMethod: "bankgiro" as const,
};

describe("buildAnhorigSlip — SLIP-03 numeric correctness", () => {
  it("Test 1: golden anhörig slip — 215h × 254.10 = 54631.50 gross, 30% tax, 38242.05 net", () => {
    const slip = buildAnhorigSlip(baseInput);
    expect(slip.lön.bruttoLön).toBe(54631.5);
    expect(slip.avdrag.prelimSkatt).toBe(-16389.45);
    expect(slip.avdrag.nettoTillBank).toBe(38242.05);
    expect(slip.avdrag.prelimSkattRate).toBe(0.30);
  });

  it("Test 2: zero absences → all absence-day counters are 0", () => {
    const slip = buildAnhorigSlip(baseInput);
    expect(slip.hours.sjuk).toBe(0);
    expect(slip.hours.vab).toBe(0);
    expect(slip.hours.semester).toBe(0);
    expect(slip.hours.other).toBe(0);
    expect(slip.hours.vabYtdUsed).toBe(0);
  });

  it("Test 3: VAB YTD — 3 days Jan + 5 days Mar = 8 used", () => {
    const absences: AbsenceRow[] = [
      { assistantId: "asst-1", startDate: "2026-01-10", endDate: "2026-01-12", absenceType: "vab" }, // 3 days
      { assistantId: "asst-1", startDate: "2026-03-05", endDate: "2026-03-09", absenceType: "vab" }, // 5 days
    ];
    const slip = buildAnhorigSlip({ ...baseInput, absences });
    expect(slip.hours.vabYtdUsed).toBe(8);
    expect(slip.hours.vab).toBe(5); // only March days fall in the report month
  });

  it("Test 4: absence counting within report month only", () => {
    const absences: AbsenceRow[] = [
      { assistantId: "asst-1", startDate: "2026-03-10", endDate: "2026-03-11", absenceType: "sjukfrånvaro" }, // 2 sjuk in-month
      { assistantId: "asst-1", startDate: "2026-02-20", endDate: "2026-02-22", absenceType: "sjukfrånvaro" }, // 3 outside
      { assistantId: "asst-1", startDate: "2026-03-15", endDate: "2026-03-15", absenceType: "semester" },     // 1 semester in-month
      { assistantId: "asst-1", startDate: "2026-03-20", endDate: "2026-03-20", absenceType: "other" },        // 1 other in-month
    ];
    const slip = buildAnhorigSlip({ ...baseInput, absences });
    expect(slip.hours.sjuk).toBe(2);
    expect(slip.hours.semester).toBe(1);
    expect(slip.hours.other).toBe(1);
  });

  it("Test 5: bank line omitted when all three bank fields empty", () => {
    const slip = buildAnhorigSlip({
      ...baseInput,
      assistant: { ...baseAssistant, bankClearing: null, bankAccount: null, iban: null },
    });
    expect(slip.bankLine).toBeNull();
  });

  it("Test 6: bank line — bankgiro only (clearing + account set)", () => {
    const slip = buildAnhorigSlip({
      ...baseInput,
      assistant: { ...baseAssistant, bankClearing: "1234", bankAccount: "567890", iban: null },
    });
    expect(slip.bankLine).toBe("Bankgiro 1234-567890");
  });

  it("Test 7: bank line — IBAN only", () => {
    const slip = buildAnhorigSlip({
      ...baseInput,
      assistant: { ...baseAssistant, bankClearing: null, bankAccount: null, iban: "SE4550000000058398257466" },
    });
    expect(slip.bankLine).toBe("IBAN SE4550000000058398257466");
  });

  it("Test 8: bank line — all three set", () => {
    const slip = buildAnhorigSlip({
      ...baseInput,
      assistant: { ...baseAssistant, bankClearing: "1234", bankAccount: "567890", iban: "SE4550000000058398257466" },
    });
    expect(slip.bankLine).toBe("1234-567890 (IBAN SE4550000000058398257466)");
  });

  it("Test 9: SLIP-03 regression guard — no employer-side numbers leak into output", () => {
    const slip = buildAnhorigSlip(baseInput);
    const json = JSON.stringify(slip);
    expect(json).not.toContain("employerContributions");
    expect(json).not.toContain("totalEmployerCost");
    expect(json).not.toContain("arbetsgivaravgifter");
  });

  it("Test 10: SLIP-03 regression guard — skattetabell deferred to v1.4, absent from output", () => {
    const slip = buildAnhorigSlip(baseInput);
    const json = JSON.stringify(slip);
    expect(json).not.toContain("skattetabell");
  });
});

describe("buildAnhorigSlip — SLIP-04 minor/adult/override branching", () => {
  it("Test 11: minor patient (born 2015) → representative present (parent)", () => {
    const slip = buildAnhorigSlip(baseInput);
    expect(slip.representative).not.toBeNull();
    expect(slip.representative?.name).toBe("Rose Karon");
    expect(slip.representative?.pno).toBe("198011155069");
  });

  it("Test 12: adult patient (born 1990), flag false → representative null", () => {
    const slip = buildAnhorigSlip({
      ...baseInput,
      profile: { ...baseProfile, patientPno: "199001011234", patientRequiresRepresentative: false },
    });
    expect(slip.representative).toBeNull();
  });

  it("Test 13: adult patient (born 1990), flag true (god-man) → representative present", () => {
    const slip = buildAnhorigSlip({
      ...baseInput,
      profile: { ...baseProfile, patientPno: "199001011234", patientRequiresRepresentative: true },
    });
    expect(slip.representative).not.toBeNull();
    expect(slip.representative?.name).toBe("Rose Karon");
  });

  it("Test 14: Pitfall 1 — asOfDate derived from report-period-end, not today", () => {
    // Patient born 2008-04-15 → turns 18 on 2026-04-15.
    const bornApr2008 = { ...baseProfile, patientPno: "200804151234" };

    // March 2026 slip → reportPeriodEnd=2026-03-31 → still minor → representative present
    const slipMar = buildAnhorigSlip({
      ...baseInput,
      profile: bornApr2008,
      payrollRecord: { ...basePayrollRecord, month: "2026-03" },
    });
    expect(slipMar.representative).not.toBeNull();

    // April 2026 slip → reportPeriodEnd=2026-04-30 → now adult → representative null
    const slipApr = buildAnhorigSlip({
      ...baseInput,
      profile: bornApr2008,
      payrollRecord: { ...basePayrollRecord, month: "2026-04" },
      payDate: "2026-05-25",
      documentNumber: "LS-2026-04-001",
    });
    expect(slipApr.representative).toBeNull();
  });
});

describe("formatKr — Swedish currency formatting", () => {
  it("Test 15a: formatKr(54631.5) = '54 631,50 kr' (regular space thousands, comma decimal)", () => {
    expect(formatKr(54631.5)).toBe("54 631,50 kr");
  });

  it("Test 15b: formatKr(0) = '0,00 kr'", () => {
    expect(formatKr(0)).toBe("0,00 kr");
  });

  it("Test 15c: formatKr(-16389.45) uses U+2212 minus sign", () => {
    expect(formatKr(-16389.45)).toBe("\u221216 389,45 kr");
  });
});

describe("buildAnhorigSlip — rate-fallback (Pitfall 2)", () => {
  it("Test 16: hourlyRateUsed=0 legacy snapshot + override=254.10 → uses override for Grundlön rate", () => {
    const slip = buildAnhorigSlip({
      ...baseInput,
      assistant: { ...baseAssistant, hourlyRateOverride: 254.10 },
      payrollRecord: { ...basePayrollRecord, hourlyRateUsed: 0 },
    });
    // Effective rate = 254.10; hours worked = 215 → lön.gross = 54631.50
    expect(slip.lön.gross).toBe(54631.5);
    expect(slip.hourlyRate).toBe(254.10);
  });
});

describe("buildAnhorigSlip — auxiliary field coverage", () => {
  it("documentNumber, payDate, payMethod labels formatted correctly", () => {
    const slip = buildAnhorigSlip(baseInput);
    expect(slip.documentNumber).toBe("LS-2026-03-001");
    expect(slip.payDateLabel).toBe("25 april 2026");
    expect(slip.payMethodLabel).toBe("Bankgiro");
    expect(slip.avtalsmodellLabel).toBe("Anhörigassistans (fast timlön, ej sjuk/sem)");
  });

  it("reportPeriodLabel uses Swedish month name and en-dash", () => {
    const slip = buildAnhorigSlip(baseInput);
    expect(slip.reportPeriodLabel).toContain("mars");
    expect(slip.reportPeriodLabel).toContain("2026");
    expect(slip.reportPeriodLabel).toContain("\u2013"); // en-dash
  });

  it("sjukLön, vabLön, semesterLön are always 0 in anhörig model", () => {
    const slip = buildAnhorigSlip(baseInput);
    expect(slip.lön.sjukLön).toBe(0);
    expect(slip.lön.vabLön).toBe(0);
    expect(slip.lön.semesterLön).toBe(0);
  });

  it("employer block populated from resolveEmployerRepresentation", () => {
    const slip = buildAnhorigSlip(baseInput);
    expect(slip.employer.name).toBe("Liam Karon");
    expect(slip.employer.pno).toBe("201501011234");
    expect(slip.employer.address).toBe("Storgatan 1, 11122 Stockholm");
  });

  it("employee block mirrors assistant.name + pno", () => {
    const slip = buildAnhorigSlip(baseInput);
    expect(slip.employee.name).toBe("Rose Karon");
    expect(slip.employee.pno).toBe("198011155069");
  });
});
