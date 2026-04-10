import { Router } from "express";
import { db } from "../db";
import { eq, and, or, inArray, desc, gte, lte } from "drizzle-orm";
import {
  slotChangeRequests,
  users,
  rooms,
  courses,
  courseFaculty,
  bookings,
  buildings,
  bookingCourseLink,
} from "../db/schema";
import { authMiddleware } from "../middleware/auth";
import { requireRole } from "../middleware/rbac";
import { requireBookingsUnfrozen } from "../middleware/bookingFreeze";
import { getAssignedBuildingIdsForStaff } from "../services/staffBuildingScope";
import {
  validateSlotChange,
  applySlotChange,
  getSlotChangeRequestWithDetails,
  isAuthorizedForCourse,
  isBookingLinkedToCourse,
} from "../services/slotChangeService";
import {
  getActiveAdminIds,
  getActiveStaffIdsForBuilding,
  sendRoleAwareNotifications,
  type NotificationDraft,
} from "../services/notificationService";
import logger from "../shared/utils/logger";

const router = Router();

const ALL_STATUSES = ["PENDING", "APPROVED", "REJECTED", "CANCELLED"] as const;
type SlotChangeRequestStatus = (typeof ALL_STATUSES)[number];

function isValidStatus(value: unknown): value is SlotChangeRequestStatus {
  return typeof value === "string" && (ALL_STATUSES as readonly string[]).includes(value);
}

function formatDateTime(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toISOString().replace("T", " ").slice(0, 16);
}

