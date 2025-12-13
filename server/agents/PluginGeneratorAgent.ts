import Anthropic from '@anthropic-ai/sdk';
import * as ts from 'typescript';
import { BaseAgent } from './BaseAgent';
import { PluginSecurityAnalyzer, SecurityAnalysisResult } from '../services/PluginSecurityAnalyzer';
import { SimpleLogger } from '../utils/SimpleLogger';
import { promptManager } from '../services/PromptManager';
import { nanoid } from 'nanoid';

const logger = new SimpleLogger('PluginGeneratorAgent');

export interface PluginGenerationRequest {
  userId: string;
  prompt: string;
  serviceName: string;
  requiredCapabilities: string[];
  oauthRequired?: boolean;
  estimatedComplexity?: 'simple' | 'medium' | 'complex';
  userTier: string;
  userRole?: 'user' | 'admin' | 'superadmin';
}

export interface PluginGenerationResult {
  pluginId: string;
  status: 'pending_review' | 'approved' | 'rejected' | 'blocked';
  generatedCode: string;
  securityScore: number;
  flaggedIssues: SecurityAnalysisResult['issues'];
  estimatedCost: number;
  reviewRequired: boolean;
  rejectionReason?: string;
  metadata: {
    pluginName: string;
    description: string;
    capabilities: string[];
    requiresAuth: boolean;
    authType?: string;
    credentialsRequired: Record<string, any>;
  };
}

export interface IntentAnalysis {
  safe: boolean;
  intent: string;
  blockedReason?: string;
  suggestedCapabilities: string[];
  suggestedService: string;
  complexity: 'simple' | 'medium' | 'complex';
}

interface PromptConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  systemPrompt: string;
}

/**
 * PluginGeneratorAgent
 *
 * AI agent specialized in generating secure, high-quality plugins for user integrations.
 * Implements multi-stage security validation and code analysis.
 */
export class PluginGeneratorAgent extends BaseAgent {
  private static readonly MAX_GENERATION_ATTEMPTS = 3;
  private anthropic: Anthropic;
  private securityAnalyzer: PluginSecurityAnalyzer;
  private model: string;

  private static readonly BLOCKED_INTENTS = [
    'crypto_mining',
    'cryptocurrency',
    'ddos',
    'denial_of_service',
    'data_exfiltration',
    'data_theft',
    'privilege_escalation',
    'system_modification',
    'credential_stealing',
    'password_cracking',
    'spam_generation',
    'phishing',
    'malware',
    'virus',
    'exploit',
    'hack',
    'backdoor',
  ];

  private static readonly ALLOWED_CAPABILITIES = [
    'read_messages',
    'send_messages',
    'read_events',
    'create_events',
    'read_tasks',
    'create_tasks',
    'update_tasks',
    'read_analytics',
    'notifications',
    'read_users',
    'read_channels',
    'create_channels',
    'file_upload',
    'read_files',
    'search',
  ];

  constructor() {
    super('plugin-generator-agent');

    this.model = 'claude-sonnet-4-5-20250929';

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.securityAnalyzer = new PluginSecurityAnalyzer();
  }

  protected async setup(): Promise<void> {
    logger.info('PluginGeneratorAgent initialized');
  }

  async executeTask(task: string): Promise<any> {
    // This agent is primarily used via generatePlugin method
    logger.info(`Executing task: ${task}`);
    return { success: true, message: 'Use generatePlugin method for plugin generation' };
  }

  private buildGenerationUserPrompt(
    params: { prompt: string; capabilities: string[]; serviceName: string; complexity: 'simple' | 'medium' | 'complex' },
    template: string,
    validationHint?: string
  ): string {
    let prompt = `Generate a plugin for: ${params.prompt}

Use this template as a guide:

${template}

Requirements:
- Plugin should be production-ready
- Include proper OAuth setup if needed
- Implement tools for the requested capabilities
- Add comprehensive error handling
- Use Zod for parameter validation
- Include rate limiting configuration
- Output modern JavaScript (ES2020) only. Do not use TypeScript-specific syntax or type annotations.`;

    if (validationHint) {
      prompt += `\n\nThe previous attempt failed with the following issue:\n${validationHint}\nPlease correct it and ensure the code parses without syntax errors.`;
    }

    return prompt;
  }

