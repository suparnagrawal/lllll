import { describe, expect, it } from "vitest";
import { formatEditDiffSummary } from "../timetableEditUtils";

describe("formatEditDiffSummary", () => {
  it("formats all diff counters in a stable order", () => {
    const text = formatEditDiffSummary({
      summary: {
        total: 5,
        added: 1,
        removed: 2,
        changedSlot: 1,
        changedVenue: 1,
      },
      changedLabels: ["l1", "l2"],
      operations: [],
      affectedRows: 4,
      unchangedRows: 9,
      expectedVersion: 3,
      currentVersion: 3,
    });

    expect(text).toBe("Add: 1, Remove: 2, Slot-change: 1, Venue-change: 1");
  });
});
