import { Router, Request, Response } from 'express';
import { pool } from '../../db';
import { redis } from '../../data/cache/redis.client';
import logger from '../../shared/utils/logger';

const router = Router();

/**
 * GET /health
 * Basic health check - always returns 200 if server is running
 */
router.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: Date.now(),
  });
});

/**
 * GET /health/ready
 * Readiness check - verifies critical dependencies (DB, Redis)
 * Returns 503 if any check fails
 */
router.get('/ready', async (req: Request, res: Response) => {
  const checks: { db: string; redis: string } = {
    db: 'failed',
    redis: 'failed',
  };
  let statusCode = 200;

  // Check database connection
  try {
    await pool.query('SELECT 1');
    checks.db = 'ok';
  } catch (error) {
    logger.error('Database health check failed:', error);
    checks.db = 'failed';
    statusCode = 503;
  }

  // Check Redis connection
  try {
    await redis.ping();
    checks.redis = 'ok';
  } catch (error) {
    logger.error('Redis health check failed:', error);
    checks.redis = 'failed';
    statusCode = 503;
  }

  res.status(statusCode).json({
    status: statusCode === 200 ? 'ready' : 'not-ready',
    checks,
  });
});

/**
 * GET /health/live
 * Liveness check - simple check that server is running
 */
router.get('/live', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'alive',
  });
});

export default router;