  private async generateCodeAttempt(
    params: {
      prompt: string;
      serviceName: string;
      capabilities: string[];
      complexity: 'simple' | 'medium' | 'complex';
    },
    template: string,
    promptConfig: PromptConfig,
    validationHint?: string
  ): Promise<{
    code: string;
    pluginName: string;
    description: string;
    capabilities: string[];
    requiresAuth: boolean;
    authType?: string;
    credentialsRequired: Record<string, any>;
    tokensUsed: number;
  }> {
    const userPrompt = this.buildGenerationUserPrompt(params, template, validationHint);

    const response = await this.anthropic.messages.create({
      model: promptConfig.model,
      max_tokens: promptConfig.maxTokens,
      temperature: promptConfig.temperature,
      system: promptConfig.systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let code = content.text;
    code = code
      .replace(/```(?:typescript|ts|javascript|js)?\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    const sanitizedCode = this.sanitizeGeneratedCode(code);

    const pluginName = this.extractPluginName(sanitizedCode, params.serviceName);
    const description = this.extractDescription(sanitizedCode, params.prompt);
    const requiresAuth = sanitizedCode.includes('requiresAuth: true') ||
      sanitizedCode.includes('requiresAuth:true') ||
      sanitizedCode.match(/requiresAuth\s*:\s*true/i) !== null;
    const authType = sanitizedCode.includes('oauth') || sanitizedCode.includes('OAuth') ? 'oauth2' :
      sanitizedCode.includes('apiKey') || sanitizedCode.includes('api_key') ? 'api_key' : undefined;

    let credentialsRequired = this.detectCredentialRequirements(sanitizedCode, params.serviceName);
    if (requiresAuth && Object.keys(credentialsRequired).length === 0) {
      logger.warn(`Plugin requires auth but no credentials detected for ${params.serviceName}, adding default field`);
      credentialsRequired = {
        apiKey: {
          label: `${params.serviceName.charAt(0).toUpperCase() + params.serviceName.slice(1)} API Key`,
          type: 'password',
          required: true,
          description: `API key or access token for ${params.serviceName}. Check your ${params.serviceName} account settings or documentation.`,
          placeholder: 'Enter your API key or token'
        }
      };
    }

    return {
      code: sanitizedCode,
      pluginName,
      description,
      capabilities: params.capabilities || [],
      requiresAuth,
      authType,
      credentialsRequired,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  /**
   * Robust JSON parsing from Claude responses
   * Handles markdown code blocks, extra text, trailing commas, etc.
   */
  private parseJSONResponse(text: string): any {
    let cleaned = text.trim();

    try {
      // Strategy 1: Try parsing as-is first
      return JSON.parse(cleaned);
    } catch (e1) {
      // Strategy 2: Remove markdown code blocks
      try {
        cleaned = cleaned.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        return JSON.parse(cleaned);
      } catch (e2) {
        // Strategy 3: Extract JSON object between first { and last }
        try {
          const firstBrace = cleaned.indexOf('{');
          const lastBrace = cleaned.lastIndexOf('}');
          if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
            cleaned = cleaned.substring(firstBrace, lastBrace + 1);
            return JSON.parse(cleaned);
          }
        } catch (e3) {
          // Strategy 4: Remove trailing commas before closing braces/brackets
          try {
            cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');
            return JSON.parse(cleaned);
          } catch (e4) {
            // Strategy 5: Try extracting from code block with language identifier
            try {
              const codeBlockMatch = text.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
              if (codeBlockMatch && codeBlockMatch[1]) {
                return JSON.parse(codeBlockMatch[1]);
              }
            } catch (e5) {
              // Strategy 6: Last resort - find and extract JSON-like structure
              try {
                const jsonMatch = text.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                  let jsonStr = jsonMatch[0];
                  // Remove trailing commas
                  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
                  return JSON.parse(jsonStr);
                }
              } catch (e6) {
                // All strategies failed
                logger.error(`JSON parsing failed after all strategies: ${text.substring(0, 200)}`, e6 instanceof Error ? e6 : new Error(String(e6)));
                throw new Error(`Failed to parse JSON response. Last error: ${e6 instanceof Error ? e6.message : 'Unknown'}`);
              }
            }
          }
        }
      }
    }

    throw new Error('Failed to parse JSON response after all strategies');
  }

  /**
   * Generate a plugin from user request
   */
  async generatePlugin(request: PluginGenerationRequest): Promise<PluginGenerationResult> {
    const startTime = Date.now();
    logger.info(`Starting plugin generation for user ${request.userId}, service: ${request.serviceName}`);

    try {
      // Step 1: Analyze intent and validate safety
      // Skip safety check for superadmins - they have full access
      const isSuperAdmin = request.userRole === 'superadmin';
      
      let intentAnalysis: IntentAnalysis;
      
      if (isSuperAdmin) {
        // Superadmins automatically pass safety check
        logger.info(`Superadmin ${request.userId} bypassing intent analysis - automatically safe`);
        intentAnalysis = {
          safe: true,
          intent: 'admin_approved',
          suggestedCapabilities: request.requiredCapabilities.length > 0 
            ? request.requiredCapabilities 
            : ['read_data', 'write_data'],
          suggestedService: request.serviceName || 'custom',
          complexity: request.estimatedComplexity || 'medium',
        };
      } else {
        // Regular users go through full intent analysis
        intentAnalysis = await this.analyzeIntent(request.prompt);

        if (!intentAnalysis.safe) {
          logger.warn(`Blocked unsafe intent for user ${request.userId}: ${intentAnalysis.intent}`);
          return {
            pluginId: '',
            status: 'blocked',
            generatedCode: '',
            securityScore: 0,
            flaggedIssues: [],
            estimatedCost: 0,
            reviewRequired: false,
            rejectionReason: intentAnalysis.blockedReason,
            metadata: {
              pluginName: '',
              description: '',
              capabilities: [],
              requiresAuth: false,
              credentialsRequired: {},
            },
          };
        }
      }

      // Step 2: Generate plugin code using AI
      // Ensure capabilities is always an array (never null/undefined)
      const capabilities = (request.requiredCapabilities.length > 0
        ? request.requiredCapabilities
        : intentAnalysis.suggestedCapabilities) || [];
      
      const generationResult = await this.generateSecureCode({
        prompt: request.prompt,
        serviceName: request.serviceName || intentAnalysis.suggestedService,
        capabilities: capabilities,
        complexity: request.estimatedComplexity || intentAnalysis.complexity,
      });

      // Step 3: Run static security analysis
      const analysisResults = await this.analyzeCode(generationResult.code);

      // Step 4: Calculate security score
      const securityScore = analysisResults.securityScore;

      // Step 5: Determine if manual review needed
      const reviewRequired = securityScore < 80 || analysisResults.criticalIssues > 0;

      // Step 6: Auto-reject if critical issues
      let status: PluginGenerationResult['status'] = 'approved';
      let rejectionReason: string | undefined;

      if (analysisResults.criticalIssues > 0) {
        status = 'rejected';
        rejectionReason = `Critical security issues found: ${analysisResults.issues
          .filter(i => i.severity === 'critical')
          .map(i => i.description)
          .join('; ')}`;
      } else if (reviewRequired) {
        status = 'pending_review';
      }

      const pluginId = `plugin_${nanoid(16)}`;
      const generationTime = Date.now() - startTime;

      logger.info(`Plugin generation complete: pluginId=${pluginId}, status=${status}, securityScore=${securityScore}, reviewRequired=${reviewRequired}, generationTime=${generationTime}ms`);

      return {
        pluginId,
        status,
        generatedCode: generationResult.code,
        securityScore,
        flaggedIssues: analysisResults.issues,
        estimatedCost: generationResult.tokensUsed,
        reviewRequired,
        rejectionReason,
        metadata: {
          pluginName: generationResult.pluginName,
          description: generationResult.description,
          capabilities: generationResult.capabilities,
          requiresAuth: generationResult.requiresAuth,
          authType: generationResult.authType,
          credentialsRequired: generationResult.credentialsRequired,
        },
      };
    } catch (error) {
      logger.error('Plugin generation failed', error instanceof Error ? error : new Error(String(error)));
      throw error;
    }
  }

  /**
   * Analyze user intent for safety
   */
  private async analyzeIntent(prompt: string): Promise<IntentAnalysis> {
    logger.info('Analyzing intent');

    const startTime = Date.now();

    try {
      // Load prompt from database with dynamic guidelines
      const promptConfig = await promptManager.buildSystemPrompt(
        'plugin_generator.intent_analysis',
        {
          blockedIntents: PluginGeneratorAgent.BLOCKED_INTENTS.join(', '),
          allowedCapabilities: PluginGeneratorAgent.ALLOWED_CAPABILITIES.join(', '),
          allowedServices: 'Discord, Slack, Trello, Notion, GitHub, GitLab, Linear, Asana, Todoist',
        },
        { includeGuidelines: false } // Security analysis doesn't need coding guidelines
      );

      if (!promptConfig) {
        // Fallback to hardcoded prompt if database prompt not found
        logger.warn('Database prompt not found, using fallback');
        return this.analyzeIntentFallback(prompt);
      }

      const response = await this.anthropic.messages.create({
        model: promptConfig.model,
        max_tokens: promptConfig.maxTokens,
        temperature: promptConfig.temperature,
        system: promptConfig.systemPrompt,
        messages: [
          {
            role: 'user',
            content: `Analyze this plugin request: "${prompt}"`,
          },
        ],
      });

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type');
      }

      // Parse JSON with robust error handling
      const analysis = this.parseJSONResponse(content.text);

      // Additional validation: check for blocked keywords
      const lowerPrompt = prompt.toLowerCase();
      const foundBlockedIntent = PluginGeneratorAgent.BLOCKED_INTENTS.find(intent =>
        lowerPrompt.includes(intent)
      );

      if (foundBlockedIntent) {
        return {
          safe: false,
          intent: foundBlockedIntent,
          blockedReason: `Request contains blocked intent: ${foundBlockedIntent}`,
          suggestedCapabilities: [],
          suggestedService: '',
          complexity: 'simple',
        };
      }

      // Log usage metrics
      const responseTime = Date.now() - startTime;
      await promptManager.logUsage(
        promptConfig ? 'plugin_generator.intent_analysis' : 'fallback',
        'system',
        {
          responseTimeMs: responseTime,
          tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
          success: true,
          requestContext: { agentType: 'plugin_generator', action: 'intent_analysis' }
        }
      ).catch(() => {}); // Don't fail on logging errors

      return analysis;
    } catch (error) {
      logger.error('Intent analysis failed', error instanceof Error ? error : new Error(String(error)));
      // Fail safe: reject if we can't analyze
      return {
        safe: false,
        intent: 'unknown',
        blockedReason: 'Failed to analyze intent for safety',
        suggestedCapabilities: [],
        suggestedService: '',
        complexity: 'simple',
      };
    }
  }

  /**
   * Fallback intent analysis with hardcoded prompt
   */
  private async analyzeIntentFallback(prompt: string): Promise<IntentAnalysis> {
    const systemPrompt = `You are a security analyzer for plugin generation. Analyze the user's request and determine:
1. Is this a safe, legitimate plugin request?
2. What is the primary intent?
3. What capabilities are needed?
4. What service should it integrate with?
5. What is the complexity level?

BLOCKED INTENTS:
${PluginGeneratorAgent.BLOCKED_INTENTS.join(', ')}

ALLOWED CAPABILITIES:
${PluginGeneratorAgent.ALLOWED_CAPABILITIES.join(', ')}

ALLOWED SERVICES:
Discord, Slack, Trello, Notion, GitHub, GitLab, Linear, Asana, Todoist

Respond in JSON format (no markdown code blocks):
{
  "safe": boolean,
  "intent": string,
  "blockedReason": string or null,
  "suggestedCapabilities": string[],
  "suggestedService": string,
  "complexity": "simple" | "medium" | "complex"
}`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 1000,
      temperature: 0.3,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: `Analyze this plugin request: "${prompt}"`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON with robust error handling
    const analysis = this.parseJSONResponse(content.text);

    // Additional validation: check for blocked keywords
    const lowerPrompt = prompt.toLowerCase();
    const foundBlockedIntent = PluginGeneratorAgent.BLOCKED_INTENTS.find(intent =>
      lowerPrompt.includes(intent)
    );

    if (foundBlockedIntent) {
      return {
        safe: false,
        intent: foundBlockedIntent,
        blockedReason: `Request contains blocked intent: ${foundBlockedIntent}`,
        suggestedCapabilities: [],
        suggestedService: '',
        complexity: 'simple',
      };
    }

    return analysis;
  }

  /**
   * Generate secure plugin code using AI
   */
  private async generateSecureCode(params: {
    prompt: string;
    serviceName: string;
    capabilities: string[];
    complexity: 'simple' | 'medium' | 'complex';
  }): Promise<{
    code: string;
    pluginName: string;
    description: string;
    capabilities: string[];
    requiresAuth: boolean;
    authType?: string;
    credentialsRequired: Record<string, any>;
    tokensUsed: number;
  }> {
    logger.info(`Generating plugin code for ${params.serviceName}`);

    const startTime = Date.now();
    const template = this.getPluginTemplate(params.serviceName);

    const promptConfig = await promptManager.buildSystemPrompt(
      'plugin_generator.code_generation',
      {
        capabilities: (params.capabilities || []).join(', '),
        serviceName: params.serviceName,
        complexity: params.complexity,
        codingGuidelines: '{{codingGuidelines}}',
      },
      { includeGuidelines: true }
    );

    if (!promptConfig) {
      logger.warn('Database prompt not found for code generation, using fallback');
      return this.generateSecureCodeFallback(params, template);
    }

    let validationHint: string | undefined;

    for (let attempt = 1; attempt <= PluginGeneratorAgent.MAX_GENERATION_ATTEMPTS; attempt++) {
      try {
        const result = await this.generateCodeAttempt(
          params,
          template,
          promptConfig as PromptConfig,
          validationHint
        );

        const responseTime = Date.now() - startTime;
        await promptManager.logUsage(
          'plugin_generator.code_generation',
          'system',
          {
            responseTimeMs: responseTime,
            tokensUsed: result.tokensUsed,
            success: true,
            requestContext: {
              agentType: 'plugin_generator',
              action: 'code_generation',
              serviceName: params.serviceName,
              complexity: params.complexity
            }
          }
        ).catch(() => {});

        return result;
      } catch (error) {
        if (error instanceof PluginValidationError) {
          validationHint = error.message;
          logger.warn(`Generated code failed validation: attempt=${attempt}, serviceName=${params.serviceName}, error=${error.message}`);
          continue;
        }

        logger.error('Code generation failed, using fallback', error as Error);
        break;
      }
    }

    logger.warn('Falling back to hardcoded prompt after repeated validation failures');
    return this.generateSecureCodeFallback(params, template, validationHint);
  }

  /**
   * Fallback code generation with hardcoded prompt
   */
  private async generateSecureCodeFallback(
    params: {
      prompt: string;
      serviceName: string;
      capabilities: string[];
      complexity: 'simple' | 'medium' | 'complex';
    },
    template: string,
    validationHint?: string
  ): Promise<{
    code: string;
    pluginName: string;
    description: string;
    capabilities: string[];
    requiresAuth: boolean;
    authType?: string;
    credentialsRequired: Record<string, any>;
    tokensUsed: number;
  }> {
    const systemPrompt = `You are an expert plugin developer. Generate a secure, production-ready plugin based on the BaseProductivityPlugin class.

REQUIREMENTS:
1. Extend BaseProductivityPlugin
2. Use only APPROVED packages: axios, node-fetch, discord.js, @slack/web-api, trello, @notionhq/client, zod, date-fns, uuid
3. NO file system access (fs module)
4. NO process spawning (child_process)
5. NO eval() or Function() constructors
6. NO hardcoded credentials (use plugin credential system)
7. Include proper error handling
8. Use modern JavaScript (ES2020). Do not use TypeScript syntax or type annotations.
9. Implement all required methods: initialize(), enable(), sync(), getTools(), executeAction()
10. Follow the template structure

CAPABILITIES REQUESTED: ${(params.capabilities || []).join(', ')}
SERVICE: ${params.serviceName}
COMPLEXITY: ${params.complexity}

Return ONLY the JavaScript code, no markdown code blocks, no explanations.`;

    let userPrompt = `Generate a plugin for: ${params.prompt}

Use this template as a guide:

${template}

Requirements:
- Plugin should be production-ready
- Include proper OAuth setup if needed
- Implement tools for the requested capabilities
- Add comprehensive error handling
- Use Zod for parameter validation
- Include rate limiting configuration`;

    if (validationHint) {
      userPrompt += `\n\nPrevious attempt failed with this syntax error:\n${validationHint}\nFix the issue and ensure the generated code is valid JavaScript.`;
    }

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 16000, // Increased from 4000 to handle larger plugins (Discord, etc.)
      temperature: 0.7,
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    let code = content.text;

    // Clean up markdown code blocks if present
    code = code
      .replace(/```(?:typescript|ts|javascript|js)?\n?/gi, '')
      .replace(/```\n?/g, '')
      .trim();

    const sanitizedCode = this.sanitizeGeneratedCode(code);

    // Extract metadata from generated code
    const pluginName = this.extractPluginName(sanitizedCode, params.serviceName);
    const description = this.extractDescription(sanitizedCode, params.prompt);
    const requiresAuth = sanitizedCode.includes('requiresAuth: true') || 
                        sanitizedCode.includes('requiresAuth:true') ||
                        sanitizedCode.match(/requiresAuth\s*:\s*true/i) !== null;
    const authType = sanitizedCode.includes('oauth') || sanitizedCode.includes('OAuth') ? 'oauth2' :
                     sanitizedCode.includes('apiKey') || sanitizedCode.includes('api_key') ? 'api_key' : undefined;

    // Detect credential requirements from generated code
    let credentialsRequired = this.detectCredentialRequirements(sanitizedCode, params.serviceName);
    
    // If requiresAuth is true but no credentials were detected, provide a default
    if (requiresAuth && Object.keys(credentialsRequired).length === 0) {
      logger.warn(`Plugin requires auth but no credentials detected for ${params.serviceName}, adding default field`);
      credentialsRequired = {
        apiKey: {
          label: `${params.serviceName.charAt(0).toUpperCase() + params.serviceName.slice(1)} API Key`,
          type: 'password',
          required: true,
          description: `API key or access token for ${params.serviceName}. Check your ${params.serviceName} account settings or documentation.`,
          placeholder: 'Enter your API key or token'
        }
      };
    }

    return {
      code: sanitizedCode,
      pluginName,
      description,
      capabilities: params.capabilities || [],
      requiresAuth,
      authType,
      credentialsRequired,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
  }

  private sanitizeGeneratedCode(code: string): string {
    let transpiled = code;

    try {
      const transpileResult = ts.transpileModule(code, {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          target: ts.ScriptTarget.ES2020,
          esModuleInterop: true,
          strict: false,
        },
      });
      transpiled = transpileResult.outputText;
    } catch (error) {
      throw new PluginValidationError(`TypeScript transpilation failed: ${(error as Error).message}`);
    }

    try {
      // eslint-disable-next-line no-new-func
      new Function(transpiled);
    } catch (error) {
      throw new PluginValidationError(`JavaScript syntax error: ${(error as Error).message}`);
    }

    return transpiled;
  }

  /**
   * Analyze generated code for security issues
   */
  private async analyzeCode(code: string): Promise<SecurityAnalysisResult> {
    logger.info('Analyzing generated code for security issues');
    return this.securityAnalyzer.analyze(code);
  }

  /**
   * Get plugin template for specific service
   */
  private getPluginTemplate(serviceName: string): string {
    const baseTemplate = `import { BaseProductivityPlugin, Tool, KnowledgeItem, PluginCredentials, SyncOptions, SyncResult } from '../BaseProductivityPlugin';
import { z } from 'zod';

export class {{PLUGIN_NAME}}Plugin extends BaseProductivityPlugin {
  constructor() {
    super({
      id: '{{PLUGIN_ID}}',
      name: '{{PLUGIN_NAME}}',
      description: '{{DESCRIPTION}}',
      category: 'productivity',
      version: '1.0.0',
      author: 'user',
      requiresAuth: {{REQUIRES_AUTH}},
      authType: '{{AUTH_TYPE}}',
      capabilities: {{CAPABILITIES}},
      rateLimits: {
        requestsPerMinute: 10,
        requestsPerHour: 100,
      },
    });
  }

  async initialize(userId: string): Promise<void> {
    // Initialize plugin resources
    this.emit('initialized', { userId });
  }

  async enable(userId: string, credentials: PluginCredentials): Promise<void> {
    // Validate and store credentials
    const validated = await this.validateCredentials(userId, credentials);
    if (!validated) {
      throw new Error('Invalid credentials');
    }

    this.emit('enabled', { userId });
  }

  async disable(userId: string): Promise<void> {
    // Cleanup resources
    this.emit('disabled', { userId });
  }

  getTools(): Tool[] {
    return [
      // Define tools here
    ];
  }

  async sync(userId: string, options?: SyncOptions): Promise<SyncResult> {
    const startTime = Date.now();

    try {
      // Fetch data from external service
      // Store in knowledge base

      return {
        success: true,
        itemsSynced: 0,
        errors: [],
        duration: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        itemsSynced: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration: Date.now() - startTime,
      };
    }
  }

  async executeAction(userId: string, action: string, parameters: any): Promise<any> {
    // Validate parameters
    const tool = this.getTools().find(t => t.name === action);
    if (!tool) {
      throw new Error(\`Unknown action: \${action}\`);
    }

    // Execute with timeout
    return this.executeWithTimeout(
      () => tool.execute(parameters),
      30000
    );
  }

  async validateCredentials(userId: string, credentials: PluginCredentials): Promise<boolean> {
    // Implement credential validation
    return true;
  }

  async cleanup(): Promise<void> {
    // Cleanup resources
  }

  private async executeWithTimeout<T>(fn: () => Promise<T>, timeout: number): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), timeout)
      ),
    ]);
  }
}`;

    // Service-specific variations
    const serviceTemplates: Record<string, string> = {
      discord: baseTemplate.replace('{{REQUIRES_AUTH}}', 'true').replace('{{AUTH_TYPE}}', 'oauth2'),
      slack: baseTemplate.replace('{{REQUIRES_AUTH}}', 'true').replace('{{AUTH_TYPE}}', 'oauth2'),
      trello: baseTemplate.replace('{{REQUIRES_AUTH}}', 'true').replace('{{AUTH_TYPE}}', 'api_key'),
      notion: baseTemplate.replace('{{REQUIRES_AUTH}}', 'true').replace('{{AUTH_TYPE}}', 'api_key'),
      github: baseTemplate.replace('{{REQUIRES_AUTH}}', 'true').replace('{{AUTH_TYPE}}', 'oauth2'),
    };

    return serviceTemplates[serviceName.toLowerCase()] || baseTemplate;
  }

  /**
   * Extract plugin name from generated code
   */
  private extractPluginName(code: string, serviceName: string): string {
    const classMatch = code.match(/export class (\w+)Plugin/);
    if (classMatch) {
      return classMatch[1];
    }

    const nameMatch = code.match(/name:\s*['"]([^'"]+)['"]/);
    if (nameMatch) {
      return nameMatch[1];
    }

    // Fallback
    return `${serviceName.charAt(0).toUpperCase() + serviceName.slice(1)}Custom`;
  }

  /**
   * Extract description from generated code or prompt
   */
  private extractDescription(code: string, prompt: string): string {
    const descMatch = code.match(/description:\s*['"]([^'"]+)['"]/);
    if (descMatch) {
      return descMatch[1];
    }

    // Fallback: use first 100 chars of prompt
    return prompt.length > 100 ? prompt.substring(0, 97) + '...' : prompt;
  }

  /**
   * Detect credential requirements from generated code
   * Analyzes the code to determine what credentials the plugin needs
   */
  private detectCredentialRequirements(code: string, serviceName: string): Record<string, any> {
    const requirements: Record<string, any> = {};
    const lowerCode = code.toLowerCase();
    const serviceNameCapitalized = serviceName.charAt(0).toUpperCase() + serviceName.slice(1);

    // Detect webhook URLs (more comprehensive patterns)
    if (lowerCode.includes('webhook') || 
        code.match(/webhook\s*url/i) || 
        code.match(/webhookUrl/i) ||
        code.match(/webhook_url/i)) {
      requirements.webhookUrl = {
        label: `${serviceNameCapitalized} Webhook URL`,
        type: 'url',
        required: true,
        description: `Webhook URL for ${serviceNameCapitalized}. Check your ${serviceNameCapitalized} integration settings.`,
        placeholder: 'https://...',
      };
    }

    // Detect API keys (more comprehensive patterns)
    if (lowerCode.includes('apikey') || 
        lowerCode.includes('api_key') || 
        code.match(/api\s*key/i) ||
        code.match(/apiKey/i) ||
        code.match(/apikey/i) ||
        code.match(/getCredential\(['"]api[_-]?key['"]/i) ||
        code.match(/getCredential\(['"]apiKey['"]/i)) {
      requirements.apiKey = {
        label: 'API Key',
        type: 'password',
        required: true,
        description: `API key for ${serviceNameCapitalized}. Find this in your ${serviceNameCapitalized} account settings.`,
        placeholder: '',
      };
    }

    // Detect access tokens
    if (lowerCode.includes('accesstoken') || lowerCode.includes('access_token')) {
      requirements.accessToken = {
        label: 'Access Token',
        type: 'password',
        required: true,
        description: `Access token for ${serviceNameCapitalized}`,
        placeholder: '',
      };
    }

    // Detect bot tokens
    if (lowerCode.includes('bottoken') || lowerCode.includes('bot_token') || lowerCode.includes('bot token')) {
      requirements.botToken = {
        label: 'Bot Token',
        type: 'password',
        required: code.includes('required: true') && code.includes('botToken'),
        description: `Bot token for ${serviceNameCapitalized}. Used for enhanced bot features.`,
        placeholder: '',
      };
    }

    // Detect OAuth client credentials
    const hasClientId = lowerCode.includes('clientid') || lowerCode.includes('client_id');
    const hasClientSecret = lowerCode.includes('clientsecret') || lowerCode.includes('client_secret');

    if (hasClientId && hasClientSecret) {
      requirements.clientId = {
        label: 'OAuth Client ID',
        type: 'text',
        required: true,
        description: `OAuth Client ID from your ${serviceNameCapitalized} app`,
        placeholder: '',
      };
      requirements.clientSecret = {
        label: 'OAuth Client Secret',
        type: 'password',
        required: true,
        description: `OAuth Client Secret from your ${serviceNameCapitalized} app`,
        placeholder: '',
      };
    }

    // Detect server/channel IDs for Discord-like services
    if (serviceName.toLowerCase() === 'discord') {
      if (lowerCode.includes('serverid') || lowerCode.includes('guildid')) {
        requirements.serverId = {
          label: 'Server ID',
          type: 'text',
          required: false,
          description: 'Discord Server (Guild) ID. Enable Developer Mode to copy IDs.',
          placeholder: '1234567890',
        };
      }
      if (lowerCode.includes('channelid')) {
        requirements.channelId = {
          label: 'Channel ID',
          type: 'text',
          required: false,
          description: 'Discord Channel ID. Right-click channel → Copy ID.',
          placeholder: '1234567890',
        };
      }
    }

    // Detect auth headers or bearer tokens
    if ((lowerCode.includes('authorization') || lowerCode.includes('bearer')) &&
        !hasClientId && !requirements.apiKey) {
      requirements.authToken = {
        label: 'Authorization Token',
        type: 'password',
        required: true,
        description: `Authorization token for ${serviceNameCapitalized}`,
        placeholder: '',
      };
    }

    // Detect custom base URLs or endpoints
    if (lowerCode.includes('baseurl') || lowerCode.includes('base_url') || lowerCode.includes('endpoint')) {
      // Only add if it's not a hardcoded URL in the code
      if (!code.match(/baseUrl:\s*['"]https?:\/\//)) {
        requirements.baseUrl = {
          label: 'API Base URL',
          type: 'url',
          required: false,
          description: `Custom API endpoint URL for ${serviceNameCapitalized} (optional)`,
          placeholder: 'https://api.example.com',
        };
      }
    }

    return requirements;
  }

  /**
   * Calculate security score based on analysis
   */
  calculateSecurityScore(analysisResults: SecurityAnalysisResult): number {
    return analysisResults.securityScore;
  }
}

class PluginValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PluginValidationError';
  }
}
