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
  warnings?: string[];
}

export class IncrementalOrchestrator {
  private logger: SimpleLogger;
  private aiCodeGenerator: AICodeGenerator;
  private multiModelAI: MultiModelAIService;
  private maxFixAttempts = 3;
  private agentConfigCache: Map<string, { systemPrompt: string; model: string; temperature: number }> = new Map();

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
    progressCallback?: (phase: string, progress: number, message: string) => void,
    fileCallback?: (file: { path: string; content: string }, index: number, total: number) => void
  ): Promise<IncrementalGenerationResult> {
    const startTime = Date.now();
    const phaseResults: PhaseResult[] = [];
    const allFiles: Map<string, string> = new Map(); // path -> content

    // Add existing files to the map
    existingFiles.forEach(file => {
      allFiles.set(this.normalizePath(file.path), file.content);
    });

    this.logger.info(`Starting incremental generation. App: ${plan.appName}, Total phases: ${plan.phases.length}`);

    // Build phase dependency graph for parallel execution
    const completedPhases = new Set<string>();
    const phaseMap = new Map<string, GenerationPhase>();
    plan.phases.forEach(phase => phaseMap.set(phase.phase, phase));

    // Process phases with parallel execution where possible
    while (completedPhases.size < plan.phases.length) {
      // Find phases that can run now (dependencies satisfied)
      const readyPhases = plan.phases.filter(phase => 
        !completedPhases.has(phase.phase) &&
        (phase.dependencies.length === 0 || 
         phase.dependencies.every(dep => completedPhases.has(dep)))
      );

      if (readyPhases.length === 0) {
        // Circular dependency or error - fallback to sequential
        this.logger.warn('No ready phases found, falling back to sequential execution');
        const remainingPhases = plan.phases.filter(p => !completedPhases.has(p.phase));
        if (remainingPhases.length > 0) {
          readyPhases.push(remainingPhases[0]);
        } else {
          break;
        }
      }

      // Execute ready phases in parallel
      const phasePromises = readyPhases.map(async (phase) => {
        const phaseStartTime = Date.now();
        const phaseIndex = plan.phases.findIndex(p => p.phase === phase.phase);

        this.logger.info(`Processing phase ${phaseIndex + 1}/${plan.phases.length}: ${phase.phase} (${readyPhases.length > 1 ? 'parallel' : 'sequential'})`);

        if (progressCallback) {
          const completedCount = completedPhases.size;
          progressCallback(phase.phase, (completedCount / plan.phases.length) * 100, `Generating ${phase.description}...`);
        }

        // Get files from completed phases (dependencies)
        const existingPhaseFiles = this.getRelevantFilesForPhase(
          Array.from(allFiles.entries()).map(([path, content]) => ({ path, content })),
          phase,
          plan
        );

        // Generate phase files
        let phaseResult: PhaseResult | null = null;
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
            
            // AI-powered syntax fixing (replaces regex patterns)
            // Instead of hardcoded regex patterns, we use AI to intelligently fix syntax errors.
            // Benefits: AI understands context, handles edge cases, uses esbuild for real errors
            this.logger.info(`Validating and fixing syntax errors in phase ${phase.phase} with AI...`);
            const { AISyntaxFixer } = await import('./AISyntaxFixer');
            const aiFixer = new AISyntaxFixer();
            
            const fixResult = await aiFixer.validateAndFix(phaseResult.files);
            
            if (fixResult.success) {
              phaseResult.files = fixResult.fixedFiles;
              this.logger.info(`✅ AI fixed all compilation errors in phase ${phase.phase} (${fixResult.fixAttempts} attempt(s))`);
            } else if (fixResult.remainingErrors.length > 0) {
              this.logger.warn(`AI fixed some errors but ${fixResult.remainingErrors.length} remain in phase ${phase.phase}`);
              phaseResult.files = fixResult.fixedFiles; // Use partially fixed files
            }
          }

          // Validate phase (basic checks - esbuild validation already done above)
          if (!phaseResult) {
            throw new Error(`Phase ${phase.phase} failed: phaseResult is null`);
          }
          validation = await this.validatePhase(phaseResult.files, existingPhaseFiles);
          
          // Auto-create missing CSS files
          const missingCssFiles = await this.ensureMissingCssFiles(phaseResult.files, existingPhaseFiles);
          if (missingCssFiles.length > 0) {
            this.logger.info(`Auto-creating ${missingCssFiles.length} missing CSS file(s) for phase ${phase.phase}`);
            phaseResult.files.push(...missingCssFiles);
            phaseResult.files = this.normalizeFiles(phaseResult.files);
            validation = await this.validatePhase(phaseResult.files, existingPhaseFiles);
          }

          if (!validation.valid && fixAttempts < this.maxFixAttempts) {
            this.logger.warn(`Phase ${phase.phase} validation failed (attempt ${fixAttempts + 1}/${this.maxFixAttempts}): ${validation.errors.map(e => `${e.file}: ${e.message}`).join(', ')}`);
            
            if (progressCallback) {
              const completedCount = completedPhases.size;
              progressCallback(phase.phase, (completedCount / plan.phases.length) * 100, `Fixing errors in ${phase.phase} with AI...`);
            }

            // Use AI-powered syntax fixing (replaces regex patterns)
            // AI understands context and can handle edge cases better than regex
            const { AISyntaxFixer } = await import('./AISyntaxFixer');
            const aiFixer = new AISyntaxFixer();
            const aiFixResult = await aiFixer.validateAndFix(phaseResult.files);
            
            if (aiFixResult.success) {
              phaseResult.files = this.normalizeFiles(aiFixResult.fixedFiles);
              this.logger.info(`✅ AI fixed all errors in phase ${phase.phase} (${aiFixResult.fixAttempts} attempt(s))`);
            } else {
              // Use partially fixed files - AI made progress even if not perfect
              phaseResult.files = this.normalizeFiles(aiFixResult.fixedFiles);
              this.logger.warn(`AI fixed some errors but ${aiFixResult.remainingErrors.length} remain in phase ${phase.phase}`);
            }
            
            fixAttempts++;
          } else {
            if (!validation.valid) {
              const remainingErrors = validation.errors.map(e => `${e.file}: ${e.message}`).join(', ');
              this.logger.error(`Phase ${phase.phase} failed after ${fixAttempts} fix attempts, continuing with errors: ${remainingErrors}`);
            }
            if (!phaseResult) {
              throw new Error(`Phase ${phase.phase} failed: phaseResult is null`);
            }
            phaseResult.errors = validation.errors.map(e => e.message);
            phaseResult.warnings = validation.warnings;
            break;
          }
        } while (!validation.valid && fixAttempts < this.maxFixAttempts);

        // Add phase files to all files (thread-safe with Map)
        if (!phaseResult) {
          throw new Error(`Phase ${phase.phase} failed: phaseResult is null`);
        }

        // Thread-safe file addition
        phaseResult.files.forEach((file) => {
          const normalizedFile = { ...file, path: this.normalizePath(file.path) };
          allFiles.set(normalizedFile.path, normalizedFile.content);
          if (fileCallback) {
            const totalFilesSoFar = Array.from(allFiles.keys()).length;
            fileCallback(normalizedFile, totalFilesSoFar - 1, totalFilesSoFar);
          }
        });

        // Validate fullstack integration after backend phases
        if (phase.phase.includes('backend') || phase.phase.includes('frontend-api')) {
          const { fullstackIntegrationService } = await import('./FullstackIntegrationService');
          const frontendFiles = Array.from(allFiles.entries())
            .filter(([path]) => !path.includes('server/'))
            .map(([path, content]) => ({ path, content }));
          const backendFiles = Array.from(allFiles.entries())
            .filter(([path]) => path.includes('server/'))
            .map(([path, content]) => ({ path, content }));
          
          const fullstackConfig = await fullstackIntegrationService.detectFullstackNeeds(
            userPrompt,
            Array.from(allFiles.entries()).map(([path, content]) => ({ path, content }))
          );
          
          if (fullstackConfig.needsBackend) {
            const integrationCheck = fullstackIntegrationService.validateIntegration(
              frontendFiles,
              backendFiles,
              fullstackConfig
            );
            
            if (!integrationCheck.isValid) {
              this.logger.warn(`Fullstack integration issues detected: ${integrationCheck.issues.join(', ')}. Fixes: ${integrationCheck.fixes.join(', ')}`);
              
              const allExistingFiles = Array.from(allFiles.entries()).map(([path, content]) => ({ path, content }));
              const backendFilesWithClient = fullstackIntegrationService.generateBackendFiles(
                fullstackConfig,
                allExistingFiles
              );
              
              backendFilesWithClient.forEach(file => {
                if (!allFiles.has(file.path)) {
                  allFiles.set(file.path, file.content);
                  if (fileCallback) {
                    const totalFilesSoFar = Array.from(allFiles.keys()).length;
                    fileCallback(file, totalFilesSoFar - 1, totalFilesSoFar);
                  }
                }
              });
              
              const fixed = await fullstackIntegrationService.fixIntegrationIssues(
                frontendFiles,
                backendFiles,
                integrationCheck
              );
              
              fixed.frontendFiles.forEach(file => {
                if (!allFiles.has(file.path) || allFiles.get(file.path) !== file.content) {
                  allFiles.set(file.path, file.content);
                  if (fileCallback) {
                    const totalFilesSoFar = Array.from(allFiles.keys()).length;
                    fileCallback(file, totalFilesSoFar - 1, totalFilesSoFar);
                  }
                }
              });
              
              fixed.backendFiles.forEach(file => {
                if (!allFiles.has(file.path) || allFiles.get(file.path) !== file.content) {
                  allFiles.set(file.path, file.content);
                  if (fileCallback) {
                    const totalFilesSoFar = Array.from(allFiles.keys()).length;
                    fileCallback(file, totalFilesSoFar - 1, totalFilesSoFar);
                  }
                }
              });
            }
          }
        }

        phaseResult.duration = Date.now() - phaseStartTime;
        phaseResult.success = phaseResult.files.length > 0 && (!phaseResult.errors || phaseResult.errors.length === 0);

        if (!phaseResult.success) {
          const errorMsg = phaseResult.errors ? phaseResult.errors.join(', ') : 'unknown errors';
          this.logger.warn(`Phase ${phase.phase} completed with warnings after ${fixAttempts} fix attempts. Errors: ${errorMsg}. Files generated: ${phaseResult.files.length}`);
        } else if (phaseResult.errors && phaseResult.errors.length > 0) {
          this.logger.info(`Phase ${phase.phase} completed with ${phaseResult.errors.length} warnings. Files generated: ${phaseResult.files.length}`);
        }

        return { phase: phase.phase, result: phaseResult };
      });

      // Wait for all parallel phases to complete
      const results = await Promise.all(phasePromises);
      
      // Add results and mark phases as completed
      results.forEach(({ phase, result }) => {
        phaseResults.push(result);
        completedPhases.add(phase);
        
        if (progressCallback) {
          const completedCount = completedPhases.size;
          progressCallback(phase, (completedCount / plan.phases.length) * 100, `Completed ${phase}`);
        }
      });

      if (readyPhases.length > 1) {
        this.logger.info(`Completed ${readyPhases.length} phases in parallel: ${readyPhases.map(p => p.phase).join(', ')}`);
      }
    }

    const totalDuration = Date.now() - startTime;
    let allFilesArray = Array.from(allFiles.entries()).map(([path, content]) => ({
        path: this.normalizePath(path),
        content
    }));

    // Analyze filesystem and generate any missing critical files
    try {
      const { MissingFileGenerator } = await import('./MissingFileGenerator');
      const missingFileGenerator = new MissingFileGenerator();
      
      if (progressCallback) {
        progressCallback('final', 95, 'Analyzing filesystem for missing files...');
      }
      
      const missingFiles = await missingFileGenerator.analyzeAndGenerateMissingFiles(allFilesArray, {
        userPrompt,
        appName: plan.appName,
        knowledgeContext
      });
      
      if (missingFiles.length > 0) {
        this.logger.info(`Generated ${missingFiles.length} missing critical file(s) based on filesystem analysis`);
        
        // Add missing files to allFiles
        missingFiles.forEach(file => {
          const normalizedFile = { ...file, path: this.normalizePath(file.path) };
          allFiles.set(normalizedFile.path, normalizedFile.content);
          if (fileCallback) {
            const totalFilesSoFar = Array.from(allFiles.keys()).length;
            fileCallback(normalizedFile, totalFilesSoFar - 1, totalFilesSoFar);
          }
        });
        
        // Update allFilesArray
        allFilesArray = Array.from(allFiles.entries()).map(([path, content]) => ({
          path: this.normalizePath(path),
          content
        }));
      }
    } catch (error) {
      this.logger.warn('Failed to analyze and generate missing files', error as Error);
      // Continue anyway - not critical
    }

    // CRITICAL: Final validation and auto-fix before returning
    // This ensures projects are functional after first generation
    let finalFiles = allFilesArray;
    let validationIssuesFixed = 0;
    let finalValidationPassed = false;
    const finalValidationErrors: string[] = [];
    const finalValidationWarnings: string[] = [];
    
    try {
      if (progressCallback) {
        progressCallback('validation', 98, 'Validating and fixing project to ensure it works...');
      }

      const { ProjectValidator } = await import('./ProjectValidator');
      const validator = new ProjectValidator();
      const validationResult = await validator.validateAndFixProject(allFilesArray, {
        userPrompt,
        appName: plan.appName,
        knowledgeContext
      });

      finalFiles = validationResult.validatedFiles;
      validationIssuesFixed = validationResult.issuesFixed;
      finalValidationPassed = validationResult.canStart && validationResult.isValid;
      finalValidationErrors.push(...validationResult.errors);
      finalValidationWarnings.push(...validationResult.warnings);

      if (validationResult.issuesFixed > 0) {
        this.logger.info(`✅ Auto-fixed ${validationResult.issuesFixed} issues during final validation`);
      }

      if (!validationResult.canStart) {
        this.logger.warn(`⚠️ Project has ${validationResult.criticalIssues} critical issues that prevent startup`);
        if (validationResult.errors.length > 0) {
          this.logger.warn(`Errors: ${validationResult.errors.join(', ')}`);
        }
      } else {
        this.logger.info(`✅ Project validated: Can start successfully`);
      }

      if (validationResult.warnings.length > 0) {
        this.logger.info(`Warnings: ${validationResult.warnings.slice(0, 5).join(', ')}${validationResult.warnings.length > 5 ? '...' : ''}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      finalValidationErrors.push(`Final validation failed: ${message}`);
      this.logger.error('Final validation failed; generated project will be marked unsuccessful', error as Error);
    }

    // A generated app is only successful when files exist, phases have no blocking
    // validation errors, and the final project validator says it can start.
    const hasFiles = finalFiles.length > 0;
    const allPhasesSuccessful = phaseResults.every(p => p.success);
    const success = hasFiles && allPhasesSuccessful && finalValidationPassed;

    const phasesWithWarnings = phaseResults.filter(p => p.errors && p.errors.length > 0).length;
    this.logger.info(`Incremental generation completed. Success: ${success}, Total phases: ${phaseResults.length}, Duration: ${totalDuration}ms, Files generated: ${finalFiles.length}, Issues auto-fixed: ${validationIssuesFixed}, Phases with warnings: ${phasesWithWarnings}, Final validation passed: ${finalValidationPassed}`);

    const phaseErrors = phaseResults
      .filter(p => !p.success)
      .flatMap(p => p.errors?.map(error => `${p.phase}: ${error}`) || []);
    const allErrors = [...phaseErrors, ...finalValidationErrors];

    // Always return validated and fixed files
    return {
      success,
      plan,
      phases: phaseResults,
      allFiles: finalFiles,
      totalDuration,
      errors: success ? undefined : allErrors,
      warnings: finalValidationWarnings.length > 0 ? finalValidationWarnings : undefined
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
      // Pre-research: Prepare optimal context before agent starts
      const { ContextResearchService } = await import('./ContextResearchService');
      const contextResearch = new ContextResearchService();
      
      this.logger.info(`Pre-research: Preparing context for phase ${phase.phase}...`);
      const enhancedContext = await contextResearch.prepareContextForAgent(
        phase.agentId,
        userPrompt,
        phase,
        existingFiles,
        plan
      );

      if (!enhancedContext.isComplete && enhancedContext.missingInfo) {
        this.logger.warn(`Context incomplete for phase ${phase.phase}: ${enhancedContext.missingInfo.join(', ')}`);
      }

      // Use enhanced context (summarized files, patterns, etc.)
      const optimizedFiles = enhancedContext.existingFiles;
      const optimizedKnowledge = enhancedContext.knowledge || knowledgeContext;

      // Build context-aware prompt with optimized context
      const phasePrompt = this.buildPhasePrompt(
        phase,
        userPrompt,
        optimizedKnowledge,
        optimizedFiles,
        plan,
        enhancedContext.patterns
      );

      // Get agent configuration from database (cached)
      const agentConfig = await this.getAgentConfig(phase.agentId);
      this.logger.info(`Using agent ${phase.agentId} with model ${agentConfig.model} and temperature ${agentConfig.temperature}`);

      // Track token usage
      const inputTokens = this.estimateTokens(phasePrompt + agentConfig.systemPrompt);
      this.logger.info(`Phase ${phase.phase} estimated input tokens: ${inputTokens}`);

      // Generate files using AICodeGenerator
      const response = await this.aiCodeGenerator.generateComponent({
        prompt: phasePrompt,
        componentName: plan.appName,
        features: [],
        styling: { animations: false, theme: 'light' },
        orchestrated: true,
        systemPrompt: agentConfig.systemPrompt,
        modelPreference: 'quality'
      });

      // Track output tokens
      const outputTokens = this.estimateTokens(
        response.files?.map(f => f.content).join('\n') || ''
      );
      const totalTokens = inputTokens + outputTokens;
      this.logger.info(`Phase ${phase.phase} token usage: ${inputTokens} input + ${outputTokens} output = ${totalTokens} total`);

      if (!response.success || !response.files || response.files.length === 0) {
        throw new Error(`Failed to generate files for phase ${phase.phase}: ${response.error || 'Unknown error'}`);
      }

      // CRITICAL: Essential config files - DIFFERENT for Python vs React projects!
      const isPythonProject = plan.techStack.language?.toLowerCase() === 'python' ||
        plan.techStack.framework?.toLowerCase().includes('flask') ||
        plan.techStack.framework?.toLowerCase().includes('django') ||
        plan.techStack.framework?.toLowerCase().includes('fastapi') ||
        plan.techStack.framework?.toLowerCase().includes('streamlit') ||
        response.files.some(f => f.path.endsWith('.py'));

      // Choose essential files based on project type
      const essentialConfigPatterns = isPythonProject 
        ? [
            // Python project essentials
            'requirements.txt',
            'README.md',
            '.env',
            '.env.example',
            'app.py',
            'main.py',
            'config.py',
          ]
        : [
            // React/TypeScript project essentials
            'package.json',
            'tsconfig.json',
            'tsconfig.node.json',
            'vite.config.ts',
            'vite.config.js',
            'postcss.config.js',
            'postcss.config.cjs',
            'tailwind.config.js',
            'tailwind.config.ts',
            'index.html',
            '.env',
            '.env.example',
          ];

      this.logger.info(`Project type: ${isPythonProject ? 'Python' : 'React/TypeScript'}, using ${essentialConfigPatterns.length} essential patterns`);

      // Filter files to only include those specified in the phase
      const phaseFiles = response.files.filter(file => 
        phase.files.some(phaseFile => file.path.includes(phaseFile) || phaseFile.includes(file.path))
      );

      // Always include essential config files - NEVER filter them out
      const essentialFiles = response.files.filter(file =>
        essentialConfigPatterns.some(pattern => 
          file.path === pattern || 
          file.path.endsWith(`/${pattern}`) ||
          file.path.startsWith('client/') && file.path.endsWith(pattern)
        )
      );

      // Merge phase files with essential files (deduplicate by path)
      const mergedFilePaths = new Set<string>();
      const finalFiles: { path: string; content: string }[] = [];
      
      [...phaseFiles, ...essentialFiles].forEach(file => {
        if (!mergedFilePaths.has(file.path)) {
          mergedFilePaths.add(file.path);
          finalFiles.push(file);
        }
      });

      // If still no files match, use all generated files (fallback)
      const resultFiles = finalFiles.length > 0 ? finalFiles : response.files;
      
      this.logger.info(`Phase ${phase.phase} files: ${resultFiles.length} (phase: ${phaseFiles.length}, essential: ${essentialFiles.length})`);

      return {
        phase: phase.phase,
        success: true,
        files: resultFiles,
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
   * Estimate token count (rough approximation: 1 token ≈ 4 characters)
   */
  private estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  /**
   * Build a MINIMAL context-aware prompt for a phase
   * 
   * ARCHITECTURAL NOTE: This method provides ONLY structural context.
   * All coding rules, syntax requirements, export/import patterns, and styling
   * guidelines should be in the agent's systemPrompt (stored in database).
   * 
   * This separation allows:
   * - Orchestrator: Focus on orchestration (phases, dependencies, validation)
   * - Agents: Focus on domain-specific coding rules and patterns
   * - No prompt collision between orchestrator and agent instructions
   */
  private buildPhasePrompt(
    phase: GenerationPhase,
    userPrompt: string,
    knowledgeContext: string,
    existingFiles: { path: string; content: string }[],
    plan: GenerationPlan,
    patterns?: Array<{ type: string; pattern: string; frequency: number; files: string[] }>
  ): string {
    const isModification = existingFiles.length > 0;
    const modificationKeywords = ['fix', 'change', 'update', 'modify', 'edit', 'add', 'remove', 'delete', 'improve', 'enhance'];
    const isModifyRequest = modificationKeywords.some(keyword => userPrompt.toLowerCase().includes(keyword));
    
    // Detect project structure for context (orchestrator responsibility)
    const isMonorepo = existingFiles.some(f => f.path.startsWith('server/') || f.path.startsWith('client/'));
    const phaseUsesClientDir = phase.files.some(file => file.startsWith('client/'));
    const hasServer = existingFiles.some(f => f.path.startsWith('server/'));
    const isLandingPage = userPrompt.toLowerCase().includes('landing page') || 
                          userPrompt.toLowerCase().includes('nice landing') || 
                          userPrompt.toLowerCase().includes('design');
    
    // Build existing files section (structural context)
    const existingFilesSection = existingFiles.length > 0 ? `
EXISTING FILES (${existingFiles.length} files - you can import from these):
${existingFiles.map(f => `${f.path}:\n\`\`\`\n${f.content.substring(0, 800)}${f.content.length > 800 ? '\n...' : ''}\n\`\`\``).join('\n\n')}
` : '';

    // Build patterns section (orchestrator-detected patterns to follow)
    const patternsSection = patterns && patterns.length > 0 ? `
CODE PATTERNS TO FOLLOW (detected from existing files):
${patterns.slice(0, 5).map(p => `- ${p.type}: ${p.pattern}`).join('\n')}
` : '';

    // Build monorepo context (structural information only)
    const monorepoContext = isMonorepo ? `
PROJECT STRUCTURE: Monorepo with client/ and ${hasServer ? 'server/' : ''} directories
- Frontend files go in: client/src/
- Frontend config goes in: client/
- Backend files go in: server/
` : '';

    return `USER REQUEST: ${userPrompt}

PHASE: ${phase.phase}
DESCRIPTION: ${phase.description}

FILES TO GENERATE:
${phase.files.map(f => `- ${f}`).join('\n')}
${monorepoContext}
${phaseUsesClientDir ? `
PROJECT STRUCTURE: Fullstack client/server app
- Generate the exact requested client/ paths. Do not create duplicate root-level package.json, index.html, vite.config.ts, or src/ files.
- Frontend source files go in client/src/.
- Frontend config files go in client/.
` : ''}
${existingFilesSection}
${patternsSection}
${knowledgeContext ? `CONTEXT:\n${knowledgeContext}\n` : ''}
TECH STACK:
- Framework: ${plan.techStack.framework}
- Build Tool: ${plan.techStack.buildTool}
- Language: ${plan.techStack.language}
${isModification && isModifyRequest ? `
MODE: Modification - only modify/create files listed above, preserve others
` : ''}
${isLandingPage ? `
NOTE: This is a landing page - make it visually impressive
` : ''}

**NULL-SAFETY (CRITICAL - PREVENTS RUNTIME CRASHES):**
All code MUST handle undefined/null values safely:
- Use optional chaining: object?.property?.nested
- Use nullish coalescing: value ?? defaultValue
- Safe Date: new Date(value || Date.now()) NOT new Date(value)
- Safe array: (array || []).map(...) NOT array.map(...)
- Always check before .getTime(): if (date instanceof Date) date.getTime()
- Initialize state with valid defaults, not undefined
Example: const startTime = entry?.startTime ? new Date(entry.startTime) : new Date();

**CRITICAL - REQUIRED FILES FOR REACT/TYPESCRIPT PROJECTS:**
If this is a base phase for a React/TypeScript project, you MUST generate ALL of these files:
- package.json (with vite, @vitejs/plugin-react, react, react-dom)
- tsconfig.json (TypeScript configuration)
- vite.config.ts (Vite configuration with React plugin)
- index.html (HTML entry point with script tag pointing to /src/main.tsx)
- src/main.tsx (React entry point that imports App and renders to #root)

If this is a core phase, you MUST generate:
- src/App.tsx (main app component with default export)
- src/index.css (global styles)

For fullstack client/server phases, prefix the frontend paths above with client/ exactly as listed in FILES TO GENERATE.

**DO NOT skip any required files - the app will not work without them!**

OUTPUT: Respond with JSON array: [{"path": "...", "content": "..."}]`;
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
    const allFiles = this.normalizeFiles([...existingFiles, ...files]);
    const fileMap = new Map(allFiles.map(f => [f.path, f.content]));

    // Check each file
    for (const file of this.normalizeFiles(files)) {
      // 1. Syntax validation (basic) - CRITICAL, must fix
      const syntaxErrors = this.validateSyntax(file);
      errors.push(...syntaxErrors);

      // 2. Import resolution - blocking within the visible phase context
      const importErrors = this.validateImports(file, fileMap);
      errors.push(...importErrors);

      // 3. JSON validity (for config files) - CRITICAL, must fix
      if (file.path.endsWith('.json')) {
        const jsonErrors = this.validateJSON(file);
        errors.push(...jsonErrors);
      }

      // 4. TypeScript/React specific checks - basic heuristic, keep as warnings
      if (file.path.endsWith('.tsx') || file.path.endsWith('.ts')) {
        const tsErrors = this.validateTypeScript(file, fileMap);
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
   * Basic syntax validation - only catch critical errors that will break compilation
   */
  private validateSyntax(file: { path: string; content: string }): ValidationError[] {
    const errors: ValidationError[] = [];
    const content = file.content;

    // Only check for CRITICAL syntax errors that will definitely break compilation
    // Skip patterns that might be false positives or can be auto-fixed
    
    // Check for semicolon after opening brace (e.g., "interface Position {;") - CRITICAL
    if (/\{\s*;/g.test(content)) {
      // But exclude cases where it might be valid (like in template literals or comments)
      const lines = content.split('\n');
      lines.forEach((line, index) => {
        if (/\{\s*;/.test(line) && !line.includes('//') && !line.includes('/*')) {
          errors.push({
            file: file.path,
            line: index + 1,
            message: 'Semicolon after opening brace ({;)',
            type: 'syntax'
          });
        }
      });
    }

    // Check for incomplete return statements - CRITICAL
    if (/return\s*\(;/.test(content)) {
      errors.push({
        file: file.path,
        message: 'Incomplete return statement (return (;)',
        type: 'syntax'
      });
    }
    if (/return\s*{;/.test(content)) {
      errors.push({
        file: file.path,
        message: 'Incomplete return statement (return {;)',
        type: 'syntax'
      });
    }
    if (/return\s*\[;/.test(content)) {
      errors.push({
        file: file.path,
        message: 'Incomplete return statement (return [;)',
        type: 'syntax'
      });
    }

    // Note: We removed checks for ;} and ;) because:
    // 1. They can be false positives (valid in some contexts)
    // 2. The AICodeGenerator already fixes these
    // 3. They're not critical enough to block generation

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
      const resolvedPaths = this.resolveImportCandidates(file.path, importPath);

      if (resolvedPaths.length > 0 && !resolvedPaths.some(path => fileMap.has(path))) {
        errors.push({
          file: file.path,
          message: `Import "${importPath}" cannot be resolved (checked: ${resolvedPaths.join(', ')})`,
          type: 'import'
        });
      }
    }

    return errors;
  }

  /**
   * Resolve import path relative to file
   */
  private resolveImportCandidates(filePath: string, importPath: string): string[] {
    if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
      return [];
    }

    const normalizedFilePath = this.normalizePath(filePath);
    const fileDir = normalizedFilePath.includes('/')
      ? normalizedFilePath.substring(0, normalizedFilePath.lastIndexOf('/'))
      : '';
    const basePath = importPath.startsWith('/')
      ? importPath.substring(1)
      : this.normalizePath(`${fileDir}/${importPath}`);
    const normalizedBase = this.normalizePath(basePath);

    if (/\.[a-zA-Z0-9]+$/.test(normalizedBase)) {
      return [normalizedBase];
    }

    return [
      normalizedBase,
      `${normalizedBase}.tsx`,
      `${normalizedBase}.ts`,
      `${normalizedBase}.jsx`,
      `${normalizedBase}.js`,
      `${normalizedBase}.json`,
      `${normalizedBase}.css`,
      `${normalizedBase}/index.tsx`,
      `${normalizedBase}/index.ts`,
      `${normalizedBase}/index.jsx`,
      `${normalizedBase}/index.js`
    ];
  }

  private normalizeFiles(files: { path: string; content: string }[]): { path: string; content: string }[] {
    const normalized = new Map<string, string>();

    for (const file of files) {
      normalized.set(this.normalizePath(file.path), file.content);
    }

    return Array.from(normalized.entries()).map(([path, content]) => ({ path, content }));
  }

  private normalizePath(filePath: string): string {
    const parts: string[] = [];
    const normalized = filePath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/^\.\//, '');

    for (const part of normalized.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') {
        parts.pop();
      } else {
        parts.push(part);
      }
    }

    return parts.join('/');
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
    _fileMap: Map<string, string>
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
   * Ensure missing CSS files are created based on imports
   */
  private async ensureMissingCssFiles(
    files: { path: string; content: string }[],
    existingFiles: { path: string; content: string }[]
  ): Promise<Array<{ path: string; content: string }>> {
    const allFiles = [...existingFiles, ...files];
    const fileMap = new Map(allFiles.map(f => [f.path, f.content]));
    const missingCssFiles: Array<{ path: string; content: string }> = [];
    const createdPaths = new Set<string>();

    // Check all TypeScript/TSX/JSX files for CSS imports
    for (const file of allFiles) {
      if (file.path.endsWith('.tsx') || file.path.endsWith('.ts') || file.path.endsWith('.jsx') || file.path.endsWith('.js')) {
        // Find CSS imports (e.g., import './App.css', import './styles.css')
        const cssImportRegex = /import\s+['"](\.\/[^'"]+\.css)['"]/g;
        let match;
        while ((match = cssImportRegex.exec(file.content)) !== null) {
          const cssPath = match[1];
          // Resolve relative path
          const fileDir = file.path.substring(0, file.path.lastIndexOf('/')) || '.';
          const resolvedPath = cssPath.startsWith('./')
            ? `${fileDir}/${cssPath.substring(2)}`
            : cssPath;
          
          // If CSS file doesn't exist and we haven't created it yet, create a placeholder
          if (!fileMap.has(resolvedPath) && !createdPaths.has(resolvedPath)) {
            const fileName = resolvedPath.split('/').pop() || 'styles.css';
            const componentName = fileName.replace('.css', '');
            
            this.logger.info(`Creating missing CSS file: ${resolvedPath} (imported by ${file.path})`);
            missingCssFiles.push({
              path: resolvedPath,
              content: `/* Auto-generated CSS file for ${componentName} component */
/* This file was automatically created because it was imported but missing */

.${componentName.toLowerCase()} {
  /* Add your styles here */
}
`
            });
            createdPaths.add(resolvedPath);
            fileMap.set(resolvedPath, missingCssFiles[missingCssFiles.length - 1].content);
          }
        }
      }
    }

    return missingCssFiles;
  }

  /**
   * Fix errors in phase files
   */
  private async fixPhase(
    files: { path: string; content: string }[],
    _errors: ValidationError[],
    _existingFiles: { path: string; content: string }[],
    _phase: GenerationPhase
  ): Promise<{ path: string; content: string }[]> {
    // ALWAYS apply syntax fixes, even if no errors reported
    // This ensures we catch {; patterns and other syntax errors proactively
    // The errors array may be empty when called proactively after generation

    const fixedFiles = files.map(file => {
      let content = file.content;
      let wasFixed = false;

      // Apply comprehensive fixes to ALL files, regardless of error messages
      // This ensures we catch syntax errors even if validation didn't flag them
      
      // CRITICAL FIX: Handle interface/type declarations with extends/implements first
      const interfacePatterns = [
        // Match: export interface Name extends ... {;
        { pattern: /(export\s+interface\s+\w+(?:\s+extends\s+[^{]+)?\s*)\{\s*;/g, name: 'export interface ... {;' },
        // Match: interface Name extends ... {;
        { pattern: /(interface\s+\w+(?:\s+extends\s+[^{]+)?\s*)\{\s*;/g, name: 'interface ... {;' },
        // Match: export type Name = {;
        { pattern: /(export\s+type\s+\w+\s*=\s*)\{\s*;/g, name: 'export type = {;' },
        // Match: type Name = {;
        { pattern: /(type\s+\w+\s*=\s*)\{\s*;/g, name: 'type = {;' },
      ];
      
      const beforeFix = content;
      interfacePatterns.forEach(({ pattern, name }) => {
        pattern.lastIndex = 0;
        const beforeCount = (content.match(pattern) || []).length;
        if (beforeCount > 0) {
          content = content.replace(pattern, '$1{');
          const afterCount = (content.match(pattern) || []).length;
          if (beforeCount > afterCount) {
            this.logger.info(`Fixed ${beforeCount - afterCount} ${name} patterns in ${file.path}`);
          }
        }
      });
      
      // Fix other brace semicolon patterns
      const braceSemicolonPatterns = [
        /\{\s*;/g,                    // Simple {;
        /\{\s*\n\s*;/g,                // {\n;
        /\{\s*;\s*\n/g,                // {;\n
        /const\s+\w+\s*=\s*\{\s*;/g,  // const name = {;
        /\)\s*=>\s*\{\s*;/g           // () => {;
      ];
      
      braceSemicolonPatterns.forEach(pattern => {
        // Reset regex lastIndex to avoid state issues
        pattern.lastIndex = 0;
        content = content.replace(pattern, (match) => {
          // Remove semicolon: replace "; " or ";\n" or ";" at end with appropriate whitespace
          // This handles: {; -> {, {\n; -> {\n, {;\n -> {\n
          let result = match;
          // First handle semicolon followed by newline
          result = result.replace(/;\s*\n/g, '\n');
          // Then handle semicolon at end (with optional trailing whitespace)
          result = result.replace(/;\s*$/, '');
          // If result still contains semicolon, remove it directly (fallback)
          if (result.includes(';')) {
            result = result.replace(/;/, '');
          }
          return result;
        });
      });
      
      if (content !== beforeFix) {
        wasFixed = true;
        this.logger.info(`Fixed {; patterns in ${file.path}`);
      }
      
      // Fix return (; patterns
      const beforeReturnParen = content;
      content = content.replace(/return\s*\(\s*;/g, 'return (');
      content = content.replace(/return\s*\(\s*\n\s*;/g, 'return (');
      if (content !== beforeReturnParen) {
        wasFixed = true;
        this.logger.info(`Fixed return (; pattern in ${file.path}`);
      }
      
      // Fix return {; patterns
      const beforeReturnBrace = content;
      content = content.replace(/return\s*\{\s*;/g, 'return {');
      content = content.replace(/return\s*\{\s*\n\s*;/g, 'return {');
      if (content !== beforeReturnBrace) {
        wasFixed = true;
        this.logger.info(`Fixed return {; pattern in ${file.path}`);
      }
      
      // Fix return [; patterns
      const beforeReturnBracket = content;
      content = content.replace(/return\s*\[\s*;/g, 'return [');
      content = content.replace(/return\s*\[\s*\n\s*;/g, 'return [');
      if (content !== beforeReturnBracket) {
        wasFixed = true;
        this.logger.info(`Fixed return [; pattern in ${file.path}`);
      }
      
      // Fix arrow function {; patterns: () => {;
      const beforeArrow = content;
      content = content.replace(/\)\s*=>\s*\{\s*;/g, ') => {');
      content = content.replace(/\)\s*=>\s*\{\s*\n\s*;/g, ') => {');
      if (content !== beforeArrow) {
        wasFixed = true;
        this.logger.info(`Fixed arrow function {; pattern in ${file.path}`);
      }

      // Fix arrow function callback patterns: (_, index) => (;
      const beforeArrowParen = content;
      content = content.replace(/=>\s*\(\s*;/g, '=> (');
      if (content !== beforeArrowParen) {
        wasFixed = true;
        this.logger.info(`Fixed arrow function => (; pattern in ${file.path}`);
      }

      // Fix semicolons before closing parentheses in function calls
      // This catches patterns like: .map((item) => { ... }; ) -> .map((item) => { ... })
      const beforeParenSemicolon = content;
      content = content.replace(/\}\s*;\s*\)/g, '})');
      if (content !== beforeParenSemicolon) {
        wasFixed = true;
        this.logger.info(`Fixed semicolon before closing parenthesis in ${file.path}`);
      }
      
      // Fix semicolons in object literals: { key: value; } -> { key: value, }
      // This catches patterns like: export const tapScale = { scale: 0.95; };
      const beforeObjectLiteral = content;
      const objectLiteralSemicolonPattern = /([a-zA-Z_$][a-zA-Z0-9_$]*\s*:\s*[^;]+);(\s*[},])/g;
      const objectLiteralMatches = content.match(objectLiteralSemicolonPattern);
      if (objectLiteralMatches && objectLiteralMatches.length > 0) {
        this.logger.info(`Found ${objectLiteralMatches.length} object literal semicolon errors in ${file.path}`);
        content = content.replace(objectLiteralSemicolonPattern, (match, keyValue, after) => {
          // Replace semicolon with comma if followed by } or another key
          if (after.trim().startsWith('}')) {
            // Last property, remove semicolon (no comma needed before closing brace)
            return keyValue + after;
          } else {
            // Not last property, replace semicolon with comma
            return keyValue + ',' + after;
          }
        });
        if (content !== beforeObjectLiteral) {
          wasFixed = true;
          this.logger.info(`Fixed object literal semicolons in ${file.path}`);
        }
      }

      // Fix ternary operator semicolons: condition ? value; : value -> condition ? value : value
      // This catches patterns like: 
      //   - selectedCategory ? features.filter(...); : features
      //   - condition ? (nested ? 'a' : 'b'); : 'c'  (multiline with semicolon before colon)
      const beforeTernary = content;
      const ternarySemicolonPatterns = [
        // Pattern 1: ); followed by whitespace/newline and : (most common - closing paren before semicolon)
        /(\?\s*[^?]*?\));(\s*\n\s*:|\s+:)/g,
        // Pattern 2: ]; followed by whitespace/newline and : (closing bracket)
        /(\?\s*[^?]*?\]);(\s*\n\s*:|\s+:)/g,
        // Pattern 3: "; or '; followed by whitespace/newline and : (string literals)
        /(\?\s*[^?]*?['"]);(\s*\n\s*:|\s+:)/g,
        // Pattern 4: Any expression ending with ; followed by whitespace/newline and : (fallback)
        /(\?\s*[^:]+?);(\s*\n\s*:|\s+:)/g,
      ];
      
      ternarySemicolonPatterns.forEach((pattern, idx) => {
        pattern.lastIndex = 0;
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
          this.logger.info(`Found ${matches.length} ternary operator semicolon errors in ${file.path} (pattern ${idx + 1})`);
          content = content.replace(pattern, (match, expression, colonPart) => {
            // Remove semicolon from the expression part
            const fixedExpression = expression.replace(/;\s*$/, '').trim();
            return `${fixedExpression}${colonPart}`;
          });
        }
      });
      
      if (content !== beforeTernary) {
        wasFixed = true;
        this.logger.info(`Fixed ternary operator semicolons in ${file.path}`);
      }

      // Fix logical errors: comparisons that are always true/false
      const beforeLogicalFix = content;
      
      // Fix: x !== (() => null) -> x !== null && x !== undefined
      // This pattern is always true because we're comparing to a new function
      content = content.replace(/(\w+(?:\.\w+)*)\s*!==\s*\(\(\)\s*=>\s*null\)/g, (match, varName) => {
        this.logger.info(`Fixed logical error: ${varName} !== (() => null) in ${file.path}`);
        return `${varName} !== null && ${varName} !== undefined`;
      });
      
      // Fix: x !== (() => {}) -> typeof x === 'function' (if checking for function)
      // Or: x !== (() => {}) -> x !== null && x !== undefined (if checking for existence)
      // We'll use the existence check as it's safer
      content = content.replace(/(\w+(?:\.\w+)*)\s*!==\s*\(\(\)\s*=>\s*\{\s*\}\)/g, (match, varName) => {
        this.logger.info(`Fixed logical error: ${varName} !== (() => {}) in ${file.path}`);
        return `${varName} !== null && ${varName} !== undefined`;
      });
      
      // Fix: x !== null && x !== (() => null) -> x !== null && x !== undefined
      // Remove redundant function comparison
      content = content.replace(/(\w+(?:\.\w+)*)\s*!==\s*null\s*&&\s*\1\s*!==\s*\(\(\)\s*=>\s*null\)/g, (match, varName) => {
        this.logger.info(`Fixed redundant logical check for ${varName} in ${file.path}`);
        return `${varName} !== null && ${varName} !== undefined`;
      });
      
      // Fix: app.component !== (() => null) -> app.component !== null && app.component !== undefined
      content = content.replace(/(\w+(?:\.\w+)*)\s*!==\s*\(\(\)\s*=>\s*null\)/g, (match, varName) => {
        this.logger.info(`Fixed logical error: ${varName} !== (() => null) in ${file.path}`);
        return `${varName} !== null && ${varName} !== undefined`;
      });
      
      if (content !== beforeLogicalFix) {
        wasFixed = true;
        this.logger.info(`Fixed logical errors in ${file.path}`);
      }

      // Fix semicolons before closing braces - ULTRA-AGGRESSIVE literal replacements
      // This catches patterns like: className="...";} or const obj = { key: value; }
      const beforeSemicolonBrace = content;
      const semicolonBracePatterns = [
        { from: ';\n}', to: '\n}' },
        { from: ';\n  }', to: '\n  }' },
        { from: ';\n    }', to: '\n    }' },
        { from: ';\n      }', to: '\n      }' },
        { from: ';\n        }', to: '\n        }' },
        { from: '; }', to: ' }' },
        { from: ';}', to: '}' },
        { from: '";}', to: '"}' },
        { from: '\';}', to: '\'}' },
        { from: '`;}', to: '`}' },
      ];
      
      semicolonBracePatterns.forEach(({ from, to }) => {
        if (content.includes(from)) {
          const beforeCount = content.split(from).length - 1;
          content = content.split(from).join(to);
          const afterCount = content.split(from).length - 1;
          if (beforeCount > afterCount) {
            wasFixed = true;
          }
        }
      });
      
      if (content !== beforeSemicolonBrace) {
        this.logger.info(`Fixed semicolons before closing braces in ${file.path}`);
      }

      // Fix JSON trailing commas (for JSON files)
      if (file.path.endsWith('.json')) {
        const beforeJSON = content;
        content = content.replace(/,(\s*[}\]])/g, '$1');
        if (content !== beforeJSON) {
          wasFixed = true;
          this.logger.info(`Fixed JSON trailing commas in ${file.path}`);
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
   * Get relevant files for a phase (token optimization)
   * Only includes files that are actually needed for this phase
   */
  private getRelevantFilesForPhase(
    allFiles: { path: string; content: string }[],
    phase: GenerationPhase,
    plan: GenerationPlan
  ): { path: string; content: string }[] {
    // Always include files from dependencies
    const dependencyFiles = new Set<string>();
    phase.dependencies.forEach(depPhaseName => {
      const depPhase = plan.phases.find(p => p.phase === depPhaseName);
      if (depPhase) {
        depPhase.files.forEach(file => dependencyFiles.add(file));
      }
    });

    // Include files that this phase will generate/modify
    phase.files.forEach(file => dependencyFiles.add(file));

    // Filter to only relevant files
    const relevantFiles = allFiles.filter(file => {
      // Always include dependency files
      if (dependencyFiles.has(file.path)) {
        return true;
      }

      // Include config files based on project type
      // Python: requirements.txt, .env
      // React: package.json, tsconfig.json, vite.config
      const isPythonFile = file.path.endsWith('.py') || file.path === 'requirements.txt';
      const isReactConfig = file.path.includes('package.json') || 
          file.path.includes('tsconfig.json') || 
          file.path.includes('vite.config');
      const isEnvFile = file.path.includes('.env');
      
      if (isPythonFile || isReactConfig || isEnvFile) {
        return true;
      }

      // Include files in same directory as phase files
      const phaseDirs = phase.files.map(f => {
        const parts = f.split('/');
        return parts.slice(0, -1).join('/');
      });
      const fileDir = file.path.split('/').slice(0, -1).join('/');
      if (phaseDirs.some(dir => fileDir.startsWith(dir) || dir.startsWith(fileDir))) {
        return true;
      }

      return false;
    });

    // Summarize large files to save tokens
    return relevantFiles.map(file => {
      // If file is large (>5000 chars) and not directly needed, summarize it
      if (file.content.length > 5000 && !phase.files.includes(file.path) && !dependencyFiles.has(file.path)) {
        return {
          path: file.path,
          content: this.summarizeFileContent(file.content, file.path)
        };
      }
      return file;
    });
  }

  /**
   * Summarize file content to reduce token usage
   */
  private summarizeFileContent(content: string, _path: string): string {
    const lines = content.split('\n');
    const maxLines = 100; // Keep first 100 lines for context
    
    if (lines.length <= maxLines) {
      return content;
    }

    // Keep first part, add summary
    const keptLines = lines.slice(0, maxLines);
    const totalLines = lines.length;
    const removedLines = totalLines - maxLines;
    
    return keptLines.join('\n') + 
      `\n\n// ... (${removedLines} more lines) ...\n` +
      `// File summary: ${totalLines} total lines, showing first ${maxLines} lines for context\n` +
      `// Full file available in previous phases if needed\n`;
  }

  /**
   * Get agent configuration from database (with caching)
   */
  private async getAgentConfig(agentId: string): Promise<{
    systemPrompt: string;
    model: string;
    temperature: number;
  }> {
    // Check cache first
    if (this.agentConfigCache.has(agentId)) {
      const cached = this.agentConfigCache.get(agentId)!;
      this.logger.info(`Using cached agent config for ${agentId}`);
      return cached;
    }

    try {
      const agentResults = await db
        .select()
        .from(agents)
        .where(eq(agents.id, agentId));

      if (agentResults.length > 0) {
        const agent = agentResults[0];
        this.logger.info(`Loaded agent ${agentId} from database. Model: ${agent.model}, Has system prompt: ${!!agent.systemPrompt}`);
        
        const config = {
          systemPrompt: agent.systemPrompt || this.getDefaultPrompt(agentId),
          model: agent.model || 'claude-sonnet-4-5-20250929',
          temperature: agent.temperature || 0.3
        };

        // Cache the config
        this.agentConfigCache.set(agentId, config);
        return config;
      }

      // Fallback to default
      this.logger.warn(`Agent ${agentId} not found in database, using defaults`);
      const defaultConfig = {
        systemPrompt: this.getDefaultPrompt(agentId),
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0.3
      };
      this.agentConfigCache.set(agentId, defaultConfig);
      return defaultConfig;
    } catch (error) {
      this.logger.error(`Failed to load agent ${agentId} from database`, error as Error);
      const fallbackConfig = {
        systemPrompt: this.getDefaultPrompt(agentId),
        model: 'claude-sonnet-4-5-20250929',
        temperature: 0.3
      };
      this.agentConfigCache.set(agentId, fallbackConfig);
      return fallbackConfig;
    }
  }

  /**
   * Get default prompt for an agent (MINIMAL fallback only)
   * 
   * NOTE: This is an emergency fallback. The actual coding rules, syntax
   * requirements, and patterns should be in the agent's systemPrompt in the database.
   * 
   * If this fallback is being used frequently, it indicates the agent
   * database records need to be updated with proper prompts.
   */
  private getDefaultPrompt(agentId: string): string {
    this.logger.warn(`Using FALLBACK prompt for agent ${agentId} - update database with proper systemPrompt`);
    
    // Minimal fallback - just enough to work, all real logic should be in DB
    return `You are a senior developer. Generate production-ready code.

CRITICAL RULES:
1. Respond with JSON array ONLY: [{"path": "...", "content": "..."}]
2. No markdown code blocks around the JSON
3. Components in src/components/ use NAMED exports: export function Name() {}
4. App.tsx uses DEFAULT export: export default function App() {}
5. Match export type to import type (named import = named export)
6. No syntax errors - especially no semicolons after { or before : in ternaries

Start your response with [`;
  }
}
