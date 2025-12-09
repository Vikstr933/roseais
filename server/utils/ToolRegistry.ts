import { SimpleLogger } from './SimpleLogger';

export interface Tool {
  name: string;
  description: string;
  execute: (...args: any[]) => Promise<any>;
}

export class ToolRegistry {
  private tools: Map<string, Tool>;
  private logger: SimpleLogger;

  constructor() {
    this.tools = new Map();
    this.logger = new SimpleLogger('ToolRegistry');
  }

  registerTool(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      this.logger.warn(`Tool ${tool.name} already exists, overwriting`);
    }
    this.tools.set(tool.name, tool);
  }

  async executeTool(name: string, ...args: any[]): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    return tool.execute(...args);
  }

  hasTool(name: string): boolean {
    return this.tools.has(name);
  }
}
