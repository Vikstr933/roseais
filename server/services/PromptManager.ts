import { db } from '../../db';
import { sql } from 'drizzle-orm';
import { SimpleLogger } from '../utils/SimpleLogger';

const logger = new SimpleLogger('PromptManager');

export interface PromptTemplate {
  id: string;
  promptKey: string;
  version: number;
  systemPrompt: string;
  userPromptTemplate?: string;
  agentType: string;
  promptType: string;
  description?: string;
  model: string;
  maxTokens: number;
  temperature: number;
  codingGuidelines: string[];
  constraints: Record<string, any>;
  status: string;
  isDefault: boolean;
  minUserTier: string;
}

export interface CodingGuideline {
  name: string;
  category: string;
  guideline: string;
  priority: number;
  appliesTo: string[];
}

/**
 * PromptManager - Centralized prompt management system
 *
 * Features:
 * - Load prompts from database with caching
 * - Inject coding guidelines dynamically
 * - Support A/B testing and versioning
 * - Track usage metrics
 * - Handle prompt variable substitution
 */
export class PromptManager {
  private static instance: PromptManager;
  private promptCache: Map<string, PromptTemplate> = new Map();
  private guidelinesCache: Map<string, CodingGuideline[]> = new Map();
  private cacheExpiry: Map<string, number> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): PromptManager {
    if (!PromptManager.instance) {
      PromptManager.instance = new PromptManager();
    }
    return PromptManager.instance;
  }

  /**
   * Get a prompt template by key
   * Returns the default active prompt or a specific version
   */
  public async getPrompt(
    promptKey: string,
    options?: {
      version?: number;
      userTier?: string;
      forceRefresh?: boolean;
    }
  ): Promise<PromptTemplate | null> {
    const cacheKey = `${promptKey}:${options?.version || 'default'}`;

    // Check cache if not forcing refresh
    if (!options?.forceRefresh) {
      const cached = this.promptCache.get(cacheKey);
      const expiry = this.cacheExpiry.get(cacheKey);

      if (cached && expiry && Date.now() < expiry) {
        logger.info('Prompt loaded from cache', { promptKey, version: options?.version });
        return cached;
      }
    }

    try {
      // Query database for prompt
      const query = options?.version
        ? sql`
            SELECT * FROM prompt_templates
            WHERE prompt_key = ${promptKey}
              AND version = ${options.version}
              AND status = 'active'
            LIMIT 1
          `
        : sql`
            SELECT * FROM prompt_templates
            WHERE prompt_key = ${promptKey}
              AND is_default = true
              AND status = 'active'
            LIMIT 1
          `;

      const result = await db.execute(query);
      const rows = result.rows as any[];

      if (rows.length === 0) {
        logger.warn('Prompt not found', { promptKey, version: options?.version });
        return null;
      }

      const row = rows[0];
      const prompt: PromptTemplate = {
        id: row.id,
        promptKey: row.prompt_key,
        version: row.version,
        systemPrompt: row.system_prompt,
        userPromptTemplate: row.user_prompt_template,
        agentType: row.agent_type,
        promptType: row.prompt_type,
        description: row.description,
        model: row.model,
        maxTokens: row.max_tokens,
        temperature: parseFloat(row.temperature),
        codingGuidelines: Array.isArray(row.coding_guidelines)
          ? row.coding_guidelines
          : (typeof row.coding_guidelines === 'string' ? JSON.parse(row.coding_guidelines) : []),
        constraints: typeof row.constraints === 'string'
          ? JSON.parse(row.constraints)
          : row.constraints,
        status: row.status,
        isDefault: row.is_default,
        minUserTier: row.min_user_tier,
      };

      // Cache the result
      this.promptCache.set(cacheKey, prompt);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      logger.info('Prompt loaded from database', {
        promptKey,
        version: prompt.version,
        agentType: prompt.agentType
      });

      return prompt;
    } catch (error) {
      logger.error('Failed to load prompt', error as Error, { promptKey });
      return null;
    }
  }

  /**
   * Get coding guidelines for a specific agent type
   */
  public async getCodingGuidelines(
    agentType: string,
    options?: {
      category?: string;
      forceRefresh?: boolean;
    }
  ): Promise<CodingGuideline[]> {
    const cacheKey = `guidelines:${agentType}:${options?.category || 'all'}`;

    // Check cache
    if (!options?.forceRefresh) {
      const cached = this.guidelinesCache.get(cacheKey);
      const expiry = this.cacheExpiry.get(cacheKey);

      if (cached && expiry && Date.now() < expiry) {
        return cached;
      }
    }

    try {
      const query = options?.category
        ? sql`
            SELECT * FROM coding_guidelines
            WHERE enabled = true
              AND category = ${options.category}
              AND (applies_to @> ARRAY[${agentType}]::text[] OR applies_to @> ARRAY['*']::text[])
            ORDER BY priority DESC
          `
        : sql`
            SELECT * FROM coding_guidelines
            WHERE enabled = true
              AND (applies_to @> ARRAY[${agentType}]::text[] OR applies_to @> ARRAY['*']::text[])
            ORDER BY priority DESC
          `;

      const result = await db.execute(query);
      const rows = result.rows as any[];

      const guidelines: CodingGuideline[] = rows.map(row => ({
        name: row.name,
        category: row.category,
        guideline: row.guideline,
        priority: row.priority,
        appliesTo: Array.isArray(row.applies_to) ? row.applies_to : JSON.parse(row.applies_to),
      }));

      // Cache the result
      this.guidelinesCache.set(cacheKey, guidelines);
      this.cacheExpiry.set(cacheKey, Date.now() + this.CACHE_TTL);

      logger.info('Guidelines loaded', {
        agentType,
        category: options?.category,
        count: guidelines.length
      });

      return guidelines;
    } catch (error) {
      logger.error('Failed to load guidelines', error as Error, { agentType });
      return [];
    }
  }

  /**
   * Build complete system prompt with guidelines injected
   */
  public async buildSystemPrompt(
    promptKey: string,
    variables?: Record<string, any>,
    options?: {
      includeGuidelines?: boolean;
      userTier?: string;
    }
  ): Promise<{
    systemPrompt: string;
    model: string;
    maxTokens: number;
    temperature: number;
  } | null> {
    const prompt = await this.getPrompt(promptKey, { userTier: options?.userTier });

    if (!prompt) {
      return null;
    }

    let systemPrompt = prompt.systemPrompt;

    // Inject coding guidelines if requested
    if (options?.includeGuidelines !== false && prompt.codingGuidelines.length > 0) {
      const guidelines = await this.getCodingGuidelines(prompt.agentType);

      // Filter to only requested guidelines
      const requestedGuidelines = guidelines.filter(g =>
        prompt.codingGuidelines.includes(g.name)
      );

      if (requestedGuidelines.length > 0) {
        const guidelinesText = requestedGuidelines
          .map(g => `- ${g.guideline}`)
          .join('\n');

        // Check if prompt has a {{codingGuidelines}} placeholder
        if (systemPrompt.includes('{{codingGuidelines}}')) {
          systemPrompt = systemPrompt.replace('{{codingGuidelines}}', guidelinesText);
        } else {
          // Append guidelines at the end
          systemPrompt += `\n\nCODING GUIDELINES:\n${guidelinesText}`;
        }
      }
    }

    // Replace any other variables in the prompt
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        const placeholder = `{{${key}}}`;
        const replacement = Array.isArray(value) ? value.join(', ') : String(value);
        systemPrompt = systemPrompt.replace(new RegExp(placeholder, 'g'), replacement);
      }
    }

    return {
      systemPrompt,
      model: prompt.model,
      maxTokens: prompt.maxTokens,
      temperature: prompt.temperature,
    };
  }

  /**
   * Build user prompt from template with variable substitution
   */
  public buildUserPrompt(
    template: string,
    variables: Record<string, any>
  ): string {
    let userPrompt = template;

    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{{${key}}}`;
      const replacement = Array.isArray(value) ? value.join(', ') : String(value);
      userPrompt = userPrompt.replace(new RegExp(placeholder, 'g'), replacement);
    }

    return userPrompt;
  }

  /**
   * Log prompt usage for analytics
   */
  public async logUsage(
    promptTemplateId: string,
    userId: string | null,
    metrics: {
      responseTimeMs: number;
      tokensUsed: number;
      success: boolean;
      errorMessage?: string;
      securityScore?: number;
      requestContext?: Record<string, any>;
    }
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO prompt_usage_logs (
          prompt_template_id,
          user_id,
          agent_type,
          request_context,
          response_time_ms,
          tokens_used,
          success,
          error_message,
          security_score
        ) VALUES (
          ${promptTemplateId},
          ${userId},
          ${metrics.requestContext?.agentType || 'unknown'},
          ${JSON.stringify(metrics.requestContext || {})},
          ${metrics.responseTimeMs},
          ${metrics.tokensUsed},
          ${metrics.success},
          ${metrics.errorMessage || null},
          ${metrics.securityScore || null}
        )
      `);

      // Update prompt template usage stats
      await db.execute(sql`
        UPDATE prompt_templates
        SET usage_count = usage_count + 1
        WHERE id = ${promptTemplateId}
      `);
    } catch (error) {
      // Don't throw - logging failures shouldn't break the main flow
      logger.error('Failed to log prompt usage', error as Error, { promptTemplateId });
    }
  }

  /**
   * Clear all caches
   */
  public clearCache(): void {
    this.promptCache.clear();
    this.guidelinesCache.clear();
    this.cacheExpiry.clear();
    logger.info('Prompt cache cleared');
  }

  /**
   * Get constraints from prompt template
   */
  public async getConstraints(promptKey: string): Promise<Record<string, any>> {
    const prompt = await this.getPrompt(promptKey);
    return prompt?.constraints || {};
  }
}

// Export singleton instance
export const promptManager = PromptManager.getInstance();
