/**
 * Context Research Service
 * Ensures agents have optimal context before starting work
 */

import { SimpleLogger } from '../utils/SimpleLogger';
import { GenerationPhase, GenerationPlan } from './IncrementalOrchestrator';
import { KnowledgeService } from './KnowledgeService';

const logger = new SimpleLogger('ContextResearchService');

export interface EnhancedContext {
  knowledge: string;
  patterns: CodePattern[];
  dependencies: string[];
  existingFiles: { path: string; content: string }[];
  isComplete: boolean;
  missingInfo?: string[];
}

export interface CodePattern {
  type: 'import' | 'export' | 'component' | 'hook' | 'utility' | 'config';
  pattern: string;
  frequency: number;
  files: string[];
}

export class ContextResearchService {
  private knowledgeService: KnowledgeService;

  constructor() {
    this.knowledgeService = new KnowledgeService();
  }

  /**
   * Prepare optimal context for an agent before it starts working
   */
  async prepareContextForAgent(
    agentId: string,
    userPrompt: string,
    phase: GenerationPhase,
    existingFiles: { path: string; content: string }[],
    plan: GenerationPlan,
    userId?: string
  ): Promise<EnhancedContext> {
    logger.info(`Preparing context for agent ${agentId} in phase ${phase.phase}`);

    // 1. Load relevant knowledge
    const knowledge = await this.loadRelevantKnowledge(agentId, phase, userPrompt, userId);

    // 2. Analyze existing files for patterns
    const patterns = await this.analyzeCodePatterns(existingFiles, phase);

    // 3. Check for missing dependencies
    const dependencies = await this.checkDependencies(phase, existingFiles, plan);

    // 4. Filter and summarize files for this phase
    const relevantFiles = this.filterRelevantFiles(existingFiles, phase, plan);

    // 5. Validate context completeness
    const validation = await this.validateContextCompleteness(
      knowledge,
      patterns,
      dependencies,
      relevantFiles,
      phase
    );

    // 6. Enrich context if needed
    if (!validation.isComplete && validation.missingInfo && validation.missingInfo.length > 0) {
      logger.info(`Context incomplete for phase ${phase.phase}, enriching...`);
      const enrichedKnowledge = await this.enrichContext(
        knowledge,
        validation.missingInfo,
        userPrompt,
        agentId
      );
      return {
        knowledge: enrichedKnowledge,
        patterns,
        dependencies,
        existingFiles: relevantFiles,
        isComplete: true
      };
    }

    return {
      knowledge,
      patterns,
      dependencies,
      existingFiles: relevantFiles,
      isComplete: validation.isComplete,
      missingInfo: validation.missingInfo
    };
  }

  /**
   * Load relevant knowledge for the agent and phase
   */
  private async loadRelevantKnowledge(
    agentId: string,
    phase: GenerationPhase,
    userPrompt: string,
    userId?: string
  ): Promise<string> {
    try {
      // Build search query based on phase and agent
      const searchQuery = `${userPrompt} ${phase.description} ${phase.files.join(' ')}`;
      const knowledge = await this.knowledgeService.getRelevantKnowledge(searchQuery, userId || 'anonymous');
      
      // Build context string from knowledge items
      const contextParts: string[] = [];
      if (knowledge.companies.length > 0) {
        contextParts.push(`Companies: ${knowledge.companies.map(c => c.name).join(', ')}`);
      }
      if (knowledge.frameworks.length > 0) {
        contextParts.push(`Frameworks: ${knowledge.frameworks.map(f => f.name).join(', ')}`);
      }
      if (knowledge.workspaces.length > 0) {
        contextParts.push(`Workspaces: ${knowledge.workspaces.map(w => w.name).join(', ')}`);
      }
      
      return contextParts.join('\n') || '';
    } catch (error) {
      logger.warn('Failed to load knowledge context', error as Error);
      return '';
    }
  }

  /**
   * Analyze code patterns in existing files
   */
  private async analyzeCodePatterns(
    files: { path: string; content: string }[],
    phase: GenerationPhase
  ): Promise<CodePattern[]> {
    const patterns: Map<string, CodePattern> = new Map();

    // Analyze relevant files for this phase
    const relevantFiles = files.filter(file => 
      phase.files.some(phaseFile => file.path.includes(phaseFile)) ||
      phase.dependencies.some(dep => file.path.includes(dep))
    );

    for (const file of relevantFiles) {
      const content = file.content;

      // Detect import patterns
      const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"](.+?)['"]/g);
      for (const match of importMatches) {
        const pattern = `import from ${match[1]}`;
        const existing = patterns.get(pattern) || {
          type: 'import' as const,
          pattern,
          frequency: 0,
          files: []
        };
        existing.frequency++;
        if (!existing.files.includes(file.path)) {
          existing.files.push(file.path);
        }
        patterns.set(pattern, existing);
      }

      // Detect export patterns
      const exportMatches = content.matchAll(/export\s+(default\s+)?(function|const|class)\s+(\w+)/g);
      for (const match of exportMatches) {
        const pattern = `export ${match[1] ? 'default ' : ''}${match[2]} ${match[3]}`;
        const existing = patterns.get(pattern) || {
          type: 'export' as const,
          pattern,
          frequency: 0,
          files: []
        };
        existing.frequency++;
        if (!existing.files.includes(file.path)) {
          existing.files.push(file.path);
        }
        patterns.set(pattern, existing);
      }

