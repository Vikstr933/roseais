/**
 * OmniAssistant API Routes
 * New endpoints for enhanced AI assistant with persistent memory
 * Part of Digital Office Platform (Fas 1)
 *
 * These are NEW endpoints (/api/omniassistant/*) that don't conflict with
 * existing /api/plugins/assistant/* endpoints
 */

import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { OmniAssistantService } from '../services/OmniAssistantService';
import { personalAssistantAgent } from '../agents/PersonalAssistantAgent';
import { multiModelAI } from '../services/MultiModelAIService';
import { projectService } from '../services/ProjectService';

const router = Router();

// Initialize OmniAssistant service (singleton)
const omniAssistant = new OmniAssistantService(
  personalAssistantAgent,
  multiModelAI,
  projectService
);

/**
 * POST /api/omniassistant/chat
 * Enhanced chat with persistent memory, context awareness, and insights
 *
 * Feature flags:
 * - persistConversation: Save conversations to database (default: false)
 * - generateInsights: Generate proactive insights (default: false)
 * - useContextEngine: Enhanced context analysis (default: false)
 */
router.post('/chat', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { message, sessionId, currentPage, workspaceId, features, playgroundContext, stream } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        error: 'Message is required',
        code: 'INVALID_MESSAGE',
      });
    }

    // Feature flags (opt-in, default OFF for backward compatibility)
    const featureFlags = {
      persistConversation: features?.persistConversation || false,
      generateInsights: features?.generateInsights || false,
      useContextEngine: features?.useContextEngine || false,
    };

    console.log(`💬 OmniAssistant: Processing chat request`, {
      userId,
      messageLength: message.length,
      features: featureFlags,
      currentPage,
      workspaceId,
      hasPlaygroundContext: !!playgroundContext,
      stream: stream || false,
    });

    // If streaming is requested, use streaming endpoint
    if (stream) {
      return handleOmniAssistantStreaming(req, res, userId, message, {
        sessionId,
        currentPage,
        workspaceId,
        playgroundContext,
        ...featureFlags,
      });
    }

    // Non-streaming: Process request with OmniAssistant
    // Make insights generation async so it doesn't block the response
    const result = await omniAssistant.processRequest(userId, message, {
      sessionId,
      currentPage,
      workspaceId,
      playgroundContext,
      ...featureFlags,
      generateInsights: false, // Disable blocking insights for now
    });

    // Generate insights asynchronously in background (don't wait)
    if (featureFlags.generateInsights) {
      omniAssistant.processRequest(userId, message, {
        sessionId,
        currentPage,
        workspaceId,
        playgroundContext,
        generateInsights: true,
        persistConversation: featureFlags.persistConversation,
        useContextEngine: featureFlags.useContextEngine,
      }).catch(error => {
        console.error('⚠️ OmniAssistant: Background insights generation failed', error);
      });
    }

    res.json({
      success: true,
      response: result.response,
      toolsUsed: result.toolsUsed,
      contextUsed: result.contextUsed,
      suggestions: result.suggestions,
      conversationId: result.conversationId,
      insights: [], // Will be fetched separately if needed
      features: featureFlags,
    });
  } catch (error) {
    console.error('❌ OmniAssistant: Chat error', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      code: 'CHAT_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * Handle streaming chat with Server-Sent Events (SSE)
 */
async function handleOmniAssistantStreaming(
  req: any,
  res: any,
  userId: string,
  message: string,
  options: {
    sessionId?: string;
    currentPage?: string;
    workspaceId?: number;
    playgroundContext?: any;
    persistConversation?: boolean;
    generateInsights?: boolean;
    useContextEngine?: boolean;
  }
) {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  const sendSSE = (type: string, data: any) => {
    try {
      res.write(`data: ${JSON.stringify({ type, ...data })}\n\n`);
    } catch (error) {
      // Client disconnected
      console.warn('SSE write failed, client likely disconnected');
    }
  };

  // Clean up on client disconnect
  req.on('close', () => {
    res.end();
  });

  try {
    sendSSE('connected', { message: 'Streaming started' });

    // Process request WITHOUT blocking insights
    const result = await omniAssistant.processRequest(userId, message, {
      ...options,
      generateInsights: false, // Don't block on insights
    });

    // Stream the response word-by-word
    const response = result.response;
    const words = response.split(/(\s+)/);
    let currentText = '';

    // Send tools used immediately
    if (result.toolsUsed && result.toolsUsed.length > 0) {
      sendSSE('tools_used', { tools: result.toolsUsed });
    }

    // Stream words
    for (let i = 0; i < words.length; i++) {
      const word = words[i];
      currentText += word;
      sendSSE('chunk', { text: word });
      
      if (i % 3 === 0) {
        await new Promise(resolve => setTimeout(resolve, 20));
      }
    }

    // Send completion
    sendSSE('complete', {
      response: result.response,
      toolsUsed: result.toolsUsed || [],
      contextUsed: result.contextUsed || [],
      suggestions: result.suggestions || [],
      conversationId: result.conversationId,
    });

    // Generate insights in background (don't wait)
    if (options.generateInsights) {
      omniAssistant.processRequest(userId, message, {
        ...options,
        generateInsights: true,
      }).catch(error => {
        console.error('⚠️ OmniAssistant: Background insights failed', error);
      });
    }

    res.end();
  } catch (error) {
    console.error('Streaming chat error', error);
    sendSSE('error', {
      message: error instanceof Error ? error.message : 'Failed to process message'
    });
    res.end();
  }
}

/**
 * GET /api/omniassistant/history
 * Get conversation history from database
 */
router.get('/history', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const contextType = (req.query.contextType as string) || 'general';
    const limit = parseInt(req.query.limit as string) || 10;

    const history = await omniAssistant.getConversationHistory(userId, contextType, limit);

    res.json({
      success: true,
      conversations: history,
      count: history.length,
    });
  } catch (error) {
    console.error('❌ OmniAssistant: Failed to fetch history', error);
    res.status(500).json({
      error: 'Failed to fetch conversation history',
      code: 'HISTORY_ERROR',
    });
  }
});

