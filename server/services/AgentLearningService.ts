/**
 * Agent Learning Service
 * 
 * Enables agents to learn from failures, share knowledge, and improve over time.
 * 
 * Features:
 * - Failure analysis and tracking
 * - Solution pattern recognition
 * - Knowledge sharing between agents
 * - Self-improvement recommendations
 */

import { db } from '../../db';
import { SimpleLogger } from '../utils/SimpleLogger';
import { sql, eq, and, desc, or, gte, lt } from 'drizzle-orm';
import { MultiModelAIService } from './MultiModelAIService';

const logger = new SimpleLogger('AgentLearningService');

export interface AgentFailure {
  agentType: string;
  failureType: 'error' | 'timeout' | 'rejection' | 'validation_failed';
  errorCode?: string;
  errorMessage: string;
  context: Record<string, any>;
  taskDescription?: string;
  userId?: string;
}

export interface AgentSolution {
  agentType: string;
  problemPattern: string;
  solutionStrategy: string;
  solutionContext: Record<string, any>;
  codeExample?: string;
  discoveredBy?: string;
}

export interface SolutionRecommendation {
  solutionStrategy: string;
  solutionContext: Record<string, any>;
  successRate: number;
  timesUsed: number;
  codeExample?: string;
  confidence: number;
}

export class AgentLearningService {
  private static instance: AgentLearningService;
  private multiModelAI: MultiModelAIService;

  private constructor() {
    this.multiModelAI = new MultiModelAIService();
  }

  public static getInstance(): AgentLearningService {
    if (!AgentLearningService.instance) {
      AgentLearningService.instance = new AgentLearningService();
    }
    return AgentLearningService.instance;
  }

  /**
   * Record a failure for analysis and learning
   */
  async recordFailure(failure: AgentFailure): Promise<number> {
    try {
      logger.info(`Recording failure: ${failure.agentType} - ${failure.failureType}`);

      // Check if similar failure exists
      const similarFailure = await this.findSimilarFailure(failure);
      
      if (similarFailure) {
        // Update existing failure count
        await db.execute(sql`
          UPDATE agent_failures
          SET times_occurred = times_occurred + 1,
              occurred_at = NOW()
          WHERE id = ${similarFailure.id}
        `);
        logger.info(`Updated existing failure count: ${similarFailure.times_occurred + 1}`);
        return similarFailure.id;
      }

      // Record new failure
      const result = await db.execute(sql`
        SELECT record_agent_failure(
          ${failure.agentType}::TEXT,
          ${failure.failureType}::TEXT,
          ${failure.errorMessage}::TEXT,
          ${JSON.stringify(failure.context)}::JSONB,
          ${failure.userId || null}::TEXT,
          ${failure.errorCode || null}::TEXT,
          ${failure.taskDescription || null}::TEXT
        ) as failure_id
      `);

      const failureId = Number(result.rows[0]?.failure_id) || 0;
      logger.info(`Recorded new failure with ID: ${failureId}`);

      // Analyze failure in background (don't block)
      this.analyzeFailure(failureId, failure).catch(err => {
        logger.error('Failed to analyze failure in background', err);
      });

      return failureId;
    } catch (error) {
      logger.error('Failed to record failure', error as Error);
      throw error;
    }
  }

  /**
   * Record a successful solution
   */
  async recordSolution(solution: AgentSolution): Promise<number> {
    try {
      logger.info(`Recording solution: ${solution.agentType} - ${solution.problemPattern}`);

      const result = await db.execute(sql`
        SELECT record_agent_solution(
          ${solution.agentType}::TEXT,
          ${solution.problemPattern}::TEXT,
          ${solution.solutionStrategy}::TEXT,
          ${JSON.stringify(solution.solutionContext)}::JSONB,
          ${solution.discoveredBy || null}::TEXT,
          ${solution.codeExample || null}::TEXT
        ) as solution_id
      `);

      const solutionId = Number(result.rows[0]?.solution_id) || 0;
      logger.info(`Recorded solution with ID: ${solutionId}`);

      // Share with other agents if it's a general solution
      if (solution.solutionContext.isGeneralSolution) {
        this.shareKnowledgeWithAgents(
          solutionId.toString(),
          'solution',
          solution.agentType,
          ['browser_use', 'orchestrator', 'code_generator']
        ).catch(err => {
          logger.error('Failed to share knowledge', err);
        });
      }

      return solutionId;
    } catch (error) {
      logger.error('Failed to record solution', error as Error);
      throw error;
    }
  }

