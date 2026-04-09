/**
 * Slot System Change Workspace Service
 *
 * Manages structural modifications to locked slot systems through a
 * preview → apply workflow. Acquires a booking freeze during apply,
 * mutates days/bands/blocks, recomputes affected allocations, and
 * releases the freeze on completion or error.
 */

import { db } from "../../db";
import { eq, and, inArray } from "drizzle-orm";
import {
  timetableImportBatches,
  timetableImportOccurrences,
  bookings,
} from "../../db/schema";
import {
  freezeBookings,
  unfreezeBookings,
} from "../../services/bookingFreezeService";
import logger from "../../shared/utils/logger";
import { slotBlocks, slotDays, slotSystems, slotTimeBands } from "./schema";
import {
  createServiceError,
  isTimetableServiceError,
  createDay,
  deleteDay,
  createTimeBand,
  updateTimeBand,
  deleteTimeBand,
  createBlock,
  deleteBlock,
  addDayLane,
  removeDayLane,
} from "./service";

// ============================================================================
// Types
// ============================================================================

export type SlotSystemChangeInput = {
  slotSystemId: number;
  changes: {
    addDays?: Array<{ dayOfWeek: string; orderIndex?: number }>;
    removeDayIds?: number[];
    addTimeBands?: Array<{ startTime: string; endTime: string; orderIndex?: number }>;
    removeTimeBandIds?: number[];
    updateTimeBands?: Array<{
      timeBandId: number;
      startTime?: string;
      endTime?: string;
      orderIndex?: number;
    }>;
    addBlocks?: Array<{
      dayId: number;
      startBandId: number;
      laneIndex: number;
      rowSpan: number;
      label: string;
    }>;
    removeBlockIds?: number[];
    addLaneDayIds?: number[];
    removeLaneDayIds?: number[];
  };
};

export type ChangePreviewResult = {
  slotSystemId: number;
  isLocked: boolean;
  summary: {
    daysToAdd: number;
    daysToRemove: number;
    timeBandsToAdd: number;
    timeBandsToRemove: number;
    timeBandsToUpdate: number;
    blocksToAdd: number;
    blocksToRemove: number;
    lanesToAdd: number;
    lanesToRemove: number;
  };
  affectedBatches: Array<{
    batchId: number;
    status: string;
    affectedOccurrences: number;
  }>;
  warnings: string[];
};

export type ChangeApplyResult = {
  slotSystemId: number;
  applied: {
    daysAdded: number;
    daysRemoved: number;
    timeBandsAdded: number;
    timeBandsRemoved: number;
    timeBandsUpdated: number;
    blocksAdded: number;
    blocksRemoved: number;
    lanesAdded: number;
    lanesRemoved: number;
  };
  recomputation: {
    affectedOccurrences: number;
    deletedBookings: number;
    warnings: string[];
  };
};

// ============================================================================
// Preview Changes
// ============================================================================

/**
 * Preview the impact of proposed changes to a slot system without applying them.
 */
export async function previewSlotSystemChanges(
  input: SlotSystemChangeInput,
): Promise<ChangePreviewResult> {
  const { slotSystemId, changes } = input;

  const [system] = await db
    .select()
    .from(slotSystems)
    .where(eq(slotSystems.id, slotSystemId))
    .limit(1);

  if (!system) {
    throw createServiceError(404, "Slot system not found");
  }

  const warnings: string[] = [];

  const summary = {
    daysToAdd: changes.addDays?.length ?? 0,
    daysToRemove: changes.removeDayIds?.length ?? 0,
    timeBandsToAdd: changes.addTimeBands?.length ?? 0,
    timeBandsToRemove: changes.removeTimeBandIds?.length ?? 0,
    timeBandsToUpdate: changes.updateTimeBands?.length ?? 0,
    blocksToAdd: changes.addBlocks?.length ?? 0,
    blocksToRemove: changes.removeBlockIds?.length ?? 0,
    lanesToAdd: changes.addLaneDayIds?.length ?? 0,
    lanesToRemove: changes.removeLaneDayIds?.length ?? 0,
  };

  // Check affected committed batches
  const committedBatches = await db
    .select({
      id: timetableImportBatches.id,
      status: timetableImportBatches.status,
    })
    .from(timetableImportBatches)
    .where(
      and(
        eq(timetableImportBatches.slotSystemId, slotSystemId),
        eq(timetableImportBatches.status, "COMMITTED"),
      ),
    );

  const affectedBatches: ChangePreviewResult["affectedBatches"] = [];

  for (const batch of committedBatches) {
    // Count occurrences that reference blocks being removed
    let affectedOccurrences = 0;

    if (changes.removeBlockIds && changes.removeBlockIds.length > 0) {
      // Count rows in this batch that reference blocks being removed
      const blockLabels = await db
        .select({ label: slotBlocks.label })
        .from(slotBlocks)
        .where(inArray(slotBlocks.id, changes.removeBlockIds));

      if (blockLabels.length > 0) {
        const [countResult] = await db
          .select({
            count: db.$count(timetableImportOccurrences),
          })
          .from(timetableImportOccurrences)
          .where(
            and(
              eq(timetableImportOccurrences.batchId, batch.id),
              eq(timetableImportOccurrences.status, "CREATED"),
            ),
          );

        affectedOccurrences = countResult?.count ?? 0;
      }
    }

    affectedBatches.push({
      batchId: batch.id,
      status: batch.status,
      affectedOccurrences,
    });
  }

  if (changes.removeBlockIds && changes.removeBlockIds.length > 0) {
    warnings.push(
      `Removing ${changes.removeBlockIds.length} block(s) may invalidate existing allocations`,
    );
  }

  if (changes.removeTimeBandIds && changes.removeTimeBandIds.length > 0) {
    warnings.push(
      `Removing ${changes.removeTimeBandIds.length} time band(s) will cascade-delete associated blocks`,
    );
  }

  if (changes.removeDayIds && changes.removeDayIds.length > 0) {
    warnings.push(
      `Removing ${changes.removeDayIds.length} day(s) will cascade-delete associated blocks`,
    );
  }

  return {
    slotSystemId,
    isLocked: system.isLocked,
    summary,
    affectedBatches,
    warnings,
  };
}

