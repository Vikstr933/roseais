import { Router } from 'express';
import { generateReactComponent } from '../utils/componentGenerator';
import path from 'path';
import fs from 'fs/promises';
import { exec, ChildProcess } from 'child_process';
import { promisify } from 'util';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { ComponentOrchestrator } from '../utils/componentOrchestrator';

const execAsync = promisify(exec);
const router = Router();

interface GeneratedComponent {
  files: {
    path: string;
    content: string;
  }[];
  preview: {
    url: string;
    editorUrl: string;
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
    const baseWorkspaceDir = path.join(process.cwd(), 'workspaces', componentName.toLowerCase());
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
    const mainComponentFile = files.find((f: { path: string }) => f.path.endsWith('.tsx') && !f.path.includes('main.tsx'));
    const derivedComponentName = mainComponentFile ? path.basename(mainComponentFile.path, '.tsx') : componentName;

    // Create src directory
    const srcDir = path.join(workspaceDir, 'src');
    await mkdir(srcDir, { recursive: true });

    // Save files with correct paths
    await Promise.all(files.map(async (file: { path: string; content: string }) => {
      let filePath;
      if (file.path.endsWith('.tsx') && !file.path.includes('main.tsx')) {
        // Save component file with correct name
        filePath = path.join(srcDir, `${derivedComponentName}.tsx`);
      } else if (file.path.endsWith('.css') && !file.path.includes('index.css')) {
        // Save CSS module with correct name
        filePath = path.join(srcDir, `${derivedComponentName}.module.css`);
      } else {
        // Save other files in their original locations
        filePath = path.join(workspaceDir, file.path);
      }
      
      const fileDir = path.dirname(filePath);
      await mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, file.content);
    }));

    // Update main.tsx to import the correct component
    const mainTsxPath = path.join(srcDir, 'main.tsx');
    if (await fs.access(mainTsxPath).then(() => true).catch(() => false)) {
      const mainContent = await fs.readFile(mainTsxPath, 'utf-8');
      const updatedContent = mainContent.replace(
        /import Component from ['"]\.\/[^'"]+['"]/,
        `import Component from './${derivedComponentName}'`
      );
      await fs.writeFile(mainTsxPath, updatedContent);
    }

