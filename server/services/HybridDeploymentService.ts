import { deploymentService, DeploymentInstance } from './DeploymentService';
import { Logger } from '../utils/Logger';
import { GeneratedFile } from '../utils/types';

export interface DeploymentOptions {
  useWebContainer?: boolean;
  fallbackToServer?: boolean;
  publicUrl?: boolean;
}

export interface HybridDeploymentResult {
  instance: DeploymentInstance;
  deploymentType: 'webcontainer' | 'server' | 'public';
  url: string;
  isPublic: boolean;
}

export class HybridDeploymentService {
  private logger: Logger;

  constructor() {
    this.logger = new Logger(process.cwd());
    this.logger.initialize().catch(console.error);
  }

  /**
   * Deploy app with hybrid approach - WebContainer preferred, server fallback
   */
  async deployApp(
    componentName: string,
    files: GeneratedFile[],
    options: DeploymentOptions = {}
  ): Promise<HybridDeploymentResult> {
    const {
      useWebContainer = true,
      fallbackToServer = true,
      publicUrl = false
    } = options;

    this.logger.info('HybridDeploymentService', 'Starting hybrid deployment', {
      componentName,
      useWebContainer,
      fallbackToServer,
      publicUrl,
    });

    // For now, we'll use server-side deployment as the primary method
    // WebContainer deployment will be handled on the client side
    if (useWebContainer) {
      this.logger.info('HybridDeploymentService', 'WebContainer deployment requested - will be handled client-side');
      
      // Return metadata for client-side WebContainer deployment
      return {
        instance: null as any, // Will be created client-side
        deploymentType: 'webcontainer',
        url: '', // Will be set client-side
        isPublic: false, // WebContainer URLs are local to browser
      };
    }

    // Fallback to server-side deployment
    if (fallbackToServer) {
      this.logger.info('HybridDeploymentService', 'Using server-side deployment fallback');
      
      const instance = await deploymentService.deployApp(componentName, files);
      
      return {
        instance,
        deploymentType: 'server',
        url: instance.url,
        isPublic: false, // localhost URLs are not public
      };
    }

    throw new Error('No deployment method available');
  }

  /**
   * Get deployment instance by component name
   */
  getInstanceByComponentName(componentName: string): DeploymentInstance | undefined {
    return deploymentService.getInstanceByComponentName(componentName);
  }

  /**
   * Get all deployment instances
   */
  getAllInstances(): DeploymentInstance[] {
    return deploymentService.getAllInstances();
  }

  /**
   * Stop deployment instance
   */
  async stopInstance(deploymentId: string): Promise<void> {
    return deploymentService.stopInstance(deploymentId);
  }

  /**
   * Clean up old deployments
   */
  async cleanupOldDeployments(maxAgeHours: number = 24): Promise<void> {
    return deploymentService.cleanupOldDeployments(maxAgeHours);
  }

  /**
   * Check if WebContainer is supported (client-side check)
   */
  isWebContainerSupported(): boolean {
    // This will be checked on the client side
    return true; // Assume supported, actual check happens client-side
  }

  /**
   * Get deployment recommendations based on user context
   */
  getDeploymentRecommendation(userAgent?: string): DeploymentOptions {
    // Simple browser detection
    const isChrome = userAgent?.includes('Chrome') && !userAgent?.includes('Edg');
    const isSafari = userAgent?.includes('Safari') && !userAgent?.includes('Chrome');
    const isFirefox = userAgent?.includes('Firefox');

    // WebContainer support: Chrome (full), Safari 16.4+ (beta), Firefox (beta)
    const webContainerSupported = isChrome || isSafari || isFirefox;

    return {
      useWebContainer: webContainerSupported,
      fallbackToServer: true,
      publicUrl: false, // For now, we don't have public URL deployment
    };
  }
}

// Export singleton instance
export const hybridDeploymentService = new HybridDeploymentService();
