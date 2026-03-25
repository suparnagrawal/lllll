import { Router } from "express";
import { db } from "../db";
import { bookings, rooms } from "../db/schema";
import { eq, and, lt, gt } from "drizzle-orm";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";

const router = Router();

router.get("/:id", authMiddleware, async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const result = await db
      .select()
      .from(bookings)
      .where(eq(bookings.id, id));

    if (result.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    return res.json(result[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Fetch failed" });
  }
});

// -------------------------------------
// GET /bookings
// Optional query: ?roomId=1
// -------------------------------------
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { startAt, endAt, roomId, buildingId } = req.query;

    const parsedStartAt = startAt ? new Date(startAt as string) : null;
    const parsedEndAt = endAt ? new Date(endAt as string) : null;

    const parsedRoomId = roomId ? Number(roomId) : null;
    const parsedBuildingId = buildingId ? Number(buildingId) : null;

    // ------------------------
    // Validation
    // ------------------------
    if ((parsedStartAt && !parsedEndAt) || (!parsedStartAt && parsedEndAt)) {
      return res.status(400).json({
        error: "Both startAt and endAt must be provided together",
      });
    }

    if (parsedStartAt && parsedEndAt) {
      if (isNaN(parsedStartAt.getTime()) || isNaN(parsedEndAt.getTime())) {
        return res.status(400).json({
          error: "Invalid date format",
        });
      }

      if (parsedStartAt >= parsedEndAt) {
        return res.status(400).json({
          error: "startAt must be less than endAt",
        });
      }
    }

    if (parsedRoomId !== null && isNaN(parsedRoomId)) {
      return res.status(400).json({ error: "Invalid roomId" });
    }

    if (parsedBuildingId !== null && isNaN(parsedBuildingId)) {
      return res.status(400).json({ error: "Invalid buildingId" });
    }

    // ------------------------
    // Build conditions
    // ------------------------
    const conditions = [];

    if (parsedRoomId !== null) {
      conditions.push(eq(bookings.roomId, parsedRoomId));
    }

    if (parsedStartAt && parsedEndAt) {
      conditions.push(
        and(
          lt(bookings.startAt, parsedEndAt),
          gt(bookings.endAt, parsedStartAt)
        )
      );
    }

    if (parsedBuildingId !== null) {
      conditions.push(eq(rooms.buildingId, parsedBuildingId));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    // ------------------------
    // Execute query (type-safe branches)
    // ------------------------
    let result;

    if (parsedBuildingId !== null) {
      const query = db
        .select()
        .from(bookings)
        .innerJoin(rooms, eq(bookings.roomId, rooms.id));

      result = whereClause ? await query.where(whereClause) : await query;
    } else {
      const query = db.select().from(bookings);

      result = whereClause ? await query.where(whereClause) : await query;
    }

    if (parsedBuildingId !== null) {
      // result is joined → extract bookings
      const normalized = result.map((row: any) => row.bookings);
      return res.json(normalized);
    }

    return res.json(result);

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});


// -------------------------------------
// POST /bookings
// Body: { roomId, startAt, endAt }
// -------------------------------------
router.post("/", authMiddleware, requireRole(["ADMIN", "STAFF"]), async (req, res) => {
  try {
    const { roomId, startAt, endAt } = req.body ?? {};

    // ------------------------
    // Validation
    // ------------------------
    if (!roomId || !startAt || !endAt) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const parsedRoomId = Number(roomId);
    const start = new Date(startAt);
    const end = new Date(endAt);

    if (isNaN(parsedRoomId)) {
      return res.status(400).json({ error: "Invalid roomId" });
    }

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid datetime format" });
    }

    if (start >= end) {
      return res.status(400).json({ error: "startAt must be before endAt" });
    }

    // ------------------------
    // Check room exists
    // ------------------------
    const roomExists = await db
      .select()
      .from(rooms)
      .where(eq(rooms.id, parsedRoomId))
      .limit(1);

    if (roomExists.length === 0) {
      return res.status(404).json({ error: "Room not found" });
    }

    // ------------------------
    // Overlap check
    // existing.start < new.end AND existing.end > new.start
    // ------------------------
    const overlapping = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.roomId, parsedRoomId),
          lt(bookings.startAt, end),
          gt(bookings.endAt, start)
        )
      )
      .limit(1);

    if (overlapping.length > 0) {
      return res.status(409).json({ error: "Room already booked for this time range" });
    }

    // ------------------------
    // Insert booking
    // ------------------------
    const inserted = await db
      .insert(bookings)
      .values({
        roomId: parsedRoomId,
        startAt: start,
        endAt: end,
      })
      .returning();

    return res.status(201).json(inserted[0]);

  } catch (error: any) {
  if (error?.cause?.code === "23503") {
    return res.status(404).json({ error: "Room not found" });
  }

  if (error?.cause?.code === "23P01") {
    return res.status(409).json({
      error: "Room already booked for this time range",
    });
  }

  res.status(500).json({ error: "Insert failed" });
}
});

// -------------------------------------
// DELETE /bookings/:id
// -------------------------------------
router.delete("/:id", authMiddleware, requireRole(["ADMIN", "STAFF"]), async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    const deleted = await db
      .delete(bookings)
      .where(eq(bookings.id, id))
      .returning();

    if (deleted.length === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }

    return res.status(204).send();

  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;