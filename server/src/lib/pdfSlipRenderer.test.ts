// pdfSlipRenderer.test.ts — smoke test for the pdfkit renderer.
// D-14 skips golden PDF byte comparison; we assert only the minimum invariants
// that prove pdfkit produced a valid PDF of non-trivial length.

import { describe, it, expect } from "vitest";
import { renderAnhorigSlipPdf } from "./pdfSlipRenderer";
import type { SlipFields } from "./payrollSlipUtils";

const goldenFields: SlipFields = {
  documentNumber: "LS-2026-03-001",
  reportPeriodLabel: "1 mars \u2013 31 mars 2026",
  payDateLabel: "25 april 2026",
  payMethodLabel: "Bankgiro",
  avtalsmodellLabel: "Anhörigassistans (fast timlön, ej sjuk/sem)",
  employer: {
    name: "Liam Karon",
    pno: "201501011234",
    address: "Storgatan 1, 11122 Stockholm",
  },
  representative: { name: "Rose Karon", pno: "198011155069" },
  employee: { name: "Rose Karon", pno: "198011155069" },
  bankLine: "Bankgiro 1234-567890",
  hourlyRate: 254.10,
  hours: {
    worked: 215,
    sjuk: 0,
    vab: 0,
    semester: 0,
    other: 0,
    vabYtdUsed: 0,
  },
  lön: {
    gross: 54631.5,
    sjukLön: 0,
    vabLön: 0,
    semesterLön: 0,
    bruttoLön: 54631.5,
  },
  avdrag: {
    prelimSkatt: -16389.45,
    prelimSkattRate: 0.30,
    nettoTillBank: 38242.05,
  },
};

describe("renderAnhorigSlipPdf", () => {
  it("returns a Buffer starting with %PDF- magic bytes and length > 1000", async () => {
    const buf = await renderAnhorigSlipPdf(goldenFields);
    expect(Buffer.isBuffer(buf)).toBe(true);
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("renders without representative when fields.representative === null", async () => {
    const buf = await renderAnhorigSlipPdf({ ...goldenFields, representative: null });
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });

  it("renders without bank line when fields.bankLine === null", async () => {
    const buf = await renderAnhorigSlipPdf({ ...goldenFields, bankLine: null });
    expect(buf.length).toBeGreaterThan(1000);
    expect(buf.slice(0, 5).toString()).toBe("%PDF-");
  });
});
