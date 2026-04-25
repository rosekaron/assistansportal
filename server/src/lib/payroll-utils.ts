// payroll-utils.ts — pure payroll calculation functions.
// No DB imports — all inputs are plain objects.
// Formula corrected in Phase 4 (D-01): grossPay = (fkAllocation − costs) / (1 + taxRate)

export type PayrollInput = {
  billableHours: number;
  hourlyRate:    number;
  taxRate:       number;   // employer contribution rate e.g. 0.3142
  costsSum:      number;   // sum of costs.amount_sek scoped to this assistant+month (D-02)
};

export type PayrollResult = {
  grossPay:              number;
  employerContributions: number;
  totalEmployerCost:     number;
};

/**
 * Calculates gross pay and employer contributions for a given month.
 *
 * Correct formula (D-01):
 *   fkAllocation     = billableHours × hourlyRate
 *   netAfterCosts    = fkAllocation − costsSum
 *   grossPay         = netAfterCosts / (1 + taxRate)
 *   employerContribs = grossPay × taxRate
 *   totalEmployerCost ≈ netAfterCosts  (check: grossPay + employerContribs = netAfterCosts)
 *
 * If netAfterCosts ≤ 0, all values return 0 (costs exceed allocation).
 */
export function calculatePayroll(input: PayrollInput): PayrollResult {
  const fkAllocation          = input.billableHours * input.hourlyRate;
  const netAfterCosts         = fkAllocation - input.costsSum;
  if (netAfterCosts <= 0) {
    return { grossPay: 0, employerContributions: 0, totalEmployerCost: 0 };
  }
  const grossPay              = netAfterCosts / (1 + input.taxRate);
  const employerContributions = grossPay * input.taxRate;
  const totalEmployerCost     = grossPay + employerContributions;
  return { grossPay, employerContributions, totalEmployerCost };
}

/**
 * Returns the outstanding balance (gross pay minus total of recorded payments).
 * Returns 0 if totalPaid >= grossPay (never negative).
 */
export function calculateOutstandingBalance(grossPay: number, totalPaid: number): number {
  return Math.max(0, grossPay - totalPaid);
}
