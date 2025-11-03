import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent } from './BaseAgent';
import { PluginSecurityAnalyzer, SecurityAnalysisResult } from '../services/PluginSecurityAnalyzer';
import { SimpleLogger } from '../utils/SimpleLogger';
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

/**
 * PluginGeneratorAgent
 *
 * AI agent specialized in generating secure, high-quality plugins for user integrations.
 * Implements multi-stage security validation and code analysis.
 */
export class PluginGeneratorAgent extends BaseAgent {
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

    this.model = 'claude-3-5-sonnet-20241022';

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });

    this.securityAnalyzer = new PluginSecurityAnalyzer();
  }

  /**
   * Generate a plugin from user request
   */
  async generatePlugin(request: PluginGenerationRequest): Promise<PluginGenerationResult> {
    const startTime = Date.now();
    logger.info('Starting plugin generation', { userId: request.userId, serviceName: request.serviceName });

    try {
      // Step 1: Analyze intent and validate safety
      const intentAnalysis = await this.analyzeIntent(request.prompt);

      if (!intentAnalysis.safe) {
        logger.warn('Blocked unsafe intent', { userId: request.userId, intent: intentAnalysis.intent });
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
          },
        };
      }

      // Step 2: Generate plugin code using AI
      const generationResult = await this.generateSecureCode({
        prompt: request.prompt,
        serviceName: request.serviceName || intentAnalysis.suggestedService,
        capabilities: request.requiredCapabilities.length > 0
          ? request.requiredCapabilities
          : intentAnalysis.suggestedCapabilities,
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

      logger.info('Plugin generation complete', {
        pluginId,
        status,
        securityScore,
        reviewRequired,
        generationTime,
      });

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
        },
      };
    } catch (error) {
      logger.error('Plugin generation failed', error);
      throw error;
    }
  }

  /**
   * Analyze user intent for safety
   */
  private async analyzeIntent(prompt: string): Promise<IntentAnalysis> {
    logger.info('Analyzing intent');

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

Respond in JSON format:
{
  "safe": boolean,
  "intent": string,
  "blockedReason": string or null,
  "suggestedCapabilities": string[],
  "suggestedService": string,
  "complexity": "simple" | "medium" | "complex"
}`;

    try {
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

      const analysis = JSON.parse(content.text);

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
    } catch (error) {
      logger.error('Intent analysis failed', error);
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
    tokensUsed: number;
  }> {
    logger.info('Generating plugin code', { serviceName: params.serviceName });

    const template = this.getPluginTemplate(params.serviceName);

    const systemPrompt = `You are an expert plugin developer. Generate a secure, production-ready plugin based on the BaseProductivityPlugin class.

REQUIREMENTS:
1. Extend BaseProductivityPlugin
2. Use only APPROVED packages: axios, node-fetch, discord.js, @slack/web-api, trello, @notionhq/client, zod, date-fns, uuid
3. NO file system access (fs module)
4. NO process spawning (child_process)
5. NO eval() or Function() constructors
6. NO hardcoded credentials (use plugin credential system)
7. Include proper error handling
8. Add TypeScript types
9. Implement all required methods: initialize(), enable(), sync(), getTools(), executeAction()
10. Follow the template structure

CAPABILITIES REQUESTED: ${params.capabilities.join(', ')}
SERVICE: ${params.serviceName}
COMPLEXITY: ${params.complexity}

Return ONLY the TypeScript code, no markdown, no explanations.`;

    const userPrompt = `Generate a plugin for: ${params.prompt}

Use this template as a guide:

${template}

Requirements:
- Plugin should be production-ready
- Include proper OAuth setup if needed
- Implement tools for the requested capabilities
- Add comprehensive error handling
- Use Zod for parameter validation
- Include rate limiting configuration`;

    const response = await this.anthropic.messages.create({
      model: this.model,
      max_tokens: 4000,
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
    code = code.replace(/```typescript\n?/g, '').replace(/```\n?/g, '').trim();

    // Extract metadata from generated code
    const pluginName = this.extractPluginName(code, params.serviceName);
    const description = this.extractDescription(code, params.prompt);
    const requiresAuth = code.includes('requiresAuth: true');
    const authType = code.includes('oauth') ? 'oauth2' :
                     code.includes('apiKey') ? 'api_key' : undefined;

    return {
      code,
      pluginName,
      description,
      capabilities: params.capabilities,
      requiresAuth,
      authType,
      tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
    };
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
   * Calculate security score based on analysis
   */
  calculateSecurityScore(analysisResults: SecurityAnalysisResult): number {
    return analysisResults.securityScore;
  }
}
