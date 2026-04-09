/**
 * PAY-01: Payroll calculation pure function stubs
 *
 * Wave 0 — RED state. Imports payroll-utils.ts which does NOT exist yet.
 * Vitest will report import failure until Wave 1 creates the implementation.
 *
 * Once payroll-utils.ts exists, all tests here must pass green.
 */

import { describe, it, expect } from "vitest";

// This import will FAIL — payroll-utils.ts does not exist yet. That is the intended RED state.
import { calculatePayroll, calculateOutstandingBalance } from "../../lib/payroll-utils";

describe("PAY-01: calculatePayroll", () => {
  it("standard 87h × 334 SEK × 31.42%: returns correct grossPay, employerContributions, totalEmployerCost", () => {
    const result = calculatePayroll({ billableHours: 87, hourlyRate: 334, taxRate: 0.3142 });
    expect(result.grossPay).toBe(29058);
    expect(result.employerContributions).toBeCloseTo(9130.0836, 2);
    expect(result.totalEmployerCost).toBeCloseTo(38188.0836, 2);
  });

  it("zero hours: all output fields are 0", () => {
    const result = calculatePayroll({ billableHours: 0, hourlyRate: 334, taxRate: 0.3142 });
    expect(result.grossPay).toBe(0);
    expect(result.employerContributions).toBe(0);
    expect(result.totalEmployerCost).toBe(0);
  });

  it("grossPay equals billableHours multiplied by hourlyRate", () => {
    const result = calculatePayroll({ billableHours: 87, hourlyRate: 334, taxRate: 0.3142 });
    expect(result.grossPay).toBe(87 * 334);
  });

  it("employerContributions equals grossPay multiplied by taxRate", () => {
    const result = calculatePayroll({ billableHours: 87, hourlyRate: 334, taxRate: 0.3142 });
    expect(result.employerContributions).toBeCloseTo(29058 * 0.3142, 2);
  });

  it("totalEmployerCost equals grossPay plus employerContributions", () => {
    const result = calculatePayroll({ billableHours: 87, hourlyRate: 334, taxRate: 0.3142 });
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
