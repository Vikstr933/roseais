import { Router } from 'express';
import { Logger } from '../utils/Logger';

const router = Router();
const logger = new Logger(process.cwd());

// Initialize logger and subscribe to log events
logger.initialize().catch(console.error);

// Create a Set to store all active SSE clients
const clients = new Set<{ send: (data: string) => void }>();

// Forward log events to all connected clients
logger.on('log', (logEntry) => {
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
      client.send(JSON.stringify({
        type: 'SYSTEM',
        message: 'Logger initialized successfully'
      }));
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
    }
  };

  // Add client to Set
  clients.add(client);

  // Handle client disconnect
  req.on('close', () => {
    clients.delete(client);
  });
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

export default router;
