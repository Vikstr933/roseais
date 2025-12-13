import { BaseAgent } from './BaseAgent';
import { AgentResult } from '../utils/types';
import { SharedMemory } from '../utils/SharedMemory';
import { SimpleLogger } from '../utils/SimpleLogger';
import { AICodeGenerator } from '../services/AICodeGenerator';

interface ComponentNode {
  name: string;
  path: string;
  children: ComponentNode[];
  props: string[];
  state: string[];
  hooks: string[];
  responsibilities: string[];
}

interface ComponentArchitecture {
  hierarchy: ComponentNode[];
  stateManagement: string;
  routing: boolean;
  apiIntegration: boolean;
  fileAssignments: Array<{
    path: string;
    type: string;
    assignedAgent: string;
  }>;
}

interface ArchitectTask {
  prompt: string;
  sharedMemory: SharedMemory;
}

export class ComponentArchitectAgent extends BaseAgent {
  private readonly aiGenerator = new AICodeGenerator();

  constructor() {
    super('component-architect');
  }

  protected async setup(): Promise<void> {
    // No additional setup needed
  }

  async executeTask(task: ArchitectTask | string): Promise<AgentResult> {
    const prompt = typeof task === 'string' ? task : task.prompt;
    const sharedMemory = typeof task === 'string' ? new SharedMemory('architecture') : task.sharedMemory;

    const requirements = sharedMemory.get('requirements');
    if (!requirements) {
      this.logger.warn('Requirements missing from shared memory');
    }

    this.logger.info('Designing component architecture');
    const start = Date.now();

    try {
      const architecturePrompt = this.buildPrompt(prompt, requirements);
      const response = await this.aiGenerator.generateComponent({
        prompt: architecturePrompt,
        componentName: 'ComponentArchitecture',
        features: [],
      });

      const architecture = this.parseArchitecture(response.code ?? '{}');
      const assignments = this.assignFilesToAgents(architecture);
      architecture.fileAssignments = assignments;

      sharedMemory.set('architecture', architecture);
      sharedMemory.set('fileAssignments', assignments);

      return {
        success: true,
        content: JSON.stringify(architecture, null, 2),
        metadata: {
          executionTime: Date.now() - start,
          resourceUsage: {
            memory: process.memoryUsage().heapUsed / 1024 / 1024,
            cpu: 0,
          },
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error('Architecture design failed', error as Error);
      return {
        success: false,
        errors: [message],
      };
    }
  }

  private buildPrompt(prompt: string, requirements: any): string {
    return `You are a senior React architect. Design a component hierarchy and file structure.

USER_PROMPT:
${prompt}

REQUIREMENTS:
${JSON.stringify(requirements, null, 2)}

Return ONLY valid JSON:
{
  "hierarchy": ComponentNode[],
  "stateManagement": string,
  "routing": boolean,
  "apiIntegration": boolean
}`;
  }

  private parseArchitecture(payload: string): ComponentArchitecture {
    const cleaned = payload.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return {
        hierarchy: parsed.hierarchy ?? [],
        stateManagement: parsed.stateManagement ?? 'context',
        routing: Boolean(parsed.routing),
        apiIntegration: Boolean(parsed.apiIntegration),
        fileAssignments: [],
      };
    } catch (error) {
      this.logger.error('Failed to parse architecture JSON', error as Error);
      return {
        hierarchy: [],
        stateManagement: 'context',
        routing: false,
        apiIntegration: false,
        fileAssignments: [],
      };
    }
  }

  private assignFilesToAgents(architecture: ComponentArchitecture) {
    const assignments: Array<{ path: string; type: string; assignedAgent: string }> = [];

    const walk = (nodes: ComponentNode[]) => {
      nodes.forEach(node => {
        assignments.push({
          path: node.path,
          type: 'component',
          assignedAgent: `component-generator-${assignments.length % 3}`,
        });
        walk(node.children ?? []);
      });
    };

    walk(architecture.hierarchy ?? []);

    if (architecture.stateManagement === 'context') {
      assignments.push({
        path: 'src/contexts/AppContext.tsx',
        type: 'context',
        assignedAgent: 'context-generator',
      });
    }

    assignments.push({
      path: 'src/types/index.ts',
      type: 'types',
      assignedAgent: 'type-generator',
    });

    return assignments;
  }
}


