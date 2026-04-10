// payroll-utils.ts — pure payroll calculation functions.
// No DB imports — all inputs are plain objects.
// Mirrors absence-utils.ts module structure (D-04).

export type PayrollInput = {
  billableHours: number;
  hourlyRate:    number;
  taxRate:       number; // e.g. 0.3142 for 31.42% (D-06: flat rate for all assistants in Phase 3)
};

export type PayrollResult = {
  grossPay:              number;
  employerContributions: number;
  totalEmployerCost:     number;
};

/**
 * Calculates gross pay and employer contributions for a given month.
 * grossPay = billableHours × hourlyRate
 * employerContributions = grossPay × taxRate  (31.42% standard rate per D-06)
 * totalEmployerCost = grossPay + employerContributions
 *
 * Both hourlyRate and taxRate are passed in (snapshotted at generation time per D-02).
 * This function does NOT read from env vars — callers supply the snapshotted values.
 */
export function calculatePayroll(input: PayrollInput): PayrollResult {
  const grossPay              = input.billableHours * input.hourlyRate;
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
