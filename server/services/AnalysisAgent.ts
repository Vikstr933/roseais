/**
 * Analysis Agent
 * 
 * Analyzes user requirements and creates a structured generation plan
 * with phases for incremental code generation.
 */

import { MultiModelAIService } from './MultiModelAIService';
import { SimpleLogger } from '../utils/SimpleLogger';
import { GenerationPlan, GenerationPhase } from './IncrementalOrchestrator';
import { db } from '../../db';
import { agents } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';

export class AnalysisAgent {
  private logger: SimpleLogger;
  private multiModelAI: MultiModelAIService;

  constructor() {
    this.logger = new SimpleLogger('AnalysisAgent');
    this.multiModelAI = new MultiModelAIService();
  }

  /**
   * Analyze user prompt and create a generation plan
   */
  async analyzeAndPlan(
    userPrompt: string,
    knowledgeContext: string = '',
    existingFiles: { path: string; content: string }[] = []
  ): Promise<GenerationPlan> {
    this.logger.info('Analyzing requirements and creating generation plan', {
      promptLength: userPrompt.length,
      hasKnowledgeContext: !!knowledgeContext,
      existingFilesCount: existingFiles.length
    });

    const analysisPrompt = this.buildAnalysisPrompt(userPrompt, knowledgeContext, existingFiles);

    try {
      // Get agent configuration from database (system prompt, model, temperature)
      const agentConfig = await this.getAgentConfig();
      this.logger.info('Using component-architect agent for analysis', {
        model: agentConfig.model,
        temperature: agentConfig.temperature
      });
      
      const response = await this.multiModelAI.generate({
        prompt: analysisPrompt,
        systemPrompt: agentConfig.systemPrompt,
        maxTokens: 4000,
        temperature: agentConfig.temperature,
        useCase: 'code_generation',
        priority: 'quality'
      });

      // Parse the response to extract the plan
      const plan = this.parsePlanResponse(response.content, userPrompt);

      this.logger.info('Generation plan created', {
        appName: plan.appName,
        phases: plan.phases.length
      });

      return plan;
    } catch (error) {
      this.logger.error('Failed to create generation plan', error as Error);
      // Return a default plan as fallback
      return this.createDefaultPlan(userPrompt);
    }
  }

