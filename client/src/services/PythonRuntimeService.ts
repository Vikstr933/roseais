/**
 * Python Runtime Service
 * Runs Python code in the browser using Pyodide (WebAssembly)
 * 
 * Features:
 * - Execute Python scripts directly in browser
 * - Install packages via micropip
 * - Capture stdout/stderr
 * - Support for common data science packages (numpy, pandas, etc.)
 * 
 * Limitations:
 * - No Flask/Django/FastAPI server support (use server-side sandbox for that)
 * - Some packages not available in WebAssembly
 * - No filesystem persistence
 */

export interface PythonExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  executionTime: number;
}

export interface PythonPackageInfo {
  name: string;
  installed: boolean;
}

class PythonRuntimeService {
  private static instance: PythonRuntimeService;
  private pyodide: any = null;
  private isLoading = false;
  private loadingPromise: Promise<void> | null = null;
  private installedPackages: Set<string> = new Set();

  private constructor() {}

  static getInstance(): PythonRuntimeService {
    if (!PythonRuntimeService.instance) {
      PythonRuntimeService.instance = new PythonRuntimeService();
    }
    return PythonRuntimeService.instance;
  }

  /**
   * Initialize Pyodide runtime
   * Downloads ~10MB of WebAssembly on first load
   */
  async init(onProgress?: (message: string) => void): Promise<void> {
    if (this.pyodide) {
      return;
    }

    if (this.loadingPromise) {
      return this.loadingPromise;
    }

    this.loadingPromise = this._doInit(onProgress);
    return this.loadingPromise;
  }

