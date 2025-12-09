import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { projectFiles } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';
import * as path from 'path';

const logger = new SimpleLogger('MultiLanguageService');

export interface LanguageInfo {
  primary: string;
  frameworks: string[];
  libraries: string[];
  buildTool?: string;
  packageManager?: string;
  confidence: number;
}

export class MultiLanguageService {
  /**
   * Detect programming language and framework of a project
   */
  async detectLanguage(projectId: number): Promise<LanguageInfo> {
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

      if (files.length === 0) {
        return {
          primary: 'unknown',
          frameworks: [],
          libraries: [],
          confidence: 0
        };
      }

      // Analyze file extensions and content
      const extensions = new Map<string, number>();
      const frameworks: Set<string> = new Set();
      const libraries: Set<string> = new Set();
      let buildTool: string | undefined;
      let packageManager: string | undefined;

      for (const file of files) {
        const ext = path.extname(file.filePath).toLowerCase();
        extensions.set(ext, (extensions.get(ext) || 0) + 1);

        // Check for framework indicators
        if (file.filePath.includes('package.json') && file.fileContent) {
          try {
            const packageJson = JSON.parse(file.fileContent);
            if (packageJson.dependencies) {
              Object.keys(packageJson.dependencies).forEach(dep => {
                if (dep.includes('react')) frameworks.add('React');
                if (dep.includes('vue')) frameworks.add('Vue');
                if (dep.includes('angular')) frameworks.add('Angular');
                if (dep.includes('svelte')) frameworks.add('Svelte');
                if (dep.includes('next')) frameworks.add('Next.js');
                if (dep.includes('nuxt')) frameworks.add('Nuxt');
                if (dep.includes('express')) frameworks.add('Express');
                if (dep.includes('fastapi')) frameworks.add('FastAPI');
                if (dep.includes('flask')) frameworks.add('Flask');
                if (dep.includes('django')) frameworks.add('Django');
                libraries.add(dep);
              });
            }
            if (packageJson.devDependencies) {
              Object.keys(packageJson.devDependencies).forEach(dep => {
                if (dep.includes('vite')) buildTool = 'Vite';
                if (dep.includes('webpack')) buildTool = 'Webpack';
                if (dep.includes('rollup')) buildTool = 'Rollup';
              });
            }
            if (packageJson.scripts) {
              if (packageJson.scripts.build?.includes('vite')) buildTool = 'Vite';
              if (packageJson.scripts.build?.includes('webpack')) buildTool = 'Webpack';
            }
          } catch {
            // Invalid JSON
          }
        }

        // Check for Python indicators
        if (ext === '.py') {
          if (file.fileContent?.includes('from flask')) frameworks.add('Flask');
          if (file.fileContent?.includes('from fastapi')) frameworks.add('FastAPI');
          if (file.fileContent?.includes('from django')) frameworks.add('Django');
          if (file.filePath.includes('requirements.txt')) {
            packageManager = 'pip';
          }
        }

        // Check for requirements.txt or Pipfile
        if (file.filePath.includes('requirements.txt')) {
          packageManager = 'pip';
        }
        if (file.filePath.includes('Pipfile')) {
          packageManager = 'pipenv';
        }
        if (file.filePath.includes('poetry.lock')) {
          packageManager = 'poetry';
        }

        // Check for package managers
        if (file.filePath.includes('package-lock.json')) {
          packageManager = 'npm';
        }
        if (file.filePath.includes('yarn.lock')) {
          packageManager = 'yarn';
        }
        if (file.filePath.includes('pnpm-lock.yaml')) {
          packageManager = 'pnpm';
        }
      }

      // Determine primary language based on file extensions
      let primary = 'unknown';
      let maxCount = 0;

      const languageMap: Record<string, string> = {
        '.ts': 'TypeScript',
        '.tsx': 'TypeScript',
        '.js': 'JavaScript',
        '.jsx': 'JavaScript',
        '.py': 'Python',
        '.java': 'Java',
        '.cpp': 'C++',
        '.c': 'C',
        '.go': 'Go',
        '.rs': 'Rust',
        '.php': 'PHP',
        '.rb': 'Ruby',
        '.swift': 'Swift',
        '.kt': 'Kotlin',
        '.vue': 'Vue',
        '.svelte': 'Svelte'
      };

      for (const [ext, count] of extensions.entries()) {
        const lang = languageMap[ext];
        if (lang && count > maxCount) {
          primary = lang;
          maxCount = count;
        }
      }

      // Calculate confidence based on file count and indicators
      const totalFiles = files.length;
      const confidence = Math.min(100, Math.round((maxCount / totalFiles) * 100));

      return {
        primary,
        frameworks: Array.from(frameworks),
        libraries: Array.from(libraries).slice(0, 20), // Limit to top 20
        buildTool,
        packageManager,
        confidence
      };
    } catch (error) {
      logger.error('Error detecting language', error as Error);
      return {
        primary: 'unknown',
        frameworks: [],
        libraries: [],
        confidence: 0
      };
    }
  }
}

export const multiLanguageService = new MultiLanguageService();

