import { and, eq, gt, lt, ne, inArray } from "drizzle-orm";
import { db } from "../db";
import {
  slotChangeRequests,
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

export type SlotChangeRequestStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export type ValidationResult = {
  valid: boolean;
  errors: string[];
  warnings: string[];
  suggestions?: AlternativeSuggestion[];
};

export type AlternativeSuggestion = {
  type: "room" | "time";
  roomId?: number;
  roomName?: string;
  buildingName?: string;
  startAt?: Date;
  endAt?: Date;
  reason: string;
};

export type StudentConflict = {
  studentId: number;
  studentName: string;
  conflictingCourseCode: string;
  conflictingCourseName: string;
};

export type SlotChangeValidationInput = {
  courseId: number;
  currentBookingId: number;
  proposedRoomId?: number | null;
  proposedStart: Date;
  proposedEnd: Date;
  requestedBy: number;
};

/**
 * Check if the user is authorized to request slot changes for a course
 */
export async function isAuthorizedForCourse(
  userId: number,
  courseId: number,
  executor: DbExecutor = db
): Promise<boolean> {
  // Check if user is a faculty member for this course
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
 * Check if proposed room has sufficient capacity
 */
async function checkRoomCapacity(
  roomId: number,
  courseId: number,
  executor: DbExecutor = db
): Promise<{ sufficient: boolean; roomCapacity: number | null; enrolledCount: number }> {
  // Get room capacity
  const roomRows = await executor
    .select({ capacity: rooms.capacity })
    .from(rooms)
    .where(eq(rooms.id, roomId))
    .limit(1);

  const roomCapacity = roomRows[0]?.capacity ?? null;

  // Get enrolled student count
  const enrollmentRows = await executor
    .select({ studentId: courseEnrollments.studentId })
    .from(courseEnrollments)
    .where(eq(courseEnrollments.courseId, courseId));

  const enrolledCount = enrollmentRows.length;

  // If no capacity data, consider it sufficient (graceful degradation)
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
 * Check for student-level schedule conflicts
 * Returns conflicts only if enrollment data is available (per REQ-4.3.14)
 */
export async function checkStudentConflicts(
  courseId: number,
  proposedStart: Date,
  proposedEnd: Date,
  excludeBookingId?: number,
  executor: DbExecutor = db
): Promise<{ hasConflicts: boolean; conflicts: StudentConflict[]; enrollmentDataAvailable: boolean }> {
  // Get students enrolled in this course
  const enrolledStudents = await executor
    .select({
      studentId: courseEnrollments.studentId,
      studentName: users.name,
    })
    .from(courseEnrollments)
    .innerJoin(users, eq(courseEnrollments.studentId, users.id))
    .where(eq(courseEnrollments.courseId, courseId));

  if (enrolledStudents.length === 0) {
    // No enrollment data available - graceful degradation per REQ-4.3.14
    return { hasConflicts: false, conflicts: [], enrollmentDataAvailable: false };
  }

  const studentIds = enrolledStudents.map((s: { studentId: number }) => s.studentId);
  const conflicts: StudentConflict[] = [];

  // Find other courses these students are enrolled in
  const otherEnrollments = await executor
    .select({
      studentId: courseEnrollments.studentId,
      courseId: courseEnrollments.courseId,
      courseCode: courses.code,
      courseName: courses.name,
    })
    .from(courseEnrollments)
    .innerJoin(courses, eq(courseEnrollments.courseId, courses.id))
    .where(
      and(
        inArray(courseEnrollments.studentId, studentIds),
        ne(courseEnrollments.courseId, courseId)
      )
    );

  if (otherEnrollments.length === 0) {
    return { hasConflicts: false, conflicts: [], enrollmentDataAvailable: true };
  }

  // Get bookings for those courses that overlap with proposed time
  const otherCourseIds: number[] = [...new Set<number>(otherEnrollments.map((e: { courseId: number }) => e.courseId))];

  const conflictingBookings = await executor
    .select({
      bookingId: bookings.id,
      courseId: bookingCourseLink.courseId,
      startAt: bookings.startAt,
      endAt: bookings.endAt,
    })
    .from(bookingCourseLink)
    .innerJoin(bookings, eq(bookingCourseLink.bookingId, bookings.id))
    .where(
      and(
        inArray(bookingCourseLink.courseId, otherCourseIds),
        lt(bookings.startAt, proposedEnd),
        gt(bookings.endAt, proposedStart),
        excludeBookingId ? ne(bookings.id, excludeBookingId) : undefined
      )
    );

  if (conflictingBookings.length === 0) {
    return { hasConflicts: false, conflicts: [], enrollmentDataAvailable: true };
  }

  // Map conflicts back to students
  const conflictingCourseIds = new Set(conflictingBookings.map((b: { courseId: number }) => b.courseId));

  for (const enrollment of otherEnrollments) {
    if (conflictingCourseIds.has(enrollment.courseId)) {
      const student = enrolledStudents.find((s: { studentId: number }) => s.studentId === enrollment.studentId);
      if (student) {
        conflicts.push({
          studentId: enrollment.studentId,
          studentName: student.studentName,
          conflictingCourseCode: enrollment.courseCode,
          conflictingCourseName: enrollment.courseName,
        });
      }
    }
  }

  // Deduplicate by student + course
  const uniqueConflicts = conflicts.filter(
    (c, i, arr) =>
      arr.findIndex(
        (x) => x.studentId === c.studentId && x.conflictingCourseCode === c.conflictingCourseCode
      ) === i
  );

  return {
    hasConflicts: uniqueConflicts.length > 0,
    conflicts: uniqueConflicts,
    enrollmentDataAvailable: true,
  };
}

/**
 * Find alternative available rooms at the proposed time
 */
export async function suggestAlternativeRooms(
  proposedStart: Date,
  proposedEnd: Date,
  minCapacity: number | null,
  preferredBuildingId?: number,
  executor: DbExecutor = db
): Promise<AlternativeSuggestion[]> {
  // Get all rooms with building info
  const allRooms = await executor
    .select({
      roomId: rooms.id,
      roomName: rooms.name,
      buildingId: rooms.buildingId,
      buildingName: buildings.name,
      capacity: rooms.capacity,
    })
    .from(rooms)
    .innerJoin(buildings, eq(rooms.buildingId, buildings.id));

  const suggestions: AlternativeSuggestion[] = [];

  for (const room of allRooms) {
    // Check if room is available
    const hasOverlap = await hasBookingOverlap(
      room.roomId,
      proposedStart,
      proposedEnd,
      executor
    );

    if (!hasOverlap) {
      // Check capacity if required
      if (minCapacity !== null && room.capacity !== null && room.capacity < minCapacity) {
        continue;
      }

      suggestions.push({
        type: "room",
        roomId: room.roomId,
        roomName: room.roomName,
        buildingName: room.buildingName,
        startAt: proposedStart,
        endAt: proposedEnd,
        reason: `Room ${room.roomName} (${room.buildingName}) is available at the requested time`,
      });
    }
  }

  // Sort: preferred building first, then by capacity
  type RoomInfo = { roomId: number; buildingId: number; capacity: number | null };
  return suggestions.sort((a, b) => {
    const aRoom = allRooms.find((r: RoomInfo) => r.roomId === a.roomId);
    const bRoom = allRooms.find((r: RoomInfo) => r.roomId === b.roomId);

    // Preferred building comes first
    if (preferredBuildingId) {
      if (aRoom?.buildingId === preferredBuildingId && bRoom?.buildingId !== preferredBuildingId) {
        return -1;
      }
      if (bRoom?.buildingId === preferredBuildingId && aRoom?.buildingId !== preferredBuildingId) {
        return 1;
      }
    }

    // Then sort by capacity (larger first)
    return (bRoom?.capacity ?? 0) - (aRoom?.capacity ?? 0);
  }).slice(0, 5); // Return top 5 suggestions
}

/**
 * Validate a slot change request
 */
export async function validateSlotChange(
  input: SlotChangeValidationInput,
  executor: DbExecutor = db
): Promise<ValidationResult> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const suggestions: AlternativeSuggestion[] = [];

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

  const isLinked = await isBookingLinkedToCourse(
    input.currentBookingId,
    input.courseId,
    executor
  );

  if (!isLinked) {
    errors.push("The specified booking is not linked to this course");
    return { valid: false, errors, warnings };
  }

  // Determine target room
  const targetRoomId = input.proposedRoomId ?? bookingRows[0].roomId;

  // 3. Check room availability at proposed time
  const hasOverlap = await hasBookingOverlap(
    targetRoomId,
    input.proposedStart,
    input.proposedEnd,
    executor,
    input.currentBookingId // Exclude current booking from overlap check
  );

  if (hasOverlap) {
    errors.push("The proposed room is not available at the requested time");

    // Get enrollment count for capacity requirement
    const enrollmentRows = await executor
      .select({ studentId: courseEnrollments.studentId })
      .from(courseEnrollments)
      .where(eq(courseEnrollments.courseId, input.courseId));

    const minCapacity = enrollmentRows.length > 0 ? enrollmentRows.length : null;

    // Find alternative rooms
    const roomSuggestions = await suggestAlternativeRooms(
      input.proposedStart,
      input.proposedEnd,
      minCapacity,
      undefined,
      executor
    );

    suggestions.push(...roomSuggestions);
  }

  // 4. Check room capacity
  const capacityCheck = await checkRoomCapacity(targetRoomId, input.courseId, executor);

  if (!capacityCheck.sufficient) {
    errors.push(
      `Room capacity (${capacityCheck.roomCapacity}) is insufficient for enrolled students (${capacityCheck.enrolledCount})`
    );
  }

  // 5. Check student schedule conflicts
  const studentConflicts = await checkStudentConflicts(
    input.courseId,
    input.proposedStart,
    input.proposedEnd,
    input.currentBookingId,
    executor
  );

  if (!studentConflicts.enrollmentDataAvailable) {
    warnings.push(
      "Student enrollment data is not available. Student-level schedule validation was not performed."
    );
  } else if (studentConflicts.hasConflicts) {
    const conflictCount = studentConflicts.conflicts.length;
    const conflictSummary = studentConflicts.conflicts
      .slice(0, 3)
      .map((c) => `${c.studentName} (${c.conflictingCourseCode})`)
      .join(", ");

    errors.push(
      `${conflictCount} student(s) have schedule conflicts: ${conflictSummary}${conflictCount > 3 ? "..." : ""}`
    );
  }

  const result: ValidationResult = {
    valid: errors.length === 0,
    errors,
    warnings,
  };

  if (suggestions.length > 0) {
    result.suggestions = suggestions;
  }

  return result;
}

/**
 * Apply an approved slot change - updates the booking
 */
export async function applySlotChange(
  requestId: number,
  approvedBy: number,
  executor: DbExecutor = db
): Promise<{ success: boolean; error?: string; newBookingId?: number }> {
  // Get the request
  const requestRows = await executor
    .select()
    .from(slotChangeRequests)
    .where(eq(slotChangeRequests.id, requestId))
    .limit(1);

  if (requestRows.length === 0) {
    return { success: false, error: "Slot change request not found" };
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
  const targetRoomId = request.proposedRoomId ?? currentBooking.roomId;

  // Validate one more time before applying
  const hasOverlap = await hasBookingOverlap(
    targetRoomId,
    new Date(request.proposedStart),
    new Date(request.proposedEnd),
    executor,
    request.currentBookingId
  );

  if (hasOverlap) {
    return { success: false, error: "Room is no longer available at the requested time" };
  }

  // Update the booking
  const updatedBookings = await executor
    .update(bookings)
    .set({
      roomId: targetRoomId,
      startAt: new Date(request.proposedStart),
      endAt: new Date(request.proposedEnd),
      source: "SLOT_CHANGE",
      sourceRef: `slot_change_request:${requestId}`,
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
    .update(slotChangeRequests)
    .set({
      status: "APPROVED",
      reviewedBy: approvedBy,
      updatedAt: new Date(),
    })
    .where(eq(slotChangeRequests.id, requestId));

  return { success: true, newBookingId: updatedBookings[0].id };
}

/**
 * Get slot change request with related data
 */
export async function getSlotChangeRequestWithDetails(
  requestId: number,
  executor: DbExecutor = db
) {
  const rows = await executor
    .select({
      request: slotChangeRequests,
      course: courses,
      currentBooking: bookings,
      proposedRoom: rooms,
      requestedByUser: users,
    })
    .from(slotChangeRequests)
    .innerJoin(courses, eq(slotChangeRequests.courseId, courses.id))
    .innerJoin(bookings, eq(slotChangeRequests.currentBookingId, bookings.id))
    .leftJoin(rooms, eq(slotChangeRequests.proposedRoomId, rooms.id))
    .innerJoin(users, eq(slotChangeRequests.requestedBy, users.id))
    .where(eq(slotChangeRequests.id, requestId))
    .limit(1);

  return rows[0] ?? null;
}
