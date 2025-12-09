import { Router } from 'express';
import { productionDeploymentService } from '../services/ProductionDeploymentService';
import { authenticateUser } from '../middleware/auth';
import { z } from 'zod';

const router = Router();

// Validation schemas
const deploymentConfigSchema = z.object({
  projectName: z.string().min(1).max(50),
  repoName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9-_]+$/),
  description: z.string().optional(),
  isPrivate: z.boolean().optional().default(false),
  customDomain: z.string().optional(),
  envVars: z.record(z.string()).optional(),
  framework: z.enum(['vite', 'nextjs', 'react']),
  workspaceId: z.number().optional(), // Optional workspace ID for tracking deployments
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
  })),
});

/**
 * Deploy generated code to production (GitHub + Vercel)
 */
router.post('/deploy', authenticateUser, async (req, res) => {
  try {
    const validatedData = deploymentConfigSchema.parse(req.body);
    const userId = (req as any).user?.id || 'anonymous';

    // Check if GitHub and Vercel tokens are configured
    if (!process.env.GITHUB_TOKEN) {
      return res.status(400).json({
        error: 'GitHub integration not configured',
        message: 'Please configure GITHUB_TOKEN environment variable',
      });
    }

    if (!process.env.VERCEL_TOKEN) {
      return res.status(400).json({
        error: 'Vercel integration not configured',
        message: 'Please configure VERCEL_TOKEN environment variable',
      });
    }

    const deploymentConfig = {
      projectName: validatedData.projectName,
      repoName: validatedData.repoName,
      description: validatedData.description,
      isPrivate: validatedData.isPrivate,
      customDomain: validatedData.customDomain,
      envVars: validatedData.envVars,
      framework: validatedData.framework,
      workspaceId: validatedData.workspaceId, // Include workspaceId if provided
    };

    // Start deployment
    const result = await productionDeploymentService.deployToProduction(
      validatedData.files,
      deploymentConfig,
      userId
    );

    if (result.success) {
      res.json({
        success: true,
        deployment: result,
        message: 'Deployment initiated successfully',
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error,
        message: 'Deployment failed',
      });
    }
  } catch (error) {
    console.error('Deployment error:', error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.errors,
      });
    }

    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Get deployment status
 */
router.get('/deployment/:deploymentId/status', authenticateUser, async (req, res) => {
  try {
    const { deploymentId } = req.params;

    if (!deploymentId) {
      return res.status(400).json({
        error: 'Missing deployment ID',
      });
    }

    const status = await productionDeploymentService.getDeploymentStatus(deploymentId);

    res.json({
      deploymentId,
      ...status,
    });
  } catch (error) {
    console.error('Error fetching deployment status:', error);
    res.status(500).json({
      error: 'Failed to fetch deployment status',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * List user deployments
 */
router.get('/deployments', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id || 'anonymous';
    const deployments = await productionDeploymentService.listUserDeployments(userId);

    res.json({
      deployments,
      total: deployments.length,
    });
  } catch (error) {
    console.error('Error fetching deployments:', error);
    res.status(500).json({
      error: 'Failed to fetch deployments',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Check deployment configuration
 */
router.get('/deployment/config', authenticateUser, async (req, res) => {
  try {
    const config = {
      githubConfigured: !!process.env.GITHUB_TOKEN,
      vercelConfigured: !!process.env.VERCEL_TOKEN,
      supportedFrameworks: ['vite', 'nextjs', 'react'],
      features: {
        githubRepo: !!process.env.GITHUB_TOKEN,
        vercelDeployment: !!process.env.VERCEL_TOKEN,
        customDomains: !!process.env.VERCEL_TOKEN,
        environmentVariables: true,
      },
    };

    res.json(config);
  } catch (error) {
    console.error('Error fetching deployment config:', error);
    res.status(500).json({
      error: 'Failed to fetch deployment configuration',
    });
  }
});

export default router;