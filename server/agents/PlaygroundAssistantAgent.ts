import Anthropic from '@anthropic-ai/sdk';
import { SimpleLogger } from '../utils/SimpleLogger';
import { Tool } from '../plugins/BaseProductivityPlugin';
import { agentEventEmitter } from '../index';

const logger = new SimpleLogger('PlaygroundAssistantAgent');

/**
 * Playground Assistant Agent (Chap-ZPT)
 * 
 * The intelligent ORCHESTRATOR for the AI Code Playground, responsible for:
 * - Receiving user requests and understanding intent
 * - Automatically improving prompts before delegating to code generation
 * - Coordinating the IncrementalOrchestrator for actual code generation
 * - Managing project files and deployment
 * 
 * IMPORTANT: Chap-ZPT does NOT generate code directly - it delegates to
 * specialized agents (via IncrementalOrchestrator) which do the actual work.
 * This agent is the "brains" that decides what to do, not the "hands" that write code.
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
  private fixProjectTool: Tool;

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
      description: 'Trigger code generation by delegating to the IncrementalOrchestrator and specialized agents. Use this when the user asks you to create an app, build a feature, generate code, or make changes to their project. The system supports multiple languages (React/TypeScript, Python, Node.js, etc.) but live preview only works for web apps. ALWAYS improve the prompt automatically before triggering generation.',
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed description of what code to generate. This prompt will be automatically improved before delegation to code generation agents.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, uses the currently selected project.'
          },
          language: {
            type: 'string',
            description: 'Optional: The target language/framework (react, python, node, etc.). If not specified, defaults to React/TypeScript for web preview compatibility.'
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

    // Fix project tool
    this.fixProjectTool = {
      name: 'fix_project',
      description: 'Analyze and fix all issues in the current project to ensure it starts and runs without problems. Use this when the user asks to fix problems, repair the project, make it work, or ensure it starts correctly. This will automatically detect and fix: missing files, syntax errors, import errors, configuration errors, dependency issues, and runtime errors.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, uses the currently selected project.'
          }
        },
        required: []
      },
      execute: this.fixProject.bind(this)
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
      const isChatMode = options?.chatMode || false;

      // Build available tools
      const tools: Tool[] = [
        this.listProjectsTool,
        this.selectProjectTool
      ];

      if (hasProjectContext) {
        // In Chat Mode: Only add READ/ANALYZE tools, NO code generation or modification
        if (isChatMode) {
          tools.push(
            this.readFileTool,
            this.analyzeCodeTool,
            this.checkTypesTool,
            this.findErrorsTool,
            this.suggestImprovementsTool
            // NO generate_code, write_file, edit_file, delete_file, create_directory, deploy
          );
          logger.info(`Chat Mode active - code generation tools DISABLED`);
        } else {
          // Code Mode: All tools available
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
            this.fixProjectTool,
            this.deployToVercelTool
          );
        }
      }

      // Get connector context if we have a project
      let connectorContext = '';
      if (projectId) {
        try {
          const { ConnectorService } = await import('../services/ConnectorService');
          const { db } = await import('../../db');
          const { workspaces } = await import('../../db/schema-pg');
          const { eq } = await import('drizzle-orm');
          
          // Get workspace ID from project
          const [workspace] = await db
            .select({ id: workspaces.id })
            .from(workspaces)
            .where(eq(workspaces.id, parseInt(projectId)))
            .limit(1);
          
          if (workspace) {
            const connectors = await ConnectorService.getWorkspaceConnectors(userId, workspace.id);
            connectorContext = ConnectorService.buildConnectorContextString(connectors.availableConnectors);
          }
        } catch (error) {
          logger.warn(`Failed to load connector context: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Build system prompt
      const systemPrompt = this.buildSystemPrompt(hasProjectContext, projectId, options?.existingFiles, isChatMode, connectorContext);

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
            // In chat mode, if generate_code is requested, provide helpful error
            if (toolCall.name === 'generate_code' && isChatMode) {
              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolCall.id,
                content: JSON.stringify({
                  success: false,
                  error: 'generate_code is not available in Chat Mode',
                  message: 'I understand you want to generate code, but I\'m currently in Chat Mode where code generation is disabled. Please switch to Code Mode to generate code. In Chat Mode, I can help you plan, discuss architecture, and provide code examples in my responses.'
                }, null, 2)
              });
              continue;
            }
            continue;
          }

          try {
            // Special handling for generate_code - improve prompt first
            if (toolCall.name === 'generate_code') {
              // Double-check: if in chat mode, don't allow generate_code
              if (isChatMode) {
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: toolCall.id,
                  content: JSON.stringify({
                    success: false,
                    error: 'generate_code is not available in Chat Mode',
                    message: 'I understand you want to generate code, but I\'m currently in Chat Mode where code generation is disabled. Please switch to Code Mode to generate code. In Chat Mode, I can help you plan, discuss architecture, and provide code examples in my responses.'
                  }, null, 2)
                });
                continue;
              }
              
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
      const textContent = currentResponse.content.find((item: any) => item.type === 'text') as { type: 'text'; text: string } | undefined;
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
   * Detects project type and tailors improvements accordingly
   */
  private async improvePrompt(
    originalPrompt: string,
    existingFiles: Array<{ path: string; content: string }>
  ): Promise<string> {
    try {
      // Detect project type from existing files or prompt
      const projectType = this.detectProjectType(originalPrompt, existingFiles);
      
      // CRITICAL: Determine the language prefix to ensure AnalysisAgent gets the right signal
      const languagePrefix = projectType === 'python' 
        ? '[PYTHON PROJECT] '
        : projectType === 'node'
          ? '[NODE.JS PROJECT] '
          : '[REACT/TYPESCRIPT PROJECT] ';
      
      const improvementPrompt = `You are an expert at improving code generation prompts. Your task is to take a user's request and transform it into a detailed, comprehensive prompt that will result in high-quality, production-ready code.

**Original User Request:**
${originalPrompt}

**Detected Project Type:** ${projectType}
${projectType === 'python' ? '\n**CRITICAL: This is a PYTHON project. The improved prompt MUST explicitly mention "Python" and the framework (Flask/Streamlit/FastAPI) so the correct agent is used.**' : ''}

**Existing Project Files (if any):**
${existingFiles.length > 0 
  ? existingFiles.slice(0, 5).map(f => `- ${f.path} (${f.content.length} chars)`).join('\n')
  : 'No existing files (new project)'
}

**Your Task:**
Transform the user's request into a detailed, comprehensive prompt that includes:
1. ${projectType === 'python' ? 'MUST START WITH: "Build a Python [framework] application..."' : 'Clear feature requirements'}
2. Technical specifications appropriate for ${projectType}
3. ${projectType === 'web/react' ? 'UI/UX considerations (responsive, accessible, modern design)' : projectType === 'python' ? 'Python best practices (type hints, proper structure, requirements.txt)' : 'Appropriate architecture and patterns for the project type'}
4. Code quality requirements (clean, maintainable, well-structured)
5. Any missing but important details (error handling, edge cases, etc.)

**Guidelines:**
- Keep the user's original intent and requirements
- Add technical details that ensure production-ready code
${projectType === 'web/react' 
  ? '- Specify React patterns (hooks, functional components, TypeScript)\n- Include modern UI/UX best practices'
  : projectType === 'python'
    ? '- Specify Python best practices (type hints, clean code, proper structure)\n- Include appropriate libraries and patterns'
    : projectType === 'node'
      ? '- Specify Node.js best practices (async/await, error handling, proper structure)\n- Include appropriate packages and patterns'
      : '- Specify appropriate patterns and best practices for the detected technology'
}
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

      let improved = response.content[0]?.type === 'text' 
        ? response.content[0].text.trim()
        : originalPrompt;

      // CRITICAL: Ensure Python projects ALWAYS have Python keyword in improved prompt
      // This ensures AnalysisAgent.detectProjectLanguage() selects the right agent
      if (projectType === 'python' && improved && !improved.toLowerCase().includes('python')) {
        logger.info('Adding Python prefix to improved prompt to ensure correct agent selection');
        improved = `[PYTHON PROJECT] ${improved}`;
      }

      return improved || originalPrompt;
    } catch (error) {
      logger.warn(`Failed to improve prompt, using original: ${error instanceof Error ? error.message : String(error)}`);
      return originalPrompt;
    }
  }

  /**
   * Detect project type from prompt and existing files
   * Returns: 'web/react' | 'python' | 'node' | 'general'
   */
  private detectProjectType(
    prompt: string,
    existingFiles: Array<{ path: string; content: string }>
  ): string {
    const promptLower = prompt.toLowerCase();
    
    // Check prompt keywords - Python detection with Swedish keywords
    const pythonKeywords = [
      'python', '.py', 'flask', 'django', 'fastapi', 'streamlit',
      'pandas', 'numpy', 'scipy', 'matplotlib', 'pip', 'requirements.txt',
      // Swedish keywords that often indicate Python projects
      'övertid', 'övertimmar', 'dataanalys', 'maskinlärning', 'datavetenskap'
    ];
    
    if (pythonKeywords.some(keyword => promptLower.includes(keyword))) {
      return 'python';
    }
    
    if (promptLower.includes('node') || promptLower.includes('express') || promptLower.includes('backend') || promptLower.includes('api server')) {
      return 'node';
    }
    
    // Check existing files
    if (existingFiles.length > 0) {
      const hasPythonFiles = existingFiles.some(f => f.path.endsWith('.py'));
      const hasReactFiles = existingFiles.some(f => 
        f.path.endsWith('.tsx') || f.path.endsWith('.jsx') || 
        f.path.includes('package.json') && f.content.includes('react')
      );
      const hasNodeFiles = existingFiles.some(f => 
        f.path.includes('package.json') && !f.content.includes('react')
      );
      
      if (hasPythonFiles) return 'python';
      if (hasReactFiles) return 'web/react';
      if (hasNodeFiles) return 'node';
    }
    
    // Default to web/react for preview compatibility
    if (promptLower.includes('app') || promptLower.includes('website') || promptLower.includes('web') || 
        promptLower.includes('ui') || promptLower.includes('frontend') || promptLower.includes('react')) {
      return 'web/react';
    }
    
    return 'general';
  }

  /**
   * Build system prompt for Chap-ZPT
   */
  private buildSystemPrompt(
    hasProjectContext: boolean,
    projectId?: string,
    existingFiles?: Array<{ path: string; content: string }>,
    isChatMode?: boolean,
    connectorContext?: string
  ): string {
    const chatModeNote = isChatMode 
      ? `\n\n**🔵 CHAT MODE ACTIVE - CRITICAL INSTRUCTIONS:**
You are currently in CHAT-ONLY mode. This is VERY IMPORTANT:

1. **DO NOT generate code** - The generate_code tool is DISABLED and will cause errors if you try to use it
2. **DO NOT create/modify/delete files** - Those tools are DISABLED  
3. **INSTEAD: Have a conversation** - Answer questions, discuss ideas, help plan

**What you SHOULD do in Chat Mode when user asks to build/create something:**
- Explain what you would build and how
- Discuss the architecture, components, and structure
- Provide detailed planning and requirements
- Give code examples IN YOUR TEXT RESPONSE (as markdown code blocks, not via tools)
- Help them understand what needs to be built
- Then suggest: "When you're ready to build this, switch to Code Mode and I'll generate all the files for you!"

**Example interaction in Chat Mode:**
User: "Hade du utifrån detta projektet och dess filer kunna skapa en frontend webUI som spelare kan använda för att se hur många som är online, highscores och så vidare?"

YOU: "Absolut! Jag kan hjälpa dig planera en frontend webUI för din OpenTibia server. Här är vad jag skulle bygga:

**Komponenter:**
1. **Server Status Dashboard** - Visa antal spelare online, server uptime, max players
2. **Online Players List** - Lista med spelare som är online (namn, level, vocation, location)
3. **Highscores Section** - Topplistor för level, experience, skills
4. **Server Information** - IP, port, rates (XP, loot, skill), server version

**Teknisk lösning:**
- React + TypeScript för frontend
- API endpoints som hämtar data från din OpenTibia server
- Modern, gaming-inspirerad design med dark theme
- Real-time updates (auto-refresh var 30:e sekund)
- Responsive design för mobil och desktop

**Filer som skulle skapas:**
- src/App.tsx - Huvudkomponent
- src/components/ServerStatus.tsx - Server status display
- src/components/OnlinePlayers.tsx - Spelarlista
- src/components/Highscores.tsx - Highscores
- src/services/api.ts - API-anrop till servern
- package.json, tsconfig.json, etc.

När du är redo att bygga detta, byt till Code Mode så genererar jag alla filer åt dig! Vill du att jag förklarar någon del mer i detalj?"

**CRITICAL: NEVER try to call generate_code - it will cause an error. Always explain and suggest Code Mode instead.**
`
      : '';

    const basePrompt = `You are Chap-ZPT, the intelligent orchestrator for the AI Code Playground. You receive user requests, understand their intent, improve their prompts, and coordinate specialized AI agents to build applications.

**Your Role:**
- You are the ORCHESTRATOR - you don't build code yourself, you coordinate other agents
- You analyze what the user wants and delegate to the IncrementalOrchestrator for code generation
- You automatically improve prompts before triggering code generation
- You provide clear, friendly responses about what's happening${chatModeNote}

**Key Capabilities:**
1. **Intent Detection**: You understand what the user wants (build new app, modify code, deploy, chat, etc.)
2. **Prompt Improvement**: You enhance user requests with technical details, best practices, and requirements before delegating to code generation agents.
3. **Multi-Language Support**: The system supports multiple languages with different preview modes:
   - **React/TypeScript**: Full WebContainer preview with hot reload
   - **Python Scripts**: Browser-based preview using Pyodide (WebAssembly)
   - **Python Web Apps (Flask/Django/FastAPI/Streamlit)**: Server-side sandbox preview
   - **Node.js**: WebContainer preview
4. **File Management**: You can read, write, edit, and delete project files.
5. **Deployment**: You can deploy web projects to Vercel.

**Python Support:**
- For simple Python scripts: Preview runs in-browser using Pyodide (instant, no server needed)
- For Python web frameworks (Flask, Django, FastAPI, Streamlit): Server-side sandbox with live URL
- Auto-detects Python project type and chooses appropriate preview
- Supports common packages: numpy, pandas, scipy, matplotlib, scikit-learn, etc.
- When user asks for Python: Generate .py files, requirements.txt, and appropriate structure

**Important Clarification:**
- You do NOT directly write code - you delegate to the IncrementalOrchestrator which coordinates specialized agents (DesignAgent, ArchitectAgent, CodeGeneratorAgent, etc.)
- When a user asks you to "build an app", you improve their prompt and trigger the generation pipeline
- The actual code is generated by specialized agents, not by you directly
- For Python apps: The preview will auto-detect if it's a script (Pyodide) or web app (server sandbox)

**The AI Agent System:**
You are part of a multi-agent AI system. Here's how it works:

1. **You (Chap-ZPT)**: 
   - The user-facing orchestrator in the playground
   - Receive user messages, detect intent, improve prompts
   - Delegate code generation to the IncrementalOrchestrator
   - You are the "brains" that decides what to do, but you don't write code yourself

2. **IncrementalOrchestrator**:
   - The core code generation engine YOU delegate to
   - Coordinates multiple specialized agents for code generation
   - Handles complex multi-agent workflows
   - When you call generate_code, THIS is what actually builds the app

3. **Specialized Agents** (coordinated by IncrementalOrchestrator):
   - DesignAgent: UI/UX decisions
   - ArchitectAgent: Code structure and architecture  
   - CodeGeneratorAgent: Writes the actual code
   - And more specialized agents for different tasks

4. **Elon (PersonalAssistantAgent)**: 
   - A DIFFERENT assistant available throughout the platform
   - General-purpose AI with productivity tools (email, web search, Discord, Calendar, Notion, plugins)
   - Can help with research, communication, task management
   - Users access Elon from the Assistant page, Desktop view, etc.
   - When users mention "Elon", they mean this assistant - not you!

**Understanding User References:**
- When users mention "Elon", they're referring to the PersonalAssistantAgent
- When users ask about "the assistant" or "the AI", they might mean either you (Chap-ZPT) or Elon, depending on context
- You can explain the difference: you're specialized for the playground and code generation, while Elon is a general assistant with productivity tools
- If a user asks about Elon's capabilities, you can explain that Elon has access to tools like email, web search, and can help with general tasks

**Information Gathering & Tool Usage:**
- Gather only the information required to proceed safely; stop as soon as you can make a well-justified next step
- Before running a series of related information-gathering tools, briefly explain what you'll do and why
- ALWAYS batch multiple independent operations when possible - never make sequential tool calls that could be combined
- Only use tools when you have a clear, stated purpose that directly informs your next action; do not use them for exploratory browsing

**When to Use Each Tool:**

**read_file:**
- When the user asks you to read or examine a specific file
- When you need to understand existing code before making changes
- When you need to see the current implementation of a function, component, or feature
- Use analyze: true parameter when you need deeper analysis of the file's structure and patterns
- Only read files that are directly relevant to the task at hand
- If you need to read multiple files, batch the read_file calls together

**analyze_code:**
- When you need comprehensive code analysis across the project (errors, warnings, security, performance, best practices)
- When the user asks you to review or analyze code quality
- When you want to understand the overall codebase health before making changes
- Use with filePath parameter for analysis of a specific file, or without for project-wide analysis
- This is heavier than read_file - use read_file first if you just need to see file contents

**check_types:**
- When working with TypeScript projects and you need to verify type correctness
- When the user reports type errors or asks about type issues
- Before deploying TypeScript code to catch type errors early
- Use with filePath for a specific file, or without for project-wide type checking

**find_errors:**
- When you need to find specific errors (not warnings) in the code
- After making code changes to verify nothing broke
- When the user reports errors or the code isn't working
- This is more focused than analyze_code - use this when you specifically need to find errors

**suggest_improvements:**
- When the user asks for code improvements or refactoring suggestions
- When you want to provide actionable suggestions for making code better
- Use with filePath for file-specific improvements, or without for project-wide suggestions

**write_file vs edit_file:**
- Use write_file: When creating a completely new file or completely replacing an existing file's content
- Use edit_file: When making targeted modifications to existing files (changing a function, updating a variable, adjusting styles)
- Always prefer edit_file for modifications to preserve existing code structure
- Before editing, use read_file to understand the current file structure

**delete_file:**
- Only when the user explicitly asks to remove a file
- Never delete files without explicit user request
- Be conservative - confirm the file should be deleted if you're unsure

**create_directory:**
- When the user asks to create a new folder or organize files into a new directory structure
- When you're creating multiple files that should be grouped in a directory
- This helps maintain clean project organization

**generate_code:**
- When the user wants to build a new app, add features, or generate code
- ALWAYS improve the prompt before calling this tool
- This delegates to IncrementalOrchestrator which coordinates specialized agents (you don't write code yourself)
- For code modifications, you can use read_file + edit_file instead of generate_code if the change is simple

**fix_project:**
- When the user asks to fix problems, repair the project, make it work, or ensure it starts correctly
- When the user says the project doesn't work, has errors, or won't start
- When the user wants to fix all issues in the project automatically
- This tool analyzes the entire project and automatically fixes: missing files, syntax errors, import errors, configuration errors, dependency issues, and runtime errors
- Use this INSTEAD of manually fixing individual files when the user wants comprehensive project repair
- Examples: "Fixa till problemen i projektet", "Fix the project so it starts", "Repair the project", "Make it work"

**deploy_to_vercel:**
- Only when the user explicitly asks to deploy, publish, or share their app
- Never deploy without explicit user permission
- This creates a GitHub repository and deploys to production

**General Tool Usage Principles:**
- Batch multiple file operations (reading/writing multiple files) together when they're independent
- Don't use tools for exploratory browsing - have a clear purpose before using each tool
- If you're repeatedly calling tools without making progress, stop and ask the user for clarification
- Confirm existence and understand structure before making edits - read files first

**When to Improve Prompts:**
- ALWAYS improve prompts before using generate_code tool
- Detect language/framework from user request:
  - Python keywords: "python", "flask", "django", "fastapi", "streamlit", ".py"
  - React keywords: "react", "component", "ui", "frontend", "website"
- For React/TypeScript web apps: Add TypeScript, hooks, responsive design, SEO best practices, design system considerations
- For Python: Add type hints, proper structure, requirements.txt, error handling
- Include error handling and edge case considerations
- Specify code quality requirements (clean, maintainable, well-structured)
- For web apps: Emphasize semantic HTML, accessibility, mobile optimization, performance

**Prompt Improvement Guidelines:**
When improving prompts, ensure they include:
1. Clear feature requirements and technical specifications
2. Framework-specific best practices (React hooks, TypeScript for web; type hints for Python)
3. UI/UX considerations for web apps (responsive, accessible, modern design, design system usage)
4. Code quality requirements (clean, maintainable, well-structured)
5. Error handling and edge case considerations
6. Testing and validation expectations
7. Package management instructions (use package managers, not manual edits)

**Code Quality & Best Practices:**
- Focus on production-ready, maintainable code
- Ensure proper error handling and edge cases
- Suggest testing approaches after code generation
- For web apps: Ensure semantic HTML, proper accessibility, mobile responsiveness
- For React apps: Emphasize proper TypeScript usage, component composition, design system consistency
- When delegating code generation, include these quality expectations in the improved prompt

**Package Management:**
- Always use package managers for dependency management (npm/yarn/pnpm for Node.js, pip/poetry for Python, etc.)
- Never manually edit package.json, requirements.txt, or similar files
- Package managers resolve versions, handle conflicts, update lock files, and maintain consistency

**Following Instructions:**
- Focus on doing what the user asks you to do
- Do NOT do more than the user asked - if you think there is a clear follow-up task, ASK the user first
- The more potentially damaging the action, the more conservative you should be
- Do NOT perform dangerous actions without explicit permission (deployments, dependency installs, etc.)

**Communication Style:**
- Write responses in clear Markdown with proper headings (##/###/####)
- Use bullet/numbered lists for steps
- Keep paragraphs short; avoid wall-of-text
- Be friendly and helpful
- Focus on code and projects
- Explain what you're doing clearly, but concisely
- When improving prompts, mention it briefly: "I'll improve your prompt to ensure high-quality code generation..."
- Match the user's language (Swedish or English)
- If users ask about Elon or other agents, provide helpful context about their roles
- Occasionally explain notable actions you're going to take - not before every tool call, only when significant
- Optimize writing for clarity and skimmability

**Recovering from Difficulties:**
- If you notice yourself going in circles or down a rabbit hole (e.g., calling the same tool repeatedly without progress), ask the user for help
- If unsure about scope, ask for clarification rather than guessing

**Efficiency & Cost:**
- Prefer the smallest set of high-signal tool calls that confidently complete the task
- Batch related info-gathering and edits; avoid exploratory calls without a clear next step
- Balance cost, latency, and quality - be efficient but thorough

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
  ? `- generate_code: Trigger code generation (YOU improve the prompt, then delegate to IncrementalOrchestrator)
- read_file, write_file, edit_file, delete_file: File operations
- create_directory: Create folders
- analyze_code, check_types, find_errors, suggest_improvements: Code analysis
- deploy_to_vercel: Deploy web projects to production`
  : `- list_projects: List available projects
- select_project: Select a project to work on`
}

**Success Criteria:**
Solutions should be correct, minimal, tested (or testable), and maintainable by other developers with clear run/test commands provided.

**Important:**
- Always improve prompts before code generation
- Be proactive in suggesting improvements
- Focus on production-ready, maintainable code
- Help users build amazing applications
- Understand and explain the roles of other AI agents in the system when asked${connectorContext || ''}`;

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
        projectDescription: selectedProject.description ?? undefined
      });

      return {
        success: true,
        project: {
          id: selectedProject.id.toString(),
          name: selectedProject.name,
          description: selectedProject.description ?? undefined
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

          // Track workflow start for learning
          const workflowStartTime = Date.now();
          const workflowSteps: string[] = [];

          // Generate code incrementally
          const result = await orchestrator.generateIncrementally(
            plan,
            prompt,
            formatKnowledgeContext(knowledgeContext),
            existingProjectFiles,
            (phase, progress, message) => {
              workflowSteps.push(`Phase ${phase}: ${message}`);
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

          // Learn from successful workflow
          if (result.success) {
            const { contextLearningService } = await import('../services/ContextLearningService');
            const { ContextEngine } = await import('../services/ContextEngine');
            const { ConversationMemoryService } = await import('../services/ConversationMemoryService');
            const { ProjectService } = await import('../services/ProjectService');
            
            try {
              const { MultiModelAIService } = await import('../services/MultiModelAIService');
              const projectService = new ProjectService();
              const multiModelAI = new MultiModelAIService();
              const conversationMemory = new ConversationMemoryService(multiModelAI);
              const contextEngine = new ContextEngine(conversationMemory, projectService);
              
              const userContext = await contextEngine.analyzeContext(
                userId,
                '/playground',
                targetProjectId
              );

              await contextLearningService.learnFromSuccessfulWorkflow(
                userId,
                userContext,
                {
                  steps: workflowSteps,
                  result: result.success ? 'success' : 'failed',
                  duration: Date.now() - workflowStartTime
                }
              );
            } catch (err) {
              logger.warn('Failed to learn from workflow', err as Error);
            }
          }
          
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
          
          // Record failure for learning
          const { agentLearningService } = await import('../services/AgentLearningService');
          agentLearningService.recordCodeGenerationFailure(
            error as Error,
            {
              prompt: prompt, // Use the prompt variable that's in scope
              projectId: targetProjectId?.toString(),
              phase: 'generation'
            }
          ).catch(err => logger.warn('Failed to record failure for learning', err));
          
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
        message: 'Code generation delegated! I\'ve improved your prompt and handed it off to the IncrementalOrchestrator with specialized agents. You\'ll see the files appear in real-time as they work.',
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

  /**
   * Fix project issues
   */
  private async fixProject(params: Record<string, any>): Promise<{
    success: boolean;
    message: string;
    issuesFixed?: number;
    filesModified?: number;
  }> {
    const userId = params._userId as string;
    const sessionId = params._sessionId as string;
    const targetProjectId = params.projectId || (sessionId ? this.selectedProjects.get(sessionId)?.projectId : undefined);

    if (!userId || !targetProjectId) {
      return {
        success: false,
        message: 'I need your user ID and a project to fix.'
      };
    }

    try {
      logger.info(`Fixing project ${targetProjectId} for user ${userId}`);

      // Load project files
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
      
      const existingFiles = files.map((f: any) => ({
        path: f.filePath,
        content: f.fileContent
      }));

      if (existingFiles.length === 0) {
        return {
          success: false,
          message: 'No files found in this project.'
        };
      }

      // Analyze and fix project
      const { ProjectFixer } = await import('../services/ProjectFixer');
      const projectFixer = new ProjectFixer();
      
      const analysis = await projectFixer.analyzeProject(existingFiles);
      const fixedFiles = await projectFixer.fixProject(existingFiles, analysis);

      // Save fixed files back to database
      const { projectService } = await import('../services/ProjectService');
      await projectService.exportToProject(
        parseInt(targetProjectId),
        userId,
        fixedFiles,
        'Fixed Project'
      );

      const issuesFixed = analysis.totalIssues;
      const filesModified = fixedFiles.length - existingFiles.length;

      logger.info(`Fixed ${issuesFixed} issues, modified ${filesModified} files`);

      return {
        success: true,
        message: `Fixed ${issuesFixed} issue(s) in the project. ${filesModified > 0 ? `Created/modified ${filesModified} file(s).` : 'All issues resolved in existing files.'} The project should now start without problems.`,
        issuesFixed,
        filesModified
      };
    } catch (error) {
      logger.error('Failed to fix project', error as Error);
      return {
        success: false,
        message: `Failed to fix project: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }
}

// Export singleton instance
export const playgroundAssistantAgent = new PlaygroundAssistantAgent();