      // Detect component patterns
      if (file.path.includes('components') || file.path.endsWith('.tsx') || file.path.endsWith('.jsx')) {
        const componentMatches = content.matchAll(/(?:function|const)\s+(\w+)\s*[=:]\s*(?:\(|\(.*?\)\s*=>)/g);
        for (const match of componentMatches) {
          const pattern = `component ${match[1]}`;
          const existing = patterns.get(pattern) || {
            type: 'component' as const,
            pattern,
            frequency: 0,
            files: []
          };
          existing.frequency++;
          if (!existing.files.includes(file.path)) {
            existing.files.push(file.path);
          }
          patterns.set(pattern, existing);
        }
      }
    }

    return Array.from(patterns.values()).sort((a, b) => b.frequency - a.frequency);
  }

  /**
   * Check for missing dependencies
   */
  private async checkDependencies(
    phase: GenerationPhase,
    existingFiles: { path: string; content: string }[],
    plan: GenerationPlan
  ): Promise<string[]> {
    const missing: string[] = [];

    // Check if dependency phase files exist
    for (const depPhaseName of phase.dependencies) {
      const depPhase = plan.phases.find(p => p.phase === depPhaseName);
      if (depPhase) {
        for (const requiredFile of depPhase.files) {
          const exists = existingFiles.some(f => 
            f.path === requiredFile || f.path.includes(requiredFile)
          );
          if (!exists) {
            missing.push(`Missing dependency file: ${requiredFile} from phase ${depPhaseName}`);
          }
        }
      }
    }

    // Check for common dependencies (package.json, config files)
    const hasPackageJson = existingFiles.some(f => f.path.includes('package.json'));
    if (!hasPackageJson && phase.files.some(f => f.includes('package.json'))) {
      // This is expected for first phase
    }

    return missing;
  }

  /**
   * Filter files to only those relevant for this phase
   */
  private filterRelevantFiles(
    allFiles: { path: string; content: string }[],
    phase: GenerationPhase,
    plan: GenerationPlan
  ): { path: string; content: string }[] {
    const relevantPaths = new Set<string>();

    // Add dependency files
    phase.dependencies.forEach(depPhaseName => {
      const depPhase = plan.phases.find(p => p.phase === depPhaseName);
      if (depPhase) {
        depPhase.files.forEach(file => relevantPaths.add(file));
      }
    });

    // Add phase files
    phase.files.forEach(file => relevantPaths.add(file));

    // Filter and summarize
    return allFiles
      .filter(file => {
        // Include if path matches any relevant path
        return Array.from(relevantPaths).some(relevantPath => 
          file.path === relevantPath || 
          file.path.includes(relevantPath) || 
          relevantPath.includes(file.path)
        ) || 
        // Include config files
        file.path.includes('package.json') ||
        file.path.includes('tsconfig.json') ||
        file.path.includes('vite.config');
      })
      .map(file => {
        // Summarize large files (>5000 chars) that aren't directly needed
        if (file.content.length > 5000 && !phase.files.includes(file.path)) {
          const lines = file.content.split('\n');
          if (lines.length > 100) {
            return {
              path: file.path,
              content: lines.slice(0, 100).join('\n') + 
                `\n\n// ... (${lines.length - 100} more lines) ...\n` +
                `// Summary: ${lines.length} total lines, showing first 100 for context\n`
            };
          }
        }
        return file;
      });
  }

  /**
   * Validate that context is complete
   */
  private async validateContextCompleteness(
    knowledge: string,
    patterns: CodePattern[],
    dependencies: string[],
    files: { path: string; content: string }[],
    phase: GenerationPhase
  ): Promise<{ isComplete: boolean; missingInfo?: string[] }> {
    const missing: string[] = [];

    // Check if we have knowledge context
    if (!knowledge || knowledge.length < 50) {
      missing.push('Insufficient knowledge context');
    }

    // Check if we have patterns for similar code
    if (patterns.length === 0 && files.length > 0) {
      missing.push('No code patterns detected');
    }

    // Check for missing dependencies
    if (dependencies.length > 0) {
      missing.push(...dependencies);
    }

    // Check if we have relevant files
    if (files.length === 0 && phase.dependencies.length > 0) {
      missing.push('No relevant files from dependencies');
    }

    return {
      isComplete: missing.length === 0,
      missingInfo: missing.length > 0 ? missing : undefined
    };
  }

  /**
   * Enrich context with additional information
   */
  private async enrichContext(
    currentKnowledge: string,
    missingInfo: string[],
    userPrompt: string,
    agentId: string
  ): Promise<string> {
    // For now, return enhanced knowledge with missing info noted
    // In future, could make additional AI calls to fetch missing context
    return currentKnowledge + 
      `\n\nAdditional Context Needed:\n${missingInfo.map(info => `- ${info}`).join('\n')}\n` +
      `\nUser Request: ${userPrompt}\n` +
      `Agent: ${agentId}\n`;
  }
}

