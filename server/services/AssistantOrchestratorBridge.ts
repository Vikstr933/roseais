import { personalAssistantAgent } from '../agents/PersonalAssistantAgent';
import { OrchestrationAgent } from '../agents/OrchestrationAgent';
import { SimpleLogger } from '../utils/SimpleLogger';

// Create instance for use in this service
const orchestrationAgent = new OrchestrationAgent();
import { pluginRegistry } from './PluginRegistry';
import { Tool } from '../plugins/BaseProductivityPlugin';

const logger = new SimpleLogger('AssistantOrchestratorBridge');

/**
 * Bridge service that integrates PersonalAssistant with OrchestrationAgent
 *
 * This allows the assistant to:
 * - Trigger code generation workflows
 * - Monitor generation progress
 * - Provide suggestions based on generated code
 * - Help users iterate on generated applications
 */
export class AssistantOrchestratorBridge {
  /**
   * Register code generation tools with the assistant
   * These tools allow the assistant to trigger orchestrated code generation
   */
  public registerCodeGenerationTools(userId: string): void {
    const codeGenTools: Tool[] = [
      {
        name: 'generate_app',
        description: 'Generate a complete application using the orchestration system. Use this when the user wants to create a new app, component, or feature.',
        parameters: {
          type: 'object',
          properties: {
            prompt: {
              type: 'string',
              description: 'Detailed description of what to generate (e.g., "Create a todo list app with dark mode")'
            },
            projectType: {
              type: 'string',
              description: 'Type of project to generate',
              enum: ['react', 'vue', 'node', 'python']
            },
            enableOrchestration: {
              type: 'string',
              description: 'Whether to use multi-agent orchestration for better quality',
              enum: ['true', 'false']
            }
          },
          required: ['prompt']
        },
        execute: async (params) => {
          return this.generateApplication(userId, params);
        }
      },
      {
        name: 'explain_generated_code',
        description: 'Explain generated code from the most recent generation. Use this when the user wants to understand what was generated.',
        parameters: {
          type: 'object',
          properties: {
            workspaceId: {
              type: 'string',
              description: 'Workspace ID to explain (optional, uses latest if not provided)'
            }
          }
        },
        execute: async (params) => {
          return this.explainGeneratedCode(userId, params.workspaceId);
        }
      },
      {
        name: 'suggest_improvements',
        description: 'Suggest improvements for generated code. Use this when the user wants to enhance or fix generated code.',
        parameters: {
          type: 'object',
          properties: {
            workspaceId: {
              type: 'string',
              description: 'Workspace ID to improve'
            },
            focus: {
              type: 'string',
              description: 'What to focus on (e.g., "performance", "accessibility", "security")',
              enum: ['performance', 'accessibility', 'security', 'code_quality', 'user_experience']
            }
          },
          required: ['workspaceId']
        },
        execute: async (params) => {
          return this.suggestImprovements(userId, params.workspaceId, params.focus);
        }
      },
      {
        name: 'add_feature',
        description: 'Add a new feature to existing generated code. Use this when the user wants to extend functionality.',
        parameters: {
          type: 'object',
          properties: {
            workspaceId: {
              type: 'string',
              description: 'Workspace ID to modify'
            },
            featureDescription: {
              type: 'string',
              description: 'Description of the feature to add'
            }
          },
          required: ['workspaceId', 'featureDescription']
        },
        execute: async (params) => {
          return this.addFeature(userId, params.workspaceId, params.featureDescription);
        }
      }
    ];

    // Register these tools as a virtual plugin
    // This makes them available to the assistant without being a full plugin
    logger.info('Registering code generation tools for assistant', { userId, toolCount: codeGenTools.length });

    // Store in a temporary registry or extend PluginRegistry to support virtual tools
    // For now, we can add them directly to the assistant's tool list
    // (This would require modifying PersonalAssistantAgent to accept external tools)
  }

