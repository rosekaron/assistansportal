// absence-utils.ts — pure functions for absence filtering and balance calculation.
// No DB imports — all inputs are plain arrays.

export type AbsenceRow = {
  assistantId: string | null;
  startDate: string;    // YYYY-MM-DD
  endDate: string;      // YYYY-MM-DD
  absenceType: "sjukfrånvaro" | "vab" | "semester" | "other";
};

export type EntryRow = {
  id: string;
  assistantId: string;
  date: string;         // YYYY-MM-DD
  hours: number;
  [key: string]: unknown;  // allow passthrough of extra fields
};

/** Returns calendar days in [startDate, endDate] clipped to [yearStart, yearEnd]. */
function clippedDays(startDate: string, endDate: string, year: number): number {
  const yearStart = `${year}-01-01`;
  const yearEnd   = `${year}-12-31`;
  const clippedStart = startDate < yearStart ? yearStart : startDate;
  const clippedEnd   = endDate   > yearEnd   ? yearEnd   : endDate;
  if (clippedStart > clippedEnd) return 0;
  const msPerDay = 86_400_000;
  return Math.round(
    (new Date(clippedEnd).getTime() - new Date(clippedStart).getTime()) / msPerDay
  ) + 1;
}

/**
 * Filters entries to exclude any whose date falls within an absence range.
 * If an absence has null assistantId, it applies to ALL assistants (public holiday pattern).
 * If an absence has a specific assistantId, only entries for that assistant are excluded.
 */
export function filterBillableEntries<T extends EntryRow>(
  entries: T[],
  absences: AbsenceRow[],
): T[] {
  return entries.filter(entry =>
    !absences.some(absence =>
      (absence.assistantId === null || absence.assistantId === entry.assistantId) &&
      entry.date >= absence.startDate &&
      entry.date <= absence.endDate
    )
  );
}

/**
 * Returns remaining VAB days (120 - used) for a given assistant and calendar year.
 * Clips multi-year absences to the target year boundary.
 * Includes null-assistantId absences (they apply to all assistants).
 */
export function vabBalance(
  absences: AbsenceRow[],
  assistantId: string,
  year: number,
): number {
  const used = absences
    .filter(a =>
      a.absenceType === "vab" &&
      (a.assistantId === assistantId || a.assistantId === null) &&
      a.startDate <= `${year}-12-31` &&
      a.endDate   >= `${year}-01-01`
    )
    .reduce((sum, a) => sum + clippedDays(a.startDate, a.endDate, year), 0);
  return Math.max(0, 120 - used);
}

/**
 * Returns total sick leave days recorded for a given assistant in a calendar year.
 * No cap — guardian sees usage count only (per D-04).
 * Clips multi-year absences to the target year boundary.
 * Includes null-assistantId absences (they apply to all assistants).
 */
export function sickYtd(
  absences: AbsenceRow[],
  assistantId: string,
  year: number,
): number {
  return absences
    .filter(a =>
      a.absenceType === "sjukfrånvaro" &&
      (a.assistantId === assistantId || a.assistantId === null) &&
      a.startDate <= `${year}-12-31` &&
      a.endDate   >= `${year}-01-01`
    )
    .reduce((sum, a) => sum + clippedDays(a.startDate, a.endDate, year), 0);
}
