/**
 * LEAV-03: VAB balance and sick YTD test stubs
 *
 * Wave 0 — RED state. These tests import vabBalance, sickYtd from
 * "../../lib/absence-utils" which does NOT exist yet. Vitest will report this file
 * as FAILED/ERROR until Wave 2 creates the utility implementation.
 *
 * All tests are pure function tests — no HTTP, no DB required.
 */

import { describe, it, expect } from "vitest";

// This import will FAIL — absence-utils.ts does not exist yet. That is the intended RED state.
import { vabBalance, sickYtd } from "../../lib/absence-utils";

// Inline type alias matching the contract in absence-utils.ts (Wave 2)
type AbsenceRow = {
  assistantId: string | null;
  startDate: string;  // YYYY-MM-DD
  endDate: string;    // YYYY-MM-DD
  absenceType: "sjukfrånvaro" | "vab" | "semester" | "other";
};

describe("LEAV-03: vabBalance — VAB days remaining", () => {
  it("returns 120 when no VAB absences recorded", () => {
    const result = vabBalance([], "asst_01", 2026);
    expect(result).toBe(120);
  });

  it("returns 115 after a 5-day VAB absence", () => {
    const absences: AbsenceRow[] = [
      {
        assistantId: "asst_01",
        startDate: "2026-02-02",
        endDate: "2026-02-06",
        absenceType: "vab",
      },
    ];
    const result = vabBalance(absences, "asst_01", 2026);
    expect(result).toBe(115); // 120 - 5
  });

  it("clips cross-year absence: 2025-12-28 to 2026-01-03 counts only 3 days in 2026", () => {
    const crossYearAbsence: AbsenceRow[] = [
      {
        assistantId: "asst_01",
        startDate: "2025-12-28",
        endDate: "2026-01-03",
        absenceType: "vab",
      },
    ];
    // 2026 portion: Jan 1 – Jan 3 = 3 days
    const remaining = vabBalance(crossYearAbsence, "asst_01", 2026);
    expect(remaining).toBe(117); // 120 - 3
  });

  it("returns 80 after a 40-day VAB absence (does not go below 0)", () => {
    // Jan 1 – Feb 9 = 40 days (31 + 9)
    const heavyVab: AbsenceRow[] = [
      {
        assistantId: "asst_01",
        startDate: "2026-01-01",
        endDate: "2026-02-09",
        absenceType: "vab",
      },
    ];
    const remaining = vabBalance(heavyVab, "asst_01", 2026);
    expect(remaining).toBe(80); // 120 - 40
  });

  it("ignores another assistant's VAB when computing balance for asst_01", () => {
    const absences: AbsenceRow[] = [
      {
        assistantId: "asst_02",
        startDate: "2026-03-01",
        endDate: "2026-03-05",
        absenceType: "vab",
      },
    ];
    const result = vabBalance(absences, "asst_01", 2026);
    expect(result).toBe(120); // not affected
  });
});

describe("LEAV-03: sickYtd — sick leave days year-to-date", () => {
  it("returns 0 when no sick absences", () => {
    const result = sickYtd([], "asst_01", 2026);
    expect(result).toBe(0);
  });

  it("returns 3 after a 3-day sick absence", () => {
    const absences: AbsenceRow[] = [
      {
        assistantId: "asst_01",
        startDate: "2026-02-10",
        endDate: "2026-02-12",
        absenceType: "sjukfrånvaro",
      },
    ];
    const result = sickYtd(absences, "asst_01", 2026);
    expect(result).toBe(3);
  });

  it("clips cross-year sick absence to the target year boundary", () => {
    const absences: AbsenceRow[] = [
      {
        assistantId: "asst_01",
        startDate: "2025-12-29",
        endDate: "2026-01-02",
        absenceType: "sjukfrånvaro",
      },
    ];
    // 2026 portion: Jan 1 – Jan 2 = 2 days
    const result = sickYtd(absences, "asst_01", 2026);
    expect(result).toBe(2);
  });

  it("ignores VAB and semester absences — only counts sjukfrånvaro", () => {
    const mixed: AbsenceRow[] = [
      {
        assistantId: "asst_01",
        startDate: "2026-02-01",
        endDate: "2026-02-05",
        absenceType: "vab",
      },
      {
        assistantId: "asst_01",
        startDate: "2026-02-10",
        endDate: "2026-02-12",
        absenceType: "sjukfrånvaro",
      },
      {
        assistantId: "asst_01",
        startDate: "2026-03-01",
        endDate: "2026-03-07",
        absenceType: "semester",
      },
    ];
    expect(sickYtd(mixed, "asst_01", 2026)).toBe(3); // only the sjukfrånvaro record (3 days)
  });
});
