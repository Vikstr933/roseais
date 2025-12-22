/**
 * WebContainer Service (Client-side)
 * 
 * Manages WebContainer instances for live preview in the browser
 * This is a browser-only service that uses @webcontainer/api
 */

import { WebContainer } from '@webcontainer/api';

export interface WebContainerInstance {
  id: string;
  webcontainer: WebContainer;
  url: string;
  status: 'starting' | 'running' | 'error' | 'stopped';
  componentName: string;
  createdAt: Date;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

class WebContainerServiceClass {
  private instances: Map<string, WebContainerInstance> = new Map();
  private bootedInstance: WebContainer | null = null;
  private nextPort = 3000;

  /**
   * Check if WebContainer is supported in this browser
   */
  isSupported(): boolean {
    // WebContainer requires SharedArrayBuffer and other modern APIs
    if (typeof window === 'undefined') return false;
    
    // Check for required APIs
    if (!('SharedArrayBuffer' in window)) {
      return false;
    }

    // Check for WebContainer API
    try {
      // @webcontainer/api should be available
      return typeof WebContainer !== 'undefined';
    } catch {
      return false;
    }
  }

  /**
   * Boot WebContainer (singleton instance) with retry logic
   */
  async boot(maxRetries: number = 3, retryDelay: number = 1000): Promise<WebContainer> {
    if (this.bootedInstance) {
      return this.bootedInstance;
    }

    // Check browser support
    if (!this.isSupported()) {
      const error = new Error('WebContainer is not supported in this browser. Required: SharedArrayBuffer and Cross-Origin Isolation headers.');
      console.error('❌ WebContainer not supported:', {
        hasSharedArrayBuffer: 'SharedArrayBuffer' in window,
        hasWebContainer: typeof WebContainer !== 'undefined',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
      });
      throw error;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 Booting WebContainer (attempt ${attempt}/${maxRetries})...`);
        this.bootedInstance = await WebContainer.boot();
        console.log('✅ WebContainer booted successfully');
        return this.bootedInstance;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ WebContainer boot attempt ${attempt} failed:`, lastError.message);
        
        // Don't retry on the last attempt
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error('❌ WebContainer boot failed after all retries');
    throw lastError || new Error('WebContainer boot failed after all retries');
  }

  /**
   * Create a new WebContainer instance for a generated app
   */
  async createInstance(
    componentName: string,
    files: GeneratedFile[]
  ): Promise<WebContainerInstance> {
    const webcontainer = await this.boot();

    // Create unique instance ID
    const instanceId = `${componentName}-${Date.now()}`;

    // Mount files to WebContainer
    await this.mountFiles(webcontainer, files);

    // Install dependencies
    await this._installDependencies(webcontainer);

    // Start dev server
    const url = await this._startDevServer(webcontainer);

    const instance: WebContainerInstance = {
      id: instanceId,
      webcontainer,
      url,
      status: 'running',
      componentName,
      createdAt: new Date(),
    };

    this.instances.set(instanceId, instance);
    return instance;
  }

  /**
   * Deploy app (alias for createInstance)
   */
  async deployApp(
    componentName: string,
    files: GeneratedFile[]
  ): Promise<WebContainerInstance> {
    return this.createInstance(componentName, files);
  }

  /**
   * Mount files to WebContainer
   */
  private async mountFiles(
    webcontainer: WebContainer,
    files: GeneratedFile[]
  ): Promise<void> {
    const fileTree: Record<string, { file: { contents: string } }> = {};

    for (const file of files) {
      const pathParts = file.path.split('/');
      let current: any = fileTree;

      // Create nested structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }

      // Add file
      const fileName = pathParts[pathParts.length - 1];
      current[fileName] = { file: { contents: file.content } };
    }

    await webcontainer.mount(fileTree);
    console.log(`📁 Mounted ${files.length} files to WebContainer`);
  }

  /**
   * Install dependencies (internal method)
   */
  private async _installDependencies(webcontainer: WebContainer): Promise<void> {
    const installProcess = await webcontainer.spawn('npm', ['install']);

    return new Promise((resolve, reject) => {
      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            // Log installation progress (optional)
            console.log('📦 Installing dependencies...', data);
          },
        })
      );

