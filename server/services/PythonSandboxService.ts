/**
 * Python Sandbox Service
 * Runs Python web applications (Flask, Django, FastAPI) in isolated sandboxes
 * 
 * Options:
 * 1. E2B Cloud Sandbox (recommended for production)
 * 2. Docker containers (self-hosted)
 * 3. Local Python execution (development only)
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
}

export interface SandboxOptions {
  timeout?: number; // Max execution time in ms (default: 5 minutes)
  memory?: number; // Max memory in MB (default: 512)
  port?: number; // Port to run on (default: auto-assign)
}

class PythonSandboxService {
  private static instance: PythonSandboxService;
  private sandboxes: Map<string, SandboxInstance> = new Map();
  private processes: Map<string, ChildProcess> = new Map();
  private basePort = 8100;
  private usedPorts: Set<number> = new Set();

  private constructor() {
    // Cleanup on process exit
    process.on('exit', () => this.cleanupAll());
    process.on('SIGINT', () => this.cleanupAll());
    process.on('SIGTERM', () => this.cleanupAll());
  }

  static getInstance(): PythonSandboxService {
    if (!PythonSandboxService.instance) {
      PythonSandboxService.instance = new PythonSandboxService();
    }
    return PythonSandboxService.instance;
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
   * Get next available port
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
   */
  async createSandbox(
    files: PythonFile[],
    userId: string,
    options: SandboxOptions = {}
  ): Promise<SandboxInstance> {
    const sandboxId = `py-${uuidv4().slice(0, 8)}`;
    const projectType = this.detectProjectType(files);
    const port = options.port || this.getNextPort();
    const timeout = options.timeout || 5 * 60 * 1000; // 5 minutes default

    logger.info(`Creating Python sandbox: ${sandboxId}, type: ${projectType}, port: ${port}`);

    const sandbox: SandboxInstance = {
      id: sandboxId,
      status: 'starting',
      port,
      logs: [],
      createdAt: new Date(),
      projectType,
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

      // Generate requirements.txt if not provided
      const hasRequirements = files.some(f => f.path === 'requirements.txt');
      if (!hasRequirements) {
        const requirements = this.generateRequirements(files, projectType);
        await fs.writeFile(path.join(tempDir, 'requirements.txt'), requirements, 'utf-8');
      }

      // Start the sandbox
      await this.startSandbox(sandboxId, tempDir, projectType, port, timeout);

      return this.sandboxes.get(sandboxId)!;
    } catch (error) {
      sandbox.status = 'error';
      sandbox.error = error instanceof Error ? error.message : String(error);
      logger.error(`Failed to create sandbox ${sandboxId}: ${sandbox.error}`);
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

    // Detect imports from code
    const importRegex = /^(?:from\s+(\w+)|import\s+(\w+))/gm;
    const stdLib = new Set([
      'sys', 'os', 'io', 'json', 'math', 'random', 'time', 'datetime',
      'collections', 'itertools', 'functools', 're', 'string', 'typing',
      'abc', 'copy', 'pickle', 'csv', 'pathlib', 'tempfile', 'shutil',
      'urllib', 'http', 'html', 'xml', 'email', 'base64', 'hashlib',
      'logging', 'unittest', 'dataclasses', 'enum', 'contextlib', 'asyncio'
    ]);

    const packageMapping: Record<string, string> = {
      'PIL': 'pillow',
      'cv2': 'opencv-python',
      'sklearn': 'scikit-learn',
      'bs4': 'beautifulsoup4',
    };

    for (const file of files) {
      let match;
      while ((match = importRegex.exec(file.content)) !== null) {
        const packageName = match[1] || match[2];
        if (!stdLib.has(packageName) && packageName !== projectType) {
          const mappedName = packageMapping[packageName] || packageName;
          requirements.add(mappedName);
        }
      }
    }

    return Array.from(requirements).join('\n');
  }

  /**
   * Start the Python sandbox process
   */
  private async startSandbox(
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
      // Keep only last 100 logs
      if (sandbox.logs.length > 100) {
        sandbox.logs = sandbox.logs.slice(-100);
      }
    };

    try {
      // Check if Python is available
      const isWindows = process.platform === 'win32';
      const pythonCmd = isWindows ? 'python' : 'python3';
      
      // Create virtual environment (required on modern Debian/Ubuntu systems - PEP 668)
      const venvDir = path.join(workDir, 'venv');
      addLog('Creating virtual environment...');
      await this.runCommand(pythonCmd, ['-m', 'venv', venvDir], workDir);
      addLog('Virtual environment created');
      
      // Get paths to venv python and pip
      const venvPython = isWindows 
        ? path.join(venvDir, 'Scripts', 'python.exe')
        : path.join(venvDir, 'bin', 'python');
      const venvPip = isWindows 
        ? path.join(venvDir, 'Scripts', 'pip.exe')
        : path.join(venvDir, 'bin', 'pip');
      
      // Install dependencies using venv pip
      addLog('Installing dependencies...');
      await this.runCommand(venvPip, ['install', '-r', 'requirements.txt', '--quiet'], workDir);
      addLog('Dependencies installed');

      // Start the appropriate server
      let args: string[];
      let startupMessage: string;
      let flaskApp: string | undefined;

      switch (projectType) {
        case 'flask':
          // Check for app.py or main.py
          const flaskFile = await this.findMainFile(workDir, ['app.py', 'main.py', 'server.py']);
          args = ['-m', 'flask', 'run', '--host=0.0.0.0', `--port=${port}`];
          startupMessage = `Flask server starting on port ${port}`;
          // Set FLASK_APP environment variable
          flaskApp = flaskFile;
          break;

        case 'fastapi':
          const fastapiFile = await this.findMainFile(workDir, ['main.py', 'app.py', 'server.py']);
          const moduleName = fastapiFile.replace('.py', '').replace('/', '.');
          args = ['-m', 'uvicorn', `${moduleName}:app`, '--host=0.0.0.0', `--port=${port}`, '--reload'];
          startupMessage = `FastAPI server starting on port ${port}`;
          break;

        case 'django':
          args = ['manage.py', 'runserver', `0.0.0.0:${port}`];
          startupMessage = `Django server starting on port ${port}`;
          break;

        case 'streamlit':
          const streamlitFile = await this.findMainFile(workDir, ['app.py', 'main.py', 'streamlit_app.py']);
          args = ['-m', 'streamlit', 'run', streamlitFile, '--server.port', String(port), '--server.address', '0.0.0.0', '--server.headless', 'true'];
          startupMessage = `Streamlit server starting on port ${port}`;
          break;

        default:
          // Simple script - just run it
          const scriptFile = await this.findMainFile(workDir, ['main.py', 'app.py', 'script.py']);
          args = [scriptFile];
          startupMessage = `Running Python script: ${scriptFile}`;
          break;
      }

      addLog(startupMessage);

      // Spawn the process using venv Python (not system Python)
      const proc = spawn(venvPython, args, {
        cwd: workDir,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1',
          PORT: String(port),
          FLASK_APP: flaskApp, // Set FLASK_APP if Flask project
          // Ensure venv is in PATH
          PATH: `${path.dirname(venvPython)}${path.delimiter}${process.env.PATH}`,
          // Set VIRTUAL_ENV for proper venv activation
          VIRTUAL_ENV: venvDir,
        },
      });

      this.processes.set(sandboxId, proc);

      // Handle stdout
      proc.stdout?.on('data', (data) => {
        const text = data.toString().trim();
        if (text) {
          addLog(`[stdout] ${text}`);
          
          // Detect when server is ready
          if (text.includes('Running on') || 
              text.includes('Uvicorn running') || 
              text.includes('Starting development server') ||
              text.includes('You can now view your Streamlit app')) {
            sandbox.status = 'running';
            sandbox.url = `http://localhost:${port}`;
            addLog(`✅ Server ready at ${sandbox.url}`);
          }
        }
      });

      // Handle stderr
      proc.stderr?.on('data', (data) => {
        const text = data.toString().trim();
        if (text) {
          addLog(`[stderr] ${text}`);
          
          // Some frameworks output startup info to stderr
          if (text.includes('Running on') || text.includes('Uvicorn running')) {
            sandbox.status = 'running';
            sandbox.url = `http://localhost:${port}`;
          }
        }
      });

      // Handle process exit
      proc.on('exit', (code) => {
        addLog(`Process exited with code ${code}`);
        if (sandbox.status !== 'stopped') {
          sandbox.status = code === 0 ? 'stopped' : 'error';
        }
        this.processes.delete(sandboxId);
        this.usedPorts.delete(port);
      });

      // Handle errors
      proc.on('error', (error) => {
        addLog(`Process error: ${error.message}`);
        sandbox.status = 'error';
        sandbox.error = error.message;
      });

      // Set timeout
      setTimeout(() => {
        if (sandbox.status === 'running') {
          addLog(`⏱️ Timeout reached (${timeout / 1000}s), stopping sandbox`);
          this.stopSandbox(sandboxId);
        }
      }, timeout);

      // Wait for server to start (max 30 seconds)
      const startTimeout = 30000;
      const startTime = Date.now();
      
      while (sandbox.status === 'starting' && (Date.now() - startTime) < startTimeout) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      if (sandbox.status === 'starting') {
        // Server didn't start in time, but might still be initializing
        sandbox.url = `http://localhost:${port}`;
        sandbox.status = 'running';
        addLog(`⚠️ Server startup timeout, but process is still running. URL: ${sandbox.url}`);
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
        // File doesn't exist, try next
      }
    }
    
    // Fallback: find any .py file
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

      // Timeout after 2 minutes for pip install
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
   * Get all active sandboxes for a user
   */
  getUserSandboxes(userId: string): SandboxInstance[] {
    return Array.from(this.sandboxes.values())
      .filter(s => s.status === 'running' || s.status === 'starting');
  }

  /**
   * Stop a sandbox
   */
  async stopSandbox(sandboxId: string): Promise<void> {
    const sandbox = this.sandboxes.get(sandboxId);
    if (!sandbox) return;

    logger.info(`Stopping sandbox: ${sandboxId}`);
    sandbox.status = 'stopped';

    // Kill the process
    const proc = this.processes.get(sandboxId);
    if (proc) {
      proc.kill('SIGTERM');
      
      // Force kill after 5 seconds
      setTimeout(() => {
        if (!proc.killed) {
          proc.kill('SIGKILL');
        }
      }, 5000);
    }

    // Release port
    if (sandbox.port) {
      this.usedPorts.delete(sandbox.port);
    }

    // Cleanup temp directory
    const tempDir = path.join(os.tmpdir(), 'python-sandbox', sandboxId);
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
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

