import { and, asc, eq, gt, inArray, lt, sql, or } from 'drizzle-orm';
import { db } from '../../db';
import { buildings, rooms, bookings, bookingRequests, users } from '../../db/schema';
import { redis, SHORT_TTL } from '../../data/cache/redis.client';

export type BookingDetail = {
  id: number;
  startAt: string;
  endAt: string;
  activityName?: string;
  bookedBy?: string;
  contactInfo?: string;
  purpose?: string;
  hasAccess: boolean;
  visibilityLevel: 'full' | 'restricted' | 'none';
};

export type RoomWithAvailability = {
  id: number;
  name: string;
  isAvailable: boolean;
  bookings?: BookingDetail[];
};

export type BuildingWithRooms = {
  buildingId: number;
  buildingName: string;
  rooms: RoomWithAvailability[];
};

interface QueryParams {
  startAt: Date;
  endAt: Date;
  buildingId?: number | null | undefined;
  buildingIds?: number[];
  limit?: number;
}

interface QueryParamsWithRbac extends QueryParams {
  userId: number;
  userRole: 'ADMIN' | 'STAFF' | 'FACULTY' | 'STUDENT' | 'PENDING_ROLE';
  staffBuildingIds?: number[];
}

/**
 * Generate cache key for availability query
 */
export function getAvailabilityCacheKey(
  buildingId: number | undefined | null,
  startAt: Date,
  endAt: Date
): string {
  const bid = buildingId ?? 'all';
  return `availability:${bid}:${startAt.getTime()}:${endAt.getTime()}`;
}

/**
 * Query rooms and their availability for a given time range.
 * Uses a single optimized query with joins instead of separate queries.
 */