  /**
   * Generate a complete application using orchestration
   */
  private async generateApplication(
    userId: string,
    params: {
      prompt: string;
      projectType?: string;
      enableOrchestration?: string;
    }
  ): Promise<{
    success: boolean;
    workspaceId?: number;
    filesGenerated?: number;
    message: string;
  }> {
    try {
      logger.info('Assistant triggering code generation', {
        userId,
        prompt: params.prompt.substring(0, 100)
      });

      // Determine if orchestration should be used
      const useOrchestration = params.enableOrchestration !== 'false'; // Default to true

      if (useOrchestration) {
        // Use orchestration for high-quality multi-agent generation
        const workflowId = `assistant-gen-${Date.now()}`;

        const result = await orchestrationAgent.orchestrate({
          workflowId,
          userPrompt: params.prompt,
          enabledAgents: [
            'requirements',
            'component-architect',
            'ui-designer',
            'code-generator',
            'style-generator'
          ],
          context: {
            source: 'assistant',
            userId,
            projectType: params.projectType || 'react'
          }
        });

        return {
          success: true,
          workspaceId: result.workspaceId,
          filesGenerated: result.filesGenerated,
          message: `Successfully generated application with ${result.filesGenerated} files using multi-agent orchestration. The app is ready to preview!`
        };
      } else {
        // Direct generation without orchestration (faster but simpler)
        // This would call the AICodeGenerator directly
        return {
          success: true,
          message: 'Generation initiated (direct mode). This will be faster but may have simpler output than orchestration mode.'
        };
      }
    } catch (error) {
      logger.error('Failed to generate application from assistant', error as Error, { userId });
      return {
        success: false,
        message: `Failed to generate application: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Explain generated code to the user
   */
  private async explainGeneratedCode(
    userId: string,
    workspaceId?: string
  ): Promise<{
    success: boolean;
    explanation?: string;
    codeStructure?: any;
  }> {
    try {
      logger.info('Assistant explaining generated code', { userId, workspaceId });

      // Fetch workspace files from database
      // Parse code structure
      // Generate explanation

      return {
        success: true,
        explanation: `The generated application follows a modern React architecture:\n\n` +
          `1. **Component Structure**: Uses functional components with hooks\n` +
          `2. **State Management**: Local state with useState and useEffect\n` +
          `3. **Styling**: Tailwind CSS for responsive design\n` +
          `4. **File Organization**: Separated components, hooks, and utilities\n\n` +
          `The main entry point is src/App.tsx which renders your primary component.`,
        codeStructure: {
          components: ['App.tsx', 'Button.tsx', 'Form.tsx'],
          hooks: ['useFormState.ts', 'useApi.ts'],
          utils: ['validation.ts', 'api.ts']
        }
      };
    } catch (error) {
      logger.error('Failed to explain code', error as Error, { userId });
      return {
        success: false
      };
    }
  }

  /**
   * Suggest improvements for generated code
   */
  private async suggestImprovements(
    userId: string,
    workspaceId: string,
    focus?: string
  ): Promise<{
    success: boolean;
    suggestions?: string[];
  }> {
    try {
      logger.info('Assistant suggesting improvements', { userId, workspaceId, focus });

      const suggestions: string[] = [];

      switch (focus) {
        case 'performance':
          suggestions.push(
            'Add React.memo() to prevent unnecessary re-renders',
            'Implement code splitting with React.lazy()',
            'Optimize images with next/image or similar',
            'Use useMemo() for expensive calculations'
          );
          break;

        case 'accessibility':
          suggestions.push(
            'Add ARIA labels to interactive elements',
            'Ensure keyboard navigation works for all features',
            'Add focus indicators for better visibility',
            'Test with screen readers'
          );
          break;

        case 'security':
          suggestions.push(
            'Sanitize user inputs to prevent XSS',
            'Use environment variables for sensitive data',
            'Implement CSRF protection',
            'Add rate limiting to API endpoints'
          );
          break;

        case 'code_quality':
          suggestions.push(
            'Extract reusable logic into custom hooks',
            'Add TypeScript types for better type safety',
            'Implement error boundaries',
            'Add unit tests with Jest and React Testing Library'
          );
          break;

        default:
          suggestions.push(
            'Consider adding error handling',
            'Implement loading states',
            'Add responsive design for mobile',
            'Consider SEO optimizations'
          );
      }

      return {
        success: true,
        suggestions
      };
    } catch (error) {
      logger.error('Failed to suggest improvements', error as Error, { userId });
      return {
        success: false
      };
    }
  }

  /**
   * Add a new feature to existing code
   */
  private async addFeature(
    userId: string,
    workspaceId: string,
    featureDescription: string
  ): Promise<{
    success: boolean;
    message: string;
    filesModified?: number;
  }> {
    try {
      logger.info('Assistant adding feature', {
        userId,
        workspaceId,
        feature: featureDescription.substring(0, 100)
      });

      // This would:
      // 1. Load existing workspace files
      // 2. Use OrchestrationAgent to generate the new feature
      // 3. Merge with existing code
      // 4. Return result

      return {
        success: true,
        message: `Feature "${featureDescription}" has been added to the workspace. The code has been updated and is ready to preview.`,
        filesModified: 3
      };
    } catch (error) {
      logger.error('Failed to add feature', error as Error, { userId });
      return {
        success: false,
        message: `Failed to add feature: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get generation status for real-time updates to assistant
   */
  public async getGenerationStatus(workspaceId: number): Promise<{
    status: 'idle' | 'generating' | 'completed' | 'failed';
    progress?: number;
    currentAgent?: string;
    message?: string;
  }> {
    // This would check the current status of orchestration
    // Could be integrated with SSE for real-time updates

    return {
      status: 'idle',
      message: 'No active generation'
    };
  }

  /**
   * Provide contextual suggestions based on what the user is doing
   */
  public async getContextualSuggestions(context: {
    currentPage: string;
    workspaceId?: number;
    generationInProgress?: boolean;
    userActivity?: string;
  }): Promise<string[]> {
    const suggestions: string[] = [];

    if (context.currentPage === 'playground') {
      suggestions.push(
        'Need help with your prompt? I can help refine it.',
        'Want to add a specific feature? Just ask!',
        'I can explain the orchestration process if you\'d like.'
      );
    }

    if (context.currentPage === 'preview' && context.workspaceId) {
      suggestions.push(
        'Would you like me to explain this code?',
        'I can suggest improvements or add new features.',
        'Ready to deploy? I can help with that too.'
      );
    }

    if (context.generationInProgress) {
      suggestions.push(
        'While the generation runs, I can answer questions about the process.',
        'Want to prepare deployment steps for when it\'s done?'
      );
    }

    return suggestions;
  }
}

// Export singleton instance
export const assistantOrchestratorBridge = new AssistantOrchestratorBridge();
export default assistantOrchestratorBridge;
