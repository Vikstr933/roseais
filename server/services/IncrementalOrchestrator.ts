/**
 * Incremental Code Generation Orchestrator
 * 
 * Builds code incrementally in phases, validating at each step.
 * Each agent sees what was built before, preventing errors from compounding.
 */

import { AICodeGenerator } from './AICodeGenerator';
import { MultiModelAIService } from './MultiModelAIService';
import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { agents } from '../../db/schema-pg';
import { eq } from 'drizzle-orm';

export interface GenerationPhase {
  phase: string;
  description: string;
  files: string[];
  dependencies: string[]; // Phases this depends on
  agentId: string; // Which agent generates this phase
}

export interface GenerationPlan {
  appName: string;
  appType: string;
  techStack: {
    framework: string;
    buildTool: string;
    language: string;
  };
  phases: GenerationPhase[];
  totalPhases: number;
}

export interface PhaseResult {
  phase: string;
  success: boolean;
  files: { path: string; content: string }[];
  errors?: string[];
  warnings?: string[];
  duration: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: string[];
  suggestions: string[];
}

export interface ValidationError {
  file: string;
  line?: number;
  column?: number;
  message: string;
  type: 'syntax' | 'import' | 'type' | 'runtime' | 'other';
}

export interface IncrementalGenerationResult {
  success: boolean;
  plan: GenerationPlan;
  phases: PhaseResult[];
  allFiles: { path: string; content: string }[];
  totalDuration: number;
  errors?: string[];
}

export class IncrementalOrchestrator {
  private logger: SimpleLogger;
  private aiCodeGenerator: AICodeGenerator;
  private multiModelAI: MultiModelAIService;
  private maxFixAttempts = 3;

  constructor() {
    this.logger = new SimpleLogger('IncrementalOrchestrator');
    this.aiCodeGenerator = new AICodeGenerator();
    this.multiModelAI = new MultiModelAIService();
  }

