import Redis from 'ioredis';
import logger from '../../shared/utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redis = new Redis(redisUrl);

redis.on('error', (error) => {
  logger.error('Redis connection error:', error);
});

export const cacheKeys = {
  buildings: () => 'buildings:all',
  building: (id: number) => `building:${id}`,
  rooms: (buildingId?: number) =>
    buildingId ? `rooms:building:${buildingId}` : 'rooms:all',
  staffAssignments: (staffId: number) => `staff:${staffId}:buildings`,
  user: (id: number) => `user:${id}`,
};

// Cache TTL constants optimized by data volatility
// Override defaults using environment variables: CACHE_VERY_SHORT_TTL, CACHE_SHORT_TTL, etc.

// Highly volatile data (bookings, real-time availability) - should rarely cache
export const VERY_SHORT_TTL = parseInt(process.env.CACHE_VERY_SHORT_TTL || '120', 10); // 2 minutes

// Volatile data (room/building availability) - changes frequently with bookings
export const SHORT_TTL = parseInt(process.env.CACHE_SHORT_TTL || '300', 10); // 5 minutes

// Moderately volatile data (user profiles, building/room metadata) - changes occasionally
export const MEDIUM_TTL = parseInt(process.env.CACHE_MEDIUM_TTL || '1800', 10); // 30 minutes

// Relatively static data (event types, configuration) - rarely changes
export const LONG_TTL = parseInt(process.env.CACHE_LONG_TTL || '3600', 10); // 1 hour

// Very static data (reference lists, enumerations) - can cache longer
export const VERY_LONG_TTL = parseInt(process.env.CACHE_VERY_LONG_TTL || '7200', 10); // 2 hours
