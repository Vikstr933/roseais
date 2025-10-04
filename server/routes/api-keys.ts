import { Router } from 'express';
import { userService, apiKeyService } from '../services/APIKeyService';

const router = Router();

// API Key Management Routes
/**
 * POST /api/api-keys/store
 * Store an API key for a user
 */
router.post('/store', async (req, res) => {
  try {
    const sessionToken = req.headers.authorization?.replace('Bearer ', '');
    if (!sessionToken) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const user = await userService.getUserFromSession(sessionToken);
    if (!user) {
      return res.status(401).json({ error: 'Invalid session' });
    }

    const { serviceName, keyName, keyValue, keyType, description, website } =
      req.body;

    if (!serviceName || !keyName || !keyValue || !keyType) {
      return res.status(400).json({
        error: 'serviceName, keyName, keyValue, and keyType are required',
      });
    }

    console.log(
      `POST /api/api-keys/store - Storing API key for user: ${user.id}, service: ${serviceName}`
    );

    const apiKey = await apiKeyService.storeAPIKey(
      user.id,
      serviceName,
      keyName,
      keyValue,
      keyType,
      description,
      website
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
router.get('/user/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

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
router.post('/check-requirements', async (req, res) => {
  try {
    const { userId, prompt } = req.body;

    if (!userId || !prompt) {
      return res.status(400).json({
        error: 'userId and prompt are required',
      });
    }

    console.log(
      `POST /api/api-keys/check-requirements - Checking requirements for user: ${userId}`
    );

    const requirements = apiKeyService.analyzePromptForAPIKeys(prompt);
    const checkResult = await apiKeyService.checkRequiredAPIKeys(
      userId,
      requirements
    );

    console.log(
      `API key check result: hasAllKeys=${checkResult.hasAllKeys}, missing=${checkResult.missingKeys.length}`
    );
    res.json({
      success: true,
      hasAllKeys: checkResult.hasAllKeys,
      missingKeys: checkResult.missingKeys,
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
router.get('/get/:userId/:serviceName/:keyName', async (req, res) => {
  try {
    const { userId, serviceName, keyName } = req.params;

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
router.delete('/:userId/:keyId', async (req, res) => {
  try {
    const { userId, keyId } = req.params;

    console.log(`DELETE /api/api-keys/${userId}/${keyId} - Deleting API key`);

    const success = await apiKeyService.deleteAPIKey(userId, parseInt(keyId));

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
router.put('/:userId/:keyId/deactivate', async (req, res) => {
  try {
    const { userId, keyId } = req.params;

    console.log(
      `PUT /api/api-keys/${userId}/${keyId}/deactivate - Deactivating API key`
    );

    const success = await apiKeyService.deactivateAPIKey(
      userId,
      parseInt(keyId)
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
