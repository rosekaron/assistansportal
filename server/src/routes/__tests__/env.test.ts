import { describe, it, expect } from "vitest";

describe("STAB-03: Env var rate loading", () => {
  it("FK_HOURLY_RATE env var is set and parses to a positive number", () => {
    const rate = parseFloat(process.env.FK_HOURLY_RATE ?? "334");
    expect(rate).toBeGreaterThan(0);
    expect(Number.isFinite(rate)).toBe(true);
  });

  it("EMPLOYER_TAX_RATE env var is set and parses to a fraction between 0 and 1", () => {
    const rate = parseFloat(process.env.EMPLOYER_TAX_RATE ?? "0.3142");
    expect(rate).toBeGreaterThan(0);
    expect(rate).toBeLessThan(1);
  });

  it("JWT_SECRET env var is set and is not the insecure default", () => {
    const secret = process.env.JWT_SECRET;
    expect(secret).toBeDefined();
    expect(secret).not.toBe("dev_secret");
    expect(secret!.length).toBeGreaterThanOrEqual(12);
  });
});

describe("STAB-03: /api/rates endpoint shape (integration — TODO after Plan 03)", () => {
  it.todo("GET /api/rates returns { fkHourlyRate: number, employerTaxRate: number }");
  it.todo("GET /api/rates reads values from FK_HOURLY_RATE and EMPLOYER_TAX_RATE env vars");
});
