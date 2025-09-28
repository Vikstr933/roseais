import { Router } from 'express';

const router = Router();

// Initialize server as running since it starts with the application
let serverRunning = true;

router.get('/status', (req, res) => {
  try {
    res.json({ status: 'running' });
  } catch (error) {
    console.error('Error checking server status:', error);
    res.status(500).json({ 
      error: 'Failed to check server status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/start', (req, res) => {
  try {
    serverRunning = true;
    res.json({ status: 'running', message: 'Server started successfully' });
  } catch (error) {
    console.error('Error starting server:', error);
    res.status(500).json({ 
      error: 'Failed to start server',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/stop', (req, res) => {
  try {
    serverRunning = false;
    res.json({ status: 'stopped', message: 'Server stopped successfully' });
  } catch (error) {
    console.error('Error stopping server:', error);
    res.status(500).json({ 
      error: 'Failed to stop server',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
