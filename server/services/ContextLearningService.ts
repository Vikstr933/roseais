/**
 * Context Learning Service
 * 
 * Integrates Agent Learning System with Context Engine to learn:
 * - User preferences and behavior patterns
 * - Which contexts work well together
 * - Which suggested actions users actually take
 * - Workflow patterns that lead to success
 * 
 * This makes the system smarter about understanding users over time.
 */

import { agentLearningService } from './AgentLearningService';
import { SimpleLogger } from '../utils/SimpleLogger';
import { UserContext, ActivityRecord } from './ContextEngine';
import { db } from '../../db';
import { sql } from 'drizzle-orm';

const logger = new SimpleLogger('ContextLearningService');

export interface UserActionPattern {
  userId: string;
  contextType: string;
  action: string;
  success: boolean;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ContextPattern {
  contextType: string;
  suggestedAction: string;
  actionTaken: boolean;
  successRate: number;
  timesSuggested: number;
  timesTaken: number;
}

export class ContextLearningService {
  private static instance: ContextLearningService;

  private constructor() {}

  public static getInstance(): ContextLearningService {
    if (!ContextLearningService.instance) {
      ContextLearningService.instance = new ContextLearningService();
    }
    return ContextLearningService.instance;
  }

  /**
   * Learn from user action - when user takes a suggested action
   */
  async learnFromUserAction(
    userId: string,
    context: UserContext,
    action: string,
    success: boolean = true,
    metadata?: Record<string, any>
  ): Promise<void> {
    try {
      logger.info(`Learning from user action: ${action} in context ${context.contextType}`);

      // Record as a "solution" pattern (what works for this user)
      if (success) {
        await agentLearningService.recordSolution({
          agentType: 'context_engine',
          problemPattern: `user_action_${context.contextType}`,
          solutionStrategy: `User prefers action: ${action} in ${context.contextType} context`,
          solutionContext: {
            userId,
            contextType: context.contextType,
            action,
            currentPage: context.currentPage,
            workspaceId: context.currentWorkspace?.id,
            isUserPreference: true,
            ...metadata
          },
          discoveredBy: 'user_action'
        });
      }

      // Store pattern for future suggestions
      await this.recordActionPattern({
        userId,
        contextType: context.contextType,
        action,
        success,
        timestamp: new Date(),
        metadata: {
          ...metadata,
          currentPage: context.currentPage,
          workspaceId: context.currentWorkspace?.id
        }
      });
    } catch (error) {
      logger.error('Failed to learn from user action', error as Error);
    }
  }

  /**
   * Learn from suggested actions - track which suggestions users actually take
   */
  async learnFromSuggestedActions(
    userId: string,
    context: UserContext,
    suggestedActions: string[],
    actionTaken?: string
  ): Promise<void> {
    try {
      // If user took an action, learn that this suggestion was good
      if (actionTaken && suggestedActions.includes(actionTaken)) {
        await this.learnFromUserAction(userId, context, actionTaken, true, {
          wasSuggested: true,
          suggestionIndex: suggestedActions.indexOf(actionTaken)
        });
      }

      // Learn which suggestions are ignored (might need improvement)
      for (const suggestion of suggestedActions) {
        if (suggestion !== actionTaken) {
          await this.recordSuggestionPattern(
            context.contextType,
            suggestion,
            false // Not taken
          );
        }
      }
    } catch (error) {
      logger.error('Failed to learn from suggested actions', error as Error);
    }
  }

