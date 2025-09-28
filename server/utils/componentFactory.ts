import path from 'path';
import fs from 'fs/promises';
import { ComponentOrchestrator } from './componentOrchestrator';
import { Logger } from './Logger';

const logger = new Logger(process.cwd());
logger.initialize().catch(console.error);

interface GenerationResult {
  success: boolean;
  workspacePath: string;
  errors: string[];
  warnings: string[];
}

export class ComponentFactory {
  private baseWorkspacePath: string;

  constructor(baseWorkspacePath: string) {
    this.baseWorkspacePath = baseWorkspacePath;
  }

  async createComponent(prompt: string): Promise<GenerationResult> {
    const result: GenerationResult = {
      success: false,
      workspacePath: '',
      errors: [],
      warnings: []
    };

    await logger.info('ComponentFactory', 'Starting component creation', {
      prompt,
      baseWorkspacePath: this.baseWorkspacePath
    });

    try {
      // Create a new workspace directory with timestamp
      const timestamp = Date.now();
      const workspacePath = path.join(this.baseWorkspacePath, timestamp.toString());
      await fs.mkdir(workspacePath, { recursive: true });
      result.workspacePath = workspacePath;

      await logger.info('ComponentFactory', 'Created workspace directory', {
        workspacePath,
        timestamp
      });

      // Initialize the orchestrator with the new workspace
      const orchestrator = new ComponentOrchestrator(workspacePath);
      
      // Run the orchestration process
      const orchestrationResult = await orchestrator.orchestrate(prompt);
      
      // Update result based on orchestration outcome
      result.success = orchestrationResult.success;
      result.errors = orchestrationResult.errors;
      result.warnings = orchestrationResult.warnings;

      if (!result.success) {
        // Clean up the workspace if generation failed
        await fs.rm(workspacePath, { recursive: true, force: true });
        result.workspacePath = '';
        await logger.error('ComponentFactory', 'Component generation failed', {
          errors: result.errors,
          warnings: result.warnings
        });
      } else {
        await logger.info('ComponentFactory', 'Component generation completed successfully', {
          workspacePath,
          warnings: result.warnings
        });
      }

      return result;

    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      result.errors.push(`Component generation failed: ${err}`);
      await logger.error('ComponentFactory', 'Component generation failed with error', {
        error: err
      });
      
      // Clean up workspace if it was created
      if (result.workspacePath) {
        try {
          await fs.rm(result.workspacePath, { recursive: true, force: true });
          result.workspacePath = '';
        } catch {
          result.warnings.push('Failed to clean up workspace after error');
        }
      }
      
      return result;
    }
  }

  async validateExistingWorkspace(workspacePath: string): Promise<GenerationResult> {
    const result: GenerationResult = {
      success: false,
      workspacePath,
      errors: [],
      warnings: []
    };

    await logger.info('ComponentFactory', 'Starting workspace validation', {
      workspacePath
    });

    try {
      // Check if workspace exists
      await fs.access(workspacePath);
      
      // Initialize orchestrator with existing workspace
      const orchestrator = new ComponentOrchestrator(workspacePath);
      
      // Run validation only
      const validationResult = await orchestrator.orchestrate('validate');
      
      result.success = validationResult.success;
      result.errors = validationResult.errors;
      result.warnings = validationResult.warnings;

      await logger.info('ComponentFactory', 'Workspace validation completed', {
        success: result.success,
        errors: result.errors,
        warnings: result.warnings
      });

      return result;

    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      result.errors.push(`Workspace validation failed: ${err}`);
      await logger.error('ComponentFactory', 'Workspace validation failed', {
        error: err,
        workspacePath
      });
      return result;
    }
  }

  async listWorkspaces(): Promise<string[]> {
    try {
      const entries = await fs.readdir(this.baseWorkspacePath, { withFileTypes: true });
      return entries
        .filter(entry => entry.isDirectory())
        .map(dir => dir.name)
        .sort((a, b) => parseInt(b) - parseInt(a)); // Sort by timestamp descending
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      await logger.error('ComponentFactory', 'Failed to list workspaces', {
        error: err
      });
      return [];
    }
  }

  async cleanupOldWorkspaces(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    try {
      const workspaces = await this.listWorkspaces();
      const now = Date.now();

      for (const workspace of workspaces) {
        const workspacePath = path.join(this.baseWorkspacePath, workspace);
        const stats = await fs.stat(workspacePath);

        if (now - stats.ctimeMs > maxAge) {
          await fs.rm(workspacePath, { recursive: true, force: true });
        }
      }
    } catch (error) {
      const err = error instanceof Error ? error.message : String(error);
      await logger.error('ComponentFactory', 'Workspace cleanup failed', {
        error: err
      });
    }
  }
}
