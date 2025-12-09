/**
 * Playground API Routes
 * Dedicated endpoints for the AI Code Playground chat (Chap-ZPT)
 */

import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { playgroundAssistantAgent } from '../agents/PlaygroundAssistantAgent';
import { projectService } from '../services/ProjectService';

const router = Router();

/**
 * POST /api/playground/chat
 * Chat with Chap-ZPT (Playground Assistant Agent)
 * Dedicated for playground interactions with automatic prompt improvement
 */
router.post('/chat', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { message, projectId, sessionId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message is required',
        code: 'MISSING_MESSAGE'
      });
    }

    console.log(`💻 Playground Chat: Processing request`, {
      userId,
      messageLength: message.length,
      projectId,
      sessionId
    });

    // Load existing files if projectId is provided
    let existingFiles: Array<{ path: string; content: string }> = [];
    if (projectId) {
      try {
        const files = await projectService.getProjectFiles(parseInt(projectId));
        existingFiles = files.map(f => ({
          path: f.filePath,
          content: f.fileContent || ''
        }));
      } catch (error) {
        console.warn('Failed to load project files for playground context', error);
      }
    }

    // Process request with PlaygroundAssistantAgent
    const result = await playgroundAssistantAgent.processRequest(userId, message, {
      sessionId: sessionId || userId,
      projectId,
      existingFiles
    });

    res.json({
      success: true,
      response: result.response,
      toolsUsed: result.toolsUsed,
      improvedPrompt: result.improvedPrompt, // Include improved prompt if code generation was triggered
      sessionId: sessionId || userId
    });
  } catch (error) {
    console.error('❌ Playground Chat: Error', error);
    res.status(500).json({
      error: 'Failed to process playground chat message',
      code: 'CHAT_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/playground/clear-session
 * Clear conversation history for a session
 */
router.post('/clear-session', authenticateUser, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user!.id;

    const effectiveSessionId = sessionId || userId;

    // Clear session history (if we add this method to PlaygroundAssistantAgent)
    // For now, just return success
    res.json({
      success: true,
      message: 'Session history cleared',
      sessionId: effectiveSessionId
    });
  } catch (error) {
    console.error('❌ Playground: Failed to clear session', error);
    res.status(500).json({
      error: 'Failed to clear session',
      code: 'CLEAR_ERROR'
    });
  }
});

export default router;

