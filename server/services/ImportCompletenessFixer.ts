/**
 * Import Completeness Fixer
 *
 * Repairs generated projects that reference local modules the generator forgot
 * to create. This closes the gap where Vite would later fail with messages like
 * "Failed to resolve import './components/Testimonials'".
 */

import { SimpleLogger } from '../utils/SimpleLogger';
import { multiModelAI, AIRequest } from './MultiModelAIService';

const logger = new SimpleLogger('ImportCompletenessFixer');

export interface ImportCompletenessContext {
  userPrompt?: string;
  appName?: string;
  knowledgeContext?: string;
}

export interface MissingLocalImport {
  importerPath: string;
  importPath: string;
  targetPath: string;
  candidates: string[];
  line: number;
  rawStatement: string;
  requiredNamedExports: string[];
  requiredDefaultExport?: string;
  requiredNamespaceExport?: string;
  isSideEffectOnly: boolean;
}

export interface ImportRepairResult {
  fixedFiles: Array<{ path: string; content: string }>;
  generatedFiles: Array<{ path: string; content: string }>;
  remainingMissingImports: MissingLocalImport[];
  attempts: number;
}

interface LocalImportDeclaration {
  importPath: string;
  rawStatement: string;
  line: number;
  requiredNamedExports: string[];
  requiredDefaultExport?: string;
  requiredNamespaceExport?: string;
  isSideEffectOnly: boolean;
}

export class ImportCompletenessFixer {
  private maxRepairPasses = 2;

  async repairMissingImports(
    files: Array<{ path: string; content: string }>,
    context: ImportCompletenessContext = {},
    maxRepairPasses = this.maxRepairPasses
  ): Promise<ImportRepairResult> {
    let fixedFiles = this.normalizeFiles(files);
    const generatedFiles: Array<{ path: string; content: string }> = [];
    let attempts = 0;

    for (let pass = 1; pass <= maxRepairPasses; pass++) {
      const missingImports = this.dedupeMissingImports(this.findMissingLocalImports(fixedFiles));

      if (missingImports.length === 0) {
        return {
          fixedFiles,
          generatedFiles,
          remainingMissingImports: [],
          attempts
        };
      }

      attempts = pass;
      logger.warn(`Repair pass ${pass}: generating ${missingImports.length} missing local module(s)`);

      for (const missingImport of missingImports.slice(0, 12)) {
        if (fixedFiles.some(file => file.path === missingImport.targetPath)) {
          continue;
        }

        const generatedFile = await this.generateMissingFile(missingImport, fixedFiles, context);
        fixedFiles = this.upsertFile(fixedFiles, generatedFile);
        generatedFiles.push(generatedFile);
        logger.info(`Generated missing local module: ${generatedFile.path}`);
      }
    }

    return {
      fixedFiles,
      generatedFiles,
      remainingMissingImports: this.dedupeMissingImports(this.findMissingLocalImports(fixedFiles)),
      attempts
    };
  }

  findMissingLocalImports(files: Array<{ path: string; content: string }>): MissingLocalImport[] {
    const normalizedFiles = this.normalizeFiles(files);
    const filePaths = new Set(normalizedFiles.map(file => file.path));
    const missingImports: MissingLocalImport[] = [];

    for (const file of normalizedFiles) {
      if (!this.isCodeFile(file.path)) {
        continue;
      }

      const declarations = this.extractLocalImportDeclarations(file.content);

      for (const declaration of declarations) {
        const candidates = this.resolveRelativeImport(file.path, declaration.importPath);
        if (candidates.some(candidate => filePaths.has(candidate))) {
          continue;
        }

        missingImports.push({
          importerPath: file.path,
          importPath: declaration.importPath,
          targetPath: this.chooseTargetPath(file.path, declaration, candidates),
          candidates,
          line: declaration.line,
          rawStatement: declaration.rawStatement,
          requiredNamedExports: declaration.requiredNamedExports,
          requiredDefaultExport: declaration.requiredDefaultExport,
          requiredNamespaceExport: declaration.requiredNamespaceExport,
          isSideEffectOnly: declaration.isSideEffectOnly
        });
      }
    }

    return missingImports;
  }

