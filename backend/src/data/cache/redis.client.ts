import Redis from 'ioredis';
import logger from '../../shared/utils/logger';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

// Track Redis connection state
export let isRedisAvailable = false;

// Create Redis client with connection failure handling
// In development, Redis is optional - the server will work without it
export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 3) {
      logger.warn('Redis connection failed after 3 retries, disabling Redis features');
      isRedisAvailable = false;
      // Return null to stop retrying
      return null;
    }
    // Retry with exponential backoff
    return Math.min(times * 200, 2000);
  },
  lazyConnect: true,
});

redis.on('error', (error: NodeJS.ErrnoException) => {
  // Only log once when Redis becomes unavailable
  if (isRedisAvailable || error.code !== 'ECONNREFUSED') {
    logger.error('Redis connection error:', error);
  }
  isRedisAvailable = false;
});

redis.on('connect', () => {
  logger.info('Redis connected');
  isRedisAvailable = true;
});

redis.on('ready', () => {
  isRedisAvailable = true;
});

// Attempt initial connection (non-blocking)
redis.connect().catch(() => {
  logger.warn('Redis unavailable - rate limiting and caching will use fallback behavior');
  isRedisAvailable = false;
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
