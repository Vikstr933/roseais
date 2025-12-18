import { ToolRegistry } from '../utils/ToolRegistry';
import { SimpleLogger } from '../utils/SimpleLogger';
import { agentLearningService } from '../services/AgentLearningService';

export abstract class BaseAgent {
  protected toolRegistry!: ToolRegistry;
  protected logger: SimpleLogger;
  protected agentName: string;
  protected learning = agentLearningService; // Global learning service for all agents

  constructor(name: string) {
    this.agentName = name;
    this.logger = new SimpleLogger(name);
  }

  async initialize(toolRegistry: ToolRegistry): Promise<void> {
    this.toolRegistry = toolRegistry;
    await this.setup();
  }

  protected abstract setup(): Promise<void>;

  abstract executeTask(task: string): Promise<any>;

  /**
   * Helper: Record a failure with automatic agent type detection
   */
  protected async recordFailure(
    error: Error | string,
    context: Record<string, any> = {},
    failureType: 'error' | 'timeout' | 'rejection' | 'validation_failed' = 'error'
  ): Promise<number> {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorCode = error instanceof Error ? error.name : undefined;

    return this.learning.recordFailure({
      agentType: this.agentName,
      failureType,
      errorCode,
      errorMessage,
      context: {
        ...context,
        agentName: this.agentName
      }
    });
  }

  /**
   * Helper: Record a successful solution
   */
  protected async recordSolution(
    problemPattern: string,
    solutionStrategy: string,
    solutionContext: Record<string, any> = {}
  ): Promise<number> {
    return this.learning.recordSolution({
      agentType: this.agentName,
      problemPattern,
      solutionStrategy,
      solutionContext: {
        ...solutionContext,
        agentName: this.agentName
      },
      discoveredBy: this.agentName
    });
  }

  /**
   * Helper: Get solution recommendations before attempting a task
   */
  protected async getSolutions(problemPattern?: string): Promise<any[]> {
    return this.learning.getSolutionRecommendations(
      this.agentName,
      problemPattern || 'unknown_task',
      3
    );
  }
}
