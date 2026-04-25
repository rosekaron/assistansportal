export type BadgeVariant = "info" | "warning" | "destructive";

export interface DeadlineBadge {
  variant: BadgeVariant;
  text: string;
}

export interface Deadlines {
  fkDeadline: Date;   // 5th of second following month
  agiDeadline: Date;  // 12th of following month
}

/**
 * Compute FK and AGI regulatory deadlines for a reporting month.
 * @param reportingMonth "YYYY-MM" string (1-based month, e.g. "2026-01" = January)
 *
 * FK: 5th of SECOND following month
 *   January (mon=1)  → new Date(2026, 1+1, 5) = new Date(2026, 2, 5)  = March 5  ✓
 *   December (mon=12) → new Date(2026, 12+1, 5) = new Date(2026, 13, 5) → JS wraps to Feb 5 2027 ✓
 *
 * AGI: 12th of following month
 *   January (mon=1)  → new Date(2026, 1, 12) = new Date(2026, 1, 12)  = Feb 12   ✓
 *   December (mon=12) → new Date(2026, 12, 12) → JS wraps to Jan 12 2027 ✓
 */
export function computeDeadlines(reportingMonth: string): Deadlines {
  const [year, mon] = reportingMonth.split("-").map(Number);
  // mon is 1-based. JS Date months are 0-based.
  // FK: 5th of second following month → month index = (mon - 1) + 2 = mon + 1
  const fkDeadline = new Date(year, mon + 1, 5);
  // AGI: 12th of following month → month index = (mon - 1) + 1 = mon
  const agiDeadline = new Date(year, mon, 12);
  return { fkDeadline, agiDeadline };
}

/**
 * Compute badge variant and text from days remaining until deadline.
 * Returns undefined when the step is complete.
 * @param daysLeft positive = future, negative or zero = overdue
 * @param isComplete whether the step is already done
 */
export function deadlineBadge(daysLeft: number, isComplete: boolean): DeadlineBadge | undefined {
  if (isComplete) return undefined;
  if (daysLeft <= 0)  return { variant: "destructive", text: "Overdue" };
  if (daysLeft <= 7)  return { variant: "destructive", text: `${daysLeft} days left` };
  if (daysLeft <= 14) return { variant: "warning",     text: `${daysLeft} days left` };
  return { variant: "info", text: `${daysLeft} days left` };
}
