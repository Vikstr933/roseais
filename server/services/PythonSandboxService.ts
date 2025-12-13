/**
 * Python Sandbox Service
 * Runs Python web applications (Flask, Django, FastAPI, Streamlit) in isolated sandboxes
 * 
 * PRIMARY: E2B Cloud Sandbox (recommended for production)
 * FALLBACK: Local Python execution (development only)
 * 
 * Set E2B_API_KEY environment variable to enable E2B cloud sandboxes
 */

import { SimpleLogger } from '../utils/SimpleLogger';
import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

const logger = new SimpleLogger('PythonSandboxService');

export interface PythonFile {
  path: string;
  content: string;
}

export interface SandboxInstance {
  id: string;
  status: 'starting' | 'running' | 'stopped' | 'error';
  url?: string;
  port?: number;
  logs: string[];
  error?: string;
  createdAt: Date;
  projectType: 'flask' | 'django' | 'fastapi' | 'streamlit' | 'script';
  provider: 'e2b' | 'local';
}

export interface SandboxOptions {
  timeout?: number; // Max execution time in ms (default: 5 minutes)
  memory?: number; // Max memory in MB (default: 512)
  port?: number; // Port to run on (default: auto-assign)
}

// E2B Sandbox interface (dynamically imported)
interface E2BSandbox {
  id: string;
  close: () => Promise<void>;
  files: {
    write: (path: string, content: string) => Promise<void>;
  };
  commands: {
    run: (cmd: string, opts?: { timeout?: number; onStdout?: (data: string) => void; onStderr?: (data: string) => void }) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  };
  getHost: (port: number) => string;
}

class PythonSandboxService {
  private static instance: PythonSandboxService;
  private sandboxes: Map<string, SandboxInstance> = new Map();
  private e2bSandboxes: Map<string, E2BSandbox> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private basePort = 8100;
  private usedPorts: Set<number> = new Set();
  private e2bAvailable: boolean = false;
  private E2BSandboxClass: any = null;

  private constructor() {
    // Cleanup on process exit
    process.on('exit', () => this.cleanupAll());
    process.on('SIGINT', () => this.cleanupAll());
    process.on('SIGTERM', () => this.cleanupAll());
    
    // Check E2B availability
    this.initE2B();
  }

  /**
   * Initialize E2B SDK if API key is available
   */
  private async initE2B(): Promise<void> {
    if (!process.env.E2B_API_KEY) {
      logger.info('E2B_API_KEY not set - using local Python execution');
      return;
    }

    try {
      // Dynamically import E2B to avoid errors if not installed
      const e2b = await import('@e2b/code-interpreter');
      this.E2BSandboxClass = e2b.Sandbox;
      this.e2bAvailable = true;
      logger.info('✅ E2B SDK initialized - cloud sandboxes enabled');
    } catch (error) {
      logger.warn('E2B SDK not installed - run: npm install @e2b/code-interpreter');
      logger.info('Falling back to local Python execution');
    }
  }

  static getInstance(): PythonSandboxService {
    if (!PythonSandboxService.instance) {
      PythonSandboxService.instance = new PythonSandboxService();
    }
    return PythonSandboxService.instance;
  }

  /**
   * Check if E2B is available
   */
  isE2BAvailable(): boolean {
    return this.e2bAvailable && !!process.env.E2B_API_KEY;
  }

  /**
   * Detect Python project type from files
   */
  detectProjectType(files: PythonFile[]): SandboxInstance['projectType'] {
    for (const file of files) {
      const content = file.content.toLowerCase();
      
      if (content.includes('from flask import') || content.includes('import flask')) {
        return 'flask';
      }
      if (content.includes('from django') || content.includes('import django')) {
        return 'django';
      }
      if (content.includes('from fastapi import') || content.includes('import fastapi')) {
        return 'fastapi';
      }
      if (content.includes('import streamlit') || content.includes('from streamlit')) {
        return 'streamlit';
      }
    }
    
    return 'script';
  }

