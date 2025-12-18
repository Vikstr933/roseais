/**
 * AI-Based Syntax Fixer Service
 * 
 * Uses Claude Opus 4.5 to intelligently fix syntax errors detected by esbuild.
 * This replaces hardcoded regex patterns with AI-powered understanding.
 */

import { SimpleLogger } from '../utils/SimpleLogger';
import { multiModelAI, AIRequest } from './MultiModelAIService';
import * as esbuild from 'esbuild';

const logger = new SimpleLogger('AISyntaxFixer');

export interface CompilationError {
  file: string;
  line: number;
  column: number;
  message: string;
  code?: string;
}

export interface FixResult {
  success: boolean;
  fixedFiles: { path: string; content: string }[];
  remainingErrors: CompilationError[];
  fixAttempts: number;
}

export class AISyntaxFixer {
  private maxFixAttempts = 3;

  /**
   * Validate files with esbuild and fix errors using AI
   * This runs BEFORE files are saved, so users never see broken code
   */
  async validateAndFix(
    files: { path: string; content: string }[]
  ): Promise<FixResult> {
    logger.info(`Validating ${files.length} files with esbuild...`);

    // Step 1: Validate with esbuild to catch real compilation errors
    const errors = await this.validateWithEsbuild(files);

    if (errors.length === 0) {
      logger.info('All files validated successfully - no fixes needed');
      return {
        success: true,
        fixedFiles: files,
        remainingErrors: [],
        fixAttempts: 0
      };
    }

    logger.warn(`Found ${errors.length} compilation errors, attempting AI fixes...`);

    // Step 2: Fix errors using AI (Opus 4.5 for best quality)
    let fixedFiles = [...files];
    let remainingErrors = errors;
    let attempts = 0;

    while (remainingErrors.length > 0 && attempts < this.maxFixAttempts) {
      attempts++;
      logger.info(`Fix attempt ${attempts}/${this.maxFixAttempts}...`);

      const fixResult = await this.fixWithAI(fixedFiles, remainingErrors);
      fixedFiles = fixResult.fixedFiles;

      // Re-validate to check if fixes worked
      const newErrors = await this.validateWithEsbuild(fixedFiles);
      
      if (newErrors.length === 0) {
        logger.info(`✅ All errors fixed after ${attempts} attempt(s)`);
        return {
          success: true,
          fixedFiles,
          remainingErrors: [],
          fixAttempts: attempts
        };
      }

      // Check if we made progress (fewer errors)
      if (newErrors.length >= remainingErrors.length) {
        logger.warn(`No progress made (${remainingErrors.length} -> ${newErrors.length} errors), stopping`);
        break;
      }

      remainingErrors = newErrors;
      logger.info(`Progress: ${errors.length} -> ${remainingErrors.length} errors remaining`);
    }

    if (remainingErrors.length > 0) {
      logger.error(`Failed to fix ${remainingErrors.length} errors after ${attempts} attempts`);
    }

    return {
      success: remainingErrors.length === 0,
      fixedFiles,
      remainingErrors,
      fixAttempts: attempts
    };
  }

  /**
   * Validate files using esbuild to catch real compilation errors
   */
  private async validateWithEsbuild(
    files: { path: string; content: string }[]
  ): Promise<CompilationError[]> {
    const errors: CompilationError[] = [];

    for (const file of files) {
      // Only validate TypeScript/JavaScript files
      if (!file.path.match(/\.(tsx?|jsx?)$/)) {
        continue;
      }

      try {
        await esbuild.transform(file.content, {
          loader: file.path.endsWith('.tsx') ? 'tsx' : file.path.endsWith('.ts') ? 'ts' : 'jsx',
          format: 'esm',
          target: 'es2020',
          jsx: 'automatic',
        });
      } catch (transformError: any) {
        if (transformError.errors && Array.isArray(transformError.errors)) {
          transformError.errors.forEach((err: any) => {
            const line = err.location?.line || 0;
            const column = err.location?.column || 0;
            const message = err.text || err.message || 'Unknown error';

            // Skip CSS import errors (handled by Vite)
            if (!message.includes('CSS') && !message.includes('Cannot find module')) {
              errors.push({
                file: file.path,
                line,
                column,
                message,
                code: this.getErrorContext(file.content, line, column)
              });
            }
          });
        }
      }
    }

    return errors;
  }