async function queryAvailability(params: QueryParams): Promise<BuildingWithRooms[]> {
  const { startAt, endAt, buildingId, buildingIds = [], limit = 100 } = params;

  const conditions = [];

  if (buildingId !== null && buildingId !== undefined) {
    conditions.push(eq(rooms.buildingId, buildingId));
  } else if (buildingIds.length > 0) {
    conditions.push(inArray(rooms.buildingId, buildingIds));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Single optimized query with joins
  // LEFT JOIN bookings to count overlapping bookings in the time range
  const rows = await db
    .select({
      buildingId: buildings.id,
      buildingName: buildings.name,
      roomId: rooms.id,
      roomName: rooms.name,
      bookingCount: sql<number>`count(${bookings.id})`,
    })
    .from(rooms)
    .innerJoin(buildings, eq(rooms.buildingId, buildings.id))
    .leftJoin(
      bookings,
      and(
        eq(bookings.roomId, rooms.id),
        lt(bookings.startAt, endAt),
        gt(bookings.endAt, startAt)
      )
    )
    .where(whereClause)
    .groupBy(buildings.id, buildings.name, rooms.id, rooms.name)
    .orderBy(asc(buildings.name), asc(rooms.name))
    .limit(limit);

  // Group results by building
  const grouped = new Map<number, BuildingWithRooms>();

  for (const row of rows) {
    const room: RoomWithAvailability = {
      id: row.roomId,
      name: row.roomName,
      isAvailable: Number(row.bookingCount) === 0,
    };

    const existing = grouped.get(row.buildingId);

    if (existing) {
      existing.rooms.push(room);
    } else {
      grouped.set(row.buildingId, {
        buildingId: row.buildingId,
        buildingName: row.buildingName,
        rooms: [room],
      });
    }
  }

  return Array.from(grouped.values());
}

/**
 * Determine visibility level of a booking based on user's role and building scope.
 * Returns:
 * - 'full': User has full access to see all booking details
 * - 'restricted': User can see booking exists but not details
 * - 'none': Should not be returned (filtered at query level)
 */
function getBookingVisibilityLevel(
  userRole: 'ADMIN' | 'STAFF' | 'FACULTY' | 'STUDENT' | 'PENDING_ROLE',
  userId: number,
  bookingUserId: number | null,
  bookingBuildingId: number,
  staffBuildingIds: number[] = []
): 'full' | 'restricted' {
  // ADMIN: full access to all bookings
  if (userRole === 'ADMIN') {
    return 'full';
  }

  // STAFF: full access if booking is in their assigned buildings
  if (userRole === 'STAFF') {
    if (staffBuildingIds.includes(bookingBuildingId)) {
      return 'full';
    }
    return 'restricted';
  }

  // FACULTY & STUDENT: full access only to their own bookings
  if (userRole === 'FACULTY' || userRole === 'STUDENT') {
    if (bookingUserId === userId) {
      return 'full';
    }
    return 'restricted';
  }

  // PENDING_ROLE: restricted access to all bookings
  return 'restricted';
}

/**
 * Query availability with detailed booking information and RBAC filtering.
 * Returns bookings with visibility levels based on user's role and building scope.
 */
async function queryAvailabilityWithBookings(
  params: QueryParamsWithRbac
): Promise<BuildingWithRooms[]> {
  const {
    startAt,
    endAt,
    buildingId,
    buildingIds = [],
    userId,
    userRole,
    staffBuildingIds = [],
    limit = 100,
  } = params;

  const conditions = [];

  if (buildingId !== null && buildingId !== undefined) {
    conditions.push(eq(rooms.buildingId, buildingId));
  } else if (buildingIds.length > 0) {
    conditions.push(inArray(rooms.buildingId, buildingIds));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Fetch all bookings in the time range for relevant rooms
  const bookingRows = await db
    .select({
      bookingId: bookings.id,
      bookingStartAt: bookings.startAt,
      bookingEndAt: bookings.endAt,
      roomId: bookings.roomId,
      roomName: rooms.name,
      buildingId: buildings.id,
      buildingName: buildings.name,
      requestId: bookings.requestId,
      userId: bookingRequests.userId,
      facultyId: bookingRequests.facultyId,
      purpose: bookingRequests.purpose,
      eventType: bookingRequests.eventType,
      userName: users.name,
      userEmail: users.email,
    })
    .from(bookings)
    .innerJoin(rooms, eq(bookings.roomId, rooms.id))
    .innerJoin(buildings, eq(rooms.buildingId, buildings.id))
    .leftJoin(bookingRequests, eq(bookings.requestId, bookingRequests.id))
    .leftJoin(users, or(
      eq(bookingRequests.userId, users.id),
      eq(bookingRequests.facultyId, users.id)
    ))
    .where(
      and(
        whereClause,
        lt(bookings.startAt, endAt),
        gt(bookings.endAt, startAt)
      )
    )
    .orderBy(asc(buildings.name), asc(rooms.name), asc(bookings.startAt))
    .limit(limit);

  // Group results by building/room and add booking details with visibility
  const grouped = new Map<number, Map<number, RoomWithAvailability>>();

  for (const row of bookingRows) {
    if (!grouped.has(row.buildingId)) {
      grouped.set(row.buildingId, new Map());
    }

    const roomMap = grouped.get(row.buildingId)!;
    const existingRoom = roomMap.get(row.roomId);

    const bookingUserId = row.userId || row.facultyId;
    const visibilityLevel = getBookingVisibilityLevel(
      userRole,
      userId,
      bookingUserId,
      row.buildingId,
      staffBuildingIds
    );

    const bookingDetail: BookingDetail = {
      id: row.bookingId,
      startAt: row.bookingStartAt.toISOString(),
      endAt: row.bookingEndAt.toISOString(),
      hasAccess: visibilityLevel === 'full',
      visibilityLevel,
    };

    if (visibilityLevel === 'full') {
      if (row.eventType) {
        bookingDetail.activityName = row.eventType;
      }
      bookingDetail.bookedBy = row.userName || 'Unknown';
      bookingDetail.contactInfo = row.userEmail || '';
      bookingDetail.purpose = row.purpose || '';
    }

    if (existingRoom) {
      existingRoom.bookings = existingRoom.bookings || [];
      existingRoom.bookings.push(bookingDetail);
    } else {
      roomMap.set(row.roomId, {
        id: row.roomId,
        name: row.roomName,
        isAvailable: false,
        bookings: [bookingDetail],
      });
    }
  }

  // Also get rooms with no bookings
  const allRooms = await db
    .select({
      id: rooms.id,
      name: rooms.name,
      buildingId: buildings.id,
      buildingName: buildings.name,
    })
    .from(rooms)
    .innerJoin(buildings, eq(rooms.buildingId, buildings.id))
    .where(whereClause)
    .orderBy(asc(buildings.name), asc(rooms.name))
    .limit(limit);

  // Merge with rooms that have no bookings
  for (const room of allRooms) {
    if (!grouped.has(room.buildingId)) {
      grouped.set(room.buildingId, new Map());
    }

    const roomMap = grouped.get(room.buildingId)!;
    if (!roomMap.has(room.id)) {
      roomMap.set(room.id, {
        id: room.id,
        name: room.name,
        isAvailable: true,
      });
    }
  }

  // Convert to final format
  const result: BuildingWithRooms[] = [];
  for (const [buildingId, roomMap] of grouped) {
    const buildingName = allRooms.find((r) => r.buildingId === buildingId)?.buildingName || 'Unknown';
    result.push({
      buildingId,
      buildingName,
      rooms: Array.from(roomMap.values()),
    });
  }

  return result.sort((a, b) => a.buildingName.localeCompare(b.buildingName));
}

/**
 * Get availability with booking details and RBAC filtering (no caching due to per-user data).
 * Returns bookings with visibility levels based on user's role and building scope.
 */
export async function getAvailabilityWithBookingsAndRbac(
  params: QueryParamsWithRbac
): Promise<BuildingWithRooms[]> {
  return queryAvailabilityWithBookings(params);
}

export async function getAvailabilityWithCache(
  params: QueryParams
): Promise<BuildingWithRooms[]> {
  const cacheKey = getAvailabilityCacheKey(
    params.buildingId,
    params.startAt,
    params.endAt
  );

  // Try to get from cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as BuildingWithRooms[];
    }
  } catch (error) {
    // Log but don't fail if cache read fails
    console.warn('Cache read error:', error);
  }

  // Query database if not cached
  const result = await queryAvailability(params);

  // Store in cache with SHORT_TTL (5 minutes)
  try {
    await redis.setex(cacheKey, SHORT_TTL, JSON.stringify(result));
  } catch (error) {
    // Log but don't fail if cache write fails
    console.warn('Cache write error:', error);
  }

  return result;
}

/**
 * Get availability without caching (for bypassing cache if needed).
 */
export async function getAvailabilityDirect(
  params: QueryParams
): Promise<BuildingWithRooms[]> {
  return queryAvailability(params);
}

/**
 * Invalidate availability cache for a specific time range and building.
 * Useful when bookings are created or modified.
 */
export async function invalidateAvailabilityCache(
  buildingId?: number | null,
  startAt?: Date,
  endAt?: Date
): Promise<void> {
  try {
    if (buildingId !== undefined && startAt && endAt) {
      const cacheKey = getAvailabilityCacheKey(buildingId, startAt, endAt);
      await redis.del(cacheKey);
    } else {
      // Invalidate all availability caches if no specific params
      const pattern = 'availability:*';
      const keys = await redis.keys(pattern);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    }
  } catch (error) {
    console.warn('Cache invalidation error:', error);
  }
}
