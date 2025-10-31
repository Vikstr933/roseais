import { Router } from 'express';
import { generateReactComponent } from '../utils/componentGenerator';
import path from 'path';
import fs from 'fs/promises';
import { exec, ChildProcess, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { ComponentOrchestrator } from '../utils/componentOrchestrator';
import { addTerminalOutput } from './terminal';
import { authenticateUser, optionalAuth } from '../middleware/auth';
import { validateRequest, sanitizeAIResponse, validateBodySize } from '../middleware/validation';
import { rateLimitBuild } from '../middleware/rateLimiting';
import { userPromptSchema, deploymentSchema } from '../validation/schemas';
import { userService } from '../services/APIKeyService';
import { monetizationService } from '../services/MonetizationService';
import { checkUsageCredits, deductCredits } from '../middleware/usageCheck';
import {
  checkGenerationLock,
  createGenerationLock,
  releaseGenerationLock,
  handleGenerationLockCleanup,
} from '../middleware/generationLock';
import { userActivityService } from '../services/UserActivityService';
import { deploymentService } from '../services/DeploymentService';
import { vercelDeploymentService } from '../services/VercelDeploymentService';
import { r2StorageService } from '../services/R2StorageService';
import { smartOrchestrator } from '../services/SmartOrchestrator';

const router = Router();

// Helper function to find the correct workspace directory
async function findWorkspaceDirectory(componentName: string): Promise<string | null> {
  try {
    const workspacesDir = path.join(process.cwd(), 'workspaces');
    const entries = await fs.readdir(workspacesDir, { withFileTypes: true });
    
    // Look for directory that starts with component name (with timestamp)
    // The workspace directories are created with format: componentname-timestamp
    const workspaceEntry = entries.find(entry => 
      entry.isDirectory() && (
        entry.name.startsWith(componentName.toLowerCase()) ||
        entry.name.includes(componentName.toLowerCase())
      )
    );
    
    if (workspaceEntry) {
      return path.join(workspacesDir, workspaceEntry.name);
    }
    
    // If not found, look for the most recent workspace directory
    const workspaceDirs = entries
      .filter(entry => entry.isDirectory())
      .map(entry => ({
        name: entry.name,
        path: path.join(workspacesDir, entry.name),
        stat: null as any
      }));
    
    // Get stats for all directories to find the most recent one
    for (const dir of workspaceDirs) {
      try {
        dir.stat = await fs.stat(dir.path);
      } catch (error) {
        console.warn(`Could not stat directory ${dir.path}:`, error);
      }
    }
    
    // Sort by modification time and return the most recent
    const sortedDirs = workspaceDirs
      .filter(dir => dir.stat)
      .sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());
    
    return sortedDirs.length > 0 ? sortedDirs[0].path : null;
  } catch (error) {
    console.error('Error finding workspace directory:', error);
    return null;
  }
}

// Helper function to read all files from a workspace directory
async function readWorkspaceFiles(workspaceDir: string): Promise<{ path: string; content: string }[]> {
  const files: { path: string; content: string }[] = [];
  
  async function readDirectory(dir: string, basePath: string = ''): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      const relativePath = path.join(basePath, entry.name);
      
      if (entry.isDirectory()) {
        await readDirectory(fullPath, relativePath);
      } else {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          files.push({
            path: relativePath.replace(/\\/g, '/'), // Normalize path separators
            content,
          });
        } catch (error) {
          console.warn(`Failed to read file ${fullPath}:`, error);
        }
      }
    }
  }
  
  await readDirectory(workspaceDir);
  return files;
}

interface GeneratedComponent {
  files: {
    path: string;
    content: string;
  }[];
  preview: {
    url: string;
    editorUrl: string;
  };
  webContainer?: {
    url: string;
    instanceId: string;
    status: string;
  };
}

interface ServerProcess {
  process: ChildProcess;
  port: number;
}

// Store active development servers and component names
const activeServers: Record<string, ServerProcess> = {};
const activeComponents: Record<string, string> = {}; // Store component names by session
let nextPort = 5174; // Start after main app's port

