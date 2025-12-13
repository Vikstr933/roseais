import { Router } from 'express';
import { db } from '../../db';
import { apiKeys, users, workspaces } from '../../db/schema-pg';
import { eq, and, or, isNull } from 'drizzle-orm';
import { authenticateUser } from '../middleware/auth';
import { requireAdmin } from '../middleware/admin';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/shared-connectors
 * Get all shared connectors (workspace-wide API keys) for the current workspace
 */
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get user's workspace (for now, we'll use a default workspace concept)
    // In the future, this could be based on user's current workspace/team
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
          eq(apiKeys.isShared, true),
          eq(apiKeys.isActive, true)
        )
      )
      .orderBy(apiKeys.createdAt);

    res.json({
      success: true,
      connectors: sharedConnectors.map(connector => ({
        id: connector.id,
        serviceName: connector.serviceName || 'unknown',
        name: connector.name,
        keyType: connector.keyType || 'api_key',
        isActive: connector.isActive,
        configuredBy: connector.configuredByUser?.displayName || 'Unknown',
        createdAt: connector.createdAt,
        lastUsed: connector.lastUsed,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching shared connectors:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch shared connectors' });
  }
});

/**
 * POST /api/shared-connectors
 * Create a new shared connector (admin only)
 */
router.post('/', requireAdmin, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { serviceName, keyValue, keyType, description } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!serviceName || !keyValue) {
      return res.status(400).json({
        success: false,
        error: 'serviceName and keyValue are required',
      });
    }

    // Check if shared connector already exists for this service
    const existing = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.serviceName, serviceName),
          eq(apiKeys.isShared, true),
          eq(apiKeys.isActive, true)
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

    // Update to mark as shared
    await db
      .update(apiKeys)
      .set({
        isShared: true,
        configuredBy: userId,
        serviceName: serviceName,
        keyType: keyType || 'api_key',
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
 * Update a shared connector (admin only)
 */
router.put('/:id', requireAdmin, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;
    const { keyValue, keyType, description } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Verify this is a shared connector
    const [connector] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, id),
          eq(apiKeys.isShared, true)
        )
      )
      .limit(1);

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Shared connector not found',
      });
    }

    // Import APIKeyService to use encryption
    const { apiKeyService } = await import('../services/APIKeyService');
    
    if (keyValue) {
      // Update the key value (re-encrypt)
      const encryptedKey = (apiKeyService as any).encryptKey(keyValue);
      const keyHash = require('crypto').createHash('sha256').update(keyValue).digest('hex');
      
      await db
        .update(apiKeys)
        .set({
          keyHash: keyHash,
          keyType: keyType || connector.keyType || 'api_key',
          configuredBy: userId,
        })
        .where(eq(apiKeys.id, id));
    }

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
 * Delete a shared connector (admin only)
 */
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify this is a shared connector
    const [connector] = await db
      .select()
      .from(apiKeys)
      .where(
        and(
          eq(apiKeys.id, id),
          eq(apiKeys.isShared, true)
        )
      )
      .limit(1);

    if (!connector) {
      return res.status(404).json({
        success: false,
        error: 'Shared connector not found',
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