  /**
   * Get solution recommendations for a problem
   */
  async getSolutionRecommendations(
    agentType: string,
    problemPattern: string,
    limit: number = 5
  ): Promise<SolutionRecommendation[]> {
    try {
      logger.info(`Getting solutions for: ${agentType} - ${problemPattern}`);

      const result = await db.execute(sql`
        SELECT * FROM get_agent_solutions(
          ${agentType}::TEXT,
          ${problemPattern}::TEXT,
          ${limit}::INTEGER
        )
      `);

      const recommendations: SolutionRecommendation[] = result.rows.map((row: any) => ({
        solutionStrategy: row.solution_strategy,
        solutionContext: row.solution_context,
        successRate: parseFloat(row.success_rate) || 0,
        timesUsed: parseInt(row.times_used) || 0,
        codeExample: row.code_example || undefined,
        confidence: parseFloat(row.success_rate) || 0.5
      }));

      logger.info(`Found ${recommendations.length} solution recommendations`);
      return recommendations;
    } catch (error) {
      logger.error('Failed to get solution recommendations', error as Error);
      return [];
    }
  }

  /**
   * Analyze a failure to understand root cause and suggest solutions
   */
  private async analyzeFailure(failureId: number, failure: AgentFailure): Promise<void> {
    try {
      logger.info(`Analyzing failure ${failureId}`);

      // Use AI to analyze the failure
      const analysisPrompt = `Analyze this agent failure and provide:
1. Root cause (what actually went wrong)
2. Contributing factors (what made it worse)
3. Severity (low/medium/high/critical)
4. Suggested resolution strategy

Agent Type: ${failure.agentType}
Failure Type: ${failure.failureType}
Error Code: ${failure.errorCode || 'N/A'}
Error Message: ${failure.errorMessage}
Context: ${JSON.stringify(failure.context, null, 2)}
Task: ${failure.taskDescription || 'N/A'}

Respond in JSON format:
{
  "rootCause": "...",
  "contributingFactors": ["...", "..."],
  "severity": "low|medium|high|critical",
  "suggestedStrategy": "..."
}`;

      const analysis = await this.multiModelAI.generate({
        prompt: analysisPrompt,
        maxTokens: 1000,
        useCase: 'explanation',
        preferredModel: 'claude-sonnet-4-5-20250929'
      });

      // Parse AI response
      let analysisData;
      try {
        // Extract JSON from response
        const jsonMatch = analysis.content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          analysisData = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } catch (parseError) {
        logger.warn('Failed to parse AI analysis, using fallback', parseError as Error);
        analysisData = {
          rootCause: failure.errorMessage,
          contributingFactors: [],
          severity: 'medium',
          suggestedStrategy: 'Retry with different parameters'
        };
      }

      // Update failure with analysis
      await db.execute(sql`
        UPDATE agent_failures
        SET root_cause = ${analysisData.rootCause}::TEXT,
            contributing_factors = ${JSON.stringify(analysisData.contributingFactors)}::JSONB,
            severity = ${analysisData.severity}::TEXT
        WHERE id = ${failureId}
      `);

      logger.info(`Analyzed failure ${failureId}: ${analysisData.severity} severity`);

      // If we have a suggested strategy, try to find or create a solution
      if (analysisData.suggestedStrategy) {
        await this.createSolutionFromAnalysis(
          failure.agentType,
          failure,
          analysisData.suggestedStrategy
        );
      }
    } catch (error) {
      logger.error(`Failed to analyze failure ${failureId}`, error as Error);
    }
  }

  /**
   * Create a solution from failure analysis
   */
  private async createSolutionFromAnalysis(
    agentType: string,
    failure: AgentFailure,
    suggestedStrategy: string
  ): Promise<void> {
    try {
      // Extract problem pattern from error
      const problemPattern = this.extractProblemPattern(failure);

      // Check if solution already exists
      const existingSolutions = await this.getSolutionRecommendations(
        agentType,
        problemPattern,
        1
      );

      if (existingSolutions.length > 0 && existingSolutions[0].successRate > 0.7) {
        logger.info(`Solution already exists for pattern: ${problemPattern}`);
        return;
      }

      // Create new solution
      await this.recordSolution({
        agentType,
        problemPattern,
        solutionStrategy: suggestedStrategy,
        solutionContext: {
          ...failure.context,
          isGeneralSolution: this.isGeneralSolution(failure),
          discoveredFrom: 'failure_analysis'
        },
        discoveredBy: 'system'
      });

      logger.info(`Created new solution for pattern: ${problemPattern}`);
    } catch (error) {
      logger.error('Failed to create solution from analysis', error as Error);
    }
  }

