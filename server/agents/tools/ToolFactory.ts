/**
 * Tool Factory
 * 
 * Creates and manages tool handlers with lazy loading and caching
 */

import { SimpleLogger } from '../../utils/SimpleLogger';
import { BaseToolHandler, ToolContext } from './BaseToolHandler';
import { Tool } from '../../plugins/BaseProductivityPlugin';

const logger = new SimpleLogger('ToolFactory');

export class ToolFactory {
  private static instance: ToolFactory;
  private handlers: Map<string, BaseToolHandler> = new Map();
  private toolCache: Map<string, { tool: Tool; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): ToolFactory {
    if (!ToolFactory.instance) {
      ToolFactory.instance = new ToolFactory();
    }
    return ToolFactory.instance;
  }

  /**
   * Register a tool handler
   */
  registerHandler(handler: BaseToolHandler): void {
    // Use a more descriptive key
    const handlerName = handler.constructor.name;
    this.handlers.set(handlerName, handler);
    logger.info(`Registered tool handler: ${handlerName}`);
  }

  /**
   * Register handler by tool name (for easier lookup)
   */
  async registerHandlerByToolName(handler: BaseToolHandler): Promise<void> {
    try {
      const tool = await handler.getTool({ userId: '', sessionId: '' });
      this.handlers.set(tool.name, handler);
      logger.info(`Registered tool handler by tool name: ${tool.name}`);
    } catch (error) {
      // Fallback to class name
      this.registerHandler(handler);
    }
  }

  /**
   * Get tool handler by name
   */
  getHandler(handlerName: string): BaseToolHandler | undefined {
    return this.handlers.get(handlerName);
  }

  /**
   * Get all tools for a context (with caching)
   */
  async getAllTools(context: ToolContext): Promise<Tool[]> {
    const cacheKey = this.getCacheKey(context);
    
    // Get tools from all registered handlers
    const tools: Tool[] = [];
    
    for (const handler of this.handlers.values()) {
      try {
        const isAvailable = await handler.isAvailable(context);
        if (isAvailable) {
          const tool = await handler.getTool(context);
          
          // Check individual tool cache
          const toolCacheKey = `${cacheKey}:${tool.name}`;
          const cached = this.toolCache.get(toolCacheKey);
          
          if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
            tools.push(cached.tool);
          } else {
            tools.push(tool);
            // Cache the tool
            this.toolCache.set(toolCacheKey, {
              tool,
              timestamp: Date.now()
            });
          }
        }
      } catch (error) {
        logger.warn(`Failed to get tool from ${handler.constructor.name}`, error as Error);
      }
    }

    return tools;
  }

  /**
   * Execute a tool by name
   */
  async executeTool(
    toolName: string,
    params: Record<string, any>,
    context: ToolContext
  ): Promise<any> {
    // First try direct lookup by tool name
    const handler = this.handlers.get(toolName);
    if (handler) {
      return await handler.execute(params, context);
    }

    // Fallback: Find handler that provides this tool
    for (const h of this.handlers.values()) {
      try {
        const tool = await h.getTool(context);
        if (tool.name === toolName) {
          return await h.execute(params, context);
        }
      } catch (error) {
        // Continue searching
      }
    }

    throw new Error(`Tool ${toolName} not found`);
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.toolCache.clear();
    for (const handler of this.handlers.values()) {
      handler.clearCache();
    }
    logger.info('Tool cache cleared');
  }

  /**
   * Get cache key for context
   */
  private getCacheKey(context: ToolContext): string {
    return `${context.userId}:${context.sessionId || 'default'}`;
  }

  /**
   * Get all registered handler names
   */
  getRegisteredHandlers(): string[] {
    return Array.from(this.handlers.keys());
  }
}

export const toolFactory = ToolFactory.getInstance();

