/**
 * Test Suite for Ultimate Prompt System
 *
 * Validates that our AI prompt engineering system works correctly
 * and produces enhanced intelligence for our agents.
 */

import { describe, test, expect, vi } from 'vitest';
import { PromptBuilder, AGENT_PROMPTS, PROMPT_PATTERNS } from '../prompts/UltimateAgentPrompts';
import { ultimatePromptService } from '../services/UltimatePromptService';

// Mock logger to prevent console output during tests
vi.mock('../utils/SimpleLogger', () => ({
  SimpleLogger: vi.fn(() => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn()
  }))
}));

describe('Ultimate Prompt System', () => {
  describe('PromptBuilder', () => {
    test('builds agent-specific prompts correctly', async () => {
      const userContext = 'Create a todo list app';
      const prompt = await PromptBuilder.buildAgentPrompt('CODE_GENERATOR', userContext);

      expect(prompt).toContain('Code Generator Agent');
      expect(prompt).toContain('Generate clean, efficient, and maintainable code');
      expect(prompt).toContain(userContext);
      expect(prompt).toContain('TypeScript for type safety');
      expect(prompt).toContain('security best practices');
    });

    test('builds orchestration prompt with intelligence', () => {
      const userRequest = 'Build a React dashboard';
      const projectContext = 'Admin panel for e-commerce';
      const prompt = PromptBuilder.buildOrchestrationPrompt(userRequest, projectContext);

      expect(prompt).toContain('Orchestration Agent');
      expect(prompt).toContain('coordinate multiple specialized AI agents');
      expect(prompt).toContain(userRequest);
      expect(prompt).toContain(projectContext);
      expect(prompt).toContain('production-ready and immediately functional');
    });

    test('injects best practices into prompts', () => {
      const basePrompt = 'Create a simple component';
      const enhancedPrompt = PromptBuilder.injectBestPractices(basePrompt);

      expect(enhancedPrompt).toContain(basePrompt);
      expect(enhancedPrompt).toContain('Universal Best Practices');
      expect(enhancedPrompt).toContain('technical accuracy and truthfulness');
      expect(enhancedPrompt).toContain('production-ready');
      expect(enhancedPrompt).toContain('security best practices');
    });
  });

  describe('Agent Prompts Configuration', () => {
    test('all agent prompts have required structure', () => {
      const requiredFields = [
        'role',
        'identity',
        'capabilities',
        'behavioralRules',
        'codeQuality',
        'communicationRules',
        'taskManagement',
        'errorHandling',
        'security'
      ];

      Object.values(AGENT_PROMPTS).forEach(agentConfig => {
        requiredFields.forEach(field => {
          expect(agentConfig).toHaveProperty(field);
          expect(Array.isArray(agentConfig[field as keyof typeof agentConfig]) ||
                 typeof agentConfig[field as keyof typeof agentConfig] === 'string').toBe(true);
        });
      });
    });

    test('agent capabilities are comprehensive', () => {
      const codeGeneratorConfig = AGENT_PROMPTS.CODE_GENERATOR;

      expect(codeGeneratorConfig.capabilities).toContain(
        expect.stringMatching(/clean.*efficient.*maintainable/i)
      );
      expect(codeGeneratorConfig.capabilities).toContain(
        expect.stringMatching(/performance.*scalability/i)
      );
      expect(codeGeneratorConfig.capabilities).toContain(
        expect.stringMatching(/test/i)
      );
    });

    test('security requirements are present in all agents', () => {
      Object.values(AGENT_PROMPTS).forEach(agentConfig => {
        expect(agentConfig.security.length).toBeGreaterThan(0);
        expect(agentConfig.security.some(req =>
          req.toLowerCase().includes('security') ||
          req.toLowerCase().includes('validate') ||
          req.toLowerCase().includes('sensitive')
        )).toBe(true);
      });
    });
  });

  describe('Prompt Patterns', () => {
    test('all patterns contain actionable guidance', () => {
      Object.values(PROMPT_PATTERNS).forEach(pattern => {
        expect(typeof pattern).toBe('string');
        expect(pattern.length).toBeGreaterThan(50);
        expect(pattern).toMatch(/[.!?]$/); // Ends with punctuation
      });
    });

    test('professional objectivity pattern enforces accuracy', () => {
      const pattern = PROMPT_PATTERNS.PROFESSIONAL_OBJECTIVITY;
      expect(pattern).toContain('technical accuracy');
      expect(pattern).toContain('truthfulness');
      expect(pattern).toContain('objective');
    });

    test('code excellence pattern enforces quality', () => {
      const pattern = PROMPT_PATTERNS.CODE_EXCELLENCE;
      expect(pattern).toContain('production-ready');
      expect(pattern).toContain('best practices');
      expect(pattern).toContain('security');
    });
  });

  describe('UltimatePromptService', () => {
    test('enhances prompts with agent-specific intelligence', async () => {
      const originalPrompt = 'Create a login form';
      const result = await ultimatePromptService.enhancePrompt(originalPrompt, {
        agentType: 'UI_DESIGNER'
      });

      expect(result.originalPrompt).toBe(originalPrompt);
      expect(result.enhancedPrompt).toContain('UI Designer Agent');
      expect(result.enhancedPrompt).toContain('accessibility');
      expect(result.enhancedPrompt).toContain('responsive design');
      expect(result.appliedPatterns).toContain('Agent: UI_DESIGNER');
      expect(result.enhancementLevel).toBe('advanced');
    });

    test('creates orchestration prompts with ultimate intelligence', () => {
      const userRequest = 'Build an e-commerce platform';
      const result = ultimatePromptService.createOrchestrationPrompt(userRequest);

      expect(result.originalPrompt).toBe(userRequest);
      expect(result.enhancedPrompt).toContain('Orchestration Agent');
      expect(result.enhancedPrompt).toContain(userRequest);
      expect(result.enhancementLevel).toBe('ultimate');
    });

    test('analyzes prompt quality accurately', () => {
      const goodPrompt = 'Create a responsive React component with TypeScript that handles user authentication and includes proper error handling';
      const result = ultimatePromptService.analyzePromptQuality(goodPrompt);

      expect(result.score).toBeGreaterThan(70);
      expect(result.strengths.length).toBeGreaterThan(0);
      expect(result.strengths.some(s => s.includes('Technical specificity'))).toBe(true);
    });

    test('validates prompts against best practices', () => {
      const validPrompt = 'Create a secure user dashboard with authentication';
      const invalidPrompt = 'Make it';

      const validResult = ultimatePromptService.validatePrompt(validPrompt);
      const invalidResult = ultimatePromptService.validatePrompt(invalidPrompt);

      expect(validResult.isValid).toBe(true);
      expect(validResult.errors.length).toBe(0);

      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.errors.length).toBeGreaterThan(0);
    });

    test('generates domain-specific improvement suggestions', () => {
      const webSuggestions = ultimatePromptService.generateImprovementSuggestions(
        'Create a website',
        'web'
      );
      const backendSuggestions = ultimatePromptService.generateImprovementSuggestions(
        'Create an API',
        'backend'
      );

      expect(webSuggestions).toContain(
        expect.stringMatching(/responsive.*design/i)
      );
      expect(webSuggestions).toContain(
        expect.stringMatching(/accessibility/i)
      );

      expect(backendSuggestions).toContain(
        expect.stringMatching(/authentication/i)
      );
      expect(backendSuggestions).toContain(
        expect.stringMatching(/scalability/i)
      );
    });
  });

  describe('Integration Tests', () => {
    test('agent prompts work with real scenarios', async () => {
      const scenarios = [
        {
          agent: 'REQUIREMENTS_ANALYST' as const,
          task: 'Build a project management tool for teams'
        },
        {
          agent: 'UI_DESIGNER' as const,
          task: 'Design a modern dashboard interface'
        },
        {
          agent: 'CODE_GENERATOR' as const,
          task: 'Implement user authentication system'
        },
        {
          agent: 'COMPLETION_AGENT' as const,
          task: 'Finalize the application for production'
        }
      ];

      for (const { agent, task } of scenarios) {
        const prompt = await PromptBuilder.buildAgentPrompt(agent, task);

        expect(prompt).toContain(AGENT_PROMPTS[agent].role);
        expect(prompt).toContain(task);
        expect(prompt.length).toBeGreaterThan(1000);

        // Verify security considerations are included
        expect(prompt).toContain(
          expect.stringMatching(/security|secure|validation/i)
        );

        // Verify quality standards are included
        expect(prompt).toContain(
          expect.stringMatching(/production|quality|best practices/i)
        );
      }
    });

    test('orchestration prompt coordinates multiple agents effectively', () => {
      const complexTask = 'Build a full-stack social media application with real-time features';
      const prompt = PromptBuilder.buildOrchestrationPrompt(complexTask);

      expect(prompt).toContain('coordinate multiple specialized AI agents');
      expect(prompt).toContain('production-ready solution');
      expect(prompt).toContain(complexTask);
      expect(prompt).toContain('technical accuracy');
      expect(prompt).toContain('security best practices');
    });
  });

  describe('Performance and Efficiency', () => {
    test('prompt building is efficient for large inputs', async () => {
      const largePrompt = 'Create a comprehensive application '.repeat(100);
      const startTime = performance.now();

      const result = await PromptBuilder.buildAgentPrompt('CODE_GENERATOR', largePrompt);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(executionTime).toBeLessThan(100); // Should complete in under 100ms
      expect(result).toContain(largePrompt);
    });

    test('prompt service handles concurrent requests', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        ultimatePromptService.enhancePrompt(`Task ${i}`, {
          agentType: 'CODE_GENERATOR'
        })
      );

      const results = await Promise.all(requests);

      expect(results).toHaveLength(10);
      results.forEach((result, i) => {
        expect(result.originalPrompt).toBe(`Task ${i}`);
        expect(result.enhancedPrompt).toContain('Code Generator Agent');
      });
    });
  });
});

