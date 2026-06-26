import { Router } from 'express';
import { apiKeyService } from '../services/APIKeyService';
import { authenticateUser } from '../middleware/auth';
import { getTierLimits, hasPaidEntitlement } from '../services/TierLimitsService';

const router = Router();

// API Key Management Routes
/**
 * POST /api/api-keys/store
 * Store an API key for a user
 */
router.post('/store', authenticateUser, async (req, res) => {
  try {
    const user = req.user!;
    const isAdmin = user.role === 'admin' || user.role === 'superadmin';
    const tierLimits = getTierLimits(user.tier);

    if (!hasPaidEntitlement(user.tier, user.role)) {
      return res.status(402).json({
        success: false,
        error: 'Upgrade required',
        message: 'Project API keys are available on paid plans.',
        upgradeRequired: true,
        requiredTier: 'pro',
        feature: 'api_keys',
      });
    }

    const { serviceName, keyName, keyValue, keyType, description, website, projectId } =
      req.body;

    if (!serviceName || !keyName || !keyValue || !keyType) {
      return res.status(400).json({
        error: 'serviceName, keyName, keyValue, and keyType are required',
      });
    }

    // Validate projectId if provided (must be a number or null)
    const validatedProjectId = projectId !== undefined 
      ? (projectId === null ? null : parseInt(projectId))
      : null;

    if (!Number.isFinite(validatedProjectId as number) && validatedProjectId !== null) {
      return res.status(400).json({
        error: 'Invalid projectId',
        message: 'projectId must be a number or null',
      });
    }

    if (validatedProjectId === null && !isAdmin && !tierLimits.userWideApiKeys) {
      return res.status(402).json({
        success: false,
        error: 'Project-specific API keys required',
        message: 'Your plan stores API keys per project. Open a project and save the key there.',
        upgradeRequired: true,
        requiredTier: 'enterprise',
        feature: 'api_keys',
      });
    }

    console.log(
      `POST /api/api-keys/store - Storing API key for user: ${user.id}, service: ${serviceName}, projectId: ${validatedProjectId || 'user-wide'}`
    );

    const apiKey = await apiKeyService.storeAPIKey(
      user.id,
      serviceName,
      keyName,
      keyValue,
      keyType,
      description,
      website,
      validatedProjectId // Pass projectId (null = user-wide, number = project-specific)
    );

    console.log(`Successfully stored API key for user ${user.id}`);
    res.json({
      success: true,
      apiKey: {
        id: apiKey.id,
        serviceName: apiKey.serviceName,
        keyName: apiKey.keyName,
        keyType: apiKey.keyType,
        description: apiKey.description,
        website: apiKey.website,
        createdAt: apiKey.createdAt,
      },
      message: 'API key stored successfully',
    });
  } catch (error) {
    console.error('Error storing API key:', error);
    res.status(500).json({
      error: 'Failed to store API key',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/api-keys/user/:userId
 * Get all API keys for a user (without values)
 */
router.get('/user/:userId', authenticateUser, async (req, res) => {
  try {
    const { userId } = req.params;
    const authenticatedUserId = req.user?.id;

    // Security: Users can only access their own API keys
    if (userId !== authenticatedUserId) {
      console.log(`[FORBIDDEN] User ${authenticatedUserId} attempted to access keys for user ${userId}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own API keys'
      });
    }

    console.log(`GET /api/api-keys/user/${userId} - Fetching user API keys`);

    const apiKeys = await apiKeyService.getUserAPIKeys(userId);

    console.log(`Found ${apiKeys.length} API keys for user ${userId}`);
    res.json({
      success: true,
      apiKeys,
      count: apiKeys.length,
    });
  } catch (error) {
    console.error('Error fetching user API keys:', error);
    res.status(500).json({ error: 'Failed to fetch API keys' });
  }
});

/**
 * POST /api/api-keys/check-requirements
 * Check if user has required API keys for a prompt
 */
router.post('/check-requirements', authenticateUser, async (req, res) => {
  try {
    const { userId, prompt, projectId } = req.body;
    const authenticatedUserId = req.user?.id;

    if (!prompt) {
      return res.status(400).json({
        error: 'prompt is required',
      });
    }

    // Security: Users can only check their own API keys
    if (userId && userId !== authenticatedUserId) {
      console.log(`[FORBIDDEN] User ${authenticatedUserId} attempted to check keys for user ${userId}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only check your own API keys'
      });
    }

    console.log(
      `POST /api/api-keys/check-requirements - Checking requirements for user: ${authenticatedUserId}`
    );

    const requirements = apiKeyService.analyzePromptForAPIKeys(prompt);
    const validatedProjectId =
      projectId === undefined || projectId === null ? null : parseInt(projectId);

    if (requirements.length > 0 && !hasPaidEntitlement(req.user?.tier, req.user?.role)) {
      return res.json({
        success: true,
        hasAllKeys: false,
        requiresUpgrade: true,
        requiredTier: 'pro',
        feature: 'api_keys',
        message: 'This app needs external API keys. Project API keys are available on paid plans.',
        missingKeys: requirements,
        missingKeyNames: requirements.map(key => `${key.serviceName}:${key.keyName}`),
        existingKeys: [],
        requirements,
      });
    }

    const checkResult = await apiKeyService.checkRequiredAPIKeys(
      authenticatedUserId!,
      requirements,
      validatedProjectId
    );

    console.log(
      `API key check result: hasAllKeys=${checkResult.hasAllKeys}, missing=${checkResult.missingKeys.length}`
    );
    res.json({
      success: true,
      hasAllKeys: checkResult.hasAllKeys,
      requiresUpgrade: false,
      missingKeys: checkResult.missingKeys,
      missingKeyNames: checkResult.missingKeys.map(key => `${key.serviceName}:${key.keyName}`),
      existingKeys: checkResult.existingKeys,
      requirements,
    });
  } catch (error) {
    console.error('Error checking API key requirements:', error);
    res.status(500).json({ error: 'Failed to check API key requirements' });
  }
});

/**
 * GET /api/api-keys/get/:userId/:serviceName/:keyName
 * Get a specific API key value (decrypted)
 */
router.get('/get/:userId/:serviceName/:keyName', authenticateUser, async (req, res) => {
  try {
    const { userId, serviceName, keyName } = req.params;
    const authenticatedUserId = req.user?.id;

    // Security: Users can only access their own API keys
    if (userId !== authenticatedUserId) {
      console.log(`[FORBIDDEN] User ${authenticatedUserId} attempted to get key for user ${userId}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only access your own API keys'
      });
    }

    console.log(
      `GET /api/api-keys/get/${userId}/${serviceName}/${keyName} - Getting API key`
    );

    const keyValue = await apiKeyService.getAPIKey(
      userId,
      serviceName,
      keyName
    );

    if (!keyValue) {
      return res.status(404).json({
        error: 'API key not found or inactive',
      });
    }

    res.json({
      success: true,
      serviceName,
      keyName,
      hasKey: true,
      // Note: We don't return the actual key value for security
    });
  } catch (error) {
    console.error('Error getting API key:', error);
    res.status(500).json({ error: 'Failed to get API key' });
  }
});

/**
 * DELETE /api/api-keys/:userId/:keyId
 * Delete an API key
 */
router.delete('/:userId/:keyId', authenticateUser, async (req, res) => {
  try {
    const { userId, keyId } = req.params;
    const authenticatedUserId = req.user?.id;

    // Security: Users can only delete their own API keys
    if (userId !== authenticatedUserId) {
      console.log(`[FORBIDDEN] User ${authenticatedUserId} attempted to delete key for user ${userId}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete your own API keys'
      });
    }

    console.log(`DELETE /api/api-keys/${userId}/${keyId} - Deleting API key`);

    const success = await apiKeyService.deleteAPIKey(userId, keyId); // keyId is already a string from params

    if (!success) {
      return res.status(404).json({
        error: 'API key not found or access denied',
      });
    }

    res.json({
      success: true,
      message: 'API key deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

/**
 * PUT /api/api-keys/:userId/:keyId/deactivate
 * Deactivate an API key
 */
router.put('/:userId/:keyId/deactivate', authenticateUser, async (req, res) => {
  try {
    const { userId, keyId } = req.params;
    const authenticatedUserId = req.user?.id;

    // Security: Users can only deactivate their own API keys
    if (userId !== authenticatedUserId) {
      console.log(`[FORBIDDEN] User ${authenticatedUserId} attempted to deactivate key for user ${userId}`);
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only deactivate your own API keys'
      });
    }

    console.log(
      `PUT /api/api-keys/${userId}/${keyId}/deactivate - Deactivating API key`
    );

    const success = await apiKeyService.deactivateAPIKey(
      userId,
      keyId // keyId is already a string from params
    );

    if (!success) {
      return res.status(404).json({
        error: 'API key not found or access denied',
      });
    }

    res.json({
      success: true,
      message: 'API key deactivated successfully',
    });
  } catch (error) {
    console.error('Error deactivating API key:', error);
    res.status(500).json({ error: 'Failed to deactivate API key' });
  }
});

/**
 * GET /api/api-keys/common-requirements
 * Get common API key requirements for popular services
 */
router.get('/common-requirements', async (req, res) => {
  try {
    console.log(
      'GET /api/api-keys/common-requirements - Fetching common requirements'
    );

    const requirements = apiKeyService.getCommonAPIKeyRequirements();

    res.json({
      success: true,
      requirements,
    });
  } catch (error) {
    console.error('Error fetching common requirements:', error);
    res.status(500).json({ error: 'Failed to fetch common requirements' });
  }
});

export default router;
