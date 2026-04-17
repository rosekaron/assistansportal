import { describe, it, expect } from "vitest";
import { computeDeadlines, deadlineBadge } from "./deadlineUtils";

describe("computeDeadlines", () => {
  it("FK deadline = 5th of second following month (Jan → Mar 5)", () => {
    const { fkDeadline } = computeDeadlines("2026-01");
    expect(fkDeadline.getFullYear()).toBe(2026);
    expect(fkDeadline.getMonth()).toBe(2);   // 0-indexed: March
    expect(fkDeadline.getDate()).toBe(5);
  });

  it("AGI deadline = 12th of following month (Jan → Feb 12)", () => {
    const { agiDeadline } = computeDeadlines("2026-01");
    expect(agiDeadline.getFullYear()).toBe(2026);
    expect(agiDeadline.getMonth()).toBe(1);  // 0-indexed: February
    expect(agiDeadline.getDate()).toBe(12);
  });

  it("December edge case: FK deadline = Feb 5 next year", () => {
    const { fkDeadline } = computeDeadlines("2026-12");
    expect(fkDeadline.getFullYear()).toBe(2027);
    expect(fkDeadline.getMonth()).toBe(1);   // 0-indexed: February
    expect(fkDeadline.getDate()).toBe(5);
  });

  it("December edge case: AGI deadline = Jan 12 next year", () => {
    const { agiDeadline } = computeDeadlines("2026-12");
    expect(agiDeadline.getFullYear()).toBe(2027);
    expect(agiDeadline.getMonth()).toBe(0);  // 0-indexed: January
    expect(agiDeadline.getDate()).toBe(12);
  });
});

describe("deadlineBadge", () => {
  it("returns info variant when > 14 days remain", () => {
    const badge = deadlineBadge(20, false);
    expect(badge?.variant).toBe("info");
    expect(badge?.text).toBe("20 days left");
  });

  it("returns warning variant when 8–14 days remain", () => {
    const badge = deadlineBadge(10, false);
    expect(badge?.variant).toBe("warning");
    expect(badge?.text).toBe("10 days left");
  });

  it("returns destructive variant when 1–7 days remain", () => {
    const badge = deadlineBadge(5, false);
    expect(badge?.variant).toBe("destructive");
    expect(badge?.text).toBe("5 days left");
  });

  it("returns Overdue when daysLeft is negative", () => {
    const badge = deadlineBadge(-3, false);
    expect(badge?.variant).toBe("destructive");
    expect(badge?.text).toBe("Overdue");
  });

  it("returns undefined when step is complete", () => {
    const badge = deadlineBadge(10, true);
    expect(badge).toBeUndefined();
  });
});
