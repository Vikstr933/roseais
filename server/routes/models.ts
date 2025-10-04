import { Router } from 'express';

const router = Router();

// Define available models - Updated with latest 2024/2025 models
const models = [
  {
    id: 'claude-3-5-sonnet-20241022',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    description:
      'Latest Claude model with improved reasoning and coding capabilities',
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