  /**
   * Generate code incrementally following a plan
   */
  async generateIncrementally(
    plan: GenerationPlan,
    userPrompt: string,
    knowledgeContext: string = '',
    existingFiles: { path: string; content: string }[] = [],
    progressCallback?: (phase: string, progress: number, message: string) => void
  ): Promise<IncrementalGenerationResult> {
    const startTime = Date.now();
    const phaseResults: PhaseResult[] = [];
    const allFiles: Map<string, string> = new Map(); // path -> content

    // Add existing files to the map
    existingFiles.forEach(file => {
      allFiles.set(file.path, file.content);
    });

    this.logger.info('Starting incremental generation', {
      appName: plan.appName,
      totalPhases: plan.phases.length
    });

    // Process each phase in order
    for (let i = 0; i < plan.phases.length; i++) {
      const phase = plan.phases[i];
      const phaseStartTime = Date.now();

      this.logger.info(`Processing phase ${i + 1}/${plan.phases.length}: ${phase.phase}`);

      if (progressCallback) {
        progressCallback(phase.phase, (i / plan.phases.length) * 100, `Generating ${phase.description}...`);
      }

      // Get files from previous phases (dependencies)
      const existingPhaseFiles = Array.from(allFiles.entries()).map(([path, content]) => ({
        path,
        content
      }));

      // Generate phase files
      let phaseResult: PhaseResult;
      let fixAttempts = 0;
      let validation: ValidationResult;

      do {
        // Only regenerate on the first attempt
        if (fixAttempts === 0) {
          phaseResult = await this.generatePhase(
            phase,
            userPrompt,
            knowledgeContext,
            existingPhaseFiles,
            plan
          );
        }

        // Validate phase (or re-validate after fixing)
        validation = await this.validatePhase(phaseResult.files, existingPhaseFiles);

        if (!validation.valid && fixAttempts < this.maxFixAttempts) {
          this.logger.warn(`Phase ${phase.phase} validation failed (attempt ${fixAttempts + 1}/${this.maxFixAttempts})`, {
            errors: validation.errors.map(e => `${e.file}: ${e.message}`),
            errorTypes: validation.errors.map(e => e.type),
            errorCount: validation.errors.length
          });
          
          if (progressCallback) {
            progressCallback(phase.phase, (i / plan.phases.length) * 100, `Fixing errors in ${phase.phase}...`);
          }

          // Try to fix errors
          const fixedFiles = await this.fixPhase(
            phaseResult.files,
            validation.errors,
            existingPhaseFiles,
            phase
          );

          phaseResult.files = fixedFiles;
          fixAttempts++;

          // Re-validate fixed files immediately (don't regenerate)
          // The loop will continue if validation still fails
        } else {
          // Either valid or max attempts reached
          if (!validation.valid) {
            this.logger.error(`Phase ${phase.phase} failed after ${fixAttempts} fix attempts, continuing with errors`, {
              remainingErrors: validation.errors.map(e => `${e.file}: ${e.message}`)
            });
          }
          phaseResult.errors = validation.errors.map(e => e.message);
          phaseResult.warnings = validation.warnings;
          break;
        }
      } while (!validation.valid && fixAttempts < this.maxFixAttempts);

      // Add phase files to all files
      phaseResult.files.forEach(file => {
        allFiles.set(file.path, file.content);
      });

      phaseResult.duration = Date.now() - phaseStartTime;
      phaseResult.success = phaseResult.errors?.length === 0;

      phaseResults.push(phaseResult);

      // If phase failed after max attempts, log but continue
      if (!phaseResult.success) {
        this.logger.error(`Phase ${phase.phase} failed after ${fixAttempts} fix attempts`, {
          errors: phaseResult.errors
        });
        // Continue to next phase - let final QA catch all errors
      }

      if (progressCallback) {
        progressCallback(phase.phase, ((i + 1) / plan.phases.length) * 100, `Completed ${phase.phase}`);
      }
    }

    const totalDuration = Date.now() - startTime;
    const allFilesArray = Array.from(allFiles.entries()).map(([path, content]) => ({
      path,
      content
    }));

    const success = phaseResults.every(p => p.success);

    this.logger.info('Incremental generation completed', {
      success,
      totalPhases: phaseResults.length,
      totalDuration,
      filesGenerated: allFilesArray.length
    });

    return {
      success,
      plan,
      phases: phaseResults,
      allFiles: allFilesArray,
      totalDuration,
      errors: success ? undefined : phaseResults.filter(p => !p.success).flatMap(p => p.errors || [])
    };
  }

  /**
   * Generate files for a specific phase
   */
  private async generatePhase(
    phase: GenerationPhase,
    userPrompt: string,
    knowledgeContext: string,
    existingFiles: { path: string; content: string }[],
    plan: GenerationPlan
  ): Promise<PhaseResult> {
    const phaseStartTime = Date.now();

    try {
      // Build context-aware prompt
      const phasePrompt = this.buildPhasePrompt(
        phase,
        userPrompt,
        knowledgeContext,
        existingFiles,
        plan
      );

      // Get agent configuration from database (system prompt, model, temperature)
      const agentConfig = await this.getAgentConfig(phase.agentId);
      this.logger.info(`Using agent ${phase.agentId}`, {
        model: agentConfig.model,
        temperature: agentConfig.temperature
      });

      // Generate files using AICodeGenerator
      // Note: AICodeGenerator will use MultiModelAIService which handles model selection
      // The systemPrompt from agent is passed through
      const response = await this.aiCodeGenerator.generateComponent({
        prompt: phasePrompt,
        componentName: plan.appName,
        features: [],
        styling: { animations: false, theme: 'light' },
        orchestrated: true,
        systemPrompt: agentConfig.systemPrompt,
        // Model preference can be passed but MultiModelAIService will select best model
        modelPreference: 'quality'
      });

      if (!response.success || !response.files || response.files.length === 0) {
        throw new Error(`Failed to generate files for phase ${phase.phase}: ${response.error || 'Unknown error'}`);
      }

      // Filter files to only include those specified in the phase
      const phaseFiles = response.files.filter(file => 
        phase.files.some(phaseFile => file.path.includes(phaseFile) || phaseFile.includes(file.path))
      );

      // If no files match, use all generated files (fallback)
      const finalFiles = phaseFiles.length > 0 ? phaseFiles : response.files;

      return {
        phase: phase.phase,
        success: true,
        files: finalFiles,
        duration: Date.now() - phaseStartTime
      };
    } catch (error) {
      this.logger.error(`Error generating phase ${phase.phase}`, error as Error);
      return {
        phase: phase.phase,
        success: false,
        files: [],
        errors: [error instanceof Error ? error.message : 'Unknown error'],
        duration: Date.now() - phaseStartTime
      };
    }
  }

