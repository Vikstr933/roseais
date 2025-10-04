import { BaseAgent } from './BaseAgent';
import { CodeGeneratorAgent } from './CodeGeneratorAgent';
import { UIDesignerAgent } from './UIDesignerAgent';
import { CompletionAgent } from './CompletionAgent';
import { ToolRegistry } from '../utils/ToolRegistry';
import { SimpleLogger } from '../utils/SimpleLogger';
import { ComponentFeatures, AgentResult, GeneratedFile } from '../utils/types';

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
  protected toolRegistry: ToolRegistry;
  protected logger: SimpleLogger;

  constructor() {
    super('orchestration-agent');
    this.logger = new SimpleLogger('OrchestrationAgent');
    this.codeGeneratorAgent = new CodeGeneratorAgent();
    this.uiDesignerAgent = new UIDesignerAgent();
    this.completionAgent = new CompletionAgent();
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
    // Handle both string and OrchestrationTask for compatibility
    const orchestrationTask: OrchestrationTask = typeof task === 'string' 
      ? { 
          prompt: task, 
          features: { name: 'App', features: [], styling: { animations: false, theme: 'light' } } 
        }
      : task;
    const result: OrchestrationResult = {
      success: false,
      files: [],
      componentName: orchestrationTask.features.name,
      errors: [],
      warnings: [],
      agentsUsed: [],
    };

    try {
      this.logger.info(`Starting orchestration for: ${orchestrationTask.prompt}`);
      orchestrationTask.progressCallback?.(['🤖 Initializing AI agents...']);

      // Step 1: UI Design Agent - Design the interface
      orchestrationTask.progressCallback?.(['🎨 Designing UI components...']);
      const uiDesign = await this.uiDesignerAgent.executeTask(orchestrationTask.prompt);
      result.agentsUsed.push('UIDesignerAgent');

      // Step 2: Code Generator Agent - Generate the actual code
      orchestrationTask.progressCallback?.(['⚡ Generating intelligent code...']);
      const codeResult = await this.codeGeneratorAgent.executeTask(orchestrationTask.prompt);
      result.agentsUsed.push('CodeGeneratorAgent');

      // Step 3: Completion Agent - Validate and improve the code
      orchestrationTask.progressCallback?.(['🔍 Validating and optimizing code...']);
      await this.completionAgent.executeTask(orchestrationTask.prompt);
      result.agentsUsed.push('CompletionAgent');

      // Step 4: Enhance the generated files with AI intelligence
      const enhancedFiles = await this.enhanceGeneratedFiles(codeResult.files, orchestrationTask, uiDesign);
      result.files = enhancedFiles;

      // Step 5: Validate the final result
      const validationResult = await this.validateFinalResult(result.files);
      if (!validationResult.isValid) {
        result.warnings.push(...validationResult.warnings);
      }

      result.success = true;
      orchestrationTask.progressCallback?.(['✅ AI-powered app generation complete!']);
      orchestrationTask.progressCallback?.(['🌐 Ready for automatic deployment...']);

      this.logger.info('Orchestration completed successfully');

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      result.errors.push(`Orchestration failed: ${errorMessage}`);
      this.logger.error('Orchestration failed', error as Error);
    }

    return result;
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
