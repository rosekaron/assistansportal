// form4805-utils.test.ts — TDD tests for blankett 4805 field map builder.
// RED: Written before implementation.

import { describe, it, expect } from "vitest";
import {
  buildForm4805Fields,
  birthYearFromPno,
  swMonthName,
  type Form4805Input,
} from "./form4805-utils";

const baseProfile = {
  guardianName:  "Anna Svensson",
  guardianPno:   "197001011234",
  guardianPhone: "0701234567",
  address:       "Storgatan 1",
  city:          "Stockholm",
  zip:           "11111",
};

const baseAssistant = {
  name:    "Erik Lindqvist",
  pno:     "199001011234",
  address: "Assistentgatan 5",
};

function makeInput(overrides: Partial<Form4805Input> = {}): Form4805Input {
  return {
    yearMonth:     "2026-03",
    profile:       baseProfile,
    assistant:     baseAssistant,
    payrollRecord: {
      grossPay:              21611.58,
      employerContributions: 6798.52,
      prelimTaxRateSnapshot: 0.30,
    },
    ...overrides,
  };
}

describe("birthYearFromPno", () => {
  it("extracts year from 12-digit pno", () => {
    expect(birthYearFromPno("197001011234")).toBe(1970);
    expect(birthYearFromPno("195001011234")).toBe(1950);
    expect(birthYearFromPno("193001011234")).toBe(1930);
  });

  it("returns null for empty or short string", () => {
    expect(birthYearFromPno("")).toBeNull();
    expect(birthYearFromPno("1234")).toBeNull();
  });
});

describe("swMonthName", () => {
  it("Test 6: returns capitalised Swedish month name for 2026-03 → Mars", () => {
    expect(swMonthName("2026-03")).toBe("Mars");
  });

  it("returns January as Januari", () => {
    expect(swMonthName("2026-01")).toBe("Januari");
  });

  it("returns December as December", () => {
    expect(swMonthName("2026-12")).toBe("December");
  });
});

describe("buildForm4805Fields", () => {
  // Test 1: Born 1970 → codes 04/07 populated; 18/24 absent
  it("Test 1: assistant born 1970 → txtKod04/07 set, txtKod18/24 absent", () => {
    const input = makeInput({
      assistant: { ...baseAssistant, pno: "197001011234" },
    });
    const fields = buildForm4805Fields(input);
    expect(fields["txtKod04[0]"]).toBeDefined();
    expect(fields["txtKod07[0]"]).toBeDefined();
    expect(fields["txtKod18[0]"]).toBeUndefined();
    expect(fields["txtKod24[0]"]).toBeUndefined();
  });

  // Test 2: Born 1950 → codes 18/24 populated; 04/07 absent
  it("Test 2: assistant born 1950 → txtKod18/24 set, txtKod04/07 absent", () => {
    const input = makeInput({
      assistant: { ...baseAssistant, pno: "195001011234" },
    });
    const fields = buildForm4805Fields(input);
    expect(fields["txtKod18[0]"]).toBeDefined();
    expect(fields["txtKod24[0]"]).toBeDefined();
    expect(fields["txtKod04[0]"]).toBeUndefined();
    expect(fields["txtKod07[0]"]).toBeUndefined();
  });

  // Test 3: Born 1930 → none of 04/07/18/24 present
  it("Test 3: assistant born 1930 → no salary/contribution codes present", () => {
    const input = makeInput({
      assistant: { ...baseAssistant, pno: "193001011234" },
    });
    const fields = buildForm4805Fields(input);
    expect(fields["txtKod04[0]"]).toBeUndefined();
    expect(fields["txtKod07[0]"]).toBeUndefined();
    expect(fields["txtKod18[0]"]).toBeUndefined();
    expect(fields["txtKod24[0]"]).toBeUndefined();
  });

  // Test 4: txtKod09[0] = round(21611.58 × 0.30) = round(6483.474) = 6483
  it("Test 4: txtKod09 = round(grossPay × prelimTaxRate) → 6483", () => {
    const input = makeInput({
      payrollRecord: {
        grossPay:              21611.58,
        employerContributions: 6798.52,
        prelimTaxRateSnapshot: 0.30,
      },
    });
    const fields = buildForm4805Fields(input);
    expect(fields["txtKod09[0]"]).toBe("6483");
  });

  // Test 5: txtKod10[0] = round(employerContributions + grossPay × prelimTaxRate)
  // = round(6798.52 + 6483.474) = round(13281.994) = 13282
  it("Test 5: txtKod10 = round(employerContributions + grossPay × prelimTaxRate)", () => {
    const input = makeInput({
      payrollRecord: {
        grossPay:              21611.58,
        employerContributions: 6798.52,
        prelimTaxRateSnapshot: 0.30,
      },
    });
    const fields = buildForm4805Fields(input);
    const expected = String(Math.round(6798.52 + 21611.58 * 0.30));
    expect(fields["txtKod10[0]"]).toBe(expected);
  });

  // Test 6: txtManad[0] for month 2026-03 → "Mars"
  it("Test 6: txtManad[0] for 2026-03 → Mars", () => {
    const fields = buildForm4805Fields(makeInput({ yearMonth: "2026-03" }));
    expect(fields["txtManad[0]"]).toBe("Mars");
  });

  // Test 7: all monetary values are strings of integers (no decimals)
  it("Test 7: all monetary fields are integer strings (no decimals)", () => {
    const fields = buildForm4805Fields(makeInput());
    const monetaryFields = [
      "txtKod04[0]", "txtKod07[0]", "txtKod18[0]", "txtKod24[0]",
      "txtKod06[0]", "txtKod09[0]", "txtKod10[0]",
    ];
    for (const key of monetaryFields) {
      if (fields[key] !== undefined) {
        expect(fields[key], `Expected ${key} to be an integer string, got: ${fields[key]}`).toMatch(/^\d+$/);
      }
    }
  });

  it("populates header fields correctly", () => {
    const fields = buildForm4805Fields(makeInput({ yearMonth: "2026-03" }));
    expect(fields["txtManad[0]"]).toBe("Mars");
    expect(fields["txtRattelseDatum[0]"]).toBe("");
  });

  it("populates employer (guardian) fields using __employer__ prefix", () => {
    const fields = buildForm4805Fields(makeInput());
    expect(fields["__employer__txtNamn[0]"]).toBe("Anna Svensson");
    expect(fields["__employer__txtPersNr[0]"]).toBe("197001011234");
    expect(fields["__employer__txtAdress[0]"]).toBe("Storgatan 1, 11111 Stockholm");
  });

  it("populates recipient (assistant) fields using __recipient__ prefix", () => {
    const fields = buildForm4805Fields(makeInput());
    expect(fields["__recipient__txtNamn[0]"]).toBe("Erik Lindqvist");
    expect(fields["__recipient__txtPersNr[0]"]).toBe("199001011234");
    expect(fields["__recipient__txtAdress[0]"]).toBe("Assistentgatan 5");
  });

  it("populates signature block fields", () => {
    const fields = buildForm4805Fields(makeInput());
    expect(fields["txtNamnfortydl[0]"]).toBe("Anna Svensson");
    expect(fields["txtNTelefon[0]"]).toBe("0701234567");
  });
});
