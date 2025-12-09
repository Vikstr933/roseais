/**
 * Integration Example: How to use Adaptive Prompts in your agents
 *
 * This file shows how to integrate the new adaptive prompts into your existing agent system.
 */

import { PromptBuilder, ADAPTIVE_PATTERNS } from './AdaptiveAgentPrompts';

// Example 1: Using adaptive prompts in OrchestrationAgent
export class EnhancedOrchestrationAgent {
  async handleRequest(request: string) {
    // Get the adaptive orchestration prompt
    const systemPrompt = PromptBuilder.buildAgentPrompt('ORCHESTRATION');

    // Assess task complexity first (adaptive behavior)
    const complexity = this.assessComplexity(request);

    if (complexity === 'simple') {
      // Handle directly without orchestration overhead
      return await this.handleSimpleTask(request);
    } else {
      // Use full orchestration for complex tasks
      return await this.orchestrateComplexTask(request, systemPrompt);
    }
  }

  private assessComplexity(request: string): 'simple' | 'complex' {
    // Adaptive decision-making
    const simpleIndicators = [
      /^(explain|show|where|how|what|tell me)/i,
      /single (file|component|function)/i,
      /quick fix/i,
    ];

    const complexIndicators = [
      /multi[- ]?(file|component|step)/i,
      /integrate with/i,
      /refactor|redesign|rebuild/i,
      /feature|system|module/i,
    ];

    const isSimple = simpleIndicators.some(pattern => pattern.test(request));
    const isComplex = complexIndicators.some(pattern => pattern.test(request));

    return isComplex || !isSimple ? 'complex' : 'simple';
  }

  private async handleSimpleTask(request: string) {
    // For simple tasks, skip orchestration overhead
    console.log('Handling simple task directly');
    // ... implementation
  }

  private async orchestrateComplexTask(request: string, systemPrompt: string) {
    // For complex tasks, use full orchestration
    console.log('Orchestrating complex task with multiple agents');
    // ... implementation
  }
}

// Example 2: Using adaptive prompts in CodeGeneratorAgent
export class EnhancedCodeGeneratorAgent {
  async generateCode(request: { prompt: string; features: string[] }) {
    // Build adaptive prompt
    const systemPrompt = PromptBuilder.buildAgentPrompt(
      'CODE_GENERATOR',
      `Current request: ${request.prompt}`
    );

    // Information gathering BEFORE generation
    const context = await this.gatherContext(request);

    // Check if generation is actually needed
    if (context.existingSolution) {
      return {
        type: 'explanation',
        message: `Existing solution found at ${context.location}. ${context.description}`,
        suggestion: 'Would you like me to modify or extend the existing code?',
      };
    }

    // Generate only if needed
    return await this.generateNewCode(request, systemPrompt, context);
  }

  private async gatherContext(request: any) {
    // Implement information gathering
    // Check existing code, patterns, dependencies
    return {
      existingSolution: false, // or true if found
      location: '',
      description: '',
      existingPatterns: [],
      availableDependencies: [],
    };
  }

  private async generateNewCode(request: any, systemPrompt: string, context: any) {
    // Generate code with full context
    // ... implementation
  }
}

// Example 3: Adding efficiency checks
export class EfficiencyGuard {
  static shouldMakeEdit(intent: string, existingCode: string): boolean {
    // Check if edit is necessary using adaptive patterns
    const informationalKeywords = [
      'how does',
      'what is',
      'where is',
      'explain',
      'show me',
      'tell me',
    ];

    const needsEdit = !informationalKeywords.some(keyword =>
      intent.toLowerCase().includes(keyword)
    );

    return needsEdit;
  }

  static validateOutput(
    request: string,
    generatedFiles: Array<{ path: string; content: string }>
  ): { valid: boolean; suggestions: string[] } {
    const suggestions: string[] = [];

    // Check for over-engineering
    if (generatedFiles.length > 10 && !request.includes('large') && !request.includes('complex')) {
      suggestions.push(
        'Consider: Generated many files for a potentially simple requirement. Review if all are necessary.'
      );
    }

    // Check for unnecessary utilities
    const utilFiles = generatedFiles.filter(f => f.path.includes('/utils/'));
    if (utilFiles.length > 3) {
      suggestions.push(
        'Consider: Multiple utility files generated. Could logic be inline or consolidated?'
      );
    }

    // Check for feature creep
    const requestWords = new Set(request.toLowerCase().split(/\s+/));
    const hasExtraFeatures = generatedFiles.some(file => {
      const fileName = file.path.toLowerCase();
      return (
        (fileName.includes('advanced') || fileName.includes('premium')) &&
        !requestWords.has('advanced') &&
        !requestWords.has('premium')
      );
    });

    if (hasExtraFeatures) {
      suggestions.push(
        'Warning: Generated code may include features not explicitly requested. Verify alignment with requirements.'
      );
    }

    return {
      valid: suggestions.length === 0,
      suggestions,
    };
  }
}

