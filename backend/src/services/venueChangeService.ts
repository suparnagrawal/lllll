import { and, eq } from "drizzle-orm";
import { db } from "../db";
import {
  venueChangeRequests,
  bookings,
  rooms,
  courses,
  courseFaculty,
  courseEnrollments,
  bookingCourseLink,
  users,
  buildings,
} from "../db/schema";
import { hasBookingOverlap } from "./bookingService";

type DbExecutor = typeof db | any;

export type VenueChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type VenueValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  availableSlots?: AvailableSlot[];
};

export type AvailableSlot = {
  startAt: Date;
  endAt: Date;
  isCurrentSlot: boolean;
};

export type VenueChangeValidationInput = {
  courseId: number;
  currentBookingId: number;
  proposedRoomId: number;
  requestedBy: number;
};

/**
 * Check if the user is authorized to request venue changes for a course
 */
export async function isAuthorizedForCourse(
  userId: number,
  courseId: number,
  executor: DbExecutor = db
): Promise<boolean> {
  const facultyRows = await executor
    .select({ facultyId: courseFaculty.facultyId })
    .from(courseFaculty)
    .where(
      and(
        eq(courseFaculty.courseId, courseId),
        eq(courseFaculty.facultyId, userId)
      )
    )
    .limit(1);

  return facultyRows.length > 0;
}

/**
 * Check if a booking belongs to a course
 */
export async function isBookingLinkedToCourse(
  bookingId: number,
  courseId: number,
  executor: DbExecutor = db
): Promise<boolean> {
  const rows = await executor
    .select({ bookingId: bookingCourseLink.bookingId })
    .from(bookingCourseLink)
    .where(
      and(
        eq(bookingCourseLink.bookingId, bookingId),
        eq(bookingCourseLink.courseId, courseId)
      )
    )
    .limit(1);

  return rows.length > 0;
}

/**
 * Check if proposed room has sufficient capacity for the course
 */
async function checkRoomCapacity(
  roomId: number,
  courseId: number,
  executor: DbExecutor = db
): Promise<{ sufficient: boolean; roomCapacity: number | null; enrolledCount: number }> {
  const roomRows = await executor
    .select({ capacity: rooms.capacity })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  const roomCapacity = roomRows[0]?.capacity ?? null;

  const enrollmentRows = await executor
    .select({ studentId: courseEnrollments.studentId })
    .from(courseEnrollments)
    .where(eq(courseEnrollments.courseId, courseId));

  const enrolledCount = enrollmentRows.length;

  if (roomCapacity === null) {
    return { sufficient: true, roomCapacity, enrolledCount };
  }

  return {
    sufficient: roomCapacity >= enrolledCount,
    roomCapacity,
    enrolledCount,
  };
}

/**
 * Check if a room is available at the current booking's time slot
 */
export async function checkRoomAvailabilityAtTime(
  roomId: number,
  startAt: Date,
  endAt: Date,
  excludeBookingId?: number,
  executor: DbExecutor = db
): Promise<boolean> {
  const hasOverlap = await hasBookingOverlap(
    roomId,
    startAt,
    endAt,
    executor,
    excludeBookingId
  );

  return !hasOverlap;
}

/**
 * Get room details with building info
 */
export async function getRoomWithBuilding(
  roomId: number,
  executor: DbExecutor = db
) {
  const rows = await executor
    .select({
      roomId: rooms.id,
      roomName: rooms.name,
      buildingId: rooms.buildingId,
      buildingName: buildings.name,
      capacity: rooms.capacity,
      hasProjector: rooms.hasProjector,
      hasMic: rooms.hasMic,
      accessible: rooms.accessible,
    })
    .from(rooms)
    .innerJoin(buildings, eq(rooms.buildingId, buildings.id))
    .where(eq(rooms.id, roomId))
    .limit(1);

  return rows[0] ?? null;
}

/**
 * Validate a venue change request
 */
