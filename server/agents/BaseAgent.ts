import { ToolRegistry } from '../utils/ToolRegistry';
import { SimpleLogger } from '../utils/SimpleLogger';

export abstract class BaseAgent {
  protected toolRegistry!: ToolRegistry;
  protected logger: SimpleLogger;
  protected agentName: string;

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
}
