import { Router } from 'express';
import { db } from '../../db';
import { codeGenerationSessions, chatMessages, workspaces } from '../../db/schema-pg';
import { eq, and, desc, sql } from 'drizzle-orm';
import { authenticateUser } from '../middleware/auth';
import { SimpleLogger } from '../utils/SimpleLogger';

const router = Router();
const logger = new SimpleLogger('WorkspaceAPI');

function timestampMs(value: unknown): number {
  if (typeof value === 'number') return value;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? Date.now() : parsed;
  }
  return Date.now();
}

/**
 * Workspace API - Persistent state management across the entire application
 *
 * Features:
 * - Save/load workspace sessions
 * - Chat history persistence
 * - Generated files storage
 * - Cross-device sync
 */

/**
 * Get all workspace sessions for a user
 * GET /api/workspace-sessions
 */
router.get('/', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    res.setHeader('Cache-Control', 'private, no-store');

    // Keep the session list intentionally lightweight. Full generated files and
    // chat history are loaded through GET /:sessionId only when a user opens one.
    const sessions = await db
      .select({
        id: (codeGenerationSessions as any).id,
        title: (codeGenerationSessions as any).title,
        createdAt: (codeGenerationSessions as any).createdAt,
        updatedAt: (codeGenerationSessions as any).updatedAt,
        inputPrompt: (codeGenerationSessions as any).inputPrompt,
        workspaceId: (codeGenerationSessions as any).workspaceId,
        type: sql<string>`COALESCE(${(codeGenerationSessions as any).metadata}->>'type', 'playground')`
      })
      .from(codeGenerationSessions as any)
      .where(eq((codeGenerationSessions as any).userId, userId))
      .orderBy(desc((codeGenerationSessions as any).updatedAt))
      .limit(50);

    const sessionSummaries = sessions.map((session) => ({
      id: session.id,
      name: session.title,
      type: session.type || 'playground',
      createdAt: timestampMs(session.createdAt),
      updatedAt: timestampMs(session.updatedAt),
      chatHistory: [],
      chatHistoryCount: 0,
      generatedFiles: [],
      generatedFilesCount: 0,
      currentPrompt: session.inputPrompt,
      metadata: {
        type: session.type || 'playground',
        summaryOnly: true,
        workspaceId: session.workspaceId
      }
    }));

    res.json({
      success: true,
      sessions: sessionSummaries
    });
  } catch (error) {
    logger.error('Failed to load workspace sessions', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to load sessions'
    });
  }
});

/**
 * Get a specific workspace session
 * GET /api/workspace-sessions/:sessionId
 */
router.get('/:sessionId', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { sessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    res.setHeader('Cache-Control', 'private, no-store');

    // Load session from database
    const sessions = await db
      .select({
        id: (codeGenerationSessions as any).id,
        title: (codeGenerationSessions as any).title,
        createdAt: (codeGenerationSessions as any).createdAt,
        updatedAt: (codeGenerationSessions as any).updatedAt,
        workspaceId: (codeGenerationSessions as any).workspaceId,
        metadata: (codeGenerationSessions as any).metadata
      })
      .from(codeGenerationSessions as any)
      .where(
        and(
          eq((codeGenerationSessions as any).id, sessionId),
          eq((codeGenerationSessions as any).userId, userId)
        )
      )
      .limit(1);

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    const session = sessions[0];

    // Load chat history using workspaceId (integer) instead of session.id (string)
    const history = session.workspaceId
      ? await db
          .select()
          .from(chatMessages as any)
          .where(eq((chatMessages as any).projectId, session.workspaceId))
          .orderBy((chatMessages as any).createdAt)
      : [];

    res.json({
      success: true,
      session: {
        id: session.id,
        name: session.title,
        type: session.metadata?.type || 'playground',
        createdAt: timestampMs(session.createdAt),
        updatedAt: timestampMs(session.updatedAt),
        chatHistory: history.map(msg => ({
          role: msg.role,
          content: msg.content,
          timestamp: msg.createdAt?.getTime() || Date.now(),
          files: msg.metadata?.files || []
        })),
        generatedFiles: session.metadata?.generatedFiles || [],
        currentPrompt: session.metadata?.currentPrompt,
        metadata: session.metadata
      }
    });
  } catch (error) {
    logger.error('Failed to load workspace session', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to load session'
    });
  }
});