      installProcess.exit.then((code) => {
        if (code === 0) {
          console.log('✅ Dependencies installed');
          resolve();
        } else {
          console.error('❌ Failed to install dependencies');
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Start dev server (internal method)
   */
  private async _startDevServer(webcontainer: WebContainer): Promise<string> {
    const port = this.nextPort++;
    const devProcess = await webcontainer.spawn('npm', ['run', 'dev', '--', '--port', port.toString(), '--host']);

    return new Promise((resolve, reject) => {
      devProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            const output = typeof data === 'string' ? data : new TextDecoder().decode(data);
            console.log('🚀 Dev server:', output);

            // Check if server is ready
            if (output.includes('Local:') || output.includes('localhost')) {
              const url = `http://localhost:${port}`;
              resolve(url);
            }
          },
        })
      );

      // Timeout after 30 seconds
      setTimeout(() => {
        reject(new Error('Dev server startup timeout'));
      }, 30000);
    });
  }

  /**
   * Get instance by ID
   */
  getInstance(instanceId: string): WebContainerInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Stop and remove instance
   */
  async stopInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      // WebContainer doesn't have explicit stop, but we can remove from map
      this.instances.delete(instanceId);
      console.log(`🛑 Stopped instance ${instanceId}`);
    }
  }

  /**
   * Write files to WebContainer
   * Uses filesystem API for updates, mount for initial setup
   */
  async writeFiles(files: GeneratedFile[]): Promise<void> {
    const webcontainer = await this.boot();
    
    // Check if filesystem is already mounted by trying to read root directory
    let isMounted = false;
    try {
      await webcontainer.fs.readdir('/');
      isMounted = true;
    } catch {
      // Not mounted yet, use mount
      isMounted = false;
    }

    if (!isMounted) {
      // First time: mount the entire filesystem
      await this.mountFiles(webcontainer, files);
      console.log(`📝 Mounted ${files.length} files to WebContainer`);
    } else {
      // Already mounted: write files individually using filesystem API
      for (const file of files) {
        try {
          // Ensure directory exists
          const dirPath = file.path.split('/').slice(0, -1).join('/');
          if (dirPath) {
            try {
              await webcontainer.fs.mkdir(dirPath, { recursive: true });
            } catch (err) {
              // Directory might already exist, that's fine
            }
          }
          
          // Write file
          await webcontainer.fs.writeFile(file.path, file.content);
        } catch (error) {
          console.error(`Failed to write file ${file.path}:`, error);
          // Continue with other files
        }
      }
      console.log(`📝 Updated ${files.length} files in WebContainer`);
    }
  }

  /**
   * Install dependencies with progress callback
   */
  public async installDependencies(onProgress?: (message: string) => void): Promise<void> {
    const webcontainer = await this.boot();
    
    const installProcess = await webcontainer.spawn('npm', ['install']);

    return new Promise((resolve, reject) => {
      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            const message = typeof data === 'string' ? data : new TextDecoder().decode(data);
            onProgress?.(message);
            console.log('📦 npm install:', message);
          },
        })
      );

      installProcess.exit.then((code) => {
        if (code === 0) {
          console.log('✅ Dependencies installed');
          resolve();
        } else {
          console.error('❌ Failed to install dependencies');
          reject(new Error(`npm install failed with code ${code}`));
        }
      });
    });
  }

  /**
   * Start dev server with progress callback
   */
  private devServerProcess: any = null;
  private devServerUrl: string | null = null;

  public async startDevServer(onProgress?: (message: string) => void): Promise<string> {
    const webcontainer = await this.boot();
    const port = this.nextPort++;

    // Stop existing dev server if any
    if (this.devServerProcess) {
      await this.stopDevServer();
    }

    this.devServerProcess = await webcontainer.spawn('npm', ['run', 'dev', '--', '--port', port.toString(), '--host']);

    return new Promise((resolve, reject) => {
      let resolved = false;

      // Listen for WebContainer's server-ready event (gives us the actual URL)
      webcontainer.on('server-ready', (serverPort: number, url: string) => {
        if (!resolved && serverPort === port) {
          resolved = true;
          this.devServerUrl = url;
          console.log('✅ WebContainer server ready:', url);
          resolve(url);
        }
      });

      // Also listen to output for progress and fallback URL detection
      const service = this; // Capture 'this' for use in closure
      this.devServerProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            const message = typeof data === 'string' ? data : new TextDecoder().decode(data);
            onProgress?.(message);
            console.log('🚀 Dev server:', message);

            // Check if server is ready (fallback if server-ready event doesn't fire)
            if (!resolved) {
              const urlMatch = message.match(/Local:\s+(https?:\/\/[^\s]+)/) || 
                             message.match(/localhost:(\d+)/);
              if (urlMatch) {
                // For WebContainer, localhost URLs work in browser but not for backend analysis
                // Use the matched URL or construct localhost URL
                const matchedUrl = urlMatch[1] || `http://localhost:${port}`;
                service.devServerUrl = matchedUrl;
                if (!resolved) {
                  resolved = true;
                  resolve(matchedUrl);
                }
              }
            }
          },
        })
      );

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!resolved) {
          // Fallback URL - localhost works in browser iframe
          this.devServerUrl = `http://localhost:${port}`;
          resolved = true;
          resolve(this.devServerUrl);
        }
      }, 30000);
    });
  }

  /**
   * Stop dev server
   */
  async stopDevServer(): Promise<void> {
    if (this.devServerProcess) {
      try {
        this.devServerProcess.kill();
        this.devServerProcess = null;
        this.devServerUrl = null;
        console.log('🛑 Dev server stopped');
      } catch (error) {
        console.warn('Failed to stop dev server:', error);
      }
    }
  }

  /**
   * Teardown all instances
   */
  async teardown(): Promise<void> {
    // Stop dev server
    await this.stopDevServer();

    // Stop all instances
    for (const instance of this.instances.values()) {
      try {
        await instance.webcontainer.teardown();
      } catch (error) {
        console.warn('Failed to teardown instance:', error);
      }
    }
    
    // Clear all instances
    this.instances.clear();
    this.bootedInstance = null;
    console.log('🧹 WebContainer teardown complete');
  }
}

// Export singleton instance
export const webContainerService = new WebContainerServiceClass();

// Export type for convenience
export type WebContainerService = WebContainerServiceClass;

