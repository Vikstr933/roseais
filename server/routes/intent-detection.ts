import { Router } from 'express';
import { multiModelAI, AIRequest } from '../services/MultiModelAIService';
import { SimpleLogger } from '../utils/SimpleLogger';

const router = Router();
const logger = new SimpleLogger('IntentDetection');

interface IntentDetectionRequest {
  prompt: string;
  hasExistingFiles: boolean;
  fileCount?: number;
}

interface IntentDetectionResponse {
  intent: 'deploy' | 'modify' | 'generate';
  confidence: number;
  reasoning: string;
}

/**
 * AI-based intent detection endpoint
 * Uses AI to classify user intent instead of keyword matching
 */
router.post('/detect', async (req, res) => {
  try {
    const { prompt, hasExistingFiles, fileCount = 0 }: IntentDetectionRequest = req.body;

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required' });
    }

    logger.info('Detecting intent for prompt', { prompt: prompt.substring(0, 100), hasExistingFiles, fileCount });

    // Build context-aware system prompt
    const systemPrompt = `You are an intent classification system. Your task is to analyze a user's prompt and determine their intent.

Context:
- User has ${hasExistingFiles ? `${fileCount} existing files` : 'no existing files'} in their project
- You need to classify the intent into one of three categories: 'deploy', 'modify', or 'generate'

Intent Categories:
1. **deploy**: User wants to run/start/restart the dev server or preview the app
   - Examples: "run dev server", "start preview", "show me the app", "launch it"
   - Only valid if user has existing files

2. **modify**: User wants to change, update, or enhance existing code
   - Examples: "make it more colorful", "add animations", "change the button style", "fix the layout", "improve the design"
   - Only valid if user has existing files
   - Includes requests to add features, change styling, fix bugs, improve UX

3. **generate**: User wants to create a new app/project/component from scratch
   - Examples: "create a todo app", "build a new dashboard", "make a calculator", "generate a new project"
   - Valid whether or not user has existing files

Rules:
- If user has NO existing files, intent can only be 'generate'
- If user has existing files and asks to run/start/preview, intent is 'deploy'
- If user has existing files and asks to change/update/add/improve, intent is 'modify'
- If user has existing files but explicitly says "create new" or "build new", intent is 'generate'
- Be smart about context: "make the template more animated" = modify, not generate

Respond with ONLY a JSON object in this exact format:
{
  "intent": "deploy" | "modify" | "generate",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this intent was chosen"
}`;

    const userPrompt = `User prompt: "${prompt}"

Context: ${hasExistingFiles ? `User has ${fileCount} existing files` : 'User has no existing files'}

Classify the intent.`;

    // Use a fast, cost-effective model for classification
    const aiRequest: AIRequest = {
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 200, // Small response for classification
      temperature: 0.1, // Low temperature for consistent classification
      useCase: 'classification',
      priority: 'speed' // Prioritize speed over quality for this quick check
    };

    const startTime = Date.now();
    const response = await multiModelAI.generate(aiRequest);
    const elapsed = Date.now() - startTime;

    logger.info(`Intent detection completed in ${elapsed}ms`);

    if (!response.content) {
      throw new Error('No response from AI');
    }

    // Parse AI response
    let intentResult: IntentDetectionResponse;
    try {
      // Try to extract JSON from response (might be wrapped in markdown)
      let content = response.content.trim();
      
      // Remove markdown code blocks if present
      if (content.startsWith('```')) {
        content = content.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
      }

      // Try to find JSON object
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        intentResult = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: try parsing entire content
        intentResult = JSON.parse(content);
      }

      // Validate intent value
      if (!['deploy', 'modify', 'generate'].includes(intentResult.intent)) {
        throw new Error(`Invalid intent: ${intentResult.intent}`);
      }

      // Validate confidence
      if (typeof intentResult.confidence !== 'number' || intentResult.confidence < 0 || intentResult.confidence > 1) {
        intentResult.confidence = 0.8; // Default confidence
      }

      // Ensure reasoning exists
      if (!intentResult.reasoning) {
        intentResult.reasoning = `Classified as ${intentResult.intent} based on prompt analysis`;
      }

    } catch (parseError) {
      logger.warning('Failed to parse AI response, using fallback logic', { error: parseError, content: response.content });
      
      // Fallback to keyword-based detection if AI response is invalid
      const lowerPrompt = prompt.toLowerCase();
      let fallbackIntent: 'deploy' | 'modify' | 'generate' = 'generate';
      
      if (hasExistingFiles) {
        if (lowerPrompt.match(/\b(run|start|restart|launch|preview|show|open|deploy)\b/)) {
          fallbackIntent = 'deploy';
        } else if (lowerPrompt.match(/\b(fix|change|update|modify|edit|add|remove|improve|enhance|make|style|color|animated)\b/)) {
          fallbackIntent = 'modify';
        } else if (!lowerPrompt.match(/\b(create|build|generate|new)\s+(a|an|app|project|component)\b/)) {
          fallbackIntent = 'modify'; // Default to modify if files exist
        }
      }
      
      intentResult = {
        intent: fallbackIntent,
        confidence: 0.7,
        reasoning: 'Fallback classification used due to AI response parsing error'
      };
    }

    logger.info('Intent detected', { intent: intentResult.intent, confidence: intentResult.confidence, reasoning: intentResult.reasoning });

    res.json(intentResult);

  } catch (error) {
    logger.error('Intent detection failed', { error });
    res.status(500).json({ 
      error: 'Failed to detect intent',
      intent: 'generate', // Safe default
      confidence: 0.5,
      reasoning: 'Error occurred during intent detection'
    });
  }
});

export default router;

