import { spawn } from 'child_process';
import crypto from 'crypto';
import path from 'path';
import { promises as fs } from 'fs';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db';
import { previewSessions } from '../../db/schema-pg';
import { projectService } from './ProjectService';

type PreviewStatus = 'queued' | 'building' | 'ready' | 'failed' | 'expired';

type PreviewFile = {
  path: string;
  content: string;
};

type PreviewSessionRecord = typeof previewSessions.$inferSelect;

type CreatePreviewInput = {
  userId: string;
  projectId?: number | null;
  files?: PreviewFile[];
  componentName?: string;
  baseUrl: string;
};

type RunCommandOptions = {
  cwd: string;
  timeoutMs: number;
  logs: string[];
};

type PreviewBuildJob = {
  id: string;
  files: PreviewFile[];
  buildDir: string;
};

const DEPENDENCY_VERSIONS: Record<string, string> = {
  '@vitejs/plugin-react': '^5.0.0',
  '@types/react': '^18.3.18',
  '@types/react-dom': '^18.3.5',
  autoprefixer: '^10.4.20',
  axios: '^1.7.9',
  clsx: '^2.1.1',
  'date-fns': '^3.6.0',
  'framer-motion': '^11.13.1',
  'lucide-react': '^0.453.0',
  postcss: '^8.4.47',
  react: '^18.3.1',
  'react-dom': '^18.3.1',
  'react-hook-form': '^7.53.1',
  'react-router-dom': '^6.26.0',
  recharts: '^2.13.0',
  tailwindcss: '^3.4.14',
  typescript: '^5.7.2',
  uuid: '^10.0.0',
  vite: '^7.1.7',
  zod: '^3.25.76',
};

export class PreviewService {
  private readonly previewRoot = process.env.PREVIEW_WORKSPACE_DIR
    ? path.resolve(process.env.PREVIEW_WORKSPACE_DIR)
    : path.join(process.cwd(), 'preview-workspaces');
  private readonly sessionTtlMs = Number(process.env.PREVIEW_SESSION_TTL_MS || 1000 * 60 * 60);
  private readonly buildTimeoutMs = Number(process.env.PREVIEW_BUILD_TIMEOUT_MS || 1000 * 60 * 2);
  private readonly buildConcurrency = Math.max(1, Number(process.env.PREVIEW_BUILD_CONCURRENCY || 1));
  private readonly buildQueue: PreviewBuildJob[] = [];
  private activeBuilds = 0;

  async createPreview(input: CreatePreviewInput): Promise<PreviewSessionRecord> {
    if (input.projectId) {
      const hasAccess = await projectService.checkProjectAccess(input.projectId, input.userId);
      if (!hasAccess) {
        throw new Error('You do not have access to this project');
      }
    }

    const files = await this.getSourceFiles(input);
    if (files.length === 0) {
      throw new Error('No files available for preview');
    }

    const id = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + this.sessionTtlMs);
    const buildDir = path.join(this.previewRoot, id);
    const previewUrl = `${input.baseUrl.replace(/\/$/, '')}/api/previews/${id}/app/`;
    const sourceHash = this.hashFiles(files);

    const [session] = await db.insert(previewSessions).values({
      id,
      userId: input.userId,
      projectId: input.projectId || null,
      status: 'queued',
      previewUrl,
      buildDir,
      sourceHash,
      logs: ['Preview queued'],
      metadata: {
        componentName: input.componentName || null,
        fileCount: files.length,
        runtime: 'static-vite',
      },
      expiresAt,
    }).returning();

    this.enqueueBuild({ id: session.id, files, buildDir });

