/**
 * Ultimate Prompt Service
 *
 * Integrates the ultimate prompt system with AI generation services
 * to deliver enhanced intelligence and code quality.
 */

import { PromptBuilder, AGENT_PROMPTS, PROMPT_PATTERNS } from '../prompts/UltimateAgentPrompts';
import { SimpleLogger } from '../utils/SimpleLogger';

export interface PromptEnhancementOptions {
  agentType?: keyof typeof AGENT_PROMPTS;
  userContext?: string;
  includePatterns?: (keyof typeof PROMPT_PATTERNS)[];
  customInstructions?: string[];
}

export interface EnhancedPromptResult {
  originalPrompt: string;
  enhancedPrompt: string;
  appliedPatterns: string[];
  agentType?: string;
  enhancementLevel: 'basic' | 'advanced' | 'ultimate';
}

export class UltimatePromptService {
  private static instance: UltimatePromptService;
  private logger = new SimpleLogger('UltimatePromptService');

  static getInstance(): UltimatePromptService {
    if (!UltimatePromptService.instance) {
      UltimatePromptService.instance = new UltimatePromptService();
    }
    return UltimatePromptService.instance;
  }

  /**
   * Enhances a prompt with ultimate AI engineering patterns
   */
  async enhancePrompt(
    originalPrompt: string,
    options: PromptEnhancementOptions = {}
  ): Promise<EnhancedPromptResult> {
    const {
      agentType,
      userContext,
      includePatterns,
      customInstructions = []
    } = options;

    let enhancedPrompt = originalPrompt;
    const appliedPatterns: string[] = [];

    // Apply agent-specific enhancement
    if (agentType) {
      enhancedPrompt = await PromptBuilder.buildAgentPrompt(agentType, userContext || originalPrompt);
      appliedPatterns.push(`Agent: ${agentType}`);
    }

    // Apply specific patterns if requested
    if (includePatterns) {
      for (const patternKey of includePatterns) {
        const pattern = PROMPT_PATTERNS[patternKey];
        if (pattern) {
          enhancedPrompt += `\n\n## ${patternKey}\n${pattern}`;
          appliedPatterns.push(patternKey);
        }
      }
    }

    // Apply custom instructions
    if (customInstructions.length > 0) {
      enhancedPrompt += `\n\n## Custom Instructions\n${customInstructions.join('\n')}`;
      appliedPatterns.push('Custom Instructions');
    }

    // Apply universal best practices if not agent-specific
    if (!agentType) {
      enhancedPrompt = PromptBuilder.injectBestPractices(enhancedPrompt);
      appliedPatterns.push('Universal Best Practices');
    }

    const result: EnhancedPromptResult = {
      originalPrompt,
      enhancedPrompt,
      appliedPatterns,
      agentType,
      enhancementLevel: this.determineEnhancementLevel(appliedPatterns.length)
    };

    this.logger.info('Prompt enhanced', {
      originalLength: originalPrompt.length,
      enhancedLength: enhancedPrompt.length,
      appliedPatterns: appliedPatterns.length,
      enhancementLevel: result.enhancementLevel
    });

    return result;
  }

  /**
   * Creates an orchestration prompt with ultimate intelligence
   */
  createOrchestrationPrompt(
    userRequest: string,
    projectContext?: string
  ): EnhancedPromptResult {
    const enhancedPrompt = PromptBuilder.buildOrchestrationPrompt(userRequest, projectContext);

    return {
      originalPrompt: userRequest,
      enhancedPrompt,
      appliedPatterns: ['Orchestration Intelligence', 'Multi-Agent Coordination'],
      enhancementLevel: 'ultimate'
    };
  }

