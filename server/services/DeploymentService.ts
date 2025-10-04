import { promises as fs } from 'fs';
import path from 'path';
import { exec, spawn, ChildProcess } from 'child_process';
import { promisify } from 'util';
import { Logger } from '../utils/Logger';
import { GeneratedFile } from '../utils/types';
import { addTerminalOutput } from '../routes/terminal';

const execAsync = promisify(exec);

export interface DeploymentInstance {
  id: string;
  componentName: string;
  port: number;
  process: ChildProcess;
  url: string;
  status: 'starting' | 'running' | 'error' | 'stopped';
  createdAt: Date;
  workspacePath: string;
}

export class DeploymentService {
  private instances: Map<string, DeploymentInstance> = new Map();
  private logger: Logger;
  private nextPort = 3002; // Start after main app port (3001)

  constructor() {
    this.logger = new Logger(process.cwd());
    this.logger.initialize().catch(console.error);
  }

  /**
   * Deploy a generated app to a development server
   */
  async deployApp(
    componentName: string,
    files: GeneratedFile[]
  ): Promise<DeploymentInstance> {
    try {
      this.logger.info('DeploymentService', 'Starting app deployment', {
        componentName,
        fileCount: files.length,
      });

      // Create unique deployment ID
      const deploymentId = `${componentName}-${Date.now()}`;
      
      // Create workspace directory
      const workspacePath = path.join(
        process.cwd(),
        'deployments',
        deploymentId
      );
      
      await fs.mkdir(workspacePath, { recursive: true });

      // Write files to workspace
      await this.writeFilesToWorkspace(workspacePath, files);

      // Install dependencies
      await this.installDependencies(workspacePath);

      // Start development server
      const port = this.nextPort++;
      const childProcess = await this.startDevServer(workspacePath, port, componentName);

      const instance: DeploymentInstance = {
        id: deploymentId,
        componentName,
        port,
        process: childProcess,
        url: `http://localhost:${port}`,
        status: 'running',
        createdAt: new Date(),
        workspacePath,
      };

      this.instances.set(deploymentId, instance);

      this.logger.info('DeploymentService', 'App deployed successfully', {
        deploymentId,
        url: instance.url,
        port,
      });

      return instance;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('DeploymentService', 'Failed to deploy app', {
        error: errorMessage,
        componentName,
      });
      throw error;
    }
  }

  /**
   * Write files to the deployment workspace
   */
  private async writeFilesToWorkspace(
    workspacePath: string,
    files: GeneratedFile[]
  ): Promise<void> {
    for (const file of files) {
      const filePath = path.join(workspacePath, file.path);
      const dirPath = path.dirname(filePath);
      
      // Create directory if it doesn't exist
      await fs.mkdir(dirPath, { recursive: true });
      
      // Write file content
      await fs.writeFile(filePath, file.content);
    }
  }

