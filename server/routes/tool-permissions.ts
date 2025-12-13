import { Router } from 'express';
import { db } from '../../db';
import { toolPermissions } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';
import { authenticateUser } from '../middleware/auth';

const router = Router();

// All routes require authentication
router.use(authenticateUser);

/**
 * GET /api/tool-permissions
 * Get all tool permissions for the current user
 */
router.get('/', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const permissions = await db
      .select()
      .from(toolPermissions)
      .where(eq(toolPermissions.userId, userId));

    res.json({
      success: true,
      permissions: permissions.reduce((acc, perm) => {
        const key = `${perm.pluginId}:${perm.toolId}`;
        acc[key] = perm.permission;
        return acc;
      }, {} as Record<string, string>),
    });
  } catch (error: any) {
    console.error('Error fetching tool permissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tool permissions' });
  }
});

/**
 * GET /api/tool-permissions/:pluginId
 * Get tool permissions for a specific plugin
 */
router.get('/:pluginId', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { pluginId } = req.params;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const permissions = await db
      .select()
      .from(toolPermissions)
      .where(
        and(
          eq(toolPermissions.userId, userId),
          eq(toolPermissions.pluginId, pluginId)
        )
      );

    res.json({
      success: true,
      permissions: permissions.map(p => ({
        toolId: p.toolId,
        permission: p.permission,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching plugin tool permissions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch plugin tool permissions' });
  }
});

/**
 * PUT /api/tool-permissions/:pluginId/:toolId
 * Update permission for a specific tool
 */
router.put('/:pluginId/:toolId', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { pluginId, toolId } = req.params;
    const { permission } = req.body;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    if (!['allow', 'ask', 'deny'].includes(permission)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid permission. Must be "allow", "ask", or "deny"',
      });
    }

    // Upsert permission
    const existing = await db
      .select()
      .from(toolPermissions)
      .where(
        and(
          eq(toolPermissions.userId, userId),
          eq(toolPermissions.pluginId, pluginId),
          eq(toolPermissions.toolId, toolId)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      // Update existing
      await db
        .update(toolPermissions)
        .set({
          permission,
          updatedAt: new Date(),
        })
        .where(eq(toolPermissions.id, existing[0].id));
    } else {
      // Create new
      await db.insert(toolPermissions).values({
        userId,
        pluginId,
        toolId,
        permission,
      });
    }

    res.json({
      success: true,
      message: 'Permission updated',
      permission,
    });
  } catch (error: any) {
    console.error('Error updating tool permission:', error);
    res.status(500).json({ success: false, error: 'Failed to update tool permission' });
  }
});

/**
 * DELETE /api/tool-permissions/:pluginId/:toolId
 * Delete permission (reset to default)
 */
router.delete('/:pluginId/:toolId', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { pluginId, toolId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    await db
      .delete(toolPermissions)
      .where(
        and(
          eq(toolPermissions.userId, userId),
          eq(toolPermissions.pluginId, pluginId),
          eq(toolPermissions.toolId, toolId)
        )
      );

    res.json({
      success: true,
      message: 'Permission reset to default',
    });
  } catch (error: any) {
    console.error('Error deleting tool permission:', error);
    res.status(500).json({ success: false, error: 'Failed to delete tool permission' });
  }
});

export default router;

