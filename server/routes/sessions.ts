import { Router } from 'express';
import { db } from '../../db';
import { codeGenerationSessions, chatMessages, workspaces } from '../../db/schema-pg';
import { desc, eq, and, inArray } from 'drizzle-orm';
import { authenticateUser, optionalAuth } from '../middleware/auth';

const router = Router();

// Get all sessions - CRITICAL: Must filter by user's projects only
router.get('/', optionalAuth, async (req, res) => {
  try {
    if (!req.user) {
      // Return empty array for unauthenticated users
      return res.json([]);
    }

    const userId = req.user.id;
    
    // Get user's project IDs (owned projects only for sessions)
    const userProjects = await db
      .select({ id: workspaces.id })
      .from(workspaces)
      .where(eq(workspaces.ownerId, userId));
    
    const projectIds = userProjects.map(p => p.id);
    
    if (projectIds.length === 0) {
      return res.json([]);
    }

    // Only fetch sessions for user's own projects
    // Note: workspaceId is integer in SQLite schema, but we're using PostgreSQL
    // Check if workspaceId exists and filter by projectIds
    const allSessions = await db
      .select()
      .from(codeGenerationSessions)
      .orderBy(desc(codeGenerationSessions.createdAt));
    
    // Filter to only include sessions for user's projects
    const sessions = allSessions.filter(session => {
      if (!session.workspaceId) return false;
      const wsId = typeof session.workspaceId === 'string' 
        ? parseInt(session.workspaceId) 
        : Number(session.workspaceId);
      return projectIds.includes(wsId);
    });

    res.json(sessions);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get single session by ID
router.get('/:id', async (req, res) => {
  try {
    const session = await db
      .select()
      .from(codeGenerationSessions)
      .where(eq(codeGenerationSessions.id, req.params.id))
      .limit(1);

    if (!session.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(session[0]);
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({ error: 'Failed to fetch session' });
  }
});

// Create new session
router.post('/', async (req, res) => {
  try {
    const {
      title,
      inputPrompt,
      generatedCode,
      agentId,
      workspaceId,
      description,
    } = req.body;

    const [session] = await db
      .insert(codeGenerationSessions)
      .values({
        title,
        description,
        inputPrompt,
        generatedCode,
        agentId,
        workspaceId,
        status: 'completed',
      })
      .returning();

    res.status(201).json(session);
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

// Delete session by ID
router.delete('/:id', async (req, res) => {
  try {
    // First, get the session to know its workspaceId
    const [session] = await db
      .select()
      .from(codeGenerationSessions)
      .where(eq(codeGenerationSessions.id, req.params.id))
      .limit(1);

    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Optionally delete chat messages for this workspace
    // This helps keep the database clean when sessions are deleted
    if (session.workspaceId) {
      try {
        await db
          .delete(chatMessages as any)
          .where(eq((chatMessages as any).projectId, session.workspaceId));
        console.log(`Deleted chat messages for workspace ${session.workspaceId}`);
      } catch (chatError) {
        console.error('Error deleting chat messages:', chatError);
        // Continue even if chat deletion fails
      }
    }

    // Delete the session
    const result = await db
      .delete(codeGenerationSessions)
      .where(eq(codeGenerationSessions.id, req.params.id))
      .returning();

    res.json({
      message: 'Session deleted successfully',
      deletedChatMessages: session.workspaceId ? true : false
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
