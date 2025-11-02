import express from 'express';
import cors from 'cors';
import path from 'path';
import EventEmitter from 'events';
import { Logger } from './utils/Logger';
import { sentryService } from './services/SentryService';
import {
  sentryRequestHandler,
  sentryTracingHandler,
  sentryErrorHandler,
  errorLogger,
  errorResponder
} from './middleware/sentry';
import securityMiddleware from './middleware/security';
import { performanceService, apiCache, compressionMiddleware, memoryMonitoring } from './services/PerformanceService';
import agentsRouter from './routes/agents';
import promptsRouter from './routes/prompts';
import workspacesRouter from './routes/workspaces';
import componentsRouter from './routes/components';
import companiesRouter from './routes/companies';
import frameworksRouter from './routes/frameworks';
import knowledgeRouter from './routes/knowledge';
import githubKnowledgeRouter from './routes/github-knowledge';
import apiKeysRouter from './routes/api-keys';
import monetizationRouter from './routes/monetization';
import billingRouter from './routes/billing';
import relevanceRouter from './routes/relevance';
import terminalRouter from './routes/terminal';
import sseRouter from './routes/sse';
import serverRouter from './routes/server';
import modelsRouter from './routes/models';
import sessionsRouter from './routes/sessions';
import authRouter from './routes/auth.js';
import oauthRouter from './routes/oauth';
import testRouter from './routes/test';
import stripeRouter from './routes/stripe';
import pluginsRouter from './routes/plugins';
import workspaceSessionsRouter from './routes/workspace';
import healthRouter from './routes/health';
import adminRouter from './routes/admin';
import activityRouter from './routes/activity';
import omniassistantRouter from './routes/omniassistant';
import { lockCleanupService } from './utils/lockCleanup';
import { webSocketService } from './services/WebSocketService';
import { chatCleanupService } from './services/ChatCleanupService';

import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
dotenv.config();

// Initialize Sentry FIRST
sentryService.initialize();

const PORT = process.env.PORT || 3001;
const logger = new Logger(process.cwd());
const app = express();
export const agentEventEmitter = new EventEmitter();