  /**
   * Extract problem pattern from failure
   */
  private extractProblemPattern(failure: AgentFailure): string {
    // Extract pattern from error code or message
    if (failure.errorCode) {
      return failure.errorCode.toLowerCase().replace(/[^a-z0-9]/g, '_');
    }

    // Extract from error message
    const message = failure.errorMessage.toLowerCase();
    if (message.includes('proxy')) {
      if (message.includes('connection')) {
        return 'proxy_connection_failed';
      }
      return 'proxy_error';
    }
    if (message.includes('timeout')) {
      return 'timeout_error';
    }
    if (message.includes('turnstile') || message.includes('captcha')) {
      return 'captcha_rejection';
    }
    if (message.includes('network')) {
      return 'network_error';
    }

    return 'unknown_error';
  }

  /**
   * Check if solution is general enough to share
   */
  private isGeneralSolution(failure: AgentFailure): boolean {
    // Solutions for common errors are general
    const generalErrorCodes = [
      'ERR_PROXY_CONNECTION_FAILED',
      '600010', // Turnstile error
      'timeout',
      'network_error'
    ];

    if (failure.errorCode && generalErrorCodes.includes(failure.errorCode)) {
      return true;
    }

    return false;
  }

  /**
   * Find similar failure to avoid duplicates
   */
  private async findSimilarFailure(failure: AgentFailure): Promise<any | null> {
    try {
      const result = await db.execute(sql`
        SELECT id, times_occurred
        FROM agent_failures
        WHERE agent_type = ${failure.agentType}
          AND failure_type = ${failure.failureType}
          AND (
            error_code = ${failure.errorCode || ''}
            OR error_message = ${failure.errorMessage}
          )
          AND occurred_at > NOW() - INTERVAL '1 hour'
        ORDER BY occurred_at DESC
        LIMIT 1
      `);

      return result.rows[0] || null;
    } catch (error) {
      logger.error('Failed to find similar failure', error as Error);
      return null;
    }
  }

  /**
   * Share knowledge with other agents
   */
  private async shareKnowledgeWithAgents(
    knowledgeId: string,
    knowledgeType: 'solution' | 'pattern' | 'failure_analysis',
    sourceAgentType: string,
    recipientAgentTypes: string[]
  ): Promise<number> {
    try {
      logger.info(`Sharing ${knowledgeType} from ${sourceAgentType} to ${recipientAgentTypes.join(', ')}`);

      const result = await db.execute(sql`
        SELECT share_knowledge_with_agents(
          ${knowledgeId}::TEXT,
          ${knowledgeType}::TEXT,
          ${sourceAgentType}::TEXT,
          ${recipientAgentTypes}::TEXT[]
        ) as sharing_id
      `);

      const sharingId = Number(result.rows[0]?.sharing_id) || 0;
      logger.info(`Knowledge shared with ID: ${sharingId}`);
      return sharingId;
    } catch (error) {
      logger.error('Failed to share knowledge', error as Error);
      throw error;
    }
  }

  /**
   * Mark a failure as resolved
   */
  async markFailureResolved(
    failureId: number,
    resolutionStrategy: string,
    resolutionContext: Record<string, any>
  ): Promise<void> {
    try {
      await db.execute(sql`
        UPDATE agent_failures
        SET resolved = true,
            resolution_strategy = ${resolutionStrategy}::TEXT,
            resolution_context = ${JSON.stringify(resolutionContext)}::JSONB,
            resolved_at = NOW()
        WHERE id = ${failureId}
      `);

      logger.info(`Marked failure ${failureId} as resolved`);

      // Create solution from successful resolution
      const failure = await this.getFailureById(failureId);
      if (failure) {
        const problemPattern = this.extractProblemPattern(failure);
        await this.recordSolution({
          agentType: failure.agentType,
          problemPattern,
          solutionStrategy: resolutionStrategy,
          solutionContext: {
            ...resolutionContext,
            isGeneralSolution: this.isGeneralSolution(failure),
            discoveredFrom: 'manual_resolution'
          },
          discoveredBy: 'system'
        });
      }
    } catch (error) {
      logger.error(`Failed to mark failure ${failureId} as resolved`, error as Error);
    }
  }