// ============================================================================
// Apply Changes
// ============================================================================

/**
 * Apply structural changes to a locked slot system.
 * Acquires booking freeze, applies mutations, cleans up stale bookings, releases freeze.
 */
export async function applySlotSystemChanges(
  input: SlotSystemChangeInput,
  userId: number,
  userName: string,
): Promise<ChangeApplyResult> {
  const { slotSystemId, changes } = input;

  const [system] = await db
    .select()
    .from(slotSystems)
    .where(eq(slotSystems.id, slotSystemId))
    .limit(1);

  if (!system) {
    throw createServiceError(404, "Slot system not found");
  }

  // Use a virtual batchId for freeze (negative to avoid conflicts with real batches)
  const freezeBatchId = -(slotSystemId * 1000 + Date.now() % 1000);

  const freezeResult = freezeBookings(freezeBatchId, userId, userName);
  if (!freezeResult.ok) {
    throw createServiceError(
      409,
      `Cannot apply changes: ${freezeResult.message}`,
    );
  }

  logger.info("Booking operations frozen for slot system change", {
    slotSystemId,
    userId,
    freezeBatchId,
  });

  const result: ChangeApplyResult = {
    slotSystemId,
    applied: {
      daysAdded: 0,
      daysRemoved: 0,
      timeBandsAdded: 0,
      timeBandsRemoved: 0,
      timeBandsUpdated: 0,
      blocksAdded: 0,
      blocksRemoved: 0,
      lanesAdded: 0,
      lanesRemoved: 0,
    },
    recomputation: {
      affectedOccurrences: 0,
      deletedBookings: 0,
      warnings: [],
    },
  };

  try {
    // 1. Remove blocks first (so time band / day deletion cascades cleanly)
    if (changes.removeBlockIds) {
      for (const blockId of changes.removeBlockIds) {
        try {
          await deleteBlock(blockId, true); // bypassLock = true
          result.applied.blocksRemoved++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.recomputation.warnings.push(
            `Failed to remove block ${blockId}: ${msg}`,
          );
        }
      }
    }

    // 2. Remove time bands
    if (changes.removeTimeBandIds) {
      for (const timeBandId of changes.removeTimeBandIds) {
        try {
          await deleteTimeBand(timeBandId, true);
          result.applied.timeBandsRemoved++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.recomputation.warnings.push(
            `Failed to remove time band ${timeBandId}: ${msg}`,
          );
        }
      }
    }

    // 3. Remove days
    if (changes.removeDayIds) {
      for (const dayId of changes.removeDayIds) {
        try {
          await deleteDay(dayId, true);
          result.applied.daysRemoved++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.recomputation.warnings.push(
            `Failed to remove day ${dayId}: ${msg}`,
          );
        }
      }
    }

    // 4. Add new days
    if (changes.addDays) {
      for (const dayInput of changes.addDays) {
        try {
          await createDay({
            slotSystemId,
            dayOfWeek: dayInput.dayOfWeek,
            ...(dayInput.orderIndex !== undefined ? { orderIndex: dayInput.orderIndex } : {}),
            bypassLock: true,
          });
          result.applied.daysAdded++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.recomputation.warnings.push(
            `Failed to add day ${dayInput.dayOfWeek}: ${msg}`,
          );
        }
      }
    }

    // 5. Add new time bands
    if (changes.addTimeBands) {
      for (const bandInput of changes.addTimeBands) {
        try {
          await createTimeBand({
            slotSystemId,
            startTime: bandInput.startTime,
            endTime: bandInput.endTime,
            ...(bandInput.orderIndex !== undefined ? { orderIndex: bandInput.orderIndex } : {}),
            bypassLock: true,
          });
          result.applied.timeBandsAdded++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.recomputation.warnings.push(
            `Failed to add time band ${bandInput.startTime}-${bandInput.endTime}: ${msg}`,
          );
        }
      }
    }

    // 6. Update time bands
    if (changes.updateTimeBands) {
      for (const update of changes.updateTimeBands) {
        try {
          await updateTimeBand({
            timeBandId: update.timeBandId,
            ...(update.startTime !== undefined ? { startTime: update.startTime } : {}),
            ...(update.endTime !== undefined ? { endTime: update.endTime } : {}),
            ...(update.orderIndex !== undefined ? { orderIndex: update.orderIndex } : {}),
            bypassLock: true,
          });
          result.applied.timeBandsUpdated++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.recomputation.warnings.push(
            `Failed to update time band ${update.timeBandId}: ${msg}`,
          );
        }
      }
    }

    // 7. Add new blocks
    if (changes.addBlocks) {
      for (const blockInput of changes.addBlocks) {
        try {
          await createBlock({
            slotSystemId,
            dayId: blockInput.dayId,
            startBandId: blockInput.startBandId,
            laneIndex: blockInput.laneIndex,
            rowSpan: blockInput.rowSpan,
            label: blockInput.label,
            bypassLock: true,
          });
          result.applied.blocksAdded++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.recomputation.warnings.push(
            `Failed to add block ${blockInput.label}: ${msg}`,
          );
        }
      }
    }

    // 8. Lane modifications
    if (changes.addLaneDayIds) {
      for (const dayId of changes.addLaneDayIds) {
        try {
          await addDayLane(dayId, true);
          result.applied.lanesAdded++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.recomputation.warnings.push(
            `Failed to add lane to day ${dayId}: ${msg}`,
          );
        }
      }
    }

    if (changes.removeLaneDayIds) {
      for (const dayId of changes.removeLaneDayIds) {
        try {
          await removeDayLane(dayId, true);
          result.applied.lanesRemoved++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          result.recomputation.warnings.push(
            `Failed to remove lane from day ${dayId}: ${msg}`,
          );
        }
      }
    }

    // 9. Clean up orphaned occurrences and bookings
    //    Find CREATED occurrences whose sourceRef references blocks that no longer exist
    const committedBatches = await db
      .select({ id: timetableImportBatches.id })
      .from(timetableImportBatches)
      .where(
        and(
          eq(timetableImportBatches.slotSystemId, slotSystemId),
          eq(timetableImportBatches.status, "COMMITTED"),
        ),
      );

    if (committedBatches.length > 0) {
      const batchIds = committedBatches.map((b) => b.id);

      // Find occurrences with bookings that reference deleted blocks
      const orphanedOccurrences = await db
        .select({
          id: timetableImportOccurrences.id,
          bookingId: timetableImportOccurrences.bookingId,
          sourceRef: timetableImportOccurrences.sourceRef,
        })
        .from(timetableImportOccurrences)
        .where(
          and(
            inArray(timetableImportOccurrences.batchId, batchIds),
            eq(timetableImportOccurrences.status, "CREATED"),
          ),
        );

      // Extract block IDs from sourceRefs and check if blocks still exist
      const currentBlocks = await db
        .select({ id: slotBlocks.id })
        .from(slotBlocks)
        .where(eq(slotBlocks.slotSystemId, slotSystemId));

      const currentBlockIds = new Set(currentBlocks.map((b) => b.id));

      for (const occ of orphanedOccurrences) {
        // Parse block ID from sourceRef like "batch:1:row:2:block:3"
        const blockMatch = occ.sourceRef?.match(/block:(\d+)/);
        if (!blockMatch) continue;

        const blockId = Number(blockMatch[1]);
        if (currentBlockIds.has(blockId)) continue;

        // Block was deleted — remove associated booking and mark occurrence
        result.recomputation.affectedOccurrences++;

        if (occ.bookingId) {
          await db.delete(bookings).where(eq(bookings.id, occ.bookingId));
          result.recomputation.deletedBookings++;
        }

        await db
          .update(timetableImportOccurrences)
          .set({
            status: "FAILED",
            errorMessage: "Block removed during slot system change",
            bookingId: null,
          })
          .where(eq(timetableImportOccurrences.id, occ.id));
      }
    }

    logger.info("Slot system changes applied", {
      slotSystemId,
      userId,
      applied: result.applied,
      recomputation: result.recomputation,
    });
  } catch (error) {
    logger.error("Error during slot system change, unfreezing", {
      slotSystemId,
      userId,
      error,
    });
    throw error;
  } finally {
    unfreezeBookings(freezeBatchId, true); // force unfreeze
  }

  return result;
}