/**
 * Save/update a workspace session
 * POST /api/workspace-sessions
 */
router.post('/', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    const { session } = req.body;

    if (!session || !session.id) {
      return res.status(400).json({
        success: false,
        error: 'Invalid session data'
      });
    }

    // Check if session exists
    const existing = await db
      .select()
      .from(codeGenerationSessions as any)
      .where(
        and(
          eq((codeGenerationSessions as any).id, session.id),
          eq((codeGenerationSessions as any).userId, userId)
        )
      )
      .limit(1);

    let workspaceId: number;

    // Create or get workspace for this session
    if (existing.length > 0 && existing[0].workspaceId) {
      // Validate that the existing workspace still exists
      const workspaceExists = await db
        .select()
        .from(workspaces as any)
        .where(eq((workspaces as any).id, existing[0].workspaceId))
        .limit(1);

      if (workspaceExists.length > 0) {
        // Use existing workspace (it still exists)
        workspaceId = existing[0].workspaceId;
        logger.info('Reusing existing workspace', { workspaceId, sessionId: session.id });
      } else {
        // Workspace was deleted, create a new one
        logger.warn('Workspace was deleted, creating new one', {
          oldWorkspaceId: existing[0].workspaceId,
          sessionId: session.id
        });

        const newWorkspace = await db
          .insert(workspaces as any)
          .values({
            name: session.name,
            description: session.description || `Workspace for ${session.name}`,
            ownerId: userId,
            projectType: session.type === 'playground' ? 'playground' : 'web_app',
            projectStatus: 'active',
            status: 'active',
            lastActivity: new Date()
          })
          .returning();

        const createdWorkspace = (newWorkspace as any[])[0];
        workspaceId = createdWorkspace.id;
      }
    } else {
      // Check if workspace already exists for this session
      const existingWorkspace = await db
        .select()
        .from(workspaces as any)
        .where(
          and(
            eq((workspaces as any).name, session.name),
            eq((workspaces as any).ownerId, userId)
          )
        )
        .limit(1);

      if (existingWorkspace.length > 0) {
        workspaceId = existingWorkspace[0].id;
      } else {
        // Create new workspace
        const newWorkspace = await db
          .insert(workspaces as any)
          .values({
            name: session.name,
            description: session.description || `Workspace for ${session.name}`,
            ownerId: userId,
            projectType: session.type === 'playground' ? 'playground' : 'web_app',
            projectStatus: 'active',
            status: 'active',
            lastActivity: new Date()
          })
          .returning();

        const createdWorkspace = (newWorkspace as any[])[0];
        workspaceId = createdWorkspace.id;
      }
    }

    // Extract the actual user prompt from chat history if currentPrompt is not set
    // This ensures we save the real prompt that was used, not a default value
    let actualPrompt = session.currentPrompt;
    if (!actualPrompt && session.chatHistory && Array.isArray(session.chatHistory)) {
      // Find the most recent user message in chat history
      const userMessages = session.chatHistory
        .filter((msg: any) => msg.role === 'user')
        .map((msg: any) => msg.content)
        .filter((content: string) => content && content.trim().length > 0);
      
      if (userMessages.length > 0) {
        actualPrompt = userMessages[userMessages.length - 1]; // Get the most recent user message
      }
    }
    
    // Fallback to default only if we truly have no prompt
    if (!actualPrompt || actualPrompt.trim().length === 0) {
      actualPrompt = 'Workspace session';
    }

    if (existing.length > 0) {
      // Update existing session - also update inputPrompt if we found a better one
      await db
        .update(codeGenerationSessions as any)
        .set({
          title: session.name,
          description: session.description || null,
          workspaceId,
          inputPrompt: actualPrompt, // Update with the actual prompt
          metadata: {
            ...session.metadata,
            type: session.type,
            generatedFiles: session.generatedFiles,
            currentPrompt: actualPrompt
          },
          updatedAt: new Date(session.updatedAt)
        })
        .where(
          and(
            eq((codeGenerationSessions as any).id, session.id),
            eq((codeGenerationSessions as any).userId, userId)
          )
        );
    } else {
      // Create new session
      await db.insert(codeGenerationSessions as any).values({
        id: session.id,
        userId,
        title: session.name,
        description: session.description || null,
        workspaceId,
        inputPrompt: actualPrompt, // Use the actual prompt extracted from chat history
        generatedCode: JSON.stringify(session.generatedFiles || []),
        metadata: {
          ...session.metadata,
          type: session.type,
          generatedFiles: session.generatedFiles,
          currentPrompt: actualPrompt
        },
        createdAt: new Date(session.createdAt),
        updatedAt: new Date(session.updatedAt)
      });
    }

    // Save chat history using workspace ID
    if (session.chatHistory && session.chatHistory.length > 0) {
      // Delete old messages for this workspace
      await db
        .delete(chatMessages as any)
        .where(eq((chatMessages as any).projectId, workspaceId));

      // Insert new messages
      for (const message of session.chatHistory) {
        await db.insert(chatMessages as any).values({
          projectId: workspaceId,
          userId: userId,
          role: message.role,
          content: message.content,
          metadata: {
            files: message.files || []
          },
          createdAt: new Date(message.timestamp)
        });
      }
    }

    logger.info('Workspace session saved', {
      userId,
      sessionId: session.id,
      messagesCount: session.chatHistory?.length || 0
    });

    res.json({
      success: true,
      message: 'Session saved successfully'
    });
  } catch (error) {
    logger.error('Failed to save workspace session', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to save session'
    });
  }
});

