// employer-representation.test.ts — TDD tests for the employer/representative helper.
// Covers D-13 named cases (minor-by-pno, adult-with-override, adult-without-override,
// turns 18 during report month) plus malformed-pno + address-fallback edge cases.

import { describe, it, expect } from "vitest";
import { resolveEmployerRepresentation, isMinor } from "./employer-representation";

const baseProfile = {
  patientName: "Liam Karon",
  patientPno: "201501011234",
  guardianName: "Rose Karon",
  guardianPno: "198011155069",
  address: "Storgatan 1",
  addressStreet: "",
  addressZip: "",
  addressCity: "",
  patientRequiresRepresentative: false,
} as const;

describe("resolveEmployerRepresentation", () => {
  it("(a) minor-by-pno, flag false → representative present (parent as representative)", () => {
    const rep = resolveEmployerRepresentation(baseProfile, new Date(2026, 2, 31));
    expect(rep.isMinor).toBe(true);
    expect(rep.arbetsgivare.name).toBe("Liam Karon");
    expect(rep.arbetsgivare.pno).toBe("201501011234");
    expect(rep.företrädare?.name).toBe("Rose Karon");
    expect(rep.företrädare?.pno).toBe("198011155069");
  });

  it("(b) adult-with-override, flag true → representative present (god-man case)", () => {
    const rep = resolveEmployerRepresentation(
      { ...baseProfile, patientPno: "197001011234", patientRequiresRepresentative: true },
      new Date(2026, 2, 31),
    );
    expect(rep.isMinor).toBe(false);
    expect(rep.arbetsgivare.name).toBe("Liam Karon");
    expect(rep.företrädare).not.toBeNull();
    expect(rep.företrädare?.name).toBe("Rose Karon");
  });

  it("(c) adult-without-override, flag false → representative null", () => {
    const rep = resolveEmployerRepresentation(
      { ...baseProfile, patientPno: "197001011234", patientRequiresRepresentative: false },
      new Date(2026, 2, 31),
    );
    expect(rep.isMinor).toBe(false);
    expect(rep.företrädare).toBeNull();
  });

  it("(c') adult-without-override, flag null → representative null (null treated as false)", () => {
    const rep = resolveEmployerRepresentation(
      { ...baseProfile, patientPno: "197001011234", patientRequiresRepresentative: null },
      new Date(2026, 2, 31),
    );
    expect(rep.isMinor).toBe(false);
    expect(rep.företrädare).toBeNull();
  });

  it("(d) turns 18 during report month → adult at end-of-period (D-02)", () => {
    // Born 2008-03-15 → turns 18 on 2026-03-15. Report period 2026-03 ends 2026-03-31.
    const rep = resolveEmployerRepresentation(
      { ...baseProfile, patientPno: "200803151234" },
      new Date(2026, 2, 31),
    );
    expect(rep.isMinor).toBe(false); // end-of-period wins
    expect(rep.företrädare).toBeNull(); // flag is false
  });

  it("(d') one day before 18th birthday → still minor", () => {
    // Born 2008-03-15 → asOfDate 2026-03-14 (one day before 18th birthday)
    const rep = resolveEmployerRepresentation(
      { ...baseProfile, patientPno: "200803151234" },
      new Date(2026, 2, 14),
    );
    expect(rep.isMinor).toBe(true);
    expect(rep.företrädare).not.toBeNull();
  });

  it("malformed pno (empty string) → does not throw; isMinor=false; representative null when flag false", () => {
    const rep = resolveEmployerRepresentation(
      { ...baseProfile, patientPno: "" },
      new Date(2026, 2, 31),
    );
    expect(rep.isMinor).toBe(false);
    expect(rep.företrädare).toBeNull();
    expect(rep.arbetsgivare.name).toBe("Liam Karon"); // name still populated from profile
  });

  it("malformed pno (too short, 7 digits) → does not throw; same degradation as empty", () => {
    const rep = resolveEmployerRepresentation(
      { ...baseProfile, patientPno: "1234567" },
      new Date(2026, 2, 31),
    );
    expect(rep.isMinor).toBe(false);
    expect(rep.företrädare).toBeNull();
    expect(rep.arbetsgivare.name).toBe("Liam Karon");
  });

  it("address fallback: split columns populated → uses split format '{street}, {zip} {city}'", () => {
    const rep = resolveEmployerRepresentation(
      {
        ...baseProfile,
        address: "Legacy address 99",
        addressStreet: "Storgatan 1",
        addressZip: "11122",
        addressCity: "Stockholm",
      },
      new Date(2026, 2, 31),
    );
    expect(rep.arbetsgivare.address).toBe("Storgatan 1, 11122 Stockholm");
  });

  it("address fallback: split columns empty, legacy address set → uses single-line", () => {
    const rep = resolveEmployerRepresentation(
      {
        ...baseProfile,
        address: "Storgatan 1",
        addressStreet: "",
        addressZip: "",
        addressCity: "",
      },
      new Date(2026, 2, 31),
    );
    expect(rep.arbetsgivare.address).toBe("Storgatan 1");
  });

  it("address fallback: all address fields empty/null → returns empty string (no crash)", () => {
    const rep = resolveEmployerRepresentation(
      {
        ...baseProfile,
        address: null,
        addressStreet: null,
        addressZip: null,
        addressCity: null,
      },
      new Date(2026, 2, 31),
    );
    expect(rep.arbetsgivare.address).toBe("");
  });

  it("null patientName / guardianName → returns empty strings, no crash", () => {
    const rep = resolveEmployerRepresentation(
      {
        patientName: null,
        patientPno: null,
        guardianName: null,
        guardianPno: null,
        patientRequiresRepresentative: null,
        address: null,
        addressStreet: null,
        addressZip: null,
        addressCity: null,
      },
      new Date(2026, 2, 31),
    );
    expect(rep.arbetsgivare.name).toBe("");
    expect(rep.arbetsgivare.pno).toBe("");
    expect(rep.arbetsgivare.address).toBe("");
    expect(rep.isMinor).toBe(false);
    expect(rep.företrädare).toBeNull();
  });
});

describe("isMinor", () => {
  it("minor pno (child born 2015) is minor as of 2026-03-31", () => {
    expect(isMinor("201501011234", new Date(2026, 2, 31))).toBe(true);
  });

  it("adult pno (born 1970) is not minor as of 2026-03-31", () => {
    expect(isMinor("197001011234", new Date(2026, 2, 31))).toBe(false);
  });

  it("empty pno returns false", () => {
    expect(isMinor("", new Date(2026, 2, 31))).toBe(false);
  });

  it("malformed pno (too short) returns false", () => {
    expect(isMinor("123", new Date(2026, 2, 31))).toBe(false);
  });
});