async function dispatchNotificationsSafely(drafts: NotificationDraft[]) {
  if (drafts.length === 0) return;
  try {
    await sendRoleAwareNotifications(drafts);
  } catch (error) {
    logger.error("Failed to dispatch slot change notifications", error);
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

function parseTimeOnly(value: unknown): { hour: number; minute: number } | null {
  if (typeof value !== "string") {
    return null;
  }

  const match = value.trim().match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null;
  }

  return { hour, minute };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function applyTimeOnDate(baseDate: Date | string, hour: number, minute: number): Date {
  const source = typeof baseDate === "string" ? new Date(baseDate) : new Date(baseDate);
  return new Date(
    source.getFullYear(),
    source.getMonth(),
    source.getDate(),
    hour,
    minute,
    0,
    0
  );
}

function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * GET /slot-change-requests
 * List slot change requests with RBAC filtering
 */
router.get("/", authMiddleware, async (req, res) => {
  const { status } = req.query;

  if (status !== undefined && !isValidStatus(status)) {
    return res.status(400).json({ error: "Invalid status" });
  }

  try {
    const role = req.user!.role;
    const userId = req.user!.id;

    // Build base query with joins
    let query = db
      .select({
        request: slotChangeRequests,
        course: courses,
        currentBooking: bookings,
        proposedRoom: rooms,
        requestedByUser: {
          id: users.id,
          name: users.name,
          email: users.email,
        },
      })
      .from(slotChangeRequests)
      .innerJoin(courses, eq(slotChangeRequests.courseId, courses.id))
      .innerJoin(bookings, eq(slotChangeRequests.currentBookingId, bookings.id))
      .leftJoin(rooms, eq(slotChangeRequests.proposedRoomId, rooms.id))
      .innerJoin(users, eq(slotChangeRequests.requestedBy, users.id))
      .orderBy(desc(slotChangeRequests.createdAt));

    let rows;

    if (role === "ADMIN") {
      // Admin sees all
      if (status) {
        rows = await query.where(eq(slotChangeRequests.status, status));
      } else {
        rows = await query;
      }
    } else if (role === "FACULTY") {
      // Faculty sees only their own requests
      const conditions = [eq(slotChangeRequests.requestedBy, userId)];
      if (status) {
        conditions.push(eq(slotChangeRequests.status, status));
      }
      rows = await query.where(and(...conditions));
    } else if (role === "STAFF") {
      // Staff sees PENDING requests for their assigned buildings
      const assignedBuildingIds = await getAssignedBuildingIdsForStaff(userId);

      if (assignedBuildingIds.length === 0) {
        return res.json([]);
      }

      // Get room IDs in assigned buildings
      const roomsInBuildings = await db
        .select({ id: rooms.id })
        .from(rooms)
        .where(inArray(rooms.buildingId, assignedBuildingIds));

      const roomIds = roomsInBuildings.map((r) => r.id);

      if (roomIds.length === 0) {
        return res.json([]);
      }

      // Filter by current booking room or proposed room in assigned buildings
      const conditions = [
        or(
          inArray(bookings.roomId, roomIds),
          inArray(slotChangeRequests.proposedRoomId, roomIds)
        ),
      ];

      if (status) {
        conditions.push(eq(slotChangeRequests.status, status));
      } else {
        // By default, staff only sees pending
        conditions.push(eq(slotChangeRequests.status, "PENDING"));
      }

      rows = await query.where(and(...conditions));
    } else {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(rows);
  } catch (error) {
    logger.error("Failed to fetch slot change requests", error);
    return res.status(500).json({ error: "Failed to fetch requests" });
  }
});

/**
 * GET /slot-change-requests/options
 * Returns real dropdown data for slot change creation UI
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
    logger.error("Failed to fetch slot change options", error);
    return res.status(500).json({ error: "Failed to fetch options" });
  }
});

/**
 * POST /slot-change-requests/batch
 * Create slot change requests for multiple bookings in a date range (Faculty only)
 */
router.post(
  "/batch",
  authMiddleware,
  requireRole("FACULTY"),
  async (req, res) => {
    const {
      courseId,
      proposedRoomId,
      proposedStartTime,
      proposedEndTime,
      reason,
      fromDate,
      toDate,
    } = req.body;

    if (!courseId || !proposedStartTime || !proposedEndTime || !reason) {
      return res.status(400).json({
        error:
          "Missing required fields: courseId, proposedStartTime, proposedEndTime, reason",
      });
    }

    const parsedCourseId = Number(courseId);
    const parsedRoomId =
      proposedRoomId === null || proposedRoomId === undefined || proposedRoomId === ""
        ? null
        : Number(proposedRoomId);
    const startTime = parseTimeOnly(proposedStartTime);
    const endTime = parseTimeOnly(proposedEndTime);
    const parsedFromDate = fromDate ? parseDateOnly(fromDate) : null;
    const parsedToDate = toDate ? parseDateOnly(toDate) : null;

    if (isNaN(parsedCourseId)) {
      return res.status(400).json({ error: "Invalid courseId" });
    }

    if (parsedRoomId !== null && isNaN(parsedRoomId)) {
      return res.status(400).json({ error: "Invalid proposedRoomId" });
    }

    if (!startTime || !endTime) {
      return res.status(400).json({ error: "Invalid time format. Use HH:mm" });
    }

    if (
      startTime.hour > endTime.hour ||
      (startTime.hour === endTime.hour && startTime.minute >= endTime.minute)
    ) {
      return res.status(400).json({ error: "proposedStartTime must be before proposedEndTime" });
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
          roomId: bookings.roomId,
          bookingStartAt: bookings.startAt,
          bookingEndAt: bookings.endAt,
          buildingId: rooms.buildingId,
        })
        .from(bookingCourseLink)
        .innerJoin(bookings, eq(bookingCourseLink.bookingId, bookings.id))
        .innerJoin(rooms, eq(bookings.roomId, rooms.id))
        .where(and(...whereConditions))
        .orderBy(bookings.startAt);

      if (targetBookings.length === 0) {
        return res.status(400).json({
          error: "No linked bookings found in the selected date range",
        });
      }

      const bookingIds = targetBookings.map((item) => item.bookingId);
      const pendingRows = await db
        .select({ bookingId: slotChangeRequests.currentBookingId })
        .from(slotChangeRequests)
        .where(
          and(
            inArray(slotChangeRequests.currentBookingId, bookingIds),
            eq(slotChangeRequests.status, "PENDING")
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
      const buildingIdsForNotification = new Set<number>();

      for (const booking of targetBookings) {
        if (pendingBookingIds.has(booking.bookingId)) {
          failures.push({
            bookingId: booking.bookingId,
            bookingStartAt: booking.bookingStartAt,
            bookingEndAt: booking.bookingEndAt,
            errors: ["A pending slot change request already exists for this booking"],
            warnings: [],
          });
          continue;
        }

        const proposedStart = applyTimeOnDate(
          booking.bookingStartAt,
          startTime.hour,
          startTime.minute
        );
        const proposedEnd = applyTimeOnDate(
          booking.bookingStartAt,
          endTime.hour,
          endTime.minute
        );

        const validation = await validateSlotChange({
          courseId: parsedCourseId,
          currentBookingId: booking.bookingId,
          proposedRoomId: parsedRoomId,
          proposedStart,
          proposedEnd,
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
          .insert(slotChangeRequests)
          .values({
            requestedBy: req.user!.id,
            courseId: parsedCourseId,
            currentBookingId: booking.bookingId,
            proposedRoomId: parsedRoomId,
            proposedStart,
            proposedEnd,
            reason: reason.trim(),
            status: "PENDING",
          })
          .returning({ id: slotChangeRequests.id });

        if (inserted[0]) {
          created.push({
            bookingId: booking.bookingId,
            requestId: inserted[0].id,
            warnings: validation.warnings,
          });
          buildingIdsForNotification.add(booking.buildingId);
        }
      }

      if (created.length > 0) {
        const courseRows = await db
          .select({ code: courses.code, name: courses.name })
          .from(courses)
          .where(eq(courses.id, parsedCourseId))
          .limit(1);

        const recipientGroups = await Promise.all(
          [...buildingIdsForNotification].map((buildingId) =>
            getStaffAndAdminIds(buildingId, [req.user!.id])
          )
        );

        const recipientIds = [...new Set(recipientGroups.flat())];
        const rangeLabel = `${formatDateOnly(effectiveFromDate)} to ${
          effectiveToDate ? formatDateOnly(effectiveToDate) : "semester end"
        }`;

        const notifications: NotificationDraft[] = recipientIds.map((recipientId) => ({
          recipientId,
          type: "SLOT_CHANGE_REQUESTED",
          subject: `Batch Slot Change Request: ${courseRows[0]?.code ?? "Course"}`,
          message: `${created.length} slot change request(s) were submitted for ${courseRows[0]?.code ?? "Course"} - ${courseRows[0]?.name ?? ""} for date range ${rangeLabel}. Proposed time: ${proposedStartTime} to ${proposedEndTime}.`,
        }));

        await dispatchNotificationsSafely(notifications);
      }

      return res.status(created.length > 0 ? 201 : 200).json({
        requestedCount: targetBookings.length,
        createdCount: created.length,
        skippedCount: targetBookings.length - created.length,
        created,
        failures,
      });
    } catch (error) {
      logger.error("Failed to create batch slot change requests", error);
      return res.status(500).json({ error: "Failed to create batch requests" });
    }
  }
);

/**
 * GET /slot-change-requests/:id
 * Get a single slot change request
 */
router.get("/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);

  if (isNaN(id)) {
    return res.status(400).json({ error: "Invalid id" });
  }

  try {
    const data = await getSlotChangeRequestWithDetails(id);

    if (!data) {
      return res.status(404).json({ error: "Request not found" });
    }

    const role = req.user!.role;
    const userId = req.user!.id;

    // Check access
    if (role === "ADMIN") {
      // Admin can view all
    } else if (role === "FACULTY") {
      if (data.request.requestedBy !== userId) {
        return res.status(403).json({ error: "Forbidden" });
      }
    } else if (role === "STAFF") {
      // Staff can only view if current/proposed room is in their buildings
      const assignedBuildingIds = await getAssignedBuildingIdsForStaff(userId);

      // Get building IDs for both current booking room and proposed room
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
    logger.error("Failed to fetch slot change request", error);
    return res.status(500).json({ error: "Failed to fetch request" });
  }
});

/**
 * POST /slot-change-requests
 * Create a new slot change request (Faculty only)
 */
router.post(
  "/",
  authMiddleware,
  requireRole("FACULTY"),
  async (req, res) => {
    const { courseId, currentBookingId, proposedRoomId, proposedStart, proposedEnd, reason } =
      req.body;

    // Validate required fields
    if (!courseId || !currentBookingId || !proposedStart || !proposedEnd || !reason) {
      return res.status(400).json({
        error: "Missing required fields: courseId, currentBookingId, proposedStart, proposedEnd, reason",
      });
    }

    const parsedCourseId = Number(courseId);
    const parsedBookingId = Number(currentBookingId);
    const parsedRoomId = proposedRoomId ? Number(proposedRoomId) : null;
    const parsedStart = new Date(proposedStart);
    const parsedEnd = new Date(proposedEnd);

    if (isNaN(parsedCourseId) || isNaN(parsedBookingId)) {
      return res.status(400).json({ error: "Invalid courseId or currentBookingId" });
    }

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    if (parsedStart >= parsedEnd) {
      return res.status(400).json({ error: "proposedStart must be before proposedEnd" });
    }

    try {
      // Validate the request
      const validation = await validateSlotChange({
        courseId: parsedCourseId,
        currentBookingId: parsedBookingId,
        proposedRoomId: parsedRoomId,
        proposedStart: parsedStart,
        proposedEnd: parsedEnd,
        requestedBy: req.user!.id,
      });

      if (!validation.valid) {
        return res.status(400).json({
          error: "Validation failed",
          errors: validation.errors,
          warnings: validation.warnings,
          suggestions: validation.suggestions,
        });
      }

      // Create the request
      const inserted = await db
        .insert(slotChangeRequests)
        .values({
          requestedBy: req.user!.id,
          courseId: parsedCourseId,
          currentBookingId: parsedBookingId,
          proposedRoomId: parsedRoomId,
          proposedStart: parsedStart,
          proposedEnd: parsedEnd,
          reason: reason.trim(),
          status: "PENDING",
        })
        .returning();

      const newRequest = inserted[0];

      // Get course and booking info for notifications
      const courseRow = await db
        .select({ code: courses.code, name: courses.name })
        .from(courses)
        .where(eq(courses.id, parsedCourseId))
        .limit(1);

      const bookingRoom = await db
        .select({ roomId: bookings.roomId })
        .from(bookings)
        .where(eq(bookings.id, parsedBookingId))
        .limit(1);

      const roomInfo = await db
        .select({ buildingId: rooms.buildingId })
        .from(rooms)
        .where(eq(rooms.id, bookingRoom[0]?.roomId ?? 0))
        .limit(1);

      // Notify staff and admins
      if (roomInfo[0]?.buildingId) {
        const recipientIds = await getStaffAndAdminIds(roomInfo[0].buildingId, [req.user!.id]);

        const notifications: NotificationDraft[] = recipientIds.map((recipientId) => ({
          recipientId,
          type: "SLOT_CHANGE_REQUESTED",
          subject: `Slot Change Request: ${courseRow[0]?.code ?? "Course"}`,
          message: `A slot change request has been submitted for ${courseRow[0]?.code} - ${courseRow[0]?.name}. Proposed time: ${formatDateTime(parsedStart)} to ${formatDateTime(parsedEnd)}. Reason: ${reason}`,
        }));

        await dispatchNotificationsSafely(notifications);
      }

      return res.status(201).json({
        request: newRequest,
        warnings: validation.warnings,
      });
    } catch (error) {
      logger.error("Failed to create slot change request", error);
      return res.status(500).json({ error: "Failed to create request" });
    }
  }
);

/**
 * POST /slot-change-requests/:id/approve
 * Approve a slot change request (Staff/Admin only)
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
      const data = await getSlotChangeRequestWithDetails(id);

      if (!data) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (data.request.status !== "PENDING") {
        return res.status(400).json({ error: `Request is already ${data.request.status.toLowerCase()}` });
      }

      // Staff building scope check
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

      // Apply the slot change
      const result = await db.transaction(async (tx) => {
        // Update review note if provided
        if (reviewNote) {
          await tx
            .update(slotChangeRequests)
            .set({ reviewNote: reviewNote.trim() })
            .where(eq(slotChangeRequests.id, id));
        }

        return applySlotChange(id, req.user!.id, tx);
      });

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      // Notify the requester
      const notifications: NotificationDraft[] = [
        {
          recipientId: data.request.requestedBy,
          type: "SLOT_CHANGE_APPROVED",
          subject: `Slot Change Approved: ${data.course.code}`,
          message: `Your slot change request for ${data.course.code} - ${data.course.name} has been approved.${reviewNote ? ` Note: ${reviewNote}` : ""}`,
        },
      ];

      await dispatchNotificationsSafely(notifications);

      return res.json({ success: true, bookingId: result.newBookingId });
    } catch (error) {
      logger.error("Failed to approve slot change request", error);
      return res.status(500).json({ error: "Failed to approve request" });
    }
  }
);

/**
 * POST /slot-change-requests/:id/reject
 * Reject a slot change request (Staff/Admin only)
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
      const data = await getSlotChangeRequestWithDetails(id);

      if (!data) {
        return res.status(404).json({ error: "Request not found" });
      }

      if (data.request.status !== "PENDING") {
        return res.status(400).json({ error: `Request is already ${data.request.status.toLowerCase()}` });
      }

      // Staff building scope check
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

      // Update the request
      await db
        .update(slotChangeRequests)
        .set({
          status: "REJECTED",
          reviewedBy: req.user!.id,
          reviewNote: reviewNote.trim(),
          updatedAt: new Date(),
        })
        .where(eq(slotChangeRequests.id, id));

      // Notify the requester
      const notifications: NotificationDraft[] = [
        {
          recipientId: data.request.requestedBy,
          type: "SLOT_CHANGE_REJECTED",
          subject: `Slot Change Rejected: ${data.course.code}`,
          message: `Your slot change request for ${data.course.code} - ${data.course.name} has been rejected. Reason: ${reviewNote}`,
        },
      ];

      await dispatchNotificationsSafely(notifications);

      return res.json({ success: true });
    } catch (error) {
      logger.error("Failed to reject slot change request", error);
      return res.status(500).json({ error: "Failed to reject request" });
    }
  }
);

/**
 * POST /slot-change-requests/:id/cancel
 * Cancel a slot change request (requester only)
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
        .from(slotChangeRequests)
        .where(eq(slotChangeRequests.id, id))
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
        .update(slotChangeRequests)
        .set({
          status: "CANCELLED",
          updatedAt: new Date(),
        })
        .where(eq(slotChangeRequests.id, id));

      return res.json({ success: true });
    } catch (error) {
      logger.error("Failed to cancel slot change request", error);
      return res.status(500).json({ error: "Failed to cancel request" });
    }
  }
);

/**
 * POST /slot-change-requests/validate
 * Validate a slot change without creating it
 */
router.post(
  "/validate",
  authMiddleware,
  requireRole("FACULTY"),
  async (req, res) => {
    const { courseId, currentBookingId, proposedRoomId, proposedStart, proposedEnd } = req.body;

    if (!courseId || !currentBookingId || !proposedStart || !proposedEnd) {
      return res.status(400).json({
        error: "Missing required fields: courseId, currentBookingId, proposedStart, proposedEnd",
      });
    }

    const parsedCourseId = Number(courseId);
    const parsedBookingId = Number(currentBookingId);
    const parsedRoomId = proposedRoomId ? Number(proposedRoomId) : null;
    const parsedStart = new Date(proposedStart);
    const parsedEnd = new Date(proposedEnd);

    if (isNaN(parsedCourseId) || isNaN(parsedBookingId)) {
      return res.status(400).json({ error: "Invalid courseId or currentBookingId" });
    }

    if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    try {
      const validation = await validateSlotChange({
        courseId: parsedCourseId,
        currentBookingId: parsedBookingId,
        proposedRoomId: parsedRoomId,
        proposedStart: parsedStart,
        proposedEnd: parsedEnd,
        requestedBy: req.user!.id,
      });

      return res.json(validation);
    } catch (error) {
      logger.error("Failed to validate slot change", error);
      return res.status(500).json({ error: "Validation failed" });
    }
  }
);

export default router;
