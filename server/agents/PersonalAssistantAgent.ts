import Anthropic from '@anthropic-ai/sdk';
import { SimpleLogger } from '../utils/SimpleLogger';
import { pluginRegistry } from '../services/PluginRegistry';
import { Tool, KnowledgeItem } from '../plugins/BaseProductivityPlugin';
import axios from 'axios';
import { discordService } from '../services/DiscordService';
import { agentEventEmitter } from '../index';
import { db } from '../../db';
import { assistantMessages, assistantMemories, assistantSessions } from '../../db/schema-pg';
import { eq, and, desc, sql, inArray } from 'drizzle-orm';
// Lazy import to avoid circular dependency

const logger = new SimpleLogger('PersonalAssistantAgent');

// Max messages to keep per session (rolling window)
const MAX_MESSAGES_PER_SESSION = 15;

/**
 * Personal Assistant Agent - Your AI-powered productivity companion
 *
 * Features:
 * - Contextual awareness across all integrated services
 * - Natural language task execution
 * - Proactive suggestions and reminders
 * - Multi-tool orchestration
 * - Learning from user patterns
 */
export class PersonalAssistantAgent {
  private anthropic: Anthropic;
  private conversationHistory: Map<string, Anthropic.MessageParam[]> = new Map();
  private additionalTools: Map<string, Tool[]> = new Map(); // Store additional tools by userId
  private webSearchTool: Tool;
  private discordTool: Tool;
  private readDiscordMessagesTool: Tool;
  private generateCodeTool: Tool;
  private listProjectsTool: Tool;
  private selectProjectTool: Tool;
  private deployToVercelTool: Tool;
  private readFileTool: Tool;
  private writeFileTool!: Tool;
  private editFileTool!: Tool;
  private deleteFileTool!: Tool;
  private createDirectoryTool: Tool;
  private gitCommitTool: Tool;
  private gitBranchTool: Tool;
  private gitStatusTool: Tool;
  private gitDiffTool: Tool;
  private gitLogTool: Tool;
  private analyzeCodeTool: Tool;
  private checkTypesTool: Tool;
  private findErrorsTool: Tool;
  private suggestImprovementsTool: Tool;
  private generateTestsTool: Tool;
  private runTestsTool: Tool;
  private testCoverageTool: Tool;
  private generateDocsTool: Tool;
  private rememberFactTool: Tool;
  private recallMemoryTool: Tool;
  private processImageTool: Tool;
  private detectLanguageTool: Tool;
  private trackErrorTool: Tool;
  private getUsageStatsTool: Tool;
  private getDataInsightsTool: Tool;
  private browserUseTool: Tool;
  private selectedProjects: Map<string, { projectId: string; projectName: string; projectDescription?: string; isGitHubRepo?: boolean; githubRepo?: { fullName: string; owner: string; repo: string; defaultBranch?: string } }> = new Map(); // Store selected project per session
  private userMessageCounts: Map<string, number> = new Map(); // Track message count per user for Discord recommendations
  private lastDiscordRecommendation: Map<string, number> = new Map(); // Track last recommendation timestamp

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });

    // Initialize built-in web search tool
    this.webSearchTool = {
      name: 'web_search',
      description: 'Search the web for real-time information about companies, addresses, contact details, current events, or any information not in your knowledge base. Use this when user asks for specific real-world details like addresses, phone numbers, business hours, or current information.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query (e.g., "Colorama Lund address and contact information")'
          },
          num_results: {
            type: 'string',
            description: 'Number of results to return (1-5)',
            enum: ['1', '2', '3', '4', '5']
          }
        },
        required: ['query']
      },
      execute: this.performWebSearch.bind(this)
    };

    // Initialize Discord tools
    this.discordTool = {
      name: 'send_discord_message',
      description: 'Send a message to the user\'s Discord community via the Discord bot. Use this when the user asks you to post, share, or announce something in Discord. You can post updates about projects, share progress, announce features, or communicate with the community. The bot must be connected for this to work. You can specify either a channel name (e.g., "gonattis") or a channel ID. If the user mentions a server name (e.g., "Elon server"), use serverName to find the correct server first.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message content to post in Discord. Can include Discord markdown formatting (bold **text**, italic *text*, code blocks, etc.)'
          },
          channelId: {
            type: 'string',
            description: 'Optional Discord channel ID. If not provided, uses the default channel from bot configuration.'
          },
          channelName: {
            type: 'string',
            description: 'Optional Discord channel name (e.g., "gonattis", "general"). If provided, will search for a channel with this name. Takes precedence over channelId if both are provided.'
          },
          serverName: {
            type: 'string',
            description: 'Optional Discord server name (e.g., "Elon", "Extend Media"). If the user mentions a specific server, use this to find the correct server first, then search for the channel within that server. If not provided, uses the default server from bot configuration.'
          }
        },
        required: ['message']
      },
      execute: this.sendDiscordMessage.bind(this)
    };

    // Initialize Discord read messages tool
    this.readDiscordMessagesTool = {
      name: 'read_discord_messages',
      description: 'Read recent messages from Discord channels. Use this when the user asks you to check what\'s happening in Discord, read new messages, see what people are talking about, or get updates from Discord channels. You can read from a specific channel, multiple channels, or all channels in the server.',
      parameters: {
        type: 'object',
        properties: {
          channelName: {
            type: 'string',
            description: 'Optional channel name to read from (e.g., "gonattis", "general"). If not provided, reads from all channels.'
          },
          channelId: {
            type: 'string',
            description: 'Optional channel ID to read from. If not provided, reads from all channels.'
          },
          limit: {
            type: 'number',
            description: 'Number of messages to read per channel (default: 10, max: 50)'
          },
          readAllChannels: {
            type: 'boolean',
            description: 'If true, reads messages from all channels in the server. Default: false if channelName or channelId is provided, true otherwise.'
          }
        },
        required: []
      },
      execute: this.readDiscordMessages.bind(this)
    };

    // Initialize code generation tool
    this.generateCodeTool = {
      name: 'generate_code',
      description: `Generate code for applications in the playground. Supports multiple languages:
- **React/TypeScript**: Full WebContainer preview with hot reload
- **Python Scripts**: Browser-based preview using Pyodide (WebAssembly)
- **Python Web Apps (Flask/Django/FastAPI/Streamlit)**: Server-side sandbox preview with live URL
- **Node.js**: WebContainer preview

Use this tool when: (1) User asks to create an app, build a feature, generate code, or make changes to their project. (2) **CRITICAL: User asks to start, restart, or stop the dev server** - use this tool with prompt like "start the dev server" or "restart the dev server". 

**Python Support**: When user asks for Python apps:
- Simple scripts (data processing, algorithms, etc.) → Generates .py files, runs in browser via Pyodide
- Web apps (Flask, FastAPI, Django, Streamlit) → Generates .py files + requirements.txt, runs on server sandbox
- Preview auto-detects project type and uses appropriate runtime

If no projectId is provided, will use the currently selected project from the conversation.`,
      parameters: {
        type: 'object',
        properties: {
          prompt: {
            type: 'string',
            description: 'Detailed description of what code to generate (e.g., "Create an iPhone homescreen app" or "Build a Flask API with user authentication" or "Create a Python data analysis script")'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID to generate code for. If not provided, will use the currently selected project from the conversation (set via select_project tool).'
          },
          language: {
            type: 'string',
            description: 'Optional: Target language/framework (react, python, flask, fastapi, django, node). Auto-detected from prompt if not specified.'
          }
        },
        required: ['prompt']
      },
      execute: this.generateCode.bind(this)
    };

    // Initialize list projects tool (using arrow function to avoid binding issues)
    this.listProjectsTool = {
      name: 'list_projects',
      description: 'List all projects that the user has access to, including both platform projects and GitHub repositories (if GitHub is connected). Use this when the user asks about their projects, what projects they can work on, or wants to see available projects. This will show project names, descriptions, file counts, and indicate which are platform projects (can be previewed) vs GitHub repos (cannot be previewed but can be worked on via API).',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.listProjects(params);
      }
    };

    // Initialize select project tool (using arrow function to avoid binding issues)
    this.selectProjectTool = {
      name: 'select_project',
      description: 'Select a project to work on. Use this when the user explicitly chooses a project by name or number (e.g., "Låt oss arbeta på projekt 2" or "Välj Projekt X"). This sets the active project for the conversation, so subsequent code generation will use this project. Always use this tool when the user chooses a specific project to work on.',
      parameters: {
        type: 'object',
        properties: {
          projectName: {
            type: 'string',
            description: 'The name of the project to select (e.g., "Projekt 2", "iPhone 16 App Nr.1")'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If provided, will use this directly. Otherwise, will search for project by name.'
          }
        },
        required: ['projectName']
      },
      execute: async (params: Record<string, any>) => {
        return await this.selectProject(params);
      }
    };

    // Initialize deploy to Vercel tool
    this.deployToVercelTool = {
      name: 'deploy_to_vercel',
      description: 'Deploy a project to Vercel for public access. Use this when the user asks to deploy, publish, or make their app live. This will create a GitHub repository and deploy the project to Vercel, returning a public URL. Always inform the user of the deployment URL once complete.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'The project ID to deploy. If not provided, will use the currently selected project from the conversation.'
          },
          projectName: {
            type: 'string',
            description: 'Optional project name for the deployment. If not provided, will use the project name from the database.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.deployToVercel(params);
      }
    };

    // Initialize read file tool
    this.readFileTool = {
      name: 'read_file',
      description: 'Read and analyze a specific file from a project. **CRITICAL: Use this tool FIRST whenever the user mentions a specific file by name (e.g., "look at xxxx.lua", "check the App.tsx file", "review config.json").** After reading the file, you can then use other tools like suggest_improvements, analyze_code, or provide direct analysis based on what the user asked for (e.g., performance improvements, bug fixes, refactoring suggestions). You can read any file in the project by its path.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the file to read (e.g., "src/App.tsx", "src/components/Button.tsx", "package.json", "data/script.lua"). Extract the file path from the user\'s message if they mention a specific file.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          },
          analyze: {
            type: 'boolean',
            description: 'If true, provide analysis of the code including potential issues, improvements, and explanations. Default: true.'
          }
        },
        required: ['filePath']
      },
      execute: async (params: Record<string, any>) => {
        return await this.readFile(params);
      }
    };

    // Initialize write file tool
    this.writeFileTool = {
      name: 'write_file',
      description: 'Write or create a file in a project. Use this when the user asks you to create a new file, write content to a file, or save code to a file. This will create the file if it doesn\'t exist, or update it if it does.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the file to write (e.g., "src/App.tsx", "src/components/Button.tsx", "package.json")'
          },
          content: {
            type: 'string',
            description: 'The content to write to the file'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: ['filePath', 'content']
      },
      execute: async (params: Record<string, any>) => {
        return await this.writeFile(params);
      }
    };

    // Initialize edit file tool
    this.editFileTool = {
      name: 'edit_file',
      description: 'Edit a specific part of an existing file. Use this when the user asks you to modify, update, or change code in a file. This allows you to make targeted edits to files.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the file to edit (e.g., "src/App.tsx", "src/components/Button.tsx")'
          },
          changes: {
            type: 'string',
            description: 'Description of what changes to make (e.g., "Replace the button text", "Add a new function", "Update the import statement")'
          },
          newContent: {
            type: 'string',
            description: 'The new content to replace the old content with'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: ['filePath', 'changes', 'newContent']
      },
      execute: async (params: Record<string, any>) => {
        return await this.editFile(params);
      }
    };

    // Initialize delete file tool
    this.deleteFileTool = {
      name: 'delete_file',
      description: 'Delete a file from a project. Use this when the user asks you to remove, delete, or get rid of a file. This will permanently delete the file from the project.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'The path to the file to delete (e.g., "src/old-component.tsx", "unused-file.js")'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: ['filePath']
      },
      execute: async (params: Record<string, any>) => {
        return await this.deleteFile(params);
      }
    };

    // Initialize create directory tool
    this.createDirectoryTool = {
      name: 'create_directory',
      description: 'Create a new directory (folder) in a project. Use this when the user asks you to create a new folder or directory structure. This will create the directory and optionally add a placeholder file (like index.ts or README.md) to ensure the directory is tracked.',
      parameters: {
        type: 'object',
        properties: {
          directoryPath: {
            type: 'string',
            description: 'The path to the directory to create (e.g., "src/components/forms", "src/utils/helpers")'
          },
          addPlaceholder: {
            type: 'boolean',
            description: 'If true, creates a placeholder file (index.ts or README.md) in the directory. Default: true.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: ['directoryPath']
      },
      execute: async (params: Record<string, any>) => {
        return await this.createDirectory(params);
      }
    };

    // Initialize Git commit tool
    this.gitCommitTool = {
      name: 'git_commit',
      description: 'Commit changes to Git. Use this when the user asks you to commit, save changes to Git, or create a commit. This will stage and commit all changes (or specific files) with a commit message.',
      parameters: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The commit message describing the changes'
          },
          files: {
            type: 'array',
            description: 'Optional array of specific file paths to commit. If not provided, all changes will be committed.'
          } as any,
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: ['message']
      },
      execute: async (params: Record<string, any>) => {
        return await this.gitCommit(params);
      }
    };

    // Initialize Git branch tool
    this.gitBranchTool = {
      name: 'git_branch',
      description: 'Manage Git branches. Use this when the user asks you to create a branch, switch branches, list branches, or manage branches. You can create new branches, switch between branches, or list all branches.',
      parameters: {
        type: 'object',
        properties: {
          action: {
            type: 'string',
            enum: ['create', 'switch', 'list', 'delete'],
            description: 'The action to perform: create (create new branch), switch (switch to existing branch), list (list all branches), delete (delete a branch)'
          },
          branchName: {
            type: 'string',
            description: 'The name of the branch (required for create, switch, delete actions)'
          },
          fromBranch: {
            type: 'string',
            description: 'Optional branch to create from (for create action). Defaults to current branch.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: ['action']
      },
      execute: async (params: Record<string, any>) => {
        return await this.gitBranch(params);
      }
    };

    // Initialize Git status tool
    this.gitStatusTool = {
      name: 'git_status',
      description: 'Check Git status. Use this when the user asks about Git status, what files have changed, or what the current state of the repository is. This shows modified files, untracked files, and staged files.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.gitStatus(params);
      }
    };

    // Initialize Git diff tool
    this.gitDiffTool = {
      name: 'git_diff',
      description: 'Show Git diff (differences). Use this when the user asks to see what changed, view differences, or see the diff. This shows the actual changes in files.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional specific file path to show diff for. If not provided, shows diff for all changed files.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.gitDiff(params);
      }
    };

    // Initialize Git log tool
    this.gitLogTool = {
      name: 'git_log',
      description: 'Show Git commit history. Use this when the user asks to see commit history, view commits, or see the log. This shows recent commits with messages, authors, and dates.',
      parameters: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Number of commits to show (default: 10, max: 50)'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.gitLog(params);
      }
    };

    // Initialize analyze code tool
    this.analyzeCodeTool = {
      name: 'analyze_code',
      description: 'Analyze code for errors, warnings, and improvements. Use this when the user asks you to analyze code, check for errors, find issues, or review code quality. This performs comprehensive analysis including syntax errors, type errors, security issues, performance problems, and best practices. **When the user mentions a specific file, use read_file first to read it, then use this tool with the filePath parameter to analyze that specific file.**',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional specific file path to analyze. If the user mentioned a specific file, provide the file path here to analyze that file. If not provided, analyzes all files in the project.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.analyzeCode(params);
      }
    };

    // Initialize check types tool
    this.checkTypesTool = {
      name: 'check_types',
      description: 'Check TypeScript types in code. Use this when the user asks you to check types, verify TypeScript types, or find type errors. This performs TypeScript type checking on the project.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional specific file path to check. If not provided, checks all TypeScript files in the project.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.checkTypes(params);
      }
    };

    // Initialize find errors tool
    this.findErrorsTool = {
      name: 'find_errors',
      description: 'Find errors in code. Use this when the user asks you to find errors, check for bugs, or identify problems. This focuses specifically on finding errors (not warnings or suggestions).',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional specific file path to check. If not provided, checks all files in the project.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.findErrors(params);
      }
    };

    // Initialize suggest improvements tool
    this.suggestImprovementsTool = {
      name: 'suggest_improvements',
      description: 'Suggest code improvements and refactoring opportunities, including performance improvements, code quality enhancements, and best practices. Use this when the user asks for suggestions, improvements, refactoring ideas, code quality recommendations, or performance improvements (e.g., "ge mig performance förbättringar"). **When the user mentions a specific file, use read_file first to read it, then use this tool with the filePath parameter to get targeted improvements for that file.** This provides actionable suggestions for making code better.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional specific file path to analyze. If the user mentioned a specific file, provide the file path here to get targeted improvements for that file. If not provided, analyzes all files in the project.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.suggestImprovements(params);
      }
    };

    // Initialize generate tests tool
    this.generateTestsTool = {
      name: 'generate_tests',
      description: 'Generate tests for code. Use this when the user asks you to create tests, write tests, or generate test files. This will create unit, integration, or E2E tests depending on the test type specified.',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional specific file path to generate tests for. If not provided, generates tests for all files in the project.'
          },
          testType: {
            type: 'string',
            enum: ['unit', 'integration', 'e2e'],
            description: 'Type of tests to generate: unit (individual functions/components), integration (component interactions), or e2e (end-to-end user flows). Default: unit.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.generateTests(params);
      }
    };

    // Initialize run tests tool
    this.runTestsTool = {
      name: 'run_tests',
      description: 'Run tests in a project. Use this when the user asks you to run tests, execute tests, or check if tests pass. This will execute the test suite and return results.',
      parameters: {
        type: 'object',
        properties: {
          testPath: {
            type: 'string',
            description: 'Optional specific test file path to run. If not provided, runs all tests.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.runTests(params);
      }
    };

    // Initialize test coverage tool
    this.testCoverageTool = {
      name: 'test_coverage',
      description: 'Get test coverage report. Use this when the user asks about test coverage, coverage percentage, or wants to see how much of the code is tested.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.getTestCoverage(params);
      }
    };

    // Initialize generate docs tool
    this.generateDocsTool = {
      name: 'generate_docs',
      description: 'Generate documentation for code. Use this when the user asks you to create documentation, write README, generate API docs, or document code. This will create comprehensive documentation including README, code comments, and API documentation.',
      parameters: {
        type: 'object',
        properties: {
          docType: {
            type: 'string',
            enum: ['readme', 'api', 'code-comments', 'all'],
            description: 'Type of documentation to generate: readme (README.md), api (API documentation), code-comments (JSDoc comments), or all (everything). Default: all.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.generateDocs(params);
      }
    };

    // Initialize remember fact tool
    this.rememberFactTool = {
      name: 'remember_fact',
      description: 'Remember a fact about the user or their preferences. Use this when the user tells you something important to remember, like preferences, facts about themselves, or information you should recall in future conversations.',
      parameters: {
        type: 'object',
        properties: {
          fact: {
            type: 'string',
            description: 'The fact or information to remember (e.g., "User prefers dark mode", "User\'s favorite programming language is TypeScript")'
          },
          category: {
            type: 'string',
            description: 'Optional category for the fact (e.g., "preferences", "skills", "projects", "personal")'
          }
        },
        required: ['fact']
      },
      execute: async (params: Record<string, any>) => {
        return await this.rememberFact(params);
      }
    };

    // Initialize recall memory tool
    this.recallMemoryTool = {
      name: 'recall_memory',
      description: 'Recall remembered facts about the user. Use this when you need to remember something about the user, their preferences, or past conversations.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to recall (e.g., "user preferences", "favorite language", "previous projects")'
          },
          category: {
            type: 'string',
            description: 'Optional category to filter by (e.g., "preferences", "skills", "projects")'
          }
        },
        required: ['query']
      },
      execute: async (params: Record<string, any>) => {
        return await this.recallMemory(params);
      }
    };

    // Initialize process image tool
    this.processImageTool = {
      name: 'process_image',
      description: 'Process and optimize images. Use this when the user asks you to resize, crop, optimize, or process images. This can resize images, optimize file size, or extract text from images (OCR).',
      parameters: {
        type: 'object',
        properties: {
          imagePath: {
            type: 'string',
            description: 'Path to the image file to process'
          },
          operation: {
            type: 'string',
            enum: ['resize', 'crop', 'optimize', 'extract-text'],
            description: 'Operation to perform: resize (change dimensions), crop (crop image), optimize (reduce file size), extract-text (OCR to extract text)'
          },
          width: {
            type: 'number',
            description: 'Target width for resize operation (optional)'
          },
          height: {
            type: 'number',
            description: 'Target height for resize operation (optional)'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: ['imagePath', 'operation']
      },
      execute: async (params: Record<string, any>) => {
        return await this.processImage(params);
      }
    };

    // Initialize detect language tool
    this.detectLanguageTool = {
      name: 'detect_language',
      description: 'Detect programming language or framework of a project. Use this when the user asks what language a project uses, or when you need to identify the project type.',
      parameters: {
        type: 'object',
        properties: {
          projectId: {
            type: 'string',
            description: 'Optional project ID. If not provided, will use the currently selected project from the conversation.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.detectLanguage(params);
      }
    };

    // Initialize track error tool
    this.trackErrorTool = {
      name: 'track_error',
      description: 'Track and log an error for monitoring. Use this when errors occur or when the user reports bugs. This helps track error patterns and improve the system.',
      parameters: {
        type: 'object',
        properties: {
          error: {
            type: 'string',
            description: 'Error message or description'
          },
          file: {
            type: 'string',
            description: 'Optional file path where error occurred'
          },
          severity: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Error severity level. Default: medium.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID where error occurred'
          }
        },
        required: ['error']
      },
      execute: async (params: Record<string, any>) => {
        return await this.trackError(params);
      }
    };

    // Initialize get usage stats tool
    this.getUsageStatsTool = {
      name: 'get_usage_stats',
      description: 'Get usage statistics and analytics. Use this when the user asks about statistics, usage data, project counts, or analytics. This shows project statistics, deployment counts, and usage patterns.',
      parameters: {
        type: 'object',
        properties: {
          period: {
            type: 'string',
            enum: ['day', 'week', 'month', 'all'],
            description: 'Time period for statistics: day (last 24 hours), week (last 7 days), month (last 30 days), all (all time). Default: all.'
          },
          projectId: {
            type: 'string',
            description: 'Optional project ID to get stats for specific project. If not provided, returns overall stats.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.getUsageStats(params);
      }
    };

    // Initialize data insights tool
    this.getDataInsightsTool = {
      name: 'get_data_insights',
      description: 'Get comprehensive data insights and analytics about AI agent performance, code generation patterns, project activity, and interesting correlations. Use this when the user asks about data insights, analytics, patterns in their data, agent performance, productivity patterns, or wants to discuss data analysis. This provides detailed insights including agent success rates, time patterns, project activity trends, collaboration statistics, and automatically generated hypotheses.',
      parameters: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['overview', 'hypotheses'],
            description: 'Type of insights to retrieve: overview (comprehensive insights with all data), hypotheses (only AI-generated hypotheses based on data patterns). Default: overview.'
          }
        },
        required: []
      },
      execute: async (params: Record<string, any>) => {
        return await this.getDataInsights(params);
      }
    };

    // Initialize browser-use tool for browser automation
    this.browserUseTool = {
      name: 'browser_use',
      description: 'Automate web browser interactions using AI. Use this when the user asks you to interact with websites, fill forms, create accounts, click buttons, navigate pages, or perform any web automation tasks. This tool can navigate to URLs, fill in forms, click buttons, extract information, and perform complex web interactions based on natural language instructions. Examples: "create an account on retrotales.online", "fill in the registration form", "click the login button", "navigate to the signup page".',
      parameters: {
        type: 'object',
        properties: {
          url: {
            type: 'string',
            description: 'The URL of the website to interact with (e.g., "https://retrotales.online", "https://example.com/register")'
          },
          task: {
            type: 'string',
            description: 'Natural language description of what to do on the website (e.g., "create an account with email test@example.com and password mypass123", "fill in the registration form", "click the sign up button", "navigate to the login page and fill in credentials")'
          },
          headless: {
            type: 'boolean',
            description: 'Whether to run the browser in headless mode (default: true). Set to false to see the browser window (useful for debugging).'
          },
          timeout: {
            type: 'number',
            description: 'Timeout in milliseconds (default: 60000 = 60 seconds). Increase for complex tasks.'
          },
          screenshot: {
            type: 'boolean',
            description: 'Whether to take a screenshot after completing the task (default: false)'
          }
        },
        required: ['url', 'task']
      },
      execute: async (params: Record<string, any>) => {
        return await this.useBrowser(params);
      }
    };
  }

  /**
   * Perform web search using Google Custom Search API (primary) with DuckDuckGo fallback
   */
  private async performWebSearch(params: Record<string, any>): Promise<any> {
    const query = params.query as string;
    const num_results = params.num_results as string | undefined;
    try {
      const numResults = parseInt(num_results || '3', 10);
      logger.info(`Performing web search: query="${query}", numResults=${numResults}`);

      const results = [];
      let searchSource = 'Unknown';

      // Try Google Custom Search API first (if configured)
      const googleApiKey = process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
      const googleEngineId = process.env.GOOGLE_CUSTOM_SEARCH_ENGINE_ID;

      if (googleApiKey && googleEngineId) {
        try {
          logger.info(`Using Google Custom Search API for query: "${query}"`);
          
          const googleResponse = await axios.get('https://www.googleapis.com/customsearch/v1', {
            params: {
              key: googleApiKey,
              cx: googleEngineId,
              q: query,
              num: Math.min(numResults, 10) // Google allows max 10 results per request
            },
            timeout: 5000
          });

          if (googleResponse.data && (googleResponse.data as any).items && Array.isArray((googleResponse.data as any).items)) {
            for (const item of (googleResponse.data as any).items.slice(0, numResults)) {
              results.push({
                title: item.title || '',
                snippet: item.snippet || '',
                url: item.link || '',
                source: 'Google'
              });
            }
            searchSource = 'Google';
            logger.info(`Google Custom Search completed: found ${results.length} results`);
          }
        } catch (googleError) {
          const errorMsg = googleError instanceof Error ? googleError.message : String(googleError);
          logger.warn(`Google Custom Search failed: ${errorMsg}, falling back to DuckDuckGo`);
        }
      } else {
        logger.info(`Google Custom Search API not configured, using DuckDuckGo fallback`);
      }

      // Fallback to DuckDuckGo if Google didn't return results
      if (results.length === 0) {
        try {
          logger.info(`Using DuckDuckGo Instant Answer API for query: "${query}"`);
          
          // Simplify query for better results - remove extra keywords that might confuse the API
          const simplifiedQuery = query
            .replace(/\s+(adress|address|telefonnummer|phone|kontakt|contact|öppettider|hours)/gi, '')
            .trim();
          
          const ddgResponse = await axios.get('https://api.duckduckgo.com/', {
            params: {
              q: simplifiedQuery || query,
              format: 'json',
              no_html: 1,
              skip_disambig: 1
            },
            headers: {
              'User-Agent': 'Elon-AI-Assistant/1.0 (https://ai-library.com; contact@ai-library.com)',
              'Accept': 'application/json'
            },
            timeout: 5000
          });

          const ddgData = ddgResponse.data as any;

          // Add main abstract if available
          if (ddgData.Abstract) {
            results.push({
              title: ddgData.Heading || query,
              snippet: ddgData.Abstract,
              url: ddgData.AbstractURL,
              source: 'DuckDuckGo'
            });
          }

          // Add related topics
          if (ddgData.RelatedTopics && Array.isArray(ddgData.RelatedTopics)) {
            for (const topic of ddgData.RelatedTopics.slice(0, numResults - results.length)) {
              if (topic.Text && topic.FirstURL) {
                results.push({
                  title: topic.Text.split(' - ')[0],
                  snippet: topic.Text,
                  url: topic.FirstURL,
                  source: 'DuckDuckGo'
                });
              }
            }
          }
          
          searchSource = 'DuckDuckGo';
          logger.info(`DuckDuckGo search completed: found ${results.length} results`);
        } catch (ddgError) {
          const errorMsg = ddgError instanceof Error ? ddgError.message : String(ddgError);
          logger.warn(`DuckDuckGo fallback also failed: ${errorMsg}`);
        }
      }

      logger.info(`Web search completed: query="${query}", resultsFound=${results.length}, source=${searchSource}`);

      return {
        query: query,
        results: results.slice(0, numResults),
        timestamp: new Date().toISOString(),
        success: true,
        source: searchSource,
        message: results.length > 0 
          ? `Found ${results.length} result(s) for "${query}" using ${searchSource}` 
          : `No specific results found for "${query}". Consider refining the search query.`
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'UNKNOWN';
      const errorStatus = error && typeof error === 'object' && 'response' in error && error.response && typeof error.response === 'object' && 'status' in error.response ? String(error.response.status) : 'N/A';
      
      logger.error(`Web search failed: query="${query}", error="${errorMessage}", code="${errorCode}", status="${errorStatus}"`, error as Error);
      
      // Return structured error that Elon can use to inform the user
      return {
        query: query,
        results: [],
        success: false,
        error: {
          message: errorMessage,
          code: errorCode,
          status: errorStatus,
          timestamp: new Date().toISOString()
        },
        errorLog: `[ERROR] Web search tool failed\nQuery: "${query}"\nError: ${errorMessage}\nCode: ${errorCode}\nStatus: ${errorStatus}\nTimestamp: ${new Date().toISOString()}\n\nPlease send this error log to the administrator for troubleshooting.`
        // No hardcoded message - let the AI generate a natural response based on the errorLog
      };
    }
  }

  /**
   * Register additional tools for a specific user
   * This allows external systems (like orchestrator) to add capabilities
   */
  public registerToolsForUser(userId: string, tools: Tool[]): void {
    this.additionalTools.set(userId, tools);
    logger.info(`Additional tools registered for user: ${userId}, toolCount: ${tools.length}`);
  }

  /**
   * Clear additional tools for a user
   */
  public clearToolsForUser(userId: string): void {
    this.additionalTools.delete(userId);
    logger.info(`Additional tools cleared for user: ${userId}`);
  }

  /**
   * Process a natural language request from the user
   *
   * The agent will:
   * 1. Understand the user's intent
   * 2. Query relevant knowledge from plugins
   * 3. Use available tools to execute actions
   * 4. Provide a natural language response
   */
  public async processRequest(
    userId: string,
    userMessage: string,
    options?: {
      sessionId?: string;
      includeContext?: boolean;
      maxContextItems?: number;
      playgroundContext?: {
        currentProject?: string;
        projectId?: string;
        filesCount?: number;
        filePaths?: string[];
        hasLivePreview?: boolean;
        currentComponent?: string;
        recentErrors?: string[];
        isGenerating?: boolean;
        orchestrationSteps?: number;
        currentStep?: string;
      };
      discordContext?: {
        isPublicChannel?: boolean;
        isPrivateDM?: boolean;
        channelId?: string;
        channelName?: string;
        serverId?: string;
        serverName?: string;
        discordUserId?: string;
        discordUsername?: string;
      };
    }
  ): Promise<{
    response: string;
    toolsUsed: string[];
    contextUsed: KnowledgeItem[];
    suggestions?: string[];
  }> {
    const sessionId = options?.sessionId || userId;

    try {
      const source = options?.discordContext 
        ? `Discord (${options.discordContext.isPrivateDM ? 'DM' : `channel: ${options.discordContext.channelName}`})`
        : 'Web Platform';
      logger.info(`Processing personal assistant request: userId=${userId}, source=${source}, sessionId=${sessionId}, messageLength=${userMessage.length}, hasPlaygroundContext=${!!options?.playgroundContext}`);

      // Get conversation history - load from DB if not in memory
      let history = this.conversationHistory.get(sessionId);
      if (!history) {
        history = await this.loadConversationHistory(userId, sessionId);
        this.conversationHistory.set(sessionId, history);
      }
      
      // Load long-term memories for context
      const memories = await this.loadUserMemories(userId);

      // Gather context from all enabled plugins
      const maxContextItems = options?.maxContextItems || 10;
      const context = options?.includeContext !== false
        ? await this.gatherContext(userId, userMessage, maxContextItems)
        : [];

      // Get available tools from all enabled plugins
      const pluginTools = await pluginRegistry.getAvailableTools(userId);

      // Add any additional tools registered for this user (e.g., from orchestrator bridge)
      const additionalToolsForUser = this.additionalTools.get(userId) || [];
      
      // Include built-in tools (web search, Discord, code generation, project management, and deployment)
      const builtInTools = [
        this.webSearchTool,
        // Browser automation tool
        {
          ...this.browserUseTool,
          execute: async (params: Record<string, any>) => {
            return await this.useBrowser({ ...params, _userId: userId, _sessionId: sessionId });
          }
        },
        // Wrap Discord tools to automatically include discordContext
        {
          ...this.discordTool,
          execute: async (params: Record<string, any>) => {
            // Automatically add discordContext if available and no channelId/channelName provided
            if (options?.discordContext && !params.channelId && !params.channelName) {
              params.channelId = options.discordContext.channelId;
              params.channelName = options.discordContext.channelName;
              params.serverName = options.discordContext.serverName;
            }
            return await this.sendDiscordMessage(params);
          }
        },
        {
          ...this.readDiscordMessagesTool,
          execute: async (params: Record<string, any>) => {
            // Automatically add discordContext if available and no channelId/channelName provided
            if (options?.discordContext && !params.channelId && !params.channelName) {
              params.channelId = options.discordContext.channelId;
              params.channelName = options.discordContext.channelName;
            }
            return await this.readDiscordMessages(params);
          }
        },
        // Project management tools (always available)
        {
          ...this.listProjectsTool,
          execute: async (params: Record<string, any>) => {
            return await this.listProjects({ ...params, _userId: userId, _sessionId: sessionId });
          }
        },
        {
          ...this.selectProjectTool,
          execute: async (params: Record<string, any>) => {
            return await this.selectProject({ ...params, _userId: userId, _sessionId: sessionId });
          }
        }
      ];
      
      // Add code generation tool if we have playground context or a selected project
      const hasProjectContext = options?.playgroundContext?.projectId || this.selectedProjects.has(sessionId);
      if (hasProjectContext) {
        // Create a bound version of generateCodeTool with userId
        const generateCodeToolWithUserId = {
          ...this.generateCodeTool,
          execute: async (params: Record<string, any>) => {
            // Pass userId and sessionId to generateCode
            return await this.generateCode({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(generateCodeToolWithUserId);
        
        // Add deployment tool if we have a project
        const deployToolWithUserId = {
          ...this.deployToVercelTool,
          execute: async (params: Record<string, any>) => {
            return await this.deployToVercel({ ...params, _userId: userId, _sessionId: sessionId, _discordContext: options?.discordContext });
          }
        };
        builtInTools.push(deployToolWithUserId);

        // Add file operation tools if we have a project
        const writeFileToolWithUserId = {
          ...this.writeFileTool,
          execute: async (params: Record<string, any>) => {
            return await this.writeFile({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(writeFileToolWithUserId);

        const editFileToolWithUserId = {
          ...this.editFileTool,
          execute: async (params: Record<string, any>) => {
            return await this.editFile({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(editFileToolWithUserId);

        const deleteFileToolWithUserId = {
          ...this.deleteFileTool,
          execute: async (params: Record<string, any>) => {
            return await this.deleteFile({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(deleteFileToolWithUserId);

        const createDirectoryToolWithUserId = {
          ...this.createDirectoryTool,
          execute: async (params: Record<string, any>) => {
            return await this.createDirectory({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(createDirectoryToolWithUserId);

        // Add Git operation tools if we have a project
        const gitCommitToolWithUserId = {
          ...this.gitCommitTool,
          execute: async (params: Record<string, any>) => {
            return await this.gitCommit({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(gitCommitToolWithUserId);

        const gitBranchToolWithUserId = {
          ...this.gitBranchTool,
          execute: async (params: Record<string, any>) => {
            return await this.gitBranch({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(gitBranchToolWithUserId);

        const gitStatusToolWithUserId = {
          ...this.gitStatusTool,
          execute: async (params: Record<string, any>) => {
            return await this.gitStatus({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(gitStatusToolWithUserId);

        const gitDiffToolWithUserId = {
          ...this.gitDiffTool,
          execute: async (params: Record<string, any>) => {
            return await this.gitDiff({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(gitDiffToolWithUserId);

        const gitLogToolWithUserId = {
          ...this.gitLogTool,
          execute: async (params: Record<string, any>) => {
            return await this.gitLog({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(gitLogToolWithUserId);

        // Add code analysis tools if we have a project
        const analyzeCodeToolWithUserId = {
          ...this.analyzeCodeTool,
          execute: async (params: Record<string, any>) => {
            return await this.analyzeCode({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(analyzeCodeToolWithUserId);

        const checkTypesToolWithUserId = {
          ...this.checkTypesTool,
          execute: async (params: Record<string, any>) => {
            return await this.checkTypes({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(checkTypesToolWithUserId);

        const findErrorsToolWithUserId = {
          ...this.findErrorsTool,
          execute: async (params: Record<string, any>) => {
            return await this.findErrors({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(findErrorsToolWithUserId);

        const suggestImprovementsToolWithUserId = {
          ...this.suggestImprovementsTool,
          execute: async (params: Record<string, any>) => {
            return await this.suggestImprovements({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(suggestImprovementsToolWithUserId);

        // Add test tools if we have a project
        const generateTestsToolWithUserId = {
          ...this.generateTestsTool,
          execute: async (params: Record<string, any>) => {
            return await this.generateTests({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(generateTestsToolWithUserId);

        const runTestsToolWithUserId = {
          ...this.runTestsTool,
          execute: async (params: Record<string, any>) => {
            return await this.runTests({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(runTestsToolWithUserId);

        const testCoverageToolWithUserId = {
          ...this.testCoverageTool,
          execute: async (params: Record<string, any>) => {
            return await this.getTestCoverage({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(testCoverageToolWithUserId);

        // Add documentation tool if we have a project
        const generateDocsToolWithUserId = {
          ...this.generateDocsTool,
          execute: async (params: Record<string, any>) => {
            return await this.generateDocs({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(generateDocsToolWithUserId);

        // Add memory tools (always available)
        const rememberFactToolWithUserId = {
          ...this.rememberFactTool,
          execute: async (params: Record<string, any>) => {
            return await this.rememberFact({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(rememberFactToolWithUserId);

        const recallMemoryToolWithUserId = {
          ...this.recallMemoryTool,
          execute: async (params: Record<string, any>) => {
            return await this.recallMemory({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(recallMemoryToolWithUserId);

        // Add image processing tool if we have a project
        const processImageToolWithUserId = {
          ...this.processImageTool,
          execute: async (params: Record<string, any>) => {
            return await this.processImage({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(processImageToolWithUserId);

        // Add language detection tool if we have a project
        const detectLanguageToolWithUserId = {
          ...this.detectLanguageTool,
          execute: async (params: Record<string, any>) => {
            return await this.detectLanguage({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(detectLanguageToolWithUserId);

        // Add error tracking tool (always available)
        const trackErrorToolWithUserId = {
          ...this.trackErrorTool,
          execute: async (params: Record<string, any>) => {
            return await this.trackError({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(trackErrorToolWithUserId);

        // Add analytics tool (always available)
        const getUsageStatsToolWithUserId = {
          ...this.getUsageStatsTool,
          execute: async (params: Record<string, any>) => {
            return await this.getUsageStats({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(getUsageStatsToolWithUserId);

        const getDataInsightsToolWithUserId = {
          ...this.getDataInsightsTool,
          execute: async (params: Record<string, any>) => {
            return await this.getDataInsights({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(getDataInsightsToolWithUserId);
      }

      // Add memory, error tracking, and analytics tools even without project context
      if (!hasProjectContext) {
        const rememberFactToolWithUserId = {
          ...this.rememberFactTool,
          execute: async (params: Record<string, any>) => {
            return await this.rememberFact({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(rememberFactToolWithUserId);

        const recallMemoryToolWithUserId = {
          ...this.recallMemoryTool,
          execute: async (params: Record<string, any>) => {
            return await this.recallMemory({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(recallMemoryToolWithUserId);

        const trackErrorToolWithUserId = {
          ...this.trackErrorTool,
          execute: async (params: Record<string, any>) => {
            return await this.trackError({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(trackErrorToolWithUserId);

        const getUsageStatsToolWithUserId = {
          ...this.getUsageStatsTool,
          execute: async (params: Record<string, any>) => {
            return await this.getUsageStats({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(getUsageStatsToolWithUserId);

        const getDataInsightsToolWithUserId = {
          ...this.getDataInsightsTool,
          execute: async (params: Record<string, any>) => {
            return await this.getDataInsights({ ...params, _userId: userId, _sessionId: sessionId });
          }
        };
        builtInTools.push(getDataInsightsToolWithUserId);
      }
      // Filter out any invalid tools before combining
      const validBuiltInTools = builtInTools.filter(t => t && t.name && typeof t.name === 'string' && t.name.trim().length > 0);
      const validPluginTools = pluginTools.filter(t => t && t.name && typeof t.name === 'string' && t.name.trim().length > 0);
      const validAdditionalTools = (additionalToolsForUser || []).filter(t => t && t.name && typeof t.name === 'string' && t.name.trim().length > 0);
      
      const tools = [...validBuiltInTools, ...validPluginTools, ...validAdditionalTools];

      if (builtInTools.length !== validBuiltInTools.length || pluginTools.length !== validPluginTools.length || (additionalToolsForUser?.length || 0) !== validAdditionalTools.length) {
        logger.warn(`Filtered out invalid tools: builtInTools=${builtInTools.length - validBuiltInTools.length}, pluginTools=${pluginTools.length - validPluginTools.length}, additionalTools=${(additionalToolsForUser?.length || 0) - validAdditionalTools.length}`);
      }

      logger.info(`Tools available for PersonalAssistantAgent: userId=${userId}, totalTools=${tools.length}, pluginToolsCount=${validPluginTools.length}, toolNames=${tools.map(t => t.name).join(', ')}`);

      // Build system prompt with error handling
      let systemPrompt: string;
      try {
        systemPrompt = this.buildSystemPrompt(context, tools, options?.playgroundContext, options?.discordContext, memories);
      } catch (error) {
        logger.error(`Failed to build system prompt: ${error instanceof Error ? error.message : String(error)} (userId: ${userId}, toolCount: ${tools.length}, contextCount: ${context.length})`, error as Error);
        // Use a minimal fallback prompt
        systemPrompt = `You are Elon, a helpful AI assistant. You have access to ${tools.length} tools. Help the user with their request.`;
      }

      // CRITICAL: Pre-check user message for action requests that REQUIRE tools
      // This forces the AI to actually use tools instead of just claiming actions
      const actionRequiresTool = this.detectActionRequiringTool(userMessage);
      let toolEnforcementMessage = '';
      
      if (actionRequiresTool) {
        const availableTool = tools.find(t => t.name === actionRequiresTool.toolName);
        if (availableTool) {
          toolEnforcementMessage = `\n\n⚠️ CRITICAL INSTRUCTION: The user is asking you to ${actionRequiresTool.actionDescription}. You MUST use the ${actionRequiresTool.toolName} tool to actually perform this action. DO NOT just say you did it - you MUST call the tool. If you don't call the tool, you are LYING to the user.`;
          logger.info(`Action detected requiring tool: ${actionRequiresTool.toolName} for userId=${userId}`);
        } else {
          logger.warn(`Action requires tool ${actionRequiresTool.toolName} but tool not available for userId=${userId}`);
        }
      }

      // Build user message with context
      const enhancedMessage = this.buildEnhancedMessage(userMessage, context, options?.playgroundContext) + toolEnforcementMessage;

      // Convert tools to Anthropic format with error handling
      let anthropicTools: Anthropic.Tool[] = [];
      try {
        anthropicTools = this.convertToolsToAnthropicFormat(tools);
      } catch (error) {
        logger.error(`Failed to convert tools to Anthropic format: ${error instanceof Error ? error.message : String(error)} (userId: ${userId}, toolCount: ${tools.length})`, error as Error);
        // Continue with empty tools array rather than failing completely
        anthropicTools = [];
      }

      // Call Claude with tools (increased token limit for more detailed responses)
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
        tools: anthropicTools
      });

      // Process tool calls recursively - handle multiple sequential tool calls
      const toolsUsed: string[] = [];
      let finalResponse = '';
      let currentResponse = response;
      let conversationMessages: Anthropic.MessageParam[] = [
        ...history,
        {
          role: 'user',
          content: enhancedMessage
        }
      ];
      const maxToolIterations = 5; // Prevent infinite loops
      let toolIteration = 0;

      // Loop until no more tool calls are needed
      while (toolIteration < maxToolIterations) {
        const toolCalls: Anthropic.ToolUseBlock[] = [];
        let textContent = '';

        // Collect all tool calls and text from current response
        for (const content of currentResponse.content) {
          if (content.type === 'text') {
            textContent += content.text;
          } else if (content.type === 'tool_use') {
            toolCalls.push(content);
          }
        }

        // Add assistant response to conversation
        conversationMessages.push({
          role: 'assistant',
          content: currentResponse.content
        });

        // If no tool calls, we're done
        if (toolCalls.length === 0) {
          finalResponse += textContent;
          break;
        }

        // Process all tool calls in parallel
        const toolResults: Anthropic.ToolResultBlockParam[] = [];
        for (const toolCall of toolCalls) {
          try {
            logger.info(`Executing tool: userId=${userId}, toolName=${toolCall.name}, toolId=${toolCall.id}, iteration=${toolIteration + 1}`);

            const tool = tools.find(t => t.name === toolCall.name);
            if (!tool) {
              // Tool not found - return error result
              toolResults.push({
                type: 'tool_result',
                tool_use_id: toolCall.id,
                content: JSON.stringify({
                  error: `Tool '${toolCall.name}' not found`,
                  errorLog: `The requested tool '${toolCall.name}' is not available. Available tools: ${tools.map(t => t.name).join(', ')}`
                }, null, 2)
              });
              continue;
            }

            const result = await tool.execute(toolCall.input as Record<string, any>);
            toolsUsed.push(toolCall.name);

            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
            });
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            logger.error(`Tool execution failed: userId=${userId}, toolName=${toolCall.name}, errorMessage=${errorMessage}, toolInput=${JSON.stringify(toolCall.input)}`, error as Error);
            
            // Always return a tool_result, even on error, so the AI can handle it
            toolResults.push({
              type: 'tool_result',
              tool_use_id: toolCall.id,
              content: JSON.stringify({
                error: errorMessage,
                errorLog: `Failed to execute tool '${toolCall.name}': ${errorMessage}. The tool encountered an error during execution.`
              }, null, 2)
            });
          }
        }

        // Add tool results to conversation
        if (toolResults.length > 0) {
          conversationMessages.push({
            role: 'user',
            content: toolResults
          });
        }

        // Convert tools to Anthropic format with error handling (for iteration)
        let anthropicToolsIteration: Anthropic.Tool[] = [];
        try {
          anthropicToolsIteration = this.convertToolsToAnthropicFormat(tools);
        } catch (error) {
          logger.error(`Failed to convert tools to Anthropic format (iteration ${toolIteration}): ${error instanceof Error ? error.message : String(error)} (userId: ${userId}, toolCount: ${tools.length})`, error as Error);
          // Continue with empty tools array rather than failing completely
          anthropicToolsIteration = [];
        }

        // Get follow-up response (may contain more tool calls)
        currentResponse = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 8192,
          system: systemPrompt,
          messages: conversationMessages,
          tools: anthropicToolsIteration
        });

        toolIteration++;
      }

      if (toolIteration >= maxToolIterations) {
        logger.warn(`Reached max tool iterations (${maxToolIterations}) for userId=${userId}`);
      }

      // Update conversation history
      history.push(
        {
          role: 'user',
          content: userMessage
        },
        {
          role: 'assistant',
          content: finalResponse
        }
      );

      // Keep only last N messages (rolling window)
      if (history.length > MAX_MESSAGES_PER_SESSION * 2) {
        history.splice(0, history.length - MAX_MESSAGES_PER_SESSION * 2);
      }
      this.conversationHistory.set(sessionId, history);
      
      // Save to database for persistence across restarts
      await this.saveConversationMessages(userId, sessionId, userMessage, finalResponse, toolsUsed);

      // Track message count for Discord recommendations
      const messageCount = (this.userMessageCounts.get(userId) || 0) + 1;
      this.userMessageCounts.set(userId, messageCount);
      
      // Check if we should recommend Discord (every 10-15 messages, or if user mentions bugs/feedback)
      const shouldRecommendDiscord = this.shouldRecommendDiscord(
        userId, 
        userMessage, 
        messageCount
      );
      
      // Let AI naturally recommend Discord in its response instead of appending hardcoded messages
      // The system prompt now includes instructions for when and how to recommend Discord
      // We still track recommendations to avoid spamming
      let enhancedResponse = finalResponse;
      if (shouldRecommendDiscord) {
        // Check if AI already mentioned Discord in the response
        const alreadyMentionedDiscord = /discord|discord\.gg|discord community/i.test(finalResponse);
        
        if (!alreadyMentionedDiscord) {
          // If AI didn't mention Discord but we think it should, we can add a gentle reminder
          // But prefer to let AI handle it naturally in future responses
          // For now, we'll just track that we should recommend it next time
          logger.info(`Discord recommendation triggered for userId=${userId}, but AI didn't mention it in response - will be recommended naturally in future`);
        }
        
        // Update last recommendation timestamp
        this.lastDiscordRecommendation.set(userId, Date.now());
      }

      // Response is complete - no need to add hardcoded templates
      // The AI will naturally conclude conversations based on the system prompt guidance

      // Generate proactive suggestions
      const suggestions = await this.generateSuggestions(userId, context, enhancedResponse);

      // CRITICAL: Validate that AI didn't hallucinate tool usage
      // Check if response claims actions were taken but no tools were actually used
      const actionClaims = [
        { pattern: /jag har skickat|i've sent|i sent|skickade|sent the email|email.*sent/i, action: 'send_email', name: 'send email' },
        { pattern: /jag har taggat|i've tagged|i tagged|taggade|tagged.*discord/i, action: 'send_discord_message', name: 'tag in Discord' },
        { pattern: /jag har kollat|i've checked|i checked|kollade|checked.*email/i, action: 'search_emails', name: 'check emails' },
        { pattern: /jag har schemalagt|i've scheduled|i scheduled|schemalade|scheduled.*email/i, action: 'schedule_email', name: 'schedule email' },
        { pattern: /jag har postat|i've posted|i posted|postade|posted.*discord/i, action: 'send_discord_message', name: 'post in Discord' },
        { pattern: /jag har skickat.*meddelande|i've sent.*message|sent.*message.*discord/i, action: 'send_discord_message', name: 'send Discord message' }
      ];
      
      const claimedAction = actionClaims.find(claim => claim.pattern.test(enhancedResponse));
      if (claimedAction && toolsUsed.length === 0) {
        logger.error(`🚨 HALLUCINATION DETECTED: AI claimed ${claimedAction.name} but used no tools! userId=${userId}, responsePreview=${enhancedResponse.substring(0, 200)}`);
        
        // CRITICAL: Modify the response to be honest about the failure
        // Replace false claims with honest statements
        const userLanguage = /jag|skickat|taggade|kollade|schemalade|postade/i.test(enhancedResponse) ? 'swedish' : 'english';
        const originalResponse = enhancedResponse;
        
        if (userLanguage === 'swedish') {
          enhancedResponse = enhancedResponse.replace(
            /jag har (skickat|taggat|kollat|schemalagt|postat).*?[.!]/gi,
            'Jag beklagar, men jag kunde inte utföra denna åtgärd eftersom verktyget inte anropades korrekt. För att faktiskt skicka mail, behöver jag använda send_email-verktyget, men det misslyckades. Kan du försöka igen?'
          );
          // If no replacement happened, prepend a warning
          if (enhancedResponse === originalResponse) {
            enhancedResponse = `⚠️ OBS: Jag beklagar, men jag kunde inte faktiskt utföra den begärda åtgärden eftersom verktyget inte anropades. Försök igen så ska jag faktiskt använda rätt verktyg.\n\n${enhancedResponse}`;
          }
        } else {
          enhancedResponse = enhancedResponse.replace(
            /i('ve| have)? (sent|tagged|checked|scheduled|posted).*?[.!]/gi,
            'I apologize, but I was unable to actually perform this action because the tool was not called correctly. To actually send an email, I need to use the send_email tool, but it failed. Could you try again?'
          );
          // If no replacement happened, prepend a warning
          if (enhancedResponse === originalResponse) {
            enhancedResponse = `⚠️ WARNING: I apologize, but I was unable to actually perform the requested action because the tool was not called. Please try again and I will actually use the correct tool.\n\n${enhancedResponse}`;
          }
        }
      }

      logger.info(`Personal assistant request completed: userId=${userId}, toolsUsed=${toolsUsed.length}, contextItems=${context.length}`);

      return {
        response: enhancedResponse,
        toolsUsed,
        contextUsed: context,
        suggestions
      };
    } catch (error) {
      logger.error(`Failed to process personal assistant request: userId=${userId}`, error as Error);
      throw error;
    }
  }

  /**
   * Detect if user message requires a specific tool action
   * Returns tool name and description if action is detected
   */
  private detectActionRequiringTool(userMessage: string): { toolName: string; actionDescription: string } | null {
    const message = userMessage.toLowerCase();
    
    // Email sending patterns
    if (/skicka.*mail|send.*email|skicka.*email|mail.*till|email.*to|send.*mail/i.test(message)) {
      return { toolName: 'send_email', actionDescription: 'send an email' };
    }
    
    // Email checking patterns
    if (/kolla.*mail|check.*email|kolla.*email|har.*mail|have.*email|visa.*mail|show.*email|read.*email/i.test(message)) {
      return { toolName: 'search_emails', actionDescription: 'check or search emails' };
    }
    
    // Email scheduling patterns
    if (/schemalägg.*mail|schedule.*email|schemalägg.*email|planera.*mail/i.test(message)) {
      return { toolName: 'schedule_email', actionDescription: 'schedule an email' };
    }
    
    // Discord posting/tagging patterns
    if (/skicka.*discord|post.*discord|tagg.*discord|tagga.*discord|skriv.*discord|write.*discord|send.*discord/i.test(message)) {
      return { toolName: 'send_discord_message', actionDescription: 'post or send a message in Discord' };
    }
    
    // Discord reading patterns
    if (/kolla.*discord|check.*discord|läs.*discord|read.*discord|visa.*discord|show.*discord/i.test(message)) {
      return { toolName: 'read_discord_messages', actionDescription: 'read Discord messages' };
    }
    
    return null;
  }

  /**
   * Gather relevant context from all enabled plugins
   */
  private async gatherContext(
    userId: string,
    prompt: string,
    maxItems = 10
  ): Promise<KnowledgeItem[]> {
    try {
      const knowledge = await pluginRegistry.queryKnowledge(userId, prompt, {
        limit: maxItems
      });

      logger.info(`Context gathered: userId=${userId}, itemCount=${knowledge.length}`);

      return knowledge;
    } catch (error) {
      logger.error(`Failed to gather context: userId=${userId}`, error as Error);
      return [];
    }
  }

  /**
   * Build system prompt with available context and tools
   */
  private buildSystemPrompt(
    context: KnowledgeItem[], 
    tools: Tool[], 
    playgroundContext?: {
      currentProject?: string;
      projectId?: string;
      filesCount?: number;
      filePaths?: string[];
      files?: Array<{ path: string; content: string; language?: string; summary?: boolean; fullContent?: boolean }>; // Actual file contents (optimized)
      hasLivePreview?: boolean;
      currentComponent?: string;
      recentErrors?: string[];
      isGenerating?: boolean;
      orchestrationSteps?: number;
      currentStep?: string;
    },
    discordContext?: {
      isPublicChannel?: boolean;
      isPrivateDM?: boolean;
      channelId?: string;
      channelName?: string;
      serverId?: string;
      serverName?: string;
      discordUserId?: string;
      discordUsername?: string;
      repoAnalysis?: {
        owner: string;
        repo: string;
        primaryLanguage: string;
        languages: Record<string, number>;
        framework?: string;
        matchedAgents: Array<{
          id: string;
          name: string;
          matchScore: number;
          matchReasons: string[];
        }>;
      };
    },
    memories?: Array<{key: string; value: string; category: string}>
  ): string {
    // Build long-term memory section if we have memories
    const memorySection = memories && memories.length > 0 
      ? `\n**Long-term Memories (Facts I remember about this user):**\n${memories.map(m => `- ${m.category}/${m.key}: ${m.value}`).join('\n')}\n`
      : '';
    const basePrompt = `You are Elon, an enthusiastic and highly capable personal AI assistant with direct access to the user's productivity tools and the web. Think of yourself as their trusted companion who genuinely cares about helping them stay organized and productive.
${discordContext ? `
**You are currently chatting via Discord** - The user is talking to you through Discord (${discordContext.isPrivateDM ? 'private DM' : `public channel: ${discordContext.channelName || 'unknown'}`}).
- User: ${discordContext.discordUsername || 'Unknown'} (Discord ID: ${discordContext.discordUserId || 'unknown'})
- Server: ${discordContext.serverName || 'Direct Message'}
- Channel: ${discordContext.channelName || 'DM'}
${discordContext.repoAnalysis ? `
**GitHub Repository Analysis Context:**
- Repository: ${discordContext.repoAnalysis.owner}/${discordContext.repoAnalysis.repo}
- Primary Language: ${discordContext.repoAnalysis.primaryLanguage || 'Unknown'}
- Languages: ${discordContext.repoAnalysis.languages ? Object.entries(discordContext.repoAnalysis.languages).slice(0, 3).map(([lang, pct]) => `${lang} ${pct.toFixed(1)}%`).join(', ') : 'Unknown'}
${discordContext.repoAnalysis.framework ? `- Framework: ${discordContext.repoAnalysis.framework}` : ''}
${discordContext.repoAnalysis.matchedAgents && discordContext.repoAnalysis.matchedAgents.length > 0 ? `
- **Matched Specialized Agents (${discordContext.repoAnalysis.matchedAgents.length}):** ${discordContext.repoAnalysis.matchedAgents.slice(0, 3).map(a => `${a.name} (match: ${a.matchScore}%)`).join(', ')}
- These agents are being used for best results based on the repository's tech stack.
` : `
- **No Matching Agents Found**: No specialized agents were found in the database for this repository's tech stack (${discordContext.repoAnalysis.primaryLanguage || 'Unknown'}${discordContext.repoAnalysis.framework ? ` + ${discordContext.repoAnalysis.framework}` : ''}).
- **You can STILL help the user**, but for optimal results, naturally recommend creating a custom agent on the platform.
- When recommending, mention: "For best results, I'd recommend creating a custom agent on our platform (https://newai-sigma.vercel.app) that's specialized for ${discordContext.repoAnalysis.primaryLanguage || 'this technology'}${discordContext.repoAnalysis.framework ? ` and ${discordContext.repoAnalysis.framework}` : ''}. This will give you much more specialized assistance!"
- Keep the recommendation natural and helpful - don't be pushy.
`}
` : ''}
` : `
**You are currently chatting via the web platform** - The user is talking to you through the web application interface.
- This is a private conversation between you and the user
- You have full access to the user's projects, files, and context
`}
${memorySection}
Your personality:
- Warm, friendly, and conversational - like talking to a helpful colleague
- Proactive and thoughtful - anticipate needs and offer suggestions
- Detail-oriented - provide rich, actionable information rather than generic summaries
- Empathetic - understand the context and urgency of requests
- Enthusiastic about helping - show genuine excitement when you can assist

Your capabilities:
- **Discord Integration**: You have direct access to both read and post messages in the user's Discord community
  * **CRITICAL - YOU MUST USE TOOLS**: When the user asks you to post in Discord, tag someone, or read Discord messages, you MUST actually call the send_discord_message or read_discord_messages tool. DO NOT just say "I posted it" or "I tagged them" - that is a LIE if you didn't use the tool.
  * **Sending messages**: Use the send_discord_message tool when users ask you to post, share, or announce something in Discord → YOU MUST ACTUALLY CALL THIS TOOL, do not just claim you did it
    * You can specify a channel by name (e.g., "gonattis") or channel ID
    * **IMPORTANT**: If the user mentions a specific server name (e.g., "Elon server", "Extend Media server"), you MUST use the serverName parameter to find the correct server first
    * Example: If user says "skriv i Elon servern" or "post in the Elon server", use serverName: "Elon" to find that server, then search for the channel within that server
    * If no server is specified, the bot will use the default configured server
    * Example: "I'll post that update to Discord for you!" or "Let me share this in your Discord community"
    * When posting, be friendly and engaging - match the community's tone
    * You can format messages with Discord markdown (bold, italic, code blocks, etc.)
    * If the user asks "can you post in Discord?" or "post this to Discord", respond confidently that you can and do it
  * **Reading messages**: Use the read_discord_messages tool when users ask about Discord activity, want to check if someone replied, see what's happening in Discord, or read recent messages
    * You can read from a specific channel (by name or ID), multiple channels, or all channels in the server
    * ALWAYS use this tool when the user asks questions like:
      - "Has anyone replied to my message?"
      - "What's happening in Discord?"
      - "Check the gonattis channel"
      - "Read messages from Discord"
      - "What did people say in Discord?"
    * After reading, summarize the messages clearly and mention who said what
    * If no messages are found or bot is not connected, explain the situation clearly
- **Data Insights & Analytics**: Get comprehensive data insights about AI agent performance, code generation patterns, project activity, and interesting correlations
  * Use the get_data_insights tool when users ask about:
    - Data insights, analytics, or patterns in their data
    - Agent performance or which agents work best
    - Productivity patterns or when they're most productive
    - Code generation statistics or trends
    - Project activity over time
    - Collaboration statistics
    - Hypotheses or correlations in their data
  * The tool provides detailed insights including:
    - Agent success rates and performance metrics
    - Time patterns (when code is generated most)
    - Project activity trends
    - Collaboration statistics
    - Automatically generated hypotheses based on data patterns
  * Example: "What are my data insights?" or "Show me agent performance" or "When am I most productive?"
  * You can discuss the insights naturally and help users understand what the data means
- **Web Search**: Search the web for real-time information about companies, addresses, business hours, contact details, or any current information
  * Use the web_search tool when users ask for specific real-world details like "Colorama Lund address" or "contact information for [business]"
  * ALWAYS use web_search for company addresses, phone numbers, business hours, and contact information
  * Use web_search for current events, recent information, or facts you're unsure about
  * Example queries: "web_search for 'Colorama Lund address and contact information'" or "web_search for 'Tesla latest news'"
  * **CRITICAL: When web_search returns results (success=true and results array has items)**:
    - The tool result is a JSON object with a "results" array - parse it and extract the information
    - ALWAYS include the actual search results in your response - DO NOT just say "I searched" or "let me search"
    - The tool result format is: { success: true, results: [{ title, snippet, url, source }], ... }
    - The tool_result content will be a JSON string - parse it to access the results array
    - STEP 1: Parse the JSON string from tool_result.content to get the result object
    - STEP 2: Access the "results" array from the parsed object
    - STEP 3: Extract and display the information from each result in the results array:
      * Each result has: title, snippet (contains the actual information like address, phone, hours), url, source
    - For business information queries: extract addresses, phone numbers, hours, contact details from the snippets
    - Format the information clearly and make it actionable - show the user the actual data found
    - Example format (Swedish): "Här är informationen jag hittade om Colorama Lund:\n\n📍 Adress: [extrakt från snippet]\n📞 Telefon: [extrakt från snippet]\n🕐 Öppettider: [extrakt från snippet]\n\nKälla: [url från results]"
    - Example format (English): "Here's the information I found for Colorama Lund:\n\n📍 Address: [extracted from snippet]\n📞 Phone: [extracted from snippet]\n🕐 Hours: [extracted from snippet]\n\nSource: [url from results]"
    - If multiple results are returned, review all of them and extract the most relevant information
    - DO NOT just acknowledge the search - you MUST display the actual information found in the results
    - DO NOT say "let me search more" if you already have results - use what you found
    - Match the user's language - if they ask in Swedish, respond in Swedish with the data
  * **CRITICAL: If web_search tool fails or returns success=false**:
    - DO NOT guess or make up information
    - DO NOT provide potentially incorrect details
    - Clearly state: "I'm unable to search the web for this information right now because the web search tool encountered an error."
    - Include the errorLog field from the tool response in your message so the user can send it to the administrator
    - Example: "I'm sorry, but I cannot search the web for this information at the moment. Here's the error log you can send to the administrator:\\n\\n[errorLog content]"
- **Browser Automation (browser_use)**: Automate web browser interactions using AI
  * **CRITICAL - YOU MUST USE THIS TOOL**: When the user asks you to interact with websites, fill forms, create accounts, click buttons, navigate pages, or perform any web automation tasks, you MUST use the browser_use tool. DO NOT just say "I can't do that" or "I don't have access" - you HAVE this tool!
  * **Use browser_use when users ask you to**:
    - Create accounts on websites (e.g., "create an account on retrotales.online", "skapa ett konto på retrotales.online")
    - Fill in forms (registration forms, contact forms, etc.)
    - Click buttons or links
    - Navigate to specific pages
    - Extract information from websites
    - Perform any web interaction task
  * **How to use browser_use**:
    - Required parameters: url (the website URL) and task (natural language description of what to do)
    - The task parameter should be detailed and specific (e.g., "create an account with email test@example.com and password mypass123", "fill in the registration form with name John Doe, email john@example.com, and password secure123")
    - Optional parameters: headless (default: true), timeout (default: 60000ms), screenshot (default: false)
    - Example: User says "create an account on retrotales.online" - Use browser_use with url: "https://retrotales.online" and task: "navigate to the registration page and create a new account"
  * **Important notes**:
    - The tool uses AI to understand and execute natural language instructions on websites
    - It can handle complex multi-step tasks (e.g., navigate, find form, fill fields, submit)
    - If the task fails, the error message will help you understand what went wrong
    - For account creation, you may need to ask the user for required information (email, password, username, etc.) if not provided
  * **Example usage**:
    - User: "Skapa ett konto på retrotales.online åt mig" → Use browser_use(url: "https://retrotales.online", task: "create a new account on this website")
    - User: "Fill in the registration form" → Use browser_use with the current page URL and task: "fill in all required fields in the registration form"
- **Email Management (Gmail Plugin)**: Full access to Gmail when connected
  * **CRITICAL - YOU MUST USE TOOLS**: When the user asks you to send an email, check emails, or schedule an email, you MUST actually call the corresponding tool (send_email, search_emails, schedule_email). DO NOT just say "I sent it" or "I checked" - that is a LIE if you didn't use the tool.
  * Search emails using natural language: "emails from john about project" or "unread emails from last week" → USE search_emails tool
  * Send emails with subject, body, and recipients → USE send_email tool (required parameters: to, subject, body)
  * Get unread email count and summaries → USE get_unread_count or search_emails tool
  * Analyze emails for urgency, key points, and action items → USE search_emails tool first to get emails
  * Access email context automatically when relevant to user queries → USE search_emails tool
  * **CRITICAL PRIVACY RULE**: When reading emails, you MUST automatically detect and protect sensitive information
    - Sensitive emails include: government/authority communications (police, tax, social services), financial issues (loans, debt, credit problems), legal matters, medical information, gambling content, personal identification
    - If you detect sensitive emails, DO NOT share their content publicly. Instead, tell the user in their language that they have private emails containing sensitive information that should be reviewed personally in their Gmail inbox.
    - This applies to ALL languages - use your AI understanding to detect sensitive content regardless of language
    - Only show non-sensitive emails (newsletters, promotional, general work/personal emails)
  * **Email Scheduling**: You can schedule emails to be sent at a specific date and time using the schedule_email tool
    - When user asks to schedule an email, use schedule_email tool with: to, subject, body, and scheduledFor (ISO 8601 date/time string)
    - Example: "Schedule an email to john@example.com tomorrow at 2pm" → parse the date/time and use schedule_email tool
    - The email will be sent automatically at the scheduled time - you don't need to do anything else
  * Example: "Check my emails" → use search_emails tool, "Send an email to john@example.com" → use send_email tool, "Schedule an email for tomorrow" → use schedule_email tool
- **GitHub Integration (GitHub Plugin)**: Manage repositories and code when connected
  * List repositories, create new repos, manage issues and pull requests
  * Search code, view commits, and manage branches
  * **GitHub Repository Analysis (Discord)**: When users share GitHub repo URLs in Discord, the system automatically:
    - Analyzes the repository to detect languages, frameworks, and tech stack
    - Searches the agent database for matching specialized agents
    - If matching agents are found: Uses them for best results and informs the user naturally
    - If NO matching agents are found: You can STILL help, but recommend creating a custom agent for optimal results
    - **CRITICAL - Custom Agent Recommendation**: When no matching agents are found:
      * Acknowledge that you can still help with the repository
      * Naturally recommend creating a custom agent on the platform for best results
      * Provide the platform URL: https://newai-sigma.vercel.app
      * Explain that a custom agent tailored to the project's tech stack will provide better, more specialized assistance
      * Keep the recommendation natural and helpful, not pushy
      * Example (Swedish): "Jag kan definitivt hjälpa dig med detta repo! För bästa möjliga resultat rekommenderar jag att du skapar en custom agent på vår plattform som är specialiserad på [detected language] och [detected framework]. Gå till https://newai-sigma.vercel.app och skapa en agent som matchar detta projekt - då får du mycket mer specialiserad hjälp!"
      * Example (English): "I can definitely help you with this repo! For the best results, I'd recommend creating a custom agent on our platform that's specialized for [detected language] and [detected framework]. Visit https://newai-sigma.vercel.app to create an agent that matches this project - you'll get much more specialized help!"
    - Status messages are sent naturally in Discord (not spammy) - max 1 per 3 seconds
    - The repo analysis context is automatically included in your conversation context
  * **Import External Repositories**: Import existing GitHub repositories into the playground workspace
    - Use import_repository tool with owner and repo (e.g., "import github.com/user/my-python-project")
    - The system will automatically detect the language/framework and recommend appropriate agents
    - **CRITICAL**: Always inform the user about the detected language and recommended agents when importing
    - Show the warning message to the user so they know which agent to use
    - **Database Setup**: The system automatically detects if the imported project needs a database (MongoDB, PostgreSQL, MySQL)
      - If a database is needed, a .env.example file is automatically generated with database configuration
      - **ALWAYS inform the user** about database requirements and setup instructions
      - **CRITICAL - API Keys for Automatic Provisioning**: 
        - If the warning message mentions missing API keys (MONGODB_ATLAS_API_KEY, NEON_API_KEY, SUPABASE_SERVICE_ROLE_KEY, etc.), you MUST:
          1. Clearly explain that automatic database provisioning is available but requires API keys
          2. Provide direct links to where they can get these API keys:
             - MongoDB Atlas: https://www.mongodb.com/cloud/atlas/register and https://cloud.mongodb.com → API Keys
             - Neon: https://neon.tech/signup and Settings → API Keys
             - Supabase: https://supabase.com/dashboard/sign-up and Project Settings → API
          3. Explain that after API keys are configured, they can re-import the project to get automatic database setup
          4. Also provide manual setup instructions as an alternative
      - Tell them to copy .env.example to .env and configure their database connection
      - Provide clear next steps for setting up the database (local or cloud options)
      - The response from import_repository includes a "warning" field (with full instructions) and "databaseInfo" with setup instructions - **ALWAYS show both to the user**
  * Example: "List my GitHub repos" → use list_repositories tool, "Create a new repo called my-project" → use create_repository tool, "Import my Python project from GitHub" → use import_repository tool
- **Calendar Management (Google Calendar Plugin)**: Access and manage calendar events when connected
  * List upcoming events: today, tomorrow, this week, next week
  * Create new calendar events with details
  * Check availability and schedule meetings
  * Example: "What's on my calendar today?" → use list_calendar_events tool, "Schedule a meeting tomorrow at 2pm" → use create_calendar_event tool
- **Notion Integration (Notion Plugin)**: Access and manage Notion pages when connected
  * Search through Notion pages and databases
  * Create new pages with content
  * Access notes, tasks, and knowledge base
  * Example: "Search my Notion pages for project notes" → use search_notion_pages tool, "Create a new Notion page" → use create_notion_page tool
- **User-Generated Custom Plugins**: You have access to custom plugins that users have created
  * These plugins appear as tools with names like "use_<service_name>" (e.g., "use_discord", "use_slack", "use_custom_api")
  * **CRITICAL**: Always check what tools are available in the tools list - custom plugins will be included automatically
  * When you see a "use_*" tool, it means the user has a custom plugin for that service
  * Custom plugins use an "action" parameter to specify what to do (e.g., "send_message", "read_messages", "create_item")
  * The tool description will tell you what the plugin can do - read it carefully to understand available actions
  * Example: If you see "use_discord" tool, the user has a custom Discord plugin - use it when they ask about Discord
  * Example: If you see "use_slack" tool, the user has a custom Slack plugin - use it for Slack-related requests
  * **Always prioritize using custom plugins** when they're available and relevant to the user's request
  * If a user asks about a service and you see a matching "use_*" tool, use that tool instead of saying you can't do it
  * Custom plugins may have different capabilities than built-in plugins - trust the tool description
- **Contextual Awareness**: Automatically gather relevant context from all connected services
  * When user asks about emails, calendar, or tasks, query knowledge from plugins
  * Provide comprehensive summaries combining information from multiple sources
  * Use plugin knowledge to answer questions even without explicit tool calls
  * **Check available tools first** - if a custom plugin tool exists, it may provide better or more specific functionality
- **Multi-Tool Orchestration**: Execute multiple actions in sequence when needed
  * Example: "Check my emails, then create a calendar event for the important ones"
  * Chain tools together to complete complex workflows
  * You can mix built-in tools (web_search, send_discord_message) with custom plugin tools (use_*)
- **Proactive Suggestions**: Based on patterns and context from connected services
  * Suggest actions based on email content, calendar conflicts, or task deadlines
  * Remind users about important items or upcoming events
  * If you notice a user has custom plugins, suggest using them when relevant
- **Location Services**: Display interactive maps and location information
  * Show maps, find places, get directions
  * Search for businesses, restaurants, and points of interest
  * Provide location-based recommendations and information
${playgroundContext ? `
- **IMPORTANT: You are currently in the AI Code Playground** - a tool for generating and editing React applications.
- You have deep, direct access to the user's active workspace. You can:
  * Inspect and understand any file in detail (structure, logic, styling, etc.)
  * Modify specific files, functions, styles, assets—anything the user asks for
  * Add, rename, or delete files/folders
  * **START, STOP, AND RESTART THE DEV SERVER ON COMMAND** - This is a core capability you have!
  * Trigger new code generations or re-run previous prompts
  * Deploy/redeploy the project (e.g., to Vercel) when the user requests it
  * Run migrations, update configurations, manage environment variables, etc.
- You MUST treat every user request as something you are capable of executing. Your mindset: "Yes, I can do that. Let me handle it for you."
- When discussing code, always reference specific paths, functions, components, styles, or logic so the user knows you truly understand the project.
- **CRITICAL CAPABILITIES**:
  1. **Code Editing & Hotfixes**: When asked to change code, target the exact file(s) and describe the precise modifications. You can apply fixes directly via the playground's tooling—do not defer to the user unless absolutely necessary.
  2. **Dev Server Control - THIS IS YOUR PRIMARY RESPONSIBILITY**: 
     - **YOU HAVE FULL ACCESS TO START/RESTART/STOP THE DEV SERVER**
     - When the user says "starta dev servern", "start the dev server", "restart dev server", "starta servern", or any variation asking to start/restart the dev server, you MUST:
       1. Respond immediately and confidently: "Jag startar dev-servern åt dig nu!" (Swedish) or "Starting the dev server right away!" (English)
       2. Use the generate_code tool with prompt: "start the dev server" or "restart the dev server"
       3. The playground system will automatically detect this and start the dev server in the browser-based WebContainer
     - **NEVER say "I can't start the dev server" or "I don't have access to start the dev server"** - this is FALSE. You absolutely can and must do this!
     - **NEVER provide manual instructions** like "cd server" or "npm run dev" - you handle this automatically via the generate_code tool
     - The dev server startup is handled automatically by the playground system - you just need to trigger it with generate_code
  3. **Deployments**: If the user asks to deploy/redeploy/publish, use the deploy_to_vercel tool. This will create a GitHub repository and deploy the project to Vercel. Once deployment is complete, you will automatically receive the deployment URL and should share it with the user. Always inform the user when deployment starts and provide the URL when it's ready.
  4. **File Lifecycle Management**: You can upload/import assets, remove unused files, rename directories, or refactor structures. When doing so, explain what you're changing and why.
  5. **Tool/Plugin Orchestration**: You can call other agents, plugins, or tools as needed. Feel free to orchestrate multi-step flows (e.g., analyze → edit → validate → deploy).
- **DO NOT** say "I can't" or "I don't have access." If a task genuinely fails due to an upstream error, report the error clearly and propose a workaround.
- **ABSOLUTELY CRITICAL - DEV SERVER RULE**: 
  - **YOU CAN AND MUST START/RESTART/STOP THE DEV SERVER** - This is a core capability!
  - When the user asks to "starta dev servern", "start the dev server", "restart dev server", "starta preview servern", "launch dev server", or any variation:
    1. **IMMEDIATELY respond**: "Jag startar dev-servern åt dig nu!" (Swedish) or "Starting the dev server right away!" (English)
    2. **ALWAYS use the generate_code tool** with prompt: "start the dev server" or "restart the dev server"
    3. The playground system (Chap-ZPT) will automatically handle dev server startup in the browser-based WebContainer
    4. You will see status updates in the chat showing the dev server starting
  - **NEVER say "I can't start the dev server" or "I don't have access"** - this is FALSE. You absolutely can!
  - **NEVER provide manual instructions** like "cd server" or "npm run dev" - you handle this automatically
  - **NEVER say "use the terminal" or "run npm run dev yourself"** - you do this for the user via generate_code
  - The dev server is started through Chap-ZPT's playground system - you trigger it with generate_code, and Chap-ZPT handles the rest
  - **You ARE aware that you can start dev servers** - this is one of your primary responsibilities in the playground
- **ALWAYS** mirror the user's language (Swedish or English). Sound confident, conversational, and proactive.
- If prerequisites are missing (e.g., no project yet), say something like: "Jag fixar gärna det! Vi behöver bara skapa projektet först—ska jag göra det åt dig?"
- Your goal: act like a senior developer/operator who can jump into any part of the stack and make it happen.` : ''}

- **PROJECT MANAGEMENT**: You have access to project management tools:
  * **list_projects**: Use this when the user asks about their projects, what projects they can work on, or wants to see available projects. Always use this tool when the user asks "vad för projekt kan vi arbeta på" or similar questions. This will show BOTH:
    - **Platform projects**: Projects created on the platform (can be previewed in browser)
    - **GitHub repositories**: User's GitHub repos (marked with 🐙, cannot be previewed but can be worked on via API)
    - GitHub repos are shown if the user has connected their GitHub account
  * **select_project**: Use this when the user explicitly chooses a project by name or number (e.g., "Låt oss arbeta på projekt 2", "Välj Projekt X", "Jag vill jobba med iPhone 16 App", or "Välj min OpenTibia server repo"). This sets the active project for the conversation. Once a project is selected, all subsequent code generation and file operations will use that project automatically.
    - **Platform projects**: Can be previewed, edited, and deployed via the playground
    - **GitHub repos**: Cannot be previewed in browser (especially C++/Lua projects), but you can:
      * Read and analyze code files via GitHub API
      * Write new files (quest scripts, item scripts, etc.)
      * Edit existing files
      * Create commits and pull requests
      * Debug and suggest improvements
      * Help with any code-related tasks
    - When a GitHub repo is selected, inform the user that while preview isn't available, you can still help with all code-related tasks
  * **Workflow**: When a user asks about projects, first use list_projects to show available projects (both platform and GitHub). When they choose one, use select_project to set it as active. Then when they ask for code changes:
    - For platform projects: Use generate_code (which will automatically use the selected project)
    - For GitHub repos: Use read_file, write_file, or edit_file to work with files directly via GitHub API
  * **Example conversation flow**:
    - User: "Vad för projekt kan vi arbeta på idag?"
    - You: Use list_projects → "Du har dessa projekt: Projekt 1 (platform), Projekt 2 (platform), och 3 GitHub repos (OpenTibia Server 🐙, etc.). Vilket skulle du vilja arbeta på?"
    - User: "Låt oss arbeta på OpenTibia Server"
    - You: Use select_project → "Absolut! Jag har valt OpenTibia Server (C++/Lua projekt på GitHub). Även om jag inte kan previewa det i webbläsaren, kan jag hjälpa dig med att läsa/analysera kod, skriva quest scripts, item scripts, fixa buggar, och skapa commits. Vad skulle du vilja göra?"
    - User: "Skriv en ny quest script"
    - You: Use read_file to understand the quest structure, then write_file to create the new quest script → "Jag har skapat en ny quest script baserat på dina befintliga quests..."

- **FILE OPERATIONS**: You have direct access to file operations for quick edits and changes:
  * **read_file**: Read and analyze files from a project. **CRITICAL: When the user mentions a specific file (e.g., "look at xxxx.lua", "check App.tsx", "review config.json", "kolla på xxxx.lua filen"), you MUST use read_file FIRST to read that file before analyzing, suggesting improvements, or discussing it.** After reading the file, you can then use suggest_improvements, analyze_code, or provide direct analysis based on what the user asked for (e.g., "ge mig performance förbättringar" → read the file first, then analyze for performance improvements). Use this to understand existing code before making changes.
  * **write_file**: Create a new file or completely replace an existing file. Use this when the user asks you to create a new file, write content to a file, or completely rewrite a file. Example: "Create a new Button component" or "Write a utils.ts file with helper functions".
  * **edit_file**: Edit specific parts of an existing file. Use this when the user asks you to modify, change, or update specific parts of a file (e.g., "change the button color", "update the function", "modify the onClick handler"). This is perfect for targeted changes without rewriting the entire file. Example: "Change the button color to blue" → use edit_file to modify just the color property.
  * **delete_file**: Delete a file from a project. Use this when the user explicitly asks you to remove or delete a file. Always confirm with the user before deleting important files.
  * **create_directory**: Create a new directory (folder) in a project. Use this when the user asks you to create a new folder or directory structure.
  * **When to use which tool**:
    - For creating new files: use **write_file**
    - For small, targeted changes: use **edit_file** (e.g., "change the color", "update the function name")
    - For complete rewrites: use **write_file** (e.g., "rewrite the entire component")
    - For large changes that affect multiple files: use **generate_code** (it can handle complex multi-file changes)
    - For removing files: use **delete_file**
    - For creating folder structures: use **create_directory**
  * **Discussing specific files - IMPORTANT WORKFLOW**:
    - When user mentions a specific file (e.g., "kolla på xxxx.lua filen och ge mig performance förbättringar"):
      1. **FIRST**: Use **read_file** with the file path extracted from the user's message
      2. **THEN**: Based on what the user asked for:
         - For performance improvements: Use **suggest_improvements** with the filePath, or analyze the code directly focusing on performance
         - For bug fixes: Use **analyze_code** or **find_errors** with the filePath
         - For general improvements: Use **suggest_improvements** with the filePath
         - For code review: Read the file and provide detailed analysis
    - **Example**: User says "look at script.lua and give me performance improvements"
      → Step 1: read_file(filePath: "script.lua")
      → Step 2: suggest_improvements(filePath: "script.lua") OR provide direct performance-focused analysis
  * **Best practices**:
    - Always read the file first (read_file) if you're not sure about its current content before editing
    - **When user mentions a file by name, ALWAYS read it first before analyzing or discussing it**
    - Use edit_file for quick fixes and small changes - it's faster than full code generation
    - Use generate_code for complex changes that require understanding the entire project structure
    - When editing, provide clear context in the "changes" parameter about what you're modifying
    - Chain tools: read_file → suggest_improvements/analyze_code when user asks about specific files

- **GIT OPERATIONS**: You have direct access to Git version control operations:
  * **git_status**: Check the current Git status. Use this when the user asks about Git status, what files have changed, or what the current state is. Shows modified, untracked, and staged files.
  * **git_commit**: Commit changes to Git. Use this when the user asks you to commit, save changes to Git, or create a commit. Always provide a clear, descriptive commit message.
  * **git_branch**: Manage Git branches. Use this when the user asks to create a branch, switch branches, list branches, or manage branches. Actions: create (create new branch), switch (switch to existing branch), list (list all branches).
  * **git_diff**: Show Git diff (differences). Use this when the user asks to see what changed, view differences, or see the diff. Shows the actual changes in files.
  * **git_log**: Show Git commit history. Use this when the user asks to see commit history, view commits, or see the log. Shows recent commits with messages, authors, and dates.
  * **When to use Git tools**:
    - For checking what changed: use **git_status** or **git_diff**
    - For saving changes: use **git_commit** (after making file changes)
    - For branch management: use **git_branch** with appropriate action
    - For viewing history: use **git_log**
  * **Best practices**:
    - Always check git_status before committing to see what will be committed
    - Write clear, descriptive commit messages that explain what changed and why
    - Use git_diff to show users what changed before committing
    - Git operations work on the currently selected project automatically

- **TESTING**: You have access to comprehensive testing tools:
  * **generate_tests**: Generate tests for code. Use this when the user asks you to create tests, write tests, or generate test files. Supports unit, integration, and E2E tests.
  * **run_tests**: Run tests in a project. Use this when the user asks you to run tests, execute tests, or check if tests pass.
  * **test_coverage**: Get test coverage report. Use this when the user asks about test coverage or coverage percentage.
  * **Best practices**:
    - Generate tests after creating new features
    - Run tests before deploying to catch issues early
    - Aim for high test coverage (80%+)

- **DOCUMENTATION**: You have access to documentation generation tools:
  * **generate_docs**: Generate documentation for code. Use this when the user asks you to create documentation, write README, generate API docs, or document code. Supports README, API docs, code comments, or all.
  * **Best practices**:
    - Generate documentation after creating new features
    - Include setup instructions and usage examples
    - Keep documentation up to date with code changes

- **MEMORY**: You have access to long-term memory tools:
  * **remember_fact**: Remember a fact about the user or their preferences. Use this when the user tells you something important to remember.
  * **recall_memory**: Recall remembered facts about the user. Use this when you need to remember something about the user or their preferences.
  * **Best practices**:
    - Remember user preferences (e.g., "User prefers dark mode", "User's favorite language is TypeScript")
    - Remember important facts about projects or workflows
    - Recall memories when relevant to the conversation

- **IMAGE PROCESSING**: You have access to image processing tools:
  * **process_image**: Process and optimize images. Use this when the user asks you to resize, crop, optimize, or process images.
  * **Note**: Requires the "sharp" package to be installed.

- **LANGUAGE DETECTION**: You have access to language detection tools:
  * **detect_language**: Detect programming language or framework of a project. Use this when the user asks what language a project uses.

- **ERROR TRACKING**: You have access to error tracking tools:
  * **track_error**: Track and log an error for monitoring. Use this when errors occur or when the user reports bugs.

- **ANALYTICS**: You have access to analytics tools:
  * **get_usage_stats**: Get usage statistics and analytics. Use this when the user asks about statistics, usage data, or analytics.
  * **get_data_insights**: Get comprehensive data insights about AI agent performance, code generation patterns, project activity, and interesting correlations. Use this when the user asks about data insights, analytics, patterns in their data, agent performance, productivity patterns, or wants to discuss data analysis.

- **CODE ANALYSIS**: You have access to comprehensive code analysis tools:
  * **analyze_code**: Comprehensive code analysis. Use this when the user asks you to analyze code, check for errors, review code quality, or find issues. This performs full analysis including syntax errors, type errors, security issues, performance problems, and best practices. **When the user mentions a specific file, use read_file first, then use this tool with the filePath parameter.**
  * **check_types**: TypeScript type checking. Use this when the user asks you to check types, verify TypeScript types, or find type errors. This performs TypeScript type checking on the project.
  * **find_errors**: Find errors in code. Use this when the user asks you to find errors, check for bugs, or identify problems. This focuses specifically on finding errors (not warnings). **When the user mentions a specific file, use read_file first, then use this tool with the filePath parameter.**
  * **suggest_improvements**: Suggest code improvements, including performance improvements. Use this when the user asks for suggestions, improvements, refactoring ideas, code quality recommendations, or performance improvements (e.g., "ge mig performance förbättringar"). This provides actionable suggestions for making code better. **When the user mentions a specific file, use read_file first, then use this tool with the filePath parameter.**
  * **When to use which tool**:
    - For comprehensive analysis: use **analyze_code** (includes everything)
    - For type checking only: use **check_types**
    - For finding bugs: use **find_errors**
    - For refactoring suggestions or performance improvements: use **suggest_improvements**
  * **Workflow for specific files**:
    - When user mentions a specific file (e.g., "kolla på xxxx.lua filen och ge mig performance förbättringar"):
      1. **FIRST**: Use **read_file** to read the file
      2. **THEN**: Use the appropriate analysis tool (**suggest_improvements**, **analyze_code**, or **find_errors**) with the filePath parameter
  * **Best practices**:
    - **Always read files first when user mentions them by name**
    - Run analyze_code before committing to catch issues early
    - Use check_types when working with TypeScript to ensure type safety
    - Use find_errors when debugging or before deployment
    - Use suggest_improvements to help users write better code

Communication style:
- Use natural, flowing language - avoid robotic or clinical responses
- When sharing email information, include: sender, subject, key points, and why it matters
- Be specific with details - instead of "you have emails", say "you have 3 unread emails: one from John about the project deadline, one from Sarah with quarterly results..."
- Add context and personality - "I noticed this email came in just an hour ago and seems urgent" or "This looks like it might need a quick response"
- Use emojis sparingly but appropriately to add warmth (e.g., 📧 for emails, ✅ for completed tasks, 📍 for locations, 💻 for code/playground)
- If you use tools, explain what you're doing: "Let me check your inbox for you..." or "I'll search through your recent emails..."
- When you find something important, highlight it with enthusiasm: "Oh! I found something that needs attention..."

- **Discord Community Promotion**: We have an official Discord community where users can share feedback, report bugs, get tips, chat with other users, and get support. 
  * **The Discord invite link is: https://discord.gg/3kUFBmdhDA** - Always use this exact link when recommending Discord.
  * **When to recommend Discord**: Naturally mention our Discord community when:
    - User mentions bugs, errors, or problems (they can get help from the community)
    - User asks for feedback or suggestions (community can help)
    - User seems stuck or needs guidance (community support)
    - User shares something they're proud of (they can share it with the community)
    - User asks about features or improvements (community discussions)
    - Occasionally during general conversations (every 10-15 messages, but naturally - don't force it)
    - When it feels natural and helpful to the conversation
  * **How to recommend Discord**: 
    - Match the user's language (if they write in Swedish, respond in Swedish; if English, respond in English; etc.)
    - Make it feel natural and helpful, not like an advertisement
    - Integrate it naturally into your response, don't just append it
    - Be enthusiastic but not pushy
    - Examples:
      * Swedish: "Om du vill få mer tips eller dela med dig av dina projekt, så har vi en Discord-community där du kan träffa andra användare! Gå med här: https://discord.gg/3kUFBmdhDA"
      * English: "If you'd like to get more tips or share your projects, we have a Discord community where you can connect with other users! Join us here: https://discord.gg/3kUFBmdhDA"
      * Or more casual: "By the way, we have a Discord server where you can chat with other Elon users and get help - feel free to join: https://discord.gg/3kUFBmdhDA"
  * **Don't recommend Discord**:
    - If you just recommended it recently (within the last 30 minutes)
    - If the conversation is very technical or focused on a specific task
    - If it would interrupt the flow of the conversation
    - If the user is clearly in a hurry or focused on something specific
- **CRITICAL: When ANY tool fails (returns success=false or has an error)**:
  - NEVER guess, make up, or provide potentially incorrect information
  - Clearly state that you cannot complete the task because the tool failed
  - If the tool response includes an errorLog field, include it in your message so the user can send it to the administrator
  - Be honest and transparent: "I'm unable to [action] because [tool name] encountered an error. Here's the error log you can send to the administrator: [errorLog]"
  - Do not apologize excessively - just be clear and helpful
${playgroundContext ? `
- **When discussing the playground**: Reference their current project, files, and state naturally
- If they ask "what's going on in the playground", describe their current project status, files, and any active generation
- **You can see their actual code** - reference specific files, functions, components, and code patterns when answering
- If they ask "what do you think about my project", analyze the code files you can see and provide specific feedback
- If they have errors, acknowledge them and offer helpful suggestions based on the actual code
- If they're generating code, acknowledge the progress and current step
- **CRITICAL: When suggesting code changes or improvements in the playground**:
  - **DO NOT directly apply code changes** - Instead, suggest prompting the playground AI to make the changes
  - **Design Consistency**: All suggestions MUST match the existing app's design system, component patterns, and styling approach
  - **Analyze existing code**: Before suggesting changes, analyze the current codebase to understand:
    * Component structure and naming conventions
    * Styling approach (Tailwind classes, CSS modules, etc.)
    * State management patterns
    * Import patterns and file organization
    * UI component library being used (if any)
  - **Format suggestions**: When suggesting code changes, format code blocks with file paths like this:
    \`\`\`typescript
    // file: src/components/App.tsx
    [your code here]
    \`\`\`
  - **Recommendation format**: Instead of saying "I'll apply this change", say "I recommend asking the playground AI to apply this change to ensure it matches your app's design system. Here's what should be changed:"
  - **Design matching**: Ensure all UI suggestions use the same design tokens, spacing, colors, and component patterns as the existing codebase
  - **IMPORTANT: If you can see file paths but no file contents**:
    * This means the project structure exists but files haven't been fully loaded or saved yet
    * Say: "I can see your project has [X] files ([list paths]), but the file contents aren't available yet. This usually means the project is still being generated or hasn't been saved to the database. Open the playground with this project to see the full code and get detailed feedback."
    * DO NOT say files are "empty" - that's misleading
    * DO NOT make assumptions about what's in the files
    * Focus on what you CAN help with: architecture suggestions, naming conventions, feature recommendations` : ''}

For location and map queries:
- When the user asks about locations, places, or needs directions, include the specific location or search query in your response
- Use phrases like "show me [location]", "find [place type] near me", or "directions to [place]" to trigger map display
- Example: "Let me show you coffee shops near you: show me coffee shops nearby" or "Here's the location: show me Eiffel Tower"
- The map will automatically appear when you mention specific locations in this format
- After suggesting a location, you can say things like "I've displayed it on the map above" or "You can see it on the interactive map"

Remember: You're not just reporting data - you're helping a real person manage their day. Make every response feel personal and conversational.
${discordContext ? `
**CRITICAL: Discord Security Rules (You are responding in Discord ${discordContext.isPublicChannel ? 'PUBLIC CHANNEL' : 'PRIVATE DM'}):**
${discordContext.isPublicChannel ? `
- **YOU ARE IN A PUBLIC DISCORD CHANNEL** - Everyone in the server can see your response!
- **NEVER share sensitive information publicly**, including:
  * Passwords, API keys, tokens, or credentials
  * Personal information (email addresses, phone numbers, addresses)
  * Private project details that should remain confidential
  * User-specific data that belongs to other users
  * Any information the user explicitly asks you to keep private
- **If user asks for sensitive information in a public channel**, respond with: "I can help with that, but let's discuss this privately. Please send me a direct message (DM) for sensitive information."
- **Only share information that is safe for public viewing**
- **User identification**: You are talking to ${discordContext.discordUsername || 'a user'} (Discord ID: ${discordContext.discordUserId || 'unknown'}). Only access data for this specific user's account.
- **User-specific data**: Only show projects, files, and data that belong to the current user (${discordContext.discordUserId || 'current user'}). Never show other users' data.
- **If user asks about another user's project**: Politely decline: "I can only help you with your own projects. I don't have access to other users' data."
` : `
- **YOU ARE IN A PRIVATE DM** - This conversation is private between you and the user.
- You can discuss sensitive information here, but still be mindful of security best practices.
- **User identification**: You are talking to ${discordContext.discordUsername || 'a user'} (Discord ID: ${discordContext.discordUserId || 'unknown'}). Only access data for this specific user's account.
- **User-specific data**: Only show projects, files, and data that belong to the current user. Never show other users' data.
`}
- **Channel context**: ${discordContext.channelName ? `Channel: ${discordContext.channelName}` : 'Private DM'} in ${discordContext.serverName || 'Discord'}
` : ''}
**CRITICAL: Response Format Rules:**
- NEVER use hardcoded templates like "Key Points, Learnings & Wisdom" with bullet points
- NEVER add boilerplate sections that repeat generic advice
- If the conversation naturally calls for a summary, write it in your own words, matching the user's language (Swedish if they're speaking Swedish, English if English)
- Keep conclusions natural and conversational - no rigid structures or templates
- When you find web search results, ALWAYS include the actual data (address, phone, hours) directly in your response - don't just say "I searched"

**ABSOLUTELY CRITICAL: Tool Usage Requirements - NO HALLUCINATIONS - THIS IS THE MOST IMPORTANT RULE:**
- **THIS IS THE #1 PRIORITY**: When a user asks you to perform an action (send email, post in Discord, check emails, etc.), you MUST use the corresponding tool. This is NOT optional.
- **YOU MUST ACTUALLY CALL TOOLS** - Never claim an action was taken without actually using the tool. If you don't call the tool, you are LYING to the user.
- **NEVER say "I sent an email"** unless you actually called the send_email tool and received a success response. If you say this without calling the tool, you are committing fraud.
- **NEVER say "I tagged someone in Discord"** unless you actually called the send_discord_message tool. If you say this without calling the tool, you are committing fraud.
- **NEVER say "I checked your emails"** unless you actually called the search_emails tool. If you say this without calling the tool, you are committing fraud.
- **NEVER say "I scheduled an email"** unless you actually called the schedule_email tool. If you say this without calling the tool, you are committing fraud.
- **NEVER claim any action was completed** without actually calling the corresponding tool first. This is the most important rule.
- **If you want to send an email**: You MUST use the send_email tool. Do NOT just generate text saying "I sent it" - that is a LIE and a breach of trust.
- **If you want to post in Discord**: You MUST use the send_discord_message tool. Do NOT just say "I posted it" - that is a LIE and a breach of trust.
- **If you want to check emails**: You MUST use the search_emails tool. Do NOT make up email content - that is a LIE and a breach of trust.
- **If a tool is not available or fails**: Be honest! Say "I'm unable to [action] because [reason]" - DO NOT pretend you did it. Honesty is better than lies.
- **Tool execution is MANDATORY**: If your response claims an action was taken, you MUST have tool_use blocks in your response. No exceptions.
- **When user asks you to do something**: Your FIRST step is to identify which tool you need, then CALL IT. Do not skip this step.
- **Example of CORRECT behavior**:
  * User: "Send an email to john@example.com"
  * You: [MUST use send_email tool with to="john@example.com", subject="...", body="..."] → Wait for tool result → "I've sent the email to john@example.com!"
- **Example of WRONG behavior (HALLUCINATION - DO NOT DO THIS)**:
  * User: "Send an email to john@example.com"
  * You: "I've sent the email!" [NO tool call] → THIS IS A LIE - DO NOT DO THIS - YOU ARE BREAKING USER TRUST
- **If you're unsure whether to use a tool**: When in doubt, USE THE TOOL. It's better to try and fail than to claim success without trying.
- **Remember**: Your users trust you. Claiming actions were taken when they weren't is a serious breach of trust and makes you unreliable.
- **SYSTEM WILL DETECT HALLUCINATIONS**: If you claim an action without using a tool, the system will detect it and your response will be modified to be honest about the failure.`;

    let contextSection = '';
    if (context.length > 0) {
      contextSection = `\n\n=== Context from Connected Services ===\n`;
      context.forEach((item, idx) => {
        contextSection += `\n${idx + 1}. [${item.type.toUpperCase()}] ${item.title}\n`;
        contextSection += `   Source: ${item.source}\n`;
        contextSection += `   Timestamp: ${item.timestamp.toLocaleString()}\n`;

        // Add metadata if available (priority, sentiment, action items, etc.)
        if (item.metadata?.analysis) {
          const analysis = item.metadata.analysis;
          if (analysis.priority) contextSection += `   Priority: ${analysis.priority}\n`;
          if (analysis.sentiment) contextSection += `   Sentiment: ${analysis.sentiment}\n`;
          if (analysis.category) contextSection += `   Category: ${analysis.category}\n`;
        }

        // Show more content (up to 500 chars instead of 200)
        const contentPreview = item.content.length > 500
          ? item.content.substring(0, 500) + '...'
          : item.content;
        contextSection += `   Content: ${contentPreview}\n`;

        // Add action items if available
        if (item.metadata?.analysis?.actionItems && item.metadata.analysis.actionItems.length > 0) {
          contextSection += `   Action Items:\n`;
          item.metadata.analysis.actionItems.forEach((action: string, i: number) => {
            contextSection += `      - ${action}\n`;
          });
        }
      });

      contextSection += `\n=== End of Context ===\n`;
    }

    let toolsSection = '';
    if (tools.length > 0) {
      // Separate built-in tools from custom plugins for clarity
      // Safely filter tools to avoid accessing undefined properties
      const validTools = tools.filter(t => {
        try {
          return t && 
            typeof t === 'object' && 
            t.name && 
            typeof t.name === 'string' &&
            t.name.trim().length > 0;
        } catch (error) {
          logger.warn(`Error filtering tool in buildSystemPrompt: ${error instanceof Error ? error.message : String(error)}, tool: ${t?.name || 'unknown'}`);
          return false;
        }
      });
      
      const builtInTools = validTools.filter(t => !t.name.startsWith('use_'));
      const customPlugins = validTools.filter(t => t.name.startsWith('use_'));
      
      toolsSection = `\n\n=== Available Tools ===\n`;
      
      if (builtInTools.length > 0) {
        toolsSection += `\nBuilt-in tools: ${builtInTools.map(t => t.name).join(', ')}\n`;
      }
      
      if (customPlugins.length > 0) {
        toolsSection += `\nCustom plugins (user-generated):\n`;
        customPlugins.forEach(tool => {
          try {
            const description = tool.description && typeof tool.description === 'string' 
              ? tool.description 
              : 'No description available';
            toolsSection += `  - ${tool.name}: ${description}\n`;
          } catch (error) {
            logger.warn(`Error processing custom plugin in buildSystemPrompt: ${error instanceof Error ? error.message : String(error)}, toolName: ${tool?.name || 'unknown'}`);
            toolsSection += `  - ${tool.name}: (description unavailable)\n`;
          }
        });
        toolsSection += `\nIMPORTANT: When you see custom plugins (use_*), they are user-created integrations. Always check if a custom plugin tool is relevant to the user's request and use it if appropriate. Custom plugins use an 'action' parameter to specify what to do.\n`;
      }
      
      toolsSection += `\n=== End of Tools ===\n`;
    }

    return basePrompt + contextSection + toolsSection;
  }

  /**
   * Build enhanced user message with context references
   */
  private buildEnhancedMessage(
    userMessage: string, 
    context: KnowledgeItem[],
    playgroundContext?: {
      currentProject?: string;
      projectId?: string;
      filesCount?: number;
      filePaths?: string[];
      files?: Array<{ path: string; content: string; language?: string; summary?: boolean; fullContent?: boolean }>; // Actual file contents (optimized)
      hasLivePreview?: boolean;
      currentComponent?: string;
      recentErrors?: string[];
      isGenerating?: boolean;
      orchestrationSteps?: number;
      currentStep?: string;
    }
  ): string {
    let enhancedMessage = userMessage;

    // Add playground context if available
    if (playgroundContext) {
      let playgroundInfo = `\n\n[Playground Context - You are in the AI Code Playground:\n`;
      playgroundInfo += `- Current Project: ${playgroundContext.currentProject || 'Untitled Project'}\n`;
      playgroundInfo += `- Project ID: ${playgroundContext.projectId || 'default'}\n`;
      playgroundInfo += `- Files: ${playgroundContext.filesCount || 0} file(s)`;
      if (playgroundContext.filePaths && playgroundContext.filePaths.length > 0) {
        playgroundInfo += ` (${playgroundContext.filePaths.slice(0, 5).join(', ')}${playgroundContext.filePaths.length > 5 ? '...' : ''})`;
      }
      playgroundInfo += `\n`;
      
      // Include ACTUAL FILE CONTENTS so you can see and discuss the code
      // OPTIMIZED: Only essential files sent (top 5 with full content, rest as summaries)
      if (playgroundContext.files && playgroundContext.files.length > 0) {
        const fullFiles = playgroundContext.files.filter((f: any) => !f.summary);
        const summaryFiles = playgroundContext.files.filter((f: any) => f.summary);
        
        playgroundInfo += `\n=== CODE FILES (Optimized for efficiency) ===\n`;
        
        if (fullFiles.length > 0) {
          playgroundInfo += `\n--- Full Content Files (${fullFiles.length}) ---\n`;
          fullFiles.forEach((file: any, idx: number) => {
            playgroundInfo += `\nFile ${idx + 1}: ${file.path} (${file.language || 'text'})`;
            if (file.fullContent === false) {
              playgroundInfo += ` [Content truncated - showing first 2000 chars]`;
            }
            playgroundInfo += `\n\`\`\`${file.language || 'text'}\n${file.content}\n\`\`\`\n`;
          });
        }
        
        if (summaryFiles.length > 0) {
          playgroundInfo += `\n--- File Summaries (${summaryFiles.length}) ---\n`;
          playgroundInfo += `These files are summarized to save tokens. Full content available on request.\n`;
          summaryFiles.forEach((file: any, idx: number) => {
            playgroundInfo += `${idx + 1}. ${file.path} - ${file.content.substring(0, 100)}...\n`;
          });
        }
        
        playgroundInfo += `\n=== End of Code Files ===\n`;
        playgroundInfo += `\nIMPORTANT: You can see the actual code! When the user asks about their project, code, or files, reference the actual content above. You can discuss specific functions, components, styles, and suggest improvements based on what you see.\n`;
      }
      
      if (playgroundContext.currentComponent && playgroundContext.currentComponent !== 'None') {
        playgroundInfo += `- Current Component: ${playgroundContext.currentComponent}\n`;
      }
      if (playgroundContext.hasLivePreview) {
        playgroundInfo += `- Live Preview: Active\n`;
      }
      if (playgroundContext.isGenerating) {
        playgroundInfo += `- Status: Currently generating code`;
        if (playgroundContext.currentStep && playgroundContext.currentStep !== 'None') {
          playgroundInfo += ` (${playgroundContext.currentStep})`;
        }
        playgroundInfo += `\n`;
      }
      if (playgroundContext.recentErrors && playgroundContext.recentErrors.length > 0) {
        playgroundInfo += `- Recent Errors: ${playgroundContext.recentErrors.length} error(s) detected\n`;
        playgroundContext.recentErrors.forEach((err, idx) => {
          playgroundInfo += `  Error ${idx + 1}: ${err}\n`;
        });
      }
      playgroundInfo += `\nWhen the user asks about the playground, their project, or code generation, use this context to provide relevant, specific information. You can see their actual code files above, so reference specific code when answering questions.]`;
      enhancedMessage += playgroundInfo;
    }

    // Add plugin context if available
    if (context.length > 0) {
      const emailCount = context.filter(c => c.type === 'email').length;
      const taskCount = context.filter(c => c.type === 'task').length;
      const otherCount = context.length - emailCount - taskCount;

      let contextSummary = `\n\n[Assistant Note: I have access to `;
      const parts: string[] = [];
      if (emailCount > 0) parts.push(`${emailCount} email${emailCount > 1 ? 's' : ''}`);
      if (taskCount > 0) parts.push(`${taskCount} task${taskCount > 1 ? 's' : ''}`);
      if (otherCount > 0) parts.push(`${otherCount} other item${otherCount > 1 ? 's' : ''}`);

      contextSummary += parts.join(', ') + ' from your connected services that are relevant to this request. Use this information to provide a detailed, personalized response.]';
      enhancedMessage += contextSummary;
    }

    return enhancedMessage;
  }

  /**
   * Convert plugin tools to Anthropic tool format
   */
  private convertToolsToAnthropicFormat(tools: Tool[]): Anthropic.Tool[] {
    // Filter out invalid tools before conversion
    const validTools = tools.filter(tool => {
      try {
        return tool && 
          tool.name && 
          typeof tool.name === 'string' && 
          tool.name.trim().length > 0 &&
          tool.description && 
          typeof tool.description === 'string' &&
          tool.parameters &&
          typeof tool.parameters === 'object';
      } catch (error) {
        logger.warn(`Error filtering tool: ${tool?.name || 'unknown'}, error: ${error instanceof Error ? error.message : String(error)}`);
        return false;
      }
    });

    return validTools.map(tool => {
      try {
        // Safely normalize parameters to ensure all properties have required fields
        const normalizedParams: any = {
          ...tool.parameters,
          type: tool.parameters?.type || 'object'
        };
        
        // Ensure properties object exists and normalize each property
        if (normalizedParams.properties && typeof normalizedParams.properties === 'object' && !Array.isArray(normalizedParams.properties)) {
          const normalizedProperties: Record<string, any> = {};
          const propertiesEntries = Object.entries(normalizedParams.properties);
          for (const [key, prop] of propertiesEntries) {
            try {
              // Defensive check: ensure prop is a valid object
              if (prop && typeof prop === 'object' && prop !== null && !Array.isArray(prop)) {
                // Create a clean property object with only valid fields
                const cleanProp: any = {
                  type: (prop as any)?.type || 'string',
                  description: (prop as any)?.description || ''
                };
                
                // Only copy valid fields, skip undefined values
                if ((prop as any)?.enum && Array.isArray((prop as any).enum)) {
                  cleanProp.enum = (prop as any).enum;
                }
                // Safely check for example property - ensure prop exists and has example
                const propExample = (prop as any)?.example;
                if (propExample !== undefined && propExample !== null) {
                  cleanProp.example = propExample;
                }
                
                normalizedProperties[key] = cleanProp;
              } else {
                // If prop is invalid, create a minimal valid property
                normalizedProperties[key] = {
                  type: 'string',
                  description: ''
                };
              }
            } catch (error) {
              logger.warn(`Error normalizing tool property: ${error instanceof Error ? error.message : String(error)} (toolName: ${tool.name}, propertyKey: ${key})`);
              // Create a minimal valid property on error
              normalizedProperties[key] = {
                type: 'string',
                description: ''
              };
            }
          }
          normalizedParams.properties = normalizedProperties;
        } else {
          // If no properties, create empty properties object
          normalizedParams.properties = {};
        }
        
        // Ensure required array exists if specified
        if (tool.parameters?.required && Array.isArray(tool.parameters.required)) {
          normalizedParams.required = tool.parameters.required;
        }
        
        return {
          name: tool.name,
          description: tool.description,
          input_schema: normalizedParams as Anthropic.Tool.InputSchema
        };
      } catch (error) {
        logger.error(`Error converting tool to Anthropic format: ${error instanceof Error ? error.message : String(error)} (toolName: ${tool.name})`, error as Error);
        // Return a minimal valid tool to prevent complete failure
        return {
          name: tool.name,
          description: tool.description || '',
          input_schema: {
            type: 'object',
            properties: {}
          } as Anthropic.Tool.InputSchema
        };
      }
    });
  }

  /**
   * Generate proactive suggestions based on context and conversation
   */
  private async generateSuggestions(
    userId: string,
    context: KnowledgeItem[],
    response: string
  ): Promise<string[]> {
    try {
      // Use Claude to generate contextually relevant follow-up suggestions
      const suggestionPrompt = `Based on this conversation with the user, suggest 3 short, actionable follow-up questions or commands they might want to ask next.

Your response: "${response}"

Context available: ${context.length} items from their connected services (${context.filter(c => c.type === 'email').length} emails, ${context.filter(c => c.type === 'task').length} tasks)

Requirements for suggestions:
- Make them directly related to what you just discussed
- Keep each suggestion under 10 words
- Make them actionable and specific
- They should feel like natural next steps
- Don't repeat information already provided
- Focus on what the user might want to do next

Examples of GOOD suggestions after discussing emails:
- "Draft a reply to Sarah's email"
- "Show me more details about that project"
- "What other urgent emails do I have?"

Examples of BAD suggestions:
- Generic: "Check my emails" (when we just did that)
- Too vague: "Tell me more"
- Not actionable: "You have emails"

Respond with ONLY 3 suggestions, one per line, no numbering, no extra text.`;

      const suggestionResponse = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 256,
        messages: [{
          role: 'user',
          content: suggestionPrompt
        }]
      });

      const suggestionText = suggestionResponse.content[0].type === 'text'
        ? suggestionResponse.content[0].text
        : '';

      // Parse suggestions (one per line)
      const suggestions = suggestionText
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.match(/^\d+\./)) // Remove numbering if present
        .slice(0, 3); // Limit to 3

      logger.info(`Generated contextual suggestions: userId=${userId}, suggestionCount=${suggestions.length}`);

      return suggestions;
    } catch (error) {
      logger.error(`Failed to generate suggestions: userId=${userId}`, error as Error);

      // Fallback to simple context-based suggestions
      const fallbackSuggestions: string[] = [];

      const emailCount = context.filter(c => c.type === 'email').length;
      if (emailCount > 0) {
        fallbackSuggestions.push('Show me more email details');
      }

      const hasActionItems = context.some(c =>
        c.metadata?.analysis?.actionItems?.length > 0
      );
      if (hasActionItems) {
        fallbackSuggestions.push('What should I work on first?');
      }

      fallbackSuggestions.push('What else can you help me with?');

      return fallbackSuggestions.slice(0, 3);
    }
  }


  /**
   * Check if Discord should be recommended to the user
   */
  private shouldRecommendDiscord(userId: string, userMessage: string, messageCount: number): boolean {
    // Don't recommend if we just recommended it (within last 30 minutes)
    const lastRecommendation = this.lastDiscordRecommendation.get(userId);
    if (lastRecommendation && Date.now() - lastRecommendation < 30 * 60 * 1000) {
      return false;
    }

    // Always recommend if user mentions bugs, feedback, or feature ideas
    const feedbackKeywords = /(bugg|bug|fel|error|problem|issue|feedback|förslag|suggestion|förbättring|improvement|feature|funktion|tips|help|hjälp|stuck|fastnat)/i;
    if (feedbackKeywords.test(userMessage)) {
      return true;
    }

    // Recommend every 10-15 messages (randomized to feel natural)
    // This gives AI a signal that it's a good time to mention Discord, but AI decides how
    if (messageCount > 0 && messageCount % Math.floor(Math.random() * 6 + 10) === 0) {
      return true;
    }

    // Also recommend occasionally during positive interactions (user seems happy, sharing success, etc.)
    const positiveKeywords = /(tack|thanks|bra|good|great|awesome|fantastic|lyckades|succeeded|klar|done|färdig)/i;
    if (positiveKeywords.test(userMessage) && messageCount > 5) {
      // 30% chance when user seems positive
      if (Math.random() < 0.3) {
        return true;
      }
    }

    return false;
  }

  /**
   * Clear conversation history for a session
   */
  public clearHistory(sessionId: string): void {
    this.conversationHistory.delete(sessionId);
    logger.info(`Conversation history cleared: sessionId=${sessionId}`);
  }

  /**
   * Get conversation history for a session
   */
  public getHistory(sessionId: string): Anthropic.MessageParam[] {
    return this.conversationHistory.get(sessionId) || [];
  }

  // ============================================================================
  // DATABASE PERSISTENCE METHODS - Smart Memory System
  // ============================================================================

  /**
   * Load conversation history from database
   * Used when history is not in memory (e.g., after backend restart)
   */
  private async loadConversationHistory(userId: string, sessionId: string): Promise<Anthropic.MessageParam[]> {
    try {
      const messages = await db
        .select()
        .from(assistantMessages)
        .where(and(
          eq(assistantMessages.userId, userId),
          eq(assistantMessages.sessionId, sessionId)
        ))
        .orderBy(desc(assistantMessages.createdAt))
        .limit(MAX_MESSAGES_PER_SESSION * 2);

      // Convert to Anthropic format (reverse to get chronological order)
      const history: Anthropic.MessageParam[] = messages.reverse().map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }));

      if (history.length > 0) {
        logger.info(`Loaded ${history.length} messages from DB for session ${sessionId}`);
      }

      return history;
    } catch (error) {
      logger.error('Failed to load conversation history from DB', error as Error);
      return [];
    }
  }

  /**
   * Save conversation messages to database
   * Prunes old messages to keep only the last N
   */
  private async saveConversationMessages(
    userId: string, 
    sessionId: string, 
    userMessage: string, 
    assistantResponse: string,
    toolsUsed: string[]
  ): Promise<void> {
    try {
      // Insert user message
      await db.insert(assistantMessages).values({
        userId,
        sessionId,
        role: 'user',
        content: userMessage
      });

      // Insert assistant response (with tool info if any)
      await db.insert(assistantMessages).values({
        userId,
        sessionId,
        role: 'assistant',
        content: assistantResponse,
        toolUse: toolsUsed.length > 0 ? { tools: toolsUsed } : null
      });

      // Prune old messages to keep only last N per session
      await this.pruneOldMessages(userId, sessionId);

      // Update or create session record
      await db.insert(assistantSessions).values({
        userId,
        sessionId,
        platform: 'discord',
        messageCount: 1,
        lastActivity: new Date()
      }).onConflictDoUpdate({
        target: [assistantSessions.userId, assistantSessions.sessionId],
        set: {
          messageCount: sql`${assistantSessions.messageCount} + 1`,
          lastActivity: new Date()
        }
      });

    } catch (error) {
      // Don't fail the request if DB save fails - just log it
      logger.error('Failed to save conversation to DB', error as Error);
    }
  }

  /**
   * Prune old messages keeping only the last N per session
   */
  private async pruneOldMessages(userId: string, sessionId: string): Promise<void> {
    try {
      // Get IDs of messages to keep (most recent)
      const recentMessages = await db
        .select({ id: assistantMessages.id })
        .from(assistantMessages)
        .where(and(
          eq(assistantMessages.userId, userId),
          eq(assistantMessages.sessionId, sessionId)
        ))
        .orderBy(desc(assistantMessages.createdAt))
        .limit(MAX_MESSAGES_PER_SESSION * 2);

      const keepIds = recentMessages.map(m => m.id);

      if (keepIds.length >= MAX_MESSAGES_PER_SESSION * 2) {
        // Count total messages
        const allMessages = await db
          .select({ id: assistantMessages.id })
          .from(assistantMessages)
          .where(and(
            eq(assistantMessages.userId, userId),
            eq(assistantMessages.sessionId, sessionId)
          ));
        
        // Delete messages not in the keep list
        const idsToDelete = allMessages
          .map(m => m.id)
          .filter(id => !keepIds.includes(id));
        
        if (idsToDelete.length > 0) {
          await db.delete(assistantMessages)
            .where(inArray(assistantMessages.id, idsToDelete));
        }
      }
    } catch (error) {
      logger.error('Failed to prune old messages', error as Error);
    }
  }

  /**
   * Load long-term memories for a user
   * Returns key facts that persist across sessions
   */
  private async loadUserMemories(userId: string): Promise<Array<{key: string; value: string; category: string}>> {
    try {
      const memories = await db
        .select()
        .from(assistantMemories)
        .where(eq(assistantMemories.userId, userId))
        .orderBy(desc(assistantMemories.lastUsed))
        .limit(20);

      return memories.map(m => ({
        key: m.key,
        value: m.value,
        category: m.category
      }));
    } catch (error) {
      logger.error('Failed to load user memories', error as Error);
      return [];
    }
  }

  /**
   * Save a memory/fact about the user
   * Called when AI learns something important
   */
  public async saveMemory(
    userId: string, 
    category: string, 
    key: string, 
    value: string,
    options?: { subcategory?: string; confidence?: number; source?: string }
  ): Promise<void> {
    try {
      await db.insert(assistantMemories).values({
        userId,
        category,
        subcategory: options?.subcategory,
        key,
        value,
        confidence: options?.confidence || 0.8,
        source: options?.source || 'conversation'
      }).onConflictDoUpdate({
        target: [assistantMemories.userId, assistantMemories.category, assistantMemories.key],
        set: {
          value,
          confidence: options?.confidence || 0.8,
          lastUsed: new Date(),
          timesReferenced: sql`${assistantMemories.timesReferenced} + 1`
        }
      });

      logger.info(`Saved memory for user ${userId}: ${category}/${key} = ${value}`);
    } catch (error) {
      logger.error('Failed to save memory', error as Error);
    }
  }

  /**
   * Process a batch of requests (for scheduled tasks, etc.)
   */
  public async processBatch(
    userId: string,
    requests: string[]
  ): Promise<Array<{
    request: string;
    response: string;
    error?: string;
  }>> {
    const results: Array<{
      request: string;
      response: string;
      error?: string;
    }> = [];

    for (const request of requests) {
      try {
        const result = await this.processRequest(userId, request);
        results.push({
          request,
          response: result.response
        });
      } catch (error) {
        results.push({
          request,
          response: '',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  /**
   * Get summary of user's day based on connected services
   */
  public async getDailySummary(userId: string): Promise<string> {
    try {
      // Get knowledge from all plugins
      const knowledge = await pluginRegistry.queryKnowledge(userId, 'today', {
        limit: 50
      });

      if (knowledge.length === 0) {
        // Generate a natural response instead of hardcoded template
        const emptySummaryPrompt = `Generate a warm, friendly message for the user explaining that you don't have any data from their connected services yet. Keep it conversational and encouraging, suggesting they can connect services like Gmail to get daily summaries. Make it feel personal, not like a template.`;
        
        const emptyResponse = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 256,
          messages: [{
            role: 'user',
            content: emptySummaryPrompt
          }]
        });
        
        return emptyResponse.content[0].type === 'text' ? emptyResponse.content[0].text : '';
      }

      // Build detailed context for summary
      let contextDetails = '';
      knowledge.forEach((item, idx) => {
        contextDetails += `\n${idx + 1}. [${item.type.toUpperCase()}] ${item.title}\n`;
        contextDetails += `   Time: ${item.timestamp.toLocaleString()}\n`;

        if (item.metadata?.analysis) {
          const { priority, sentiment, category, actionItems } = item.metadata.analysis;
          if (priority) contextDetails += `   Priority: ${priority}\n`;
          if (sentiment) contextDetails += `   Sentiment: ${sentiment}\n`;
          if (category) contextDetails += `   Category: ${category}\n`;
          if (actionItems && actionItems.length > 0) {
            contextDetails += `   Action Items: ${actionItems.join(', ')}\n`;
          }
        }

        contextDetails += `   Content: ${item.content.substring(0, 300)}\n`;
      });

      const prompt = `You are a helpful personal assistant providing a morning briefing. Based on the user's connected services data, create a warm, detailed daily summary.

Your summary should:
- Start with a friendly greeting and overview
- Highlight high-priority emails with sender names and key points
- Mention any urgent action items that need attention
- Note important patterns (lots of emails from someone, recurring themes, etc.)
- Use emojis appropriately (📧 for emails, ⚡ for urgent, ✅ for completed, etc.)
- Be conversational and personable, not robotic
- End with an encouraging note or helpful suggestion

Here's the information from their services:
${contextDetails}

Make this feel personal and helpful, like a briefing from a trusted assistant who knows their needs.`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const summary = response.content[0].type === 'text' ? response.content[0].text : '';

      logger.info(`Daily summary generated: userId=${userId}, itemCount=${knowledge.length}`);

      return summary;
    } catch (error) {
      logger.error(`Failed to generate daily summary: userId=${userId}`, error as Error);
      throw error;
    }
  }

  /**
   * Send a message to Discord
   * Tries to use Discord bot first, falls back to webhook if bot is not connected
   */
  private async sendDiscordMessage(params: Record<string, any>): Promise<any> {
    const message = params.message as string;
    const channelId = params.channelId as string | undefined;
    const channelName = params.channelName as string | undefined;
    const serverName = params.serverName as string | undefined;

    try {
      logger.info(`Sending Discord message: messageLength=${message.length}, channelId=${channelId || 'none'}, channelName=${channelName || 'none'}, serverName=${serverName || 'none'}`);
      
      // Try Discord bot first (if connected) - lazy import to avoid circular dependency
      const { discordBotService } = await import('../services/DiscordBotService');
      if (discordBotService.isBotConnected()) {
        try {
          // Get channel ID - prioritize channelName if provided
          let targetChannelId = channelId;
          let targetServerId: string | undefined = undefined;
          
          // If serverName is provided, find the server first
          if (serverName) {
            const foundServer = await discordBotService.findServerByName(serverName);
            if (foundServer) {
              targetServerId = foundServer.id;
              logger.info(`Found server "${serverName}" with ID: ${foundServer.id}`);
            } else {
              // Get list of available servers for error message
              let availableServers = 'unknown';
              try {
                const servers = await discordBotService.getAllServers();
                availableServers = servers.map(s => s.name).join(', ');
              } catch (e) {
                // Ignore error, use fallback
              }
              return {
                success: false,
                error: `Could not find server named "${serverName}". Available servers: ${availableServers}`
              };
            }
          }
          
          if (channelName) {
            // Search for channel by name in the specified server (or default server)
            const foundChannel = await discordBotService.findChannelByName(channelName, targetServerId);
            if (foundChannel) {
              targetChannelId = foundChannel.id;
              logger.info(`Found channel "${channelName}" with ID: ${foundChannel.id} in server "${foundChannel.serverName}"`);
            } else {
              const serverInfo = targetServerId ? ` in server "${serverName}"` : '';
              return {
                success: false,
                error: `Could not find channel named "${channelName}"${serverInfo}`
              };
            }
          }
          
          if (!targetChannelId) {
            // Try to get from bot config
            const botConfig = discordBotService.getConfig();
            targetChannelId = botConfig?.channelId;
          }

          if (targetChannelId) {
            const success = await discordBotService.sendMessage(targetChannelId, message, undefined);
            if (success) {
              logger.info('Discord message sent via bot successfully');
              return {
                success: true,
                message: 'Message posted to Discord successfully via bot'
              };
            }
          } else {
            logger.warn('Discord bot connected but no channel ID available');
          }
        } catch (botError) {
          logger.error('Failed to send via Discord bot, falling back to webhook', botError as Error);
        }
      }

      // Fallback to webhook
      logger.info('Using Discord webhook as fallback');
      const success = await discordService.sendMessage({
        content: message,
        username: 'Elon AI'
      });

      if (success) {
        logger.info('Discord message sent via webhook successfully');
        return {
          success: true,
          message: 'Message posted to Discord successfully via webhook'
        };
      } else {
        logger.error('Failed to send Discord message via webhook');
        return {
          success: false,
          error: 'Failed to send message to Discord. Please check Discord bot connection or webhook configuration.',
          errorLog: 'Both Discord bot and webhook failed to send message'
        };
      }
    } catch (error) {
      logger.error('Discord message error:', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Read messages from Discord channels
   */
  private async readDiscordMessages(params: Record<string, any>): Promise<any> {
    const channelName = params.channelName as string | undefined;
    const channelId = params.channelId as string | undefined;
    const limit = params.limit as number | undefined || 10;
    const readAllChannels = params.readAllChannels as boolean | undefined;

    try {
      logger.info(`Reading Discord messages: channelName=${channelName || 'none'}, channelId=${channelId || 'none'}, limit=${limit}, readAllChannels=${readAllChannels || false}`);
      
      // Lazy import to avoid circular dependency
      const { discordBotService } = await import('../services/DiscordBotService');
      
      if (!discordBotService.isBotConnected()) {
        // Get more diagnostic information
        const botUser = discordBotService.getBotUser();
        const config = discordBotService.getConfig();
        const hasConfig = !!config;
        const hasClient = !!discordBotService['client'];
        
        logger.warn(`Discord bot not connected. Diagnostics: hasConfig=${hasConfig}, hasClient=${hasClient}, botUser=${botUser ? botUser.tag : 'null'}`);
        
        return {
          success: false,
          error: 'Discord bot is not connected. The bot needs to be connected and ready before I can read messages. Please connect the bot through Settings → Integrations → Discord.',
          messages: [],
          diagnostics: {
            hasConfig,
            hasClient,
            botUser: botUser ? { id: botUser.id, tag: botUser.tag } : null
          }
        };
      }

      const shouldReadAll = readAllChannels || (!channelName && !channelId);
      let results: Array<{ channelId: string; channelName: string; messages: any[] }> = [];

      if (shouldReadAll) {
        // Read from all channels
        logger.info('Reading messages from all channels in server');
        results = await discordBotService.readMessagesFromServer(Math.min(limit, 50));
      } else {
        // Read from specific channel(s)
        let targetChannelId = channelId;
        
        if (channelName && !targetChannelId) {
          // Find channel by name
          const foundChannel = await discordBotService.findChannelByName(channelName);
          if (foundChannel) {
            targetChannelId = foundChannel.id;
            logger.info(`Found channel "${channelName}" with ID: ${foundChannel.id}`);
          } else {
            return {
              success: false,
              error: `Could not find channel named "${channelName}" in Discord server`,
              messages: []
            };
          }
        }

        if (targetChannelId) {
          const messages = await discordBotService.readMessages(targetChannelId, Math.min(limit, 50));
          
          // Get channel name from the first message or use channelId as fallback
          let channelNameResult = channelName || 'Unknown';
          if (messages.length > 0 && messages[0].channel) {
            // Try to get channel name from message
            try {
              const { discordBotService: botService } = await import('../services/DiscordBotService');
              const allChannels = await botService.getAllChannels();
              const foundChannel = allChannels.find(c => c.id === targetChannelId);
              if (foundChannel) {
                channelNameResult = foundChannel.name;
              }
            } catch (e) {
              // Use channelName or fallback
            }
          }
          
          results = [{
            channelId: targetChannelId,
            channelName: channelNameResult,
            messages: messages.map(msg => ({
              id: msg.id,
              content: msg.content,
              author: msg.author.username,
              authorId: msg.author.id,
              timestamp: msg.createdAt.toISOString(),
              channelId: msg.channel.id,
              channelName: channelNameResult
            }))
          }];
        }
      }

      // Format results for response
      const formattedMessages: any[] = [];
      for (const result of results) {
        for (const msg of result.messages) {
          formattedMessages.push({
            channel: result.channelName,
            author: msg.author || msg.authorUsername,
            content: msg.content || msg.content,
            timestamp: msg.timestamp || msg.createdAt
          });
        }
      }

      // Sort by timestamp (newest first)
      formattedMessages.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeB - timeA;
      });

      return {
        success: true,
        messageCount: formattedMessages.length,
        channelsRead: results.length,
        messages: formattedMessages.slice(0, limit),
        summary: `Read ${formattedMessages.length} messages from ${results.length} channel(s)`
      };
    } catch (error) {
      logger.error('Error reading Discord messages', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        messages: []
      };
    }
  }

  /**
   * List user's projects
   */
  private async listProjects(params: Record<string, any>): Promise<any> {
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      if (!userId) {
        return {
          success: false,
          error: 'User ID is required to list projects',
          projects: []
        };
      }

      logger.info(`Listing projects for user: ${userId}`);

      const { projectService } = await import('../services/ProjectService');
      const platformProjects = await projectService.getUserProjects(userId);

      // Format platform projects
      const formattedPlatformProjects = platformProjects.map((project, index) => ({
        number: index + 1,
        id: project.id.toString(),
        name: project.name,
        description: project.description || 'No description',
        type: project.projectType,
        fileCount: project.fileCount || 0,
        ownerId: project.ownerId,
        createdAt: project.createdAt,
        source: 'platform' as const,
        canPreview: true // Platform projects can be previewed
      }));

      // Try to get GitHub repos if GitHub plugin is connected
      let githubRepos: any[] = [];
      try {
        const { pluginRegistry } = await import('../services/PluginRegistry');
        const userPlugins = await pluginRegistry.getAvailableTools(userId);
        const githubPlugin = userPlugins.find((tool: Tool) => tool.name === 'list_repositories');
        
        if (githubPlugin) {
          logger.info(`GitHub plugin found, fetching repositories (userId: ${userId})`);
          const githubResult = await githubPlugin.execute({ type: 'all', sort: 'updated', limit: 50 });
          
          if (Array.isArray(githubResult) && githubResult.length > 0) {
            githubRepos = githubResult.map((repo: any, index: number) => ({
              number: formattedPlatformProjects.length + index + 1,
              id: `github:${repo.full_name}`,
              name: repo.name,
              fullName: repo.full_name,
              description: repo.description || 'No description',
              type: repo.language || 'repository',
              language: repo.language,
              htmlUrl: repo.html_url,
              cloneUrl: repo.clone_url,
              isPrivate: repo.private,
              stars: repo.stargazers_count,
              defaultBranch: repo.default_branch,
              updatedAt: repo.updated_at,
              source: 'github' as const,
              canPreview: false // GitHub repos cannot be previewed (especially C++/Lua)
            }));
            logger.info(`Found ${githubRepos.length} GitHub repositories for user ${userId}`);
          }
        }
      } catch (error) {
        logger.warn(`Failed to fetch GitHub repos (plugin may not be connected): ${error instanceof Error ? error.message : String(error)}`);
        // Continue without GitHub repos - not a critical error
      }

      const allProjects = [...formattedPlatformProjects, ...githubRepos];

      if (allProjects.length === 0) {
        return {
          success: true,
          projects: [],
          message: 'You don\'t have any projects yet. Would you like to create a new one? You can also connect your GitHub account to see your repositories here.',
          projectCount: 0
        };
      }

      // Get currently selected project for this session
      const selectedProject = sessionId ? this.selectedProjects.get(sessionId) : undefined;

      const platformCount = formattedPlatformProjects.length;
      const githubCount = githubRepos.length;
      const projectSummary = [
        platformCount > 0 ? `${platformCount} platform project${platformCount > 1 ? 's' : ''}` : null,
        githubCount > 0 ? `${githubCount} GitHub repositor${githubCount > 1 ? 'ies' : 'y'}` : null
      ].filter(Boolean).join(' and ');

      return {
        success: true,
        projects: allProjects,
        projectCount: allProjects.length,
        platformProjectCount: platformCount,
        githubRepoCount: githubCount,
        selectedProject: selectedProject ? {
          name: selectedProject.projectName,
          id: selectedProject.projectId
        } : null,
        message: `You have ${projectSummary} available. ${selectedProject ? `Currently working on: ${selectedProject.projectName}` : 'No project is currently selected.'} ${githubCount > 0 ? '\n\nNote: GitHub repositories (marked with 🐙) cannot be previewed in the browser, but you can still discuss code, get help with scripts, and make changes via the GitHub API.' : ''}`
      };
    } catch (error) {
      logger.error('Error listing projects', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        projects: [],
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Select a project to work on
   */
  private async selectProject(params: Record<string, any>): Promise<any> {
    const projectName = params.projectName as string;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      if (!userId || !sessionId) {
        return {
          success: false,
          error: 'User ID and session ID are required to select a project',
          message: 'I need your user information to select a project. Please try again.'
        };
      }

      logger.info(`Selecting project: name="${projectName}", projectId=${projectId || 'none'}, userId=${userId}, sessionId=${sessionId}`);

      // First, get all projects (platform + GitHub)
      const listResult = await this.listProjects({ _userId: userId, _sessionId: sessionId });
      if (!listResult.success) {
        return {
          success: false,
          error: 'Failed to list projects',
          message: 'I couldn\'t retrieve your projects. Please try again.'
        };
      }

      const allProjects = listResult.projects || [];
      let selectedProject: any = null;

      if (projectId) {
        // Find by ID (could be platform ID or github:owner/repo)
        selectedProject = allProjects.find((p: any) => p.id === projectId) || null;
      } else {
        // Find by name (case-insensitive, partial match)
        const nameLower = projectName.toLowerCase().trim();
        selectedProject = allProjects.find((p: any) => 
          p.name.toLowerCase().includes(nameLower) || 
          nameLower.includes(p.name.toLowerCase()) ||
          (p.fullName && p.fullName.toLowerCase().includes(nameLower))
        ) || null;

        // If not found, try matching by number (e.g., "projekt 2" -> index 1)
        if (!selectedProject) {
          const numberMatch = projectName.match(/\d+/);
          if (numberMatch) {
            const projectNumber = parseInt(numberMatch[0]) - 1; // Convert to 0-based index
            if (projectNumber >= 0 && projectNumber < allProjects.length) {
              selectedProject = allProjects[projectNumber];
            }
          }
        }
      }

      if (!selectedProject) {
        return {
          success: false,
          error: `Could not find project "${projectName}"`,
          message: `I couldn't find a project named "${projectName}". Would you like me to list your available projects?`,
          availableProjects: allProjects.map((p: any) => p.name)
        };
      }

      // Handle GitHub repos differently
      if (selectedProject.source === 'github') {
        // Store GitHub repo selection
        this.selectedProjects.set(sessionId, {
          projectId: selectedProject.id, // e.g., "github:owner/repo"
          projectName: selectedProject.name,
          projectDescription: selectedProject.description,
          isGitHubRepo: true,
          githubRepo: {
            fullName: selectedProject.fullName,
            owner: selectedProject.fullName.split('/')[0],
            repo: selectedProject.fullName.split('/')[1],
            defaultBranch: selectedProject.defaultBranch
          }
        });

        logger.info(`GitHub repo selected: ${selectedProject.fullName} for session ${sessionId}`);

        return {
          success: true,
          project: {
            id: selectedProject.id,
            name: selectedProject.name,
            fullName: selectedProject.fullName,
            description: selectedProject.description || 'No description',
            language: selectedProject.language,
            htmlUrl: selectedProject.htmlUrl,
            source: 'github',
            canPreview: false
          },
          message: `Perfect! I've selected "${selectedProject.fullName}" as the active repository. This is a ${selectedProject.language || 'code'} project on GitHub. While I can't preview it in the browser, I can help you with:\n- Reading and analyzing code files\n- Writing new scripts (quests, items, etc.)\n- Debugging and fixing issues\n- Suggesting improvements\n- Creating commits and pull requests\n\nWhat would you like to work on?`
        };
      }

      // Handle platform projects
      const { projectService } = await import('../services/ProjectService');
      const platformProjects = await projectService.getUserProjects(userId);
      const platformProject = platformProjects.find(p => p.id.toString() === selectedProject.id);

      if (!platformProject) {
        return {
          success: false,
          error: `Could not find platform project "${selectedProject.id}"`,
          message: 'The selected project could not be found in the database.'
        };
      }

      // Get project files for description
      const projectFiles = await projectService.getProjectFiles(platformProject.id);
      
      // Store selected project in session
      this.selectedProjects.set(sessionId, {
        projectId: platformProject.id.toString(),
        projectName: platformProject.name,
        projectDescription: platformProject.description ?? undefined,
        isGitHubRepo: false
      });

      logger.info(`Project selected: ${platformProject.name} (ID: ${platformProject.id}) for session ${sessionId}`);

      return {
        success: true,
        project: {
          id: platformProject.id.toString(),
          name: platformProject.name,
          description: platformProject.description || 'No description',
          fileCount: projectFiles.length,
          type: platformProject.projectType,
          source: 'platform',
          canPreview: true
        },
        message: `Perfect! I've selected "${platformProject.name}" as the active project. This project has ${projectFiles.length} file(s). What would you like to do with it?`
      };
    } catch (error) {
      logger.error('Error selecting project', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Generate code in the playground
   * This method triggers code generation by calling the IncrementalOrchestrator directly
   */
  private async generateCode(params: Record<string, any>): Promise<any> {
    const prompt = params.prompt as string;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      // Normalize prompt for intent detection
      const normalizedPrompt = (prompt || '').toLowerCase();

      // Heuristic: does the user clearly ask for a *new* project/app from scratch?
      const wantsNewProject =
        /\b(ny(?:tt)?\s+(?:projekt|app|applikation|webbapp|hemsida|site|projektidé))\b/.test(
          normalizedPrompt
        ) ||
        /\bskapa\s+ett?\s+nytt?\s+(?:projekt|app|applikation|webbapp|hemsida|site)\b/.test(
          normalizedPrompt
        ) ||
        /\b(create|build|make)\s+(a\s+)?new\s+(app|application|project|site|website)\b/i.test(
          prompt || ''
        ) ||
        /\bfrom scratch\b/i.test(prompt || '');

      // Determine which project to use: explicit projectId, selected project, or auto-created project
      let targetProjectId = projectId;
      let targetProjectName = 'the project';

      // If user explicitly asks for a "new project/app", ignore any explicit projectId
      if (targetProjectId && wantsNewProject) {
        logger.info(
          `generateCode: overriding explicit projectId=${targetProjectId} due to new-project intent in prompt`
        );
        targetProjectId = undefined;
      }

      if (!targetProjectId && sessionId) {
        // Check if there's a selected project for this session, unless the user is clearly asking for a new project
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject && !wantsNewProject) {
          targetProjectId = selectedProject.projectId;
          targetProjectName = selectedProject.projectName;
          logger.info(
            `Using selected project from session: ${targetProjectName} (${targetProjectId})`
          );
        } else if (selectedProject && wantsNewProject) {
          logger.info(
            `generateCode: user asked for a new project, ignoring previously selected project ${selectedProject.projectId}`
          );
        }
      }

      if (!userId) {
        logger.error('generateCode called without userId');
        return {
          success: false,
          error: 'User ID is required for code generation',
          message: 'I need your user ID to generate code. Please try again or use the web playground.'
        };
      }

      // If no project is selected/explicit, automatically create a new workspace for this request.
      // This is especially useful for Discord flows where the user just says
      // "bygg en mini-transformer i python" utan att välja projekt först.
      if (!targetProjectId) {
        try {
          const { ProjectService } = await import('../services/ProjectService');
          const projectService = new ProjectService();

          // Derive a reasonable default name from the prompt (first sentence, trimmed & truncated)
          const firstSentence =
            (prompt || '')
              .split(/[\.\n]/)[0]
              .trim();

          const projectName =
            (firstSentence && firstSentence.slice(0, 80)) || 'Nytt AI-projekt';

          const description = `Created automatically from assistant request: "${prompt
            .slice(0, 120)
            .replace(/[\r\n]+/g, ' ')}..."`;

          const newProject = await projectService.createProject({
            name: projectName,
            description,
            projectType: 'web_app',
            ownerId: userId,
            // Let service apply its own defaults for optional fields
            agentConfig: undefined,
            testCases: undefined,
            settings: undefined,
          });

          targetProjectId = String(newProject.id);
          targetProjectName = newProject.name;

          // Remember as selected project for this conversation/session
          if (sessionId) {
            this.selectedProjects.set(sessionId, {
              projectId: targetProjectId,
              projectName: targetProjectName,
            });
          }

          logger.info(
            `Auto-created project for generateCode: ${targetProjectName} (${targetProjectId}) for user ${userId}`
          );
        } catch (createError) {
          logger.error('Failed to auto-create project for generateCode', createError as Error);
          return {
            success: false,
            error: 'Failed to create project',
            message:
              'I tried to create a new project for your request but something went wrong. Please create a project on the web and try again, or select an existing project.',
          };
        }
      }

      logger.info(
        `Generating code: prompt="${prompt.substring(0, 100)}...", projectId=${targetProjectId || 'none'}, userId=${userId || 'none'}`
      );

      if (!targetProjectId) {
        return {
          success: false,
          error: 'No project selected',
          message: 'I need to know which project to generate code for. Please select a project first using the select_project tool, or specify a project ID.'
        };
      }

      // Import IncrementalOrchestrator and related services
      const { IncrementalOrchestrator } = await import('../services/IncrementalOrchestrator');
      const { knowledgeService } = await import('../services/KnowledgeService');
      const orchestrator = new IncrementalOrchestrator();
      
      const workflowId = `discord-gen-${Date.now()}`;
      
      // Get knowledge context
      const knowledgeContext = await knowledgeService.getRelevantKnowledge(prompt, userId);
      
      // Load existing project files
      let existingProjectFiles: { path: string; content: string }[] = [];
      if (targetProjectId) {
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
          
          logger.info(`Loaded ${existingProjectFiles.length} existing files for project ${targetProjectId} (${targetProjectName})`);
        } catch (error) {
          logger.warn(`Failed to load project files: ${error instanceof Error ? error.message : String(error)}`);
        }
      }

      // Start generation asynchronously (don't block the response)
      setImmediate(async () => {
        try {
          logger.info(`Starting code generation workflow: ${workflowId}`);
          
          // Step 1: Create generation plan using AnalysisAgent
          const { AnalysisAgent } = await import('../services/AnalysisAgent');
          const analysisAgent = new AnalysisAgent();
          
          const formatKnowledgeContext = (context: any): string => {
            if (!context || !context.items || context.items.length === 0) return '';
            return context.items.map((item: any) => 
              `**${item.title || 'Knowledge Item'}**\n${item.content || item.description || ''}`
            ).join('\n\n');
          };
          
          // Format prompt with clear instructions for modifications
          const formattedPrompt = existingProjectFiles.length > 0
            ? `MODIFY EXISTING PROJECT: ${prompt}\n\nIMPORTANT: This is a modification request. You must:\n1. Read and understand the existing code structure\n2. Make ONLY the requested changes\n3. Preserve all existing functionality unless explicitly asked to change it\n4. Maintain code style and patterns from existing files\n5. Avoid logical errors (e.g., don't compare functions to function literals)\n6. Ensure all comparisons are logically sound\n\nUser's request: ${prompt}`
            : prompt;
          
          const plan = await analysisAgent.analyzeAndPlan(
            formattedPrompt,
            formatKnowledgeContext(knowledgeContext),
            existingProjectFiles
          );
          
          logger.info(`Generation plan created: ${plan.appName} with ${plan.phases.length} phases`);
          
          // Emit plan created event
          agentEventEmitter.emit('agent-event', {
            type: 'PLAN_CREATED',
            agent: 'personal-assistant',
            agentId: 'personal-assistant',
            workflowId,
            projectId: targetProjectId,
            projectName: targetProjectName,
            plan: {
              appName: plan.appName,
              phases: plan.phases.length
            },
            timestamp: Date.now(),
          });

          // Step 2: Generate code incrementally using the plan
          const result = await orchestrator.generateIncrementally(
            plan,
            prompt,
            formatKnowledgeContext(knowledgeContext),
            existingProjectFiles,
            (phase, progress, message) => {
              logger.info(`Phase progress: ${phase}, ${progress}%, ${message}`);
              
              // Emit phase progress event for frontend
              agentEventEmitter.emit('agent-event', {
                type: 'PHASE_PROGRESS',
                agent: 'personal-assistant',
                agentId: 'personal-assistant',
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
              
              // Emit file generated event for frontend
              agentEventEmitter.emit('agent-event', {
                type: 'FILE_GENERATED',
                agent: 'personal-assistant',
                agentId: 'personal-assistant',
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
          
          // Step 3: Save files to project
          if (targetProjectId && result.allFiles && result.allFiles.length > 0) {
            try {
              const { projectFiles } = await import('../../db/schema-pg');
              const { eq, and } = await import('drizzle-orm');
              const { db } = await import('../../db');
              
              // Save each file to the project
              for (let i = 0; i < result.allFiles.length; i++) {
                const file = result.allFiles[i];
                // Check if file already exists
                const existing = await db
                  .select()
                  .from(projectFiles as any)
                  .where(
                    and(
                      eq((projectFiles as any).projectId, parseInt(targetProjectId)),
                      eq((projectFiles as any).filePath, file.path),
                      eq((projectFiles as any).isActive, 1)
                    )
                  )
                  .limit(1);
                
                if (existing.length > 0) {
                  // Update existing file
                  await db
                    .update(projectFiles as any)
                    .set({
                      fileContent: file.content,
                      updatedAt: new Date(),
                      lastModifiedBy: userId
                    })
                    .where(eq((projectFiles as any).id, existing[0].id));
                } else {
                  // Create new file
                  await db.insert(projectFiles as any).values({
                    projectId: parseInt(targetProjectId),
                    filePath: file.path,
                    fileContent: file.content,
                    fileType: file.path.split('.').pop() || 'txt',
                    isActive: 1,
                    createdBy: userId,
                    lastModifiedBy: userId,
                    createdAt: new Date(),
                    updatedAt: new Date()
                  });
                }
                
                // Emit file saved event for frontend
                agentEventEmitter.emit('agent-event', {
                  type: 'FILE_SAVED',
                  agent: 'personal-assistant',
                  agentId: 'personal-assistant',
                  workflowId,
                  projectId: targetProjectId,
                  file: {
                    path: file.path,
                    size: file.content.length
                  },
                  index: i + 1,
                  total: result.allFiles.length,
                  timestamp: Date.now(),
                });
              }
              
              logger.info(`Saved ${result.allFiles.length} files to project ${targetProjectId} (${targetProjectName})`);
            } catch (saveError) {
              logger.error(`Failed to save files to project: ${saveError instanceof Error ? saveError.message : String(saveError)}`);
            }
          }
          
          logger.info(`Code generation completed: ${workflowId}, filesGenerated=${result.allFiles.length}`);
          
          // Emit completion event for frontend
          agentEventEmitter.emit('agent-event', {
            type: 'GENERATION_COMPLETE',
            agent: 'personal-assistant',
            agentId: 'personal-assistant',
            workflowId,
            projectId: targetProjectId,
            projectName: targetProjectName,
            filesGenerated: result.allFiles.length,
            timestamp: Date.now(),
          });
        } catch (error) {
          logger.error('Error in background code generation', error as Error);
          
          // Emit error event
          agentEventEmitter.emit('agent-event', {
            type: 'GENERATION_ERROR',
            agent: 'personal-assistant',
            agentId: 'personal-assistant',
            workflowId,
            projectId: targetProjectId,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: Date.now(),
          });
        }
      });

      // Emit start event immediately
      agentEventEmitter.emit('agent-event', {
        type: 'GENERATION_START',
        agent: 'personal-assistant',
        agentId: 'personal-assistant',
        workflowId,
        projectId: targetProjectId,
        projectName: targetProjectName,
        prompt: prompt.substring(0, 100),
        timestamp: Date.now(),
      });

      return {
        success: true,
        message: `Code generation started for "${targetProjectName}"! I'm working on your request now. This will take a moment - you can check the playground to see the progress. The generation is running in the background.`,
        workflowId,
        projectId: targetProjectId,
        projectName: targetProjectName,
        prompt: prompt.substring(0, 100)
      };
    } catch (error) {
      logger.error('Error generating code', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Deploy a project to Vercel
   */
  private async deployToVercel(params: Record<string, any>): Promise<any> {
    const projectId = params.projectId as string | undefined;
    const projectName = params.projectName as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;
    const discordContext = params._discordContext as any | undefined;

    try {
      // Determine which project to use
      let targetProjectId = projectId;
      let targetProjectName = projectName || 'the project';

      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
          targetProjectName = selectedProject.projectName;
          logger.info(`Using selected project for deployment: ${targetProjectName} (${targetProjectId})`);
        }
      }

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required for deployment',
          message: 'I need your user ID to deploy. Please ensure you are logged in.'
        };
      }

      if (!targetProjectId) {
        return {
          success: false,
          error: 'No project selected',
          message: 'I need to know which project to deploy. Please select a project first using the select_project tool, or specify a project ID.'
        };
      }

      logger.info(`Starting deployment: projectId=${targetProjectId}, projectName=${targetProjectName}, userId=${userId}`);

      // Load project files
      const { projectFiles, workspaces } = await import('../../db/schema-pg');
      const { eq, and } = await import('drizzle-orm');
      const { db } = await import('../../db');

      // Get project files
      const files = await db
        .select()
        .from(projectFiles as any)
        .where(
          and(
            eq((projectFiles as any).projectId, parseInt(targetProjectId)),
            eq((projectFiles as any).isActive, 1)
          )
        );

      if (files.length === 0) {
        return {
          success: false,
          error: 'No files found in project',
          message: 'The project has no files to deploy. Please generate some code first.'
        };
      }

      // Get project/workspace info
      const workspaceRecords = await db
        .select()
        .from(workspaces as any)
        .where(eq((workspaces as any).id, parseInt(targetProjectId)))
        .limit(1);

      const workspace = workspaceRecords.length > 0 ? workspaceRecords[0] : null;
      
      // Get project name from workspace, selected project, or generate one
      let rawProjectName = workspace?.name || targetProjectName;
      
      // If still no name, try to get from selected project
      if ((!rawProjectName || rawProjectName === 'the project') && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject?.projectName) {
          rawProjectName = selectedProject.projectName;
        }
      }
      
      // Sanitize project name for GitHub (lowercase, alphanumeric + hyphens, max 100 chars)
      const sanitizeProjectName = (name: string): string => {
        return name
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, '-') // Replace invalid chars with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
          .substring(0, 100) // Max 100 chars
          || 'my-app'; // Fallback if empty
      };
      
      let deploymentProjectName = sanitizeProjectName(rawProjectName || `project-${targetProjectId}`);
      
      // Final validation - ensure name is not empty
      if (!deploymentProjectName || deploymentProjectName.trim().length === 0) {
        deploymentProjectName = `project-${targetProjectId}`;
        logger.warn(`Deployment project name was empty, using fallback: ${deploymentProjectName}`);
      }
      
      logger.info(`Deployment project name: raw="${rawProjectName}", sanitized="${deploymentProjectName}", workspaceFound=${!!workspace}`);

      // Convert files to GeneratedFile format
      const generatedFiles = files.map((f: any) => ({
        path: f.filePath,
        content: f.fileContent || ''
      }));

      // Import deployment service
      const { ProductionDeploymentService } = await import('../services/ProductionDeploymentService');
      const deploymentService = new ProductionDeploymentService();

      // Determine framework from files
      const hasNextConfig = generatedFiles.some(f => f.path.includes('next.config') || f.path.includes('package.json') && f.content.includes('next'));
      const hasViteConfig = generatedFiles.some(f => f.path.includes('vite.config') || f.path.includes('package.json') && f.content.includes('vite'));
      const framework = hasNextConfig ? 'next' : hasViteConfig ? 'vite' : 'react';

      // Start deployment in background
      setImmediate(async () => {
        try {
          logger.info(`Starting Vercel deployment: projectId=${targetProjectId}, framework=${framework}`);

          const deploymentResult = await deploymentService.deployToProduction(
            generatedFiles,
            {
              projectName: deploymentProjectName,
              repoName: deploymentProjectName, // Use same sanitized name for GitHub repo
              framework: (framework === 'next' ? 'nextjs' : framework) as 'react' | 'nextjs' | 'vite',
              workspaceId: parseInt(targetProjectId),
              description: `Deployed from ${targetProjectName || 'project'}`
            },
            userId
          );

          if (deploymentResult.success && deploymentResult.vercelUrl) {
            logger.info(`Deployment successful: ${deploymentResult.vercelUrl}`);

            // Send message to Discord if this was initiated from Discord
            if (discordContext && discordContext.channelId) {
              try {
                const { discordBotService } = await import('../services/DiscordBotService');
                const message = `✅ **Deployment klar!**\n\nDin app är nu live på:\n🌐 ${deploymentResult.vercelUrl}\n\nGitHub Repository: ${deploymentResult.githubUrl || 'N/A'}`;
                
                if (discordBotService.isBotConnected()) {
                  await discordBotService.sendMessage(discordContext.channelId, message);
                } else {
                  await discordService.sendMessage({
                    content: message,
                    username: 'Elon AI'
                  });
                }
              } catch (discordError) {
                logger.error('Failed to send deployment message to Discord', discordError as Error);
              }
            }

            // Emit deployment complete event
            agentEventEmitter.emit('agent-event', {
              type: 'DEPLOYMENT_COMPLETE',
              agent: 'personal-assistant',
              agentId: 'personal-assistant',
              projectId: targetProjectId,
              projectName: targetProjectName,
              vercelUrl: deploymentResult.vercelUrl,
              githubUrl: deploymentResult.githubUrl,
              timestamp: Date.now(),
            });
          } else {
            logger.error(`Deployment failed: ${deploymentResult.error}`);

            // Send error message to Discord if this was initiated from Discord
            if (discordContext && discordContext.channelId) {
              try {
                const { discordBotService } = await import('../services/DiscordBotService');
                const message = `❌ **Deployment misslyckades**\n\nFel: ${deploymentResult.error || 'Okänt fel'}`;
                
                if (discordBotService.isBotConnected()) {
                  await discordBotService.sendMessage(discordContext.channelId, message);
                } else {
                  await discordService.sendMessage({
                    content: message,
                    username: 'Elon AI'
                  });
                }
              } catch (discordError) {
                logger.error('Failed to send deployment error message to Discord', discordError as Error);
              }
            }

            // Emit deployment error event
            agentEventEmitter.emit('agent-event', {
              type: 'DEPLOYMENT_ERROR',
              agent: 'personal-assistant',
              agentId: 'personal-assistant',
              projectId: targetProjectId,
              error: deploymentResult.error || 'Unknown error',
              timestamp: Date.now(),
            });
          }
        } catch (error) {
          logger.error('Error in background deployment', error as Error);
          
          // Send error message to Discord if this was initiated from Discord
          if (discordContext && discordContext.channelId) {
            try {
              const { discordBotService } = await import('../services/DiscordBotService');
              const message = `❌ **Deployment misslyckades**\n\nFel: ${error instanceof Error ? error.message : 'Okänt fel'}`;
              
              if (discordBotService.isBotConnected()) {
                await discordBotService.sendMessage(discordContext.channelId, message);
              } else {
                await discordService.sendMessage({
                  content: message,
                  username: 'Elon AI'
                });
              }
            } catch (discordError) {
              logger.error('Failed to send deployment error message to Discord', discordError as Error);
            }
          }
        }
      });

      return {
        success: true,
        message: `Deployment startat för "${targetProjectName}"! Jag arbetar på att deploya din app till Vercel nu. Detta kan ta några minuter. Jag skickar dig en länk när det är klart!`,
        projectId: targetProjectId,
        projectName: targetProjectName
      };
    } catch (error) {
      logger.error('Error deploying to Vercel', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Read a file from a project
   */
  private async readFile(params: Record<string, any>): Promise<any> {
    const filePath = params.filePath as string;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;
    const analyze = params.analyze !== false; // Default to true

    try {
      // Determine which project to use
      let targetProjectId = projectId;
      let selectedProject = sessionId ? this.selectedProjects.get(sessionId) : undefined;

      if (!targetProjectId && selectedProject) {
        targetProjectId = selectedProject.projectId;
      }

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required to read files',
          message: 'I need your user ID to read files. Please ensure you are logged in.'
        };
      }

      if (!targetProjectId) {
        return {
          success: false,
          error: 'No project selected',
          message: 'I need to know which project to read from. Please select a project first using the select_project tool, or specify a project ID.'
        };
      }

      logger.info(`Reading file: ${filePath} from project ${targetProjectId}`);

      // Check if this is a GitHub repo
      if (targetProjectId.startsWith('github:') || (selectedProject && (selectedProject as any).isGitHubRepo)) {
        const githubRepo = (selectedProject as any)?.githubRepo;
        if (!githubRepo) {
          // Parse from projectId if not in selectedProject
          const match = targetProjectId.match(/^github:(.+)\/(.+)$/);
          if (!match) {
            return {
              success: false,
              error: 'Invalid GitHub repo format',
              message: 'GitHub repo ID must be in format "github:owner/repo"'
            };
          }
          githubRepo.owner = match[1];
          githubRepo.repo = match[2];
        }

        // Read file from GitHub using GitHub API
        try {
          const { pluginRegistry } = await import('../services/PluginRegistry');
          const userPlugins = await pluginRegistry.getAvailableTools(userId);
          const githubPlugin = userPlugins.find((tool: Tool) => tool.name === 'read_file' || tool.name === 'github_read_file');
          
          if (!githubPlugin) {
            return {
              success: false,
              error: 'GitHub plugin not available',
              message: 'GitHub plugin is required to read files from GitHub repositories. Please connect your GitHub account in the integrations page.'
            };
          }

          // Use GitHub API to read file
          const { Octokit } = await import('@octokit/rest');
          const { db } = await import('../../db');
          const { pluginConfigs } = await import('../../db/schema-pg');
          const { eq, and } = await import('drizzle-orm');
          const githubConfig = await db.query.pluginConfigs.findFirst({
            where: and(
              eq(pluginConfigs.userId, userId),
              eq(pluginConfigs.pluginId, 'github'),
              eq(pluginConfigs.enabled, true)
            )
          });
          
          if (!githubConfig) {
            return {
              success: false,
              error: 'GitHub not connected',
              message: 'GitHub account is not connected. Please connect it in the integrations page.'
            };
          }
          
          // Decrypt credentials
          const { CredentialVault } = await import('../services/CredentialVault');
          const credentialVault = new CredentialVault();
          if (!githubConfig.credentials || typeof githubConfig.credentials !== 'string') {
            return {
              success: false,
              error: 'GitHub not connected',
              message: 'GitHub account is not connected. Please connect it in the integrations page.'
            };
          }
          const github = {
            id: githubConfig.pluginId,
            credentials: credentialVault.decrypt(githubConfig.credentials) as any
          };
          
          if (!github || !github.credentials?.accessToken) {
            return {
              success: false,
              error: 'GitHub not connected',
              message: 'GitHub account is not connected. Please connect it in the integrations page.'
            };
          }

          const octokit = new Octokit({ auth: github.credentials.accessToken });
          const branch = githubRepo.defaultBranch || 'main';
          
          try {
            const { data } = await octokit.repos.getContent({
              owner: githubRepo.owner,
              repo: githubRepo.repo,
              path: filePath,
              ref: branch
            });

            if (Array.isArray(data)) {
              return {
                success: false,
                error: 'Path is a directory',
                message: `"${filePath}" is a directory, not a file. Please specify a file path.`
              };
            }

            if (data.type !== 'file' || !('content' in data)) {
              return {
                success: false,
                error: 'Not a file',
                message: `"${filePath}" is not a readable file.`
              };
            }

            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            const fileType = filePath.split('.').pop()?.toLowerCase() || 'unknown';

            let analysis = '';
            if (analyze && content) {
              const lines = content.split('\n').length;
              analysis = `\n\n**Analysis:**\n- File type: ${fileType}\n- Lines: ${lines}\n- Size: ${content.length} characters\n- Repository: ${githubRepo.owner}/${githubRepo.repo}\n- Branch: ${branch}`;
            }

            return {
              success: true,
              filePath: filePath,
              content: content,
              fileType: fileType,
              repository: `${githubRepo.owner}/${githubRepo.repo}`,
              branch: branch,
              sha: data.sha,
              lastModified: undefined, // GitHub API doesn't provide updated_at/created_at in getContent response
              analysis
            };
          } catch (error: any) {
            if (error.status === 404) {
              return {
                success: false,
                error: 'File not found',
                message: `File "${filePath}" not found in repository ${githubRepo.owner}/${githubRepo.repo} on branch ${branch}.`
              };
            }
            throw error;
          }
        } catch (error) {
          logger.error('Error reading file from GitHub', error as Error);
          return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            errorLog: error instanceof Error ? error.stack : String(error)
          };
        }
      }

      // Handle platform projects
      const { ProjectService } = await import('../services/ProjectService');
      const projectService = new ProjectService();

      // Check project access
      const hasAccess = await projectService.checkProjectAccess(parseInt(targetProjectId), userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'Access denied',
          message: 'You do not have access to this project.'
        };
      }

      // Get project files
      const files = await projectService.getProjectFiles(parseInt(targetProjectId));
      const file = files.find(f => f.filePath === filePath);

      if (!file) {
        return {
          success: false,
          error: 'File not found',
          message: `File "${filePath}" not found in project. Available files: ${files.slice(0, 10).map(f => f.filePath).join(', ')}${files.length > 10 ? '...' : ''}`
        };
      }

      let analysis = '';
      if (analyze && file.fileContent) {
        // Simple analysis based on file type
        const fileType = filePath.split('.').pop()?.toLowerCase();
        if (fileType === 'tsx' || fileType === 'ts' || fileType === 'jsx' || fileType === 'js') {
          analysis = `\n\n**Analysis:**\n- File type: ${fileType}\n- Lines: ${file.fileContent.split('\n').length}\n- Size: ${file.fileContent.length} characters`;
        }
      }

      return {
        success: true,
        filePath: file.filePath,
        content: file.fileContent,
        fileType: file.fileType,
        version: file.version,
        lastModified: file.updatedAt,
        analysis
      };
    } catch (error) {
      logger.error('Error reading file', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Write a file to a project (create or update)
   */
  private async writeFile(params: Record<string, any>): Promise<any> {
    const filePath = params.filePath as string;
    const content = params.content as string;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      // Determine which project to use
      let targetProjectId = projectId;
      let targetProjectName = 'the project';

      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
          targetProjectName = selectedProject.projectName;
        }
      }

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required to write files',
          message: 'I need your user ID to write files. Please ensure you are logged in.'
        };
      }

      if (!targetProjectId) {
        return {
          success: false,
          error: 'No project selected',
          message: 'I need to know which project to write to. Please select a project first using the select_project tool, or specify a project ID.'
        };
      }

      if (!filePath || !content) {
        return {
          success: false,
          error: 'Missing parameters',
          message: 'Both filePath and content are required.'
        };
      }

      logger.info(`Writing file: ${filePath} to project ${targetProjectId}`);

      // Import ProjectService
      const { ProjectService } = await import('../services/ProjectService');
      const projectService = new ProjectService();

      // Check project access
      const hasAccess = await projectService.checkProjectAccess(parseInt(targetProjectId), userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'Access denied',
          message: 'You do not have access to this project.'
        };
      }

      // Check if file exists
      const files = await projectService.getProjectFiles(parseInt(targetProjectId));
      const existingFile = files.find(f => f.filePath === filePath);

      if (existingFile) {
        // Update existing file
        await projectService.updateProjectFileByPath(parseInt(targetProjectId), filePath, userId, content);
        
        // Emit file updated event
        agentEventEmitter.emit('agent-event', {
          type: 'FILE_UPDATED',
          agent: 'personal-assistant',
          agentId: 'personal-assistant',
          projectId: targetProjectId,
          file: {
            path: filePath,
            size: content.length
          },
          timestamp: Date.now(),
        });

        return {
          success: true,
          message: `File "${filePath}" updated successfully in "${targetProjectName}"`,
          filePath,
          action: 'updated'
        };
      } else {
        // Create new file
        await projectService.createProjectFile(parseInt(targetProjectId), filePath, content, userId);
        
        // Emit file created event
        agentEventEmitter.emit('agent-event', {
          type: 'FILE_CREATED',
          agent: 'personal-assistant',
          agentId: 'personal-assistant',
          projectId: targetProjectId,
          file: {
            path: filePath,
            size: content.length
          },
          timestamp: Date.now(),
        });

        return {
          success: true,
          message: `File "${filePath}" created successfully in "${targetProjectName}"`,
          filePath,
          action: 'created'
        };
      }
    } catch (error) {
      logger.error('Error writing file', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Edit a specific part of a file
   */
  private async editFile(params: Record<string, any>): Promise<any> {
    const filePath = params.filePath as string;
    const changes = params.changes as string;
    const newContent = params.newContent as string;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      // Determine which project to use
      let targetProjectId = projectId;
      let targetProjectName = 'the project';

      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
          targetProjectName = selectedProject.projectName;
        }
      }

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required to edit files',
          message: 'I need your user ID to edit files. Please ensure you are logged in.'
        };
      }

      if (!targetProjectId) {
        return {
          success: false,
          error: 'No project selected',
          message: 'I need to know which project to edit. Please select a project first using the select_project tool, or specify a project ID.'
        };
      }

      if (!filePath || !changes || !newContent) {
        return {
          success: false,
          error: 'Missing parameters',
          message: 'filePath, changes, and newContent are all required.'
        };
      }

      logger.info(`Editing file: ${filePath} in project ${targetProjectId}`);

      // Import ProjectService
      const { ProjectService } = await import('../services/ProjectService');
      const projectService = new ProjectService();

      // Check project access
      const hasAccess = await projectService.checkProjectAccess(parseInt(targetProjectId), userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'Access denied',
          message: 'You do not have access to this project.'
        };
      }

      // Read current file
      const files = await projectService.getProjectFiles(parseInt(targetProjectId));
      const file = files.find(f => f.filePath === filePath);

      if (!file) {
        return {
          success: false,
          error: 'File not found',
          message: `File "${filePath}" not found in project. Use write_file to create a new file.`
        };
      }

      // Simple edit: replace the old content with new content
      // In a more advanced implementation, we could use AST parsing or regex matching
      // For now, we'll do a simple string replacement based on the changes description
      let updatedContent = file.fileContent;

      // Try to find and replace the section described in changes
      // This is a simple implementation - could be enhanced with AST parsing
      if (changes.includes('replace') || changes.includes('Replace')) {
        // Extract the old content pattern from changes description
        // For now, we'll use the newContent to replace matching sections
        // In practice, the AI should provide enough context in newContent to identify what to replace
        updatedContent = newContent; // Simplified: replace entire content
      } else if (changes.includes('add') || changes.includes('Add')) {
        // Add new content
        updatedContent = file.fileContent + '\n\n' + newContent;
      } else if (changes.includes('remove') || changes.includes('Remove') || changes.includes('delete')) {
        // Remove content - this is more complex and would need pattern matching
        // For now, we'll use newContent as the replacement
        updatedContent = newContent;
      } else {
        // Default: replace entire content with new content
        updatedContent = newContent;
      }

      // Update the file
      await projectService.updateProjectFileByPath(parseInt(targetProjectId), filePath, userId, updatedContent);

      // Emit file updated event
      agentEventEmitter.emit('agent-event', {
        type: 'FILE_UPDATED',
        agent: 'personal-assistant',
        agentId: 'personal-assistant',
        projectId: targetProjectId,
        file: {
          path: filePath,
          size: updatedContent.length
        },
        timestamp: Date.now(),
      });

      return {
        success: true,
        message: `File "${filePath}" edited successfully in "${targetProjectName}"`,
        filePath,
        action: 'edited',
        changes: changes
      };
    } catch (error) {
      logger.error('Error editing file', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Delete a file from a project
   */
  private async deleteFile(params: Record<string, any>): Promise<any> {
    const filePath = params.filePath as string;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      // Determine which project to use
      let targetProjectId = projectId;
      let targetProjectName = 'the project';

      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
          targetProjectName = selectedProject.projectName;
        }
      }

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required to delete files',
          message: 'I need your user ID to delete files. Please ensure you are logged in.'
        };
      }

      if (!targetProjectId) {
        return {
          success: false,
          error: 'No project selected',
          message: 'I need to know which project to delete from. Please select a project first using the select_project tool, or specify a project ID.'
        };
      }

      if (!filePath) {
        return {
          success: false,
          error: 'Missing filePath',
          message: 'filePath is required to delete a file.'
        };
      }

      logger.info(`Deleting file: ${filePath} from project ${targetProjectId}`);

      // Import ProjectService
      const { ProjectService } = await import('../services/ProjectService');
      const projectService = new ProjectService();

      // Check project access
      const hasAccess = await projectService.checkProjectAccess(parseInt(targetProjectId), userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'Access denied',
          message: 'You do not have access to this project.'
        };
      }

      // Delete the file
      await projectService.deleteProjectFile(parseInt(targetProjectId), filePath, userId);

      // Emit file deleted event
      agentEventEmitter.emit('agent-event', {
        type: 'FILE_DELETED',
        agent: 'personal-assistant',
        agentId: 'personal-assistant',
        projectId: targetProjectId,
        file: {
          path: filePath
        },
        timestamp: Date.now(),
      });

      return {
        success: true,
        message: `File "${filePath}" deleted successfully from "${targetProjectName}"`,
        filePath,
        action: 'deleted'
      };
    } catch (error) {
      logger.error('Error deleting file', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Create a directory in a project
   */
  private async createDirectory(params: Record<string, any>): Promise<any> {
    const directoryPath = params.directoryPath as string;
    const addPlaceholder = params.addPlaceholder !== false; // Default to true
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      // Determine which project to use
      let targetProjectId = projectId;
      let targetProjectName = 'the project';

      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
          targetProjectName = selectedProject.projectName;
        }
      }

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required to create directories',
          message: 'I need your user ID to create directories. Please ensure you are logged in.'
        };
      }

      if (!targetProjectId) {
        return {
          success: false,
          error: 'No project selected',
          message: 'I need to know which project to create the directory in. Please select a project first using the select_project tool, or specify a project ID.'
        };
      }

      if (!directoryPath) {
        return {
          success: false,
          error: 'Missing directoryPath',
          message: 'directoryPath is required to create a directory.'
        };
      }

      logger.info(`Creating directory: ${directoryPath} in project ${targetProjectId}`);

      // Import ProjectService
      const { ProjectService } = await import('../services/ProjectService');
      const projectService = new ProjectService();

      // Check project access
      const hasAccess = await projectService.checkProjectAccess(parseInt(targetProjectId), userId);
      if (!hasAccess) {
        return {
          success: false,
          error: 'Access denied',
          message: 'You do not have access to this project.'
        };
      }

      // Create placeholder file to represent the directory
      // In our system, directories are represented by files
      const placeholderPath = directoryPath.endsWith('/') 
        ? `${directoryPath}index.ts` 
        : `${directoryPath}/index.ts`;
      
      const placeholderContent = addPlaceholder
        ? `// Directory: ${directoryPath}\n// This file ensures the directory is tracked in the project\n\nexport {};\n`
        : '';

      if (addPlaceholder) {
        // Check if placeholder already exists
        const files = await projectService.getProjectFiles(parseInt(targetProjectId));
        const existing = files.find(f => f.filePath === placeholderPath);

        if (!existing) {
          await projectService.createProjectFile(parseInt(targetProjectId), placeholderPath, placeholderContent, userId);
        }
      }

      // Emit directory created event
      agentEventEmitter.emit('agent-event', {
        type: 'DIRECTORY_CREATED',
        agent: 'personal-assistant',
        agentId: 'personal-assistant',
        projectId: targetProjectId,
        directory: {
          path: directoryPath
        },
        timestamp: Date.now(),
      });

      return {
        success: true,
        message: `Directory "${directoryPath}" created successfully in "${targetProjectName}"${addPlaceholder ? ' (with placeholder file)' : ''}`,
        directoryPath,
        placeholderPath: addPlaceholder ? placeholderPath : undefined,
        action: 'created'
      };
    } catch (error) {
      logger.error('Error creating directory', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Git commit - uses GitHub plugin for GitHub repos
   */
  private async gitCommit(params: Record<string, any>): Promise<any> {
    const message = params.message as string;
    const files = params.files as string[] | undefined;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      if (!userId) {
        return { success: false, error: 'User ID required', message: 'Please ensure you are logged in.' };
      }

      let targetProjectId = projectId;
      const selectedProject = sessionId ? this.selectedProjects.get(sessionId) : undefined;
      if (!targetProjectId && selectedProject) {
        targetProjectId = selectedProject.projectId;
      }

      if (!targetProjectId) {
        return { success: false, error: 'No project selected', message: 'Please select a project first.' };
      }

      // Check if it's a GitHub repo
      if (targetProjectId.startsWith('github:') || (selectedProject && (selectedProject as any).isGitHubRepo)) {
        const githubRepo = (selectedProject as any)?.githubRepo;
        if (!githubRepo) {
          return { success: false, error: 'GitHub repo not found', message: 'GitHub repository information is missing.' };
        }

        const { db } = await import('../../db');
        const { pluginConfigs } = await import('../../db/schema-pg');
        const { eq, and } = await import('drizzle-orm');
        const githubConfig = await db.query.pluginConfigs.findFirst({
          where: and(
            eq(pluginConfigs.userId, userId),
            eq(pluginConfigs.pluginId, 'github'),
            eq(pluginConfigs.enabled, true)
          )
        });
        
        if (!githubConfig) {
          return { success: false, error: 'GitHub not connected', message: 'Please connect your GitHub account in the integrations page.' };
        }
        
        // Decrypt credentials
        const { CredentialVault } = await import('../services/CredentialVault');
        const credentialVault = new CredentialVault();
        if (!githubConfig.credentials || typeof githubConfig.credentials !== 'string') {
          return { success: false, error: 'GitHub not connected', message: 'Please connect your GitHub account in the integrations page.' };
        }
        const github = {
          id: githubConfig.pluginId,
          credentials: credentialVault.decrypt(githubConfig.credentials) as any
        };
        
        if (!github || !github.credentials?.accessToken) {
          return { success: false, error: 'GitHub not connected', message: 'Please connect your GitHub account in the integrations page.' };
        }

        // Use GitHub plugin's commit functionality
        const { GitHubPlugin } = await import('../plugins/GitHubPlugin');
        const githubPlugin = new GitHubPlugin();
        await githubPlugin.initialize(userId);
        await githubPlugin.enable(userId, github.credentials);

        // Get current files from the project
        const branch = githubRepo.defaultBranch || 'main';
        
        // For now, return a message that this needs to be implemented via GitHub plugin tools
        return {
          success: false,
          error: 'Not implemented',
          message: 'Git commit for GitHub repos should be done via the GitHub plugin. Please use the GitHub integration tools.'
        };
      }

      // Platform projects don't have git
      return {
        success: false,
        error: 'Git not available',
        message: 'Git operations are only available for GitHub repositories. Please import your project from GitHub first.'
      };
    } catch (error) {
      logger.error('Error in git commit', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Git branch - uses GitHub plugin for GitHub repos
   */
  private async gitBranch(params: Record<string, any>): Promise<any> {
    const action = params.action as string;
    const branchName = params.branchName as string | undefined;
    const fromBranch = params.fromBranch as string | undefined;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      if (!userId) {
        return { success: false, error: 'User ID required', message: 'Please ensure you are logged in.' };
      }

      let targetProjectId = projectId;
      const selectedProject = sessionId ? this.selectedProjects.get(sessionId) : undefined;
      if (!targetProjectId && selectedProject) {
        targetProjectId = selectedProject.projectId;
      }

      if (!targetProjectId) {
        return { success: false, error: 'No project selected', message: 'Please select a project first.' };
      }

      // Check if it's a GitHub repo
      if (targetProjectId.startsWith('github:') || (selectedProject && (selectedProject as any).isGitHubRepo)) {
        return {
          success: false,
          error: 'Not implemented',
          message: 'Git branch operations for GitHub repos should be done via the GitHub plugin. Please use the GitHub integration tools.'
        };
      }

      return {
        success: false,
        error: 'Git not available',
        message: 'Git operations are only available for GitHub repositories.'
      };
    } catch (error) {
      logger.error('Error in git branch', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Git status - uses GitHub plugin for GitHub repos
   */
  private async gitStatus(params: Record<string, any>): Promise<any> {
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      if (!userId) {
        return { success: false, error: 'User ID required', message: 'Please ensure you are logged in.' };
      }

      let targetProjectId = projectId;
      const selectedProject = sessionId ? this.selectedProjects.get(sessionId) : undefined;
      if (!targetProjectId && selectedProject) {
        targetProjectId = selectedProject.projectId;
      }

      if (!targetProjectId) {
        return { success: false, error: 'No project selected', message: 'Please select a project first.' };
      }

      // Check if it's a GitHub repo
      if (targetProjectId.startsWith('github:') || (selectedProject && (selectedProject as any).isGitHubRepo)) {
        return {
          success: false,
          error: 'Not implemented',
          message: 'Git status for GitHub repos should be done via the GitHub plugin. Please use the GitHub integration tools.'
        };
      }

      return {
        success: false,
        error: 'Git not available',
        message: 'Git operations are only available for GitHub repositories.'
      };
    } catch (error) {
      logger.error('Error in git status', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Git diff - uses GitHub plugin for GitHub repos
   */
  private async gitDiff(params: Record<string, any>): Promise<any> {
    const filePath = params.filePath as string | undefined;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      if (!userId) {
        return { success: false, error: 'User ID required', message: 'Please ensure you are logged in.' };
      }

      let targetProjectId = projectId;
      const selectedProject = sessionId ? this.selectedProjects.get(sessionId) : undefined;
      if (!targetProjectId && selectedProject) {
        targetProjectId = selectedProject.projectId;
      }

      if (!targetProjectId) {
        return { success: false, error: 'No project selected', message: 'Please select a project first.' };
      }

      // Check if it's a GitHub repo
      if (targetProjectId.startsWith('github:') || (selectedProject && (selectedProject as any).isGitHubRepo)) {
        return {
          success: false,
          error: 'Not implemented',
          message: 'Git diff for GitHub repos should be done via the GitHub plugin. Please use the GitHub integration tools.'
        };
      }

      return {
        success: false,
        error: 'Git not available',
        message: 'Git operations are only available for GitHub repositories.'
      };
    } catch (error) {
      logger.error('Error in git diff', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Git log - uses GitHub plugin for GitHub repos
   */
  private async gitLog(params: Record<string, any>): Promise<any> {
    const limit = params.limit as number | undefined;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      if (!userId) {
        return { success: false, error: 'User ID required', message: 'Please ensure you are logged in.' };
      }

      let targetProjectId = projectId;
      const selectedProject = sessionId ? this.selectedProjects.get(sessionId) : undefined;
      if (!targetProjectId && selectedProject) {
        targetProjectId = selectedProject.projectId;
      }

      if (!targetProjectId) {
        return { success: false, error: 'No project selected', message: 'Please select a project first.' };
      }

      // Check if it's a GitHub repo
      if (targetProjectId.startsWith('github:') || (selectedProject && (selectedProject as any).isGitHubRepo)) {
        return {
          success: false,
          error: 'Not implemented',
          message: 'Git log for GitHub repos should be done via the GitHub plugin. Please use the GitHub integration tools.'
        };
      }

      return {
        success: false,
        error: 'Git not available',
        message: 'Git operations are only available for GitHub repositories.'
      };
    } catch (error) {
      logger.error('Error in git log', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Analyze code for errors, warnings, and improvements
   */
  private async analyzeCode(params: Record<string, any>): Promise<any> {
    const filePath = params.filePath as string | undefined;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      // Determine which project to use
      let targetProjectId = projectId;
      let targetProjectName = 'the project';

      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
          targetProjectName = selectedProject.projectName;
        }
      }

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required',
          message: 'I need your user ID to analyze code. Please ensure you are logged in.'
        };
      }

      if (!targetProjectId) {
        return {
          success: false,
          error: 'No project selected',
          message: 'I need to know which project to analyze. Please select a project first using the select_project tool, or specify a project ID.'
        };
      }

      logger.info(`Analyzing code: projectId=${targetProjectId}, filePath=${filePath || 'all'}`);

      // Import CodeAnalysisService
      const { codeAnalysisService } = await import('../services/CodeAnalysisService');
      
      const result = await codeAnalysisService.analyzeCode(parseInt(targetProjectId), filePath);

      return {
        success: true,
        valid: result.valid,
        summary: result.summary,
        issues: result.issues,
        suggestions: result.suggestions,
        performance: result.performance,
        message: result.valid
          ? `Code analysis for "${targetProjectName}": No errors found. ${result.summary.warnings} warning(s), ${result.summary.info} info message(s).`
          : `Code analysis for "${targetProjectName}": Found ${result.summary.errors} error(s), ${result.summary.warnings} warning(s), ${result.summary.info} info message(s).`
      };
    } catch (error) {
      logger.error('Error analyzing code', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Check TypeScript types
   */
  private async checkTypes(params: Record<string, any>): Promise<any> {
    const filePath = params.filePath as string | undefined;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      // Determine which project to use
      let targetProjectId = projectId;
      let targetProjectName = 'the project';

      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
          targetProjectName = selectedProject.projectName;
        }
      }

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required',
          message: 'I need your user ID to check types. Please ensure you are logged in.'
        };
      }

      if (!targetProjectId) {
        return {
          success: false,
          error: 'No project selected',
          message: 'I need to know which project to check. Please select a project first using the select_project tool, or specify a project ID.'
        };
      }

      logger.info(`Checking types: projectId=${targetProjectId}, filePath=${filePath || 'all'}`);

      // Import CodeAnalysisService
      const { codeAnalysisService } = await import('../services/CodeAnalysisService');
      
      const result = await codeAnalysisService.checkTypes(parseInt(targetProjectId), filePath);

      return {
        success: true,
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
        info: result.info,
        message: result.valid
          ? `Type check for "${targetProjectName}": No type errors found.`
          : `Type check for "${targetProjectName}": Found ${result.errors.length} type error(s), ${result.warnings.length} warning(s).`
      };
    } catch (error) {
      logger.error('Error checking types', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Find errors in code
   */
  private async findErrors(params: Record<string, any>): Promise<any> {
    const filePath = params.filePath as string | undefined;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      // Determine which project to use
      let targetProjectId = projectId;
      let targetProjectName = 'the project';

      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
          targetProjectName = selectedProject.projectName;
        }
      }

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required',
          message: 'I need your user ID to find errors. Please ensure you are logged in.'
        };
      }

      if (!targetProjectId) {
        return {
          success: false,
          error: 'No project selected',
          message: 'I need to know which project to check. Please select a project first using the select_project tool, or specify a project ID.'
        };
      }

      logger.info(`Finding errors: projectId=${targetProjectId}, filePath=${filePath || 'all'}`);

      // Import CodeAnalysisService
      const { codeAnalysisService } = await import('../services/CodeAnalysisService');
      
      const errors = await codeAnalysisService.findErrors(parseInt(targetProjectId), filePath);

      return {
        success: true,
        errors,
        count: errors.length,
        message: errors.length === 0
          ? `No errors found in "${targetProjectName}".`
          : `Found ${errors.length} error(s) in "${targetProjectName}": ${errors.map(e => `${e.file}${e.line ? `:${e.line}` : ''} - ${e.message}`).join('; ')}`
      };
    } catch (error) {
      logger.error('Error finding errors', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Suggest code improvements
   */
  private async suggestImprovements(params: Record<string, any>): Promise<any> {
    const filePath = params.filePath as string | undefined;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      // Determine which project to use
      let targetProjectId = projectId;
      let targetProjectName = 'the project';

      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
          targetProjectName = selectedProject.projectName;
        }
      }

      if (!userId) {
        return {
          success: false,
          error: 'User ID is required',
          message: 'I need your user ID to suggest improvements. Please ensure you are logged in.'
        };
      }

      if (!targetProjectId) {
        return {
          success: false,
          error: 'No project selected',
          message: 'I need to know which project to analyze. Please select a project first using the select_project tool, or specify a project ID.'
        };
      }

      logger.info(`Suggesting improvements: projectId=${targetProjectId}, filePath=${filePath || 'all'}`);

      // Import CodeAnalysisService and ProjectService
      const { codeAnalysisService } = await import('../services/CodeAnalysisService');
      const { ProjectService } = await import('../services/ProjectService');
      const projectService = new ProjectService();
      
      // Get project files
      const files = await projectService.getProjectFiles(parseInt(targetProjectId));
      
      const allSuggestions: Array<{ type: string; priority: string; file: string; line?: number; description: string; reason: string }> = [];

      for (const file of files) {
        if (filePath && file.filePath !== filePath) continue;
        if (!file.fileContent) continue;

        const suggestions = await codeAnalysisService.getImprovements(file.filePath, file.fileContent);
        allSuggestions.push(...suggestions);
      }

      return {
        success: true,
        suggestions: allSuggestions,
        count: allSuggestions.length,
        message: allSuggestions.length === 0
          ? `No improvement suggestions for "${targetProjectName}". Code looks good!`
          : `Found ${allSuggestions.length} improvement suggestion(s) for "${targetProjectName}": ${allSuggestions.map(s => `${s.file}${s.line ? `:${s.line}` : ''} - ${s.description}`).join('; ')}`
      };
    } catch (error) {
      logger.error('Error suggesting improvements', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorLog: error instanceof Error ? error.stack : String(error)
      };
    }
  }

  /**
   * Generate tests for a project
   */
  private async generateTests(params: Record<string, any>): Promise<any> {
    const filePath = params.filePath as string | undefined;
    const testType = (params.testType as 'unit' | 'integration' | 'e2e') || 'unit';
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      let targetProjectId = projectId;
      let targetProjectName = 'the project';

      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
          targetProjectName = selectedProject.projectName;
        }
      }

      if (!userId || !targetProjectId) {
        return {
          success: false,
          error: 'Project selection required',
          message: 'I need to know which project to generate tests for. Please select a project first.'
        };
      }

      logger.info(`Generating ${testType} tests: projectId=${targetProjectId}, filePath=${filePath || 'all'}`);

      const { testService } = await import('../services/TestService');
      const testFiles = await testService.generateTests(parseInt(targetProjectId), filePath, testType);

      return {
        success: true,
        testFiles,
        count: testFiles.length,
        message: `Generated ${testFiles.length} ${testType} test file(s) for "${targetProjectName}"`
      };
    } catch (error) {
      logger.error('Error generating tests', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Run tests in a project
   */
  private async runTests(params: Record<string, any>): Promise<any> {
    const testPath = params.testPath as string | undefined;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

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
          error: 'Project selection required',
          message: 'I need to know which project to run tests for. Please select a project first.'
        };
      }

      logger.info(`Running tests: projectId=${targetProjectId}, testPath=${testPath || 'all'}`);

      const { testService } = await import('../services/TestService');
      const result = await testService.runTests(parseInt(targetProjectId), testPath);

      return {
        ...result,
        message: result.success
          ? `All tests passed! ${result.passed} test(s) passed in ${result.duration.toFixed(2)}s`
          : `${result.failed} test(s) failed, ${result.passed} passed. ${result.errors.length} error(s) found.`
      };
    } catch (error) {
      logger.error('Error running tests', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get test coverage
   */
  private async getTestCoverage(params: Record<string, any>): Promise<any> {
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

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
          error: 'Project selection required',
          message: 'I need to know which project to get coverage for. Please select a project first.'
        };
      }

      logger.info(`Getting test coverage: projectId=${targetProjectId}`);

      const { testService } = await import('../services/TestService');
      const coverage = await testService.getTestCoverage(parseInt(targetProjectId));

      if (!coverage) {
        return {
          success: false,
          message: 'No coverage data available. Run tests with coverage enabled first.'
        };
      }

      return {
        success: true,
        coverage,
        message: `Test coverage: Statements ${coverage.statements}%, Branches ${coverage.branches}%, Functions ${coverage.functions}%, Lines ${coverage.lines}%`
      };
    } catch (error) {
      logger.error('Error getting test coverage', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Generate documentation
   */
  private async generateDocs(params: Record<string, any>): Promise<any> {
    const docType = (params.docType as 'readme' | 'api' | 'code-comments' | 'all') || 'all';
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      let targetProjectId = projectId;
      let targetProjectName = 'the project';

      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
          targetProjectName = selectedProject.projectName;
        }
      }

      if (!userId || !targetProjectId) {
        return {
          success: false,
          error: 'Project selection required',
          message: 'I need to know which project to generate documentation for. Please select a project first.'
        };
      }

      logger.info(`Generating ${docType} documentation: projectId=${targetProjectId}`);

      const { documentationService } = await import('../services/DocumentationService');
      const docFiles = await documentationService.generateDocumentation(parseInt(targetProjectId), docType);

      return {
        success: true,
        docFiles,
        count: docFiles.length,
        message: `Generated ${docFiles.length} documentation file(s) for "${targetProjectName}"`
      };
    } catch (error) {
      logger.error('Error generating documentation', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Remember a fact
   */
  private async rememberFact(params: Record<string, any>): Promise<any> {
    const fact = params.fact as string;
    const category = params.category as string | undefined;
    const userId = params._userId as string | undefined;

    if (!userId) {
      return {
        success: false,
        error: 'User ID is required',
        message: 'I need your user ID to remember facts. Please ensure you are logged in.'
      };
    }

    if (!fact) {
      return {
        success: false,
        error: 'Fact is required',
        message: 'Please provide a fact to remember.'
      };
    }

    try {
      logger.info(`Remembering fact for user ${userId}: ${fact.substring(0, 50)}...`);

      const { memoryService } = await import('../services/MemoryService');
      const result = await memoryService.rememberFact(userId, fact, category);

      return {
        ...result,
        message: result.success
          ? `I've remembered: "${fact}"${category ? ` (category: ${category})` : ''}`
          : `Failed to remember fact: ${result.message}`
      };
    } catch (error) {
      logger.error('Error remembering fact', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Recall memory
   */
  private async recallMemory(params: Record<string, any>): Promise<any> {
    const query = params.query as string;
    const category = params.category as string | undefined;
    const userId = params._userId as string | undefined;

    if (!userId) {
      return {
        success: false,
        error: 'User ID is required',
        message: 'I need your user ID to recall memories. Please ensure you are logged in.'
      };
    }

    try {
      logger.info(`Recalling memory for user ${userId}: query="${query}"${category ? `, category="${category}"` : ''}`);

      const { memoryService } = await import('../services/MemoryService');
      const memories = await memoryService.recallMemory(userId, query, category);

      return {
        success: true,
        memories,
        count: memories.length,
        message: memories.length > 0
          ? `Found ${memories.length} memory/memories: ${memories.map(m => m.fact).join('; ')}`
          : `No memories found${query ? ` for "${query}"` : ''}${category ? ` in category "${category}"` : ''}`
      };
    } catch (error) {
      logger.error('Error recalling memory', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process image
   */
  private async processImage(params: Record<string, any>): Promise<any> {
    const imagePath = params.imagePath as string;
    const operation = params.operation as 'resize' | 'crop' | 'optimize' | 'extract-text';
    const width = params.width as number | undefined;
    const height = params.height as number | undefined;
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

    try {
      let targetProjectId = projectId;

      if (!targetProjectId && sessionId) {
        const selectedProject = this.selectedProjects.get(sessionId);
        if (selectedProject) {
          targetProjectId = selectedProject.projectId;
        }
      }

      if (!userId || !targetProjectId || !imagePath) {
        return {
          success: false,
          error: 'Missing required parameters',
          message: 'I need a project ID and image path to process images.'
        };
      }

      logger.info(`Processing image: projectId=${targetProjectId}, path=${imagePath}, operation=${operation}`);

      const { imageService } = await import('../services/ImageService');
      const result = await imageService.processImage(
        parseInt(targetProjectId),
        imagePath,
        operation,
        { width, height }
      );

      return result;
    } catch (error) {
      logger.error('Error processing image', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Detect language
   */
  private async detectLanguage(params: Record<string, any>): Promise<any> {
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;
    const sessionId = params._sessionId as string | undefined;

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
          error: 'Project selection required',
          message: 'I need to know which project to detect language for. Please select a project first.'
        };
      }

      logger.info(`Detecting language: projectId=${targetProjectId}`);

      const { multiLanguageService } = await import('../services/MultiLanguageService');
      const languageInfo = await multiLanguageService.detectLanguage(parseInt(targetProjectId));

      return {
        success: true,
        ...languageInfo,
        message: `Detected primary language: ${languageInfo.primary}${languageInfo.frameworks.length > 0 ? ` with frameworks: ${languageInfo.frameworks.join(', ')}` : ''} (confidence: ${languageInfo.confidence}%)`
      };
    } catch (error) {
      logger.error('Error detecting language', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Track error
   */
  private async trackError(params: Record<string, any>): Promise<any> {
    const error = params.error as string;
    const file = params.file as string | undefined;
    const severity = (params.severity as 'low' | 'medium' | 'high' | 'critical') || 'medium';
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;

    if (!userId || !error) {
      return {
        success: false,
        error: 'Missing required parameters',
        message: 'I need your user ID and an error message to track errors.'
      };
    }

    try {
      logger.info(`Tracking error for user ${userId}: ${error.substring(0, 100)}`);

      const { errorTrackingService } = await import('../services/ErrorTrackingService');
      const result = await errorTrackingService.trackError(userId, error, {
        file,
        severity,
        projectId: projectId ? parseInt(projectId) : undefined
      });

      return {
        ...result,
        message: result.success
          ? `Error tracked successfully (severity: ${severity})`
          : `Failed to track error: ${result.message}`
      };
    } catch (error) {
      logger.error('Error tracking error', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get usage stats
   */
  private async getUsageStats(params: Record<string, any>): Promise<any> {
    const period = (params.period as 'day' | 'week' | 'month' | 'all') || 'all';
    const projectId = params.projectId as string | undefined;
    const userId = params._userId as string | undefined;

    if (!userId) {
      return {
        success: false,
        error: 'User ID is required',
        message: 'I need your user ID to get usage statistics. Please ensure you are logged in.'
      };
    }

    try {
      logger.info(`Getting usage stats for user ${userId}: period=${period}, projectId=${projectId || 'all'}`);

      const { analyticsService } = await import('../services/AnalyticsService');
      const stats = await analyticsService.getUsageStats(
        userId,
        projectId ? parseInt(projectId) : undefined,
        period
      );

      return {
        success: true,
        ...stats,
        message: `Usage statistics (${period}): ${stats.projects.total} project(s), ${stats.projects.files} file(s), ${stats.deployments.total} deployment(s), ${stats.activity.codeGenerations} code generation(s)`
      };
    } catch (error) {
      logger.error('Error getting usage stats', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Get data insights - comprehensive analytics about AI agent performance and patterns
   */
  private async getDataInsights(params: Record<string, any>): Promise<any> {
    const insightType = (params.type as 'overview' | 'hypotheses') || 'overview';
    const userId = params._userId as string | undefined;

    if (!userId) {
      return {
        success: false,
        error: 'User ID is required',
        message: 'I need your user ID to get data insights. Please ensure you are logged in.'
      };
    }

    try {
      logger.info(`Getting data insights for user ${userId}: type=${insightType}`);

      // Import the data insights router logic directly
      const dataInsightsRouter = await import('../routes/data-insights');
      
      // Create a mock request/response to call the router handler
      // We'll call the handler function directly instead
      const { db } = await import('../../db');
      const { 
        codeGenerationSessions, 
        agents, 
        workspaces, 
        chainExecutions,
        promptChains,
        projectMembers
      } = await import('../../db/schema-pg');
      const { sql, eq, desc, and, gte } = await import('drizzle-orm');

      if (insightType === 'overview') {
        // Replicate the overview endpoint logic
        const agentPerformance = await db
          .select({
            agentId: codeGenerationSessions.agentId,
            agentName: agents.name,
            totalSessions: sql<number>`COUNT(*)`,
            successRate: sql<number>`
              ROUND(
                (SUM(CASE WHEN ${codeGenerationSessions.status} = 'completed' THEN 1 ELSE 0 END) * 100.0) / 
                NULLIF(COUNT(*), 0),
                2
              )
            `,
            avgCodeLength: sql<number>`
              ROUND(
                AVG(LENGTH(${codeGenerationSessions.generatedCode})),
                0
              )
            `,
          })
          .from(codeGenerationSessions)
          .leftJoin(agents, eq(codeGenerationSessions.agentId, agents.id.toString()))
          .where(eq(codeGenerationSessions.userId, userId))
          .groupBy(codeGenerationSessions.agentId, agents.name)
          .orderBy(desc(sql`COUNT(*)`))
          .limit(10);

        const codePatterns = await db
          .select({
            hour: sql<number>`EXTRACT(HOUR FROM ${codeGenerationSessions.createdAt}::timestamp)`,
            count: sql<number>`COUNT(*)`,
            avgLength: sql<number>`ROUND(AVG(LENGTH(${codeGenerationSessions.generatedCode})), 0)`,
          })
          .from(codeGenerationSessions)
          .where(eq(codeGenerationSessions.userId, userId))
          .groupBy(sql`EXTRACT(HOUR FROM ${codeGenerationSessions.createdAt}::timestamp)`)
          .orderBy(sql`EXTRACT(HOUR FROM ${codeGenerationSessions.createdAt}::timestamp)`);

        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        const projectActivity = await db
          .select({
            date: sql<string>`DATE(${workspaces.lastActivity})`,
            activeProjects: sql<number>`COUNT(DISTINCT ${workspaces.id})`,
            newProjects: sql<number>`
              COUNT(DISTINCT CASE 
                WHEN DATE(${workspaces.createdAt}) = DATE(${workspaces.lastActivity}) 
                THEN ${workspaces.id} 
              END)
            `,
          })
          .from(workspaces)
          .where(
            and(
              eq(workspaces.ownerId, userId),
              gte(workspaces.lastActivity, thirtyDaysAgo)
            )
          )
          .groupBy(sql`DATE(${workspaces.lastActivity})`)
          .orderBy(sql`DATE(${workspaces.lastActivity}) DESC`)
          .limit(30);

        const collaborationStats = await db
          .select({
            totalCollaborators: sql<number>`COUNT(DISTINCT ${projectMembers.userId})`,
            mostCollaborativeProject: sql<string>`MAX(${workspaces.name})`,
            avgCollaboratorsPerProject: sql<number>`
              ROUND(
                COUNT(DISTINCT ${projectMembers.userId})::numeric / 
                NULLIF(COUNT(DISTINCT ${projectMembers.projectId}), 0),
                2
              )
            `,
          })
          .from(projectMembers)
          .leftJoin(workspaces, eq(projectMembers.projectId, workspaces.id))
          .where(eq(workspaces.ownerId, userId));

        const chainAnalysis = await db
          .select({
            chainId: chainExecutions.chainId,
            chainName: promptChains.name,
            totalExecutions: sql<number>`COUNT(*)`,
            successRate: sql<number>`
              ROUND(
                (SUM(CASE WHEN ${chainExecutions.status} = 'completed' THEN 1 ELSE 0 END) * 100.0) / 
                NULLIF(COUNT(*), 0),
                2
              )
            `,
            avgDuration: sql<number>`
              ROUND(
                AVG(
                  EXTRACT(EPOCH FROM (${chainExecutions.completedAt}::timestamp - ${chainExecutions.startedAt}::timestamp))
                ),
                2
              )
            `,
          })
          .from(chainExecutions)
          .leftJoin(promptChains, eq(chainExecutions.chainId, promptChains.id))
          .groupBy(chainExecutions.chainId, promptChains.name)
          .orderBy(desc(sql`COUNT(*)`))
          .limit(10);

        const correlations = {
          agentSuccessVsCodeLength: agentPerformance.map(a => ({
            agent: a.agentName || 'Unknown',
            successRate: a.successRate || 0,
            avgCodeLength: a.avgCodeLength || 0,
          })),
          timeOfDayVsProductivity: codePatterns.map(p => ({
            hour: p.hour || 0,
            sessions: p.count || 0,
            avgCodeLength: p.avgLength || 0,
          })),
        };

        const insights = [];
        
        const mostProductiveHour = codePatterns.reduce((max, p) => 
          (p.count || 0) > (max.count || 0) ? p : max, codePatterns[0] || { hour: 0, count: 0 }
        );
        if (mostProductiveHour) {
          insights.push({
            type: 'productivity',
            title: 'Mest produktiva tiden',
            description: `Du genererar mest kod klockan ${mostProductiveHour.hour}:00`,
            data: mostProductiveHour,
          });
        }

        const bestAgent = agentPerformance.reduce((max, a) => 
          (a.successRate || 0) > (max.successRate || 0) ? a : max, 
          agentPerformance[0] || { agentName: 'N/A', successRate: 0 }
        );
        if (bestAgent && bestAgent.agentName) {
          insights.push({
            type: 'agent_performance',
            title: 'Bäst presterande agent',
            description: `${bestAgent.agentName} har högst framgångsfrekvens (${bestAgent.successRate}%)`,
            data: bestAgent,
          });
        }

        if (collaborationStats[0]?.totalCollaborators) {
          insights.push({
            type: 'collaboration',
            title: 'Samarbete',
            description: `Du har ${collaborationStats[0].totalCollaborators} medarbetare i dina projekt`,
            data: collaborationStats[0],
          });
        }

        return {
          success: true,
          data: {
            agentPerformance,
            codePatterns,
            projectActivity,
            collaborationStats: collaborationStats[0] || {},
            chainAnalysis,
            correlations,
            insights,
            summary: {
              totalSessions: agentPerformance.reduce((sum, a) => sum + (a.totalSessions || 0), 0),
              uniqueAgents: agentPerformance.length,
              activeProjects: projectActivity.reduce((sum, p) => sum + (p.activeProjects || 0), 0),
            },
          },
          message: `Data insights retrieved: ${agentPerformance.reduce((sum, a) => sum + (a.totalSessions || 0), 0)} total sessions, ${agentPerformance.length} unique agents, ${projectActivity.reduce((sum, p) => sum + (p.activeProjects || 0), 0)} active projects`
        };
      } else {
        // Hypotheses endpoint logic
        const sessions = await db
          .select()
          .from(codeGenerationSessions)
          .where(eq(codeGenerationSessions.userId, userId))
          .limit(100);

        const hypotheses = [];

        const promptLengths = sessions.map(s => ({
          promptLength: s.inputPrompt?.length || 0,
          codeLength: s.generatedCode?.length || 0,
        }));
        
        if (promptLengths.length > 0) {
          const avgPromptLength = promptLengths.reduce((sum, p) => sum + p.promptLength, 0) / promptLengths.length;
          const avgCodeLength = promptLengths.reduce((sum, p) => sum + p.codeLength, 0) / promptLengths.length;
          
          hypotheses.push({
            id: 'prompt-code-correlation',
            title: 'Samband mellan prompt-längd och kod-längd',
            description: `Genomsnittlig prompt-längd: ${Math.round(avgPromptLength)} tecken. Genomsnittlig kod-längd: ${Math.round(avgCodeLength)} tecken.`,
            hypothesis: 'Längre prompts tenderar att generera längre kod',
            confidence: 'medium',
            data: {
              avgPromptLength: Math.round(avgPromptLength),
              avgCodeLength: Math.round(avgCodeLength),
              sampleSize: promptLengths.length,
            },
          });
        }

        return {
          success: true,
          hypotheses,
          message: `Generated ${hypotheses.length} hypotheses based on your data patterns`
        };
      }
    } catch (error) {
      logger.error('Error getting data insights', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to retrieve data insights. Please try again later.'
      };
    }
  }

  /**
   * Use browser automation via browser-use
   */
  private async useBrowser(params: Record<string, any>): Promise<any> {
    const url = params.url as string;
    const task = params.task as string;
    const headless = params.headless !== false; // Default to true
    const timeout = params.timeout as number | undefined;
    const screenshot = params.screenshot === true;

    try {
      logger.info(`Browser automation: ${task} on ${url}`);

      // Import browser-use service
      const { browserUseService } = await import('../services/BrowserUseService');

      // Check if browser-use is available
      const isAvailable = await browserUseService.isAvailable();
      if (!isAvailable) {
        return {
          success: false,
          error: 'browser-use not available',
          message: 'browser-use Python library is not installed. It will be installed automatically on first use, but this may take a few minutes. Please try again in a moment.'
        };
      }

      // Execute the browser task
      const result = await browserUseService.executeTask({
        url,
        task,
        options: {
          headless,
          timeout,
          screenshot
        }
      });

      if (!result.success) {
        return {
          success: false,
          error: result.error || 'Browser automation failed',
          message: result.error || 'Failed to complete browser task',
          output: result.output
        };
      }

      return {
        success: true,
        message: result.output || 'Browser task completed successfully',
        url,
        task,
        screenshot: result.screenshot,
        extractedData: result.extractedData
      };
    } catch (error) {
      logger.error('Error using browser automation', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: `Browser automation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

export const personalAssistantAgent = new PersonalAssistantAgent();
export default personalAssistantAgent;
