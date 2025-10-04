export interface VercelDeployment {
  deploymentId: string;
  url: string;
  status: 'ready' | 'building' | 'error';
  createdAt: string;
  vercelUrl?: string;
  previewUrl?: string;
}

export interface VercelDeploymentOptions {
  framework?: 'react' | 'next' | 'vite';
  buildCommand?: string;
  outputDirectory?: string;
}

export class VercelDeploymentService {
  private baseUrl: string;

  constructor(baseUrl: string = '/api') {
    this.baseUrl = baseUrl;
  }

  /**
   * Deploy a component to Vercel
   */
  async deployComponent(
    componentName: string,
    options: VercelDeploymentOptions = {}
  ): Promise<VercelDeployment> {
    try {
      console.log('🚀 Starting Vercel deployment...', { componentName, options });

      const response = await fetch(`${this.baseUrl}/components/${componentName}/deploy/vercel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(options),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.details || errorData.error || 'Failed to deploy to Vercel');
      }

      const result = await response.json();
      console.log('✅ Vercel deployment successful!', result.deployment);

      return result.deployment;
    } catch (error) {
      console.error('❌ Vercel deployment failed:', error);
      throw error;
    }
  }

  /**
   * Get all Vercel deployments
   */
  async getAllDeployments(): Promise<VercelDeployment[]> {
    try {
      const response = await fetch(`${this.baseUrl}/components/deployments/vercel`);

      if (!response.ok) {
        throw new Error('Failed to fetch deployments');
      }

      const result = await response.json();
      return result.deployments;
    } catch (error) {
      console.error('❌ Failed to fetch Vercel deployments:', error);
      throw error;
    }
  }

  /**
   * Delete a Vercel deployment
   */
  async deleteDeployment(deploymentId: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/components/deployments/vercel/${deploymentId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete deployment');
      }

      console.log('✅ Deployment deleted successfully');
    } catch (error) {
      console.error('❌ Failed to delete Vercel deployment:', error);
      throw error;
    }
  }

  /**
   * Get deployment status
   */
  async getDeploymentStatus(deploymentId: string): Promise<VercelDeployment | null> {
    try {
      const deployments = await this.getAllDeployments();
      return deployments.find(d => d.deploymentId === deploymentId) || null;
    } catch (error) {
      console.error('❌ Failed to get deployment status:', error);
      return null;
    }
  }
}

export const vercelDeploymentService = new VercelDeploymentService();
