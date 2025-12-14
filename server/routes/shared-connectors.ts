import { Router } from 'express';
import { db } from '../../db';
import { apiKeys, users, workspaces } from '../../db/schema-pg';
import { eq, and, or, isNull } from 'drizzle-orm';
import { authenticateUser } from '../middleware/auth';
import { getAllPreBuiltConnectors, getPreBuiltConnector } from '../data/pre-built-connectors';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/shared-connectors
 * Get all shared connectors for the current user
 * 
 * SECURITY NOTE: "Shared" means "available across all user's projects", NOT "shared between users".
 * Each user has their own connectors (Stripe, Vercel, GitHub, etc.) that they configure.
 * These connectors are used when generating applications that need API keys (e.g., Stripe for payments).
 */
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // SECURITY: Shared connectors are per-user, not global
    // Each user can configure their own connectors (Stripe, Vercel, GitHub, etc.)
    // for use in their generated applications
    const sharedConnectors = await db
      .select({
        id: apiKeys.id,
        serviceName: apiKeys.serviceName,
        name: apiKeys.name,
        keyType: apiKeys.keyType,
        isActive: apiKeys.isActive,
        configuredBy: apiKeys.configuredBy,
        createdAt: apiKeys.createdAt,
        lastUsed: apiKeys.lastUsed,
        metadata: apiKeys.metadata,
        configuredByUser: {
          id: users.id,
          username: users.username,
          displayName: users.displayName,
        },
      })
      .from(apiKeys)
      .leftJoin(users, eq(apiKeys.configuredBy, users.id))
      .where(
        and(
          eq(apiKeys.userId, userId), // SECURITY: Only show connectors for this user
          eq(apiKeys.isShared, true),
          eq(apiKeys.isActive, true),
          isNull(apiKeys.projectId) // User-wide connectors only (not project-specific)
        )
      )
      .orderBy(apiKeys.createdAt);

    // Get pre-built connector definitions
    const preBuiltConnectors = getAllPreBuiltConnectors();
    
    res.json({
      success: true,
      connectors: sharedConnectors.map(connector => {
        const preBuilt = preBuiltConnectors.find(p => p.id === connector.serviceName?.toLowerCase());
        const connectorMetadata = (connector.metadata as any) || {};
        return {
          id: connector.id,
          serviceName: connector.serviceName || 'unknown',
          name: connector.name,
          keyType: connector.keyType || 'api_key',
          isActive: connector.isActive,
          configuredBy: connector.configuredByUser?.displayName || 'Unknown',
          createdAt: connector.createdAt,
          lastUsed: connector.lastUsed,
          envVariables: connectorMetadata.envVariables || {}, // Env variables from metadata
          // Include pre-built connector metadata if available
          metadata: preBuilt ? {
            icon: preBuilt.icon,
            description: preBuilt.description,
            category: preBuilt.category,
            apiKeys: preBuilt.apiKeys,
            envVariables: preBuilt.envVariables,
            documentationUrl: preBuilt.documentationUrl,
          } : undefined,
        };
      }),
      // Also include available pre-built connectors that aren't configured yet
      availableConnectors: preBuiltConnectors
        .filter(p => p.isShared)
        .map(connector => ({
          id: connector.id,
          name: connector.name,
          description: connector.description,
          icon: connector.icon,
          category: connector.category,
          apiKeys: connector.apiKeys,
          envVariables: connector.envVariables,
          documentationUrl: connector.documentationUrl,
          isConfigured: sharedConnectors.some(c => c.serviceName?.toLowerCase() === connector.id),
        })),
    });
  } catch (error: any) {
    console.error('Error fetching shared connectors:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch shared connectors' });
  }
});

/**
 * POST /api/shared-connectors
 * Create a new shared connector for the current user
 * 
 * SECURITY: Each user creates their own connectors. They're not shared between users.
 * "Shared" means the connector is available across all of the user's projects.
 */
