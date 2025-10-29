import { Router } from 'express';
import { Logger } from '../utils/Logger';
import { EventEmitter } from 'events';

const router = Router();
const logger = new Logger(process.cwd());

// Initialize logger and subscribe to log events
logger.initialize().catch(console.error);

// Create a Set to store all active SSE clients
const clients = new Set<{ send: (data: string) => void }>();

// Create a global event emitter for agent activities
export const agentActivityEmitter = new EventEmitter();
agentActivityEmitter.setMaxListeners(100); // Increase limit for multiple connections

// Forward log events to all connected clients
logger.on('log', logEntry => {
  try {
    const data = JSON.stringify(logEntry);
    clients.forEach(client => {
      try {
        client.send(data);
      } catch (error) {
        console.error('Error sending log to client:', error);
        clients.delete(client);
      }
    });
  } catch (error) {
    console.error('Error serializing log entry:', error);
  }
});

// Handle logger initialization
logger.on('initialized', () => {
  clients.forEach(client => {
    try {
      client.send(
        JSON.stringify({
          type: 'SYSTEM',
          message: 'Logger initialized successfully',
        })
      );
    } catch (error) {
      console.error('Error sending initialization message:', error);
    }
  });
});

// SSE endpoint for log streaming
router.get('/logs', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Send initial heartbeat
  res.write(':\n\n');

  // Create client object
  const client = {
    send: (data: string) => {
      res.write(`data: ${data}\n\n`);
    },
  };

  // Add client to Set
  clients.add(client);

  // Handle client disconnect
  req.on('close', () => {
    clients.delete(client);
  });
  
  // Don't call next() - keep connection open for SSE
});

router.get('/events', (req, res) => {
  // Set headers for SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');

  // Send initial connection message
  res.write('data: {"type":"connected"}\n\n');

  // Add this client to the list of connected clients
  if (!req.app.locals.sseClients) {
    req.app.locals.sseClients = new Set();
  }
  req.app.locals.sseClients.add(res);

  // Remove client on connection close
  req.on('close', () => {
    req.app.locals.sseClients.delete(res);
  });
  
  // Don't call next() - keep connection open for SSE
});

// Get recent logs endpoint
router.get('/logs/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 100;
    const recentLogs = await logger.getRecentLogs(limit);
    res.json(recentLogs);
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// Receive client logs endpoint
router.post('/logs/client', async (req, res) => {
  try {
    const { logs, sessionId, userId } = req.body;
    const serverLogger = req.app.locals.logger;

    if (!Array.isArray(logs)) {
      return res.status(400).json({ error: 'Logs must be an array' });
    }

    // Process each client log
    for (const clientLog of logs) {
      await serverLogger?.info('Client', clientLog.message, {
        ...clientLog,
        sessionId,
        userId,
        source: 'CLIENT',
        timestamp: clientLog.timestamp || new Date().toISOString(),
      });
    }

    res.json({ success: true, processed: logs.length });
  } catch (error) {
    const err = error as Error;
    res.status(500).json({ error: err.message });
  }
});

// SSE endpoint for agent activity streaming
router.get('/agent-activity', (req, res) => {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  // Send initial connection message
  res.write('data: {"type":"connected","message":"Agent activity stream connected"}\n\n');

  // Create listener for agent events
  const agentListener = (data: any) => {
    try {
      // Validate that we have essential data
      if (!data || typeof data !== 'object') {
        console.error('Invalid agent event data:', data);
        return;
      }

      const payload = JSON.stringify(data);
      res.write(`data: ${payload}\n\n`);
    } catch (error) {
      console.error('Error sending agent activity:', error);
    }
  };

  // Subscribe to agent events
  agentActivityEmitter.on('agent_event', agentListener);

  // Keep connection alive with heartbeat every 30 seconds
  const heartbeatInterval = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch (error) {
      console.error('Heartbeat error:', error);
      clearInterval(heartbeatInterval);
    }
  }, 30000);

  // Cleanup on disconnect
  req.on('close', () => {
    console.log('Agent activity client disconnected');
    agentActivityEmitter.off('agent_event', agentListener);
    clearInterval(heartbeatInterval);
    res.end();
  });

  req.on('error', (error) => {
    console.error('Agent activity connection error:', error);
    agentActivityEmitter.off('agent_event', agentListener);
    clearInterval(heartbeatInterval);
  });
});

export default router;