    // Create necessary files if they don't exist
    const requiredFiles = {
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
          esModuleInterop: true,
          isolatedModules: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
          noEmit: true
        },
        include: ["src"]
      }, null, 2),
      'tsconfig.node.json': JSON.stringify({
        compilerOptions: {
          composite: true,
          skipLibCheck: true,
          module: "ESNext",
          moduleResolution: "bundler",
          allowSyntheticDefaultImports: true
        },
        include: ["vite.config.ts"]
      }, null, 2),
      'package.json': JSON.stringify({
        name: derivedComponentName.toLowerCase(),
        private: true,
        version: "0.0.0",
        type: "module",
        scripts: {
          dev: "vite",
          build: "tsc && vite build",
          preview: "vite preview"
        },
        dependencies: {
          "react": "^18.2.0",
          "react-dom": "^18.2.0",
          "framer-motion": "^10.16.4"
        },
        devDependencies: {
          "@types/react": "^18.2.15",
          "@types/react-dom": "^18.2.7",
          "@vitejs/plugin-react": "^4.0.3",
          "typescript": "^5.0.2",
          "vite": "^4.4.5"
        }
      }, null, 2),
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
}`
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
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/components/start-server', async (req, res) => {
  try {
    const { componentName } = req.body;
    const baseWorkspaceDir = path.join(process.cwd(), 'workspaces', componentName.toLowerCase());
    const workspaceDir = path.join(baseWorkspaceDir, 'final');
    
    // Check if server is already running
    if (activeServers[componentName]) {
      return res.json({ url: `http://localhost:${activeServers[componentName].port}` });
    }
    
    // Assign a port
    const port = nextPort++;
    
    // Clean install dependencies
    console.log('Installing dependencies...');
    await execAsync('npm install --force', { cwd: workspaceDir });
    
    // Create minimal tsconfig.json
    console.log('Creating tsconfig.json...');
    await fs.writeFile(
      path.join(workspaceDir, 'tsconfig.json'),
      JSON.stringify({
        compilerOptions: {
          target: "ES2020",
          lib: ["ES2020", "DOM", "DOM.Iterable"],
          module: "ESNext",
          moduleResolution: "bundler",
          jsx: "react-jsx",
          strict: true,
          skipLibCheck: true,
          esModuleInterop: true,
          isolatedModules: true,
          allowSyntheticDefaultImports: true,
          resolveJsonModule: true,
          noEmit: true
        },
        include: ["src"]
      }, null, 2)
    );
    
    // Start development server with clean cache
    console.log('Starting development server...');
    const serverProcess = exec(
      `npx vite --port ${port} --host --force --clearScreen=false`,
      { cwd: path.join(baseWorkspaceDir, 'final') }
    );

    if (!serverProcess.stdout || !serverProcess.stderr) {
      throw new Error('Failed to start server process');
    }
    
    // Store server info
    activeServers[componentName] = { process: serverProcess, port };
    
    // Handle server output
    serverProcess.stdout.on('data', (data) => {
      console.log(`[${componentName} Server]: ${data}`);
    });
    
    serverProcess.stderr.on('data', (data) => {
      console.error(`[${componentName} Server Error]: ${data}`);
    });
    
    // Handle server exit
    serverProcess.on('exit', (code) => {
      console.log(`[${componentName} Server] exited with code ${code}`);
      delete activeServers[componentName];
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    res.json({ url: `http://localhost:${port}` });
  } catch (error) {
    console.error('Error starting server:', error);
    res.status(500).json({
      error: 'Failed to start server',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/components/stop-server', async (req, res) => {
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
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/components/download', async (req, res) => {
  try {
    const { componentName, files } = req.body;
    const baseWorkspaceDir = path.join(process.cwd(), 'workspaces', componentName.toLowerCase());
    const finalWorkspaceDir = path.join(baseWorkspaceDir, 'final');
    const zipPath = path.join(process.cwd(), 'workspaces', `${componentName.toLowerCase()}.zip`);
    
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
    await Promise.all(mergedFiles.map(async (file: { path: string; content: string }) => {
      const filePath = path.join(finalWorkspaceDir, file.path);
      const fileDir = path.dirname(filePath);
      await mkdir(fileDir, { recursive: true });
      await fs.writeFile(filePath, file.content);
    }));
    
    // Create zip file
    const output = createWriteStream(zipPath);
    const archive = archiver('zip', {
      zlib: { level: 9 }
    });
    
    archive.pipe(output);
    archive.directory(finalWorkspaceDir, false);
    await archive.finalize();
    
    // Send zip file
    res.download(zipPath, `${componentName.toLowerCase()}.zip`, async (err) => {
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
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// GET /api/components/:componentName - Get component data
router.get('/components/:componentName', async (req, res) => {
  try {
    const componentName = req.params.componentName;
    const workspaceDir = path.join(process.cwd(), 'workspaces', componentName.toLowerCase(), 'final');

    // Check if workspace exists
    try {
      await fs.access(workspaceDir);
    } catch {
      return res.status(404).json({ error: 'Component not found' });
    }

    // Read all files in the workspace
    const files = [];
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
            content
          });
        }
      }
    };

    await readDirRecursive(workspaceDir);

    const response: GeneratedComponent = {
      files,
      preview: {
        url: `/preview/${componentName.toLowerCase()}`,
        editorUrl: `/editor/${componentName.toLowerCase()}`
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error fetching component:', error);
    res.status(500).json({
      error: 'Failed to fetch component',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/components/generate', async (req, res) => {
  try {
    const { prompt, sessionId } = req.body;

    // Get existing component name if it exists for this session
    const existingComponentName = activeComponents[sessionId];

    // Create orchestrator instance
    const orchestrator = new ComponentOrchestrator(process.cwd());

    // Generate the component
    const result = await orchestrator.orchestrate(prompt, req, undefined, existingComponentName);
    if (!result.success) {
      throw new Error(result.errors.join(', '));
    }

    // Store the component name for this session
    if (!existingComponentName) {
      activeComponents[sessionId] = orchestrator.getComponentName();
    }

    // Return file structure and preview URLs
    const response: GeneratedComponent = {
      files: result.files,
      preview: {
        url: `/preview/${orchestrator.getComponentName().toLowerCase()}`,
        editorUrl: `/editor/${orchestrator.getComponentName().toLowerCase()}`
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating component:', error);
    res.status(500).json({
      error: 'Failed to generate component',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