/**
 * GET /api/omniassistant/insights
 * Get active AI-generated insights for user
 */
router.get('/insights', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const limit = parseInt(req.query.limit as string) || 10;

    const insights = await omniAssistant.getActiveInsights(userId, limit);

    res.json({
      success: true,
      insights,
      count: insights.length,
    });
  } catch (error) {
    console.error('❌ OmniAssistant: Failed to fetch insights', error);
    res.status(500).json({
      error: 'Failed to fetch insights',
      code: 'INSIGHTS_ERROR',
    });
  }
});

/**
 * POST /api/omniassistant/insights/:id/dismiss
 * Dismiss an insight
 */
router.post('/insights/:id/dismiss', authenticateUser, async (req, res) => {
  try {
    const insightId = parseInt(req.params.id);

    if (isNaN(insightId)) {
      return res.status(400).json({
        error: 'Invalid insight ID',
        code: 'INVALID_ID',
      });
    }

    await omniAssistant.dismissInsight(insightId);

    res.json({
      success: true,
      message: 'Insight dismissed',
    });
  } catch (error) {
    console.error('❌ OmniAssistant: Failed to dismiss insight', error);
    res.status(500).json({
      error: 'Failed to dismiss insight',
      code: 'DISMISS_ERROR',
    });
  }
});

/**
 * POST /api/omniassistant/insights/:id/action
 * Mark insight as actioned
 */
router.post('/insights/:id/action', authenticateUser, async (req, res) => {
  try {
    const insightId = parseInt(req.params.id);

    if (isNaN(insightId)) {
      return res.status(400).json({
        error: 'Invalid insight ID',
        code: 'INVALID_ID',
      });
    }

    await omniAssistant.markInsightActioned(insightId);

    res.json({
      success: true,
      message: 'Insight marked as actioned',
    });
  } catch (error) {
    console.error('❌ OmniAssistant: Failed to mark insight as actioned', error);
    res.status(500).json({
      error: 'Failed to update insight',
      code: 'ACTION_ERROR',
    });
  }
});

