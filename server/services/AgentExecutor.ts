import { RequirementsAgent } from '../agents/RequirementsAgent';
import { ComponentArchitectAgent } from '../agents/ComponentArchitectAgent';
import { UIDesignerAgent } from '../agents/UIDesignerAgent';
import { StyleGeneratorAgent } from '../agents/StyleGeneratorAgent';
import { CodeGeneratorAgent } from '../agents/CodeGeneratorAgent';
import { CompletionAgent } from '../agents/CompletionAgent';
import { SharedMemory } from '../utils/SharedMemory';
import { ComponentFeatures, AgentResult } from '../utils/types';
import { agentEventEmitter } from '../index';
import { agentActivityEmitter } from '../routes/sse';
import { SimpleLogger } from '../utils/SimpleLogger';

/**
 * AgentExecutor - Bridge between SmartOrchestrator and actual agent execution
 *
 * Provides fine-grained control over individual agent execution for SmartOrchestrator
 * to achieve cost and performance optimizations.
 */

export interface AgentExecutionContext {
  prompt: string;
  features: ComponentFeatures;
  sessionId: string;
  workflowId: string;
  phase: number;
  model: string;
  context: string[];
  sharedMemory: SharedMemory;
}

export interface AgentExecutionResult extends AgentResult {
  cost: number;
  duration: number;
  tokensUsed: number;
  model: string;
}

// Cost per 1M tokens (input/output average)
const MODEL_COSTS = {
  'claude-sonnet-4-20250514': 3.00,      // $3 per 1M tokens (average)
  'claude-haiku-4-20250514': 0.20,       // $0.20 per 1M tokens (15x cheaper!)
  'claude-opus-4-20250514': 15.00,       // $15 per 1M tokens (most expensive)
};

export class AgentExecutor {
  private requirementsAgent: RequirementsAgent;
  private componentArchitectAgent: ComponentArchitectAgent;
  private uiDesignerAgent: UIDesignerAgent;
  private styleGeneratorAgent: StyleGeneratorAgent;
  private codeGeneratorAgent: CodeGeneratorAgent;
  private completionAgent: CompletionAgent;
  private logger: SimpleLogger;

  constructor() {
    this.logger = new SimpleLogger('AgentExecutor');
    this.requirementsAgent = new RequirementsAgent();
    this.componentArchitectAgent = new ComponentArchitectAgent();
    this.uiDesignerAgent = new UIDesignerAgent();
    this.styleGeneratorAgent = new StyleGeneratorAgent();
    this.codeGeneratorAgent = new CodeGeneratorAgent();
    this.completionAgent = new CompletionAgent();
  }

