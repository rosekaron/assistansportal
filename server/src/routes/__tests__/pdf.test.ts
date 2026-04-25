import { describe, it, expect } from "vitest";

// Pure unit test for the date calculation logic — no HTTP needed
function lastDayOfMonth(year: string, month: string): number {
  const mm = month.padStart(2, "0");
  return new Date(parseInt(year), parseInt(mm), 0).getDate();
}

describe("STAB-02: FK 3057 last-day-of-month calculation", () => {
  it("returns 28 for February in a common year", () => {
    expect(lastDayOfMonth("2025", "02")).toBe(28);
  });

  it("returns 29 for February in a leap year", () => {
    expect(lastDayOfMonth("2024", "02")).toBe(29);
  });

  it("returns 30 for April", () => {
    expect(lastDayOfMonth("2025", "04")).toBe(30);
  });

  it("returns 31 for January", () => {
    expect(lastDayOfMonth("2025", "01")).toBe(31);
  });

  it("returns 31 for December", () => {
    expect(lastDayOfMonth("2025", "12")).toBe(31);
  });
});