  /**
   * Get next available port (for local execution)
   */
  private getNextPort(): number {
    let port = this.basePort;
    while (this.usedPorts.has(port)) {
      port++;
    }
    this.usedPorts.add(port);
    return port;
  }

  /**
   * Create a new Python sandbox
   * Uses E2B if available, otherwise falls back to local execution
   */
  async createSandbox(
    files: PythonFile[],
    userId: string,
    options: SandboxOptions = {}
  ): Promise<SandboxInstance> {
    const sandboxId = `py-${uuidv4().slice(0, 8)}`;
    const projectType = this.detectProjectType(files);
    const timeout = options.timeout || 5 * 60 * 1000; // 5 minutes default

    logger.info(`Creating Python sandbox: ${sandboxId}, type: ${projectType}, e2b: ${this.isE2BAvailable()}`);

    // Try E2B first if available
    if (this.isE2BAvailable()) {
      return this.createE2BSandbox(sandboxId, files, projectType, timeout);
    }

    // Fallback to local execution
    return this.createLocalSandbox(sandboxId, files, projectType, options, timeout);
  }

  /**
   * Create sandbox using E2B Cloud
   */
  private async createE2BSandbox(
    sandboxId: string,
    files: PythonFile[],
    projectType: SandboxInstance['projectType'],
    timeout: number
  ): Promise<SandboxInstance> {
    const sandbox: SandboxInstance = {
      id: sandboxId,
      status: 'starting',
      logs: [],
      createdAt: new Date(),
      projectType,
      provider: 'e2b',
    };

    this.sandboxes.set(sandboxId, sandbox);

    const addLog = (message: string) => {
      sandbox.logs.push(`[${new Date().toISOString()}] ${message}`);
      if (sandbox.logs.length > 100) {
        sandbox.logs = sandbox.logs.slice(-100);
      }
    };

    try {
      addLog('🚀 Creating E2B cloud sandbox...');
      
      // Create E2B sandbox
      const e2bSandbox = await this.E2BSandboxClass.create({
        timeoutMs: timeout,
      });
      
      this.e2bSandboxes.set(sandboxId, e2bSandbox);
      addLog(`✅ E2B sandbox created: ${e2bSandbox.id}`);

      // Write all files to sandbox
      for (const file of files) {
        const filePath = file.path.startsWith('/') ? file.path : `/${file.path}`;
        await e2bSandbox.files.write(filePath, file.content);
        addLog(`📄 Uploaded: ${file.path}`);
      }

      // Generate requirements.txt if not provided
      const hasRequirements = files.some(f => f.path === 'requirements.txt');
      if (!hasRequirements) {
        const requirements = this.generateRequirements(files, projectType);
        await e2bSandbox.files.write('/requirements.txt', requirements);
        addLog('📦 Generated requirements.txt');
      } else {
        // Sanitize existing requirements
        const reqFile = files.find(f => f.path === 'requirements.txt');
        if (reqFile) {
          const sanitized = this.sanitizeRequirements(reqFile.content, files);
          await e2bSandbox.files.write('/requirements.txt', sanitized);
          addLog('📦 Sanitized requirements.txt');
        }
      }

      // Install dependencies
      addLog('📦 Installing dependencies...');
      const installResult = await e2bSandbox.commands.run(
        'pip install -r /requirements.txt',
        {
          timeout: 120000, // 2 minutes for install
          onStdout: (data: string) => addLog(`[pip] ${data}`),
          onStderr: (data: string) => addLog(`[pip-err] ${data}`),
        }
      );

      if (installResult.exitCode !== 0) {
        throw new Error(`Failed to install dependencies: ${installResult.stderr}`);
      }
      addLog('✅ Dependencies installed');

      // Start the server based on project type
      const port = this.getServerPort(projectType);
      const startCmd = this.getStartCommand(projectType, files, port);
      
      addLog(`🚀 Starting ${projectType} server...`);
      
      // Run server in background (don't await)
      e2bSandbox.commands.run(startCmd, {
        timeout: timeout,
        onStdout: (data: string) => {
          addLog(`[stdout] ${data}`);
          if (this.isServerReady(data, projectType)) {
            sandbox.status = 'running';
            sandbox.url = `https://${e2bSandbox.getHost(port)}`;
            addLog(`✅ Server ready at ${sandbox.url}`);
          }
        },
        onStderr: (data: string) => {
          addLog(`[stderr] ${data}`);
          if (this.isServerReady(data, projectType)) {
            sandbox.status = 'running';
            sandbox.url = `https://${e2bSandbox.getHost(port)}`;
          }
        },
      }).catch((err: unknown) => {
        if (sandbox.status !== 'stopped') {
          const errorMessage = err instanceof Error ? err.message : String(err);
          addLog(`❌ Server error: ${errorMessage}`);
          sandbox.status = 'error';
          sandbox.error = errorMessage;
        }
      });

      // Wait for server to start (max 60 seconds for E2B)
      const startTime = Date.now();
      while (sandbox.status === 'starting' && (Date.now() - startTime) < 60000) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (sandbox.status === 'starting') {
        // Set URL anyway - server might be starting slowly
        sandbox.url = `https://${e2bSandbox.getHost(port)}`;
        sandbox.status = 'running';
        addLog(`⚠️ Server startup timeout, but sandbox is running. URL: ${sandbox.url}`);
      }

      return sandbox;
    } catch (error) {
      sandbox.status = 'error';
      sandbox.error = error instanceof Error ? error.message : String(error);
      addLog(`❌ Error: ${sandbox.error}`);
      logger.error(`E2B sandbox error: ${sandbox.error}`);
      return sandbox;
    }
  }