router.post('/', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { serviceName, keyValue, keyType, description, envVariables } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!serviceName || !keyValue) {
      return res.status(400).json({
        success: false,
        error: 'serviceName and keyValue are required',
      });
    }

    // Validate against pre-built connector if it exists
    const preBuilt = getPreBuiltConnector(serviceName.toLowerCase());
    if (preBuilt && !preBuilt.isShared) {
      return res.status(400).json({
        success: false,
        error: `${serviceName} is a personal connector, not a shared connector`,
      });
    }

    // Check if shared connector already exists for this user and service
    // SECURITY: Each user can have their own connector for each service
    const existing = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.userId, userId), // SECURITY: Check only this user's connectors
          eq(apiKeys.serviceName, serviceName),
          eq(apiKeys.isShared, true),
          eq(apiKeys.isActive, true),
          isNull(apiKeys.projectId) // User-wide only
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Shared connector for ${serviceName} already exists. Please update the existing one.`,
      });
    }

    // Import APIKeyService to use encryption
    const { apiKeyService } = await import('../services/APIKeyService');
    
    // Store as shared connector
    const apiKey = await apiKeyService.storeAPIKey(
      userId, // Admin user ID
      serviceName,
      serviceName, // keyName
      keyValue,
      keyType || 'api_key',
      description,
      undefined, // website
      null // projectId = null for workspace-wide
    );

    // Update to mark as shared and store env variables in metadata
    const metadata: any = {};
    if (envVariables && typeof envVariables === 'object') {
      metadata.envVariables = envVariables;
    }
    
    await db
      .update(apiKeys)
      .set({
        isShared: true,
        configuredBy: userId,
        serviceName: serviceName,
        keyType: keyType || 'api_key',
        metadata: metadata, // Store env variables in metadata JSONB field
      })
      .where(eq(apiKeys.id, apiKey.id.toString()));

    res.json({
      success: true,
      message: `Shared connector for ${serviceName} created successfully`,
      connector: {
        id: apiKey.id,
        serviceName: serviceName,
        name: apiKey.serviceName,
      },
    });
  } catch (error: any) {
    console.error('Error creating shared connector:', error);
    res.status(500).json({ success: false, error: 'Failed to create shared connector' });
  }
});

/**
 * PUT /api/shared-connectors/:id
 * Update a shared connector (only the user who created it)
 */
router.put('/:id', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { keyValue, keyType, description } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // SECURITY: Verify this is a shared connector owned by this user
    const [connector] = await db
      .select({
        id: apiKeys.id,
        userId: apiKeys.userId,
        keyType: apiKeys.keyType,
        metadata: apiKeys.metadata,
      })
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, id),
          eq(apiKeys.userId, userId), // SECURITY: Only user's own connectors
          eq(apiKeys.isShared, true)
        )
      )
      .limit(1);

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Shared connector not found or you do not have permission to update it',
      });
    }

    // Import APIKeyService to use encryption
    const { apiKeyService } = await import('../services/APIKeyService');
    
    const updateData: any = {
      keyType: keyType || connector.keyType || 'api_key',
      configuredBy: userId,
    };
    
    if (keyValue) {
      // Update the key value (re-encrypt)
      const encryptedKey = (apiKeyService as any).encryptKey(keyValue);
      const keyHash = require('crypto').createHash('sha256').update(keyValue).digest('hex');
      updateData.keyHash = keyHash;
      updateData.encryptedKey = encryptedKey;
    }
    
    // Update env variables if provided
    const { envVariables } = req.body;
    if (envVariables && typeof envVariables === 'object') {
      const currentMetadata = (connector.metadata as any) || {};
      updateData.metadata = {
        ...currentMetadata,
        envVariables: envVariables,
      };
    }
    
    await db
      .update(apiKeys)
      .set(updateData)
      .where(eq(apiKeys.id, id));

    res.json({
      success: true,
      message: 'Shared connector updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating shared connector:', error);
    res.status(500).json({ success: false, error: 'Failed to update shared connector' });
  }
});

/**
 * DELETE /api/shared-connectors/:id
 * Delete a shared connector (only the user who created it)
 */
router.delete('/:id', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // SECURITY: Verify this is a shared connector owned by this user
    const [connector] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, id),
          eq(apiKeys.userId, userId), // SECURITY: Only user's own connectors
          eq(apiKeys.isShared, true)
        )
      )
      .limit(1);

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Shared connector not found or you do not have permission to delete it',
      });
    }

    // Soft delete (mark as inactive)
    await db
      .update(apiKeys)
      .set({
        isActive: false,
      })
      .where(eq(apiKeys.id, id));

    res.json({
      success: true,
      message: 'Shared connector deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting shared connector:', error);
    res.status(500).json({ success: false, error: 'Failed to delete shared connector' });
  }
});

export default router;

