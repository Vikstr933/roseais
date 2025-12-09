import { Router } from 'express';
import { multiModelAI } from '../services/MultiModelAIService';
import { SimpleLogger } from '../utils/SimpleLogger';

const router = Router();
const logger = new SimpleLogger('ModelsAPI');

// Define available models - Updated with latest 2024/2025 models
const models = [
  {
    id: 'claude-sonnet-4-5-20250929',
    name: 'Claude Sonnet 4.5',
    provider: 'Anthropic',
    description:
      'Latest Claude model (Sept 2025) with best-in-class reasoning and coding capabilities',
    contextWindow: 200000,
    maxTokens: 8192,
    releaseDate: '2025-09-29',
    strengths: [
      'Superior code generation',
      'Advanced reasoning',
      'Long context',
      'Multimodal',
      'Best for complex tasks',
    ],
  },
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description:
      'Previous Claude model with improved reasoning and coding capabilities',
    contextWindow: 200000,
    maxTokens: 8192,
    releaseDate: '2024-10-22',
    strengths: [
      'Advanced reasoning',
      'Code generation',
      'Long context',
      'Multimodal',
    ],
  },
  {
    id: 'gpt-4o-2024-11-20',
    name: 'GPT-4o',
    provider: 'OpenAI',
    description: 'Latest GPT-4 optimized model with improved performance',
    contextWindow: 128000,
    maxTokens: 16384,
    releaseDate: '2024-11-20',
    strengths: [
      'General purpose',
      'Fast inference',
      'Cost effective',
      'Vision capabilities',
    ],
  },
  {
    id: 'gpt-4-turbo-2024-04-09',
    name: 'GPT-4 Turbo',
    provider: 'OpenAI',
    description: 'Previous generation GPT-4 with large context window',
    contextWindow: 128000,
    maxTokens: 4096,
    releaseDate: '2024-04-09',
    strengths: ['Large context', 'Good for analysis', 'Reliable performance'],
  },
  {
    id: 'deepseek-coder-33b-instruct',
    name: 'DeepSeek Coder 33B',
    provider: 'DeepSeek',
    description: 'Specialized coding model with excellent code generation',
    contextWindow: 16384,
    maxTokens: 8192,
    releaseDate: '2024-01-01',
    strengths: [
      'Code generation',
      'Programming tasks',
      'Technical writing',
      'Debugging',
    ],
  },
  {
    id: 'deepseek-chat-67b',
    name: 'DeepSeek Chat 67B',
    provider: 'DeepSeek',
    description: 'General purpose chat model with strong reasoning',
    contextWindow: 32768,
    maxTokens: 8192,
    releaseDate: '2024-01-01',
    strengths: ['Conversational AI', 'Reasoning', 'Analysis', 'Creative tasks'],
  },
  {
    id: 'llama-3-1-70b-instruct',
    name: 'Llama 3.1 70B Instruct',
    provider: 'Meta',
    description: "Meta's latest instruction-tuned model",
    contextWindow: 131072,
    maxTokens: 8192,
    releaseDate: '2024-07-23',
    strengths: [
      'Instruction following',
      'Large context',
      'Open source',
      'Customizable',
    ],
  },
  {
    id: 'llama-3-1-8b-instruct',
    name: 'Llama 3.1 8B Instruct',
    provider: 'Meta',
    description: 'Smaller, faster version of Llama 3.1',
    contextWindow: 131072,
    maxTokens: 8192,
    releaseDate: '2024-07-23',
    strengths: [
      'Fast inference',
      'Lower resource usage',
      'Good performance',
      'Open source',
    ],
  },
  {
    id: 'qwen2-5-72b-instruct',
    name: 'Qwen2.5 72B Instruct',
    provider: 'Alibaba Cloud',
    description:
      "Alibaba's latest instruction-tuned model with strong performance",
    contextWindow: 32768,
    maxTokens: 8192,
    releaseDate: '2024-09-01',
    strengths: ['Strong reasoning', 'Good coding', 'Multilingual', 'Efficient'],
  },
];

// Multi-model AI endpoints (must come before /:id route)
// GET /api/models/available - Get actively available AI models from multi-model service
router.get('/available', async (req, res) => {
  try {
    const models = multiModelAI.getAvailableModels();
    logger.info('Available models requested', { count: models.length });

    res.json({
      success: true,
      models: models.map(model => ({
        provider: model.provider,
        model: model.model,
        maxTokens: model.maxTokens,
        costPerToken: model.costPerToken,
        qualityScore: model.qualityScore,
        enabled: model.enabled
      })),
      totalModels: models.length
    });
  } catch (error) {
    logger.error('Failed to get available models', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve available models'
    });
  }
});

// GET /api/models/health - Check health status of all AI providers
router.get('/health', async (req, res) => {
  try {
    logger.info('Health check requested for all providers');

    const health = await multiModelAI.healthCheck();
    const allHealthy = Object.values(health).every(status => status === true);

    res.json({
      success: true,
      health,
      overallStatus: allHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Health check failed', error as Error);
    res.status(500).json({
      success: false,
      error: 'Health check failed'
    });
  }
});

// GET /api/models/usage - Get usage statistics for all models
router.get('/usage', async (req, res) => {
  try {
    const stats = multiModelAI.getUsageStats();
    logger.info('Usage statistics requested');

    res.json({
      success: true,
      usage: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get usage statistics', error as Error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve usage statistics'
    });
  }
});

// POST /api/models/test - Test a specific model with a sample request
router.post('/test', async (req, res) => {
  try {
    const { prompt = 'Hello, this is a test message.', priority = 'quality' } = req.body;
    logger.info('Model test requested', { priority });

    const response = await multiModelAI.generate({
      prompt,
      useCase: 'explanation',
      priority,
      maxTokens: 100,
      temperature: 0.7
    });

    res.json({
      success: true,
      test: {
        prompt,
        response: response.content.substring(0, 200) + '...', // Truncate for API response
        provider: response.provider,
        model: response.model,
        responseTime: response.responseTime,
        tokens: response.usage.totalTokens,
        cost: response.usage.cost
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Model test failed', error as Error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Model test failed'
    });
  }
});

// Static model endpoints (must come after multi-model endpoints)
// GET /api/models - Get list of available models
router.get('/', (req, res) => {
  res.json(models);
});

// GET /api/models/:id - Get specific model details
router.get('/:id', (req, res) => {
  const model = models.find(m => m.id === req.params.id);
  if (!model) {
    return res.status(404).json({ error: 'Model not found' });
  }
  res.json(model);
});

export default router;
