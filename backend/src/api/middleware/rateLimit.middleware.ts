import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redis } from '../../data/cache/redis.client';

export const generalLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((command: string, ...args: string[]) => {
      return redis.call(command, ...args) as any;
    }) as any,
    prefix: 'rl:general:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    return (req as any).isInternalOperation === true;
  },
});

export const authLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((command: string, ...args: string[]) => {
      return redis.call(command, ...args) as any;
    }) as any,
    prefix: 'rl:auth:',
  }),
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
});

export const uploadLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: ((command: string, ...args: string[]) => {
      return redis.call(command, ...args) as any;
    }) as any,
    prefix: 'rl:upload:',
  }),
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});