  /**
   * Build a context-aware prompt for a phase
   */
  private buildPhasePrompt(
    phase: GenerationPhase,
    userPrompt: string,
    knowledgeContext: string,
    existingFiles: { path: string; content: string }[],
    plan: GenerationPlan
  ): string {
    const existingFilesSection = existingFiles.length > 0 ? `
EXISTING FILES IN PROJECT (you can import from these):
${existingFiles.map(f => `**${f.path}**\n\`\`\`typescript\n${f.content.substring(0, 500)}${f.content.length > 500 ? '...' : ''}\n\`\`\``).join('\n\n')}
` : '';

    return `🚨🚨🚨 CRITICAL: YOU MUST RESPOND WITH A JSON ARRAY ONLY 🚨🚨🚨

**START YOUR RESPONSE WITH: [**
**END YOUR RESPONSE WITH: ]**
**DO NOT USE MARKDOWN CODE BLOCKS!**

PHASE: ${phase.phase}
DESCRIPTION: ${phase.description}

YOUR TASK: Generate ONLY these files:
${phase.files.map(f => `- ${f}`).join('\n')}

${existingFilesSection}

ORIGINAL USER REQUEST:
${userPrompt}

${knowledgeContext ? `RELEVANT KNOWLEDGE:\n${knowledgeContext}\n` : ''}

TECH STACK:
- Framework: ${plan.techStack.framework}
- Build Tool: ${plan.techStack.buildTool}
- Language: ${plan.techStack.language}

IMPORTANT:
- You can import from existing files listed above
- Follow patterns from existing code
- Ensure all imports resolve (files exist)
- Generate ONLY the files listed for this phase
- Each file must be a JSON object with "path" and "content" keys

