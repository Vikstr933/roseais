import { Router } from 'express';
import { authenticateUser } from '../middleware/auth';
import { multiModelAI } from '../services/MultiModelAIService';

const router = Router();

/**
 * POST /api/ai/generate - Generate AI response using specified model
 * Used by AI Prompt Lab for testing prompts across different models
 */
router.post('/generate', authenticateUser, async (req, res) => {
  try {
    const { prompt, model, maxTokens = 2000, temperature = 0.7, systemPrompt } = req.body;

    if (!prompt) {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    console.log(`[AI] Prompt Lab request: model=${model}, promptLength=${prompt.length}`);

    const startTime = Date.now();

    // Use the multi-model AI service to generate response
    const response = await multiModelAI.generate({
      prompt,
      systemPrompt: systemPrompt || 'You are a helpful AI assistant. Be concise and accurate.',
      maxTokens,
      temperature,
      preferredModel: model,
      useCase: 'general',
      priority: 'quality',
    });

    const duration = Date.now() - startTime;

    console.log(`[AI] Prompt Lab response: ${duration}ms, length=${response.content.length}`);

    res.json({
      content: response.content,
      model: response.model || model || 'default',
      provider: response.provider,
      duration,
      usage: response.usage || {
        input: Math.round(prompt.length / 4), // Rough token estimate
        output: Math.round(response.content.length / 4),
      },
    });
  } catch (error: any) {
    console.error(`[AI] Prompt Lab error: ${error.message}`);
    res.status(500).json({ 
      error: 'Generation failed', 
      message: error.message 
    });
  }
});

/**
 * GET /api/ai/models - Get available AI models
 */
router.get('/models', authenticateUser, async (req, res) => {
  try {
    const models = [
      { 
        id: 'claude-sonnet-4-5-20250929', 
        name: 'Claude Sonnet 4.5', 
        provider: 'Anthropic',
        capabilities: ['code', 'analysis', 'creative'],
        maxTokens: 8192,
      },
      { 
        id: 'claude-3-5-sonnet-20241022', 
        name: 'Claude 3.5 Sonnet', 
        provider: 'Anthropic',
        capabilities: ['code', 'analysis', 'creative'],
        maxTokens: 8192,
      },
      { 
        id: 'gpt-4o', 
        name: 'GPT-4o', 
        provider: 'OpenAI',
        capabilities: ['code', 'analysis', 'creative', 'vision'],
        maxTokens: 4096,
      },
      { 
        id: 'gpt-4o-mini', 
        name: 'GPT-4o Mini', 
        provider: 'OpenAI',
        capabilities: ['code', 'analysis'],
        maxTokens: 4096,
      },
    ];

    res.json({ models });
  } catch (error: any) {
    res.status(500).json({ error: 'Failed to fetch models' });
  }
});

export default router;

