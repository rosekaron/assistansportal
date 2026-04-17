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
 * @param reportingMonth "YYYY-MM" string (1-based month)
 */
export function computeDeadlines(_reportingMonth: string): Deadlines {
  throw new Error("Not implemented");
}

/**
 * Compute badge variant and text from days remaining until deadline.
 * Returns undefined if isComplete is true.
 * @param daysLeft positive = future, negative = overdue
 * @param isComplete whether the step is already complete
 */
export function deadlineBadge(_daysLeft: number, _isComplete: boolean): DeadlineBadge | undefined {
  throw new Error("Not implemented");
}
