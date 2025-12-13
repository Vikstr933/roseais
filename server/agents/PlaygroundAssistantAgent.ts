import Anthropic from '@anthropic-ai/sdk';
import { SimpleLogger } from '../utils/SimpleLogger';
import { Tool } from '../plugins/BaseProductivityPlugin';
import { agentEventEmitter } from '../index';

const logger = new SimpleLogger('PlaygroundAssistantAgent');

/**
 * Playground Assistant Agent (Chap-ZPT)
 * 
 * Dedicated agent for the AI Code Playground, focused on:
 * - Code generation and modification
 * - Automatic prompt improvement
 * - Project file management
 * - Code analysis and deployment
 * 
 * This agent is specialized for playground interactions and provides
 * a stable, focused experience for code generation tasks.
 */
export class PlaygroundAssistantAgent {
  private anthropic: Anthropic;
  private conversationHistory: Map<string, Anthropic.MessageParam[]> = new Map();
  private selectedProjects: Map<string, { projectId: string; projectName: string; projectDescription?: string }> = new Map();
  
  // Tools
  private generateCodeTool: Tool;
  private listProjectsTool: Tool;
  private selectProjectTool: Tool;
  private deployToVercelTool: Tool;
  private readFileTool: Tool;
  private writeFileTool: Tool;
  private editFileTool: Tool;
  private deleteFileTool: Tool;
  private createDirectoryTool: Tool;
  private analyzeCodeTool: Tool;
  private checkTypesTool: Tool;
  private findErrorsTool: Tool;
  private suggestImprovementsTool: Tool;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });

    // Initialize project management tools
    this.listProjectsTool = {
      name: 'list_projects',
      description: 'List all projects that the user has access to. Use this when the user asks about their projects or wants to see available projects.',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.listProjects(params);
      }
    };

    this.selectProjectTool = {
      name: 'select_project',
      description: 'Select a project to work on. Use this when the user explicitly chooses a project by name or number. This sets the active project for the conversation.',
      parameters: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'The name of the project to select'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If provided, will use this directly.'
          }
        },
        required: ['projectName']
      },
      execute: async (params: Record<string, any>) => {
        return await this.selectProject(params);
      }
    };

    // Initialize code generation tool
    this.generateCodeTool = {
      name: 'generate_code',
      description: 'Generate code for a React application in the playground. Use this when the user asks you to create an app, build a feature, generate code, or make changes to their project. This will trigger the code generation system to create or modify files. ALWAYS improve the prompt automatically before generating code to ensure high-quality results.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed description of what code to generate. This prompt will be automatically improved before generation.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, uses the currently selected project.'
          }
        },
        required: ['prompt']
      },
      execute: this.generateCode.bind(this)
    };

    // Initialize file operation tools
    this.readFileTool = {
      name: 'read_file',
      description: 'Read and analyze files from a project. Use this to understand existing code before making changes.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The full path to the file' },
          projectId: { type: 'string', description: 'Optional project ID' },
          analyze: { type: 'boolean', description: 'If true, provides analysis of the file' }
        },
        required: ['filePath']
      },
      execute: this.readFile.bind(this)
    };

    this.writeFileTool = {
      name: 'write_file',
      description: 'Create a new file or completely replace an existing file. Use this when the user asks you to create a new file or completely rewrite a file.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The full path to the file' },
          content: { type: 'string', description: 'The complete content of the file' },
          projectId: { type: 'string', description: 'Optional project ID' }
        },
        required: ['filePath', 'content']
      },
      execute: this.writeFile.bind(this)
    };

    this.editFileTool = {
      name: 'edit_file',
      description: 'Edit specific parts of an existing file. Use this for targeted modifications like changing a function, updating a variable, or adjusting styles.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The full path to the file' },
          changes: { type: 'string', description: 'The exact string or code snippet to find and replace' },
          newContent: { type: 'string', description: 'The new content to replace the found string with' },
          projectId: { type: 'string', description: 'Optional project ID' }
        },
        required: ['filePath', 'changes', 'newContent']
      },
      execute: this.editFile.bind(this)
    };

    this.deleteFileTool = {
      name: 'delete_file',
      description: 'Delete a file from a project. Use this when the user explicitly asks to remove a file.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'The full path to the file to delete' },
          projectId: { type: 'string', description: 'Optional project ID' }
        },
        required: ['filePath']
      },
      execute: this.deleteFile.bind(this)
    };

    this.createDirectoryTool = {
      name: 'create_directory',
      description: 'Create a new directory (folder) in a project. Use this when the user asks to create a new folder or organize files into a new directory structure.',
      parameters: {
        type: 'object',
        properties: {
          directoryPath: { type: 'string', description: 'The full path for the new directory' },
          projectId: { type: 'string', description: 'Optional project ID' },
          addPlaceholder: { type: 'boolean', description: 'If true, a .gitkeep placeholder file will be added. Default: true.' }
        },
        required: ['directoryPath']
      },
      execute: this.createDirectory.bind(this)
    };

    // Initialize code analysis tools
    this.analyzeCodeTool = {
      name: 'analyze_code',
      description: 'Perform comprehensive code analysis for errors, warnings, security issues, performance problems, and best practices.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Optional specific file path to analyze' },
          projectId: { type: 'string', description: 'Optional project ID' }
        },
        required: []
      },
      execute: this.analyzeCode.bind(this)
    };

    this.checkTypesTool = {
      name: 'check_types',
      description: 'Perform TypeScript type checking on the project.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Optional specific file path to type check' },
          projectId: { type: 'string', description: 'Optional project ID' }
        },
        required: []
      },
      execute: this.checkTypes.bind(this)
    };

    this.findErrorsTool = {
      name: 'find_errors',
      description: 'Find specific errors in the project code. This focuses specifically on finding errors (not warnings).',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Optional specific file path to check' },
          projectId: { type: 'string', description: 'Optional project ID' }
        },
        required: []
      },
      execute: this.findErrors.bind(this)
    };

    this.suggestImprovementsTool = {
      name: 'suggest_improvements',
      description: 'Suggest code improvements and refactoring opportunities. This provides actionable suggestions for making code better.',
      parameters: {
        type: 'object',
        properties: {
          filePath: { type: 'string', description: 'Optional specific file path to analyze' },
          projectId: { type: 'string', description: 'Optional project ID' }
        },
        required: []
      },
      execute: this.suggestImprovements.bind(this)
    };

    // Initialize deployment tool
    this.deployToVercelTool = {
      name: 'deploy_to_vercel',
      description: 'Deploy the current project to Vercel. This will create a GitHub repository and deploy the project. Use this when the user asks to deploy, publish, or share their app.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, uses the currently selected project.'
          },
          repositoryName: {
            type: 'string',
            description: 'Optional custom repository name. If not provided, will generate one based on project name.'
          }
        },
        required: []
      },
      execute: this.deployToVercel.bind(this)
    };
  }

  /**
   * Process a request from the user
   * Automatically improves prompts before code generation
   */
  public async processRequest(
    userId: string,
    userMessage: string,
    options?: {
      sessionId?: string;
      projectId?: string;
      existingFiles?: Array<{ path: string; content: string }>;
      chatMode?: boolean; // If true, AI should only chat, not generate code
    }
  ): Promise<{
    response: string;
    toolsUsed: string[];
    improvedPrompt?: string;
  }> {
    const sessionId = options?.sessionId || userId;

    try {
      logger.info(`Processing playground request: userId=${userId}, sessionId=${sessionId}, messageLength=${userMessage.length}`);

      // Get conversation history
      const history = this.conversationHistory.get(sessionId) || [];

      // Determine project context
      const projectId = options?.projectId || (this.selectedProjects.get(sessionId)?.projectId);
      const hasProjectContext = !!projectId;

      // Build available tools
      const tools: Tool[] = [
        this.listProjectsTool,
        this.selectProjectTool
      ];

      if (hasProjectContext) {
        tools.push(
          this.generateCodeTool,
          this.readFileTool,
          this.writeFileTool,
          this.editFileTool,
          this.deleteFileTool,
          this.createDirectoryTool,
          this.analyzeCodeTool,
          this.checkTypesTool,
          this.findErrorsTool,
          this.suggestImprovementsTool,
          this.deployToVercelTool
        );
      }

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(hasProjectContext, projectId, options?.existingFiles, isChatMode);

      // Build user message
      const enhancedMessage = this.buildEnhancedMessage(userMessage, options?.existingFiles);

      // Call Claude with tools
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        system: systemPrompt,
        messages: [
          ...history,
          {
            role: 'user',
            content: enhancedMessage
          }
        ],
        tools: this.convertToolsToAnthropicFormat(tools)
      });

      // Process tool calls
      const toolsUsed: string[] = [];
      let finalResponse = '';
      let improvedPrompt: string | undefined;
      let currentResponse = response;

      while (currentResponse.stop_reason === 'tool_use') {
        const toolCalls = currentResponse.content.filter((item: any) => item.type === 'tool_use') as any[];
        const toolResults: any[] = [];

        for (const toolCall of toolCalls) {
          const tool = tools.find(t => t.name === toolCall.name);
          if (!tool) {
            logger.warn(`Tool ${toolCall.name} not found`);
            continue;
          }

          try {
            // Special handling for generate_code - improve prompt first
            if (toolCall.name === 'generate_code') {
              const originalPrompt = (toolCall.input as any).prompt;
              const improved = await this.improvePrompt(originalPrompt, options?.existingFiles || []);
              improvedPrompt = improved;
              
              // Update tool input with improved prompt
              (toolCall.input as any).prompt = improved;
              
              logger.info(`Prompt improved: "${originalPrompt.substring(0, 50)}..." → "${improved.substring(0, 50)}..."`);
            }

            const result = await tool.execute({
              ...toolCall.input as Record<string, any>,
              _userId: userId,
              _sessionId: sessionId,
              _projectId: projectId
            });
            
            toolsUsed.push(toolCall.name);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            });
          } catch (error) {
            logger.error(`Tool execution failed: ${toolCall.name}`, error as Error);
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: JSON.stringify({
                success: false,
                error: error instanceof Error ? error.message : String(error)
              }, null, 2)
            });
          }
        }

        // Continue conversation with tool results
        const newMessages: Anthropic.MessageParam[] = [
          ...history,
          {
            role: 'user',
            content: enhancedMessage
          },
          {
            role: 'assistant',
            content: currentResponse.content
          },
          {
            role: 'user',
            content: toolResults
          }
        ];

        currentResponse = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8192,
          system: systemPrompt,
          messages: newMessages,
          tools: this.convertToolsToAnthropicFormat(tools)
        });
      }

      // Extract final response
      const textContent = currentResponse.content.find((item: any) => item.type === 'text');
      finalResponse = textContent?.text || 'I apologize, but I encountered an issue processing your request.';

      // Update conversation history
      this.conversationHistory.set(sessionId, [
        ...history,
        {
          role: 'user',
          content: enhancedMessage
        },
        {
          role: 'assistant',
          content: currentResponse.content
        }
      ]);

      return {
        response: finalResponse,
        toolsUsed,
        improvedPrompt
      };
    } catch (error) {
      logger.error('Error processing playground request', error as Error);
      return {
        response: 'I apologize, but I encountered an error processing your request. Please try again.',
        toolsUsed: []
      };
    }
  }

  /**
   * Improve a prompt automatically before code generation
   * This is a key feature of Chap-ZPT - automatic prompt enhancement
   */
  private async improvePrompt(
    originalPrompt: string,
    existingFiles: Array<{ path: string; content: string }>
  ): Promise<string> {
    try {
      const improvementPrompt = `You are an expert at improving code generation prompts. Your task is to take a user's request and transform it into a detailed, comprehensive prompt that will result in high-quality, production-ready code.

**Original User Request:**
${originalPrompt}

**Existing Project Files (if any):**
${existingFiles.length > 0 
  ? existingFiles.slice(0, 5).map(f => `- ${f.path} (${f.content.length} chars)`).join('\n')
  : 'No existing files (new project)'
}

**Your Task:**
Transform the user's request into a detailed, comprehensive prompt that includes:
1. Clear feature requirements
2. Technical specifications (React, TypeScript, modern patterns)
3. UI/UX considerations (responsive, accessible, modern design)
4. Code quality requirements (clean, maintainable, well-structured)
5. Any missing but important details (error handling, edge cases, etc.)

**Guidelines:**
- Keep the user's original intent and requirements
- Add technical details that ensure production-ready code
- Specify React patterns (hooks, functional components, TypeScript)
- Include modern UI/UX best practices
- Add error handling and edge case considerations
- Make it comprehensive but not overly verbose

**Output:**
Provide ONLY the improved prompt, nothing else. No explanations, no markdown, just the improved prompt text.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2000,
        system: 'You are an expert at improving code generation prompts. Transform user requests into detailed, comprehensive prompts that result in production-ready code.',
        messages: [
          {
            role: 'user',
            content: improvementPrompt
          }
        ]
      });

      const improved = response.content[0]?.type === 'text' 
        ? response.content[0].text.trim()
        : originalPrompt;

      return improved || originalPrompt;
    } catch (error) {
      logger.warn('Failed to improve prompt, using original', error as Error);
      return originalPrompt;
    }
  }

  /**
   * Build system prompt for Chap-ZPT
   */
  private buildSystemPrompt(
    hasProjectContext: boolean,
    projectId?: string,
    existingFiles?: Array<{ path: string; content: string }>,
    isChatMode?: boolean
  ): string {
    const chatModeNote = isChatMode 
      ? `\n\n**CHAT MODE ACTIVE**: You are currently in chat-only mode. This means:\n- You should NOT generate code or use code generation tools\n- You can discuss code, answer questions, provide explanations, and help with planning\n- You can read and analyze existing code, but should not create or modify files\n- Focus on conversation, guidance, and answering questions about the project\n- If the user wants to generate code, they should switch to Code Mode\n`
      : '';

    const basePrompt = `You are Chap-ZPT, a dedicated AI assistant for the AI Code Playground. Your primary focus is on code generation, project management, and helping users build amazing applications.

**Your Role:**
- You are specialized for the playground environment
- You excel at understanding code generation requests
- You automatically improve prompts before generating code
- You provide clear, actionable responses focused on code and projects${chatModeNote}

**Key Capabilities:**
1. **Automatic Prompt Improvement**: When a user asks for code generation, you automatically improve their prompt to ensure high-quality results. You add technical details, best practices, and missing requirements.
2. **Code Generation**: You can generate complete React applications with TypeScript, modern patterns, and production-ready code.
3. **File Management**: You can read, write, edit, and delete project files.
4. **Code Analysis**: You can analyze code for errors, type issues, and improvements.
5. **Deployment**: You can deploy projects to Vercel.

**Other AI Agents in the System:**
You work alongside other specialized AI agents in this platform. It's important to understand their roles:

1. **Elon (PersonalAssistantAgent)**: 
   - A general-purpose AI assistant available throughout the platform
   - Has access to productivity tools like email (Gmail), web search, Discord, Google Calendar, Notion, and user-generated plugins
   - Can help with general questions, research, communication, and task management
   - Can trigger code generation but is not specialized for it like you are
   - Users can access Elon from various pages in the platform (Assistant page, Desktop view, etc.)
   - When users mention "Elon" or ask about the assistant, they're referring to this PersonalAssistantAgent

2. **IncrementalOrchestrator**:
   - The core code generation engine that coordinates multiple specialized agents
   - Handles complex multi-agent workflows for code generation
   - You work with this orchestrator when generating code

3. **Specialized Agents** (used by IncrementalOrchestrator):
   - Various agents specialized for different aspects of code generation (UI, logic, testing, etc.)
   - These agents work behind the scenes during code generation

**Understanding User References:**
- When users mention "Elon", they're referring to the PersonalAssistantAgent
- When users ask about "the assistant" or "the AI", they might mean either you (Chap-ZPT) or Elon, depending on context
- You can explain the difference: you're specialized for the playground and code generation, while Elon is a general assistant with productivity tools
- If a user asks about Elon's capabilities, you can explain that Elon has access to tools like email, web search, and can help with general tasks

**When to Improve Prompts:**
- ALWAYS improve prompts before using generate_code tool
- Add technical specifications (React, TypeScript, hooks, etc.)
- Include UI/UX best practices (responsive, accessible, modern)
- Add error handling and edge case considerations
- Specify code quality requirements

**Communication Style:**
- Be friendly and helpful
- Focus on code and projects
- Explain what you're doing clearly
- When improving prompts, mention it briefly: "I'll improve your prompt to ensure high-quality code generation..."
- Match the user's language (Swedish or English)
- If users ask about Elon or other agents, provide helpful context about their roles

**Project Context:**
${hasProjectContext 
  ? `You are working with project ID: ${projectId}\n${existingFiles && existingFiles.length > 0 
    ? `Existing files: ${existingFiles.length} files\n- ${existingFiles.slice(0, 5).map(f => f.path).join('\n- ')}${existingFiles.length > 5 ? '\n- ...' : ''}`
    : 'No existing files yet'
  }`
  : 'No project selected. Use list_projects and select_project to choose a project.'
}

**Available Tools:**
${hasProjectContext 
  ? `- generate_code: Generate code (you will automatically improve the prompt first)
- read_file, write_file, edit_file, delete_file: File operations
- create_directory: Create folders
- analyze_code, check_types, find_errors, suggest_improvements: Code analysis
- deploy_to_vercel: Deploy to production`
  : `- list_projects: List available projects
- select_project: Select a project to work on`
}

**Important:**
- Always improve prompts before code generation
- Be proactive in suggesting improvements
- Focus on production-ready, maintainable code
- Help users build amazing applications
- Understand and explain the roles of other AI agents in the system when asked`;

    return basePrompt;
  }

  /**
   * Build enhanced user message
   */
  private buildEnhancedMessage(
    userMessage: string,
    existingFiles?: Array<{ path: string; content: string }>
  ): string {
    let enhanced = userMessage;

    if (existingFiles && existingFiles.length > 0) {
      enhanced += `\n\n**Current Project Context:**\nYou are working with a project that has ${existingFiles.length} file(s).`;
    }

    return enhanced;
  }

  /**
   * Convert tools to Anthropic format
   */
  private convertToolsToAnthropicFormat(tools: Tool[]): any[] {
    return tools
      .filter(tool => tool && tool.name && tool.description && tool.parameters)
      .map(tool => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters
      }));
  }

  // Tool implementations (similar to PersonalAssistantAgent but simplified)
  private async listProjects(params: Record<string, any>): Promise<any> {
    const userId = params._userId as string;
    if (!userId) {
      return { success: false, error: 'User ID is required' };
    }

    try {
      const { ProjectService } = await import('../services/ProjectService');
      const projectService = new ProjectService();
      const projects = await projectService.getUserProjects(userId);
      
      return {
        success: true,
        projects: projects.map(p => ({
          id: p.id.toString(),
          name: p.name,
          description: p.description,
          fileCount: 0 // Will be populated if needed
        }))
      };
    } catch (error) {
      logger.error('Error listing projects', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async selectProject(params: Record<string, any>): Promise<any> {
    const projectName = params.projectName as string;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string;
    const sessionId = params._sessionId as string;

    if (!userId || !sessionId) {
      return { success: false, error: 'User ID and session ID are required' };
    }

    try {
      const { ProjectService } = await import('../services/ProjectService');
      const projectService = new ProjectService();
      const projects = await projectService.getUserProjects(userId);

      let selectedProject;
      if (projectId) {
        selectedProject = projects.find(p => p.id.toString() === projectId);
      } else {
        selectedProject = projects.find(p => 
          p.name.toLowerCase().includes(projectName.toLowerCase()) ||
          projectName.toLowerCase().includes(p.name.toLowerCase())
        );
      }

      if (!selectedProject) {
        return {
          success: false,
          error: 'Project not found',
          message: `Could not find project "${projectName}". Available projects: ${projects.map(p => p.name).join(', ')}`
        };
      }

      this.selectedProjects.set(sessionId, {
        projectId: selectedProject.id.toString(),
        projectName: selectedProject.name,
        projectDescription: selectedProject.description
      });

      return {
        success: true,
        project: {
          id: selectedProject.id.toString(),
          name: selectedProject.name,
          description: selectedProject.description
        }
      };
    } catch (error) {
      logger.error('Error selecting project', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private async generateCode(params: Record<string, any>): Promise<any> {
    // This will be called with the improved prompt
    const prompt = params.prompt as string;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string;
    const sessionId = params._sessionId as string;

    try {
      let targetProjectId = projectId;
      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
        }
      }

      if (!userId || !targetProjectId) {
        return {
          success: false,
          error: 'User ID and project ID are required',
          message: 'I need your user ID and a project to generate code for.'
        };
      }

      logger.info(`Generating code with improved prompt: "${prompt.substring(0, 100)}..."`);

      // Use the same generateCode logic as PersonalAssistantAgent
      // Import and use IncrementalOrchestrator
      const { IncrementalOrchestrator } = await import('../services/IncrementalOrchestrator');
      const { knowledgeService } = await import('../services/KnowledgeService');
      const orchestrator = new IncrementalOrchestrator();
      
      const workflowId = `playground-gen-${Date.now()}`;
      
      // Get knowledge context
      const knowledgeContext = await knowledgeService.getRelevantKnowledge(prompt, userId);
      
      // Load existing project files
      let existingProjectFiles: { path: string; content: string }[] = [];
      try {
        const { projectFiles } = await import('../../db/schema-pg');
        const { eq, and } = await import('drizzle-orm');
        const { db } = await import('../../db');
        
        const files = await db
          .select()
          .from(projectFiles as any)
          .where(
            and(
              eq((projectFiles as any).projectId, parseInt(targetProjectId)),
              eq((projectFiles as any).isActive, 1)
            )
          );
        
        existingProjectFiles = files.map((f: any) => ({
          path: f.filePath,
          content: f.fileContent
        }));
      } catch (error) {
        logger.warn(`Failed to load project files: ${error instanceof Error ? error.message : String(error)}`);
      }

      // Start generation asynchronously
      setImmediate(async () => {
        try {
          const { AnalysisAgent } = await import('../services/AnalysisAgent');
          const analysisAgent = new AnalysisAgent();
          
          const formatKnowledgeContext = (context: any): string => {
            if (!context || !context.items || context.items.length === 0) return '';
            return context.items.map((item: any) => 
              `**${item.title || 'Knowledge Item'}**\n${item.content || item.description || ''}`
            ).join('\n\n');
          };
          
          const formattedPrompt = existingProjectFiles.length > 0
            ? `MODIFY EXISTING PROJECT: ${prompt}\n\nIMPORTANT: This is a modification request. You must:\n1. Read and understand the existing code structure\n2. Make ONLY the requested changes\n3. Preserve all existing functionality unless explicitly asked to change it\n4. Maintain code style and patterns from existing files\n5. Ensure all comparisons are logically sound\n\nUser's request: ${prompt}`
            : prompt;
          
          const plan = await analysisAgent.analyzeAndPlan(
            formattedPrompt,
            formatKnowledgeContext(knowledgeContext),
            existingProjectFiles,
            userId
          );
          
          // Emit plan created event
          agentEventEmitter.emit('agent-event', {
            type: 'PLAN_CREATED',
            agent: 'playground-assistant',
            agentId: 'playground-assistant',
            workflowId,
            projectId: targetProjectId,
            plan: {
              appName: plan.appName,
              phases: plan.phases.length
            },
            timestamp: Date.now(),
          });

          // Generate code incrementally
          const result = await orchestrator.generateIncrementally(
            plan,
            prompt,
            formatKnowledgeContext(knowledgeContext),
            existingProjectFiles,
            (phase, progress, message) => {
              agentEventEmitter.emit('agent-event', {
                type: 'PHASE_PROGRESS',
                agent: 'playground-assistant',
                agentId: 'playground-assistant',
                workflowId,
                projectId: targetProjectId,
                phase,
                progress,
                message,
                timestamp: Date.now(),
              });
            },
            (file, index, total) => {
              logger.info(`File generated: ${file.path} (${index + 1}/${total})`);
              
              agentEventEmitter.emit('agent-event', {
                type: 'FILE_GENERATED',
                agent: 'playground-assistant',
                agentId: 'playground-assistant',
                workflowId,
                projectId: targetProjectId,
                file: {
                  path: file.path,
                  content: file.content,
                  size: file.content.length
                },
                index: index + 1,
                total,
                progress: Math.round(((index + 1) / total) * 100),
                timestamp: Date.now(),
              });
            }
          );
          
          // Save files to project
          if (result.allFiles.length > 0) {
            const { ProjectService } = await import('../services/ProjectService');
            const projectService = new ProjectService();
            
            for (const file of result.allFiles) {
              try {
                const files = await projectService.getProjectFiles(parseInt(targetProjectId));
                const existing = files.find(f => f.filePath === file.path);
                
                if (existing) {
                  await projectService.updateProjectFileByPath(
                    parseInt(targetProjectId),
                    file.path,
                    userId,
                    file.content
                  );
                } else {
                  await projectService.createProjectFile(
                    parseInt(targetProjectId),
                    file.path,
                    file.content,
                    userId
                  );
                }
              } catch (error) {
                logger.error(`Failed to save file ${file.path}`, error as Error);
              }
            }
            
            logger.info(`Saved ${result.allFiles.length} files to project ${targetProjectId}`);
          }
          
          // Emit completion event
          agentEventEmitter.emit('agent-event', {
            type: 'GENERATION_COMPLETE',
            agent: 'playground-assistant',
            agentId: 'playground-assistant',
            workflowId,
            projectId: targetProjectId,
            filesGenerated: result.allFiles.length,
            success: result.success,
            timestamp: Date.now(),
          });
        } catch (error) {
          logger.error('Code generation failed', error as Error);
          agentEventEmitter.emit('agent-event', {
            type: 'GENERATION_ERROR',
            agent: 'playground-assistant',
            agentId: 'playground-assistant',
            workflowId,
            projectId: targetProjectId,
            error: error instanceof Error ? error.message : String(error),
            timestamp: Date.now(),
          });
        }
      });

      return {
        success: true,
        message: 'Code generation started! I\'ve improved your prompt and the code is being generated. You\'ll see the files appear in real-time.',
        workflowId
      };
    } catch (error) {
      logger.error('Error in generateCode', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  // File operation methods - reuse logic from PersonalAssistantAgent via singleton
  private async readFile(params: Record<string, any>): Promise<any> {
    const { personalAssistantAgent } = await import('./PersonalAssistantAgent');
    return await (personalAssistantAgent as any).readFile(params);
  }

  private async writeFile(params: Record<string, any>): Promise<any> {
    const { personalAssistantAgent } = await import('./PersonalAssistantAgent');
    return await (personalAssistantAgent as any).writeFile(params);
  }

  private async editFile(params: Record<string, any>): Promise<any> {
    const { personalAssistantAgent } = await import('./PersonalAssistantAgent');
    return await (personalAssistantAgent as any).editFile(params);
  }

  private async deleteFile(params: Record<string, any>): Promise<any> {
    const { personalAssistantAgent } = await import('./PersonalAssistantAgent');
    return await (personalAssistantAgent as any).deleteFile(params);
  }

  private async createDirectory(params: Record<string, any>): Promise<any> {
    const { personalAssistantAgent } = await import('./PersonalAssistantAgent');
    return await (personalAssistantAgent as any).createDirectory(params);
  }

  private async analyzeCode(params: Record<string, any>): Promise<any> {
    const { personalAssistantAgent } = await import('./PersonalAssistantAgent');
    return await (personalAssistantAgent as any).analyzeCode(params);
  }

  private async checkTypes(params: Record<string, any>): Promise<any> {
    const { personalAssistantAgent } = await import('./PersonalAssistantAgent');
    return await (personalAssistantAgent as any).checkTypes(params);
  }

  private async findErrors(params: Record<string, any>): Promise<any> {
    const { personalAssistantAgent } = await import('./PersonalAssistantAgent');
    return await (personalAssistantAgent as any).findErrors(params);
  }

  private async suggestImprovements(params: Record<string, any>): Promise<any> {
    const { personalAssistantAgent } = await import('./PersonalAssistantAgent');
    return await (personalAssistantAgent as any).suggestImprovements(params);
  }

  private async deployToVercel(params: Record<string, any>): Promise<any> {
    const { personalAssistantAgent } = await import('./PersonalAssistantAgent');
    return await (personalAssistantAgent as any).deployToVercel(params);
  }
}

// Export singleton instance
export const playgroundAssistantAgent = new PlaygroundAssistantAgent();

