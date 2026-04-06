import { describe, it, expect } from "vitest";
import type { Entry } from "@/lib/types";

// Type-level regression: verify that Entry fields are camelCase.
// These tests check runtime field names that match the Drizzle schema output.
// Import is from client/src/lib/types.ts — the real exported interface.
// If these tests fail to compile, the camelCase fix is incomplete.

describe("STAB-04: Entry type uses camelCase field names", () => {
  it("Entry interface has reqStatus (not req_status)", () => {
    const entry = {} as Entry;
    // TypeScript will error at compile time if the field does not exist
    const _reqStatus: string | null = entry.reqStatus;
    expect(true).toBe(true); // compile-time check; runtime always passes
  });

  it("Entry interface has repStatus (not rep_status)", () => {
    const entry = {} as Entry;
    const _repStatus: string | null = entry.repStatus;
    expect(true).toBe(true);
  });

  it("Entry interface has startTime (not start_time)", () => {
    const entry = {} as Entry;
    const _startTime: string = entry.startTime;
    expect(true).toBe(true);
  });

  it("Entry interface has endTime (not end_time)", () => {
    const entry = {} as Entry;
    const _endTime: string = entry.endTime;
    expect(true).toBe(true);
  });

  it("Entry interface has assistantId (not assistant_id)", () => {
    const entry = {} as Entry;
    const _assistantId: string = entry.assistantId;
    expect(true).toBe(true);
  });

  it("filtering entries by reqStatus compiles and works", () => {
    const mockEntries: Entry[] = [
      { id: "e1", assistantId: "a1", date: "2025-01-01", startTime: "08:00",
        endTime: "16:00", hours: 8, entryType: "active", reqStatus: "approved",
        repStatus: "pending", source: "proposal", calStatus: null,
        activityId: null, gcalEventId: null, createdAt: null, updatedAt: null },
    ];
    const pending = mockEntries.filter(e => e.reqStatus === "approved" && e.repStatus === "pending");
    expect(pending).toHaveLength(1);
  });
});
