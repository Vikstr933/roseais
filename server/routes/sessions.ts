import { Router } from 'express';
import { db } from '../../db';
import { codeGenerationSessions } from '../../db/schema';
import { desc, eq } from 'drizzle-orm';

const router = Router();

// Get all sessions
router.get('/', async (req, res) => {
  try {
    const sessions = await db
      .select()
      .from(codeGenerationSessions)
      .orderBy(desc(codeGenerationSessions.createdAt));

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
    const result = await db
      .delete(codeGenerationSessions)
      .where(eq(codeGenerationSessions.id, req.params.id))
      .returning();

    if (!result.length) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json({ message: 'Session deleted successfully' });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

export default router;
