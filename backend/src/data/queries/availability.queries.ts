import { and, asc, eq, gt, inArray, lt, sql } from 'drizzle-orm';
import { db } from '../../db';
import { buildings, rooms, bookings } from '../../db/schema';
import { redis, SHORT_TTL } from '../../data/cache/redis.client';

export type RoomWithAvailability = {
  id: number;
  name: string;
  isAvailable: boolean;
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
 * Get availability with caching support.
 * Checks cache first before querying the database.
 */
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
