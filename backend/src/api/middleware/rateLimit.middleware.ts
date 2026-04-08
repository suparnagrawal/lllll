import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../../data/cache/redis.client';

function createRedisRateLimiter(input: {
  prefix: string;
  windowMs: number;
  max: number;
  skip?: Parameters<typeof rateLimit>[0]["skip"];
}) {
  return rateLimit({
    store: new RedisStore({
      sendCommand: ((command: string, ...args: string[]) => {
        return redis.call(command, ...args) as any;
      }) as any,
      prefix: input.prefix,
    }),
    windowMs: input.windowMs,
    max: input.max,
    standardHeaders: true,
    legacyHeaders: false,
    ...(input.skip ? { skip: input.skip } : {}),
  });
}

export const generalLimiter = createRedisRateLimiter({
  prefix: 'rl:general:',
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  skip: (req) => {
    return (req as any).isInternalOperation === true;
  },
});

export const authLimiter = createRedisRateLimiter({
  prefix: 'rl:auth:',
  windowMs: 3 * 60 * 1000, // 3 minutes
  max: 5,
});

export const uploadLimiter = createRedisRateLimiter({
  prefix: 'rl:upload:',
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
});

// Timetable ingestion limiters
export const timetableImportReadLimiter = createRedisRateLimiter({
  prefix: 'rl:timetable:imports:read:',
  windowMs: 15 * 60 * 1000,
  max: 120,
});

export const timetableImportPreviewLimiter = createRedisRateLimiter({
  prefix: 'rl:timetable:imports:preview:',
  windowMs: 60 * 60 * 1000,
  max: 10,
});

export const timetableImportMutationLimiter = createRedisRateLimiter({
  prefix: 'rl:timetable:imports:mutation:',
  windowMs: 15 * 60 * 1000,
  max: 45,
});

export const timetableImportCommitLimiter = createRedisRateLimiter({
  prefix: 'rl:timetable:imports:commit:',
  windowMs: 15 * 60 * 1000,
  max: 12,
});