  /**
   * Build the analysis prompt
   */
  private buildAnalysisPrompt(
    userPrompt: string,
    knowledgeContext: string,
    existingFiles: { path: string; content: string }[]
  ): string {
    const isModification = existingFiles.length > 0;
    const modificationKeywords = ['fix', 'change', 'update', 'modify', 'edit', 'add', 'remove', 'delete', 'improve', 'enhance'];
    const isModifyRequest = modificationKeywords.some(keyword => userPrompt.toLowerCase().includes(keyword));
    
    const existingFilesSection = existingFiles.length > 0 ? `
🔄 EXISTING PROJECT FILES (${existingFiles.length} files):
${existingFiles.map(f => `- ${f.path}`).join('\n')}

${isModifyRequest ? '⚠️ MODIFICATION REQUEST DETECTED ⚠️' : '📦 PROJECT CONTINUATION'}
` : '';

    const modificationInstructions = isModification ? `
CRITICAL: This is a MODIFICATION request for an existing project.

IMPORTANT RULES FOR MODIFICATIONS:
1. **PRESERVE UNCHANGED FILES**: Only modify files that need changes based on the user's request
2. **MAINTAIN CONSISTENCY**: Keep the same coding style, patterns, and structure as existing files
3. **INCREMENTAL CHANGES**: Make minimal changes - only what's requested
4. **PRESERVE IMPORTS**: Keep existing imports unless they're no longer needed
5. **FILE STRUCTURE**: Don't reorganize files unless explicitly requested
6. **DEPENDENCIES**: Maintain compatibility with existing code

When creating phases:
- Only include files that NEED to be modified or added
- Skip phases for files that don't need changes
- If a file needs a small change, include it in the appropriate phase
- If adding new features, create new files but keep existing ones intact
` : '';

    return `Analyze the following user request and create a detailed generation plan for ${isModification ? 'modifying' : 'building'} the application incrementally.

USER REQUEST:
${userPrompt}

${knowledgeContext ? `RELEVANT KNOWLEDGE:\n${knowledgeContext}\n` : ''}

${existingFilesSection}

${modificationInstructions}

Your task is to create a generation plan that breaks down the ${isModification ? 'modification' : 'application'} into phases. Each phase should:
1. Build on previous phases
2. Include only related files
3. Be independently validatable
${isModification ? '4. Preserve files that don\'t need changes' : ''}

Create a plan with the following structure:

PHASE 1: BASE FOUNDATION
- Files: package.json, tsconfig.json, index.html, src/main.tsx
- Purpose: Set up project configuration and entry points
- Dependencies: None

PHASE 2: CORE COMPONENT
- Files: src/App.tsx, src/index.css
- Purpose: Create main application component and styling
- Dependencies: Phase 1

PHASE 3+: ADDITIONAL FEATURES
- Add phases for types, hooks, utilities, additional components as needed
- Each phase should depend on previous phases

Respond with a JSON object in this format:
{
  "appName": "Snake Game",
  "appType": "game",
  "techStack": {
    "framework": "React",
    "buildTool": "Vite",
    "language": "TypeScript"
  },
  "phases": [
    {
      "phase": "base",
      "description": "Project foundation and configuration",
      "files": ["package.json", "tsconfig.json", "index.html", "src/main.tsx"],
      "dependencies": [],
      "agentId": "component-developer"
    },
    {
      "phase": "core",
      "description": "Main application component",
      "files": ["src/App.tsx", "src/index.css"],
      "dependencies": ["base"],
      "agentId": "component-developer"
    }
  ]
}

IMPORTANT:
- Keep phases small and focused
- Ensure dependencies are correct
- Include all necessary files
- Use "component-developer" as agentId for code generation phases`;
  }