  private async generateMissingFile(
    missingImport: MissingLocalImport,
    files: Array<{ path: string; content: string }>,
    context: ImportCompletenessContext
  ): Promise<{ path: string; content: string }> {
    try {
      const systemPrompt = `You repair incomplete generated React/Vite projects.

Generate exactly one missing local module. The generated file must:
- Satisfy the import/export contract exactly.
- Match the existing project style and the user's requested app.
- Be complete production-quality code, not a placeholder and not TODO text.
- Compile on its own with Vite/TypeScript.
- Avoid creating new unresolved local imports.

Return ONLY JSON in this shape:
{"path":"target/path.tsx","content":"complete file content"}`;

      const userPrompt = this.buildGenerationPrompt(missingImport, files, context);
      const request: AIRequest = {
        prompt: userPrompt,
        systemPrompt,
        maxTokens: 8000,
        temperature: 0.15,
        useCase: 'code_generation',
        priority: 'quality',
        preferredModel: 'claude-sonnet-4-5-20250929'
      };

      const response = await multiModelAI.generate(request);
      const parsed = this.parseGeneratedFileResponse(response.content, missingImport.targetPath);
      const content = this.ensureRequiredExports(
        this.stripMarkdownCodeFence(parsed.content),
        missingImport
      );

      return {
        path: missingImport.targetPath,
        content
      };
    } catch (error) {
      logger.warn(`AI failed to generate ${missingImport.targetPath}; using deterministic fallback`, error as Error);
      return {
        path: missingImport.targetPath,
        content: this.generateFallbackFile(missingImport)
      };
    }
  }

  private buildGenerationPrompt(
    missingImport: MissingLocalImport,
    files: Array<{ path: string; content: string }>,
    context: ImportCompletenessContext
  ): string {
    const contextFiles = this.selectContextFiles(missingImport, files)
      .map(file => `--- ${file.path}\n${this.truncate(file.content, 2500)}`)
      .join('\n\n');
    const fileTree = files
      .map(file => file.path)
      .sort()
      .slice(0, 120)
      .join('\n');

    return `Generate the missing file for this generated app.

App name: ${context.appName || 'Generated app'}

Original user prompt:
${context.userPrompt || '(not provided)'}

Knowledge context:
${context.knowledgeContext || '(none)'}

Missing module target path:
${missingImport.targetPath}

Importer:
${missingImport.importerPath}:${missingImport.line}

Import statement:
${missingImport.rawStatement}

Required module contract:
- Import path used: ${missingImport.importPath}
- Named exports required: ${missingImport.requiredNamedExports.length > 0 ? missingImport.requiredNamedExports.join(', ') : 'none'}
- Default export required: ${missingImport.requiredDefaultExport || 'none'}
- Namespace export required: ${missingImport.requiredNamespaceExport || 'none'}
- Side-effect-only import: ${missingImport.isSideEffectOnly ? 'yes' : 'no'}

Existing file tree:
${fileTree}

Relevant existing files:
${contextFiles}

Return JSON only. The "path" must be "${missingImport.targetPath}". The "content" must contain the complete source code for that one file.`;
  }

  private selectContextFiles(
    missingImport: MissingLocalImport,
    files: Array<{ path: string; content: string }>
  ): Array<{ path: string; content: string }> {
    const targetDir = this.dirname(missingImport.targetPath);
    const importerDir = this.dirname(missingImport.importerPath);
    const selected = new Map<string, { path: string; content: string }>();

    const add = (file?: { path: string; content: string }) => {
      if (file) {
        selected.set(file.path, file);
      }
    };

    add(files.find(file => file.path === missingImport.importerPath));
    add(files.find(file => /(^|\/)App\.(tsx|jsx|ts|js)$/.test(file.path)));
    add(files.find(file => /(^|\/)main\.(tsx|jsx|ts|js)$/.test(file.path)));
    add(files.find(file => /(^|\/)package\.json$/.test(file.path)));
    add(files.find(file => /(^|\/)index\.css$/.test(file.path)));

    for (const file of files) {
      if (selected.size >= 8) {
        break;
      }

      if (this.dirname(file.path) === targetDir || this.dirname(file.path) === importerDir) {
        add(file);
      }
    }

    return Array.from(selected.values());
  }