  /**
   * Get the port for each framework
   */
  private getServerPort(projectType: string): number {
    switch (projectType) {
      case 'flask': return 5000;
      case 'fastapi': return 8000;
      case 'django': return 8000;
      case 'streamlit': return 8501;
      default: return 8000;
    }
  }

  /**
   * Get the start command for each framework
   */
  private getStartCommand(projectType: string, files: PythonFile[], port: number): string {
    const mainFile = this.findMainFileSync(files, ['app.py', 'main.py', 'server.py']);
    
    switch (projectType) {
      case 'flask':
        return `cd / && FLASK_APP=${mainFile} flask run --host=0.0.0.0 --port=${port}`;
      case 'fastapi':
        const module = mainFile.replace('.py', '').replace('/', '.');
        return `cd / && uvicorn ${module}:app --host=0.0.0.0 --port=${port}`;
      case 'django':
        return `cd / && python manage.py runserver 0.0.0.0:${port}`;
      case 'streamlit':
        return `cd / && streamlit run ${mainFile} --server.port=${port} --server.address=0.0.0.0 --server.headless=true`;
      default:
        return `cd / && python ${mainFile}`;
    }
  }

  /**
   * Check if server is ready based on output
   */
  private isServerReady(output: string, projectType: string): boolean {
    const readyPatterns = [
      'Running on',
      'Uvicorn running',
      'Starting development server',
      'You can now view your Streamlit app',
      'Serving Flask app',
      'Application startup complete',
    ];
    return readyPatterns.some(pattern => output.includes(pattern));
  }