  /**
   * Parse the AI response to extract the generation plan
   */
  private parsePlanResponse(response: string, userPrompt: string): GenerationPlan {
    try {
      // Try to extract JSON from the response
      let jsonStr = response.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '');
        jsonStr = jsonStr.replace(/\n?```\s*$/i, '');
        jsonStr = jsonStr.trim();
      }

      // Try to find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const planData = JSON.parse(jsonStr);

      // Validate and normalize the plan
      return this.normalizePlan(planData, userPrompt);
    } catch (error) {
      this.logger.warn('Failed to parse plan response, using default plan', error as Error);
      return this.createDefaultPlan(userPrompt);
    }
  }

  /**
   * Normalize and validate the plan
   */
  private normalizePlan(planData: any, userPrompt: string): GenerationPlan {
    // Extract app name from prompt or use default
    const appName = planData.appName || this.extractAppName(userPrompt) || 'GeneratedApp';
    const appType = planData.appType || this.detectAppType(userPrompt) || 'app';

    // Normalize phases
    const phases: GenerationPhase[] = (planData.phases || []).map((p: any, index: number) => ({
      phase: p.phase || `phase-${index + 1}`,
      description: p.description || `Phase ${index + 1}`,
      files: Array.isArray(p.files) ? p.files : [],
      dependencies: Array.isArray(p.dependencies) ? p.dependencies : [],
      agentId: p.agentId || 'component-developer'
    }));

    // Ensure we have at least base and core phases
    if (phases.length === 0) {
      phases.push(
        {
          phase: 'base',
          description: 'Project foundation',
          files: ['package.json', 'tsconfig.json', 'index.html', 'src/main.tsx'],
          dependencies: [],
          agentId: 'component-developer'
        },
        {
          phase: 'core',
          description: 'Main application component',
          files: ['src/App.tsx', 'src/index.css'],
          dependencies: ['base'],
          agentId: 'component-developer'
        }
      );
    }

    return {
      appName,
      appType,
      techStack: {
        framework: planData.techStack?.framework || 'React',
        buildTool: planData.techStack?.buildTool || 'Vite',
        language: planData.techStack?.language || 'TypeScript'
      },
      phases,
      totalPhases: phases.length
    };
  }

  /**
   * Create a default plan when analysis fails
   */
  private createDefaultPlan(userPrompt: string): GenerationPlan {
    const appName = this.extractAppName(userPrompt) || 'GeneratedApp';
    const appType = this.detectAppType(userPrompt) || 'app';

    return {
      appName,
      appType,
      techStack: {
        framework: 'React',
        buildTool: 'Vite',
        language: 'TypeScript'
      },
      phases: [
        {
          phase: 'base',
          description: 'Project foundation and configuration',
          files: ['package.json', 'tsconfig.json', 'index.html', 'src/main.tsx'],
          dependencies: [],
          agentId: 'component-developer'
        },
        {
          phase: 'core',
          description: 'Main application component and styling',
          files: ['src/App.tsx', 'src/index.css'],
          dependencies: ['base'],
          agentId: 'component-developer'
        }
      ],
      totalPhases: 2
    };
  }

  /**
   * Extract app name from prompt
   */
  private extractAppName(prompt: string): string {
    // Try to find app name patterns
    const patterns = [
      /(?:create|build|make|generate)\s+(?:a|an|the)?\s+([A-Z][a-zA-Z\s]+?)(?:\s+app|game|component|tool)/i,
      /([A-Z][a-zA-Z\s]+?)(?:\s+app|game|component|tool)/i,
      /"([^"]+)"/,
      /'([^']+)'/
    ];

    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/\s+/g, ' ');
      }
    }

    return '';
  }

  /**
   * Detect app type from prompt
   */
  private detectAppType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('game')) return 'game';
    if (lowerPrompt.includes('todo') || lowerPrompt.includes('task')) return 'todo';
    if (lowerPrompt.includes('calculator')) return 'calculator';
    if (lowerPrompt.includes('dashboard')) return 'dashboard';
    if (lowerPrompt.includes('chat') || lowerPrompt.includes('messenger')) return 'chat';
    if (lowerPrompt.includes('blog')) return 'blog';
    if (lowerPrompt.includes('ecommerce') || lowerPrompt.includes('shop')) return 'ecommerce';

    return 'app';
  }

  /**
   * Get agent configuration from database
   * Uses component-architect agent if available, otherwise falls back to default
   */
  private async getAgentConfig(): Promise<{
    systemPrompt: string;
    model: string;
    temperature: number;
  }> {
    try {
      // Try to load component-architect agent from database
      const agentResults = await db
        .select()
        .from(agents)
        .where(eq(agents.id, 'component-architect'));

      if (agentResults.length > 0) {
        const agent = agentResults[0];
        this.logger.info('Using component-architect agent from database for analysis', {
          model: agent.model,
          temperature: agent.temperature
        });
        
        return {
          systemPrompt: agent.systemPrompt || this.getDefaultPrompt(),
          model: agent.model || 'claude-sonnet-4-5-20250929',
          temperature: agent.temperature || 0.3
        };
      }

      // Fallback to default if agent not found
      this.logger.warn('component-architect agent not found in database, using defaults');
      return {
        systemPrompt: this.getDefaultPrompt(),
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0.3
      };
    } catch (error) {
      this.logger.error('Failed to load component-architect agent from database', error as Error);
      return {
        systemPrompt: this.getDefaultPrompt(),
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0.3
      };
    }
  }

  /**
   * Get default prompt for analysis
   */
  private getDefaultPrompt(): string {
    return `You are an expert software architect. Your task is to analyze user requirements and create a detailed, incremental generation plan for building applications.

Key principles:
1. Break down the application into logical phases
2. Each phase should build on previous phases
3. Keep phases small and focused
4. Ensure dependencies are correct
5. Include all necessary files

Always respond with valid JSON in the specified format.`;
  }
}

