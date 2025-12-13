/**
 * Python Sandbox API Routes
 * Handles Python code execution in isolated sandboxes
 */

import { Router, Request, Response, NextFunction } from 'express';
import { pythonSandboxService, PythonFile } from '../services/PythonSandboxService';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// CORS middleware for Python sandbox routes
// CRITICAL: Must be applied BEFORE authentication to handle preflight OPTIONS
router.use((req: Request, res: Response, next: NextFunction) => {
  const origin = req.headers.origin;
  
  // Always set CORS headers for API routes
  if (origin) {
    if (origin.includes('localhost') || origin.includes('vercel.app') || origin.includes('onrender.com')) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cache-Control, X-Requested-With');
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      res.setHeader('Access-Control-Max-Age', '86400');
    }
  }
  
  // Handle OPTIONS preflight immediately
  if (req.method === 'OPTIONS') {
    return res.status(204).send();
  }
  
  next();
});

// All routes require authentication
router.use(authenticateUser);

/**
 * POST /api/python/sandbox
 * Create a new Python sandbox
 */
router.post('/sandbox', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { files, options } = req.body as {
      files: PythonFile[];
      options?: {
        timeout?: number;
        port?: number;
      };
    };

    if (!files || !Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'Files array is required' 
      });
    }

    // Validate files
    for (const file of files) {
      if (!file.path || typeof file.content !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Each file must have a path and content' 
        });
      }
    }

    const sandbox = await pythonSandboxService.createSandbox(files, userId, {
      timeout: options?.timeout || 5 * 60 * 1000, // 5 minutes default
      port: options?.port,
    });

    res.json({
      success: true,
      sandbox: {
        id: sandbox.id,
        status: sandbox.status,
        url: sandbox.url,
        port: sandbox.port,
        projectType: sandbox.projectType,
        logs: sandbox.logs.slice(-10), // Last 10 logs
        error: sandbox.error,
      },
    });
  } catch (error) {
    console.error('Error creating Python sandbox:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to create sandbox',
    });
  }
});

/**
 * GET /api/python/sandbox/:id
 * Get sandbox status and logs
 */
router.get('/sandbox/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const sandbox = pythonSandboxService.getSandbox(id);

    if (!sandbox) {
      return res.status(404).json({
        success: false,
        error: 'Sandbox not found',
      });
    }

    res.json({
      success: true,
      sandbox: {
        id: sandbox.id,
        status: sandbox.status,
        url: sandbox.url,
        port: sandbox.port,
        projectType: sandbox.projectType,
        logs: sandbox.logs,
        error: sandbox.error,
        createdAt: sandbox.createdAt,
      },
    });
  } catch (error) {
    console.error('Error getting sandbox:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get sandbox',
    });
  }
});

/**
 * GET /api/python/sandbox/:id/logs
 * Stream sandbox logs (for real-time updates)
 */
router.get('/sandbox/:id/logs', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { since } = req.query;
    const sinceIndex = since ? parseInt(since as string) : 0;

    const sandbox = pythonSandboxService.getSandbox(id);

    if (!sandbox) {
      return res.status(404).json({
        success: false,
        error: 'Sandbox not found',
      });
    }

    res.json({
      success: true,
      logs: sandbox.logs.slice(sinceIndex),
      totalLogs: sandbox.logs.length,
      status: sandbox.status,
    });
  } catch (error) {
    console.error('Error getting sandbox logs:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get logs',
    });
  }
});

/**
 * DELETE /api/python/sandbox/:id
 * Stop and cleanup a sandbox
 */
router.delete('/sandbox/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const sandbox = pythonSandboxService.getSandbox(id);
    if (!sandbox) {
      return res.status(404).json({
        success: false,
        error: 'Sandbox not found',
      });
    }

    await pythonSandboxService.stopSandbox(id);

    res.json({
      success: true,
      message: 'Sandbox stopped',
    });
  } catch (error) {
    console.error('Error stopping sandbox:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to stop sandbox',
    });
  }
});

/**
 * POST /api/python/execute
 * Execute a Python script (one-shot, no server)
 */
router.post('/execute', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { code, timeout } = req.body as {
      code: string;
      timeout?: number;
    };

    if (!code || typeof code !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Code is required',
      });
    }

    // Limit code size
    if (code.length > 100000) {
      return res.status(400).json({
        success: false,
        error: 'Code too large (max 100KB)',
      });
    }

    const result = await pythonSandboxService.executeScript(
      code,
      Math.min(timeout || 30000, 60000) // Max 1 minute
    );

    res.json({
      success: result.success,
      output: result.output,
      error: result.error,
    });
  } catch (error) {
    console.error('Error executing Python:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to execute code',
    });
  }
});

/**
 * POST /api/python/detect-type
 * Detect Python project type from files
 */
router.post('/detect-type', async (req: Request, res: Response) => {
  try {
    const { files } = req.body as { files: PythonFile[] };

    if (!files || !Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        error: 'Files array is required',
      });
    }

    const projectType = pythonSandboxService.detectProjectType(files);

    res.json({
      success: true,
      projectType,
      description: getProjectTypeDescription(projectType),
      previewSupport: getPreviewSupport(projectType),
    });
  } catch (error) {
    console.error('Error detecting project type:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to detect type',
    });
  }
});

// Helper functions
function getProjectTypeDescription(type: string): string {
  switch (type) {
    case 'flask': return 'Flask web application';
    case 'django': return 'Django web application';
    case 'fastapi': return 'FastAPI REST API';
    case 'streamlit': return 'Streamlit data app';
    case 'script': return 'Python script';
    default: return 'Unknown Python project';
  }
}

function getPreviewSupport(type: string): {
  browser: boolean;
  server: boolean;
  recommended: 'browser' | 'server';
} {
  switch (type) {
    case 'flask':
    case 'django':
    case 'fastapi':
    case 'streamlit':
      return { browser: false, server: true, recommended: 'server' };
    case 'script':
    default:
      return { browser: true, server: true, recommended: 'browser' };
  }
}

export default router;

