import { SimpleLogger } from '../utils/SimpleLogger';
import { execa } from 'execa';
import * as path from 'path';
import * as fs from 'fs/promises';
import { db } from '../../db';
import { projectFiles } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';
import Anthropic from '@anthropic-ai/sdk';

const logger = new SimpleLogger('TestService');

export interface TestResult {
  success: boolean;
  passed: number;
  failed: number;
  total: number;
  duration: number;
  errors: Array<{
    test: string;
    error: string;
    file?: string;
    line?: number;
  }>;
  coverage?: {
    statements: number;
    branches: number;
    functions: number;
    lines: number;
  };
}

export interface TestFile {
  path: string;
  content: string;
  type: 'unit' | 'integration' | 'e2e';
}

export class TestService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
  }

  /**
   * Generate tests for a project or specific file
   */
  async generateTests(
    projectId: number,
    filePath?: string,
    testType: 'unit' | 'integration' | 'e2e' = 'unit'
  ): Promise<TestFile[]> {
    try {
      // Get project files
      const conditions = [
        eq(projectFiles.projectId, projectId),
        eq(projectFiles.isActive, true)
      ];
      
      if (filePath) {
        conditions.push(eq(projectFiles.filePath, filePath));
      }
      
      const files = await db
        .select()
        .from(projectFiles)
        .where(and(...conditions));

      if (files.length === 0) {
        throw new Error('No files found to generate tests for');
      }

      // Get test-generator agent from database
      const { agents } = await import('../../db/schema-pg');
      const [testAgent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, 'test-generator'))
        .limit(1);

      if (!testAgent) {
        throw new Error('Test generator agent not found');
      }

      // Build prompt for test generation
      const codeContext = files.map(f => ({
        path: f.filePath,
        content: f.fileContent || ''
      }));

      const prompt = `Generate ${testType} tests for the following code files:

${codeContext.map(f => `## ${f.path}\n\`\`\`typescript\n${f.content}\n\`\`\``).join('\n\n')}

Requirements:
- Generate comprehensive ${testType} tests
- Use React Testing Library for React components
- Use Vitest as the test framework
- Test all critical functionality
- Include edge cases and error handling
- Ensure high code coverage
- Follow testing best practices

Return ONLY a JSON array with test files.`;

      // Call AI to generate tests
      const response = await this.anthropic.messages.create({
        model: testAgent.model || 'claude-sonnet-4-5-20250929',
        max_tokens: 8192,
        system: testAgent.systemPrompt || '',
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      // Parse response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from AI');
      }

      let testFiles: TestFile[] = [];
      
      // Try to parse JSON from response
      const text = content.text;
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[0]);
          testFiles = parsed.map((file: any) => ({
            path: file.path || file.filePath,
            content: file.content || file.fileContent,
            type: testType
          }));
        } catch (parseError) {
          logger.error('Failed to parse test files from AI response', parseError as Error);
          throw new Error('Failed to parse generated tests');
        }
      }

      return testFiles;
    } catch (error) {
      logger.error('Error generating tests', error as Error);
      throw error;
    }
  }

  /**
   * Run tests in a project
   */
  async runTests(
    projectId: number,
    testPath?: string
  ): Promise<TestResult> {
    try {
      // Create temp workspace
      const tempDir = path.join(process.cwd(), 'temp-tests', `project-${projectId}-${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Get project files
        const files = await db
          .select()
          .from(projectFiles)
          .where(
            and(
              eq(projectFiles.projectId, projectId),
              eq(projectFiles.isActive, true)
            )
          );

        // Write files to temp directory
        for (const file of files) {
          if (!file.fileContent) continue;
          const fullPath = path.join(tempDir, file.filePath);
          const dir = path.dirname(fullPath);
          await fs.mkdir(dir, { recursive: true });
          await fs.writeFile(fullPath, file.fileContent);
        }

        // Check if package.json exists and has test script
        const packageJsonPath = path.join(tempDir, 'package.json');
        let hasTestScript = false;
        
        try {
          const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
          const packageJson = JSON.parse(packageJsonContent);
          hasTestScript = packageJson.scripts && packageJson.scripts.test;
        } catch {
          // No package.json or invalid
        }

        if (!hasTestScript) {
          // Create basic vitest config
          await this.setupVitestConfig(tempDir);
        }

        // Run tests
        const testArgs = testPath ? [testPath] : [];
        const { stdout, stderr } = await execa('npm', ['test', ...testArgs], {
          cwd: tempDir,
          timeout: 60000 // 60 seconds timeout
        });

        // Parse test results (vitest output)
        const result = this.parseTestResults(stdout, stderr);

        return result;
      } finally {
        // Cleanup
        try {
          await fs.rm(tempDir, { recursive: true, force: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    } catch (error: any) {
      logger.error('Error running tests', error as Error);
      
      // If tests failed, try to parse error output
      if (error.stdout || error.stderr) {
        return this.parseTestResults(error.stdout || '', error.stderr || '');
      }

      return {
        success: false,
        passed: 0,
        failed: 0,
        total: 0,
        duration: 0,
        errors: [{
          test: 'Test execution',
          error: error.message || 'Unknown error'
        }]
      };
    }
  }

  /**
   * Get test coverage
   */
  async getTestCoverage(projectId: number): Promise<TestResult['coverage']> {
    try {
      const result = await this.runTests(projectId);
      return result.coverage;
    } catch (error) {
      logger.error('Error getting test coverage', error as Error);
      return undefined;
    }
  }

  /**
   * Setup Vitest configuration
   */
  private async setupVitestConfig(projectDir: string): Promise<void> {
    const vitestConfig = `import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
});
`;

    await fs.writeFile(
      path.join(projectDir, 'vitest.config.ts'),
      vitestConfig
    );

    // Update package.json
    const packageJsonPath = path.join(projectDir, 'package.json');
    try {
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      
      if (!packageJson.scripts) {
        packageJson.scripts = {};
      }
      
      packageJson.scripts.test = 'vitest run';
      packageJson.scripts['test:watch'] = 'vitest';
      packageJson.scripts['test:coverage'] = 'vitest run --coverage';

      await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, null, 2));
    } catch {
      // If package.json doesn't exist or is invalid, create a basic one
      const basicPackageJson = {
        name: 'project',
        version: '1.0.0',
        type: 'module',
        scripts: {
          test: 'vitest run',
          'test:watch': 'vitest',
          'test:coverage': 'vitest run --coverage'
        },
        devDependencies: {
          'vitest': '^1.6.0',
          '@vitejs/plugin-react': '^4.0.0',
          '@testing-library/react': '^14.0.0',
          '@testing-library/jest-dom': '^6.0.0',
          '@testing-library/user-event': '^14.0.0',
          'jsdom': '^23.0.0'
        }
      };
      
      await fs.writeFile(packageJsonPath, JSON.stringify(basicPackageJson, null, 2));
    }
  }

  /**
   * Parse test results from vitest output
   */
  private parseTestResults(stdout: string, stderr: string): TestResult {
    const errors: TestResult['errors'] = [];
    let passed = 0;
    let failed = 0;
    let total = 0;
    let duration = 0;
    let coverage: TestResult['coverage'] | undefined;

    // Parse test summary
    const passedMatch = stdout.match(/(\d+)\s+passed/);
    const failedMatch = stdout.match(/(\d+)\s+failed/);
    const totalMatch = stdout.match(/Test Files\s+(\d+)/);
    const durationMatch = stdout.match(/Duration\s+([\d.]+)\s*s/);

    if (passedMatch) passed = parseInt(passedMatch[1]);
    if (failedMatch) failed = parseInt(failedMatch[1]);
    if (totalMatch) total = parseInt(totalMatch[1]);
    if (durationMatch) duration = parseFloat(durationMatch[1]);

    // Parse errors
    const errorLines = stderr.split('\n').filter(line => 
      line.includes('FAIL') || line.includes('Error') || line.includes('AssertionError')
    );

    for (const line of errorLines) {
      const testMatch = line.match(/FAIL\s+(.+?)\s+/);
      if (testMatch) {
        errors.push({
          test: testMatch[1],
          error: line
        });
      }
    }

    // Parse coverage if available
    const coverageMatch = stdout.match(/Statements\s+:\s+([\d.]+)%/);
    if (coverageMatch) {
      coverage = {
        statements: parseFloat(coverageMatch[1]),
        branches: 0,
        functions: 0,
        lines: 0
      };

      const branchesMatch = stdout.match(/Branches\s+:\s+([\d.]+)%/);
      const functionsMatch = stdout.match(/Functions\s+:\s+([\d.]+)%/);
      const linesMatch = stdout.match(/Lines\s+:\s+([\d.]+)%/);

      if (branchesMatch) coverage.branches = parseFloat(branchesMatch[1]);
      if (functionsMatch) coverage.functions = parseFloat(functionsMatch[1]);
      if (linesMatch) coverage.lines = parseFloat(linesMatch[1]);
    }

    return {
      success: failed === 0,
      passed,
      failed,
      total: passed + failed,
      duration,
      errors,
      coverage
    };
  }
}

export const testService = new TestService();

