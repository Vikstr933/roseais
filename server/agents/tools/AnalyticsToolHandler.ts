/**
 * Analytics Tool Handlers
 * 
 * Handles analytics: get_usage_stats, get_data_insights
 */

import { BaseToolHandler, ToolContext, ToolExecutionResult } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';

/**
 * Get Usage Stats Tool Handler
 */
export class GetUsageStatsToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('get_usage_stats');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'get_usage_stats',
      description: 'Get usage statistics and analytics. Use this when the user asks about statistics, usage data, or analytics. This provides insights into how the platform is being used.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['day', 'week', 'month', 'all'],
            description: 'Time period for statistics: day (last 24 hours), week (last 7 days), month (last 30 days), or all (all time). Default: all.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID to get statistics for. If not provided, returns overall statistics.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.getUsageStats === 'function') {
          try {
            return await this.agentInstance.getUsageStats(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to get usage stats: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot get usage stats: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.getUsageStats === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.getUsageStats(enrichedParams);
        return {
          success: result.success !== false,
          data: result,
          error: result.error,
          retryable: false
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          retryable: true
        };
      }
    }
    
    return {
      success: false,
      error: 'PersonalAssistantAgent instance not available',
      retryable: false
    };
  }

  async isAvailable(context: ToolContext): Promise<boolean> {
    return true;
  }

  getDescription(): string {
    return 'Get usage statistics and analytics for the platform.';
  }

  getUsageExamples(): string[] {
    return [
      'Get usage statistics',
      'Show analytics for this week',
      'What are the usage stats?'
    ];
  }
}

/**
 * Get Data Insights Tool Handler
 */
export class GetDataInsightsToolHandler extends BaseToolHandler {
  private agentInstance: any;

  constructor(agentInstance?: any) {
    super('get_data_insights');
    this.agentInstance = agentInstance;
  }

  async getTool(context: ToolContext): Promise<Tool> {
    if (this.cachedTool) {
      return this.cachedTool;
    }

    this.cachedTool = {
      name: 'get_data_insights',
      description: 'Get comprehensive data insights about AI agent performance, code generation patterns, project activity, and interesting correlations. Use this when the user asks about data insights, analytics, patterns in their data, agent performance, productivity patterns, or wants to discuss data analysis.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['overview', 'hypotheses'],
            description: 'Type of insights: overview (general insights and patterns), hypotheses (data-driven hypotheses and correlations). Default: overview.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        const enrichedParams = {
          ...params,
          _userId: params._userId || context.userId,
          _sessionId: params._sessionId || context.sessionId
        };
        
        if (this.agentInstance && typeof this.agentInstance.getDataInsights === 'function') {
          try {
            return await this.agentInstance.getDataInsights(enrichedParams);
          } catch (error) {
            return {
              success: false,
              error: error instanceof Error ? error.message : String(error),
              message: `Failed to get data insights: ${error instanceof Error ? error.message : String(error)}`
            };
          }
        }
        
        return {
          success: false,
          error: 'PersonalAssistantAgent instance not available',
          message: 'Cannot get data insights: agent instance not initialized'
        };
      }
    };

    return this.cachedTool;
  }

  protected async executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult> {
    if (this.agentInstance && typeof this.agentInstance.getDataInsights === 'function') {
      const enrichedParams = {
        ...params,
        _userId: params._userId || context.userId,
        _sessionId: params._sessionId || context.sessionId
      };
      
      try {
        const result = await this.agentInstance.getDataInsights(enrichedParams);
        return {
          success: result.success !== false,
          data: result,
          error: result.error,
          retryable: false
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          retryable: true
        };
      }
    }
    
    return {
      success: false,
      error: 'PersonalAssistantAgent instance not available',
      retryable: false
    };
  }

  async isAvailable(context: ToolContext): Promise<boolean> {
    return true;
  }

  getDescription(): string {
    return 'Get comprehensive data insights about AI agent performance, code generation patterns, and project activity.';
  }

  getUsageExamples(): string[] {
    return [
      'Get data insights',
      'Show analytics patterns',
      'What insights can you provide?'
    ];
  }
}