  /**
   * Get code context around an error for AI analysis
   */
  private getErrorContext(content: string, errorLine: number, errorColumn: number): string {
    const lines = content.split('\n');
    const startLine = Math.max(0, errorLine - 3);
    const endLine = Math.min(lines.length - 1, errorLine + 2);
    
    const contextLines = lines.slice(startLine, endLine + 1);
    const lineNumbers = Array.from({ length: contextLines.length }, (_, i) => startLine + i + 1);
    
    return contextLines
      .map((line, idx) => {
        const lineNum = lineNumbers[idx];
        const marker = lineNum === errorLine ? '>>>' : '   ';
        return `${marker} ${lineNum.toString().padStart(3, ' ')} | ${line}`;
      })
      .join('\n');
  }

  /**
   * Fix errors using Claude Opus 4.5
   * This is intelligent and understands context, unlike regex patterns
   */
  private async fixWithAI(
    files: { path: string; content: string }[],
    errors: CompilationError[]
  ): Promise<{ fixedFiles: { path: string; content: string }[] }> {
    // Group errors by file
    const errorsByFile = new Map<string, CompilationError[]>();
    errors.forEach(error => {
      if (!errorsByFile.has(error.file)) {
        errorsByFile.set(error.file, []);
      }
      errorsByFile.get(error.file)!.push(error);
    });

    const fixedFiles = [...files];

    // Fix each file with errors
    for (const [filePath, fileErrors] of errorsByFile.entries()) {
      const file = fixedFiles.find(f => f.path === filePath);
      if (!file) continue;

      logger.info(`Fixing ${fileErrors.length} error(s) in ${filePath} using AI...`);

      try {
        const fixedContent = await this.fixFileWithAI(file, fileErrors);
        const fileIndex = fixedFiles.findIndex(f => f.path === filePath);
        fixedFiles[fileIndex] = {
          path: filePath,
          content: fixedContent
        };
        logger.info(`✅ AI fixed ${filePath}`);
      } catch (error) {
        logger.error(`Failed to fix ${filePath} with AI:`, error instanceof Error ? error : new Error(String(error)));
        // Keep original file if AI fix fails
      }
    }

    return { fixedFiles };
  }

  /**
   * Fix a single file using AI
   */
  private async fixFileWithAI(
    file: { path: string; content: string },
    errors: CompilationError[]
  ): Promise<string> {
    const errorDetails = errors.map(err => {
      return `Line ${err.line}:${err.column} - ${err.message}\n${err.code || ''}`;
    }).join('\n\n');

    const systemPrompt = `You are an expert TypeScript/React code fixer. Your task is to fix compilation errors in the provided code.

CRITICAL RULES:
1. Fix ONLY the errors specified - do not change working code
2. Preserve all existing functionality
3. Maintain code style and formatting
4. Fix syntax errors precisely (e.g., remove semicolons before colons in ternary operators)
5. Ensure the code compiles without errors

Return ONLY the fixed code - no explanations, no markdown, just the corrected source code.`;

    const userPrompt = `Fix the following compilation errors in this ${file.path} file:

ERRORS TO FIX:
${errorDetails}

CURRENT CODE:
\`\`\`typescript
${file.content}
\`\`\`

Return the COMPLETE fixed code that compiles without errors. Do not include markdown code blocks - just return the raw TypeScript/React code.`;

    const aiRequest: AIRequest = {
      prompt: userPrompt,
      systemPrompt,
      maxTokens: 16000, // Large enough for full file fixes
      temperature: 0.1, // Low temperature for precise fixes
      useCase: 'code_generation', // Using code_generation for syntax fixes
      priority: 'quality',
      // Use Sonnet 4.5 for syntax fixes (cost-effective, excellent quality)
      // Opus should only be used for critical/complex reasoning tasks
      // No preferredModel - let MultiModelAIService select best model (will use Sonnet for quality priority)
    };

    const response = await multiModelAI.generate(aiRequest);

    if (!response.content) {
      throw new Error('AI did not return fixed code');
    }

    // Extract code from response (handle markdown code blocks if present)
    let fixedCode = response.content.trim();
    
    // Remove markdown code blocks if present
    if (fixedCode.startsWith('```')) {
      const codeBlockMatch = fixedCode.match(/```(?:typescript|tsx|ts|javascript|jsx|js)?\s*\n?([\s\S]*?)\n?```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        fixedCode = codeBlockMatch[1].trim();
      } else {
        // Fallback: remove first and last lines if they're ```
        const lines = fixedCode.split('\n');
        if (lines[0].trim().startsWith('```')) {
          lines.shift();
        }
        if (lines[lines.length - 1].trim() === '```') {
          lines.pop();
        }
        fixedCode = lines.join('\n');
      }
    }

    return fixedCode;
  }
}

export const aiSyntaxFixer = new AISyntaxFixer();

