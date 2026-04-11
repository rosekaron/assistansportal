/**
 * PAY-01: Payroll calculation pure function tests
 *
 * Updated in Phase 4 to reflect corrected D-01 formula:
 *   grossPay = (billableHours × hourlyRate − costsSum) / (1 + taxRate)
 *
 * All tests pass costsSum (required since Phase 4 formula fix).
 */

import { describe, it, expect } from "vitest";

import { calculatePayroll, calculateOutstandingBalance } from "../../lib/payroll-utils";

describe("PAY-01: calculatePayroll — corrected D-01 formula", () => {
  it("standard 87h × 334 SEK × 31.42%, no costs: correct grossPay, employerContributions, totalEmployerCost", () => {
    // netAfterCosts = 87 × 334 − 0 = 29058
    // grossPay      = 29058 / 1.3142 ≈ 22110.79
    // employerContribs = 22110.79 × 0.3142 ≈ 6947.21
    // totalEmployerCost ≈ 29058
    const result = calculatePayroll({ billableHours: 87, hourlyRate: 334, taxRate: 0.3142, costsSum: 0 });
    expect(result.grossPay).toBeCloseTo(22110.79, 0);
    expect(result.employerContributions).toBeCloseTo(6947.21, 0);
    expect(result.totalEmployerCost).toBeCloseTo(29058, 0);
  });

  it("zero hours: all output fields are 0", () => {
    const result = calculatePayroll({ billableHours: 0, hourlyRate: 334, taxRate: 0.3142, costsSum: 0 });
    expect(result.grossPay).toBe(0);
    expect(result.employerContributions).toBe(0);
    expect(result.totalEmployerCost).toBe(0);
  });

  it("grossPay does NOT equal billableHours × hourlyRate (old formula is wrong)", () => {
    const result = calculatePayroll({ billableHours: 87, hourlyRate: 334, taxRate: 0.3142, costsSum: 0 });
    // Old wrong value was 87 × 334 = 29058
    expect(result.grossPay).not.toBe(87 * 334);
  });

  it("employerContributions equals grossPay multiplied by taxRate", () => {
    const result = calculatePayroll({ billableHours: 87, hourlyRate: 334, taxRate: 0.3142, costsSum: 0 });
    expect(result.employerContributions).toBeCloseTo(result.grossPay * 0.3142, 2);
  });

  it("totalEmployerCost equals grossPay plus employerContributions", () => {
    const result = calculatePayroll({ billableHours: 87, hourlyRate: 334, taxRate: 0.3142, costsSum: 0 });
    expect(result.totalEmployerCost).toBeCloseTo(result.grossPay + result.employerContributions, 2);
  });
});

describe("PAY-01: calculateOutstandingBalance", () => {
  it("partial payment: calculateOutstandingBalance(29058, 20000) returns 9058", () => {
    expect(calculateOutstandingBalance(29058, 20000)).toBe(9058);
  });

  it("full payment: calculateOutstandingBalance(29058, 29058) returns 0 (paid in full)", () => {
    expect(calculateOutstandingBalance(29058, 29058)).toBe(0);
  });

  it("no payment: calculateOutstandingBalance(29058, 0) returns 29058 (nothing paid)", () => {
    expect(calculateOutstandingBalance(29058, 0)).toBe(29058);
  });
});