describe('Prompt Engineering Best Practices Validation', () => {
  test('prompts follow industry standards from leading AI tools', async () => {
    // Test that our prompts incorporate best practices from:
    // - Claude Code: Professional objectivity and technical accuracy
    // - Cursor: Comprehensive context understanding
    // - v0: Code excellence and best practices
    // - Devin AI: Systematic planning and approach
    // - Augment Code: Respect for existing patterns
    // - Replit: Focused execution

    const testPrompt = await PromptBuilder.buildAgentPrompt('CODE_GENERATOR', 'Test task');

    // Claude Code influence: Professional objectivity
    expect(testPrompt).toContain(
      expect.stringMatching(/technical accuracy|objective|facts/i)
    );

    // Cursor influence: Comprehensive understanding
    expect(testPrompt).toContain(
      expect.stringMatching(/thorough|comprehensive|trace.*definitions/i)
    );

    // v0 influence: Code excellence
    expect(testPrompt).toContain(
      expect.stringMatching(/production.*ready|best practices|immediately/i)
    );

    // Devin AI influence: Systematic approach
    expect(testPrompt).toContain(
      expect.stringMatching(/systematic|gather.*information|methodical/i)
    );

    // Augment Code influence: Respect patterns
    expect(testPrompt).toContain(
      expect.stringMatching(/existing.*patterns|conventions|codebase/i)
    );

    // Replit influence: Focused execution
    expect(testPrompt).toContain(
      expect.stringMatching(/focus.*request|conservative|specific/i)
    );
  });

  test('prompts include competitive intelligence features', async () => {
    const agentTypes = ['CODE_GENERATOR', 'UI_DESIGNER', 'REQUIREMENTS_ANALYST', 'COMPLETION_AGENT'] as const;

    for (const agentType of agentTypes) {
      const prompt = await PromptBuilder.buildAgentPrompt(agentType, 'Test competitive features');

      // All agents should have competitive intelligence
      expect(prompt).toContain(
        expect.stringMatching(/excellence|world.*class|pinnacle/i)
      );

      // Security is competitive advantage
      expect(prompt).toContain(
        expect.stringMatching(/security.*best.*practices|never.*expose.*sensitive/i)
      );

      // Performance optimization
      expect(prompt).toContain(
        expect.stringMatching(/performance|optimize|scalability/i)
      );

      // Quality assurance
      expect(prompt).toContain(
        expect.stringMatching(/comprehensive.*test|validation|quality/i)
      );
    }
  });
});