  private extractLocalImportDeclarations(content: string): LocalImportDeclaration[] {
    const declarations: LocalImportDeclaration[] = [];
    const importFromRegex = /^\s*import\s+([\s\S]*?)\s+from\s+['"](\.{1,2}\/[^'"]+)['"];?/gm;
    const exportFromRegex = /^\s*export\s+(?:type\s+)?(.+?)\s+from\s+['"](\.{1,2}\/[^'"]+)['"];?/gm;
    const sideEffectRegex = /^\s*import\s+['"](\.{1,2}\/[^'"]+)['"];?/gm;

    for (const match of content.matchAll(importFromRegex)) {
      const clause = match[1] || '';
      const parsed = this.parseImportClause(clause);
      declarations.push({
        importPath: match[2],
        rawStatement: match[0].trim(),
        line: this.lineForIndex(content, match.index ?? 0),
        requiredNamedExports: parsed.requiredNamedExports,
        requiredDefaultExport: parsed.requiredDefaultExport,
        requiredNamespaceExport: parsed.requiredNamespaceExport,
        isSideEffectOnly: false
      });
    }

    for (const match of content.matchAll(exportFromRegex)) {
      const parsed = this.parseImportClause(match[1] || '');
      declarations.push({
        importPath: match[2],
        rawStatement: match[0].trim(),
        line: this.lineForIndex(content, match.index ?? 0),
        requiredNamedExports: parsed.requiredNamedExports,
        requiredDefaultExport: parsed.requiredDefaultExport,
        requiredNamespaceExport: parsed.requiredNamespaceExport,
        isSideEffectOnly: false
      });
    }

    for (const match of content.matchAll(sideEffectRegex)) {
      declarations.push({
        importPath: match[1],
        rawStatement: match[0].trim(),
        line: this.lineForIndex(content, match.index ?? 0),
        requiredNamedExports: [],
        isSideEffectOnly: true
      });
    }

    return declarations;
  }

  private parseImportClause(clause: string): {
    requiredNamedExports: string[];
    requiredDefaultExport?: string;
    requiredNamespaceExport?: string;
  } {
    const cleaned = clause.replace(/^type\s+/, '').trim();
    const namedExports = new Set<string>();
    const namedMatch = cleaned.match(/\{([\s\S]*?)\}/);

    if (namedMatch) {
      for (const item of namedMatch[1].split(',')) {
        const exportName = item
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/i)[0]
          .trim();

        if (this.isIdentifier(exportName)) {
          namedExports.add(exportName);
        }
      }
    }

    const beforeNamed = namedMatch
      ? cleaned.slice(0, namedMatch.index).replace(/,$/, '').trim()
      : cleaned;

    if (beforeNamed.startsWith('* as ')) {
      const namespaceExport = beforeNamed.replace('* as ', '').trim();
      return {
        requiredNamedExports: Array.from(namedExports),
        requiredNamespaceExport: this.isIdentifier(namespaceExport) ? namespaceExport : undefined
      };
    }

    const defaultExport = beforeNamed && !beforeNamed.includes('{')
      ? beforeNamed.replace(/,$/, '').trim()
      : undefined;

