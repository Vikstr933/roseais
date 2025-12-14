// WebContainer API is browser-only, we'll use a different approach for server-side
// NOTE: This code will not work on server-side - WebContainer requires browser APIs
// Importing for TypeScript types only - actual usage should be in browser/client code
import { WebContainer } from '@webcontainer/api';
import { Logger } from '../utils/Logger';
import { GeneratedFile } from '../utils/types';

export interface WebContainerInstance {
  id: string;
  webcontainer: WebContainer;
  url: string;
  status: 'starting' | 'running' | 'error' | 'stopped';
  componentName: string;
  createdAt: Date;
}

export class WebContainerService {
  private instances: Map<string, WebContainerInstance> = new Map();
  private logger: Logger;
  private nextPort = 3000;

  constructor() {
    this.logger = new Logger(process.cwd());
    this.logger.initialize().catch(console.error);
  }

  /**
   * Create a new WebContainer instance for a generated app
   */
  async createInstance(
    componentName: string,
    files: GeneratedFile[]
  ): Promise<WebContainerInstance> {
    try {
      this.logger.info('WebContainerService', 'Creating new WebContainer instance', {
        componentName,
        fileCount: files.length,
      });

      // Create WebContainer instance
      const webcontainer = await WebContainer.boot();
      
      // Create unique instance ID
      const instanceId = `${componentName}-${Date.now()}`;
      
      // Mount files to WebContainer
      await this.mountFiles(webcontainer, files);
      
      // Install dependencies
      await this.installDependencies(webcontainer);
      
      // Start dev server
      const url = await this.startDevServer(webcontainer, instanceId);
      
      const instance: WebContainerInstance = {
        id: instanceId,
        webcontainer,
        url,
        status: 'running',
        componentName,
        createdAt: new Date(),
      };

      this.instances.set(instanceId, instance);
      
      this.logger.info('WebContainerService', 'WebContainer instance created successfully', {
        instanceId,
        url,
      });

      return instance;
    } catch (error) {
      this.logger.error('WebContainerService', 'Failed to create WebContainer instance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        componentName,
      });
      throw error;
    }
  }

  /**
   * Mount files to the WebContainer filesystem
   */
  private async mountFiles(webcontainer: WebContainer, files: GeneratedFile[]): Promise<void> {
    const fileSystem: Record<string, any> = {};

    // Convert files to WebContainer filesystem format
    for (const file of files) {
      const pathParts = file.path.split('/');
      let current = fileSystem;

      // Create nested directory structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) {
          current[part] = {};
        }
        current = current[part];
      }

      // Add file content
      const fileName = pathParts[pathParts.length - 1];
      current[fileName] = {
        file: {
          contents: file.content,
        },
      };
    }

    // Mount the filesystem
    await webcontainer.mount(fileSystem);
  }

  /**
   * Install dependencies in the WebContainer
   */
  private async installDependencies(webcontainer: WebContainer): Promise<void> {
    this.logger.info('WebContainerService', 'Installing dependencies...');

    const installProcess = await webcontainer.spawn('npm', ['install']);
    
    return new Promise((resolve, reject) => {
      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            console.log('npm install:', data);
          },
        })
      );

      installProcess.exit.then((exitCode: number) => {
        if (exitCode === 0) {
          this.logger.info('WebContainerService', 'Dependencies installed successfully');
          resolve();
        } else {
          this.logger.error('WebContainerService', 'Failed to install dependencies', { exitCode });
          reject(new Error(`npm install failed with exit code ${exitCode}`));
        }
      });
    });
  }

  /**
   * Start the development server in WebContainer
   */
  private async startDevServer(webcontainer: WebContainer, instanceId: string): Promise<string> {
    this.logger.info('WebContainerService', 'Starting dev server...');

    const devProcess = await webcontainer.spawn('npm', ['run', 'dev']);
    
    // Wait for server to start and get the URL
    return new Promise((resolve, reject) => {
      let serverUrl = '';
      
      devProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            const output = data.toString();
            console.log('Dev server:', output);
            
            // Look for the server URL in the output
            const urlMatch = output.match(/Local:\s+(https?:\/\/[^\s]+)/);
            if (urlMatch) {
              serverUrl = urlMatch[1];
            }
          },
        })
      );

      // Wait a bit for the server to start
      setTimeout(() => {
        if (serverUrl) {
          resolve(serverUrl);
        } else {
          // Fallback URL if we can't parse it from output
          resolve(`https://${instanceId}.webcontainer.app`);
        }
      }, 3000);
    });
  }

  /**
   * Get an existing WebContainer instance
   */
  getInstance(instanceId: string): WebContainerInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Get all running instances
   */
  getAllInstances(): WebContainerInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Stop and remove a WebContainer instance
   */
  async destroyInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      throw new Error(`Instance ${instanceId} not found`);
    }

    try {
      // Stop the WebContainer
      await instance.webcontainer.teardown();
      
      // Remove from our tracking
      this.instances.delete(instanceId);
      
      this.logger.info('WebContainerService', 'WebContainer instance destroyed', { instanceId });
    } catch (error) {
      this.logger.error('WebContainerService', 'Failed to destroy WebContainer instance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        instanceId,
      });
      throw error;
    }
  }

  /**
   * Clean up old instances (call this periodically)
   */
  async cleanupOldInstances(maxAgeHours: number = 24): Promise<void> {
    const now = new Date();
    const maxAge = maxAgeHours * 60 * 60 * 1000; // Convert to milliseconds

    const instancesToCleanup = Array.from(this.instances.values()).filter(
      instance => now.getTime() - instance.createdAt.getTime() > maxAge
    );

    for (const instance of instancesToCleanup) {
      try {
        await this.destroyInstance(instance.id);
        this.logger.info('WebContainerService', 'Cleaned up old instance', { instanceId: instance.id });
      } catch (error) {
        this.logger.error('WebContainerService', 'Failed to cleanup old instance', {
          error: error instanceof Error ? error.message : 'Unknown error',
          instanceId: instance.id,
        });
      }
    }
  }

  /**
   * Get instance by component name
   */
  getInstanceByComponentName(componentName: string): WebContainerInstance | undefined {
    return Array.from(this.instances.values()).find(
      instance => instance.componentName === componentName
    );
  }

  /**
   * Get all instances for a specific component (in case there are multiple)
   */
  getInstancesByComponentName(componentName: string): WebContainerInstance[] {
    return Array.from(this.instances.values()).filter(
      instance => instance.componentName === componentName
    );
  }

  /**
   * Cleanup test instances (for development/testing)
   */
  async cleanupTestInstances(): Promise<void> {
    const testInstances = Array.from(this.instances.values()).filter(
      instance => instance.componentName.includes('test') || instance.id.includes('test')
    );

    for (const instance of testInstances) {
      try {
        await this.destroyInstance(instance.id);
        this.logger.info('WebContainerService', 'Cleaned up test instance', { instanceId: instance.id });
      } catch (error) {
        this.logger.error('WebContainerService', 'Failed to cleanup test instance', {
          error: error instanceof Error ? error.message : 'Unknown error',
          instanceId: instance.id,
        });
      }
    }
  }
}

// Export singleton instance
export const webContainerService = new WebContainerService();