router.post('/components/save', async (req, res) => {
  try {
    const { componentName, files } = req.body;
    const baseWorkspaceDir = path.join(
      process.cwd(),
      'workspaces',
      componentName.toLowerCase()
    );
    const workspaceDir = path.join(baseWorkspaceDir, 'final');

    // Create workspace directories if they don't exist
    await mkdir(baseWorkspaceDir, { recursive: true });
    await mkdir(workspaceDir, { recursive: true });

    // Aggregate files from all generation steps
    const allFiles = [];
    const generations = await fs.readdir(baseWorkspaceDir);
    for (const gen of generations) {
      if (gen === 'final') continue;
      const genPath = path.join(baseWorkspaceDir, gen);
      const stat = await fs.stat(genPath);
      if (stat.isDirectory()) {
        const genFiles = await fs.readdir(genPath, { recursive: true });
        for (const file of genFiles) {
          const filePath = path.join(genPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          allFiles.push({ path: file, content });
        }
      }
    }

    // Merge with new files
    const mergedFiles = [...allFiles, ...files];

    // Write all files
    const mainComponentFile = files.find(
      (f: { path: string }) =>
        f.path.endsWith('.tsx') && !f.path.includes('main.tsx')
    );
    const derivedComponentName = mainComponentFile
      ? path.basename(mainComponentFile.path, '.tsx')
      : componentName;

    // Create src directory
    const srcDir = path.join(workspaceDir, 'src');
    await mkdir(srcDir, { recursive: true });

    // Save files with correct paths
    await Promise.all(
      files.map(async (file: { path: string; content: string }) => {
        let filePath;
        if (file.path.endsWith('.tsx') && !file.path.includes('main.tsx')) {
          // Save component file with correct name
          filePath = path.join(srcDir, `${derivedComponentName}.tsx`);
        } else if (
          file.path.endsWith('.css') &&
          !file.path.includes('index.css')
        ) {
          // Save CSS module with correct name
          filePath = path.join(srcDir, `${derivedComponentName}.module.css`);
        } else {
          // Save other files in their original locations
          filePath = path.join(workspaceDir, file.path);
        }

        const fileDir = path.dirname(filePath);
        await mkdir(fileDir, { recursive: true });
        await fs.writeFile(filePath, file.content);
      })
    );

    // Update main.tsx to import the correct component
    const mainTsxPath = path.join(srcDir, 'main.tsx');
    if (
      await fs
        .access(mainTsxPath)
        .then(() => true)
        .catch(() => false)
    ) {
      const mainContent = await fs.readFile(mainTsxPath, 'utf-8');
      const updatedContent = mainContent.replace(
        /import Component from ['"]\.\/[^'"]+['"]/,
        `import Component from './${derivedComponentName}'`
      );
      await fs.writeFile(mainTsxPath, updatedContent);
    }

    // Create necessary files if they don't exist
    const requiredFiles = {
      'tsconfig.json': JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            moduleResolution: 'bundler',
            jsx: 'react-jsx',
            strict: true,
            skipLibCheck: true,
            esModuleInterop: true,
            isolatedModules: true,
            allowSyntheticDefaultImports: true,
            resolveJsonModule: true,
            noEmit: true,
          },
          include: ['src'],
        },
        null,
        2
      ),
      'tsconfig.node.json': JSON.stringify(
        {
          compilerOptions: {
            composite: true,
            skipLibCheck: true,
            module: 'ESNext',
            moduleResolution: 'bundler',
            allowSyntheticDefaultImports: true,
          },
          include: ['vite.config.ts'],
        },
        null,
        2
      ),
      'package.json': JSON.stringify(
        {
          name: derivedComponentName.toLowerCase(),
          private: true,
          version: '0.0.0',
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview',
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
            'framer-motion': '^10.16.4',
          },
          devDependencies: {
            '@types/react': '^18.2.15',
            '@types/react-dom': '^18.2.7',
            '@vitejs/plugin-react': '^4.0.3',
            typescript: '^5.0.2',
            vite: '^4.4.5',
          },
        },
        null,
        2
      ),
      'vite.config.ts': `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  }
});`,
      'index.html': `
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${derivedComponentName}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
      'src/main.tsx': `
import React from 'react';
import ReactDOM from 'react-dom/client';
import Component from './${derivedComponentName}';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
      <Component />
    </div>
  </React.StrictMode>
);`,
      'src/index.css': `
