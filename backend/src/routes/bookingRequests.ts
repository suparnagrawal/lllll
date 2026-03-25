import { Router } from "express";
import { db } from "../db";
import { eq,lt,gt,and } from "drizzle-orm";
import { bookings, bookingRequests } from "../db/schema";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// GET /booking-requests/:id
// Fetch a single booking request by ID
// Returns: booking request object
// Errors: 400 (invalid id), 404 (not found)

router.get("/:id", async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const rows = await db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.id, id));

    const [bookingRequest] = rows;

    if (!bookingRequest) {
      return res.status(404).json({ error: "Request not found" });
    }

    return res.json(bookingRequest);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch request" });
  }
});

// GET /booking-requests
// Fetch all booking requests
// Optional query param: ?status=PENDING | APPROVED | REJECTED | CANCELLED
// Returns: array of booking requests

router.get("/", async (req, res) => {
  const { status } = req.query;

  try {
    let query;

    if (status && typeof status === "string") {
      query = db
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.status, status as any));
    } else {
      query = db.select().from(bookingRequests);
    }

    const requests = await query;

    return res.json(requests);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Failed to fetch requests" });
  }
});

router.post("/:id/reject", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const rows = await db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.id, id));

    const request = rows[0];

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const role = req.user!.role;

    // Role-based validation
    if (
      (role === "FACULTY" && request.status !== "PENDING_FACULTY") ||
      (role === "STAFF" && request.status !== "PENDING_STAFF")
    ) {
      return res.status(400).json({
        error: "Invalid status for rejection",
      });
    }

    if (role !== "FACULTY" && role !== "STAFF") {
      return res.status(403).json({
        error: "Only faculty or staff can reject requests",
      });
    }

    const updated = await db
      .update(bookingRequests)
      .set({ status: "REJECTED" })
      .where(eq(bookingRequests.id, id))
      .returning();

    return res.json(updated[0]);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Reject failed" });
  }
});

router.post("/:id/approve", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    // Only staff can approve
    if (req.user!.role !== "STAFF") {
      return res.status(403).json({ error: "Only staff can approve requests" });
    }

    const booking = await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(bookingRequests)
        .where(eq(bookingRequests.id, id));

      const request = rows[0];

      if (!request) {
        throw { type: "NOT_FOUND" };
      }

      if (request.status !== "PENDING_STAFF") {
        throw { type: "INVALID_STATUS" };
      }

      const inserted = await tx
        .insert(bookings)
        .values({
          roomId: request.roomId,
          startAt: request.startAt,
          endAt: request.endAt,
          requestId: request.id,
        })
        .returning();

      await tx
        .update(bookingRequests)
        .set({ status: "APPROVED" })
        .where(eq(bookingRequests.id, id));

      return inserted[0];
    });

    return res.json(booking);

  } catch (error: any) {
    if (error?.type === "NOT_FOUND") {
      return res.status(404).json({ error: "Request not found" });
    }

    if (error?.type === "INVALID_STATUS") {
      return res.status(400).json({ error: "Request is not pending staff approval" });
    }

    if (error?.cause?.code === "23P01") {
      return res.status(409).json({
        error: "Room already booked for this time range",
      });
    }

    console.error(error);
    return res.status(500).json({ error: "Approval failed" });
  }
});

router.post("/:id/forward", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    // Only faculty can forward
    if (req.user!.role !== "FACULTY") {
      return res.status(403).json({ error: "Only faculty can forward requests" });
    }

    // Fetch request
    const rows = await db
      .select()
      .from(bookingRequests)
      .where(eq(bookingRequests.id, id));

    const request = rows[0];

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (request.status !== "PENDING_FACULTY") {
      return res.status(400).json({
        error: "Only PENDING_FACULTY requests can be forwarded",
      });
    }

    // Update status
    const updated = await db
      .update(bookingRequests)
      .set({ status: "PENDING_STAFF" })
      .where(eq(bookingRequests.id, id))
      .returning();

    return res.json(updated[0]);

  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Forward failed" });
  }
});

router.post("/:id/cancel",authMiddleware, async (req, res) => {
  const id = Number(req.params.id);

  // Validate id
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "Invalid request id" });
  }

  try {
    // Fetch request
    const existingRows = await db
      .select({
        id: bookingRequests.id,
        status: bookingRequests.status,
      })
      .from(bookingRequests)
      .where(eq(bookingRequests.id, id))
      .limit(1);

    const existing = existingRows[0];

    if (!existing) {
      return res.status(404).json({ error: "Request not found" });
    }

    if (
      existing.status !== "PENDING_FACULTY" &&
      existing.status !== "PENDING_STAFF"
    ) {
      return res.status(400).json({
        error: "Only pending requests can be cancelled",
      });
    }

    // Update status to CANCELLED
    const updated = await db
      .update(bookingRequests)
      .set({ status: "CANCELLED" })
      .where(eq(bookingRequests.id, id))
      .returning();

    return res.json(updated[0]);
  } catch (error) {
    console.error("Cancel booking request error:", error);
    return res.status(500).json({ error: "Failed to cancel request" });
  }
});

router.post("/",authMiddleware, async (req, res) => {
  try {
    const roomId = Number(req.body?.roomId);
    const startAt = req.body?.startAt;
    const endAt = req.body?.endAt;
    const purpose = req.body?.purpose?.trim();

    // Validation
    if (isNaN(roomId)) {
      return res.status(400).json({ error: "Invalid roomId" });
    }

    if (!startAt || !endAt) {
      return res.status(400).json({ error: "startAt and endAt are required" });
    }

    if (!purpose) {
      return res.status(400).json({ error: "Purpose is required" });
    }

    const start = new Date(startAt);
    const end = new Date(endAt);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ error: "Invalid datetime format" });
    }

    if (start >= end) {
      return res.status(400).json({ error: "startAt must be before endAt" });
    }

    /**
     * SOFT CHECK 1: Prevent conflict with existing bookings
     */
    const overlap = await db
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.roomId, roomId),
          lt(bookings.startAt, end),
          gt(bookings.endAt, start)
        )
      )
      .limit(1);

    if (overlap.length > 0) {
      return res.status(409).json({
        error: "Room is not available in the selected time range",
      });
    }

    /**
     * SOFT CHECK 2: Prevent duplicate pending requests
     *
     * NOTE (IMPORTANT - FUTURE USER SYSTEM INTEGRATION)
     *
     * Current behavior:
     * - Prevents ANY overlapping PENDING booking requests for the same room.
     * - This is global because there is NO user system yet.
     *
     * FUTURE:
     * - Must include userId in this condition.
     */
    const pendingOverlap = await db
      .select({ id: bookingRequests.id })
      .from(bookingRequests)
      .where(
        and(
          eq(bookingRequests.roomId, roomId),
          eq(bookingRequests.status, "PENDING_FACULTY"),
          lt(bookingRequests.startAt, end),
          gt(bookingRequests.endAt, start)
        )
      )
      .limit(1);

    if (pendingOverlap.length > 0) {
      return res.status(409).json({
        error: "A pending request already exists for this time range",
      });
    }

    const result = await db
      .insert(bookingRequests)
      .values({
        roomId,
        startAt: start,
        endAt: end,
        purpose,
      })
      .returning();

    return res.status(201).json(result[0]);
  } catch (error: any) {
    if (error?.cause?.code === "23503") {
      return res.status(404).json({ error: "Room not found" });
    }

    console.error(error);
    return res.status(500).json({ error: "Insert failed" });
  }
});

export default router;