  /**
   * Find main file synchronously (for E2B)
   */
  private findMainFileSync(files: PythonFile[], candidates: string[]): string {
    for (const candidate of candidates) {
      if (files.some(f => f.path === candidate || f.path === `/${candidate}`)) {
        return candidate;
      }
    }
    const pyFile = files.find(f => f.path.endsWith('.py'));
    return pyFile?.path.replace(/^\//, '') || 'main.py';
  }

  /**
   * Create sandbox using local Python (fallback)
   */
  private async createLocalSandbox(
    sandboxId: string,
    files: PythonFile[],
    projectType: SandboxInstance['projectType'],
    options: SandboxOptions,
    timeout: number
  ): Promise<SandboxInstance> {
    const port = options.port || this.getNextPort();

    const sandbox: SandboxInstance = {
      id: sandboxId,
      status: 'starting',
      port,
      logs: [],
      createdAt: new Date(),
      projectType,
      provider: 'local',
    };

    this.sandboxes.set(sandboxId, sandbox);

    try {
      // Create temporary directory for the sandbox
      const tempDir = path.join(os.tmpdir(), 'python-sandbox', sandboxId);
      await fs.mkdir(tempDir, { recursive: true });

      // Write files
      for (const file of files) {
        const filePath = path.join(tempDir, file.path);
        const fileDir = path.dirname(filePath);
        await fs.mkdir(fileDir, { recursive: true });
        await fs.writeFile(filePath, file.content, 'utf-8');
      }

      // Generate or sanitize requirements.txt
      const existingRequirements = files.find(f => f.path === 'requirements.txt');
      if (existingRequirements) {
        const sanitizedRequirements = this.sanitizeRequirements(existingRequirements.content, files);
        await fs.writeFile(path.join(tempDir, 'requirements.txt'), sanitizedRequirements, 'utf-8');
      } else {
        const requirements = this.generateRequirements(files, projectType);
        await fs.writeFile(path.join(tempDir, 'requirements.txt'), requirements, 'utf-8');
      }

      // Start the sandbox
      await this.startLocalSandbox(sandboxId, tempDir, projectType, port, timeout);

      return this.sandboxes.get(sandboxId)!;
    } catch (error) {
      sandbox.status = 'error';
      sandbox.error = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create local sandbox ${sandboxId}: ${sandbox.error}`);
      return sandbox;
    }
  }

  /**
   * Generate requirements.txt based on project type
   */
  private generateRequirements(files: PythonFile[], projectType: string): string {
    const requirements: Set<string> = new Set();

    // Add base requirements based on project type
    switch (projectType) {
      case 'flask':
        requirements.add('flask>=2.0.0');
        requirements.add('flask-cors>=3.0.0');
        break;
      case 'fastapi':
        requirements.add('fastapi>=0.100.0');
        requirements.add('uvicorn>=0.23.0');
        break;
      case 'django':
        requirements.add('django>=4.0.0');
        break;
      case 'streamlit':
        requirements.add('streamlit>=1.20.0');
        break;
    }

    // Get list of local module names
    const localModules = new Set<string>();
    for (const file of files) {
      const fileName = file.path.replace(/\\/g, '/');
      const baseName = fileName.split('/')[0];
      const moduleName = baseName.replace('.py', '');
      if (moduleName && !moduleName.includes('.')) {
        localModules.add(moduleName);
      }
    }

    // Known PyPI packages
    const knownPackages = new Set([
      'numpy', 'pandas', 'matplotlib', 'seaborn', 'scipy', 'sklearn',
      'tensorflow', 'keras', 'torch', 'PIL', 'cv2', 'requests', 'httpx',
      'aiohttp', 'beautifulsoup4', 'bs4', 'lxml', 'selenium', 'pydantic',
      'plotly', 'bokeh', 'altair', 'pytest', 'rich', 'tqdm', 'colorama',
      'pyyaml', 'python-dotenv', 'python-dateutil', 'pytz', 'pillow',
    ]);

    const packageMapping: Record<string, string> = {
      'PIL': 'pillow',
      'cv2': 'opencv-python',
      'sklearn': 'scikit-learn',
      'bs4': 'beautifulsoup4',
      'yaml': 'pyyaml',
      'dotenv': 'python-dotenv',
      'dateutil': 'python-dateutil',
    };

    // Detect imports from code
    const importRegex = /^(?:from\s+(\w+)|import\s+(\w+))/gm;
    const stdLib = new Set([
      'sys', 'os', 'io', 'json', 'math', 'random', 'time', 'datetime',
      'collections', 'itertools', 'functools', 're', 'string', 'typing',
      'abc', 'copy', 'pickle', 'csv', 'pathlib', 'tempfile', 'shutil',
      'urllib', 'http', 'html', 'xml', 'email', 'base64', 'hashlib',
      'logging', 'unittest', 'dataclasses', 'enum', 'contextlib', 'asyncio',
    ]);

    for (const file of files) {
      let match;
      while ((match = importRegex.exec(file.content)) !== null) {
        const packageName = match[1] || match[2];
        if (stdLib.has(packageName)) continue;
        if (localModules.has(packageName)) continue;
        if (['flask', 'django', 'fastapi', 'streamlit'].includes(packageName)) continue;
        
        const mappedName = packageMapping[packageName] || packageName;
        if (knownPackages.has(packageName) || knownPackages.has(mappedName)) {
          requirements.add(mappedName);
        }
      }
    }

    return Array.from(requirements).join('\n');
  }

  /**
   * Sanitize requirements.txt to remove local module names
   */
  private sanitizeRequirements(requirementsContent: string, files: PythonFile[]): string {
    const localModules = new Set<string>();
    for (const file of files) {
      const fileName = file.path.replace(/\\/g, '/');
      const baseName = fileName.split('/')[0];
      const moduleName = baseName.replace('.py', '').toLowerCase();
      if (moduleName && !moduleName.includes('.')) {
        localModules.add(moduleName);
      }
    }
    
    const problematicPackages = new Set([
      'models', 'utils', 'helpers', 'config', 'settings', 'app', 'main',
      'test', 'tests', 'data', 'lib', 'src', 'core', 'base', 'common',
      'api', 'db', 'database', 'server', 'client', 'views', 'routes',
    ]);
    
    const lines = requirementsContent.split('\n');
    const sanitizedLines: string[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        sanitizedLines.push(line);
        continue;
      }
      
      const packageMatch = trimmedLine.match(/^([a-zA-Z0-9_-]+)/);
      if (!packageMatch) {
        sanitizedLines.push(line);
        continue;
      }
      
      const packageName = packageMatch[1].toLowerCase();
      if (localModules.has(packageName) || problematicPackages.has(packageName)) {
        logger.warn(`Removing local module from requirements: ${packageName}`);
        continue;
      }
      
      sanitizedLines.push(line);
    }
    
    return sanitizedLines.join('\n');
  }

  /**
   * Start local Python sandbox process
   */
  private async startLocalSandbox(
    sandboxId: string,
    workDir: string,
    projectType: string,
    port: number,
    timeout: number
  ): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return;

    const addLog = (message: string) => {
      sandbox.logs.push(`[${new Date().toISOString()}] ${message}`);
      if (sandbox.logs.length > 100) {
        sandbox.logs = sandbox.logs.slice(-100);
      }
    };

    try {
      const isWindows = process.platform === 'win32';
      const pythonCmd = isWindows ? 'python' : 'python3';
      
      // Create virtual environment
      const venvDir = path.join(workDir, 'venv');
      addLog('Creating virtual environment...');
      await this.runCommand(pythonCmd, ['-m', 'venv', venvDir], workDir);
      addLog('Virtual environment created');
      
      const venvPython = isWindows 
        ? path.join(venvDir, 'Scripts', 'python.exe')
        : path.join(venvDir, 'bin', 'python');
      const venvPip = isWindows 
        ? path.join(venvDir, 'Scripts', 'pip.exe')
        : path.join(venvDir, 'bin', 'pip');
      
      addLog('Installing dependencies...');
      await this.runCommand(venvPip, ['install', '-r', 'requirements.txt', '--quiet'], workDir);
      addLog('Dependencies installed');

      // Get start command
      let args: string[];
      let flaskApp: string | undefined;

      switch (projectType) {
        case 'flask':
          const flaskFile = await this.findMainFile(workDir, ['app.py', 'main.py', 'server.py']);
          args = ['-m', 'flask', 'run', '--host=0.0.0.0', `--port=${port}`];
          flaskApp = flaskFile;
          break;
        case 'fastapi':
          const fastapiFile = await this.findMainFile(workDir, ['main.py', 'app.py', 'server.py']);
          const moduleName = fastapiFile.replace('.py', '');
          args = ['-m', 'uvicorn', `${moduleName}:app`, '--host=0.0.0.0', `--port=${port}`];
          break;
        case 'django':
          args = ['manage.py', 'runserver', `0.0.0.0:${port}`];
          break;
        case 'streamlit':
          const streamlitFile = await this.findMainFile(workDir, ['app.py', 'main.py']);
          args = ['-m', 'streamlit', 'run', streamlitFile, '--server.port', String(port), '--server.address', '0.0.0.0', '--server.headless', 'true'];
          break;
        default:
          const scriptFile = await this.findMainFile(workDir, ['main.py', 'app.py']);
          args = [scriptFile];
          break;
      }

      addLog(`🚀 Starting ${projectType} server on port ${port}...`);

      const proc = spawn(venvPython, args, {
        cwd: workDir,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          PORT: String(port),
          FLASK_APP: flaskApp,
          PATH: `${path.dirname(venvPython)}${path.delimiter}${process.env.PATH}`,
          VIRTUAL_ENV: venvDir,
        },
      });

      this.processes.set(sandboxId, proc);

      proc.stdout?.on('data', (data) => {
        const text = data.toString().trim();
        if (text) {
          addLog(`[stdout] ${text}`);
          if (this.isServerReady(text, projectType)) {
            sandbox.status = 'running';
            sandbox.url = `http://localhost:${port}`;
            addLog(`✅ Server ready at ${sandbox.url}`);
          }
        }
      });

      proc.stderr?.on('data', (data) => {
        const text = data.toString().trim();
        if (text) {
          addLog(`[stderr] ${text}`);
          if (this.isServerReady(text, projectType)) {
            sandbox.status = 'running';
            sandbox.url = `http://localhost:${port}`;
          }
        }
      });

      proc.on('exit', (code) => {
        addLog(`Process exited with code ${code}`);
        if (sandbox.status !== 'stopped') {
          sandbox.status = code === 0 ? 'stopped' : 'error';
        }
        this.processes.delete(sandboxId);
        this.usedPorts.delete(port);
      });

      proc.on('error', (error) => {
        addLog(`Process error: ${error.message}`);
        sandbox.status = 'error';
        sandbox.error = error.message;
      });

      // Timeout
      setTimeout(() => {
        if (sandbox.status === 'running') {
          addLog(`⏱️ Timeout reached, stopping sandbox`);
          this.stopSandbox(sandboxId);
        }
      }, timeout);

      // Wait for server to start
      const startTime = Date.now();
      while (sandbox.status === 'starting' && (Date.now() - startTime) < 30000) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (sandbox.status === 'starting') {
        sandbox.url = `http://localhost:${port}`;
        sandbox.status = 'running';
        addLog(`⚠️ Server startup timeout, but process is running. URL: ${sandbox.url}`);
      }

    } catch (error) {
      sandbox.status = 'error';
      sandbox.error = error instanceof Error ? error.message : String(error);
      addLog(`❌ Error: ${sandbox.error}`);
    }
  }

  /**
   * Find the main Python file in the project
   */
  private async findMainFile(workDir: string, candidates: string[]): Promise<string> {
    for (const candidate of candidates) {
      try {
        await fs.access(path.join(workDir, candidate));
        return candidate;
      } catch {
        // File doesn't exist
      }
    }
    const files = await fs.readdir(workDir);
    const pyFile = files.find(f => f.endsWith('.py'));
    return pyFile || 'main.py';
  }

  /**
   * Run a command and wait for completion
   */
  private runCommand(cmd: string, args: string[], cwd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const proc = spawn(cmd, args, { cwd, shell: true });
      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      proc.on('exit', (code) => {
        if (code === 0) {
          resolve(stdout);
        } else {
          reject(new Error(`Command failed: ${stderr || stdout}`));
        }
      });

      proc.on('error', reject);
      setTimeout(() => reject(new Error('Command timeout')), 120000);
    });
  }

  /**
   * Get sandbox status and logs
   */
  getSandbox(sandboxId: string): SandboxInstance | undefined {
    return this.sandboxes.get(sandboxId);
  }

  /**
   * Stop a sandbox
   */
  async stopSandbox(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return;

    logger.info(`Stopping sandbox: ${sandboxId}`);
    sandbox.status = 'stopped';

    // Stop E2B sandbox
    const e2bSandbox = this.e2bSandboxes.get(sandboxId);
    if (e2bSandbox) {
      try {
        await e2bSandbox.close();
      } catch (error) {
        logger.warn(`Error closing E2B sandbox: ${error}`);
      }
      this.e2bSandboxes.delete(sandboxId);
    }

    // Stop local process
    const proc = this.processes.get(sandboxId);
    if (proc) {
      proc.kill('SIGTERM');
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 5000);
      this.processes.delete(sandboxId);
    }

    if (sandbox.port) {
      this.usedPorts.delete(sandbox.port);
    }

    // Cleanup temp directory for local sandboxes
    if (sandbox.provider === 'local') {
      const tempDir = path.join(os.tmpdir(), 'python-sandbox', sandboxId);
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup errors
      }
    }
  }

  /**
   * Cleanup all sandboxes
   */
  async cleanupAll(): Promise<void> {
    logger.info('Cleaning up all sandboxes...');
    
    for (const sandboxId of this.sandboxes.keys()) {
      await this.stopSandbox(sandboxId);
    }
    
    this.sandboxes.clear();
    this.e2bSandboxes.clear();
    this.processes.clear();
    this.usedPorts.clear();
  }

  /**
   * Execute a Python script (one-shot, no server)
   */
  async executeScript(
    code: string,
    timeout: number = 30000
  ): Promise<{ success: boolean; output: string; error?: string }> {
    // Try E2B first
    if (this.isE2BAvailable()) {
      try {
        const e2bSandbox = await this.E2BSandboxClass.create({ timeoutMs: timeout });
        const result = await e2bSandbox.commands.run(`python -c "${code.replace(/"/g, '\\"')}"`, { timeout });
        await e2bSandbox.close();
        return {
          success: result.exitCode === 0,
          output: result.stdout,
          error: result.exitCode !== 0 ? result.stderr : undefined,
        };
      } catch (error) {
        logger.warn(`E2B script execution failed, falling back to local: ${error}`);
      }
    }

    // Fallback to local execution
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    
    return new Promise((resolve) => {
      const proc = spawn(pythonCmd, ['-c', code], {
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
      });

      let stdout = '';
      let stderr = '';

      proc.stdout?.on('data', (data) => { stdout += data.toString(); });
      proc.stderr?.on('data', (data) => { stderr += data.toString(); });

      const timer = setTimeout(() => {
        proc.kill('SIGKILL');
        resolve({ success: false, output: stdout, error: 'Execution timeout' });
      }, timeout);

      proc.on('exit', (code) => {
        clearTimeout(timer);
        resolve({
          success: code === 0,
          output: stdout,
          error: code !== 0 ? stderr : undefined,
        });
      });

      proc.on('error', (error) => {
        clearTimeout(timer);
        resolve({ success: false, output: '', error: error.message });
      });
    });
  }
}

export const pythonSandboxService = PythonSandboxService.getInstance();
export default pythonSandboxService;
