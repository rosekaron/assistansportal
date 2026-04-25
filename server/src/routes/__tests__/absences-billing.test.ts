/**
 * LEAV-02: FK billing exclusion test stubs
 *
 * Wave 0 — RED state. These tests import filterBillableEntries from
 * "../../lib/absence-utils" which does NOT exist yet. Vitest will report this file
 * as FAILED/ERROR until Wave 2 creates the utility implementation.
 *
 * All tests are pure function tests — no HTTP, no DB required.
 */

import { describe, it, expect } from "vitest";

// This import will FAIL — absence-utils.ts does not exist yet. That is the intended RED state.
import { filterBillableEntries } from "../../lib/absence-utils";

// Inline type aliases matching the contract in absence-utils.ts (Wave 2)
type AbsenceRow = {
  assistantId: string | null;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  absenceType: "sjukfrånvaro" | "vab" | "semester" | "other";
};

type EntryRow = {
  id: string;
  assistantId: string;
  date: string;       // YYYY-MM-DD
  hours: number;
};

describe("LEAV-02: filterBillableEntries — FK billing exclusion", () => {
  it("returns all entries when absences array is empty", () => {
    const entries: EntryRow[] = [
      { id: "e1", assistantId: "asst_01", date: "2026-03-03", hours: 8 },
      { id: "e2", assistantId: "asst_01", date: "2026-03-10", hours: 8 },
    ];
    const result = filterBillableEntries(entries, []);
    expect(result).toHaveLength(2);
  });

  it("excludes an entry whose date falls within an absence range", () => {
    const entries: EntryRow[] = [
      { id: "e1", assistantId: "asst_01", date: "2026-03-03", hours: 8 },
      { id: "e2", assistantId: "asst_01", date: "2026-03-10", hours: 8 },
    ];
    const absences: AbsenceRow[] = [
      {
        assistantId: "asst_01",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        absenceType: "sjukfrånvaro",
      },
    ];
    const result = filterBillableEntries(entries, absences);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e2");
  });

  it("keeps an entry whose date is outside all absence ranges", () => {
    const entries: EntryRow[] = [
      { id: "e1", assistantId: "asst_01", date: "2026-03-15", hours: 8 },
    ];
    const absences: AbsenceRow[] = [
      {
        assistantId: "asst_01",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        absenceType: "vab",
      },
    ];
    const result = filterBillableEntries(entries, absences);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e1");
  });

  it("null-assistantId absence excludes entries for ALL assistants on that date", () => {
    const entries: EntryRow[] = [
      { id: "e1", assistantId: "asst_01", date: "2026-03-03", hours: 8 },
      { id: "e2", assistantId: "asst_02", date: "2026-03-03", hours: 6 },
      { id: "e3", assistantId: "asst_01", date: "2026-03-10", hours: 8 },
    ];
    const allAssistantAbsence: AbsenceRow[] = [
      {
        assistantId: null,
        startDate: "2026-03-03",
        endDate: "2026-03-03",
        absenceType: "other",
      },
    ];
    // Should exclude entries for ANY assistantId on that date
    const result = filterBillableEntries(entries, allAssistantAbsence);
    expect(result).toHaveLength(1);
    expect(result[0].date).toBe("2026-03-10");
  });

  it("specific assistantId absence only excludes that assistant's entries", () => {
    const entries: EntryRow[] = [
      { id: "e1", assistantId: "asst_01", date: "2026-03-03", hours: 8 },
      { id: "e2", assistantId: "asst_02", date: "2026-03-03", hours: 6 },
    ];
    const absences: AbsenceRow[] = [
      {
        assistantId: "asst_01",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        absenceType: "sjukfrånvaro",
      },
    ];
    const result = filterBillableEntries(entries, absences);
    expect(result).toHaveLength(1);
    expect(result[0].assistantId).toBe("asst_02");
  });

  it("absence range overlapping month boundary excludes entry on first day of next month", () => {
    const entries: EntryRow[] = [
      { id: "e1", assistantId: "asst_01", date: "2026-04-01", hours: 8 }, // first day of April, covered
      { id: "e2", assistantId: "asst_01", date: "2026-04-05", hours: 8 }, // outside range
    ];
    const absences: AbsenceRow[] = [
      {
        assistantId: "asst_01",
        startDate: "2026-03-28",
        endDate: "2026-04-02",
        absenceType: "vab",
      },
    ];
    const result = filterBillableEntries(entries, absences);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("e2");
  });
});
