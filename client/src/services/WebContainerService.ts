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
   * Boot WebContainer (singleton instance)
   */
  async boot(): Promise<WebContainer> {
    if (this.bootedInstance) {
      return this.bootedInstance;
    }

    if (!this.isSupported()) {
      throw new Error('WebContainer is not supported in this browser');
    }

    try {
      this.bootedInstance = await WebContainer.boot();
      console.log('✅ WebContainer booted successfully');
      return this.bootedInstance;
    } catch (error) {
      console.error('❌ Failed to boot WebContainer:', error);
      throw error;
    }
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
    await this.installDependencies(webcontainer);

    // Start dev server
    const url = await this.startDevServer(webcontainer);

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
   * Install dependencies
   */
  private async installDependencies(webcontainer: WebContainer): Promise<void> {
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
   * Start dev server
   */
  private async startDevServer(webcontainer: WebContainer): Promise<string> {
    const port = this.nextPort++;
    const devProcess = await webcontainer.spawn('npm', ['run', 'dev', '--', '--port', port.toString(), '--host']);

    return new Promise((resolve, reject) => {
      devProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            const output = new TextDecoder().decode(data);
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
   */
  async writeFiles(files: GeneratedFile[]): Promise<void> {
    const webcontainer = await this.boot();
    await this.mountFiles(webcontainer, files);
    console.log(`📝 Wrote ${files.length} files to WebContainer`);
  }

  /**
   * Install dependencies with progress callback
   */
  async installDependencies(onProgress?: (message: string) => void): Promise<void> {
    const webcontainer = await this.boot();
    
    const installProcess = await webcontainer.spawn('npm', ['install']);

    return new Promise((resolve, reject) => {
      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            const message = new TextDecoder().decode(data);
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

  async startDevServer(onProgress?: (message: string) => void): Promise<string> {
    const webcontainer = await this.boot();
    const port = this.nextPort++;

    // Stop existing dev server if any
    if (this.devServerProcess) {
      await this.stopDevServer();
    }

    this.devServerProcess = await webcontainer.spawn('npm', ['run', 'dev', '--', '--port', port.toString(), '--host']);

    return new Promise((resolve, reject) => {
      this.devServerProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            const message = new TextDecoder().decode(data);
            onProgress?.(message);
            console.log('🚀 Dev server:', message);

            // Check if server is ready
            const urlMatch = message.match(/Local:\s+(https?:\/\/[^\s]+)/) || 
                           message.match(/localhost:(\d+)/);
            if (urlMatch) {
              this.devServerUrl = urlMatch[1] || `http://localhost:${port}`;
              resolve(this.devServerUrl);
            }
          },
        })
      );

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!this.devServerUrl) {
          // Fallback URL
          this.devServerUrl = `http://localhost:${port}`;
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