    return {
      requiredNamedExports: Array.from(namedExports),
      requiredDefaultExport: defaultExport && this.isIdentifier(defaultExport) ? defaultExport : undefined
    };
  }

  private chooseTargetPath(
    importerPath: string,
    declaration: LocalImportDeclaration,
    candidates: string[]
  ): string {
    const basePath = candidates[0];

    if (/\.[a-zA-Z0-9]+$/.test(basePath)) {
      return basePath;
    }

    if (
      declaration.importPath.match(/\.(css|scss)$/) ||
      (declaration.isSideEffectOnly && /(?:style|styles|theme|global|css)$/i.test(basePath))
    ) {
      return `${basePath}.css`;
    }

    if (this.looksLikeComponentImport(importerPath, declaration, basePath)) {
      return `${basePath}.tsx`;
    }

    return `${basePath}.ts`;
  }

  private looksLikeComponentImport(
    importerPath: string,
    declaration: LocalImportDeclaration,
    basePath: string
  ): boolean {
    const names = [
      declaration.requiredDefaultExport,
      declaration.requiredNamespaceExport,
      ...declaration.requiredNamedExports,
      this.basename(basePath)
    ].filter(Boolean) as string[];

    if (names.some(name => /^[A-Z][A-Za-z0-9]*$/.test(name))) {
      return true;
    }

    return importerPath.endsWith('.tsx') || importerPath.endsWith('.jsx');
  }

  private resolveRelativeImport(fromFile: string, importPath: string): string[] {
    const fromDir = this.dirname(this.normalizePath(fromFile));
    const basePath = this.normalizePath(`${fromDir}/${importPath}`);

    if (/\.[a-zA-Z0-9]+$/.test(basePath)) {
      return [basePath];
    }

    return [
      basePath,
      `${basePath}.tsx`,
      `${basePath}.ts`,
      `${basePath}.jsx`,
      `${basePath}.js`,
      `${basePath}.css`,
      `${basePath}.scss`,
      `${basePath}.json`,
      `${basePath}/index.tsx`,
      `${basePath}/index.ts`,
      `${basePath}/index.jsx`,
      `${basePath}/index.js`
    ];
  }

  private parseGeneratedFileResponse(content: string, targetPath: string): { path: string; content: string } {
    const trimmed = this.stripMarkdownCodeFence(content.trim());

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed.content === 'string') {
        return {
          path: typeof parsed.path === 'string' ? parsed.path : targetPath,
          content: parsed.content
        };
      }
    } catch {
      const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (parsed && typeof parsed.content === 'string') {
          return {
            path: typeof parsed.path === 'string' ? parsed.path : targetPath,
            content: parsed.content
          };
        }
      }
    }

    return {
      path: targetPath,
      content: trimmed
    };
  }

  private ensureRequiredExports(content: string, missingImport: MissingLocalImport): string {
    if (missingImport.targetPath.match(/\.(css|scss|json)$/)) {
      return content;
    }

    let fixedContent = content.trim();

    for (const exportName of missingImport.requiredNamedExports) {
      if (!this.hasNamedExport(fixedContent, exportName)) {
        fixedContent += `\n\n${this.buildNamedExportFallback(exportName, missingImport.targetPath)}`;
      }
    }

    if (missingImport.requiredDefaultExport && !/export\s+default\b/.test(fixedContent)) {
      fixedContent += `\n\n${this.buildDefaultExportFallback(missingImport.requiredDefaultExport, missingImport.targetPath)}`;
    }

    return `${fixedContent}\n`;
  }

  private hasNamedExport(content: string, exportName: string): boolean {
    const escaped = this.escapeRegExp(exportName);
    return new RegExp(`export\\s+(?:function|const|let|var|class|interface|type|enum)\\s+${escaped}\\b`).test(content) ||
      new RegExp(`export\\s*\\{[^}]*\\b${escaped}\\b[^}]*\\}`).test(content);
  }

  private generateFallbackFile(missingImport: MissingLocalImport): string {
    if (missingImport.targetPath.match(/\.(css|scss)$/)) {
      const className = this.toKebabCase(this.basename(missingImport.targetPath).replace(/\.(css|scss)$/, ''));
      return `.${className} {\n  display: block;\n}\n`;
    }

    if (missingImport.targetPath.endsWith('.json')) {
      return '{}\n';
    }

    const exports: string[] = [];

    for (const exportName of missingImport.requiredNamedExports) {
      exports.push(this.buildNamedExportFallback(exportName, missingImport.targetPath));
    }

    if (missingImport.requiredDefaultExport) {
      exports.push(this.buildDefaultExportFallback(missingImport.requiredDefaultExport, missingImport.targetPath));
    }

    if (exports.length === 0 && this.isTsxFile(missingImport.targetPath)) {
      const componentName = this.toPascalCase(this.basename(missingImport.targetPath).replace(/\.[^.]+$/, ''));
      exports.push(this.buildNamedExportFallback(componentName, missingImport.targetPath));
    }

    return `${exports.join('\n\n')}\n`;
  }

  private buildNamedExportFallback(exportName: string, targetPath: string): string {
    if (this.isTsxFile(targetPath) && /^[A-Z]/.test(exportName)) {
      return `export function ${exportName}() {
  return (
    <section className="${this.toKebabCase(exportName)}">
      <h2>${this.humanizeName(exportName)}</h2>
    </section>
  );
}`;
    }

    if (/^use[A-Z]/.test(exportName)) {
      return `export function ${exportName}() {
  return {};
}`;
    }

    return `export const ${exportName} = {};`;
  }

  private buildDefaultExportFallback(defaultExportName: string, targetPath: string): string {
    const safeName = this.toPascalCase(defaultExportName || this.basename(targetPath).replace(/\.[^.]+$/, ''));

    if (this.isTsxFile(targetPath)) {
      return `export default function ${safeName}() {
  return (
    <section className="${this.toKebabCase(safeName)}">
      <h2>${this.humanizeName(safeName)}</h2>
    </section>
  );
}`;
    }

    return `const ${safeName} = {};

export default ${safeName};`;
  }

  private dedupeMissingImports(missingImports: MissingLocalImport[]): MissingLocalImport[] {
    const deduped = new Map<string, MissingLocalImport>();

    for (const missingImport of missingImports) {
      const existing = deduped.get(missingImport.targetPath);
      if (!existing) {
        deduped.set(missingImport.targetPath, {
          ...missingImport,
          requiredNamedExports: [...missingImport.requiredNamedExports]
        });
        continue;
      }

      existing.requiredNamedExports = Array.from(new Set([
        ...existing.requiredNamedExports,
        ...missingImport.requiredNamedExports
      ]));
      existing.requiredDefaultExport = existing.requiredDefaultExport || missingImport.requiredDefaultExport;
      existing.requiredNamespaceExport = existing.requiredNamespaceExport || missingImport.requiredNamespaceExport;
      existing.rawStatement = `${existing.rawStatement}\n${missingImport.rawStatement}`;
      existing.candidates = Array.from(new Set([...existing.candidates, ...missingImport.candidates]));
    }

    return Array.from(deduped.values());
  }

  private upsertFile(
    files: Array<{ path: string; content: string }>,
    file: { path: string; content: string }
  ): Array<{ path: string; content: string }> {
    const nextFiles = files.filter(existing => existing.path !== file.path);
    nextFiles.push({
      path: this.normalizePath(file.path),
      content: file.content
    });
    return this.normalizeFiles(nextFiles);
  }

  private normalizeFiles(files: Array<{ path: string; content: string }>): Array<{ path: string; content: string }> {
    const normalized = new Map<string, string>();

    for (const file of files) {
      normalized.set(this.normalizePath(file.path), file.content);
    }

    return Array.from(normalized.entries()).map(([path, content]) => ({ path, content }));
  }

  private normalizePath(filePath: string): string {
    const normalized = filePath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/^\.\//, '');
    const parts: string[] = [];

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

  private dirname(filePath: string): string {
    const normalized = this.normalizePath(filePath);
    const lastSlash = normalized.lastIndexOf('/');
    return lastSlash >= 0 ? normalized.slice(0, lastSlash) : '';
  }

  private basename(filePath: string): string {
    const normalized = this.normalizePath(filePath);
    return normalized.slice(normalized.lastIndexOf('/') + 1);
  }

  private isCodeFile(filePath: string): boolean {
    return /\.(tsx?|jsx?)$/.test(filePath);
  }

  private isTsxFile(filePath: string): boolean {
    return /\.(tsx|jsx)$/.test(filePath);
  }

  private isIdentifier(value: string): boolean {
    return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value);
  }

  private lineForIndex(content: string, index: number): number {
    return content.slice(0, index).split(/\r?\n/).length;
  }

  private truncate(content: string, maxLength: number): string {
    return content.length > maxLength ? `${content.slice(0, maxLength)}\n...` : content;
  }

  private stripMarkdownCodeFence(content: string): string {
    const trimmed = content.trim();
    if (!trimmed.startsWith('```')) {
      return trimmed;
    }

    const match = trimmed.match(/```(?:json|typescript|tsx|ts|javascript|jsx|js|css)?\s*\n?([\s\S]*?)\n?```/);
    return match?.[1]?.trim() || trimmed.replace(/^```[^\n]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  private toPascalCase(value: string): string {
    const cleaned = value.replace(/\.[^.]+$/, '');
    const pascal = cleaned
      .split(/[^A-Za-z0-9_$]+/)
      .filter(Boolean)
      .map(part => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
      .join('');

    return this.isIdentifier(pascal) ? pascal : 'GeneratedModule';
  }

  private toKebabCase(value: string): string {
    return value
      .replace(/\.[^.]+$/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
      .replace(/[^A-Za-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'generated-module';
  }

  private humanizeName(value: string): string {
    return value
      .replace(/\.[^.]+$/, '')
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[-_]+/g, ' ')
      .trim();
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

export const importCompletenessFixer = new ImportCompletenessFixer();
