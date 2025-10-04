import { Router } from 'express';
import { Server } from 'socket.io';
import { createServer } from 'http';

const router = Router();

// Store terminal outputs by component name
const terminalOutputs: Record<string, string[]> = {};
const terminalSubscribers: Record<string, Set<(output: string) => void>> = {};

// Add terminal output for a component
export function addTerminalOutput(componentName: string, output: string) {
  if (!terminalOutputs[componentName]) {
    terminalOutputs[componentName] = [];
  }

  terminalOutputs[componentName].push(output);

  // Notify subscribers
  if (terminalSubscribers[componentName]) {
    terminalSubscribers[componentName].forEach(callback => callback(output));
  }
}

// Get terminal output for a component
router.get('/terminal/:componentName', (req, res) => {
  const { componentName } = req.params;
  const output = terminalOutputs[componentName] || [];
  res.json({ output });
});

// Subscribe to terminal output updates (Server-Sent Events)
router.get('/terminal/:componentName/stream', (req, res) => {
  const { componentName } = req.params;

  // Set up SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Send existing output
  const existingOutput = terminalOutputs[componentName] || [];
  existingOutput.forEach(line => {
    res.write(`data: ${JSON.stringify({ type: 'output', data: line })}\n\n`);
  });

  // Set up subscription for new output
  if (!terminalSubscribers[componentName]) {
    terminalSubscribers[componentName] = new Set();
  }

  const sendOutput = (output: string) => {
    res.write(`data: ${JSON.stringify({ type: 'output', data: output })}\n\n`);
  };

  terminalSubscribers[componentName].add(sendOutput);

  // Clean up on disconnect
  req.on('close', () => {
    if (terminalSubscribers[componentName]) {
      terminalSubscribers[componentName].delete(sendOutput);
    }
  });

  // Send heartbeat
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
  }, 30000);

  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// Clear terminal output for a component
router.delete('/terminal/:componentName', (req, res) => {
  const { componentName } = req.params;
  delete terminalOutputs[componentName];
  res.json({ success: true });
});

export default router;
