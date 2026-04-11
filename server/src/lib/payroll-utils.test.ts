import { describe, it, expect } from "vitest";
import { calculatePayroll } from "./payroll-utils";

// Phase 4 D-01: corrected formula
// fkAllocation  = billableHours × hourlyRate
// netAfterCosts = fkAllocation − costsSum
// grossPay      = netAfterCosts / (1 + taxRate)
// employerContribs = grossPay × taxRate
// totalEmployerCost ≈ netAfterCosts (= grossPay + employerContribs)

describe("calculatePayroll — corrected formula (D-01)", () => {
  it("Test 1: normal case with costs deduction", () => {
    // billableHours=100, hourlyRate=334, taxRate=0.3142, costsSum=5000
    // fkAllocation  = 100 × 334 = 33400
    // netAfterCosts = 33400 − 5000 = 28400
    // grossPay      = 28400 / 1.3142 ≈ 21610.11
    // employerContribs = 21610.11 × 0.3142 ≈ 6789.89
    // totalEmployerCost ≈ 28400.00
    const result = calculatePayroll({
      billableHours: 100,
      hourlyRate: 334,
      taxRate: 0.3142,
      costsSum: 5000,
    });
    expect(result.grossPay).toBeCloseTo(21610.11, 0);
    expect(result.employerContributions).toBeCloseTo(6789.89, 0);
    expect(result.totalEmployerCost).toBeCloseTo(28400.0, 0);
  });

  it("Test 2: zero hours returns all zeros", () => {
    const result = calculatePayroll({
      billableHours: 0,
      hourlyRate: 334,
      taxRate: 0.3142,
      costsSum: 0,
    });
    expect(result.grossPay).toBe(0);
    expect(result.employerContributions).toBe(0);
    expect(result.totalEmployerCost).toBe(0);
  });

  it("Test 3: costs eat entire allocation — all zeros", () => {
    // billableHours=50, hourlyRate=334, costsSum=16700
    // fkAllocation = 50 × 334 = 16700
    // netAfterCosts = 16700 − 16700 = 0 → all zero
    const result = calculatePayroll({
      billableHours: 50,
      hourlyRate: 334,
      taxRate: 0.3142,
      costsSum: 16700,
    });
    expect(result.grossPay).toBe(0);
    expect(result.employerContributions).toBe(0);
    expect(result.totalEmployerCost).toBe(0);
  });

  it("Test 4: costsSum is required — old formula (hours×rate as gross) must NOT match", () => {
    // With old formula: grossPay = 100×334 = 33400
    // With new formula and costsSum=5000: grossPay ≈ 21611.58
    // Confirm they are different
    const result = calculatePayroll({
      billableHours: 100,
      hourlyRate: 334,
      taxRate: 0.3142,
      costsSum: 5000,
    });
    // Old (wrong) value was hours × rate = 33400
    expect(result.grossPay).not.toBe(33400);
  });
});