/**
 * GET /api/omniassistant/preferences
 * Get AI-learned user preferences
 */
router.get('/preferences', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    const preferences = await omniAssistant.getUserPreferences(userId);

    res.json({
      success: true,
      preferences,
      count: preferences.length,
    });
  } catch (error) {
    console.error('❌ OmniAssistant: Failed to fetch preferences', error);
    res.status(500).json({
      error: 'Failed to fetch user preferences',
      code: 'PREFERENCES_ERROR',
    });
  }
});

/**
 * GET /api/omniassistant/daily-summary
 * Generate daily summary of user's activity
 */
router.get('/daily-summary', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    const summary = await omniAssistant.generateDailySummary(userId);

    res.json({
      success: true,
      summary,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('❌ OmniAssistant: Failed to generate daily summary', error);
    res.status(500).json({
      error: 'Failed to generate daily summary',
      code: 'SUMMARY_ERROR',
    });
  }
});

/**
 * POST /api/omniassistant/clear-session
 * Clear in-memory conversation history for a session
 */
router.post('/clear-session', authenticateUser, async (req, res) => {
  try {
    const { sessionId } = req.body;
    const userId = req.user!.id;

    const effectiveSessionId = sessionId || userId;

    omniAssistant.clearSessionHistory(effectiveSessionId);

    res.json({
      success: true,
      message: 'Session history cleared',
      sessionId: effectiveSessionId,
    });
  } catch (error) {
    console.error('❌ OmniAssistant: Failed to clear session', error);
    res.status(500).json({
      error: 'Failed to clear session',
      code: 'CLEAR_ERROR',
    });
  }
});

/**
 * POST /api/omniassistant/track-action
 * Track when user takes a suggested action (for learning)
 */
router.post('/track-action', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;
    const { action, currentPage, workspaceId, success } = req.body;

    if (!action || typeof action !== 'string') {
      return res.status(400).json({
        error: 'Action is required',
        code: 'INVALID_ACTION',
      });
    }

    await omniAssistant.trackUserAction(userId, action, {
      currentPage: currentPage || req.headers.referer,
      workspaceId,
      success: success !== false, // Default to success
    });

    res.json({
      success: true,
      message: 'Action tracked',
    });
  } catch (error) {
    console.error('❌ OmniAssistant: Failed to track action', error);
    res.status(500).json({
      error: 'Failed to track action',
      code: 'TRACK_ERROR',
    });
  }
});

/**
 * GET /api/omniassistant/status
 * Get OmniAssistant system status and feature availability
 */
router.get('/status', authenticateUser, async (req, res) => {
  try {
    const userId = req.user!.id;

    // Check which features are available for this user
    // In the future, this could be based on user tier/subscription
    const features = {
      persistentConversations: true, // Available for all users
      aiInsights: true, // Available for all users
      contextEngine: true, // Available for all users
      dailySummary: true, // Available for all users
    };

    // Get current stats
    const [conversations, insights, preferences] = await Promise.all([
      omniAssistant.getConversationHistory(userId, 'general', 1),
      omniAssistant.getActiveInsights(userId, 1),
      omniAssistant.getUserPreferences(userId),
    ]);

    res.json({
      success: true,
      status: 'operational',
      features,
      stats: {
        totalConversations: conversations.length,
        activeInsights: insights.length,
        learnedPreferences: preferences.length,
      },
      message: 'OmniAssistant is ready to assist you across all departments of your digital office',
    });
  } catch (error) {
    console.error('❌ OmniAssistant: Failed to get status', error);
    res.status(500).json({
      error: 'Failed to get system status',
      code: 'STATUS_ERROR',
    });
  }
});

export default router;
