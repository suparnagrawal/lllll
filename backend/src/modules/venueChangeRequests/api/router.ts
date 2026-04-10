import { Router } from "express";
import { db } from "../../../db";
import { eq, and, or, inArray, desc, gte, lte } from "drizzle-orm";
import {
  venueChangeRequests,
  users,
  rooms,
  courses,
  courseFaculty,
  bookings,
  buildings,
  bookingCourseLink,
} from "../../../db/schema";
import { authMiddleware } from "../../../middleware/auth";
import { requireRole } from "../../../middleware/rbac";
import { requireBookingsUnfrozen } from "../../../middleware/bookingFreeze";
import { getAssignedBuildingIdsForStaff } from "../../users/services/staffBuildingScope";
import {
  validateVenueChange,
  applyVenueChange,
  getVenueChangeRequestWithDetails,
  suggestAlternativeRooms,
  isAuthorizedForCourse,
} from "../services/venueChangeService";
import {
  getActiveAdminIds,
  getActiveStaffIdsForBuilding,
  sendRoleAwareNotifications,
  type NotificationDraft,
} from "../../notifications/services/notificationService";
import logger from "../../../shared/utils/logger";

const router = Router();

const ALL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
type VenueChangeRequestStatus = (typeof ALL_STATUSES)[number];

function isValidStatus(value: unknown): value is VenueChangeRequestStatus {
  return typeof value === "string" && (ALL_STATUSES as readonly string[]).includes(value);
}

async function dispatchNotificationsSafely(drafts: NotificationDraft[]) {
  if (drafts.length === 0) return;
  try {
    await sendRoleAwareNotifications(drafts);
  } catch (error) {
    logger.error("Failed to dispatch venue change notifications", error);
  }
}

async function getStaffAndAdminIds(buildingId: number, excludeIds: number[] = []): Promise<number[]> {
  const [staffIds, adminIds] = await Promise.all([
    getActiveStaffIdsForBuilding(buildingId),
    getActiveAdminIds(),
  ]);
  const excluded = new Set(excludeIds);
  return [...new Set([...staffIds, ...adminIds])].filter((id) => !excluded.has(id));
}

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(year, month - 1, day, 0, 0, 0, 0);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * GET /venue-change-requests
 * List venue change requests with RBAC filtering
 */
