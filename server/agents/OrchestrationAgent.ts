import { BaseAgent } from './BaseAgent';
import { CodeGeneratorAgent } from './CodeGeneratorAgent';
import { UIDesignerAgent } from './UIDesignerAgent';
import { CompletionAgent } from './CompletionAgent';
import { ToolRegistry } from '../utils/ToolRegistry';
import { SimpleLogger } from '../utils/SimpleLogger';
import { ComponentFeatures, AgentResult, GeneratedFile } from '../utils/types';
import { ExecutionGraph } from '../utils/ExecutionGraph';
import { SharedMemory } from '../utils/SharedMemory';
import { RequirementsAgent } from './RequirementsAgent';
import { ComponentArchitectAgent } from './ComponentArchitectAgent';
import { StyleGeneratorAgent } from './StyleGeneratorAgent';
import { agentEventEmitter } from '../index';
import { FileOrchestrator } from '../utils/FileOrchestrator';
import { MetricsCollector } from '../utils/MetricsCollector';
import { PromptBuilder, ORCHESTRATION_PROMPT } from '../prompts/UltimateAgentPrompts';
import { agentActivityEmitter } from '../routes/sse';

export interface OrchestrationTask {
  prompt: string;
  features: ComponentFeatures;
  sessionId?: string;
  progressCallback?: (details: string[]) => void;
}

export interface OrchestrationResult {
  success: boolean;
  files: GeneratedFile[];
  componentName: string;
  errors: string[];
  warnings: string[];
  agentsUsed: string[];
}

export class OrchestrationAgent extends BaseAgent {
  private codeGeneratorAgent: CodeGeneratorAgent;
  private uiDesignerAgent: UIDesignerAgent;
  private completionAgent: CompletionAgent;
  private requirementsAgent: RequirementsAgent;
  private componentArchitectAgent: ComponentArchitectAgent;
  private styleGeneratorAgent: StyleGeneratorAgent;
  protected toolRegistry: ToolRegistry;
  protected logger: SimpleLogger;
  private static metricsCollector = new MetricsCollector();

  constructor() {
    super('orchestration-agent');
    this.logger = new SimpleLogger('OrchestrationAgent');
    this.codeGeneratorAgent = new CodeGeneratorAgent();
    this.uiDesignerAgent = new UIDesignerAgent();
    this.completionAgent = new CompletionAgent();
    this.requirementsAgent = new RequirementsAgent();
    this.componentArchitectAgent = new ComponentArchitectAgent();
    this.styleGeneratorAgent = new StyleGeneratorAgent();
    this.toolRegistry = new ToolRegistry();
  }

  protected async setup(): Promise<void> {
    this.logger.info('Initializing OrchestrationAgent...');
    
    // Initialize tool registry with AI capabilities
    await this.initializeToolRegistry();
    
    // Initialize all sub-agents
    await this.codeGeneratorAgent.initialize(this.toolRegistry);
    await this.uiDesignerAgent.initialize(this.toolRegistry);
    await this.completionAgent.initialize(this.toolRegistry);
    
    this.logger.info('OrchestrationAgent initialized successfully');
  }

  async initialize(toolRegistry?: ToolRegistry): Promise<void> {
    if (toolRegistry) {
      this.toolRegistry = toolRegistry;
    }
    await this.setup();
  }

  private async initializeToolRegistry(): Promise<void> {
    // Register AI-powered code generation tool
    this.toolRegistry.registerTool({
      name: 'ai-code-generation',
      description: 'Generate intelligent code based on requirements',
      execute: this.generateIntelligentCode.bind(this),
    });

    // Register code validation tool
    this.toolRegistry.registerTool({
      name: 'code-validation',
      description: 'Validate generated code for errors and best practices',
      execute: this.validateGeneratedCode.bind(this),
    });

    // Register UI design tool
    this.toolRegistry.registerTool({
      name: 'ui-design',
      description: 'Design UI components and layouts',
      execute: this.designUI.bind(this),
    });
  }