OUTPUT FORMAT (JSON ARRAY):
[
  {
    "path": "src/App.tsx",
    "content": "import React from 'react';\\n\\nexport default function App() {\\n  return <div>Hello</div>;\\n}"
  }
]`;
  }

  /**
   * Validate files generated in a phase
   */
  async validatePhase(
    files: { path: string; content: string }[],
    existingFiles: { path: string; content: string }[]
  ): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Combine all files for validation
    const allFiles = [...existingFiles, ...files];
    const fileMap = new Map(allFiles.map(f => [f.path, f.content]));

    // Check each file
    for (const file of files) {
      // 1. Syntax validation (basic) - CRITICAL, must fix
      const syntaxErrors = this.validateSyntax(file);
      errors.push(...syntaxErrors);

      // 2. Import resolution - WARNING only (may be resolved in later phases)
      const importErrors = this.validateImports(file, fileMap);
      // Convert import errors to warnings - they might be resolved in later phases
      warnings.push(...importErrors.map(e => `Import warning: ${e.message}`));

      // 3. JSON validity (for config files) - CRITICAL, must fix
      if (file.path.endsWith('.json')) {
        const jsonErrors = this.validateJSON(file);
        errors.push(...jsonErrors);
      }

      // 4. TypeScript/React specific checks - WARNING only (may be false positives)
      if (file.path.endsWith('.tsx') || file.path.endsWith('.ts')) {
        const tsErrors = this.validateTypeScript(file, fileMap);
        // Convert TS errors to warnings - basic checks may have false positives
        warnings.push(...tsErrors.map(e => `TypeScript warning: ${e.message}`));
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      suggestions
    };
  }

  /**
   * Basic syntax validation
   */
  private validateSyntax(file: { path: string; content: string }): ValidationError[] {
    const errors: ValidationError[] = [];
    const content = file.content;

    // Check for common syntax errors
    const problematicPatterns = [
      { pattern: /;\s*}/g, message: 'Semicolon before closing brace (;})', type: 'syntax' as const },
      { pattern: /;\s*\)/g, message: 'Semicolon before closing parenthesis (;))', type: 'syntax' as const },
      { pattern: /return\s*\(;/g, message: 'Incomplete return statement (return (;)', type: 'syntax' as const },
      { pattern: /return\s*{;/g, message: 'Incomplete return statement (return {;)', type: 'syntax' as const },
      { pattern: /return\s*\[;/g, message: 'Incomplete return statement (return [;)', type: 'syntax' as const },
    ];

    problematicPatterns.forEach(({ pattern, message, type }) => {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(() => {
          errors.push({
            file: file.path,
            message,
            type
          });
        });
      }
    });

    return errors;
  }

  /**
   * Validate that all imports resolve
   */
  private validateImports(
    file: { path: string; content: string },
    fileMap: Map<string, string>
  ): ValidationError[] {
    const errors: ValidationError[] = [];
    const content = file.content;

    // Extract import statements
    const importRegex = /import\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;

    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }

    // Check each import
    for (const importPath of imports) {
      // Skip node_modules imports
      if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
        continue;
      }

      // Resolve import path relative to file
      const resolvedPath = this.resolveImportPath(file.path, importPath);

      if (!fileMap.has(resolvedPath) && !resolvedPath.includes('node_modules')) {
        errors.push({
          file: file.path,
          message: `Import "${importPath}" cannot be resolved (file not found: ${resolvedPath})`,
          type: 'import'
        });
      }
    }

    return errors;
  }

  /**
   * Resolve import path relative to file
   */
  private resolveImportPath(filePath: string, importPath: string): string {
    // Remove file extension from import if present
    let resolved = importPath.replace(/\.(tsx?|jsx?)$/, '');

    // If relative import, resolve relative to file directory
    if (resolved.startsWith('.')) {
      const fileDir = filePath.substring(0, filePath.lastIndexOf('/'));
      resolved = `${fileDir}/${resolved.substring(1)}`;
    }

    // Add .tsx extension if no extension
    if (!resolved.match(/\.(tsx?|jsx?|json)$/)) {
      resolved += '.tsx';
    }

    // Remove leading slash
    if (resolved.startsWith('/')) {
      resolved = resolved.substring(1);
    }

    return resolved;
  }

  /**
   * Validate JSON files
   */
  private validateJSON(file: { path: string; content: string }): ValidationError[] {
    const errors: ValidationError[] = [];

    try {
      JSON.parse(file.content);
    } catch (error) {
      errors.push({
        file: file.path,
        message: `Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`,
        type: 'syntax'
      });
    }

    return errors;
  }

  /**
   * Basic TypeScript validation
   */
  private validateTypeScript(
    file: { path: string; content: string },
    fileMap: Map<string, string>
  ): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for unclosed JSX tags (basic check)
    const openTags = (file.content.match(/<[^/>]+>/g) || []).length;
    const selfClosingTags = (file.content.match(/<[^/>]+\/>/g) || []).length;
    const closeTags = (file.content.match(/<\/[^>]+>/g) || []).length;

    // Rough check (not perfect, but catches obvious issues)
    if (openTags - selfClosingTags > closeTags) {
      errors.push({
        file: file.path,
        message: 'Possible unclosed JSX tags detected',
        type: 'syntax'
      });
    }

    return errors;
  }

  /**
   * Fix errors in phase files
   */
  private async fixPhase(
    files: { path: string; content: string }[],
    errors: ValidationError[],
    existingFiles: { path: string; content: string }[],
    phase: GenerationPhase
  ): Promise<{ path: string; content: string }[]> {
    // Only fix syntax and JSON errors (critical errors)
    // Import errors are warnings and will be resolved in later phases
    const criticalErrors = errors.filter(e => e.type === 'syntax' || e.type === 'other');
    
    if (criticalErrors.length === 0) {
      this.logger.info(`No critical errors to fix in phase ${phase.phase}, only warnings`);
      return files; // Return files as-is if only warnings
    }

    const fixedFiles = files.map(file => {
      let content = file.content;
      let wasFixed = false;

      // Fix syntax errors for this file
      const fileErrors = criticalErrors.filter(e => e.file === file.path);
      
      for (const error of fileErrors) {
        if (error.message.includes(';})') || error.message.includes('Semicolon before closing brace')) {
          // Fix ;} pattern
          content = content.replace(/;\s*\n\s*}/g, '\n}');
          content = content.replace(/;\s*}/g, '}');
          wasFixed = true;
        }
        if (error.message.includes(';))') || error.message.includes('Semicolon before closing parenthesis')) {
          // Fix ;) pattern
          content = content.replace(/;\s*\n\s*\)/g, '\n)');
          content = content.replace(/;\s*\)/g, ')');
          wasFixed = true;
        }
        if (error.message.includes('return (;') || error.message.includes('Incomplete return statement')) {
          // Fix return (; pattern
          content = content.replace(/return\s*\(;/g, 'return (');
          wasFixed = true;
        }
        if (error.message.includes('return {;')) {
          // Fix return {; pattern
          content = content.replace(/return\s*{;/g, 'return {');
          wasFixed = true;
        }
        if (error.message.includes('return [;')) {
          // Fix return [; pattern
          content = content.replace(/return\s*\[;/g, 'return [');
          wasFixed = true;
        }
        if (error.message.includes('Invalid JSON')) {
          // Try to fix common JSON issues
          // Remove trailing commas
          content = content.replace(/,(\s*[}\]])/g, '$1');
          wasFixed = true;
        }
      }

      if (wasFixed) {
        this.logger.info(`Fixed errors in ${file.path}`);
      }

      return {
        path: file.path,
        content
      };
    });

    return fixedFiles;
  }

  /**
   * Get agent configuration from database
   */
  private async getAgentConfig(agentId: string): Promise<{
    systemPrompt: string;
    model: string;
    temperature: number;
  }> {
    try {
      const agentResults = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId));

      if (agentResults.length > 0) {
        const agent = agentResults[0];
        this.logger.info(`Loaded agent ${agentId} from database`, {
          model: agent.model,
          hasSystemPrompt: !!agent.systemPrompt
        });
        
        return {
          systemPrompt: agent.systemPrompt || this.getDefaultPrompt(agentId),
          model: agent.model || 'claude-sonnet-4-5-20250929',
          temperature: agent.temperature || 0.3
        };
      }

      // Fallback to default
      this.logger.warn(`Agent ${agentId} not found in database, using defaults`);
      return {
        systemPrompt: this.getDefaultPrompt(agentId),
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0.3
      };
    } catch (error) {
      this.logger.error(`Failed to load agent ${agentId} from database`, error as Error);
      return {
        systemPrompt: this.getDefaultPrompt(agentId),
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0.3
      };
    }
  }

  /**
   * Get default prompt for an agent
   */
  private getDefaultPrompt(agentId: string): string {
    if (agentId === 'component-developer') {
      return `You are an expert code generator. You MUST respond with ONLY a JSON array of files. No markdown, no explanations. Start with [ and end with ].`;
    }
    return `You are an expert code generator. Generate clean, production-ready code.`;
  }
}