    return session;
  }

  async getSession(id: string, userId?: string): Promise<PreviewSessionRecord | null> {
    const conditions = [eq(previewSessions.id, id)];
    if (userId) {
      conditions.push(eq(previewSessions.userId, userId));
    }

    const rows = await db.select().from(previewSessions).where(and(...conditions)).limit(1);
    return rows[0] || null;
  }

  async deleteSession(id: string, userId: string): Promise<boolean> {
    const session = await this.getSession(id, userId);
    if (!session) return false;

    await db.update(previewSessions)
      .set({ status: 'expired', updatedAt: new Date() })
      .where(and(eq(previewSessions.id, id), eq(previewSessions.userId, userId)));

    if (session.buildDir) {
      await fs.rm(session.buildDir, { recursive: true, force: true }).catch(() => undefined);
    }

    return true;
  }

  async resolveAsset(id: string, requestPath: string): Promise<{ filePath: string; session: PreviewSessionRecord } | null> {
    const session = await this.getSession(id);
    if (!session || session.status !== 'ready' || !session.buildDir || !session.entryPath) {
      return null;
    }

    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) {
      await db.update(previewSessions)
        .set({ status: 'expired', updatedAt: new Date() })
        .where(eq(previewSessions.id, id));
      return null;
    }

    const distDir = path.resolve(session.buildDir, session.entryPath);
    const cleanRequestPath = this.normalizeRequestPath(requestPath);
    const requestedPath = path.resolve(distDir, cleanRequestPath || 'index.html');

    if (!this.isInside(distDir, requestedPath)) {
      return null;
    }

    let filePath = requestedPath;
    try {
      const stat = await fs.stat(filePath);
      if (stat.isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
    } catch {
      filePath = path.join(distDir, 'index.html');
    }

    if (!this.isInside(distDir, filePath)) {
      return null;
    }

    if (!cleanRequestPath || cleanRequestPath === 'index.html') {
      await db.update(previewSessions)
        .set({ lastAccessedAt: new Date() })
        .where(eq(previewSessions.id, id))
        .catch(() => undefined);
    }

    return { filePath, session };
  }

  private async getSourceFiles(input: CreatePreviewInput): Promise<PreviewFile[]> {
    if (input.files && input.files.length > 0) {
      return this.normalizeFiles(input.files);
    }

    if (!input.projectId) {
      return [];
    }

    const projectFiles = await projectService.getProjectFiles(input.projectId);
    return this.normalizeFiles(projectFiles.map(file => ({
      path: file.filePath,
      content: file.fileContent,
    })));
  }

  private normalizeFiles(files: PreviewFile[]): PreviewFile[] {
    const normalized = new Map<string, string>();

    for (const file of files) {
      const normalizedPath = this.normalizeFilePath(file.path);
      if (!normalizedPath) continue;
      if (normalizedPath.startsWith('node_modules/') || normalizedPath.startsWith('.git/')) continue;
      if (normalizedPath.includes('/node_modules/') || normalizedPath.includes('/.git/')) continue;
      normalized.set(normalizedPath, String(file.content ?? ''));
    }

    return Array.from(normalized.entries()).map(([filePath, content]) => ({
      path: filePath,
      content,
    }));
  }

  private normalizeFilePath(filePath: string): string | null {
    const normalized = filePath
      .replace(/\\/g, '/')
      .replace(/^\/+/, '')
      .replace(/^\.\//, '');

    const parts: string[] = [];
    for (const part of normalized.split('/')) {
      if (!part || part === '.') continue;
      if (part === '..') return null;
      parts.push(part);
    }

    return parts.join('/');
  }

  private normalizeRequestPath(requestPath: string): string {
    const withoutQuery = decodeURIComponent(requestPath || '').split('?')[0].replace(/^\/+/, '');
    const normalized = this.normalizeFilePath(withoutQuery);
    return normalized || '';
  }

  private async buildSession(id: string, files: PreviewFile[], buildDir: string): Promise<void> {
    const logs: string[] = ['Preview build started'];

    await this.updateSession(id, 'building', { logs });

    try {
      await fs.rm(buildDir, { recursive: true, force: true });
      await fs.mkdir(buildDir, { recursive: true });

      const sourceDir = path.join(buildDir, 'source');
      await fs.mkdir(sourceDir, { recursive: true });

      for (const file of files) {
        const targetPath = path.join(sourceDir, file.path);
        if (!this.isInside(sourceDir, targetPath)) {
          throw new Error(`Unsafe file path skipped: ${file.path}`);
        }
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, file.content, 'utf8');
      }

      const appRoot = await this.prepareAppRoot(sourceDir, files, logs);

      logs.push('Installing preview dependencies');
      await this.runCommand('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], {
        cwd: appRoot,
        timeoutMs: this.buildTimeoutMs,
        logs,
      });

      logs.push('Building static preview');
      await this.runCommand('npm', ['exec', 'vite', '--', 'build', '--base', './'], {
        cwd: appRoot,
        timeoutMs: this.buildTimeoutMs,
        logs,
      });

      const distDir = path.join(appRoot, 'dist');
      await fs.access(path.join(distDir, 'index.html'));
      const entryPath = path.relative(buildDir, distDir).replace(/\\/g, '/');

      logs.push('Preview is ready');
      await db.update(previewSessions)
        .set({
          status: 'ready',
          entryPath,
          logs,
          updatedAt: new Date(),
        })
        .where(eq(previewSessions.id, id));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      logs.push(`Preview failed: ${message}`);
      await db.update(previewSessions)
        .set({
          status: 'failed',
          errorMessage: message,
          logs,
          updatedAt: new Date(),
        })
        .where(eq(previewSessions.id, id));
    }
  }

  private enqueueBuild(job: PreviewBuildJob): void {
    this.buildQueue.push(job);
    this.drainBuildQueue();
  }

  private drainBuildQueue(): void {
    while (this.activeBuilds < this.buildConcurrency && this.buildQueue.length > 0) {
      const job = this.buildQueue.shift()!;
      this.activeBuilds += 1;

      void this.buildSession(job.id, job.files, job.buildDir)
        .catch((error) => {
          console.error(`[PreviewService] Unhandled preview build failure for ${job.id}:`, error);
        })
        .finally(() => {
          this.activeBuilds -= 1;
          this.drainBuildQueue();
        });
    }
  }

  private async prepareAppRoot(sourceDir: string, files: PreviewFile[], logs: string[]): Promise<string> {
    const paths = files.map(file => file.path);
    const hasRootPackage = paths.includes('package.json');
    const hasClientPackage = paths.includes('client/package.json');
    const hasClientSource = paths.some(filePath => filePath.startsWith('client/src/'));
    const appRoot = hasClientPackage || (!hasRootPackage && hasClientSource)
      ? path.join(sourceDir, 'client')
      : sourceDir;

    await fs.mkdir(appRoot, { recursive: true });
    await this.ensurePackageJson(appRoot, paths, logs);
    await this.ensureIndexHtml(appRoot, paths, logs);
    await this.ensureMainEntry(appRoot, paths, logs);
    await this.ensureGlobalCss(appRoot, paths, logs);

    return appRoot;
  }

  private async ensurePackageJson(appRoot: string, paths: string[], logs: string[]): Promise<void> {
    const packagePath = path.join(appRoot, 'package.json');
    let packageJson: any = {};

    try {
      packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
    } catch {
      logs.push('Created fallback package.json for preview');
    }

    packageJson.type = 'module';
    packageJson.scripts = {
      ...(packageJson.scripts || {}),
      build: 'vite build',
    };
    packageJson.dependencies = {
      ...(packageJson.dependencies || {}),
      react: packageJson.dependencies?.react || DEPENDENCY_VERSIONS.react,
      'react-dom': packageJson.dependencies?.['react-dom'] || DEPENDENCY_VERSIONS['react-dom'],
    };
    packageJson.devDependencies = {
      ...(packageJson.devDependencies || {}),
      '@vitejs/plugin-react': packageJson.devDependencies?.['@vitejs/plugin-react'] || DEPENDENCY_VERSIONS['@vitejs/plugin-react'],
      typescript: packageJson.devDependencies?.typescript || DEPENDENCY_VERSIONS.typescript,
      vite: packageJson.devDependencies?.vite || DEPENDENCY_VERSIONS.vite,
    };

    const allContent = await this.readProjectContent(appRoot, paths);
    for (const [dependency, version] of Object.entries(DEPENDENCY_VERSIONS)) {
      if (dependency === 'react' || dependency === 'react-dom') continue;
      if (allContent.includes(`from '${dependency}'`) || allContent.includes(`from "${dependency}"`) || allContent.includes(dependency)) {
        packageJson.dependencies[dependency] = packageJson.dependencies[dependency] || version;
      }
    }

    await fs.writeFile(packagePath, JSON.stringify(packageJson, null, 2), 'utf8');
  }

  private async ensureIndexHtml(appRoot: string, paths: string[], logs: string[]): Promise<void> {
    const indexPath = path.join(appRoot, 'index.html');
    const hasIndex = paths.includes('index.html') || paths.includes('client/index.html');
    if (hasIndex) return;

    logs.push('Created fallback index.html for preview');
    await fs.writeFile(indexPath, `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Preview</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`, 'utf8');
  }

  private async ensureMainEntry(appRoot: string, paths: string[], logs: string[]): Promise<void> {
    const hasMain = paths.includes('src/main.tsx') || paths.includes('client/src/main.tsx');
    const hasApp = paths.includes('src/App.tsx') || paths.includes('client/src/App.tsx');
    if (hasMain || !hasApp) return;

    logs.push('Created fallback src/main.tsx for preview');
    const mainPath = path.join(appRoot, 'src', 'main.tsx');
    await fs.mkdir(path.dirname(mainPath), { recursive: true });
    await fs.writeFile(mainPath, `import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
`, 'utf8');
  }

  private async ensureGlobalCss(appRoot: string, paths: string[], logs: string[]): Promise<void> {
    const hasCss = paths.includes('src/index.css') || paths.includes('client/src/index.css');
    if (hasCss) return;

    const cssPath = path.join(appRoot, 'src', 'index.css');
    try {
      await fs.access(cssPath);
      return;
    } catch {
      logs.push('Created fallback src/index.css for preview');
      await fs.mkdir(path.dirname(cssPath), { recursive: true });
      await fs.writeFile(cssPath, `@tailwind base;
@tailwind components;
@tailwind utilities;

* {
  box-sizing: border-box;
}

body {
  margin: 0;
}
`, 'utf8');
    }
  }

  private async readProjectContent(appRoot: string, paths: string[]): Promise<string> {
    const snippets: string[] = [];
    for (const filePath of paths) {
      if (!/\.(ts|tsx|js|jsx|json)$/.test(filePath)) continue;
      const candidate = path.join(appRoot, filePath.replace(/^client\//, ''));
      if (!this.isInside(appRoot, candidate)) continue;
      try {
        snippets.push(await fs.readFile(candidate, 'utf8'));
      } catch {
        // Ignore optional files.
      }
    }
    return snippets.join('\n');
  }

  private runCommand(command: string, args: string[], options: RunCommandOptions): Promise<void> {
    return new Promise((resolve, reject) => {
      const executable = process.platform === 'win32' ? `${command}.cmd` : command;
      const child = spawn(executable, args, {
        cwd: options.cwd,
        env: {
          ...process.env,
          CI: 'true',
          NODE_ENV: 'development',
        },
        shell: false,
      });

      const timer = setTimeout(() => {
        child.kill('SIGTERM');
        reject(new Error(`${command} ${args.join(' ')} timed out`));
      }, options.timeoutMs);

      const capture = (chunk: Buffer) => {
        const text = chunk.toString('utf8');
        for (const line of text.split(/\r?\n/)) {
          const trimmed = line.trim();
          if (trimmed) options.logs.push(trimmed.slice(0, 500));
        }
        while (options.logs.length > 250) options.logs.shift();
      };

      child.stdout.on('data', capture);
      child.stderr.on('data', capture);
      child.on('error', (error) => {
        clearTimeout(timer);
        reject(error);
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code}`));
        }
      });
    });
  }

  private async updateSession(id: string, status: PreviewStatus, data: Partial<typeof previewSessions.$inferInsert> = {}): Promise<void> {
    await db.update(previewSessions)
      .set({
        ...data,
        status,
        updatedAt: new Date(),
      })
      .where(eq(previewSessions.id, id));
  }

  private hashFiles(files: PreviewFile[]): string {
    const hash = crypto.createHash('sha256');
    for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
      hash.update(file.path);
      hash.update('\0');
      hash.update(file.content);
      hash.update('\0');
    }
    return hash.digest('hex');
  }

  private isInside(parent: string, child: string): boolean {
    const relative = path.relative(path.resolve(parent), path.resolve(child));
    return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
  }
}

export const previewService = new PreviewService();