// Initialize logger before starting server
const initializeApp = async () => {
  try {
    try {
      console.log('Initializing logger...');
      await logger.initialize();
      console.log('Logger initialized successfully');
    } catch (error) {
      console.error('Logger initialization failed:', error);
      throw error;
    }

    // Database connection is tested automatically in db/index.ts
    // The connection test happens when the db module is imported
    await logger.info('Server', 'Database connection successful');

    // Initialize SSE clients Set
    app.locals.sseClients = new Set();
    app.locals.logger = logger; // Make logger available throughout the app

    // Sentry request handler - MUST be first middleware
    app.use(sentryRequestHandler());
    app.use(sentryTracingHandler());

    // Build allowed origins from environment variables
    const allowedOrigins = [
      'http://localhost:5173',
      'http://localhost:5174',
      new RegExp('http://localhost:5[0-9]{3}'),
      // Add Vercel deployment patterns
      'https://newai-sigma.vercel.app',
      'https://newai.vercel.app',
      new RegExp('https://newai-.*\\.vercel\\.app'),  // Match all Vercel preview URLs
      new RegExp('https://.*-viktors-projects-.*\\.vercel\\.app'), // Match user-specific Vercel URLs
    ];

    // Add production origins if set
    if (process.env.ALLOWED_ORIGINS) {
      const prodOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
      allowedOrigins.push(...prodOrigins);
    }

    // Fallback to FRONTEND_URL if no ALLOWED_ORIGINS
    if (process.env.FRONTEND_URL && !process.env.ALLOWED_ORIGINS) {
      allowedOrigins.push(process.env.FRONTEND_URL);
    }

    // Advanced Security Middleware
    app.use(securityMiddleware.securityHeaders({
      allowedOrigins: allowedOrigins.filter(origin => typeof origin === 'string')
    }));
    app.use(securityMiddleware.requestMonitoring());
    app.use(securityMiddleware.inputValidation());
    app.use(securityMiddleware.apiRateLimit());

    // Performance Optimization Middleware
    app.use(compressionMiddleware());
    app.use(memoryMonitoring());
    app.use('/api', apiCache(performanceService.getCache(), 300)); // 5 minute cache for API routes

    // Handle preflight OPTIONS requests explicitly
    app.options('*', (req, res, next) => {
      const origin = req.headers.origin;
      const isAllowed = !origin || allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return allowed === origin;
        } else if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.status(204).send();
      } else {
        res.status(403).send();
      }
    });

    // Global CORS configuration (now using secure CORS)
    app.use(
      cors({
        origin: (origin, callback) => {
          // Allow requests with no origin (e.g., mobile apps, Postman)
          if (!origin) return callback(null, true);

          // Check if origin is in allowed list (string or regex match)
          const isAllowed = allowedOrigins.some(allowed => {
            if (typeof allowed === 'string') {
              return allowed === origin;
            } else if (allowed instanceof RegExp) {
              return allowed.test(origin);
            }
            return false;
          });

          if (isAllowed) {
            callback(null, true);
          } else {
            console.warn(`CORS blocked origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
          }
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization'],
        preflightContinue: false,
        optionsSuccessStatus: 204
      })
    );

    // Special CORS handling for SSE endpoints
    app.use('/api/sse', (req, res, next) => {
      const origin = req.headers.origin;
      if (origin && allowedOrigins.some(allowed =>
        typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
      )) {
        res.setHeader('Access-Control-Allow-Origin', origin);
      } else {
        // Fallback to first allowed origin for development
        res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_URL || 'http://localhost:5173');
      }
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      next();
    });

    app.use(express.json({ limit: '10mb' })); // Reduced for security

    // Add enhanced logging middleware
    app.use(async (req, res, next) => {
      const startTime = Date.now();
      const requestId = Math.random().toString(36).substr(2, 9);

      // Determine log category based on request path
      let category = 'Server';
      if (req.path.startsWith('/api/agents')) category = 'AgentAPI';
      else if (req.path.startsWith('/api/auth')) category = 'AuthAPI';
      else if (req.path.startsWith('/api/logs')) category = 'LogAPI';
      else if (req.path.startsWith('/api/sse')) category = 'SSE';
      else if (req.path.startsWith('/api/')) category = 'API';

      // Log incoming request with detailed information
      await logger.info(category, `[${requestId}] ${req.method} ${req.url}`, {
        requestId,
        method: req.method,
        url: req.url,
        path: req.path,
        query: Object.keys(req.query).length > 0 ? req.query : undefined,
        headers: {
          'user-agent': req.get('User-Agent'),
          'content-type': req.get('Content-Type'),
          'content-length': req.get('Content-Length'),
          authorization: req.get('Authorization') ? '[REDACTED]' : undefined,
          'x-forwarded-for': req.get('X-Forwarded-For'),
          'x-real-ip': req.get('X-Real-IP'),
        },
        ip: req.ip || req.connection.remoteAddress,
        body:
          req.method !== 'GET' && req.body
            ? req.body.password || req.body.token
              ? '[REDACTED]'
              : req.body
            : undefined,
        timestamp: new Date().toISOString(),
      });

      // Override res.end to log response details
      const originalEnd = res.end;
      res.end = function (chunk?: any, encoding?: any, cb?: any) {
        const duration = Date.now() - startTime;
        const responseSize =
          res.get('Content-Length') || (chunk ? chunk.length : 0);

        // Record performance metrics
        performanceService.recordResponseTime(req.path, duration);

        // Log response details
        logger
          .info(category, `[${requestId}] Response ${res.statusCode}`, {
            requestId,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            responseSize: responseSize ? `${responseSize} bytes` : undefined,
            headers: {
              'content-type': res.get('Content-Type'),
              'content-length': res.get('Content-Length'),
            },
            timestamp: new Date().toISOString(),
          })
          .catch(console.error);

        // Call original end method with proper return
        return originalEnd.call(this, chunk, encoding, cb);
      };

      next();
    });

    // Add agent validation middleware for task-related endpoints
    app.use(async (req, res, next) => {
      // Skip validation for GET requests and agent management endpoints
      if (req.method === 'GET' || req.path.startsWith('/api/agents')) {
        return next();
      }

      // For task-related endpoints that use agents, ensure agent is active
      if (req.body.agentId) {
        try {
          const response = await fetch(
            `http://localhost:${PORT}/api/agents/validate/${req.body.agentId}`
          );
          if (!response.ok) {
            const error = await response.json();
            return res.status(response.status).json(error);
          }
        } catch (error) {
          await logger.error('Server', 'Error validating agent', {
            error: error instanceof Error ? error.message : String(error),
          });
          return res
            .status(500)
            .json({ error: 'Failed to validate agent status' });
        }
      }

      next();
    });

    // Routes
    app.use('/api/health', healthRouter); // Health check endpoints (no auth required)
    app.use('/api/auth', authRouter);
    app.use('/api/auth', oauthRouter); // OAuth routes
    app.use('/api', testRouter); // Test endpoints
    app.use('/api', agentsRouter);
    app.use('/api', promptsRouter);
    app.use('/api/workspaces', workspacesRouter);
    app.use('/api', componentsRouter);
    app.use('/api/companies', companiesRouter);
    app.use('/api/frameworks', frameworksRouter);
    app.use('/api/knowledge', knowledgeRouter);
    app.use('/api/github-knowledge', githubKnowledgeRouter);
    app.use('/api/api-keys', apiKeysRouter);
    app.use('/api/monetization', monetizationRouter);
    app.use('/api/billing', billingRouter);
    app.use('/api/knowledge', relevanceRouter);
    app.use('/api/terminal', terminalRouter);
    app.use('/api/stripe', stripeRouter); // Stripe payment routes
    app.use('/api/plugins', pluginsRouter); // Plugin system routes
    app.use('/api/omniassistant', omniassistantRouter); // OmniAssistant - Digital Office Platform
    app.use('/api/workspace-sessions', workspaceSessionsRouter); // Workspace session persistence
    app.use('/api/activity', activityRouter); // User activity tracking routes
    app.use('/api', sseRouter); // This will handle /api/sse/* routes

    app.get('/api/sse/agent-activity', (req, res) => {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });

      res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

      const listener = (event: unknown) => {
        res.write(`data: ${JSON.stringify(event)}\n\n`);
      };

      agentEventEmitter.on('agent-event', listener);

      req.on('close', () => {
        agentEventEmitter.off('agent-event', listener);
        res.end();
      });
    });
    app.use('/api/server', serverRouter);
    app.use('/api/models', modelsRouter);
    app.use('/api/sessions', sessionsRouter);
    app.use('/api/admin', adminRouter); // Admin endpoints for database cleanup

    // Performance metrics endpoint
    app.get('/api/metrics/performance', (req, res) => {
      const metrics = performanceService.getMetrics();
      res.json({
        performance: metrics,
        memory: process.memoryUsage(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
      });
    });

    // Deployment routes
    const deploymentRouter = await import('./routes/deployment.js');
    app.use('/api', deploymentRouter.default);

    // Preview route
    app.get('/preview/:component', (req, res) => {
      const componentName = req.params.component;
      res.sendFile(path.join(process.cwd(), 'client/index.html'));
    });

    // Editor route
    app.get('/editor/:component', (req, res) => {
      const componentName = req.params.component;
      res.sendFile(path.join(process.cwd(), 'client/index.html'));
    });

    // Serve static files from client directory
    app.use(express.static(path.join(process.cwd(), 'client')));

    // Sentry error handler - MUST be after routes but BEFORE error handlers
    app.use(sentryErrorHandler());
    app.use(errorLogger);

    // Error handling
    app.use(async (err: any, req: any, res: any, next: any) => {
      const error = err instanceof Error ? err.message : String(err);
      const stack = err instanceof Error ? err.stack : undefined;

      await logger.error('Server', `Error in ${req.method} ${req.url}`, {
        error,
        stack,
        method: req.method,
        url: req.url,
        path: req.path,
        query: req.query,
        body: req.body,
        headers: {
          'user-agent': req.get('User-Agent'),
          'content-type': req.get('Content-Type'),
          authorization: req.get('Authorization') ? '[REDACTED]' : undefined,
        },
        ip: req.ip || req.connection.remoteAddress,
        timestamp: new Date().toISOString(),
      });

      res.status(500).json({
        error: 'Internal server error',
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'] || 'unknown',
      });
    });

    // Start server and wait for it to be ready
    // Start server and wait for it to be ready
    await new Promise<void>((resolve, reject) => {
      const server = app.listen(PORT, async () => {
        try {
          await logger.info(
            'Server',
            `Server is ready and listening on port ${PORT}`
          );

          // Initialize WebSocket service
          webSocketService.initialize(server);
          console.log('WebSocket service initialized');

          // Start the lock cleanup service
          lockCleanupService.start();
          console.log('Lock cleanup service started');

          // Start the chat cleanup service (auto-delete messages after 24 hours)
          chatCleanupService.start();
          console.log('Chat cleanup service started (24-hour retention)');

          // Start the storage cleanup service (deletes old projects automatically)
          const { storageCleanupService } = await import('./services/StorageCleanupService');
          storageCleanupService.startAutomaticCleanup();

          resolve();
        } catch (err) {
          reject(err);
        }
      });

      server.on('error', err => {
        reject(err);
      });
    });
  } catch (error) {
    console.error('Failed to initialize application:', error);
    process.exit(1);
  }
};

// Start the application
initializeApp();

// Graceful shutdown handling
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  lockCleanupService.stop();
  chatCleanupService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  lockCleanupService.stop();
  chatCleanupService.stop();
  process.exit(0);
});

