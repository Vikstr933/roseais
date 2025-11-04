import { Router } from 'express';
import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { rateLimitService } from '../services/RateLimitService';
import os from 'os';

const router = Router();

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  uptime: number;
  services: {
    database: ServiceStatus;
    redis: ServiceStatus;
    ai: ServiceStatus;
    storage: ServiceStatus;
  };
  system: {
    memory: {
      used: number;
      total: number;
      percentage: number;
    };
    cpu: {
      load: number[];
      cores: number;
    };
  };
  version: string;
  environment: string;
  gitCommit?: string;
  deployedAt?: string;
}

interface ServiceStatus {
  status: 'up' | 'down' | 'degraded';
  latency?: number;
  error?: string;
}

/**
 * GET /api/health
 * Health check endpoint for monitoring
 */
router.get('/', async (req, res) => {
  const startTime = Date.now();
  const health: HealthStatus = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: { status: 'down' },
      redis: { status: 'down' },
      ai: { status: 'down' },
      storage: { status: 'down' },
    },
    system: {
      memory: {
        used: 0,
        total: 0,
        percentage: 0,
      },
      cpu: {
        load: os.loadavg(),
        cores: os.cpus().length,
      },
    },
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    gitCommit: process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'unknown',
    deployedAt: process.env.RENDER_DEPLOYED_AT || 'unknown',
  };

  // Check database
  try {
    const dbStart = Date.now();
    await db.execute(sql`SELECT 1`);
    health.services.database = {
      status: 'up',
      latency: Date.now() - dbStart,
    };
  } catch (error) {
    health.services.database = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'unhealthy';
  }

  // Check Redis
  try {
    const redisStart = Date.now();
    // Try to get rate limit status (will test Redis connection)
    await rateLimitService.getAICallsRemaining('health-check');
    health.services.redis = {
      status: 'up',
      latency: Date.now() - redisStart,
    };
  } catch (error) {
    // Redis might not be configured, which is OK in development
    health.services.redis = {
      status: process.env.REDIS_URL ? 'down' : 'up',
      error: process.env.REDIS_URL 
        ? (error instanceof Error ? error.message : 'Unknown error')
        : 'Not configured (using in-memory)',
    };
    if (process.env.REDIS_URL) {
      health.status = 'degraded';
    }
  }

  // Check AI service (Anthropic)
  try {
    if (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'sk-ant-api03-1234567890abcdef') {
      health.services.ai = { status: 'up' };
    } else {
      health.services.ai = {
        status: 'down',
        error: 'API key not configured',
      };
      health.status = 'degraded';
    }
  } catch (error) {
    health.services.ai = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
    health.status = 'degraded';
  }

  // Check storage (R2)
  try {
    if (process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID) {
      health.services.storage = { status: 'up' };
    } else {
      health.services.storage = {
        status: 'down',
        error: 'R2 not configured',
      };
      // Storage is optional, so don't degrade status
    }
  } catch (error) {
    health.services.storage = {
      status: 'down',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }

  // System metrics
  const totalMem = os.totalmem();
  const freeMem = os.freemem();
  const usedMem = totalMem - freeMem;
  
  health.system.memory = {
    used: Math.round(usedMem / 1024 / 1024), // MB
    total: Math.round(totalMem / 1024 / 1024), // MB
    percentage: Math.round((usedMem / totalMem) * 100),
  };

  // Response
  const responseTime = Date.now() - startTime;
  
  // Set appropriate HTTP status code
  let statusCode = 200;
  if (health.status === 'unhealthy') statusCode = 503;
  else if (health.status === 'degraded') statusCode = 200; // Still return 200 for degraded

  res.status(statusCode).json({
    ...health,
    responseTime,
  });
});

/**
 * GET /api/health/live
 * Lightweight liveness check
 */
router.get('/live', (req, res) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /api/health/ready
 * Readiness check - are all critical services ready?
 */
router.get('/ready', async (req, res) => {
  try {
    // Check if database is ready
    await db.execute(sql`SELECT 1`);
    
    res.status(200).json({
      status: 'ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
