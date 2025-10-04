import { WebContainer } from '@webcontainer/api';

/**
 * WebContainer Service
 * Manages browser-based Node.js runtime using StackBlitz WebContainer API
 * 
 * Key Features:
 * - Run Node.js directly in browser (no server needed)
 * - npm install packages in browser
 * - Run Vite dev server for instant HMR
 * - Virtual filesystem for generated code
 */

export class WebContainerService {
  private static instance: WebContainerService;
  private webcontainer: WebContainer | null = null;
  private isBooting = false;
  private devServerUrl: string | null = null;
  private devServerProcess: any = null;

  private constructor() {}

  static getInstance(): WebContainerService {
    if (!WebContainerService.instance) {
      WebContainerService.instance = new WebContainerService();
    }
    return WebContainerService.instance;
  }

  /**
   * Initialize WebContainer instance
   * This boots the Node.js runtime in the browser
   */
  async boot(): Promise<WebContainer> {
    if (this.webcontainer) {
      return this.webcontainer;
    }

    if (this.isBooting) {
      // Wait for existing boot to complete
      while (this.isBooting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.webcontainer) {
        return this.webcontainer;
      }
    }

    try {
      this.isBooting = true;
      console.log('🚀 Booting WebContainer...');
      
      this.webcontainer = await WebContainer.boot();
      
      console.log('✅ WebContainer booted successfully');
      return this.webcontainer;
    } catch (error) {
      console.error('❌ Failed to boot WebContainer:', error);
      throw error;
    } finally {
      this.isBooting = false;
    }
  }

  /**
   * Write files to the virtual filesystem
   */
  async writeFiles(files: Array<{ path: string; content: string }>): Promise<void> {
    const container = await this.boot();

    console.log(`📝 Writing ${files.length} files to WebContainer...`);

    for (const file of files) {
      const pathParts = file.path.split('/');
      const filename = pathParts.pop()!;
      const directory = pathParts.join('/') || '.';

      // Create directory if needed
      if (directory !== '.') {
        await container.fs.mkdir(directory, { recursive: true });
      }

      // Write file
      await container.fs.writeFile(file.path, file.content);
      console.log(`  ✓ ${file.path}`);
    }

    console.log('✅ All files written');
  }

  /**
   * Install npm dependencies
   */
  async installDependencies(onProgress?: (message: string) => void): Promise<void> {
    const container = await this.boot();

    console.log('📦 Installing npm dependencies...');
    onProgress?.('Installing npm dependencies...');

    const installProcess = await container.spawn('npm', ['install']);

    let errorOutput = '';

    // Stream stdout and stderr
    installProcess.output.pipeTo(
      new WritableStream({
        write(data) {
          const text = data.trim();
          if (text) {
            console.log(`  ${text}`);
            onProgress?.(text);
            if (text.includes('ERR') || text.includes('error')) {
              errorOutput += text + '\n';
            }
          }
        },
      })
    );

    const exitCode = await installProcess.exit;

    if (exitCode !== 0) {
      const errorMsg = errorOutput || 'npm install failed (check console for details)';
      console.error('❌ npm install error:', errorMsg);
      throw new Error(`npm install failed: ${errorMsg.slice(0, 200)}`);
    }

    console.log('✅ Dependencies installed');
    onProgress?.('✅ Dependencies installed');
  }

  /**
   * Start Vite dev server
   */
  async startDevServer(onProgress?: (message: string) => void): Promise<string> {
    const container = await this.boot();

    // Stop existing server if running
    if (this.devServerProcess) {
      console.log('🛑 Stopping existing dev server...');
      this.devServerProcess.kill();
      this.devServerProcess = null;
      this.devServerUrl = null;
    }

    console.log('🚀 Starting Vite dev server...');
    onProgress?.('Starting dev server...');

    // Use WebContainer's server-ready event (more reliable than parsing output)
    const serverReadyPromise = new Promise<string>((resolve) => {
      container.on('server-ready', (port, url) => {
        console.log(`🌐 Server listening on port ${port}: ${url}`);
        this.devServerUrl = url;
        onProgress?.(`✅ Dev server ready: ${url}`);
        resolve(url);
      });
    });

    // Start dev server
    this.devServerProcess = await container.spawn('npm', ['run', 'dev']);

    // Stream output for debugging
    this.devServerProcess.output.pipeTo(
      new WritableStream({
        write: (data) => {
          const text = data.trim();
          if (text) {
            console.log(`  [vite] ${text}`);
            onProgress?.(text);
          }
        },
      })
    );

    // Wait for server to be ready (with timeout)
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Dev server failed to start within 60 seconds')), 60000);
    });

    this.devServerUrl = await Promise.race([serverReadyPromise, timeoutPromise]);
    return this.devServerUrl;
  }

  /**
   * Get current dev server URL
   */
  getDevServerUrl(): string | null {
    return this.devServerUrl;
  }

  /**
   * Stop dev server
   */
  async stopDevServer(): Promise<void> {
    if (this.devServerProcess) {
      console.log('🛑 Stopping dev server...');
      this.devServerProcess.kill();
      this.devServerProcess = null;
      this.devServerUrl = null;
      console.log('✅ Dev server stopped');
    }
  }

  /**
   * Read a file from the virtual filesystem
   */
  async readFile(path: string): Promise<string> {
    const container = await this.boot();
    const content = await container.fs.readFile(path, 'utf-8');
    return content;
  }

  /**
   * List files in a directory
   */
  async listFiles(path: string = '.'): Promise<string[]> {
    const container = await this.boot();
    const files = await container.fs.readdir(path);
    return files;
  }

  /**
   * Check if WebContainer is supported
   */
  static isSupported(): boolean {
    try {
      // WebContainer requires SharedArrayBuffer and cross-origin isolation
      return typeof SharedArrayBuffer !== 'undefined';
    } catch {
      return false;
    }
  }

  /**
   * Get WebContainer instance (if booted)
   */
  getContainer(): WebContainer | null {
    return this.webcontainer;
  }

  /**
   * Teardown WebContainer
   */
  async teardown(): Promise<void> {
    if (this.devServerProcess) {
      await this.stopDevServer();
    }
    
    if (this.webcontainer) {
      console.log('🧹 Tearing down WebContainer...');
      await this.webcontainer.teardown();
      this.webcontainer = null;
      console.log('✅ WebContainer torn down');
    }
  }
}

// Export singleton instance
export const webContainerService = WebContainerService.getInstance();

// Check support on module load
if (!WebContainerService.isSupported()) {
  console.warn('⚠️ WebContainer is not supported in this browser');
  console.warn('   Required: SharedArrayBuffer and cross-origin isolation');
  console.warn('   See: https://webcontainers.io/guides/browser-support');
}