  /**
   * Get improved suggestions based on learned patterns
   */
  async getImprovedSuggestions(
    userId: string,
    contextType: string,
    baseSuggestions: string[]
  ): Promise<string[]> {
    try {
      // Get user's action patterns for this context
      const userPatterns = await this.getUserActionPatterns(userId, contextType, 5);
      
      // Get global patterns for this context
      const globalPatterns = await this.getContextPatterns(contextType, 5);

      // Score each suggestion based on:
      // 1. User's past actions (higher weight)
      // 2. Global success rate
      // 3. Recency (recent actions weighted higher)
      
      const scoredSuggestions = baseSuggestions.map(suggestion => {
        let score = 0.5; // Base score

        // Check user patterns
        const userPattern = userPatterns.find(p => p.action === suggestion);
        if (userPattern) {
          score += userPattern.success ? 0.3 : -0.1;
          // Recent actions get bonus
          const daysAgo = (Date.now() - userPattern.timestamp.getTime()) / (1000 * 60 * 60 * 24);
          if (daysAgo < 7) score += 0.1;
        }

        // Check global patterns
        const globalPattern = globalPatterns.find(p => p.suggestedAction === suggestion);
        if (globalPattern) {
          score += globalPattern.successRate * 0.2;
        }

        return { suggestion, score };
      });

      // Sort by score and return top suggestions
      return scoredSuggestions
        .sort((a, b) => b.score - a.score)
        .map(s => s.suggestion)
        .slice(0, 5);
    } catch (error) {
      logger.error('Failed to get improved suggestions', error as Error);
      return baseSuggestions; // Fallback to original
    }
  }

  /**
   * Learn from context transitions - which contexts users move between
   */
  async learnFromContextTransition(
    userId: string,
    fromContext: string,
    toContext: string,
    success: boolean = true
  ): Promise<void> {
    try {
      await agentLearningService.recordSolution({
        agentType: 'context_engine',
        problemPattern: 'context_transition',
        solutionStrategy: `User transitions from ${fromContext} to ${toContext}`,
        solutionContext: {
          userId,
          fromContext,
          toContext,
          success,
          isContextPattern: true
        },
        discoveredBy: 'user_behavior'
      });
    } catch (error) {
      logger.error('Failed to learn from context transition', error as Error);
    }
  }

  /**
   * Learn from successful workflows - when user completes a task successfully
   */
  async learnFromSuccessfulWorkflow(
    userId: string,
    context: UserContext,
    workflow: {
      steps: string[];
      result: 'success' | 'partial' | 'failed';
      duration?: number;
    }
  ): Promise<void> {
    try {
      if (workflow.result === 'success') {
        await agentLearningService.recordSolution({
          agentType: 'context_engine',
          problemPattern: `workflow_${context.contextType}`,
          solutionStrategy: `Successful workflow: ${workflow.steps.join(' → ')}`,
          solutionContext: {
            userId,
            contextType: context.contextType,
            steps: workflow.steps,
            duration: workflow.duration,
            isWorkflowPattern: true
          },
          discoveredBy: 'user_workflow'
        });
      }
    } catch (error) {
      logger.error('Failed to learn from workflow', error as Error);
    }
  }

  /**
   * Record action pattern in database
   */
  private async recordActionPattern(pattern: UserActionPattern): Promise<void> {
    try {
      // Use agent_learning_patterns table to store user action patterns
      // Note: We use a unique pattern_name to avoid duplicates
      const patternName = `user_action_${pattern.userId}_${pattern.contextType}_${pattern.action.replace(/\s+/g, '_')}`;
      
      await db.execute(sql`
        INSERT INTO agent_learning_patterns (
          pattern_name,
          pattern_type,
          agent_type,
          pattern_description,
          conditions,
          outcome,
          confidence,
          occurrences,
          success_rate
        ) VALUES (
          ${patternName}::TEXT,
          'user_preference'::TEXT,
          'context_engine'::TEXT,
          ${`User ${pattern.success ? 'successfully' : 'unsuccessfully'} took action: ${pattern.action}`}::TEXT,
          ${JSON.stringify({
            userId: pattern.userId,
            contextType: pattern.contextType,
            action: pattern.action
          })}::JSONB,
          ${JSON.stringify({
            success: pattern.success,
            timestamp: pattern.timestamp,
            ...pattern.metadata
          })}::JSONB,
          ${pattern.success ? 0.8 : 0.3}::REAL,
          1::INTEGER,
          ${pattern.success ? 1.0 : 0.0}::REAL
        )
        ON CONFLICT (pattern_name) DO UPDATE SET
          occurrences = agent_learning_patterns.occurrences + 1,
          success_rate = CASE 
            WHEN ${pattern.success}::BOOLEAN THEN 
              (agent_learning_patterns.success_rate * agent_learning_patterns.occurrences + 1.0) / (agent_learning_patterns.occurrences + 1)
            ELSE 
              (agent_learning_patterns.success_rate * agent_learning_patterns.occurrences) / (agent_learning_patterns.occurrences + 1)
          END,
          last_observed_at = NOW()
      `);
    } catch (error) {
      logger.error('Failed to record action pattern', error as Error);
    }
  }

