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

export const SHORT_TTL = 300; // 5 minutes
export const MEDIUM_TTL = 1800; // 30 minutes
export const LONG_TTL = 3600; // 1 hour