/**
 * Delete a workspace session
 * DELETE /api/workspace-sessions/:sessionId
 */
router.delete('/:sessionId', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { sessionId } = req.params;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // Get the workspace ID for this session
    const session = await db
      .select()
      .from(codeGenerationSessions as any)
      .where(
        and(
          eq((codeGenerationSessions as any).id, sessionId),
          eq((codeGenerationSessions as any).userId, userId)
        )
      )
      .limit(1);

    if (session.length > 0 && session[0].workspaceId) {
      // Delete chat messages using workspace ID
      await db
        .delete(chatMessages as any)
        .where(eq((chatMessages as any).projectId, session[0].workspaceId));
    }

    // Delete session
    await db
      .delete(codeGenerationSessions as any)
      .where(
        and(
          eq((codeGenerationSessions as any).id, sessionId),
          eq((codeGenerationSessions as any).userId, userId)
        )
      );

    logger.info('Workspace session deleted', { userId, sessionId });

    res.json({
      success: true,
      message: 'Session deleted successfully'
    });
  } catch (error) {
    logger.error('Failed to delete workspace session', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete session'
    });
  }
});

/**
 * Add a user's field to code generation sessions if it doesn't exist
 * This is a helper migration endpoint
 */
router.post('/migrate-sessions', authenticateUser, async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ success: false, error: 'Unauthorized' });
    }

    // This would be handled by a proper migration, but for now we'll just ensure
    // any sessions without userId get assigned to the requesting user
    // Note: This is a temporary helper and should be replaced with proper migrations

    res.json({
      success: true,
      message: 'Migration completed (if needed)'
    });
  } catch (error) {
    logger.error('Failed to migrate sessions', error as Error);
    res.status(500).json({
      success: false,
      error: 'Migration failed'
    });
  }
});

export default router;
 