  /**
   * Record suggestion pattern
   */
  private async recordSuggestionPattern(
    contextType: string,
    suggestion: string,
    wasTaken: boolean
  ): Promise<void> {
    try {
      // Update or insert suggestion pattern
      await db.execute(sql`
        INSERT INTO agent_learning_patterns (
          pattern_name,
          pattern_type,
          agent_type,
          pattern_description,
          conditions,
          outcome,
          confidence,
          occurrences,
          success_rate
        ) VALUES (
          ${`suggestion_${contextType}_${suggestion.replace(/\s+/g, '_')}`}::TEXT,
          'suggestion_pattern'::TEXT,
          'context_engine'::TEXT,
          ${`Suggestion "${suggestion}" in ${contextType} context`}::TEXT,
          ${JSON.stringify({ contextType, suggestion })}::JSONB,
          ${JSON.stringify({ wasTaken })}::JSONB,
          0.5::REAL,
          1::INTEGER,
          ${wasTaken ? 1.0 : 0.0}::REAL
        )
        ON CONFLICT (pattern_name) DO UPDATE SET
          occurrences = agent_learning_patterns.occurrences + 1,
          success_rate = CASE 
            WHEN ${wasTaken}::BOOLEAN THEN 
              (agent_learning_patterns.success_rate * agent_learning_patterns.occurrences + 1.0) / (agent_learning_patterns.occurrences + 1)
            ELSE 
              (agent_learning_patterns.success_rate * agent_learning_patterns.occurrences) / (agent_learning_patterns.occurrences + 1)
          END,
          last_observed_at = NOW()
      `);
    } catch (error) {
      logger.error('Failed to record suggestion pattern', error as Error);
    }
  }

  /**
   * Get user's action patterns
   */
  private async getUserActionPatterns(
    userId: string,
    contextType: string,
    limit: number = 10
  ): Promise<UserActionPattern[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          pattern_description,
          conditions,
          outcome,
          success_rate,
          last_observed_at
        FROM agent_learning_patterns
        WHERE agent_type = 'context_engine'
          AND pattern_type = 'user_preference'
          AND conditions->>'userId' = ${userId}
          AND conditions->>'contextType' = ${contextType}
        ORDER BY last_observed_at DESC
        LIMIT ${limit}
      `);

      return result.rows.map((row: any) => ({
        userId,
        contextType,
        action: row.conditions?.action || '',
        success: (row.outcome?.success || row.success_rate > 0.5),
        timestamp: row.last_observed_at || new Date(),
        metadata: row.outcome
      }));
    } catch (error) {
      logger.error('Failed to get user action patterns', error as Error);
      return [];
    }
  }

  /**
   * Get context patterns
   */
  private async getContextPatterns(
    contextType: string,
    limit: number = 10
  ): Promise<ContextPattern[]> {
    try {
      const result = await db.execute(sql`
        SELECT 
          pattern_description,
          conditions,
          outcome,
          success_rate,
          occurrences
        FROM agent_learning_patterns
        WHERE agent_type = 'context_engine'
          AND pattern_type = 'suggestion_pattern'
          AND conditions->>'contextType' = ${contextType}
        ORDER BY success_rate DESC, occurrences DESC
        LIMIT ${limit}
      `);

      return result.rows.map((row: any) => ({
        contextType,
        suggestedAction: row.conditions?.suggestion || '',
        actionTaken: row.outcome?.wasTaken || false,
        successRate: parseFloat(row.success_rate) || 0,
        timesSuggested: parseInt(row.occurrences) || 0,
        timesTaken: Math.round((parseFloat(row.success_rate) || 0) * (parseInt(row.occurrences) || 0))
      }));
    } catch (error) {
      logger.error('Failed to get context patterns', error as Error);
      return [];
    }
  }
}

// Export singleton
export const contextLearningService = ContextLearningService.getInstance();

