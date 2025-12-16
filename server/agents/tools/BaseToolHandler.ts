/**
 * Base Tool Handler
 * 
 * All tool handlers extend this class to ensure consistent interface
 * and enable lazy loading, caching, and error recovery
 */

import { Tool } from '../../plugins/BaseProductivityPlugin';
import { SimpleLogger } from '../../utils/SimpleLogger';

export interface ToolContext {
  userId: string;
  sessionId?: string;
  options?: Record<string, any>;
}

export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  fallbackSuggestion?: string;
  retryable?: boolean;
}

export abstract class BaseToolHandler {
  protected logger: SimpleLogger;
  protected toolName: string;
  protected cachedTool: Tool | null = null;
  protected isInitialized: boolean = false;

  constructor(toolName: string) {
    this.toolName = toolName;
    this.logger = new SimpleLogger(`ToolHandler:${toolName}`);
  }

  /**
   * Get the tool definition (lazy loaded)
   */
  abstract getTool(context: ToolContext): Promise<Tool>;

  /**
   * Execute the tool with error recovery
   */
  async execute(params: Record<string, any>, context: ToolContext): Promise<ToolExecutionResult> {
    try {
      // Try primary execution
      const result = await this.executeTool(params, context);
      
      if (result.success) {
        return result;
      }

      // If failed but retryable, try once more
      if (result.retryable) {
        this.logger.info(`Retrying ${this.toolName} after initial failure`);
        await this.delay(1000); // Brief delay before retry
        return await this.executeTool(params, context);
      }

      // Try fallback if available
      if (result.fallbackSuggestion) {
        this.logger.info(`Attempting fallback for ${this.toolName}`);
        const fallbackResult = await this.tryFallback(params, context, result.fallbackSuggestion);
        if (fallbackResult.success) {
          return fallbackResult;
        }
      }

      return result;
    } catch (error) {
      this.logger.error(`Error executing ${this.toolName}`, error as Error);
      
      // Try to provide helpful error message
      const errorMessage = error instanceof Error ? error.message : String(error);
      const fallback = await this.generateFallbackSuggestion(params, context, errorMessage);
      
      return {
        success: false,
        error: errorMessage,
        fallbackSuggestion: fallback,
        retryable: this.isRetryableError(error)
      };
    }
  }

  /**
   * Execute the actual tool (to be implemented by subclasses)
   */
  protected abstract executeTool(
    params: Record<string, any>,
    context: ToolContext
  ): Promise<ToolExecutionResult>;

  /**
   * Try fallback strategy (optional, can be overridden)
   */
  protected async tryFallback(
    params: Record<string, any>,
    context: ToolContext,
    suggestion: string
  ): Promise<ToolExecutionResult> {
    // Default: no fallback
    return {
      success: false,
      error: 'No fallback available',
      fallbackSuggestion: suggestion
    };
  }

  /**
   * Generate helpful fallback suggestion
   */
  protected async generateFallbackSuggestion(
    params: Record<string, any>,
    context: ToolContext,
    error: string
  ): Promise<string | undefined> {
    // Default implementation - can be overridden
    return `The ${this.toolName} tool encountered an error: ${error}. Please check the parameters and try again.`;
  }

  /**
   * Check if error is retryable
   */
  protected isRetryableError(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return message.includes('timeout') ||
             message.includes('network') ||
             message.includes('connection') ||
             message.includes('temporary');
    }
    return false;
  }

  /**
   * Check if tool is available
   */
  abstract isAvailable(context: ToolContext): Promise<boolean>;

  /**
   * Get tool description for system prompt
   */
  abstract getDescription(): string;

  /**
   * Get usage examples
   */
  abstract getUsageExamples(): string[];

  /**
   * Utility: Delay
   */
  protected delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.cachedTool = null;
    this.isInitialized = false;
  }
}