router.get("/", authMiddleware, async (req, res) => {
  const { status } = req.query;

  if (status !== undefined && !isValidStatus(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const role = req.user!.role;
    const userId = req.user!.id;

    let query = db
      .select({
        request: venueChangeRequests,
        course: courses,
        currentBooking: bookings,
        proposedRoom: rooms,
        requestedByUser: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(venueChangeRequests)
      .innerJoin(courses, eq(venueChangeRequests.courseId, courses.id))
      .innerJoin(bookings, eq(venueChangeRequests.currentBookingId, bookings.id))
      .innerJoin(rooms, eq(venueChangeRequests.proposedRoomId, rooms.id))
      .innerJoin(users, eq(venueChangeRequests.requestedBy, users.id))
      .orderBy(desc(venueChangeRequests.createdAt));

    let rows;

    if (role === "ADMIN") {
      if (status) {
        rows = await query.where(eq(venueChangeRequests.status, status));
      } else {
        rows = await query;
      }
    } else if (role === "FACULTY") {
      const conditions = [eq(venueChangeRequests.requestedBy, userId)];
      if (status) {
        conditions.push(eq(venueChangeRequests.status, status));
      }
      rows = await query.where(and(...conditions));
    } else if (role === "STAFF") {
      const assignedBuildingIds = await getAssignedBuildingIdsForStaff(userId);

      if (assignedBuildingIds.length === 0) {
        return res.json([]);
      }

      const roomsInBuildings = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(inArray(rooms.buildingId, assignedBuildingIds));

      const roomIds = roomsInBuildings.map((r) => r.id);

      if (roomIds.length === 0) {
        return res.json([]);
      }

      const conditions = [
        or(
          inArray(bookings.roomId, roomIds),
          inArray(venueChangeRequests.proposedRoomId, roomIds)
        ),
      ];

      if (status) {
        conditions.push(eq(venueChangeRequests.status, status));
      } else {
        conditions.push(eq(venueChangeRequests.status, "PENDING"));
      }

      rows = await query.where(and(...conditions));
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(rows);
  } catch (error) {
    logger.error("Failed to fetch venue change requests", error);
    return res.status(500).json({ error: "Failed to fetch requests" });
  }
});

/**
 * GET /venue-change-requests/options
 * Returns real dropdown data for venue change creation UI
 */
router.get("/options", authMiddleware, async (req, res) => {
  try {
    const role = req.user?.role;
    const userId = req.user?.id;

    if (!role || !userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (role === "STUDENT" || role === "PENDING_ROLE") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const courseRows =
      role === "FACULTY"
        ? await db
            .select({ id: courses.id, code: courses.code, name: courses.name })
            .from(courseFaculty)
            .innerJoin(courses, eq(courseFaculty.courseId, courses.id))
            .where(eq(courseFaculty.facultyId, userId))
            .orderBy(courses.code)
        : await db
            .select({ id: courses.id, code: courses.code, name: courses.name })
            .from(courses)
            .orderBy(courses.code);

    const courseIds = courseRows.map((course) => course.id);

    const bookingSelectionQuery = db
      .select({
        id: bookings.id,
        roomId: bookings.roomId,
        startAt: bookings.startAt,
        endAt: bookings.endAt,
        courseId: bookingCourseLink.courseId,
        courseCode: courses.code,
        courseName: courses.name,
        roomName: rooms.name,
        buildingName: buildings.name,
      })
      .from(bookingCourseLink)
      .innerJoin(bookings, eq(bookingCourseLink.bookingId, bookings.id))
      .innerJoin(courses, eq(bookingCourseLink.courseId, courses.id))
      .innerJoin(rooms, eq(bookings.roomId, rooms.id))
      .innerJoin(buildings, eq(rooms.buildingId, buildings.id))
      .orderBy(desc(bookings.startAt));

    const bookingRows =
      role === "FACULTY"
        ? courseIds.length > 0
          ? await bookingSelectionQuery.where(inArray(bookingCourseLink.courseId, courseIds))
          : []
        : await bookingSelectionQuery;

    const roomRows = await db
      .select({
        id: rooms.id,
        name: rooms.name,
        buildingId: rooms.buildingId,
        buildingName: buildings.name,
      })
      .from(rooms)
      .innerJoin(buildings, eq(rooms.buildingId, buildings.id));

    return res.json({
      courses: courseRows,
      bookings: bookingRows,
      rooms: roomRows,
    });
  } catch (error) {
    logger.error("Failed to fetch venue change options", error);
    return res.status(500).json({ error: "Failed to fetch options" });
  }
});

/**
 * POST /venue-change-requests/batch
 * Create venue change requests for multiple bookings in a date range (Faculty only)
 */
router.post(
  "/batch",
  authMiddleware,
  requireRole("FACULTY"),
  async (req, res) => {
    const {
      courseId,
      proposedRoomId,
      reason,
      fromDate,
      toDate,
    } = req.body;

    if (!courseId || !proposedRoomId || !reason) {
      return res.status(400).json({
        error: "Missing required fields: courseId, proposedRoomId, reason",
      });
    }

    const parsedCourseId = Number(courseId);
    const parsedRoomId = Number(proposedRoomId);
    const parsedFromDate = fromDate ? parseDateOnly(fromDate) : null;
    const parsedToDate = toDate ? parseDateOnly(toDate) : null;

    if (isNaN(parsedCourseId) || isNaN(parsedRoomId)) {
      return res.status(400).json({ error: "Invalid courseId or proposedRoomId" });
    }

    if ((fromDate && !parsedFromDate) || (toDate && !parsedToDate)) {
      return res.status(400).json({ error: "Invalid date format. Use YYYY-MM-DD" });
    }

    const today = startOfDay(new Date());
    const effectiveFromDate = parsedFromDate ? startOfDay(parsedFromDate) : today;
    const effectiveToDate = parsedToDate ? endOfDay(parsedToDate) : null;

    if (effectiveToDate && effectiveFromDate > effectiveToDate) {
      return res.status(400).json({ error: "fromDate must be before or equal to toDate" });
    }

    try {
      const authorized = await isAuthorizedForCourse(req.user!.id, parsedCourseId);
      if (!authorized) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const whereConditions = [
        eq(bookingCourseLink.courseId, parsedCourseId),
        gte(bookings.startAt, effectiveFromDate),
      ];

      if (effectiveToDate) {
        whereConditions.push(lte(bookings.startAt, effectiveToDate));
      }

      const targetBookings = await db
        .select({
          bookingId: bookings.id,
          bookingStartAt: bookings.startAt,
          bookingEndAt: bookings.endAt,
        })
        .from(bookingCourseLink)
        .innerJoin(bookings, eq(bookingCourseLink.bookingId, bookings.id))
        .where(and(...whereConditions))
        .orderBy(bookings.startAt);

      if (targetBookings.length === 0) {
        return res.status(400).json({
          error: "No linked bookings found in the selected date range",
        });
      }

      const bookingIds = targetBookings.map((item) => item.bookingId);
      const pendingRows = await db
        .select({ bookingId: venueChangeRequests.currentBookingId })
        .from(venueChangeRequests)
        .where(
          and(
            inArray(venueChangeRequests.currentBookingId, bookingIds),
            eq(venueChangeRequests.status, "PENDING")
          )
        );

      const pendingBookingIds = new Set(pendingRows.map((row) => row.bookingId));

      const created: Array<{ bookingId: number; requestId: number; warnings: string[] }> = [];
      const failures: Array<{
        bookingId: number;
        bookingStartAt: Date;
        bookingEndAt: Date;
        errors: string[];
        warnings: string[];
      }> = [];

      for (const booking of targetBookings) {
        if (pendingBookingIds.has(booking.bookingId)) {
          failures.push({
            bookingId: booking.bookingId,
            bookingStartAt: booking.bookingStartAt,
            bookingEndAt: booking.bookingEndAt,
            errors: ["A pending venue change request already exists for this booking"],
            warnings: [],
          });
          continue;
        }

        const validation = await validateVenueChange({
          courseId: parsedCourseId,
          currentBookingId: booking.bookingId,
          proposedRoomId: parsedRoomId,
          requestedBy: req.user!.id,
        });

        if (!validation.valid) {
          failures.push({
            bookingId: booking.bookingId,
            bookingStartAt: booking.bookingStartAt,
            bookingEndAt: booking.bookingEndAt,
            errors: validation.errors,
            warnings: validation.warnings,
          });
          continue;
        }

        const inserted = await db
          .insert(venueChangeRequests)
          .values({
            requestedBy: req.user!.id,
            courseId: parsedCourseId,
            currentBookingId: booking.bookingId,
            proposedRoomId: parsedRoomId,
            reason: reason.trim(),
            status: "PENDING",
          })
          .returning({ id: venueChangeRequests.id });

        if (inserted[0]) {
          created.push({
            bookingId: booking.bookingId,
            requestId: inserted[0].id,
            warnings: validation.warnings,
          });
        }
      }

      if (created.length > 0) {
        const [courseRows, proposedRoomRows] = await Promise.all([
          db
            .select({ code: courses.code, name: courses.name })
            .from(courses)
            .where(eq(courses.id, parsedCourseId))
            .limit(1),
          db
            .select({
              roomName: rooms.name,
              buildingName: buildings.name,
              buildingId: rooms.buildingId,
            })
            .from(rooms)
            .innerJoin(buildings, eq(rooms.buildingId, buildings.id))
            .where(eq(rooms.id, parsedRoomId))
            .limit(1),
        ]);

        if (proposedRoomRows[0]) {
          const recipientIds = await getStaffAndAdminIds(proposedRoomRows[0].buildingId, [req.user!.id]);
          const rangeLabel = `${formatDateOnly(effectiveFromDate)} to ${
            effectiveToDate ? formatDateOnly(effectiveToDate) : "semester end"
          }`;

          const notifications: NotificationDraft[] = recipientIds.map((recipientId) => ({
            recipientId,
            type: "VENUE_CHANGE_REQUESTED",
            subject: `Batch Venue Change Request: ${courseRows[0]?.code ?? "Course"}`,
            message: `${created.length} venue change request(s) were submitted for ${courseRows[0]?.code ?? "Course"} - ${courseRows[0]?.name ?? ""} for date range ${rangeLabel}. Proposed room: ${proposedRoomRows[0]?.roomName} (${proposedRoomRows[0]?.buildingName}).`,
          }));

          await dispatchNotificationsSafely(notifications);
        }
      }

      return res.status(created.length > 0 ? 201 : 200).json({
        requestedCount: targetBookings.length,
        createdCount: created.length,
        skippedCount: targetBookings.length - created.length,
        created,
        failures,
      });
    } catch (error) {
      logger.error("Failed to create batch venue change requests", error);
      return res.status(500).json({ error: "Failed to create batch requests" });
    }
  }
);

/**
 * GET /venue-change-requests/:id
 * Get a single venue change request
 */
router.get("/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const data = await getVenueChangeRequestWithDetails(id);

    if (!data) {
      return res.status(404).json({ error: "Request not found" });
    }

    const role = req.user!.role;
    const userId = req.user!.id;

    if (role === "ADMIN") {
      // Admin can view all
    } else if (role === "FACULTY") {
      if (data.request.requestedBy !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else if (role === "STAFF") {
      const assignedBuildingIds = await getAssignedBuildingIdsForStaff(userId);

      const currentBookingRoom = await db
        .select({ buildingId: rooms.buildingId })
        .from(rooms)
        .where(eq(rooms.id, data.currentBooking.roomId))
        .limit(1);

      const currentBuildingId = currentBookingRoom[0]?.buildingId;
      const proposedBuildingId = data.proposedRoom?.buildingId;

      const hasAccess =
        (currentBuildingId && assignedBuildingIds.includes(currentBuildingId)) ||
        (proposedBuildingId && assignedBuildingIds.includes(proposedBuildingId));

      if (!hasAccess) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(data);
  } catch (error) {
    logger.error("Failed to fetch venue change request", error);
    return res.status(500).json({ error: "Failed to fetch request" });
  }
});

/**
 * POST /venue-change-requests
 * Create a new venue change request (Faculty only)
 */
router.post(
  "/",
  authMiddleware,
  requireRole("FACULTY"),
  async (req, res) => {
    const { courseId, currentBookingId, proposedRoomId, reason } = req.body;

    if (!courseId || !currentBookingId || !proposedRoomId || !reason) {
      return res.status(400).json({
        error: "Missing required fields: courseId, currentBookingId, proposedRoomId, reason",
      });
    }

    const parsedCourseId = Number(courseId);
    const parsedBookingId = Number(currentBookingId);
    const parsedRoomId = Number(proposedRoomId);

    if (isNaN(parsedCourseId) || isNaN(parsedBookingId) || isNaN(parsedRoomId)) {
      return res.status(400).json({ error: "Invalid courseId, currentBookingId, or proposedRoomId" });
    }

    try {
      const validation = await validateVenueChange({
        courseId: parsedCourseId,
        currentBookingId: parsedBookingId,
        proposedRoomId: parsedRoomId,
        requestedBy: req.user!.id,
      });

      if (!validation.valid) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validation.errors,
          warnings: validation.warnings,
        });
      }

      const inserted = await db
        .insert(venueChangeRequests)
        .values({
          requestedBy: req.user!.id,
          courseId: parsedCourseId,
          currentBookingId: parsedBookingId,
          proposedRoomId: parsedRoomId,
          reason: reason.trim(),
          status: "PENDING",
        })
        .returning();

      const newRequest = inserted[0];

      // Get info for notifications
      const courseRow = await db
        .select({ code: courses.code, name: courses.name })
        .from(courses)
        .where(eq(courses.id, parsedCourseId))
        .limit(1);

      const roomInfo = await db
        .select({
          roomName: rooms.name,
          buildingId: rooms.buildingId,
          buildingName: buildings.name,
        })
        .from(rooms)
        .innerJoin(buildings, eq(rooms.buildingId, buildings.id))
        .where(eq(rooms.id, parsedRoomId))
        .limit(1);

      if (roomInfo[0]?.buildingId) {
        const recipientIds = await getStaffAndAdminIds(roomInfo[0].buildingId, [req.user!.id]);

        const notifications: NotificationDraft[] = recipientIds.map((recipientId) => ({
          recipientId,
          type: "VENUE_CHANGE_REQUESTED",
          subject: `Venue Change Request: ${courseRow[0]?.code ?? "Course"}`,
          message: `A venue change request has been submitted for ${courseRow[0]?.code} - ${courseRow[0]?.name}. Proposed room: ${roomInfo[0]?.roomName} (${roomInfo[0]?.buildingName}). Reason: ${reason}`,
        }));

        await dispatchNotificationsSafely(notifications);
      }

      return res.status(201).json({
        request: newRequest,
        warnings: validation.warnings,
      });
    } catch (error) {
      logger.error("Failed to create venue change request", error);
      return res.status(500).json({ error: "Failed to create request" });
    }
  }
);

/**
 * POST /venue-change-requests/:id/approve
 * Approve a venue change request (Staff/Admin only)
 */
router.post(
  "/:id/approve",
  authMiddleware,
  requireRole(["STAFF", "ADMIN"]),
  requireBookingsUnfrozen(),
  async (req, res) => {
    const id = Number(req.params.id);
    const { reviewNote } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    try {
      const data = await getVenueChangeRequestWithDetails(id);

      if (!data) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (data.request.status !== "PENDING") {
        return res.status(400).json({ error: `Request is already ${data.request.status.toLowerCase()}` });
      }

      if (req.user!.role === "STAFF") {
        const assignedBuildingIds = await getAssignedBuildingIdsForStaff(req.user!.id);

        const currentRoomBuilding = await db
          .select({ buildingId: rooms.buildingId })
          .from(rooms)
          .where(eq(rooms.id, data.currentBooking.roomId))
          .limit(1);

        if (
          assignedBuildingIds.length === 0 ||
          !assignedBuildingIds.includes(currentRoomBuilding[0]?.buildingId ?? 0)
        ) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      const result = await db.transaction(async (tx) => {
        if (reviewNote) {
          await tx
            .update(venueChangeRequests)
            .set({ reviewNote: reviewNote.trim() })
            .where(eq(venueChangeRequests.id, id));
        }

        return applyVenueChange(id, req.user!.id, tx);
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      const notifications: NotificationDraft[] = [
        {
          recipientId: data.request.requestedBy,
          type: "VENUE_CHANGE_APPROVED",
          subject: `Venue Change Approved: ${data.course.code}`,
          message: `Your venue change request for ${data.course.code} - ${data.course.name} has been approved.${reviewNote ? ` Note: ${reviewNote}` : ""}`,
        },
      ];

      await dispatchNotificationsSafely(notifications);

      return res.json({ success: true, bookingId: result.newBookingId });
    } catch (error) {
      logger.error("Failed to approve venue change request", error);
      return res.status(500).json({ error: "Failed to approve request" });
    }
  }
);

/**
 * POST /venue-change-requests/:id/reject
 * Reject a venue change request (Staff/Admin only)
 */
router.post(
  "/:id/reject",
  authMiddleware,
  requireRole(["STAFF", "ADMIN"]),
  async (req, res) => {
    const id = Number(req.params.id);
    const { reviewNote } = req.body;

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    if (!reviewNote || typeof reviewNote !== "string" || !reviewNote.trim()) {
      return res.status(400).json({ error: "Rejection reason is required" });
    }

    try {
      const data = await getVenueChangeRequestWithDetails(id);

      if (!data) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (data.request.status !== "PENDING") {
        return res.status(400).json({ error: `Request is already ${data.request.status.toLowerCase()}` });
      }

      if (req.user!.role === "STAFF") {
        const assignedBuildingIds = await getAssignedBuildingIdsForStaff(req.user!.id);

        const currentRoomBuilding = await db
          .select({ buildingId: rooms.buildingId })
          .from(rooms)
          .where(eq(rooms.id, data.currentBooking.roomId))
          .limit(1);

        if (
          assignedBuildingIds.length === 0 ||
          !assignedBuildingIds.includes(currentRoomBuilding[0]?.buildingId ?? 0)
        ) {
          return res.status(403).json({ error: "Forbidden" });
        }
      }

      await db
        .update(venueChangeRequests)
        .set({
          status: "REJECTED",
          reviewedBy: req.user!.id,
          reviewNote: reviewNote.trim(),
          updatedAt: new Date(),
        })
        .where(eq(venueChangeRequests.id, id));

      const notifications: NotificationDraft[] = [
        {
          recipientId: data.request.requestedBy,
          type: "VENUE_CHANGE_REJECTED",
          subject: `Venue Change Rejected: ${data.course.code}`,
          message: `Your venue change request for ${data.course.code} - ${data.course.name} has been rejected. Reason: ${reviewNote}`,
        },
      ];

      await dispatchNotificationsSafely(notifications);

      return res.json({ success: true });
    } catch (error) {
      logger.error("Failed to reject venue change request", error);
      return res.status(500).json({ error: "Failed to reject request" });
    }
  }
);

/**
 * POST /venue-change-requests/:id/cancel
 * Cancel a venue change request (requester only)
 */
router.post(
  "/:id/cancel",
  authMiddleware,
  requireRole("FACULTY"),
  async (req, res) => {
    const id = Number(req.params.id);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid id" });
    }

    try {
      const request = await db
        .select()
        .from(venueChangeRequests)
        .where(eq(venueChangeRequests.id, id))
        .limit(1);

      if (request.length === 0) {
        return res.status(404).json({ error: "Request not found" });
      }

      const req0 = request[0];
      if (!req0) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (req0.requestedBy !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      if (req0.status !== "PENDING") {
        return res.status(400).json({ error: `Request is already ${req0.status.toLowerCase()}` });
      }

      await db
        .update(venueChangeRequests)
        .set({
          status: "CANCELLED",
          updatedAt: new Date(),
        })
        .where(eq(venueChangeRequests.id, id));

      return res.json({ success: true });
    } catch (error) {
      logger.error("Failed to cancel venue change request", error);
      return res.status(500).json({ error: "Failed to cancel request" });
    }
  }
);

/**
 * GET /venue-change-requests/suggestions/:bookingId
 * Get alternative room suggestions for a booking
 */
router.get(
  "/suggestions/:bookingId",
  authMiddleware,
  requireRole("FACULTY"),
  async (req, res) => {
    const bookingId = Number(req.params.bookingId);
    const { courseId, buildingId } = req.query;

    if (isNaN(bookingId)) {
      return res.status(400).json({ error: "Invalid bookingId" });
    }

    const parsedCourseId = courseId ? Number(courseId) : undefined;
    const parsedBuildingId = buildingId ? Number(buildingId) : undefined;

    if (courseId && isNaN(parsedCourseId!)) {
      return res.status(400).json({ error: "Invalid courseId" });
    }

    try {
      const suggestions = await suggestAlternativeRooms(
        bookingId,
        parsedCourseId ?? 0,
        parsedBuildingId
      );

      return res.json(suggestions);
    } catch (error) {
      logger.error("Failed to get venue suggestions", error);
      return res.status(500).json({ error: "Failed to get suggestions" });
    }
  }
);

/**
 * POST /venue-change-requests/validate
 * Validate a venue change without creating it
 */
router.post(
  "/validate",
  authMiddleware,
  requireRole("FACULTY"),
  async (req, res) => {
    const { courseId, currentBookingId, proposedRoomId } = req.body;

    if (!courseId || !currentBookingId || !proposedRoomId) {
      return res.status(400).json({
        error: "Missing required fields: courseId, currentBookingId, proposedRoomId",
      });
    }

    const parsedCourseId = Number(courseId);
    const parsedBookingId = Number(currentBookingId);
    const parsedRoomId = Number(proposedRoomId);

    if (isNaN(parsedCourseId) || isNaN(parsedBookingId) || isNaN(parsedRoomId)) {
      return res.status(400).json({ error: "Invalid courseId, currentBookingId, or proposedRoomId" });
    }

    try {
      const validation = await validateVenueChange({
        courseId: parsedCourseId,
        currentBookingId: parsedBookingId,
        proposedRoomId: parsedRoomId,
        requestedBy: req.user!.id,
      });

      return res.json(validation);
    } catch (error) {
      logger.error("Failed to validate venue change", error);
      return res.status(500).json({ error: "Validation failed" });
    }
  }
);

export default router;
