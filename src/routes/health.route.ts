import { Router, Request, Response } from 'express';
import { prisma } from '../database/prisma.client';
import { envConfig } from '../config/env.config';
import IORedis from 'ioredis';

const router = Router();

// 1. Basic Liveness Check (Kubernetes Liveness Probe / Load Balancer)
router.get('/', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    environment: envConfig.nodeEnv,
  });
});

router.get('/liveness', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// 2. Comprehensive Readiness Check (Database + Redis + Workers + System Metrics)
router.get('/readiness', async (req: Request, res: Response) => {
  const startTime = Date.now();
  const checks: Record<string, { status: 'healthy' | 'unhealthy' | 'skipped'; latencyMs?: number; error?: string }> = {};
  let overallHealthy = true;

  // Check 1: PostgreSQL Database connectivity
  try {
    const dbStart = Date.now();
    await prisma.$queryRaw`SELECT 1`;
    checks.database = {
      status: 'healthy',
      latencyMs: Date.now() - dbStart,
    };
  } catch (err: any) {
    overallHealthy = false;
    checks.database = {
      status: 'unhealthy',
      error: envConfig.nodeEnv === 'production' ? 'Database connection error' : err.message,
    };
  }

  // Check 2: Redis connectivity
  if (envConfig.redis.enabled) {
    try {
      const redisStart = Date.now();
      const testClient = new IORedis({
        host: envConfig.redis.host,
        port: envConfig.redis.port,
        password: envConfig.redis.password,
        connectTimeout: 2000,
        lazyConnect: true,
        maxRetriesPerRequest: 1,
      });

      await testClient.connect();
      await testClient.ping();
      testClient.disconnect();

      checks.redis = {
        status: 'healthy',
        latencyMs: Date.now() - redisStart,
      };
    } catch (err: any) {
      // Redis is an optimization layer; if unavailable, we can report degraded
      checks.redis = {
        status: 'unhealthy',
        error: envConfig.nodeEnv === 'production' ? 'Redis ping failed' : err.message,
      };
    }
  } else {
    checks.redis = { status: 'skipped' };
  }

  const memoryUsage = process.memoryUsage();
  const statusCode = overallHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: overallHealthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    totalDurationMs: Date.now() - startTime,
    checks,
    metrics: {
      uptimeSeconds: Math.floor(process.uptime()),
      heapUsedMb: Math.round((memoryUsage.heapUsed / 1024 / 1024) * 100) / 100,
      heapTotalMb: Math.round((memoryUsage.heapTotal / 1024 / 1024) * 100) / 100,
      rssMb: Math.round((memoryUsage.rss / 1024 / 1024) * 100) / 100,
    },
  });
});

export default router;