  /**
   * Get failure by ID
   */
  private async getFailureById(failureId: number): Promise<AgentFailure | null> {
    try {
      const result = await db.execute(sql`
        SELECT agent_type, failure_type, error_code, error_message, context, task_description, user_id
        FROM agent_failures
        WHERE id = ${failureId}
      `);

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0] as any;
      return {
        agentType: String(row.agent_type || ''),
        failureType: row.failure_type as 'error' | 'timeout' | 'rejection' | 'validation_failed',
        errorCode: row.error_code ? String(row.error_code) : undefined,
        errorMessage: String(row.error_message || ''),
        context: row.context as Record<string, any> || {},
        taskDescription: row.task_description ? String(row.task_description) : undefined,
        userId: row.user_id ? String(row.user_id) : undefined
      };
    } catch (error) {
      logger.error(`Failed to get failure ${failureId}`, error as Error);
      return null;
    }
  }

  /**
   * Get unresolved failures for an agent type
   */
  async getUnresolvedFailures(agentType: string, limit: number = 10): Promise<any[]> {
    try {
      const result = await db.execute(sql`
        SELECT id, failure_type, error_code, error_message, context, times_occurred, occurred_at
        FROM agent_failures
        WHERE agent_type = ${agentType}
          AND resolved = false
        ORDER BY times_occurred DESC, occurred_at DESC
        LIMIT ${limit}
      `);

      return result.rows;
    } catch (error) {
      logger.error('Failed to get unresolved failures', error as Error);
      return [];
    }
  }

  /**
   * Helper: Record a code generation failure
   */
  async recordCodeGenerationFailure(
    error: Error,
    context: {
      prompt?: string;
      projectId?: string;
      userId?: string;
      filesGenerated?: number;
      phase?: string;
    }
  ): Promise<number> {
    return this.recordFailure({
      agentType: 'code_generator',
      failureType: 'error',
      errorCode: error.name,
      errorMessage: error.message,
      context: {
        ...context,
        stack: error.stack?.substring(0, 500) // Limit stack trace
      },
      taskDescription: context.prompt || 'Code generation',
      userId: context.userId
    });
  }

  /**
   * Helper: Record a code generation success
   */
  async recordCodeGenerationSuccess(
    context: {
      prompt: string;
      filesGenerated: number;
      projectId?: string;
      userId?: string;
      strategy?: string;
      phase?: string;
    }
  ): Promise<number> {
    return this.recordSolution({
      agentType: 'code_generator',
      problemPattern: 'code_generation',
      solutionStrategy: context.strategy || 'Standard code generation',
      solutionContext: {
        ...context,
        isGeneralSolution: true
      },
      discoveredBy: 'system'
    });
  }

  /**
   * Helper: Record an orchestration failure
   */
  async recordOrchestrationFailure(
    error: Error,
    context: {
      task?: string;
      phase?: string;
      agentsUsed?: string[];
      userId?: string;
    }
  ): Promise<number> {
    return this.recordFailure({
      agentType: 'orchestrator',
      failureType: 'error',
      errorCode: error.name,
      errorMessage: error.message,
      context: {
        ...context,
        stack: error.stack?.substring(0, 500)
      },
      taskDescription: context.task || 'Orchestration',
      userId: context.userId
    });
  }

  /**
   * Helper: Get solutions before attempting a task
   */
  async getSolutionsForTask(
    agentType: string,
    taskDescription: string
  ): Promise<SolutionRecommendation[]> {
    // Extract problem pattern from task description
    const problemPattern = this.extractProblemPatternFromTask(taskDescription);
    return this.getSolutionRecommendations(agentType, problemPattern, 3);
  }

  /**
   * Extract problem pattern from task description
   */
  private extractProblemPatternFromTask(task: string): string {
    const lowerTask = task.toLowerCase();
    
    if (lowerTask.includes('proxy') || lowerTask.includes('connection')) {
      return 'proxy_connection_failed';
    }
    if (lowerTask.includes('timeout')) {
      return 'timeout_error';
    }
    if (lowerTask.includes('error') || lowerTask.includes('fail')) {
      return 'general_error';
    }
    if (lowerTask.includes('generate') || lowerTask.includes('code')) {
      return 'code_generation';
    }
    if (lowerTask.includes('deploy')) {
      return 'deployment';
    }
    
    return 'unknown_task';
  }
}

// Export singleton instance
export const agentLearningService = AgentLearningService.getInstance();

