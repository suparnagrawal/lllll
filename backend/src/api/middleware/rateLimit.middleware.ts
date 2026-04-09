import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis, isRedisAvailable } from '../../data/cache/redis.client';

function createRateLimiter(input: {
  prefix: string;
  windowMs: number;
  max: number;
  skip?: Parameters<typeof rateLimit>[0]["skip"];
}) {
  // Base config without Redis store
  const baseConfig: Parameters<typeof rateLimit>[0] = {
    windowMs: input.windowMs,
    max: input.max,
    standardHeaders: true,
    legacyHeaders: false,
    ...(input.skip ? { skip: input.skip } : {}),
  };

  // Create rate limiter - will use memory store by default
  // Redis store is added dynamically if available
  const limiter = rateLimit({
    ...baseConfig,
    // Dynamically create Redis store on each request if Redis is available
    // Falls back to memory store automatically when Redis is not available
  });

  // Return a middleware that conditionally uses Redis or memory store
  return (req: any, res: any, next: any) => {
    if (isRedisAvailable) {
      // Use Redis store when available
      const redisLimiter = rateLimit({
        ...baseConfig,
        store: new RedisStore({
          sendCommand: ((command: string, ...args: string[]) => {
            return redis.call(command, ...args) as any;
          }) as any,
          prefix: input.prefix,
        }),
      });
      return redisLimiter(req, res, next);
    }
    // Use memory-based rate limiting as fallback
    return limiter(req, res, next);
  };
}

// General API limiter: 300 requests per 15 minutes (20 req/min)
// Covers: dashboard, rooms, buildings, bookings, availability, users, notifications
// Expected usage: availability checks can generate 10-50 requests at once,
// plus token refresh (1/5min) and navigation across multiple pages
export const generalLimiter = createRateLimiter({
  prefix: 'rl:general:',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300, // ~20 req/min - accommodates availability queries + normal navigation
  skip: (req) => {
    // Skip internal operations and auth routes (auth has its own limiter)
    return (req as any).isInternalOperation === true || req.path.startsWith('/auth');
  },
});

// Auth limiter: 20 requests per 5 minutes
// Covers: login, token refresh (1/5min), /me profile fetch, OAuth callbacks
// Expected usage: 3-4 requests for OAuth login, 1/5min for refresh
export const authLimiter = createRateLimiter({
  prefix: 'rl:auth:',
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20, // OAuth login (4) + refresh (1) + profile fetches with margin
});

export const uploadLimiter = createRateLimiter({
  prefix: 'rl:upload:',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
});

// Timetable ingestion limiters
export const timetableImportReadLimiter = createRateLimiter({
  prefix: 'rl:timetable:imports:read:',
  windowMs: 15 * 60 * 1000,
  max: 120,
});

export const timetableImportPreviewLimiter = createRateLimiter({
  prefix: 'rl:timetable:imports:preview:',
  windowMs: 60 * 60 * 1000,
  max: 10,
});

export const timetableImportMutationLimiter = createRateLimiter({
  prefix: 'rl:timetable:imports:mutation:',
  windowMs: 15 * 60 * 1000,
  max: 45,
});

export const timetableImportCommitLimiter = createRateLimiter({
  prefix: 'rl:timetable:imports:commit:',
  windowMs: 15 * 60 * 1000,
  max: 12,
});