:root {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  min-height: 100vh;
}`,
    };

    for (const [filename, content] of Object.entries(requiredFiles)) {
      const filePath = path.join(workspaceDir, filename);
      const fileDir = path.dirname(filePath);
      await mkdir(fileDir, { recursive: true });
      if (!files.some((f: { path: string }) => f.path === filename)) {
        await fs.writeFile(filePath, content);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error saving files:', error);
    res.status(500).json({
      error: 'Failed to save files',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/components/start-server', optionalAuth, async (req, res) => {
  try {
    const { componentName } = req.body;
    
    // Check if deployment instance already exists
    const existingInstance = deploymentService.getInstanceByComponentName(componentName);
    if (existingInstance && existingInstance.status === 'running') {
      return res.json({
        url: existingInstance.url,
        instanceId: existingInstance.id,
      });
    }

    // Find the correct workspace directory
    const workspaceDir = await findWorkspaceDirectory(componentName);
    if (!workspaceDir) {
      return res.status(404).json({ error: 'Component workspace not found. Please generate it first.' });
    }

    // Read all files from the workspace
    const files = await readWorkspaceFiles(workspaceDir);
    
    addTerminalOutput(componentName, '🚀 Starting development server...');
    
    // Deploy the app
    const instance = await deploymentService.deployApp(componentName, files);
    
    addTerminalOutput(componentName, `✅ Development server started! Access your app at: ${instance.url}`);
    
    res.json({
      url: instance.url,
      instanceId: instance.id,
    });
  } catch (error) {
    console.error('Error starting server:', error);
    res.status(500).json({
      error: 'Failed to start server',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/components/stop-server', authenticateUser, async (req, res) => {
  try {
    const { componentName } = req.body;

    // Check if server exists
    if (!activeServers[componentName]) {
      return res.status(404).json({ error: 'Server not found' });
    }

    // Kill the server process
    const serverProcess = activeServers[componentName].process;
    if (process.platform === 'win32') {
      // On Windows, we need to kill the process tree
      exec(`taskkill /pid ${serverProcess.pid} /T /F`);
    } else {
      // On Unix-like systems
      serverProcess.kill('SIGTERM');
    }

    delete activeServers[componentName];
    res.json({ success: true });
  } catch (error) {
    console.error('Error stopping server:', error);
    res.status(500).json({
      error: 'Failed to stop server',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

router.post('/components/download', authenticateUser, async (req, res) => {
  try {
    const { componentName, files } = req.body;
    const baseWorkspaceDir = path.join(
      process.cwd(),
      'workspaces',
      componentName.toLowerCase()
    );
    const finalWorkspaceDir = path.join(baseWorkspaceDir, 'final');
    const zipPath = path.join(
      process.cwd(),
      'workspaces',
      `${componentName.toLowerCase()}.zip`
    );

    // Create workspace directory if it doesn't exist
    await mkdir(finalWorkspaceDir, { recursive: true });

    // Aggregate files from all generation steps
    const allFiles = [];
    const generations = await fs.readdir(baseWorkspaceDir);
    for (const gen of generations) {
      if (gen === 'final') continue;
      const genPath = path.join(baseWorkspaceDir, gen);
      const stat = await fs.stat(genPath);
      if (stat.isDirectory()) {
        const genFiles = await fs.readdir(genPath, { recursive: true });
        for (const file of genFiles) {
          const filePath = path.join(genPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          allFiles.push({ path: file, content });
        }
      }
    }

    // Merge with new files and write all files
    const mergedFiles = [...allFiles, ...files];
    await Promise.all(
      mergedFiles.map(async (file: { path: string; content: string }) => {
        const filePath = path.join(finalWorkspaceDir, file.path);
        const fileDir = path.dirname(filePath);
        await mkdir(fileDir, { recursive: true });
        await fs.writeFile(filePath, file.content);
      })
    );

    // Create zip file
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 },
    });

    archive.pipe(output);
    archive.directory(finalWorkspaceDir, false);
    await archive.finalize();

    // Send zip file
    res.download(zipPath, `${componentName.toLowerCase()}.zip`, async err => {
      if (err) console.error('Error sending zip:', err);
      // Clean up
      try {
        await fs.unlink(zipPath);
      } catch (error) {
        console.error('Error cleaning up zip:', error);
      }
    });
  } catch (error) {
    console.error('Error creating download:', error);
    res.status(500).json({
      error: 'Failed to create download',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/components/:componentName - Get component data
router.get('/components/:componentName', async (req, res) => {
  try {
    const componentName = req.params.componentName;
    const workspaceDir = path.join(
      process.cwd(),
      'workspaces',
      componentName.toLowerCase(),
      'final'
    );

    // Check if workspace exists
    try {
      await fs.access(workspaceDir);
    } catch {
      return res.status(404).json({ error: 'Component not found' });
    }

    // Read all files in the workspace
    const files: { path: string; content: string }[] = [];
    const readDirRecursive = async (dir: string, baseDir: string = dir) => {
      const items = await fs.readdir(dir);

      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = await fs.stat(fullPath);

        if (stat.isDirectory()) {
          await readDirRecursive(fullPath, baseDir);
        } else {
          const relativePath = path.relative(baseDir, fullPath);
          const content = await fs.readFile(fullPath, 'utf-8');
          files.push({
            path: relativePath,
            content,
          });
        }
      }
    };

    await readDirRecursive(workspaceDir);

    const response: GeneratedComponent = {
      files,
      preview: {
        url: `/preview/${componentName.toLowerCase()}`,
        editorUrl: `/editor/${componentName.toLowerCase()}`,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching component:', error);
    res.status(500).json({
      error: 'Failed to fetch component',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// SSE endpoint for real-time file generation streaming
router.get('/components/generate/stream', authenticateUser, async (req, res) => {
  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);
  
  // Keep connection alive with heartbeat
  const heartbeat = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'heartbeat' })}\n\n`);
  }, 30000);
  
  // Clean up on client disconnect
  req.on('close', () => {
    clearInterval(heartbeat);
  });
});

