/**
 * Multi-Model AI Service
 *
 * Provides unified interface for multiple AI providers:
 * - Anthropic Claude 3.5
 * - OpenAI GPT-4
 * - Google Gemini
 *
 * Features:
 * - Automatic failover between providers
 * - Load balancing and rate limiting
 * - Model-specific optimization
 * - Cost optimization
 * - Quality scoring and selection
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { Logger } from '../utils/Logger';
import { RateLimiter } from '../utils/RateLimiter';
import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { userUsage } from '../../db/schema';

const logger = new SimpleLogger('MultiModelAIService');

export interface ModelConfig {
  provider: 'anthropic' | 'openai' | 'gemini';
  model: string;
  maxTokens: number;
  temperature: number;
  costPerToken: number; // Cost per 1K tokens
  qualityScore: number; // 1-10 rating for code quality
  enabled: boolean;
}

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  useCase: 'code_generation' | 'code_review' | 'explanation' | 'optimization';
  priority?: 'speed' | 'quality' | 'cost';
  userId?: string;
  sessionId?: string;
}

export interface AIResponse {
  content: string;
  provider: string;
  model: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    cost: number;
  };
  responseTime: number;
  qualityMetrics?: {
    score: number;
    codeComplexity?: number;
    readability?: number;
  };
}

export class MultiModelAIService {
  private anthropic?: Anthropic;
  private openai?: OpenAI;
  private limiter: RateLimiter;
  private modelConfigs: ModelConfig[];
  private failoverHistory: Map<string, number> = new Map();

  constructor() {
    this.limiter = new RateLimiter(10); // 10 requests per second across all models
    this.initializeProviders();
    this.setupModelConfigs();
  }

  private initializeProviders() {
    // Initialize Anthropic
    if (process.env.ANTHROPIC_API_KEY) {
      this.anthropic = new Anthropic({
        apiKey: process.env.ANTHROPIC_API_KEY,
      });
      logger.info('Anthropic Claude initialized');
    }

    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      logger.info('OpenAI GPT initialized');
    }

    // TODO: Initialize Gemini when API becomes available
    logger.info('Multi-model AI service initialized');
  }

  private setupModelConfigs() {
    this.modelConfigs = [
      // Anthropic Models
      {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 8192,
        temperature: 0.7,
        costPerToken: 0.003, // $3 per 1M tokens
        qualityScore: 10.0, // Best model for code generation
        enabled: !!this.anthropic
      },
      {
        provider: 'anthropic',
        model: 'claude-3-5-sonnet-20241022',
        maxTokens: 8192,
        temperature: 0.7,
        costPerToken: 0.003, // $3 per 1M tokens
        qualityScore: 9.5, // Fallback option
        enabled: !!this.anthropic
      },
      {
        provider: 'anthropic',
        model: 'claude-3-haiku-20240307',
        maxTokens: 4096,
        temperature: 0.7,
        costPerToken: 0.00025, // $0.25 per 1M tokens
        qualityScore: 8.0, // Fast and cost-effective
        enabled: !!this.anthropic
      },

      // OpenAI Models
      {
        provider: 'openai',
        model: 'gpt-4o',
        maxTokens: 8192,
        temperature: 0.7,
        costPerToken: 0.005, // $5 per 1M tokens
        qualityScore: 9.0,
        enabled: !!this.openai
      },
      {
        provider: 'openai',
        model: 'gpt-4o-mini',
        maxTokens: 16384,
        temperature: 0.7,
        costPerToken: 0.00015, // $0.15 per 1M tokens
        qualityScore: 8.5,
        enabled: !!this.openai
      },
      {
        provider: 'openai',
        model: 'gpt-3.5-turbo',
        maxTokens: 4096,
        temperature: 0.7,
        costPerToken: 0.0005, // $0.5 per 1M tokens
        qualityScore: 7.5,
        enabled: !!this.openai
      },

      // Gemini Models (placeholder for future implementation)
      {
        provider: 'gemini',
        model: 'gemini-1.5-pro',
        maxTokens: 8192,
        temperature: 0.7,
        costPerToken: 0.00125, // $1.25 per 1M tokens
        qualityScore: 8.8,
        enabled: false // Not implemented yet
      }
    ];
  }

  async generate(request: AIRequest): Promise<AIResponse> {
    const startTime = Date.now();

    try {
      console.log('🌐 MultiModelAIService: Starting generation');
      console.log('📋 MultiModelAIService: Request details:', {
        useCase: request.useCase,
        priority: request.priority,
        maxTokens: request.maxTokens
      });

      // Select best model based on request criteria
      console.log('🔍 MultiModelAIService: Selecting best model');
      const selectedModel = this.selectBestModel(request);

      if (!selectedModel) {
        throw new Error('No suitable AI model available');
      }

      console.log('✅ MultiModelAIService: Model selected:', {
        provider: selectedModel.provider,
        model: selectedModel.model
      });

      logger.info('Generating with selected model', {
        provider: selectedModel.provider,
        model: selectedModel.model,
        useCase: request.useCase,
        priority: request.priority
      });

      // Execute with rate limiting
      console.log('⏳ MultiModelAIService: Waiting for rate limiter');
      const response = await this.limiter.run(() =>
        this.executeGeneration(selectedModel, request)
      );
      console.log('✅ MultiModelAIService: Rate limiter passed, generation complete');

      const responseTime = Date.now() - startTime;
      console.log(`⏱️ MultiModelAIService: Total response time: ${responseTime}ms`);

      const aiResponse: AIResponse = {
        ...response,
        responseTime,
        qualityMetrics: this.calculateQualityMetrics(response.content, selectedModel)
      };

      logger.info('Generation completed successfully', {
        provider: selectedModel.provider,
        model: selectedModel.model,
        responseTime,
        tokens: aiResponse.usage.totalTokens,
        cost: aiResponse.usage.cost
      });

      // Track usage for cost monitoring
      if (request.userId) {
        await this.trackUsage({
          userId: request.userId,
          serviceName: selectedModel.provider,
          requestType: request.useCase,
          tokensUsed: aiResponse.usage.totalTokens,
          cost: aiResponse.usage.cost,
          sessionId: request.sessionId,
          model: selectedModel.model,
        });
      }

      return aiResponse;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Generation failed', error as Error);

      throw new Error(`AI generation failed: ${errorMessage}`);
    }
  }

  private selectBestModel(request: AIRequest): ModelConfig | null {
    const availableModels = this.modelConfigs.filter(config =>
      config.enabled && this.getFailureRate(config) < 0.5 // Less than 50% failure rate
    );

    if (availableModels.length === 0) {
      return null;
    }

    // Score models based on request priority
    const scoredModels = availableModels.map(model => ({
      model,
      score: this.calculateModelScore(model, request)
    }));

    // Sort by score descending
    scoredModels.sort((a, b) => b.score - a.score);

    return scoredModels[0].model;
  }

  private calculateModelScore(model: ModelConfig, request: AIRequest): number {
    let score = 0;

    switch (request.priority) {
      case 'speed':
        // Favor faster, smaller models
        score = model.provider === 'openai' && model.model.includes('mini') ? 10 :
                model.provider === 'anthropic' && model.model.includes('haiku') ? 9 :
                model.costPerToken < 0.001 ? 8 : 5;
        break;

      case 'quality':
        // Favor high-quality models
        score = model.qualityScore;
        break;

      case 'cost':
        // Favor cost-effective models
        score = 10 - (model.costPerToken * 1000); // Invert cost for scoring
        break;

      default:
        // Balanced scoring
        score = (model.qualityScore * 0.4) +
                ((10 - model.costPerToken * 1000) * 0.3) +
                (model.maxTokens / 1000 * 0.3);
    }

    // Adjust for use case
    if (request.useCase === 'code_generation' && model.provider === 'anthropic') {
      score += 1; // Claude tends to be better at code generation
    }

    if (request.useCase === 'explanation' && model.provider === 'openai') {
      score += 0.5; // GPT good at explanations
    }

    return score;
  }

  private async executeGeneration(model: ModelConfig, request: AIRequest): Promise<Omit<AIResponse, 'responseTime' | 'qualityMetrics'>> {
    const maxTokens = request.maxTokens || model.maxTokens;
    const temperature = request.temperature || model.temperature;

    console.log('🎯 executeGeneration: Starting', {
      provider: model.provider,
      model: model.model,
      maxTokens,
      temperature
    });

    try {
      switch (model.provider) {
        case 'anthropic':
          console.log('🤖 executeGeneration: Calling Anthropic API');
          const anthropicResult = await this.generateWithAnthropic(model, request, maxTokens, temperature);
          console.log('✅ executeGeneration: Anthropic API completed');
          return anthropicResult;

        case 'openai':
          console.log('🤖 executeGeneration: Calling OpenAI API');
          const openaiResult = await this.generateWithOpenAI(model, request, maxTokens, temperature);
          console.log('✅ executeGeneration: OpenAI API completed');
          return openaiResult;

        case 'gemini':
          console.log('🤖 executeGeneration: Calling Gemini API');
          const geminiResult = await this.generateWithGemini(model, request, maxTokens, temperature);
          console.log('✅ executeGeneration: Gemini API completed');
          return geminiResult;

        default:
          throw new Error(`Unsupported provider: ${model.provider}`);
      }
    } catch (error) {
      console.error('❌ executeGeneration: Error occurred:', error);
      // Record failure for this model
      this.recordFailure(model);
      throw error;
    }
  }

  private async generateWithAnthropic(
    model: ModelConfig,
    request: AIRequest,
    maxTokens: number,
    temperature: number
  ): Promise<Omit<AIResponse, 'responseTime' | 'qualityMetrics'>> {
    console.log('🔵 generateWithAnthropic: Starting Anthropic API call');
    console.log('📊 generateWithAnthropic: Config:', {
      model: model.model,
      maxTokens,
      temperature,
      promptLength: request.prompt.length,
      systemPromptLength: request.systemPrompt?.length || 0
    });

    if (!this.anthropic) {
      throw new Error('Anthropic client not initialized');
    }

    console.log('⏳ generateWithAnthropic: Making API request to Claude...');
    const apiStartTime = Date.now();
    const response = await this.anthropic.messages.create({
      model: model.model,
      max_tokens: maxTokens,
      temperature,
      system: request.systemPrompt || 'You are a helpful AI assistant.',
      messages: [
        {
          role: 'user',
          content: request.prompt
        }
      ]
    });
    const apiElapsed = Date.now() - apiStartTime;
    console.log(`✅ generateWithAnthropic: API call completed in ${apiElapsed}ms`);

    const content = response.content[0]?.type === 'text' ? response.content[0].text : '';
    const usage = response.usage;

    return {
      content,
      provider: 'anthropic',
      model: model.model,
      usage: {
        promptTokens: usage.input_tokens,
        completionTokens: usage.output_tokens,
        totalTokens: usage.input_tokens + usage.output_tokens,
        cost: (usage.input_tokens + usage.output_tokens) * model.costPerToken / 1000
      }
    };
  }

  private async generateWithOpenAI(
    model: ModelConfig,
    request: AIRequest,
    maxTokens: number,
    temperature: number
  ): Promise<Omit<AIResponse, 'responseTime' | 'qualityMetrics'>> {
    if (!this.openai) {
      throw new Error('OpenAI client not initialized');
    }

    const messages: OpenAI.ChatCompletionMessageParam[] = [];

    if (request.systemPrompt) {
      messages.push({ role: 'system', content: request.systemPrompt });
    }

    messages.push({ role: 'user', content: request.prompt });

    const response = await this.openai.chat.completions.create({
      model: model.model,
      messages,
      max_tokens: maxTokens,
      temperature
    });

    const content = response.choices[0]?.message?.content || '';
    const usage = response.usage;

    return {
      content,
      provider: 'openai',
      model: model.model,
      usage: {
        promptTokens: usage?.prompt_tokens || 0,
        completionTokens: usage?.completion_tokens || 0,
        totalTokens: usage?.total_tokens || 0,
        cost: (usage?.total_tokens || 0) * model.costPerToken / 1000
      }
    };
  }

  private async generateWithGemini(
    model: ModelConfig,
    request: AIRequest,
    maxTokens: number,
    temperature: number
  ): Promise<Omit<AIResponse, 'responseTime' | 'qualityMetrics'>> {
    // TODO: Implement Gemini API when available
    throw new Error('Gemini provider not yet implemented');
  }

  private calculateQualityMetrics(content: string, model: ModelConfig) {
    // Basic quality metrics calculation
    const lines = content.split('\n').length;
    const complexity = Math.min(10, lines / 10); // Simple complexity based on lines
    const readability = model.qualityScore * 0.8; // Base readability on model quality

    return {
      score: model.qualityScore,
      codeComplexity: complexity,
      readability
    };
  }

  private getFailureRate(model: ModelConfig): number {
    const key = `${model.provider}-${model.model}`;
    return this.failoverHistory.get(key) || 0;
  }

  private recordFailure(model: ModelConfig) {
    const key = `${model.provider}-${model.model}`;
    const currentRate = this.failoverHistory.get(key) || 0;
    this.failoverHistory.set(key, Math.min(1.0, currentRate + 0.1));

    // Reset failure rate after 5 minutes
    setTimeout(() => {
      const currentRate = this.failoverHistory.get(key) || 0;
      this.failoverHistory.set(key, Math.max(0, currentRate - 0.1));
    }, 5 * 60 * 1000);
  }

  // Model management methods
  getAvailableModels(): ModelConfig[] {
    return this.modelConfigs.filter(config => config.enabled);
  }

  toggleModel(provider: string, model: string, enabled: boolean) {
    const config = this.modelConfigs.find(c => c.provider === provider && c.model === model);
    if (config) {
      config.enabled = enabled;
      logger.info(`Model ${provider}/${model} ${enabled ? 'enabled' : 'disabled'}`);
    }
  }

  getUsageStats() {
    return {
      totalRequests: Array.from(this.failoverHistory.values()).reduce((sum, rate) => sum + rate, 0),
      modelFailureRates: Object.fromEntries(this.failoverHistory),
      availableModels: this.getAvailableModels().length,
      totalModels: this.modelConfigs.length
    };
  }

  // Health check for all providers
  async healthCheck(): Promise<Record<string, boolean>> {
    const health: Record<string, boolean> = {};

    // Check Anthropic
    if (this.anthropic) {
      try {
        await this.anthropic.messages.create({
          model: 'claude-3-haiku-20240307',
          max_tokens: 10,
          messages: [{ role: 'user', content: 'Test' }]
        });
        health.anthropic = true;
      } catch {
        health.anthropic = false;
      }
    }

    // Check OpenAI
    if (this.openai) {
      try {
        await this.openai.chat.completions.create({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: 'Test' }],
          max_tokens: 5
        });
        health.openai = true;
      } catch {
        health.openai = false;
      }
    }

    return health;
  }

  /**
   * Track AI usage for cost monitoring
   */
  private async trackUsage(data: {
    userId: string;
    serviceName: string;
    requestType: string;
    tokensUsed: number;
    cost: number;
    sessionId?: string;
    model: string;
  }): Promise<void> {
    try {
      await db.insert(userUsage).values({
        userId: data.userId,
        serviceName: data.serviceName,
        requestType: data.requestType,
        tokensUsed: data.tokensUsed,
        cost: data.cost,
        createdAt: new Date().toISOString(),
        sessionId: data.sessionId,
        metadata: JSON.stringify({
          model: data.model,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch (error) {
      logger.error('Failed to track usage:', error);
      // Don't throw - we don't want to fail the request if tracking fails
    }
  }
}

// Export singleton instance
export const multiModelAI = new MultiModelAIService();
export default multiModelAI;