export async function validateVenueChange(
  input: VenueChangeValidationInput,
  executor: DbExecutor = db
): Promise<VenueValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Check if course exists and user is authorized
  const courseRows = await executor
    .select({ id: courses.id, code: courses.code })
    .from(courses)
    .where(eq(courses.id, input.courseId))
    .limit(1);

  if (courseRows.length === 0) {
    errors.push("Course not found");
    return { valid: false, errors, warnings };
  }

  const isAuthorized = await isAuthorizedForCourse(
    input.requestedBy,
    input.courseId,
    executor
  );

  if (!isAuthorized) {
    errors.push("You are not authorized to request changes for this course");
    return { valid: false, errors, warnings };
  }

  // 2. Check if current booking exists and is linked to course
  const bookingRows = await executor
    .select({
      id: bookings.id,
      roomId: bookings.roomId,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
    })
    .from(bookings)
    .where(eq(bookings.id, input.currentBookingId))
    .limit(1);

  if (bookingRows.length === 0) {
    errors.push("Current booking not found");
    return { valid: false, errors, warnings };
  }

  const currentBooking = bookingRows[0];

  const isLinked = await isBookingLinkedToCourse(
    input.currentBookingId,
    input.courseId,
    executor
  );

  if (!isLinked) {
    errors.push("The specified booking is not linked to this course");
    return { valid: false, errors, warnings };
  }

  // 3. Check if proposed room exists
  const proposedRoom = await getRoomWithBuilding(input.proposedRoomId, executor);

  if (!proposedRoom) {
    errors.push("Proposed room not found");
    return { valid: false, errors, warnings };
  }

  // 4. Check if proposed room is the same as current
  if (currentBooking.roomId === input.proposedRoomId) {
    errors.push("Proposed room is the same as current room");
    return { valid: false, errors, warnings };
  }

  // 5. Check room availability at the booking's current time
  const isAvailable = await checkRoomAvailabilityAtTime(
    input.proposedRoomId,
    new Date(currentBooking.startAt),
    new Date(currentBooking.endAt),
    undefined,
    executor
  );

  if (!isAvailable) {
    errors.push(
      `Room ${proposedRoom.roomName} (${proposedRoom.buildingName}) is not available at the current booking time`
    );
  }

  // 6. Check room capacity
  const capacityCheck = await checkRoomCapacity(
    input.proposedRoomId,
    input.courseId,
    executor
  );

  if (!capacityCheck.sufficient) {
    errors.push(
      `Room capacity (${capacityCheck.roomCapacity}) is insufficient for enrolled students (${capacityCheck.enrolledCount})`
    );
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Find alternative rooms that are available at the same time as current booking
 */
export async function suggestAlternativeRooms(
  currentBookingId: number,
  courseId: number,
  preferredBuildingId?: number,
  executor: DbExecutor = db
): Promise<Array<{
  roomId: number;
  roomName: string;
  buildingName: string;
  capacity: number | null;
  hasProjector: boolean;
  hasMic: boolean;
  accessible: boolean;
}>> {
  // Get current booking time
  const bookingRows = await executor
    .select({
      startAt: bookings.startAt,
      endAt: bookings.endAt,
      currentRoomId: bookings.roomId,
    })
    .from(bookings)
    .where(eq(bookings.id, currentBookingId))
    .limit(1);

  if (bookingRows.length === 0) {
    return [];
  }

  const { startAt, endAt, currentRoomId } = bookingRows[0];

  // Get enrollment count for capacity filtering
  const enrollmentRows = await executor
    .select({ studentId: courseEnrollments.studentId })
    .from(courseEnrollments)
    .where(eq(courseEnrollments.courseId, courseId));

  const minCapacity = enrollmentRows.length > 0 ? enrollmentRows.length : null;

  // Get all rooms with building info
  const allRooms = await executor
    .select({
      roomId: rooms.id,
      roomName: rooms.name,
      buildingId: rooms.buildingId,
      buildingName: buildings.name,
      capacity: rooms.capacity,
      hasProjector: rooms.hasProjector,
      hasMic: rooms.hasMic,
      accessible: rooms.accessible,
    })
    .from(rooms)
    .innerJoin(buildings, eq(rooms.buildingId, buildings.id));

  const suggestions: Array<{
    roomId: number;
    roomName: string;
    buildingId: number;
    buildingName: string;
    capacity: number | null;
    hasProjector: boolean;
    hasMic: boolean;
    accessible: boolean;
  }> = [];

  for (const room of allRooms) {
    // Skip current room
    if (room.roomId === currentRoomId) {
      continue;
    }

    // Check capacity
    if (minCapacity !== null && room.capacity !== null && room.capacity < minCapacity) {
      continue;
    }

    // Check availability
    const hasOverlap = await hasBookingOverlap(
      room.roomId,
      new Date(startAt),
      new Date(endAt),
      executor
    );

    if (!hasOverlap) {
      suggestions.push(room);
    }
  }

  // Sort: preferred building first, then by capacity
  return suggestions
    .sort((a, b) => {
      if (preferredBuildingId) {
        if (a.buildingId === preferredBuildingId && b.buildingId !== preferredBuildingId) {
          return -1;
        }
        if (b.buildingId === preferredBuildingId && a.buildingId !== preferredBuildingId) {
          return 1;
        }
      }
      return (b.capacity ?? 0) - (a.capacity ?? 0);
    })
    .slice(0, 10)
    .map(({ buildingId, ...rest }) => rest);
}

/**
 * Apply an approved venue change - updates the booking
 */
export async function applyVenueChange(
  requestId: number,
  approvedBy: number,
  executor: DbExecutor = db
): Promise<{ success: boolean; error?: string; newBookingId?: number }> {
  // Get the request
  const requestRows = await executor
    .select()
    .from(venueChangeRequests)
    .where(eq(venueChangeRequests.id, requestId))
    .limit(1);

  if (requestRows.length === 0) {
    return { success: false, error: "Venue change request not found" };
  }

  const request = requestRows[0];

  if (request.status !== "PENDING") {
    return { success: false, error: `Request is already ${request.status.toLowerCase()}` };
  }

  // Get current booking
  const bookingRows = await executor
    .select()
    .from(bookings)
    .where(eq(bookings.id, request.currentBookingId))
    .limit(1);

  if (bookingRows.length === 0) {
    return { success: false, error: "Current booking no longer exists" };
  }

  const currentBooking = bookingRows[0];

  // Validate one more time before applying
  const hasOverlap = await hasBookingOverlap(
    request.proposedRoomId,
    new Date(currentBooking.startAt),
    new Date(currentBooking.endAt),
    executor
  );

  if (hasOverlap) {
    return { success: false, error: "Room is no longer available at the booking time" };
  }

  // Update the booking
  const updatedBookings = await executor
    .update(bookings)
    .set({
      roomId: request.proposedRoomId,
      source: "VENUE_CHANGE",
      sourceRef: `venue_change_request:${requestId}`,
      approvedBy,
      approvedAt: new Date(),
    })
    .where(eq(bookings.id, request.currentBookingId))
    .returning();

  if (updatedBookings.length === 0) {
    return { success: false, error: "Failed to update booking" };
  }

  // Update request status
  await executor
    .update(venueChangeRequests)
    .set({
      status: "APPROVED",
      reviewedBy: approvedBy,
      updatedAt: new Date(),
    })
    .where(eq(venueChangeRequests.id, requestId));

  return { success: true, newBookingId: updatedBookings[0].id };
}

/**
 * Get venue change request with related data
 */
export async function getVenueChangeRequestWithDetails(
  requestId: number,
  executor: DbExecutor = db
) {
  const rows = await executor
    .select({
      request: venueChangeRequests,
      course: courses,
      currentBooking: bookings,
      proposedRoom: rooms,
      requestedByUser: users,
    })
    .from(venueChangeRequests)
    .innerJoin(courses, eq(venueChangeRequests.courseId, courses.id))
    .innerJoin(bookings, eq(venueChangeRequests.currentBookingId, bookings.id))
    .innerJoin(rooms, eq(venueChangeRequests.proposedRoomId, rooms.id))
    .innerJoin(users, eq(venueChangeRequests.requestedBy, users.id))
    .where(eq(venueChangeRequests.id, requestId))
    .limit(1);

  return rows[0] ?? null;
}
