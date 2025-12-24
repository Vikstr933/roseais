import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import * as fs from 'fs';
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
import playgroundRouter from './routes/playground';
import userPluginsRouter from './routes/user-plugins';
import credentialsRouter from './routes/credentials';
import discordRouter from './routes/discord';
import intentDetectionRouter from './routes/intent-detection';
import describeProjectRouter from './routes/describe-project';
import browserRouter from './routes/browser';
import secretsRouter from './routes/secrets';
import aiRouter from './routes/ai';
import statsRouter from './routes/stats';
import publicProjectsRouter from './routes/public-projects';
import screenshotsRouter from './routes/screenshots';
import dataInsightsRouter from './routes/data-insights';
import toolPermissionsRouter from './routes/tool-permissions';
import sharedConnectorsRouter from './routes/shared-connectors';
import pythonSandboxRouter from './routes/python-sandbox';
import whisperRouter from './routes/whisper';
import videoRouter from './routes/video';
import { lockCleanupService } from './utils/lockCleanup';
import { webSocketService } from './services/WebSocketService';
import { chatCleanupService } from './services/ChatCleanupService';
import { emailSchedulerService } from './services/EmailSchedulerService';
import { audioFileService } from './services/AudioFileService';

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

    // Log incoming requests ONLY in development (production-safe)
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      app.use((req, res, next) => {
        const origin = req.headers.origin;
        console.log(`[REQUEST] ${req.method} ${req.path} - Origin: ${origin || 'none'}`);
        next();
      });
    }

    // Build allowed origins from environment variables FIRST (before CORS)
    // Render automatically sets RENDER_EXTERNAL_URL, but we can also use BACKEND_URL
    const backendUrl = process.env.BACKEND_URL || 
                      process.env.RENDER_EXTERNAL_URL || 
                      'https://ai-library-backend-3mmv.onrender.com' || // Fallback to known Render URL
                      'http://localhost:5000';
    
    const allowedOrigins: (string | RegExp)[] = [
      'http://localhost:5173',
      'http://localhost:5174',
      new RegExp('http://localhost:5[0-9]{3}'),
      // Add backend URL (for self-requests)
      backendUrl,
      // Add Vercel deployment patterns
      'https://newai-sigma.vercel.app',
      'https://newai.vercel.app',
      new RegExp('^https://newai.*\\.vercel\\.app$'),  // Match all Vercel preview URLs (including newai-sigma)
      new RegExp('^https://.*-viktors-projects-.*\\.vercel\\.app$'), // Match user-specific Vercel URLs
      new RegExp('^https://.*\\.vercel\\.app$'), // Match all Vercel URLs as fallback
      // Add Render backend URLs pattern
      new RegExp('^https://.*\\.onrender\\.com$'), // Match all Render URLs
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

    // Handle preflight OPTIONS requests FIRST (before any other middleware that might interfere)
    // This ensures CORS preflight requests are handled immediately
    app.options('*', (req, res, next) => {
      const origin = req.headers.origin;
      if (isDevelopment) {
        console.log(`[CORS Preflight] OPTIONS request from origin: ${origin || 'none'}`);
      }
      
      // Always allow requests from backend to itself
      if (!origin || origin === backendUrl || origin.includes('onrender.com')) {
        if (isDevelopment) {
          console.log(`[CORS Preflight] ✅ Allowing backend/onrender origin: ${origin || 'none'}`);
        }
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(204).send();
      }
      
      // In production, always allow Vercel and Render origins as fallback (check this FIRST)
      if (origin && origin.includes('vercel.app')) {
        if (isDevelopment) {
          console.log(`[CORS Preflight] ✅ Allowing Vercel origin: ${origin}`);
        }
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(204).send();
      }
      if (origin && origin.includes('onrender.com')) {
        if (isDevelopment) {
          console.log(`[CORS Preflight] ✅ Allowing Render origin: ${origin}`);
        }
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        return res.status(204).send();
      }
      
      let isAllowed = allowedOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return allowed === origin;
        } else if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        console.log(`[CORS Preflight] ✅ Allowing origin from allowed list: ${origin}`);
        res.setHeader('Access-Control-Allow-Origin', origin || '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
        res.status(204).send();
      } else {
        console.error(`[CORS Preflight] ❌ Blocked origin: ${origin}`);
        console.error(`[CORS Preflight] Allowed origins:`, allowedOrigins.map(o => o.toString()));
        res.status(403).send();
      }
    });

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

    // Apply CORS to all routes (including health checks for browser access)
    app.use(cors({
      origin: (origin, callback) => {
        // Log every CORS check for debugging
        console.log(`[CORS CHECK] Origin: ${origin || 'none'}`);
        
        // Allow requests without origin (monitoring services, same-origin requests)
        if (!origin) {
          console.log('[CORS] ✅ Allowing request without origin');
          return callback(null, true);
        }

        // Always allow requests from backend to itself
        if (origin === backendUrl || origin.includes('onrender.com')) {
          console.log(`[CORS] ✅ Allowing backend self-request: ${origin}`);
          return callback(null, true);
        }

        // In production, always allow Vercel and Render origins as fallback (check this FIRST)
        if (origin.includes('vercel.app')) {
          console.log(`[CORS] ✅ Allowing Vercel origin: ${origin}`);
          return callback(null, true);
        }
        if (origin.includes('onrender.com')) {
          console.log(`[CORS] ✅ Allowing Render origin: ${origin}`);
          return callback(null, true);
        }

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
          console.log(`[CORS] ✅ Allowing origin from allowed list: ${origin}`);
          callback(null, true);
        } else {
          // Log detailed info for debugging
          console.error(`[CORS] ❌ REJECTED origin: ${origin}`);
          console.error(`[CORS] Allowed origins:`, allowedOrigins.map(o => o.toString()));
          console.error(`[CORS] Backend URL: ${backendUrl}`);
          console.error(`[CORS] NODE_ENV: ${process.env.NODE_ENV}`);
          console.error(`[CORS] FRONTEND_URL: ${process.env.FRONTEND_URL}`);
          console.error(`[CORS] ALLOWED_ORIGINS: ${process.env.ALLOWED_ORIGINS}`);
          callback(new Error('Not allowed by CORS'));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'Cache-Control', 'X-Requested-With'],
      exposedHeaders: ['Content-Type', 'Authorization'],
      preflightContinue: false,
      optionsSuccessStatus: 204,
      // Ensure CORS headers are always sent
      maxAge: 86400 // 24 hours
    }));

    // Helmet security headers (AFTER CORS to not interfere)
    app.use(helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Required for Monaco Editor
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'", "https:", "wss:", "ws:"],
          fontSrc: ["'self'", "data:"],
          objectSrc: ["'none'"],
          mediaSrc: ["'self'"],
          frameSrc: ["'none'"],
        },
      },
      // Note: crossOriginEmbedderPolicy and crossOriginOpenerPolicy are set
      // conditionally later via middleware (only for non-API routes) to support WebContainer
      crossOriginEmbedderPolicy: false, // Disabled here, set conditionally later
      crossOriginOpenerPolicy: false, // Disabled here, set conditionally later
      crossOriginResourcePolicy: { policy: "cross-origin" },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
    }));

    // Advanced Security Middleware (AFTER CORS)
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

    // Fallback CORS middleware - ensure CORS headers are ALWAYS set for API routes
    // This runs AFTER all other middleware to guarantee CORS headers are present
    app.use('/api', (req, res, next) => {
      const origin = req.headers.origin;
      
      // Always allow localhost in development
      if (origin && origin.includes('localhost')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
      }
      // Allow Vercel
      else if (origin && origin.includes('vercel.app')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
      }
      // Allow Render
      else if (origin && origin.includes('onrender.com')) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Max-Age', '86400');
      }
      
      // Handle OPTIONS preflight here as well
      if (req.method === 'OPTIONS') {
        return res.status(204).send();
      }
      
      next();
    });

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

    // JSON parser - exclude Discord interactions endpoint (needs raw body for signature verification)
    app.use((req, res, next) => {
      // Skip JSON parsing for Discord interactions endpoint
      if (req.path === '/api/discord/interactions' || req.originalUrl === '/api/discord/interactions') {
        return next(); // Skip JSON parsing for Discord interactions
      }

      // Allow larger payload only for audio upload (base64 can be ~1.33x of file size)
      const isLargeAudioUpload = req.path === '/api/video/upload-audio';
      const maxAudioUploadMb = parseInt(process.env.MAX_AUDIO_UPLOAD_LIMIT_MB || '700', 10); // default ~700MB (supports ~500MB raw audio base64)
      const limit = isLargeAudioUpload ? `${maxAudioUploadMb}mb` : '10mb';

      express.json({ limit })(req, res, next);
    });

    // Add enhanced logging middleware (production-safe)
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

      // Only log detailed request info in development or for important endpoints
      const shouldLogDetails = isDevelopment || 
        req.path.startsWith('/api/auth') || 
        req.path.startsWith('/api/agents') ||
        req.method !== 'GET';

      if (shouldLogDetails) {
        // Log incoming request with detailed information (only in dev or for important endpoints)
        await logger.info(category, `[${requestId}] ${req.method} ${req.url}`, {
          requestId,
          method: req.method,
          url: req.url,
          path: req.path,
          query: Object.keys(req.query).length > 0 ? req.query : undefined,
          headers: isDevelopment ? {
            'user-agent': req.get('User-Agent'),
            'content-type': req.get('Content-Type'),
            'content-length': req.get('Content-Length'),
            authorization: req.get('Authorization') ? '[REDACTED]' : undefined,
            'x-forwarded-for': req.get('X-Forwarded-For'),
            'x-real-ip': req.get('X-Real-IP'),
          } : undefined,
          ip: req.ip || req.connection.remoteAddress,
          body: isDevelopment && req.method !== 'GET' && req.body
            ? req.body.password || req.body.token
              ? '[REDACTED]'
              : req.body
            : undefined,
          timestamp: new Date().toISOString(),
        });
      }

      // Override res.end to log response details and record metrics
      const originalEnd = res.end;
      res.end = function (chunk?: any, encoding?: any, cb?: any) {
        const duration = Date.now() - startTime;
        const responseSize =
          res.get('Content-Length') || (chunk ? chunk.length : 0);

        // Always record performance metrics (lightweight operation)
        performanceService.recordResponseTime(req.path, duration);

        // Only log response details in development or for errors/important endpoints
        const shouldLogResponse = isDevelopment || 
          res.statusCode >= 400 || 
          req.path.startsWith('/api/auth') || 
          req.path.startsWith('/api/agents') ||
          duration > 1000; // Log slow requests (>1s) even in production

        if (shouldLogResponse) {
          logger
            .info(category, `[${requestId}] Response ${res.statusCode}`, {
              requestId,
              statusCode: res.statusCode,
              duration: `${duration}ms`,
              responseSize: responseSize ? `${responseSize} bytes` : undefined,
              headers: isDevelopment ? {
                'content-type': res.get('Content-Type'),
                'content-length': res.get('Content-Length'),
              } : undefined,
              timestamp: new Date().toISOString(),
            })
            .catch(console.error);
        }

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
      // Skip this check for Discord interactions endpoint (uses raw body)
      if (req.path === '/api/discord/interactions' || req.originalUrl === '/api/discord/interactions') {
        return next();
      }
      
      if (req.body && req.body.agentId) {
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
    
    // Debug: Log ALL requests to /api/auth/* to see routing
    app.use('/api/auth', (req, res, next) => {
      console.log(`[DEBUG /api/auth] ${req.method} ${req.path} - routing...`);
      next();
    });
    
    // Register OAuth route EXPLICITLY before authRouter to ensure it takes precedence
    // This ensures POST /api/auth/oauth is matched correctly
    app.use('/api/auth', oauthRouter); // OAuth routes (must be before authRouter)
    
    app.use('/api/auth', authRouter);
    app.use('/api', testRouter); // Test endpoints
    app.use('/api', agentsRouter);
    app.use('/api', promptsRouter);
    app.use('/api/workspaces', workspacesRouter);
    app.use('/api', componentsRouter);
    app.use('/api/companies', companiesRouter);
    app.use('/api/frameworks', frameworksRouter);
    app.use('/api/knowledge', knowledgeRouter);
    app.use('/api/intent', intentDetectionRouter);
    app.use('/api/project', describeProjectRouter);
    app.use('/api/github-knowledge', githubKnowledgeRouter);
    app.use('/api/api-keys', apiKeysRouter);
    app.use('/api/monetization', monetizationRouter);
    app.use('/api/billing', billingRouter);
    app.use('/api/knowledge', relevanceRouter);
    app.use('/api/terminal', terminalRouter);
    app.use('/api/stripe', stripeRouter); // Stripe payment routes
    app.use('/api/plugins', pluginsRouter); // Plugin system routes
    app.use('/api/user-plugins', userPluginsRouter); // User-generated plugins
    app.use('/api/credentials', credentialsRouter); // Credential vault
    app.use('/api/browser', browserRouter); // Browser analysis routes
    app.use('/api/discord', discordRouter); // Discord bot management
    app.use('/api/secrets', secretsRouter); // Secrets vault for API keys
    app.use('/api/ai', aiRouter); // AI generation for Prompt Lab
    app.use('/api/omniassistant', omniassistantRouter); // OmniAssistant - Digital Office Platform
    app.use('/api/playground', playgroundRouter); // Playground Assistant (Chap-ZPT) - Dedicated playground chat
    app.use('/api/workspace-sessions', workspaceSessionsRouter); // Workspace session persistence
    app.use('/api/activity', activityRouter); // User activity tracking routes
    app.use('/api/stats', statsRouter); // Platform statistics
    app.use('/api/public-projects', publicProjectsRouter); // Public projects showcase
    app.use('/api/screenshots', screenshotsRouter); // Screenshot capture service
    app.use('/api/data-insights', dataInsightsRouter); // Data insights and analytics
    app.use('/api/tool-permissions', toolPermissionsRouter); // Tool Permissions Management
    app.use('/api/shared-connectors', sharedConnectorsRouter); // Shared Connectors (workspace-wide API keys)
    app.use('/api/python', pythonSandboxRouter); // Python Sandbox for Flask/Django/FastAPI
    app.use('/api/whisper', whisperRouter); // KB-Whisper Swedish speech recognition
    try {
      app.use('/api/video', videoRouter); // Video transcription and script generation
      console.log('✅ Video router registered at /api/video');
    } catch (error) {
      console.error('❌ Failed to register video router:', error);
    }
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

    // Add Cross-Origin Isolation headers for WebContainer support
    // These headers enable SharedArrayBuffer which is required by WebContainer
    app.use((req, res, next) => {
      // Only add these headers for HTML pages (client routes), not API routes
      if (!req.path.startsWith('/api/')) {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      }
      next();
    });

    // Serve static files from client directory
    app.use(express.static(path.join(process.cwd(), 'client')));
    
    // Serve uploads directory (for screenshots, etc.)
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (fs.existsSync(uploadsDir)) {
      app.use('/uploads', express.static(uploadsDir));
      console.log('✅ Static file serving enabled for uploads directory');
    } else {
      console.warn('⚠️ Uploads directory not found, creating it...');
      fs.mkdirSync(uploadsDir, { recursive: true });
      app.use('/uploads', express.static(uploadsDir));
    }

    // Sentry error handler - MUST be after routes but BEFORE error handlers
    app.use(sentryErrorHandler());
    app.use(errorLogger);

    // Error handling - CRITICAL: Always include CORS headers on error responses
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

      // CRITICAL: Ensure CORS headers are set on error responses
      // This prevents CORS errors from masking the actual error
      const origin = req.headers.origin;
      if (origin) {
        // Allow all common frontend origins
        if (origin.includes('localhost') || origin.includes('vercel.app') || origin.includes('onrender.com')) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        }
      }

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
          
          // Start audio file cleanup
          audioFileService.startAutomaticCleanup();

          // Auto-connect Discord bots on startup
          const { DiscordBotService } = await import('./services/DiscordBotService');
          DiscordBotService.autoConnectAllBots().catch((error) => {
            console.error('Failed to auto-connect Discord bots:', error);
          });

          // Initialize email scheduler service
          const { pluginRegistry } = await import('./services/PluginRegistry');
          const gmailPlugin = pluginRegistry.getPlugin('gmail');
          if (gmailPlugin) {
            emailSchedulerService.setGmailPlugin(gmailPlugin as any);
            emailSchedulerService.start();
            console.log('Email scheduler service started');
          }

          // Verify and pre-install dependencies at startup (non-blocking)
          (async () => {
            try {
              console.log('🔍 Verifying dependencies at startup...');
              
              // Check faster-whisper
              // In production, this should be installed during build
              const { whisperService } = await import('./services/WhisperService');
              const whisperAvailable = await whisperService.checkDependencies();
              if (!whisperAvailable) {
                console.error('❌ faster-whisper is not available. This should be installed during build. Check build logs.');
              } else {
                console.log('✅ faster-whisper is available');
              }
              
              // Check yt-dlp in venv-whisper
              // In production, this should be installed during Docker build
              const cwd = process.cwd();
              const possibleVenvPaths = [
                path.join(cwd, 'venv-whisper'),
                path.join('/app', 'venv-whisper'), // Docker default
                path.join('/opt/render/project/src', 'venv-whisper'), // Render Node.js env
              ].filter((p, index, arr) => arr.indexOf(p) === index); // Remove duplicates
              
              let ytdlpFound = false;
              let foundVenvPath: string | null = null;
              
              for (const venvPath of possibleVenvPaths) {
                const venvPython = process.platform === 'win32'
                  ? path.join(venvPath, 'Scripts', 'python.exe')
                  : path.join(venvPath, 'bin', 'python3');
                
                try {
                  const stats = await fs.promises.stat(venvPython);
                  if (stats.isFile()) {
                    // Try to import yt_dlp
                    const { exec } = await import('child_process');
                    const { promisify } = await import('util');
                    const execAsync = promisify(exec);
                    try {
                      await execAsync(`"${venvPython}" -c "import yt_dlp; print('OK')"`, { timeout: 5000 });
                      ytdlpFound = true;
                      foundVenvPath = venvPath;
                      console.log(`✅ yt-dlp is available in venv at: ${venvPath}`);
                      break;
                    } catch {
                      // yt-dlp not installed in this venv
                    }
                  }
                } catch {
                  // Venv doesn't exist at this path
                }
              }
              
              if (!ytdlpFound) {
                console.error('❌ yt-dlp is not available in venv-whisper. This should be installed during Docker build. Check build logs.');
                console.error(`   Searched paths: ${possibleVenvPaths.join(', ')}`);
                console.error(`   Current working directory: ${cwd}`);
              }
              
              // Check Playwright (try to launch browser to verify)
              // In production, this should be installed during build
              try {
                const { chromium } = await import('playwright');
                const browser = await chromium.launch({ headless: true });
                await browser.close();
                console.log('✅ Playwright browsers are available');
              } catch (error: any) {
                if (error.message?.includes('Executable doesn\'t exist') || error.message?.includes('playwright')) {
                  console.error('❌ Playwright browsers not found. This should be installed during build. Check build logs.');
                } else {
                  console.warn('⚠️ Playwright check failed:', error.message);
                }
              }
            } catch (error) {
              console.warn('⚠️ Dependency verification failed (non-critical):', error);
            }
          })().catch(err => {
            console.warn('⚠️ Startup dependency check error (non-critical):', err);
          });

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
  emailSchedulerService.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  lockCleanupService.stop();
  chatCleanupService.stop();
  emailSchedulerService.stop();
  process.exit(0);
});

