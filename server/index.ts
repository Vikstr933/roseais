import express from 'express';
import cors from 'cors';
import path from 'path';
import { Logger } from './utils/Logger';
import agentsRouter from './routes/agents';
import promptsRouter from './routes/prompts';
import workspacesRouter from './routes/workspaces';
import componentsRouter from './routes/components';
import companiesRouter from './routes/companies';
import frameworksRouter from './routes/frameworks';
import sseRouter from './routes/sse';
import serverRouter from './routes/server';
import modelsRouter from './routes/models';
import sessionsRouter from './routes/sessions';

import * as dotenv from 'dotenv';
import { sql } from 'drizzle-orm';
dotenv.config();

const PORT = process.env.PORT || 3001;
const logger = new Logger(process.cwd());
const app = express();

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
    
    // Test database connection
    try {
      console.log('Current working directory:', process.cwd());
      console.log('Environment variables:', {
        DATABASE_URL: process.env.DATABASE_URL,
        NODE_ENV: process.env.NODE_ENV
      });
      
      // Test SQLite connection
      const Database = await import('better-sqlite3');
      const path = await import('path');

      const dbPath = path.join(process.cwd(), 'db', 'db.sqlite');
      console.log('Using SQLite database at:', dbPath);

      const sqlite = new Database.default(dbPath);
      console.log('SQLite database opened');

      // Test the connection
      const result = sqlite.prepare('SELECT 1 as test').get();
      console.log('Test query executed, result:', result);

      sqlite.close();
      console.log('SQLite connection closed');
      await logger.info('Server', 'Database connection successful');
    } catch (dbError) {
      console.error('Database connection error details:', {
        error: dbError,
        stack: dbError instanceof Error ? dbError.stack : undefined,
        message: dbError instanceof Error ? dbError.message : String(dbError)
      });
      await logger.error('Server', 'Database connection failed', {
        error: dbError instanceof Error ? dbError.message : String(dbError)
      });
      throw new Error(`Failed to connect to database: ${dbError instanceof Error ? dbError.message : String(dbError)}`);
    }
    
    // Initialize SSE clients Set
    app.locals.sseClients = new Set();
    app.locals.logger = logger; // Make logger available throughout the app

    // Global CORS configuration
    app.use(cors({
      origin: ['http://localhost:5173', 'http://localhost:5174', new RegExp('http://localhost:5[0-9]{3}')],
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization']
    }));

    // Special CORS handling for SSE endpoints
    app.use('/api/sse', (req, res, next) => {
      res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      next();
    });

    app.use(express.json({ limit: '50mb' }));

    // Add logging middleware
    app.use(async (req, res, next) => {
      await logger.info('Server', `Incoming request`, {
        method: req.method,
        url: req.url,
        query: req.query,
        body: req.method !== 'GET' ? req.body : undefined
      });
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
          const response = await fetch(`http://localhost:${PORT}/api/agents/validate/${req.body.agentId}`);
          if (!response.ok) {
            const error = await response.json();
            return res.status(response.status).json(error);
          }
        } catch (error) {
          await logger.error('Server', 'Error validating agent', {
            error: error instanceof Error ? error.message : String(error)
          });
          return res.status(500).json({ error: 'Failed to validate agent status' });
        }
      }
      
      next();
    });

    // Routes
    app.use('/api', agentsRouter);
    app.use('/api', promptsRouter);
    app.use('/api/workspaces', workspacesRouter);
    app.use('/api', componentsRouter);
    app.use('/api/companies', companiesRouter);
    app.use('/api/frameworks', frameworksRouter);
    app.use('/api', sseRouter); // This will handle /api/sse/* routes
    app.use('/api/server', serverRouter);
    app.use('/api/models', modelsRouter);
    app.use('/api/sessions', sessionsRouter);

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

    // Error handling
    app.use(async (err: any, req: any, res: any, next: any) => {
      const error = err instanceof Error ? err.message : String(err);
      await logger.error('Server', 'Unhandled error', { error });
      res.status(500).json({ error });
    });

    // Start server and wait for it to be ready
    // Start server and wait for it to be ready
    await new Promise<void>((resolve, reject) => {
      const server = app.listen(PORT, async () => {
        try {
          await logger.info('Server', `Server is ready and listening on port ${PORT}`);
          resolve();
        } catch (err) {
          reject(err);
        }
      });

      server.on('error', (err) => {
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