  private async _doInit(onProgress?: (message: string) => void): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    try {
      onProgress?.('🐍 Loading Python runtime...');
      
      // Dynamic import of pyodide
      const { loadPyodide } = await import('pyodide');
      
      onProgress?.('📦 Initializing WebAssembly...');
      
      this.pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/',
        stdout: (text: string) => console.log('[Python]', text),
        stderr: (text: string) => console.error('[Python Error]', text),
      });

      // Pre-install micropip for package management
      onProgress?.('🔧 Setting up package manager...');
      await this.pyodide.loadPackage('micropip');

      onProgress?.('✅ Python runtime ready!');
      console.log('🐍 Pyodide initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Pyodide:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Check if Pyodide is ready
   */
  isReady(): boolean {
    return this.pyodide !== null;
  }

  /**
   * Run Python code and capture output
   */
  async runCode(code: string): Promise<PythonExecutionResult> {
    if (!this.pyodide) {
      await this.init();
    }

    const startTime = Date.now();

    try {
      // Setup stdout/stderr capture
      await this.pyodide.runPythonAsync(`
import sys
from io import StringIO

class OutputCapture:
    def __init__(self):
        self.stdout = StringIO()
        self.stderr = StringIO()
        self._old_stdout = sys.stdout
        self._old_stderr = sys.stderr
    
    def start(self):
        sys.stdout = self.stdout
        sys.stderr = self.stderr
    
    def stop(self):
        sys.stdout = self._old_stdout
        sys.stderr = self._old_stderr
    
    def get_output(self):
        return self.stdout.getvalue()
    
    def get_errors(self):
        return self.stderr.getvalue()

_capture = OutputCapture()
_capture.start()
`);

      // Run user code
      await this.pyodide.runPythonAsync(code);

      // Stop capture and get output
      await this.pyodide.runPythonAsync('_capture.stop()');
      const output = await this.pyodide.runPythonAsync('_capture.get_output()');
      const errors = await this.pyodide.runPythonAsync('_capture.get_errors()');

      const executionTime = Date.now() - startTime;

      return {
        success: true,
        output: output + (errors ? `\n[stderr]: ${errors}` : ''),
        executionTime,
      };
    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Try to stop capture even on error
      try {
        await this.pyodide.runPythonAsync('_capture.stop()');
      } catch {
        // Ignore cleanup errors
      }

      return {
        success: false,
        output: '',
        error: error instanceof Error ? error.message : String(error),
        executionTime,
      };
    }
  }

  /**
   * Install a Python package via micropip
   */
  async installPackage(packageName: string, onProgress?: (message: string) => void): Promise<boolean> {
    if (!this.pyodide) {
      await this.init();
    }

    if (this.installedPackages.has(packageName)) {
      onProgress?.(`📦 ${packageName} already installed`);
      return true;
    }

    try {
      onProgress?.(`📦 Installing ${packageName}...`);

      // Try to load from pyodide's built-in packages first
      const builtInPackages = ['numpy', 'pandas', 'scipy', 'matplotlib', 'scikit-learn', 'pillow'];
      
      if (builtInPackages.includes(packageName.toLowerCase())) {
        await this.pyodide.loadPackage(packageName.toLowerCase());
      } else {
        // Use micropip for other packages
        await this.pyodide.runPythonAsync(`
import micropip
await micropip.install('${packageName}')
`);
      }

      this.installedPackages.add(packageName);
      onProgress?.(`✅ ${packageName} installed successfully`);
      return true;
    } catch (error) {
      onProgress?.(`❌ Failed to install ${packageName}: ${error}`);
      return false;
    }
  }

  /**
   * Install multiple packages
   */
  async installPackages(packages: string[], onProgress?: (message: string) => void): Promise<void> {
    for (const pkg of packages) {
      await this.installPackage(pkg, onProgress);
    }
  }

  /**
   * Detect required packages from Python code
   */
  detectRequiredPackages(code: string): string[] {
    const packages: Set<string> = new Set();
    
    // Match import statements
    const importRegex = /^(?:from\s+(\w+)|import\s+(\w+))/gm;
    let match;
    
    while ((match = importRegex.exec(code)) !== null) {
      const packageName = match[1] || match[2];
      
      // Filter out standard library modules
      const stdLib = new Set([
        'sys', 'os', 'io', 'json', 'math', 'random', 'time', 'datetime',
        'collections', 'itertools', 'functools', 're', 'string', 'typing',
        'abc', 'copy', 'pickle', 'csv', 'pathlib', 'tempfile', 'shutil',
        'urllib', 'http', 'html', 'xml', 'email', 'base64', 'hashlib',
        'logging', 'unittest', 'dataclasses', 'enum', 'contextlib', 'asyncio'
      ]);
      
      if (!stdLib.has(packageName)) {
        packages.add(packageName);
      }
    }
    
    return Array.from(packages);
  }

  /**
   * Run Python code with automatic package installation
   */
  async runWithDependencies(
    code: string, 
    onProgress?: (message: string) => void
  ): Promise<PythonExecutionResult> {
    // Detect and install packages
    const requiredPackages = this.detectRequiredPackages(code);
    
    if (requiredPackages.length > 0) {
      onProgress?.(`📦 Detected packages: ${requiredPackages.join(', ')}`);
      await this.installPackages(requiredPackages, onProgress);
    }
    
    onProgress?.('🚀 Running code...');
    return this.runCode(code);
  }

  /**
   * Write a file to the virtual filesystem
   */
  async writeFile(path: string, content: string): Promise<void> {
    if (!this.pyodide) {
      await this.init();
    }

    // Escape content for Python string
    const escapedContent = content
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/\n/g, '\\n');

    await this.pyodide.runPythonAsync(`
import os
os.makedirs(os.path.dirname('${path}') or '.', exist_ok=True)
with open('${path}', 'w') as f:
    f.write('${escapedContent}')
`);
  }

  /**
   * Read a file from the virtual filesystem
   */
  async readFile(path: string): Promise<string | null> {
    if (!this.pyodide) {
      await this.init();
    }

    try {
      const content = await this.pyodide.runPythonAsync(`
with open('${path}', 'r') as f:
    f.read()
`);
      return content;
    } catch {
      return null;
    }
  }

  /**
   * Check if a package is available in Pyodide
   */
  async isPackageAvailable(packageName: string): Promise<boolean> {
    if (!this.pyodide) {
      await this.init();
    }

    try {
      await this.pyodide.runPythonAsync(`
import micropip
packages = await micropip.list()
'${packageName}' in [p.name for p in packages]
`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset the Python environment
   */
  async reset(): Promise<void> {
    // Re-initialize Pyodide
    this.pyodide = null;
    this.installedPackages.clear();
    this.loadingPromise = null;
    await this.init();
  }

  /**
   * Get list of pre-installed packages
   */
  getPreInstalledPackages(): string[] {
    return [
      'numpy',
      'pandas', 
      'scipy',
      'matplotlib',
      'scikit-learn',
      'pillow',
      'requests',
      'beautifulsoup4',
    ];
  }
}

export const pythonRuntimeService = PythonRuntimeService.getInstance();
export default pythonRuntimeService;