  /**
   * Install dependencies in the workspace
   */
  private async installDependencies(workspacePath: string): Promise<void> {
    this.logger.info('DeploymentService', 'Installing dependencies...');

    try {
      const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      await execAsync(`${npmCommand} install --legacy-peer-deps`, {
        cwd: workspacePath,
        timeout: 60000, // 60 second timeout
        shell: true, // Use shell to resolve npm command
      });
      
      this.logger.info('DeploymentService', 'Dependencies installed successfully');
    } catch (error) {
      this.logger.error('DeploymentService', 'Failed to install dependencies', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      throw new Error(`Failed to install dependencies: ${error}`);
    }
  }

  /**
   * Start development server
   */
  private async startDevServer(
    workspacePath: string,
    port: number,
    componentName?: string
  ): Promise<ChildProcess> {
    this.logger.info('DeploymentService', 'Starting development server...');

    return new Promise((resolve, reject) => {
      // Use npx to ensure npm is available, or use the full path
      const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const childProcess = spawn(npmCommand, ['run', 'dev', '--', '--port', port.toString()], {
        cwd: workspacePath,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          PORT: port.toString(),
        },
        shell: true, // Use shell to resolve npm command
      });

      let resolved = false;

      // Handle process output and pipe to terminal stream
      childProcess.stdout?.on('data', (data) => {
        const output = data.toString().trim();
        console.log(`[${workspacePath}] ${output}`);
        
        // Send each line to terminal stream
        if (componentName) {
          output.split('\n').forEach((line: string) => {
            if (line.trim()) {
              addTerminalOutput(componentName, line.trim());
            }
          });
        }
        
        // Check if server is ready
        if (output.includes('Local:') || output.includes('ready') || output.includes('listening')) {
          if (!resolved) {
            resolved = true;
            resolve(childProcess);
          }
        }
      });

      childProcess.stderr?.on('data', (data) => {
        const output = data.toString().trim();
        console.error(`[${workspacePath}] ${output}`);
        
        // Send stderr to terminal stream as well
        if (componentName) {
          output.split('\n').forEach((line: string) => {
            if (line.trim()) {
              addTerminalOutput(componentName, `[stderr] ${line.trim()}`);
            }
          });
        }
      });

      childProcess.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          reject(error);
        }
      });

      childProcess.on('exit', (code) => {
        this.logger.info('DeploymentService', 'Dev server exited', { code });
        if (componentName) {
          addTerminalOutput(componentName, `Dev server exited with code ${code}`);
        }
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          resolve(childProcess); // Resolve anyway, server might be starting
        }
      }, 30000);
    });
  }

  /**
   * Get deployment instance by ID
   */
  getInstance(deploymentId: string): DeploymentInstance | undefined {
    return this.instances.get(deploymentId);
  }

  /**
   * Get deployment instance by component name
   */
  getInstanceByComponentName(componentName: string): DeploymentInstance | undefined {
    return Array.from(this.instances.values()).find(
      instance => instance.componentName === componentName
    );
  }

  /**
   * Get all deployment instances
   */
  getAllInstances(): DeploymentInstance[] {
    return Array.from(this.instances.values());
  }

  /**
   * Stop and remove a deployment instance
   */
  async stopInstance(deploymentId: string): Promise<void> {
    const instance = this.instances.get(deploymentId);
    if (!instance) {
      throw new Error(`Instance ${deploymentId} not found`);
    }

    try {
      // Kill the process
      instance.process.kill('SIGTERM');
      
      // Clean up workspace
      try {
        await fs.rm(instance.workspacePath, { recursive: true, force: true });
      } catch (error) {
        this.logger.warn('DeploymentService', 'Failed to cleanup workspace', {
          error: error instanceof Error ? error.message : 'Unknown error',
          workspacePath: instance.workspacePath,
        });
      }
      
      // Remove from tracking
      this.instances.delete(deploymentId);
      
      this.logger.info('DeploymentService', 'Instance stopped successfully', {
        deploymentId,
      });
    } catch (error) {
      this.logger.error('DeploymentService', 'Failed to stop instance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        deploymentId,
      });
      throw error;
    }
  }

  /**
   * Clean up old deployments
   */
  async cleanupOldDeployments(maxAgeHours: number = 24): Promise<void> {
    const now = new Date();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    const instancesToCleanup = Array.from(this.instances.values()).filter(
      instance => now.getTime() - instance.createdAt.getTime() > maxAge
    );

    for (const instance of instancesToCleanup) {
      try {
        await this.stopInstance(instance.id);
        this.logger.info('DeploymentService', 'Cleaned up old deployment', {
          deploymentId: instance.id,
        });
      } catch (error) {
        this.logger.error('DeploymentService', 'Failed to cleanup old deployment', {
          error: error instanceof Error ? error.message : 'Unknown error',
          deploymentId: instance.id,
        });
      }
    }
  }
}

// Export singleton instance
export const deploymentService = new DeploymentService();
