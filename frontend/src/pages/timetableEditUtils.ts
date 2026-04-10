import type { EditCommitSessionStartResponse } from "../lib/api";

export function formatEditDiffSummary(
  diff: EditCommitSessionStartResponse["diff"],
): string {
  return `Add: ${diff.summary.added}, Remove: ${diff.summary.removed}, Slot-change: ${diff.summary.changedSlot}, Venue-change: ${diff.summary.changedVenue}`;
}