// Example 4: Using adaptive patterns in UI Designer
export class EnhancedUIDesignerAgent {
  async designComponent(request: string) {
    // Get UI designer prompt with adaptive patterns
    const systemPrompt = PromptBuilder.buildAgentPrompt('UI_DESIGNER');

    // Check existing UI patterns first
    const existingPatterns = await this.findSimilarComponents(request);

    if (existingPatterns.length > 0) {
      return {
        type: 'suggestion',
        message: `Found similar existing components: ${existingPatterns.join(', ')}`,
        options: [
          'Use existing component',
          'Extend existing component',
          'Create new component',
        ],
      };
    }

    // Only create new if needed
    return await this.createNewComponent(request, systemPrompt);
  }

  private async findSimilarComponents(request: string): Promise<string[]> {
    // Search codebase for similar components
    // Return paths to existing implementations
    return [];
  }

  private async createNewComponent(request: string, systemPrompt: string) {
    // Create new component with adaptive prompt
    // ... implementation
  }
}

// Example 5: Complete integration in your routes
export function enhanceComponentRoute(router: any) {
  router.post('/api/components/generate', async (req: any, res: any) => {
    const { prompt, features } = req.body;

    // Use efficiency guard
    if (!EfficiencyGuard.shouldMakeEdit(prompt, '')) {
      // This is an information request, not a generation request
      return res.json({
        type: 'information',
        message: 'This appears to be an information request. Let me explain the existing code instead.',
        suggestion: 'If you want me to generate new code, please use words like "create", "add", or "implement".',
      });
    }

    // Use enhanced agent with adaptive prompts
    const agent = new EnhancedCodeGeneratorAgent();
    const result = await agent.generateCode({ prompt, features });

    // Validate output for efficiency
    if (result.type === 'generation') {
      const validation = EfficiencyGuard.validateOutput(prompt, result.files);

      if (!validation.valid) {
        console.warn('Efficiency suggestions:', validation.suggestions);
        // Could return suggestions to user or auto-refine
      }
    }

    return res.json(result);
  });
}

// Example 6: Task complexity assessment
export class TaskComplexityAssessor {
  static assess(request: string): {
    complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
    reasoning: string[];
    recommendedApproach: string;
  } {
    const factors = {
      multiFile: /multi[- ]?file|multiple files|several files/i.test(request),
      newFeature: /new feature|add feature|implement feature/i.test(request),
      integration: /integrate|connect|link|sync/i.test(request),
      refactor: /refactor|redesign|restructure/i.test(request),
      testing: /test|testing|verify|validation/i.test(request),
      documentation: /document|docs|readme/i.test(request),
      informational: /how|what|where|explain|show/i.test(request),
    };

    const reasoning: string[] = [];

    if (factors.informational) {
      reasoning.push('Request is informational - no code generation needed');
      return {
        complexity: 'trivial',
        reasoning,
        recommendedApproach: 'Explain existing code or provide information',
      };
    }

    let complexityScore = 0;

    if (factors.multiFile) {
      complexityScore += 2;
      reasoning.push('Requires multiple file changes');
    }
    if (factors.newFeature) {
      complexityScore += 2;
      reasoning.push('Involves implementing new feature');
    }
    if (factors.integration) {
      complexityScore += 3;
      reasoning.push('Requires integration with existing systems');
    }
    if (factors.refactor) {
      complexityScore += 3;
      reasoning.push('Involves refactoring existing code');
    }

    let complexity: 'trivial' | 'simple' | 'moderate' | 'complex';
    let approach: string;

    if (complexityScore === 0) {
      complexity = 'simple';
      approach = 'Direct implementation, no orchestration needed';
    } else if (complexityScore <= 2) {
      complexity = 'simple';
      approach = 'Single agent with minimal planning';
    } else if (complexityScore <= 4) {
      complexity = 'moderate';
      approach = 'Single agent with structured planning';
    } else {
      complexity = 'complex';
      approach = 'Multi-agent orchestration with comprehensive planning';
    }

    return { complexity, reasoning, recommendedApproach: approach };
  }
}

// Example usage in main application
export async function handleUserRequest(request: string) {
  // 1. Assess complexity
  const assessment = TaskComplexityAssessor.assess(request);
  console.log(`Task complexity: ${assessment.complexity}`);
  console.log(`Reasoning: ${assessment.reasoning.join(', ')}`);
  console.log(`Approach: ${assessment.recommendedApproach}`);

  // 2. Choose appropriate handler
  if (assessment.complexity === 'trivial' || assessment.complexity === 'simple') {
    // Use direct agent, no orchestration
    const agent = new EnhancedCodeGeneratorAgent();
    return await agent.generateCode({ prompt: request, features: [] });
  } else {
    // Use orchestration for complex tasks
    const orchestrator = new EnhancedOrchestrationAgent();
    return await orchestrator.handleRequest(request);
  }
}