  /**
   * Analyzes prompt quality and suggests improvements
   */
  analyzePromptQuality(prompt: string): {
    score: number;
    suggestions: string[];
    strengths: string[];
    weaknesses: string[];
  } {
    const suggestions: string[] = [];
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    let score = 50; // Base score

    // Check for clarity and specificity
    if (prompt.length < 20) {
      weaknesses.push('Prompt is too short and lacks detail');
      suggestions.push('Add more specific requirements and context');
      score -= 20;
    } else if (prompt.length > 500) {
      strengths.push('Detailed requirements provided');
      score += 10;
    }

    // Check for technical specificity
    const technicalTerms = ['component', 'api', 'database', 'authentication', 'responsive', 'typescript'];
    const foundTerms = technicalTerms.filter(term =>
      prompt.toLowerCase().includes(term)
    );

    if (foundTerms.length > 0) {
      strengths.push(`Technical specificity: ${foundTerms.join(', ')}`);
      score += foundTerms.length * 5;
    } else {
      weaknesses.push('Lacks technical specificity');
      suggestions.push('Include technical requirements (framework, features, etc.)');
      score -= 10;
    }

    // Check for user experience considerations
    const uxTerms = ['user', 'interface', 'experience', 'usability', 'accessible'];
    const foundUxTerms = uxTerms.filter(term =>
      prompt.toLowerCase().includes(term)
    );

    if (foundUxTerms.length > 0) {
      strengths.push('UX considerations mentioned');
      score += 10;
    }

    // Check for security awareness
    if (prompt.toLowerCase().includes('secur') || prompt.toLowerCase().includes('auth')) {
      strengths.push('Security awareness');
      score += 15;
    }

    // Check for performance considerations
    if (prompt.toLowerCase().includes('performance') || prompt.toLowerCase().includes('fast')) {
      strengths.push('Performance considerations');
      score += 10;
    }

    // Ensure score is within bounds
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      suggestions,
      strengths,
      weaknesses
    };
  }

  /**
   * Generates contextual suggestions for improving prompts
   */
  generateImprovementSuggestions(prompt: string, domain: string = 'web'): string[] {
    const suggestions: string[] = [];

    // Domain-specific suggestions
    switch (domain.toLowerCase()) {
      case 'web':
      case 'frontend':
        suggestions.push(
          'Consider responsive design requirements',
          'Specify browser compatibility needs',
          'Include accessibility requirements (WCAG)',
          'Mention performance optimization needs'
        );
        break;

      case 'backend':
      case 'api':
        suggestions.push(
          'Specify API authentication requirements',
          'Include database schema needs',
          'Mention scalability requirements',
          'Consider error handling patterns'
        );
        break;

      case 'mobile':
        suggestions.push(
          'Specify target platforms (iOS/Android)',
          'Consider offline functionality',
          'Include performance for mobile devices',
          'Mention touch interface requirements'
        );
        break;
    }

    // Universal suggestions
    suggestions.push(
      'Add specific functional requirements',
      'Include non-functional requirements (performance, security)',
      'Specify technology stack preferences',
      'Mention integration requirements',
      'Include testing and quality assurance needs'
    );

    return suggestions.slice(0, 5); // Return top 5 suggestions
  }

  private determineEnhancementLevel(patternCount: number): 'basic' | 'advanced' | 'ultimate' {
    if (patternCount >= 4) return 'ultimate';
    if (patternCount >= 2) return 'advanced';
    return 'basic';
  }

  /**
   * Validates that a prompt follows best practices
   */
  validatePrompt(prompt: string): {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for minimum length
    if (prompt.length < 10) {
      errors.push('Prompt is too short (minimum 10 characters)');
    }

    // Check for maximum length
    if (prompt.length > 2000) {
      warnings.push('Prompt is very long and may be inefficient');
    }

    // Check for security anti-patterns
    const securityAntiPatterns = ['password', 'secret', 'key', 'token'];
    for (const pattern of securityAntiPatterns) {
      if (prompt.toLowerCase().includes(pattern)) {
        warnings.push(`Contains potentially sensitive term: ${pattern}`);
      }
    }

    // Check for vague language
    const vagueTerms = ['nice', 'good', 'better', 'awesome', 'cool'];
    const foundVagueTerms = vagueTerms.filter(term =>
      prompt.toLowerCase().includes(term)
    );

    if (foundVagueTerms.length > 0) {
      warnings.push(`Contains vague language: ${foundVagueTerms.join(', ')}`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    };
  }
}

// Export singleton instance
export const ultimatePromptService = UltimatePromptService.getInstance();