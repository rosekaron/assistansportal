import { describe, it, expect } from "vitest";
import { shouldSendReminder, buildPendingSteps } from "./reminderCron";

describe("shouldSendReminder", () => {
  it("returns true when today matches reminder day", () => {
    expect(shouldSendReminder(15, 15)).toBe(true);
  });

  it("returns false when today does not match reminder day", () => {
    expect(shouldSendReminder(14, 15)).toBe(false);
  });

  it("returns false for reminder day 0 (invalid)", () => {
    expect(shouldSendReminder(1, 0)).toBe(false);
  });

  it("returns false for reminder day 29 (exceeds max 28)", () => {
    expect(shouldSendReminder(1, 29)).toBe(false);
  });

  it("returns false for reminder day 28 when today is 1", () => {
    expect(shouldSendReminder(1, 28)).toBe(false);
  });
});

describe("buildPendingSteps", () => {
  it("returns all four steps when nothing is complete", () => {
    const steps = buildPendingSteps({
      reportsApproved: false,
      payrollApproved: false,
      fkGenerated: false,
      agiGenerated: false,
    });
    expect(steps).toHaveLength(4);
  });

  it("excludes completed steps from the list", () => {
    const steps = buildPendingSteps({
      reportsApproved: true,
      payrollApproved: false,
      fkGenerated: false,
      agiGenerated: false,
    });
    expect(steps).toHaveLength(3);
    expect(steps.some(s => s.toLowerCase().includes("report"))).toBe(false);
  });

  it("returns empty array when all steps are complete", () => {
    const steps = buildPendingSteps({
      reportsApproved: true,
      payrollApproved: true,
      fkGenerated: true,
      agiGenerated: true,
    });
    expect(steps).toHaveLength(0);
  });
});