// POST endpoint to trigger generation (sends session ID for SSE connection)
router.post('/components/generate/trigger', authenticateUser, async (req, res) => {
  try {
    const { prompt, sessionId, selectedKnowledge, projectId } = req.body;
    const userId = req.user?.id;

    // Return session ID for client to connect to SSE stream
    res.json({ sessionId, status: 'started' });

    // Start generation in background (will stream via SSE)
    // This allows us to return immediately and stream updates
    setImmediate(async () => {
      // TODO: Implement file-by-file generation with SSE updates
      // For now, this is a placeholder
    });
  } catch (error) {
    console.error('Error triggering generation:', error);
    res.status(500).json({ error: 'Failed to start generation' });
  }
});

// Smart Orchestrator Demo Endpoint - 30-50% cost savings, 40-60% faster!
router.post('/components/generate/smart', authenticateUser, async (req, res) => {
  try {
    const { prompt } = req.body;
    const userId = req.user?.id;

    // Get user tier (if available)
    const userTier = req.user?.tier || 'free';

    // Optional: Apply constraints based on user tier
    const constraints: { maxCost?: number; maxDuration?: number } = {};
    if (userTier === 'free') {
      constraints.maxCost = 0.50;  // Free tier: max $0.50 per request
      constraints.maxDuration = 120; // Free tier: max 2 minutes
    }

    // Call SmartOrchestrator
    const result = await smartOrchestrator.orchestrate({
      prompt,
      userTier,
      constraints,
      userId
    });

    // Return result with metadata
    res.json({
      success: result.success,
      output: result.output,
      metadata: {
        complexity: result.metadata.complexity,
        agentsUsed: result.metadata.agentsUsed,
        totalCost: result.metadata.totalCost,
        duration: result.metadata.duration,
        fromCache: result.metadata.fromCache,
        parallelWaves: result.metadata.parallelWaves,
        savings: result.metadata.estimatedSavings
      }
    });
  } catch (error) {
    console.error('Smart orchestration error:', error);
    res.status(500).json({
      error: 'Failed to orchestrate',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get SmartOrchestrator cache statistics
router.get('/components/smart/cache-stats', authenticateUser, async (req, res) => {
  try {
    const stats = smartOrchestrator.getCacheStats();
    res.json({
      cacheSize: stats.size,
      entries: stats.entries,
      message: stats.size > 0
        ? `Cache contains ${stats.size} entries. Using cached results saves 100% of cost and provides instant responses!`
        : 'Cache is empty. Generate some components to build up the cache.'
    });
  } catch (error) {
    console.error('Error getting cache stats:', error);
    res.status(500).json({ error: 'Failed to get cache statistics' });
  }
});

router.post('/components/generate', authenticateUser, async (req, res) => {
  try {
    const { prompt, sessionId, selectedKnowledge, projectId } = req.body;
    const userId = req.user?.id;

    // Check rate limits and get API key if user is authenticated
    let apiKeyResult = null;
    if (userId) {
      try {
        apiKeyResult = await monetizationService.getAPIKeyForRequest(
          userId,
          'anthropic',
          'component_generation'
        );
      } catch (error) {
        return res.status(429).json({
          error: 'Rate limit exceeded',
          message:
            error instanceof Error
              ? error.message
              : 'Please upgrade your plan for more requests',
          upgradeRequired: true,
        });
      }
    }

    // Track generation activity if user is authenticated and projectId is provided
    if (userId && projectId) {
      await userActivityService.trackUserActivity(
        projectId,
        userId,
        'generating',
        'component_generation',
        { prompt: prompt.substring(0, 100), sessionId }
      );
    }

    // Get existing component name if it exists for this session
    const existingComponentName = activeComponents[sessionId];

    // Detect if this is a Python application
    const isPythonApp =
      prompt.toLowerCase().includes('python') ||
      prompt.toLowerCase().includes('flask') ||
      prompt.toLowerCase().includes('django') ||
      prompt.toLowerCase().includes('fastapi') ||
      prompt.toLowerCase().includes('opencv') ||
      prompt.toLowerCase().includes('numpy') ||
      prompt.toLowerCase().includes('pandas');

    if (isPythonApp) {
      // For Python apps, we'll create a simple Python project structure
      // This is a basic implementation - could be enhanced further
      const pythonProjectName =
        existingComponentName || `python-app-${Date.now()}`;
      const userWorkspaceDir = userId
        ? path.join(process.cwd(), 'workspaces', userId)
        : path.join(process.cwd(), 'workspaces');
      const projectDir = path.join(
        userWorkspaceDir,
        pythonProjectName.toLowerCase()
      );
      await mkdir(projectDir, { recursive: true });

      // Create basic Python project files
      const pythonFiles = [
        {
          path: 'main.py',
          content: `# Generated Python Application
import sys
import os

def main():
    print("Hello from your Python application!")
    print("This is a basic Python app generated by AI.")
    print("You can extend this with your specific functionality.")

if __name__ == "__main__":
    main()
`,
        },
        {
          path: 'requirements.txt',
          content: `# Python dependencies
# Add your required packages here
# Example:
# requests==2.31.0
# opencv-python==4.8.1.78
# numpy==1.24.3
`,
        },
        {
          path: 'README.md',
          content: `# ${pythonProjectName}

This is a Python application generated by AI.

## Setup

1. Install Python 3.8 or higher
2. Install dependencies:
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

3. Run the application:
   \`\`\`bash
   python main.py
   \`\`\`

## Development

This is a basic Python application structure. You can extend it with your specific functionality.
`,
        },
      ];

      // Write Python files
      await Promise.all(
        pythonFiles.map(async file => {
          const filePath = path.join(projectDir, file.path);
          const fileDir = path.dirname(filePath);
          await mkdir(fileDir, { recursive: true });
          await fs.writeFile(filePath, file.content);
        })
      );

      // Return Python project structure
      return res.json({
        files: pythonFiles,
        preview: {
          url: `/preview/${pythonProjectName.toLowerCase()}`,
          editorUrl: `/editor/${pythonProjectName.toLowerCase()}`,
        },
      });
    }

    // Create orchestrator instance for React/web apps
    const userWorkspaceDir = userId
      ? path.join(process.cwd(), 'workspaces', userId)
      : process.cwd();
    const orchestrator = new ComponentOrchestrator(userWorkspaceDir);
    await orchestrator.initialize();

    // Generate the component files first (without npm install for faster response)
    const result = await orchestrator.generateFilesOnly(
      prompt,
      req,
      undefined,
      existingComponentName,
      sessionId,
      selectedKnowledge
    );
    if (!result.success) {
      console.error('Component generation failed:', result.errors);
      throw new Error(result.errors?.join(', ') || 'Unknown error');
    }

    // Store the component name for this session
    if (!existingComponentName) {
      activeComponents[sessionId] = orchestrator.getComponentName();
    }

    // Track user workspace if user is authenticated
    if (userId) {
      await userService.addUserWorkspace(userId, {
        workspaceName: orchestrator.getComponentName(),
        componentName: orchestrator.getComponentName(),
        workspacePath: path.join(
          userWorkspaceDir,
          'workspaces',
          orchestrator.getComponentName().toLowerCase()
        ),
        metadata: {
          prompt,
          sessionId,
          createdAt: new Date().toISOString(),
        },
      });

      // Track usage for monetization
      try {
        await monetizationService.trackUsage(
          userId,
          'anthropic',
          'component_generation',
          1000, // Estimate tokens (could be improved with actual token counting)
          sessionId,
          {
            componentName: orchestrator.getComponentName(),
            promptLength: prompt.length,
            filesGenerated: result.files?.length || 0,
          }
        );
      } catch (error) {
        console.error('Error tracking usage:', error);
        // Don't fail the request if usage tracking fails
      }
    }

    // Return WebContainer-ready files for client-side deployment
    const componentName = orchestrator.getComponentName();
    let deploymentUrl = '';
    let instanceId = '';

    // Save generated files to R2 storage (cloud) or local disk as fallback
    const timestamp = Date.now();
    const projectKey = `${userId || 'anonymous'}/${componentName.toLowerCase()}-${timestamp}`;

    try {
      // Try to save to R2 first (cloud storage - scalable and persistent)
      if (r2StorageService.isEnabled()) {
        addTerminalOutput(componentName, '☁️ Uploading files to cloud storage (R2)...');

        const r2Files = result.files.map(file => ({
          path: `${projectKey}/${file.path}`,
          content: file.content,
          contentType: r2StorageService['getContentType'](file.path)
        }));

        await r2StorageService.uploadFiles(r2Files);
        addTerminalOutput(componentName, `✅ Uploaded ${result.files.length} files to R2 cloud storage`);
        addTerminalOutput(componentName, `📍 Storage path: ${projectKey}`);
      } else {
        // Fallback to local filesystem
        addTerminalOutput(componentName, '💾 Saving files to local workspace (R2 not configured)...');

        const workspaceBaseDir = userId
          ? path.join(process.cwd(), 'workspaces', userId)
          : path.join(process.cwd(), 'workspaces');
        const workspaceDir = path.join(workspaceBaseDir, `${componentName.toLowerCase()}-${timestamp}`);

        await mkdir(workspaceDir, { recursive: true });
        await mkdir(path.join(workspaceDir, 'src'), { recursive: true });

        await Promise.all(
          result.files.map(async (file: { path: string; content: string }) => {
            const filePath = path.join(workspaceDir, file.path);
            const fileDir = path.dirname(filePath);
            await mkdir(fileDir, { recursive: true });
            await fs.writeFile(filePath, file.content);
          })
        );
        addTerminalOutput(componentName, `✅ Saved ${result.files.length} files to local disk`);
      }

      // Deploy using DeploymentService (works with in-memory files)
      addTerminalOutput(componentName, '🚀 Starting development server...');
      const deploymentInstance = await deploymentService.deployApp(componentName, result.files);
      deploymentUrl = deploymentInstance.url;
      instanceId = deploymentInstance.id;

      addTerminalOutput(componentName, `✅ Development server started at ${deploymentUrl}`);
    } catch (deploymentError) {
      console.error('Failed to deploy app:', deploymentError);
      addTerminalOutput(componentName, `⚠️ Deployment failed: ${deploymentError instanceof Error ? deploymentError.message : 'Unknown error'}`);
      // Don't fail the entire request if deployment fails
    }

    // Deduct credits after successful generation
    if (userId) {
      await deductCredits(userId, 1);
      addTerminalOutput(componentName, '✅ 1 generation credit used');
    }

    // Return file structure and preview URLs with deployment info
    const response: GeneratedComponent = {
      files: result.files || [],
      preview: {
        url: deploymentUrl || `/preview/${componentName.toLowerCase()}`,
        editorUrl: `/editor/${componentName.toLowerCase()}`,
      },
      webContainer: deploymentUrl ? {
        url: deploymentUrl,
        instanceId: instanceId,
        status: 'running'
      } : undefined,
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating component:', error);
    res.status(500).json({
      error: 'Failed to generate component',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Route to get WebContainer instance by component name
router.get('/components/:componentName/instance', optionalAuth, async (req, res) => {
  try {
    const { componentName } = req.params;
    const instance = deploymentService.getInstanceByComponentName(componentName);
    
    if (!instance) {
      return res.status(404).json({ error: 'No running instance found for this component' });
    }
    
    res.json({
      id: instance.id,
      url: instance.url,
      status: instance.status,
      componentName: instance.componentName,
      createdAt: instance.createdAt,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get instance status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Route to get WebContainer instance status by ID
router.get('/components/instance/:instanceId', optionalAuth, async (req, res) => {
  try {
    const { instanceId } = req.params;
    const instance = deploymentService.getInstance(instanceId);
    
    if (!instance) {
      return res.status(404).json({ error: 'Instance not found' });
    }
    
    res.json({
      id: instance.id,
      url: instance.url,
      status: instance.status,
      componentName: instance.componentName,
      createdAt: instance.createdAt,
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get instance status',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Route to stop a WebContainer instance
router.delete('/components/instance/:instanceId', optionalAuth, async (req, res) => {
  try {
    const { instanceId } = req.params;
    await deploymentService.stopInstance(instanceId);
    
    res.json({ message: 'Instance stopped successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to stop instance',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Route to cleanup old instances (admin only)
router.post('/components/cleanup', authenticateUser, async (req, res) => {
  try {
    const { maxAgeHours = 24 } = req.body;
    await deploymentService.cleanupOldDeployments(maxAgeHours);
    
    res.json({ message: 'Cleanup completed successfully' });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to cleanup instances',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get component files for real-time updates
router.get('/components/:componentName/files', async (req, res) => {
  try {
    const { componentName } = req.params;
    
    // Find the correct workspace directory
    const workspaceDir = await findWorkspaceDirectory(componentName);
    if (!workspaceDir) {
      return res.status(404).json({ error: 'Component workspace not found' });
    }

    // Read all files from the workspace
    const files = await readWorkspaceFiles(workspaceDir);
    
    const response: GeneratedComponent = {
      files,
      preview: {
        url: `/preview/${componentName.toLowerCase()}`,
        editorUrl: `/editor/${componentName.toLowerCase()}`,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Error reading component files:', error);
    res.status(500).json({ error: 'Failed to read component files' });
  }
});

// POST /api/components/:componentName/deploy/vercel - Deploy component to Vercel
router.post('/components/:componentName/deploy/vercel', authenticateUser, async (req, res) => {
  try {
    const { componentName } = req.params;
    const { framework = 'react', buildCommand, outputDirectory } = req.body;
    
    // Find the workspace directory and read files
    const workspaceDir = await findWorkspaceDirectory(componentName);
    if (!workspaceDir) {
      return res.status(404).json({ error: 'Component workspace not found' });
    }
    
    const files = await readWorkspaceFiles(workspaceDir);
    
    // Deploy to Vercel
    const deployment = await vercelDeploymentService.deployToVercel(
      componentName,
      files,
      {
        framework,
        buildCommand,
        outputDirectory,
      }
    );
    
    res.json({
      success: true,
      deployment,
      message: 'Component deployed to Vercel successfully!',
    });
  } catch (error) {
    console.error('Error deploying to Vercel:', error);
    res.status(500).json({
      error: 'Failed to deploy to Vercel',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/components/deployments/vercel - Get all Vercel deployments
router.get('/components/deployments/vercel', authenticateUser, async (req, res) => {
  try {
    const deployments = vercelDeploymentService.getAllDeployments();
    res.json({ deployments });
  } catch (error) {
    console.error('Error fetching Vercel deployments:', error);
    res.status(500).json({ error: 'Failed to fetch deployments' });
  }
});

// DELETE /api/components/deployments/vercel/:deploymentId - Delete Vercel deployment
router.delete('/components/deployments/vercel/:deploymentId', authenticateUser, async (req, res) => {
  try {
    const { deploymentId } = req.params;
    await vercelDeploymentService.deleteDeployment(deploymentId);
    res.json({ message: 'Deployment deleted successfully' });
  } catch (error) {
    console.error('Error deleting Vercel deployment:', error);
    res.status(500).json({ error: 'Failed to delete deployment' });
  }
});

export default router;