  private async generateIntelligentCode(prompt: string, context: any): Promise<string> {
    // This would integrate with your AI service (Claude, GPT, etc.)
    // For now, we'll use the existing CodeGeneratorAgent logic but make it smarter
    
    const task = `${prompt} - Context: ${JSON.stringify(context)}`;
    const result = await this.codeGeneratorAgent.executeTask(task);
    
    // Return the main component code
    const mainComponent = result.files.find(f => f.path.includes('.tsx') && !f.path.includes('main.tsx'));
    return mainComponent?.content || '';
  }

  private async validateGeneratedCode(code: string): Promise<boolean> {
    // Basic validation - check for common issues
    const issues = [];
    
    if (!code.includes('import React')) {
      issues.push('Missing React import');
    }
    
    if (!code.includes('export default')) {
      issues.push('Missing default export');
    }
    
    if (code.includes('console.log')) {
      issues.push('Contains console.log statements');
    }
    
    return issues.length === 0;
  }

  private async designUI(requirements: string): Promise<any> {
    const result = await this.uiDesignerAgent.executeTask(requirements);
    return result;
  }

  async executeTask(task: string | OrchestrationTask): Promise<OrchestrationResult> {
    const orchestrationTask: OrchestrationTask = typeof task === 'string'
      ? {
          prompt: task,
          features: { name: 'App', features: [], styling: { animations: false, theme: 'light' } },
        }
      : task;

    // Apply ultimate orchestration prompt for enhanced intelligence
    const enhancedPrompt = PromptBuilder.buildOrchestrationPrompt(
      orchestrationTask.prompt,
      `Component: ${orchestrationTask.features.name}, Features: ${orchestrationTask.features.features.join(', ')}`
    );

    this.logger.info('Enhanced orchestration prompt applied', {
      originalLength: orchestrationTask.prompt.length,
      enhancedLength: enhancedPrompt.length
    });

    const result: OrchestrationResult = {
      success: false,
      files: [],
      componentName: orchestrationTask.features.name,
      errors: [],
      warnings: [],
      agentsUsed: [],
    };

    const sharedMemory = new SharedMemory(orchestrationTask.sessionId ?? 'default');
    sharedMemory.set('startTime', Date.now());
    const fileOrchestrator = new FileOrchestrator();
    sharedMemory.set('fileOrchestrator', fileOrchestrator);

    try {
      const workflowId = `${orchestrationTask.sessionId ?? 'local'}-${Date.now()}`;

      const startPayload = {
        type: 'orchestration:start',
        workflowId,
        prompt: orchestrationTask.prompt,
        component: orchestrationTask.features.name,
        timestamp: Date.now(),
      };
      this.logger.info('Starting orchestration', startPayload);
      agentEventEmitter.emit('agent-event', startPayload);

      orchestrationTask.progressCallback?.(['🤖 Initializing AI agents...']);

      const executionGraph = new ExecutionGraph([
        { id: 'requirements', dependsOn: [] },
        { id: 'ui-designer', dependsOn: ['requirements'] },
        { id: 'component-architect', dependsOn: ['requirements'] },
        { id: 'style-generator', dependsOn: ['requirements'] },
        {
          id: 'code-generator',
          dependsOn: ['component-architect', 'style-generator'],
        },
        { id: 'completion', dependsOn: ['code-generator'] },
      ]);

      const phases = executionGraph.computePhases();

      for (const phase of phases) {
        const phaseLabels = phase.nodes.map(node => node.id).join(', ');
        const phaseStartPayload = {
          type: 'phase:start' as const,
          workflowId,
          phase: phase.index,
          agentsInPhase: phase.nodes.map(node => node.id),
          timestamp: Date.now(),
        };
        this.logger.info('Executing orchestration phase', phaseStartPayload);
        agentEventEmitter.emit('agent-event', phaseStartPayload);

        orchestrationTask.progressCallback?.([
          `🚀 Executing agents: ${phaseLabels}`,
        ]);

        const phaseResults = await Promise.all(
          phase.nodes.map(node =>
            this.runAgentNode(node.id as 'requirements' | 'ui-designer' | 'component-architect' | 'style-generator' | 'code-generator' | 'completion', {
              task: orchestrationTask,
              sharedMemory,
              result,
              workflowId,
              phase: phase.index,
            })
          )
        );

        phaseResults
          .filter(Boolean)
          .forEach(resolved => {
            if (resolved?.files?.length) {
              resolved.files.forEach(file => {
                sharedMemory.set(`file:${file.path}`, file.content);
              });
            }
          });

        agentEventEmitter.emit('agent-event', {
          type: 'phase:complete',
          workflowId,
          phase: phase.index,
          timestamp: Date.now(),
        });
      }

      const codeResult = sharedMemory.get<AgentResult>('result:code-generator');
      const uiDesign = sharedMemory.get<AgentResult>('result:ui-designer');
      const architecture = sharedMemory.get<{ fileAssignments?: { path: string; assignedAgent: string; type: string }[] }>('architecture');
      const fileOrchestrator = sharedMemory.get<FileOrchestrator>('fileOrchestrator');

      if (!codeResult?.files) {
        throw new Error('No files generated by code generator');
      }

      const enhancedFiles = await this.enhanceGeneratedFiles(
        codeResult.files,
        orchestrationTask,
        uiDesign
      );
      result.files = enhancedFiles;

      const assignments = architecture?.fileAssignments ?? [];
      assignments.forEach(assignment =>
        fileOrchestrator?.register(assignment.path, assignment.assignedAgent, assignment.type)
      );

      const orchestratedFiles = fileOrchestrator?.getCompletedFiles() ?? [];
      if (orchestratedFiles.length > 0) {
        result.files = orchestratedFiles;
      }

      const validationResult = await this.validateFinalResult(result.files);
      if (!validationResult.isValid) {
        result.warnings.push(...validationResult.warnings);
      }

      const conflicts = fileOrchestrator?.getConflicts() ?? [];
      conflicts.forEach(conflict =>
        this.logger.warn(`Detected file assignment conflict: path=${conflict.path}, owner=${conflict.owner}`)
      );

      result.success = true;
      orchestrationTask.progressCallback?.(['✅ AI-powered app generation complete!']);
      orchestrationTask.progressCallback?.(['🌐 Ready for automatic deployment...']);
      OrchestrationAgent.metricsCollector.record({
        workflowId,
        duration: Date.now() - Number(sharedMemory.get('startTime') ?? Date.now()),
        agentsUsed: result.agentsUsed.length,
        warnings: result.warnings.length,
        success: true,
        timestamp: Date.now(),
      });
      const successPayload = {
        type: 'orchestration:complete',
        workflowId,
        timestamp: Date.now(),
        warnings: result.warnings.length,
        agentsUsed: result.agentsUsed,
      };
      this.logger.info('Orchestration completed successfully', successPayload);
      agentEventEmitter.emit('agent-event', successPayload);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Orchestration failed: ${errorMessage}`);
      this.logger.error('Orchestration failed', error as Error);
      agentEventEmitter.emit('agent-event', {
        type: 'orchestration:error',
        workflowId: `${task instanceof Object && 'sessionId' in task ? task.sessionId : 'local'}-${Date.now()}`,
        error: errorMessage,
        timestamp: Date.now(),
      });
    }

    return result;
  }

  private async runAgentNode(
    agentId:
      | 'requirements'
      | 'ui-designer'
      | 'component-architect'
      | 'style-generator'
      | 'code-generator'
      | 'completion',
    context: {
      task: OrchestrationTask;
      sharedMemory: SharedMemory;
      result: OrchestrationResult;
      workflowId: string;
      phase: number;
    }
  ): Promise<AgentResult | undefined> {
    const { task, sharedMemory, result, workflowId, phase } = context;

    const start = Date.now();
    let agentResult: AgentResult | undefined;

    // Emit agent start event for live monitoring (both emitters for compatibility)
    const startEvent = {
      type: 'AGENT_START',
      agent: agentId,
      agentId,
      workflowId,
      phase,
      task: task.prompt.substring(0, 100) + '...',
      timestamp: new Date().toISOString(),
    };
    agentEventEmitter.emit('agent-event', startEvent);
    agentActivityEmitter.emit('agent_event', startEvent);

    try {
      switch (agentId) {
        case 'requirements': {
          const reqResult = await this.requirementsAgent.executeTask({
            prompt: task.prompt,
            sharedMemory,
          });
          agentResult = reqResult;
          result.agentsUsed.push('RequirementsAgent');
          break;
        }
        case 'ui-designer': {
          task.progressCallback?.(['🎨 Designing UI components...']);
          const uiResult = await this.uiDesignerAgent.executeTask(task.prompt);
          agentResult = {
            success: true,
            content: JSON.stringify(uiResult),
            files: [],
          };
          result.agentsUsed.push('UIDesignerAgent');
          break;
        }
        case 'component-architect': {
          const architectResult = await this.componentArchitectAgent.executeTask({
            prompt: task.prompt,
            sharedMemory,
          });
          agentResult = architectResult;
          result.agentsUsed.push('ComponentArchitectAgent');
          break;
        }
        case 'style-generator': {
          const styleResult = await this.styleGeneratorAgent.executeTask({
            prompt: task.prompt,
            sharedMemory,
          });
          agentResult = styleResult;
          result.agentsUsed.push('StyleGeneratorAgent');
          break;
        }
        case 'code-generator': {
          task.progressCallback?.(['⚡ Generating intelligent code...']);
          const codeResult = await this.codeGeneratorAgent.executeTask({
            prompt: task.prompt,
            sharedMemory,
          });
          agentResult = {
            success: true,
            files: codeResult.files,
          };
          result.agentsUsed.push('CodeGeneratorAgent');
          break;
        }
        case 'completion': {
          task.progressCallback?.(['🔍 Validating and optimizing code...']);
          await this.completionAgent.executeTask(task.prompt);
          agentResult = {
            success: true,
            files: [],
          };
          result.agentsUsed.push('CompletionAgent');
          break;
        }
        default: {
          this.logger.warn(`Unknown agent node, skipping: ${agentId}`);
          return undefined;
        }
      }

      sharedMemory.set(`result:${agentId}`, {
        ...agentResult,
        metadata: {
          ...(agentResult?.metadata ?? {}),
          executionTime: Date.now() - start,
        },
      });

      this.logger.info('Agent completed', {
        agentId,
        workflowId,
        phase,
        duration: Date.now() - start,
      });
      const completeEvent = {
        type: 'AGENT_COMPLETE',
        agent: agentId,
        agentId,
        workflowId,
        phase,
        duration: Date.now() - start,
        timestamp: new Date().toISOString(),
        success: agentResult?.success !== false,
        message: `${agentId} completed successfully`,
      };
      agentEventEmitter.emit('agent-event', completeEvent);
      agentActivityEmitter.emit('agent_event', completeEvent);

      return agentResult;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      task.progressCallback?.([
        `❌ Agent ${agentId} failed: ${errorMessage}`,
      ]);
      result.errors.push(`Agent ${agentId} failed: ${errorMessage}`);
      this.logger.error(`Agent execution failed: agentId=${agentId}, workflowId=${workflowId}, phase=${phase}`, error as Error);
      const errorEvent = {
        type: 'AGENT_ERROR',
        agent: agentId,
        agentId,
        workflowId,
        phase,
        error: errorMessage,
        message: `Agent ${agentId} encountered an error: ${errorMessage}`,
        timestamp: new Date().toISOString(),
      };
      agentEventEmitter.emit('agent-event', errorEvent);
      agentActivityEmitter.emit('agent_event', errorEvent);
      throw error;
    }
  }

  private async enhanceGeneratedFiles(
    files: GeneratedFile[],
    task: OrchestrationTask,
    uiDesign: any
  ): Promise<GeneratedFile[]> {
    const enhancedFiles: GeneratedFile[] = [];

    for (const file of files) {
      let enhancedContent = file.content;

      // Enhance main component files with AI intelligence
      if (file.path.endsWith('.tsx') && !file.path.includes('main.tsx')) {
        enhancedContent = await this.enhanceComponentWithAI(file.content, task.prompt, uiDesign);
      }

      // Enhance package.json with intelligent dependencies
      if (file.path === 'package.json') {
        enhancedContent = await this.enhancePackageJson(file.content, task.features);
      }

      enhancedFiles.push({
        ...file,
        content: enhancedContent,
      });
    }

    return enhancedFiles;
  }

  private async enhanceComponentWithAI(
    componentCode: string,
    prompt: string,
    uiDesign: any
  ): Promise<string> {
    // This is where we would integrate with AI to make the component smarter
    // For now, we'll enhance it with better TypeScript types and error handling
    
    let enhancedCode = componentCode;

    // Add better error boundaries
    if (!enhancedCode.includes('ErrorBoundary')) {
      enhancedCode = enhancedCode.replace(
        'export default function',
        'const ErrorBoundary = ({ children }: { children: React.ReactNode }) => {\n  const [hasError, setHasError] = React.useState(false);\n\n  React.useEffect(() => {\n    const handleError = () => setHasError(true);\n    window.addEventListener(\'error\', handleError);\n    return () => window.removeEventListener(\'error\', handleError);\n  }, []);\n\n  if (hasError) {\n    return (\n      <div className="error-boundary p-4 bg-red-50 border border-red-200 rounded-lg">\n        <h3 className="text-red-800 font-semibold">Something went wrong</h3>\n        <p className="text-red-600">Please refresh the page to try again.</p>\n      </div>\n    );\n  }\n\n  return <>{children}</>;\n};\n\nexport default function'
      );
    }

    // Add loading states for better UX
    if (enhancedCode.includes('useState') && !enhancedCode.includes('loading')) {
      enhancedCode = enhancedCode.replace(
        'const [',
        'const [loading, setLoading] = React.useState(false);\n  const ['
      );
    }

    return enhancedCode;
  }

  private async enhancePackageJson(packageJsonContent: string, features: ComponentFeatures): Promise<string> {
    try {
      const packageJson = JSON.parse(packageJsonContent);
      
      // Add intelligent dependencies based on features
      if (features.features.some(f => f.toLowerCase().includes('animation'))) {
        packageJson.dependencies['framer-motion'] = '^10.16.0';
      }
      
      if (features.features.some(f => f.toLowerCase().includes('chart') || f.toLowerCase().includes('graph'))) {
        packageJson.dependencies['recharts'] = '^2.8.0';
      }
      
      if (features.features.some(f => f.toLowerCase().includes('form'))) {
        packageJson.dependencies['react-hook-form'] = '^7.47.0';
        packageJson.dependencies['zod'] = '^3.22.0';
      }
      
      if (features.features.some(f => f.toLowerCase().includes('api') || f.toLowerCase().includes('fetch'))) {
        packageJson.dependencies['axios'] = '^1.6.0';
      }

      // Add development tools
      packageJson.devDependencies['@types/node'] = '^20.8.0';
      packageJson.devDependencies['eslint'] = '^8.52.0';
      packageJson.devDependencies['prettier'] = '^3.0.0';

      return JSON.stringify(packageJson, null, 2);
    } catch (error) {
      this.logger.error('Failed to enhance package.json', error as Error);
      return packageJsonContent;
    }
  }

  private async validateFinalResult(files: GeneratedFile[]): Promise<{
    isValid: boolean;
    warnings: string[];
  }> {
    const warnings: string[] = [];
    let isValid = true;

    // Check for required files
    const hasPackageJson = files.some(f => f.path === 'package.json');
    const hasMainComponent = files.some(f => f.path.endsWith('.tsx') && !f.path.includes('main.tsx'));
    const hasMainEntry = files.some(f => f.path === 'src/main.tsx');

    if (!hasPackageJson) {
      warnings.push('Missing package.json');
      isValid = false;
    }

    if (!hasMainComponent) {
      warnings.push('Missing main component file');
      isValid = false;
    }

    if (!hasMainEntry) {
      warnings.push('Missing main entry point');
      isValid = false;
    }

    // Check for TypeScript configuration
    const hasTsConfig = files.some(f => f.path === 'tsconfig.json');
    if (!hasTsConfig) {
      warnings.push('Missing TypeScript configuration');
    }

    return { isValid, warnings };
  }
}
