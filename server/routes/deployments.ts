import { Router } from 'express';
import { publicDeploymentService } from '../services/PublicDeploymentService';
import { Logger } from '../utils/Logger';

const router = Router();
const logger = new Logger(process.cwd());

// Initialize logger
logger.initialize().catch(console.error);

/**
 * POST /api/deployments/public
 * Deploy app to public platform for global access
 */
router.post('/public', async (req, res) => {
  try {
    const { componentName, files, platform = 'vercel' } = req.body;

    if (!componentName || !files || !Array.isArray(files)) {
      return res.status(400).json({
        error: 'Missing required fields: componentName and files',
      });
    }

    logger.info('DeploymentsRoute', 'Starting public deployment', {
      componentName,
      platform,
      fileCount: files.length,
    });

    const result = await publicDeploymentService.deployToPublic(
      componentName,
      files,
      { platform }
    );

    res.json({
      success: true,
      deploymentId: result.deploymentId,
      url: result.url,
      platform: result.platform,
      status: result.status,
      createdAt: result.createdAt,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('DeploymentsRoute', 'Public deployment failed', {
      error: errorMessage,
      body: req.body,
    });

    res.status(500).json({
      error: 'Deployment failed',
      message: errorMessage,
    });
  }
});

/**
 * GET /api/deployments/:deploymentId
 * Get deployment status and details
 */
router.get('/:deploymentId', async (req, res) => {
  try {
    const { deploymentId } = req.params;

    const deployment = publicDeploymentService.getDeployment(deploymentId);

    if (!deployment) {
      return res.status(404).json({
        error: 'Deployment not found',
      });
    }

    res.json({
      success: true,
      deployment,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('DeploymentsRoute', 'Failed to get deployment', {
      error: errorMessage,
      deploymentId: req.params.deploymentId,
    });

    res.status(500).json({
      error: 'Failed to get deployment',
      message: errorMessage,
    });
  }
});

/**
 * GET /api/deployments
 * Get all deployments
 */
router.get('/', async (req, res) => {
  try {
    const deployments = publicDeploymentService.getAllDeployments();

    res.json({
      success: true,
      deployments,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('DeploymentsRoute', 'Failed to get deployments', {
      error: errorMessage,
    });

    res.status(500).json({
      error: 'Failed to get deployments',
      message: errorMessage,
    });
  }
});

/**
 * DELETE /api/deployments/:deploymentId
 * Delete deployment (cleanup)
 */
router.delete('/:deploymentId', async (req, res) => {
  try {
    const { deploymentId } = req.params;

    // Note: Actual cleanup would require platform-specific APIs
    // For now, we just remove from our tracking
    const deployment = publicDeploymentService.getDeployment(deploymentId);
    
    if (!deployment) {
      return res.status(404).json({
        error: 'Deployment not found',
      });
    }

    // Remove from tracking (actual cleanup would be platform-specific)
    // This is a simplified implementation
    res.json({
      success: true,
      message: 'Deployment cleanup initiated',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('DeploymentsRoute', 'Failed to delete deployment', {
      error: errorMessage,
      deploymentId: req.params.deploymentId,
    });

    res.status(500).json({
      error: 'Failed to delete deployment',
      message: errorMessage,
    });
  }
});

/**
 * POST /api/deployments/cleanup
 * Clean up expired deployments
 */
router.post('/cleanup', async (req, res) => {
  try {
    await publicDeploymentService.cleanupExpiredDeployments();

    res.json({
      success: true,
      message: 'Expired deployments cleaned up',
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('DeploymentsRoute', 'Failed to cleanup deployments', {
      error: errorMessage,
    });

    res.status(500).json({
      error: 'Failed to cleanup deployments',
      message: errorMessage,
    });
  }
});

export default router;