  /**
   * Execute a specific agent with full control over model and context
   */
  async executeAgent(
    agentType: string,
    context: AgentExecutionContext
  ): Promise<AgentExecutionResult> {
    const start = Date.now();

    this.logger.info(`Executing ${agentType} with model ${context.model}`);

    // Emit agent start event for monitoring
    const startEvent = {
      type: 'AGENT_START',
      agent: agentType,
      agentId: agentType,
      workflowId: context.workflowId,
      phase: context.phase,
      model: context.model,
      task: context.prompt.substring(0, 100) + '...',
      timestamp: new Date().toISOString(),
    };
    agentEventEmitter.emit('agent-event', startEvent);
    agentActivityEmitter.emit('agent_event', startEvent);

    let agentResult: AgentResult;

    try {
      // Execute the appropriate agent
      switch (agentType) {
        case 'requirements-agent':
          agentResult = await this.requirementsAgent.executeTask({
            prompt: context.prompt,
            sharedMemory: context.sharedMemory,
          });
          break;

        case 'component-architect':
          agentResult = await this.componentArchitectAgent.executeTask({
            prompt: context.prompt,
            sharedMemory: context.sharedMemory,
          });
          break;

        case 'ui-designer':
          const uiResult = await this.uiDesignerAgent.executeTask(context.prompt);
          agentResult = {
            success: true,
            files: [],
            content: JSON.stringify({
              components: uiResult.components || [],
              styles: uiResult.styles || '',
              structure: uiResult.structure || '',
            }),
          };
          break;

        case 'style-generator':
          agentResult = await this.styleGeneratorAgent.executeTask({
            prompt: context.prompt,
            sharedMemory: context.sharedMemory,
          });
          break;

        case 'code-generator':
          const codeResult = await this.codeGeneratorAgent.executeTask({
            prompt: context.prompt,
            sharedMemory: context.sharedMemory,
          });
          agentResult = {
            success: true,
            files: codeResult.files || [],
          };
          break;

        case 'completion-agent':
          await this.completionAgent.executeTask(context.prompt);
          agentResult = {
            success: true,
            files: [],
          };
          break;

        default:
          throw new Error(`Unknown agent type: ${agentType}`);
      }

      const duration = Date.now() - start;

      // Estimate token usage (rough approximation: 1 token ≈ 4 characters)
      const inputTokens = Math.ceil(context.prompt.length / 4);
      const outputTokens = agentResult.files
        ? Math.ceil(agentResult.files.reduce((sum, f) => sum + f.content.length, 0) / 4)
        : Math.ceil((agentResult.content?.length || 0) / 4);
      const totalTokens = inputTokens + outputTokens;

      // Calculate cost based on model
      const costPer1M = MODEL_COSTS[context.model as keyof typeof MODEL_COSTS] || MODEL_COSTS['claude-sonnet-4-20250514'];
      const cost = (totalTokens / 1_000_000) * costPer1M;

      // Store result in shared memory
      context.sharedMemory.set(`result:${agentType}`, agentResult);

      this.logger.info(`Agent ${agentType} completed`, {
        duration,
        cost: `$${cost.toFixed(4)}`,
        tokensUsed: totalTokens,
        model: context.model,
      });

      // Emit completion event
      const completeEvent = {
        type: 'AGENT_COMPLETE',
        agent: agentType,
        agentId: agentType,
        workflowId: context.workflowId,
        phase: context.phase,
        duration,
        cost,
        tokensUsed: totalTokens,
        model: context.model,
        timestamp: new Date().toISOString(),
        success: true,
        message: `${agentType} completed successfully`,
      };
      agentEventEmitter.emit('agent-event', completeEvent);
      agentActivityEmitter.emit('agent_event', completeEvent);

      return {
        ...agentResult,
        cost,
        duration,
        tokensUsed: totalTokens,
        model: context.model,
      };
    } catch (error) {
      const duration = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(`Agent ${agentType} failed`, error as Error);

      // Emit error event
      const errorEvent = {
        type: 'AGENT_ERROR',
        agent: agentType,
        agentId: agentType,
        workflowId: context.workflowId,
        phase: context.phase,
        error: errorMessage,
        duration,
        message: `Agent ${agentType} encountered an error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      };
      agentEventEmitter.emit('agent-event', errorEvent);
      agentActivityEmitter.emit('agent_event', errorEvent);

      throw error;
    }
  }

  /**
   * Execute multiple agents in parallel (for wave-based execution)
   */
  async executeAgentsInParallel(
    agents: Array<{ type: string; context: AgentExecutionContext }>
  ): Promise<AgentExecutionResult[]> {
    this.logger.info(`Executing ${agents.length} agents in parallel`);

    const results = await Promise.all(
      agents.map(({ type, context }) => this.executeAgent(type, context))
    );

    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    const maxDuration = Math.max(...results.map(r => r.duration));
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);

    this.logger.info('Parallel execution complete', {
      agentsExecuted: agents.length,
      totalCost: `$${totalCost.toFixed(4)}`,
      maxDuration: `${maxDuration}ms`,
      totalTokens,
    });

    return results;
  }

  /**
   * Create a SharedMemory instance for agent communication
   */
  createSharedMemory(sessionId: string): SharedMemory {
    return new SharedMemory(sessionId);
  }

  /**
   * Merge agent results into final file list
   */
  mergeAgentResults(results: AgentExecutionResult[]): AgentResult {
    const allFiles = results
      .filter(r => r.files && r.files.length > 0)
      .flatMap(r => r.files!);

    // Deduplicate files by path (later results override earlier ones)
    const fileMap = new Map<string, typeof allFiles[0]>();
    allFiles.forEach(file => {
      fileMap.set(file.path, file);
    });

    const agentsUsed = results
      .filter(r => r.success)
      .map((_, i) => results[i].model);

    return {
      success: results.every(r => r.success),
      files: Array.from(fileMap.values()),
      componentName: '',
      errors: results.flatMap(r => r.errors || []),
    };
  }

  /**
   * Calculate total cost and metrics from agent results
   */
  calculateMetrics(results: AgentExecutionResult[]): {
    totalCost: number;
    totalDuration: number;
    totalTokens: number;
    averageCost: number;
    modelsUsed: Record<string, number>;
  } {
    const totalCost = results.reduce((sum, r) => sum + r.cost, 0);
    const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
    const totalTokens = results.reduce((sum, r) => sum + r.tokensUsed, 0);

    const modelsUsed: Record<string, number> = {};
    results.forEach(r => {
      modelsUsed[r.model] = (modelsUsed[r.model] || 0) + 1;
    });

    return {
      totalCost,
      totalDuration,
      totalTokens,
      averageCost: totalCost / results.length,
      modelsUsed,
    };
  }
}

export const agentExecutor = new AgentExecutor();
