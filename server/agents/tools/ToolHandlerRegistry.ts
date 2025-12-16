/**
 * Tool Handler Registry
 * 
 * Central registry for all tool handlers with initialization
 */

import { BaseToolHandler } from './BaseToolHandler';
import { ToolFactory } from './ToolFactory';
import { BrowserUseToolHandler } from './BrowserUseToolHandler';
import { DiscordToolHandler, ReadDiscordMessagesToolHandler } from './DiscordToolHandler';
import { WebSearchToolHandler } from './WebSearchToolHandler';
import { 
  ReadFileToolHandler, 
  WriteFileToolHandler, 
  EditFileToolHandler, 
  DeleteFileToolHandler, 
  CreateDirectoryToolHandler 
} from './FileOperationsToolHandler';
import {
  GitCommitToolHandler,
  GitBranchToolHandler,
  GitStatusToolHandler,
  GitDiffToolHandler,
  GitLogToolHandler
} from './GitOperationsToolHandler';
import {
  AnalyzeCodeToolHandler,
  CheckTypesToolHandler,
  FindErrorsToolHandler,
  SuggestImprovementsToolHandler
} from './CodeAnalysisToolHandler';
import {
  GenerateTestsToolHandler,
  RunTestsToolHandler,
  TestCoverageToolHandler
} from './TestingToolHandler';
import {
  ListProjectsToolHandler,
  SelectProjectToolHandler
} from './ProjectManagementToolHandler';
import {
  GenerateDocsToolHandler
} from './DocumentationToolHandler';
import {
  RememberFactToolHandler,
  RecallMemoryToolHandler
} from './MemoryToolHandler';
import {
  GenerateCodeToolHandler
} from './CodeGenerationToolHandler';
import {
  DeployToVercelToolHandler
} from './DeploymentToolHandler';
import {
  ProcessImageToolHandler,
  DetectLanguageToolHandler,
  TrackErrorToolHandler
} from './UtilityToolHandler';
import {
  GetUsageStatsToolHandler,
  GetDataInsightsToolHandler
} from './AnalyticsToolHandler';
import { SimpleLogger } from '../../utils/SimpleLogger';

const logger = new SimpleLogger('ToolHandlerRegistry');

export class ToolHandlerRegistry {
  private static instance: ToolHandlerRegistry;
  private initialized: boolean = false;
  private toolFactory: ToolFactory;
  private agentInstance: any = null; // PersonalAssistantAgent instance

  private constructor() {
    this.toolFactory = ToolFactory.getInstance();
  }

  public static getInstance(): ToolHandlerRegistry {
    if (!ToolHandlerRegistry.instance) {
      ToolHandlerRegistry.instance = new ToolHandlerRegistry();
    }
    return ToolHandlerRegistry.instance;
  }

  /**
   * Set the agent instance for handlers that need it
   */
  public setAgentInstance(agentInstance: any): void {
    this.agentInstance = agentInstance;
  }

  /**
   * Initialize and register all tool handlers
   */
  public async initialize(agentInstance?: any): Promise<void> {
    if (this.initialized && !agentInstance) {
      return;
    }

    if (agentInstance) {
      this.agentInstance = agentInstance;
    }

    logger.info('Initializing tool handler registry...');

    // Register all handlers
    const handlers: BaseToolHandler[] = [
      new BrowserUseToolHandler(),
      new DiscordToolHandler(),
      new ReadDiscordMessagesToolHandler(),
      new WebSearchToolHandler(),
      // File operation handlers (need agent instance)
      new ReadFileToolHandler(this.agentInstance),
      new WriteFileToolHandler(this.agentInstance),
      new EditFileToolHandler(this.agentInstance),
      new DeleteFileToolHandler(this.agentInstance),
      new CreateDirectoryToolHandler(this.agentInstance),
      // Git operation handlers (need agent instance)
      new GitCommitToolHandler(this.agentInstance),
      new GitBranchToolHandler(this.agentInstance),
      new GitStatusToolHandler(this.agentInstance),
      new GitDiffToolHandler(this.agentInstance),
      new GitLogToolHandler(this.agentInstance),
      // Code analysis handlers (need agent instance)
      new AnalyzeCodeToolHandler(this.agentInstance),
      new CheckTypesToolHandler(this.agentInstance),
      new FindErrorsToolHandler(this.agentInstance),
      new SuggestImprovementsToolHandler(this.agentInstance),
      // Testing handlers (need agent instance)
      new GenerateTestsToolHandler(this.agentInstance),
      new RunTestsToolHandler(this.agentInstance),
      new TestCoverageToolHandler(this.agentInstance),
      // Project management handlers (need agent instance)
      new ListProjectsToolHandler(this.agentInstance),
      new SelectProjectToolHandler(this.agentInstance),
      // Documentation handlers (need agent instance)
      new GenerateDocsToolHandler(this.agentInstance),
      // Memory handlers (need agent instance)
      new RememberFactToolHandler(this.agentInstance),
      new RecallMemoryToolHandler(this.agentInstance),
      // Code generation handler (need agent instance)
      new GenerateCodeToolHandler(this.agentInstance),
      // Deployment handler (need agent instance)
      new DeployToVercelToolHandler(this.agentInstance),
      // Utility handlers (need agent instance)
      new ProcessImageToolHandler(this.agentInstance),
      new DetectLanguageToolHandler(this.agentInstance),
      new TrackErrorToolHandler(this.agentInstance),
      // Analytics handlers (need agent instance)
      new GetUsageStatsToolHandler(this.agentInstance),
      new GetDataInsightsToolHandler(this.agentInstance),
      // All handlers registered!
    ];

    for (const handler of handlers) {
      try {
        await this.toolFactory.registerHandlerByToolName(handler);
        logger.info(`Registered handler: ${handler.constructor.name}`);
      } catch (error) {
        logger.warn(`Failed to register handler ${handler.constructor.name}`, error as Error);
      }
    }

    this.initialized = true;
    logger.info(`✅ Tool handler registry initialized with ${handlers.length} handlers`);
  }

  /**
   * Get tool factory instance
   */
  public getToolFactory(): ToolFactory {
    return this.toolFactory;
  }

  /**
   * Check if registry is initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Clear cache and reinitialize
   */
  public async reinitialize(): Promise<void> {
    this.initialized = false;
    this.toolFactory.clearCache();
    await this.initialize();
  }
}

export const toolHandlerRegistry = ToolHandlerRegistry.getInstance();

