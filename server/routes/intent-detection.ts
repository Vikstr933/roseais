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
  intent: 'deploy' | 'modify' | 'generate' | 'describe' | 'conversational';
  confidence: number;
  reasoning: string;
  shouldGenerateCode?: boolean; // Whether this requires code generation
  requiresProjectFiles?: boolean; // Whether this needs project context
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

    // Build context-aware system prompt - FULLY AI-DRIVEN, NO KEYWORDS
    const systemPrompt = `You are an intelligent intent classification system. Analyze the user's message and determine their true intent using natural language understanding, NOT keyword matching.

Context:
- User has ${hasExistingFiles ? `${fileCount} existing files` : 'no existing files'} in their project
- You need to classify the intent into one of these categories: 'deploy', 'modify', 'generate', 'describe', or 'conversational'

Intent Categories (understand the MEANING, not keywords):

1. **conversational**: User wants to chat, ask questions, get help, or have a general conversation
   - Examples: "how are you?", "what can you do?", "help me understand React hooks", "explain TypeScript", "thanks!", "that's great"
   - General questions, greetings, explanations, clarifications
   - Does NOT require code generation or file modifications
   - Should get a conversational AI response

2. **deploy**: User wants to run/start/restart the dev server or preview the app
   - Examples: "run dev server", "start preview", "show me the app", "launch it", "open it"
   - Only valid if user has existing files
   - Requires: shouldGenerateCode=false, requiresProjectFiles=true

3. **modify**: User wants to change, update, or enhance existing code
   - Examples: "make it more colorful", "add animations", "change the button style", "fix the layout", "improve the design", "make it responsive"
   - Only valid if user has existing files
   - Requires: shouldGenerateCode=true, requiresProjectFiles=true

4. **describe**: User wants to understand or get information about the existing project
   - Examples: "describe the project", "what does this app do", "explain the code", "tell me about this project", "what is this app"
   - Only valid if user has existing files
   - Requires: shouldGenerateCode=false, requiresProjectFiles=true

5. **generate**: User wants to create a new app/project/component from scratch
   - Examples: "create a todo app", "build a new dashboard", "make a calculator", "generate a new project"
   - Valid whether or not user has existing files
   - Requires: shouldGenerateCode=true, requiresProjectFiles=false

CRITICAL RULES:
- Use NATURAL LANGUAGE UNDERSTANDING, not keyword matching
- Understand context and intent, not just surface-level words
- If the message is conversational (greeting, question, explanation request), use 'conversational'
- If user asks "how do I..." or "what is..." or "explain...", it's likely conversational unless they're asking about THEIR project specifically
- "describe MY project" = describe, "explain React" = conversational
- Be smart about context and nuance

Respond with ONLY a JSON object in this exact format:
{
  "intent": "deploy" | "modify" | "generate" | "describe" | "conversational",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation of why this intent was chosen based on natural language understanding",
  "shouldGenerateCode": boolean,
  "requiresProjectFiles": boolean
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
      if (!['deploy', 'modify', 'generate', 'describe', 'conversational'].includes(intentResult.intent)) {
        throw new Error(`Invalid intent: ${intentResult.intent}`);
      }

      // Ensure boolean fields exist
      if (typeof intentResult.shouldGenerateCode !== 'boolean') {
        intentResult.shouldGenerateCode = ['modify', 'generate'].includes(intentResult.intent);
      }
      if (typeof intentResult.requiresProjectFiles !== 'boolean') {
        intentResult.requiresProjectFiles = ['deploy', 'modify', 'describe'].includes(intentResult.intent);
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
      logger.warning('Failed to parse AI response, retrying with AI', { error: parseError, content: response.content });
      
      // Retry with AI instead of keyword fallback - FULLY AI-DRIVEN
      try {
        const retryPrompt = `The previous classification attempt failed. Please analyze this user message again and classify it:

User message: "${prompt}"
Context: ${hasExistingFiles ? `User has ${fileCount} existing files` : 'User has no existing files'}

Respond with ONLY a JSON object:
{
  "intent": "deploy" | "modify" | "generate" | "describe" | "conversational",
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation",
  "shouldGenerateCode": boolean,
  "requiresProjectFiles": boolean
}`;

        const retryResponse = await multiModelAI.generate({
          prompt: retryPrompt,
          systemPrompt: 'You are an intent classification system. Analyze the user message and classify intent.',
          maxTokens: 300,
          temperature: 0.1,
          useCase: 'classification',
          priority: 'speed'
        });

        if (retryResponse.content) {
          let retryContent = retryResponse.content.trim();
          if (retryContent.startsWith('```')) {
            retryContent = retryContent.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
          }
          const jsonMatch = retryContent.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            intentResult = JSON.parse(jsonMatch[0]);
            // Validate and set defaults
            if (!['deploy', 'modify', 'generate', 'describe', 'conversational'].includes(intentResult.intent)) {
              throw new Error(`Invalid intent: ${intentResult.intent}`);
            }
            if (typeof intentResult.shouldGenerateCode !== 'boolean') {
              intentResult.shouldGenerateCode = ['modify', 'generate'].includes(intentResult.intent);
            }
            if (typeof intentResult.requiresProjectFiles !== 'boolean') {
              intentResult.requiresProjectFiles = ['deploy', 'modify', 'describe'].includes(intentResult.intent);
            }
          } else {
            throw new Error('No JSON found in retry response');
          }
        } else {
          throw new Error('No content in retry response');
        }
      } catch (retryError) {
        logger.error('AI retry also failed, using safe default', { error: retryError });
        // Last resort: use conversational as safe default (won't break anything)
        intentResult = {
          intent: 'conversational',
          confidence: 0.5,
          reasoning: 'AI classification failed, defaulting to conversational',
          shouldGenerateCode: false,
          requiresProjectFiles: false
        };
      }
    }

    logger.info('Intent detected', { intent: intentResult.intent, confidence: intentResult.confidence, reasoning: intentResult.reasoning });

    res.json(intentResult);

  } catch (error) {
    logger.error('Intent detection failed', { error });
    res.status(500).json({ 
      error: 'Failed to detect intent',
      intent: 'conversational', // Safe default - won't trigger code generation
      confidence: 0.5,
      reasoning: 'Error occurred during intent detection, defaulting to conversational',
      shouldGenerateCode: false,
      requiresProjectFiles: false
    });
  }
});

export default router;

