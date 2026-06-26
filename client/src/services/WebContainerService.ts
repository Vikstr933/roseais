/**
 * WebContainer Service (Client-side)
 * 
 * Manages WebContainer instances for live preview in the browser
 * This is a browser-only service that uses @webcontainer/api
 */

import { WebContainer } from '@webcontainer/api';

export interface WebContainerInstance {
  id: string;
  webcontainer: WebContainer;
  url: string;
  status: 'starting' | 'running' | 'error' | 'stopped';
  componentName: string;
  createdAt: Date;
}

export interface GeneratedFile {
  path: string;
  content: string;
}

export interface WebContainerSupport {
  supported: boolean;
  reason?: 'server' | 'shared-array-buffer' | 'cross-origin-isolation' | 'api-unavailable';
  isMobileBrowser: boolean;
  isIOSBrowser: boolean;
  userMessage: string;
}

interface PreviewLayout {
  isFullstack: boolean;
  frontendCwd: string;
  backendCwd: string | null;
  frontendPort: number;
  backendPort: number;
}

class WebContainerServiceClass {
  private instances: Map<string, WebContainerInstance> = new Map();
  private bootedInstance: WebContainer | null = null;
  private backendServerProcess: any = null;

  private isLocalPreviewUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return ['localhost', '127.0.0.1', '::1'].includes(parsed.hostname);
    } catch {
      return url.includes('localhost') || url.includes('127.0.0.1');
    }
  }

  /**
   * Check if WebContainer is supported in this browser
   */
  getSupportStatus(): WebContainerSupport {
    if (typeof window === 'undefined') {
      return {
        supported: false,
        reason: 'server',
        isMobileBrowser: false,
        isIOSBrowser: false,
        userMessage: 'Live preview is only available in a browser.'
      };
    }

    const userAgent = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const isIPadOS = platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const isIOSBrowser = /iPhone|iPad|iPod/i.test(userAgent) || isIPadOS;
    const isMobileBrowser = /Android|iPhone|iPad|iPod|Mobile/i.test(userAgent) || isIPadOS;
    const hasSharedArrayBuffer = 'SharedArrayBuffer' in window;
    const isCrossOriginIsolated = (window as any).crossOriginIsolated === true;

    if (!hasSharedArrayBuffer) {
      return {
        supported: false,
        reason: 'shared-array-buffer',
        isMobileBrowser,
        isIOSBrowser,
        userMessage: isIOSBrowser
          ? 'Chrome on iPhone uses Apple’s browser engine, which does not provide the browser runtime WebContainer needs. Use Chrome on Android or desktop for in-browser preview.'
          : 'Live preview needs SharedArrayBuffer support. Refresh after the latest deployment and use Chrome with third-party cookies/service workers allowed.'
      };
    }

    if (!isCrossOriginIsolated) {
      return {
        supported: false,
        reason: 'cross-origin-isolation',
        isMobileBrowser,
        isIOSBrowser,
        userMessage: 'Live preview needs cross-origin isolation to run safely. Refresh after the latest deployment so the new COOP/COEP headers are active.'
      };
    }

    try {
      if (typeof WebContainer === 'undefined') {
        return {
          supported: false,
          reason: 'api-unavailable',
          isMobileBrowser,
          isIOSBrowser,
          userMessage: isIOSBrowser
            ? 'Chrome on iPhone uses Apple’s browser engine, which cannot run this in-browser preview runtime.'
            : 'Live preview is not available in this browser. Use Chrome with WebAssembly and service workers enabled.'
        };
      }
    } catch {
      return {
        supported: false,
        reason: 'api-unavailable',
        isMobileBrowser,
        isIOSBrowser,
        userMessage: isIOSBrowser
          ? 'Chrome on iPhone uses Apple’s browser engine, which cannot run this in-browser preview runtime.'
          : 'Live preview is not available in this browser. Use Chrome with WebAssembly and service workers enabled.'
      };
    }

    return {
      supported: true,
      isMobileBrowser,
      isIOSBrowser,
      userMessage: 'Live preview is supported in this browser.'
    };
  }

  isSupported(): boolean {
    return this.getSupportStatus().supported;
  }

  /**
   * Boot WebContainer (singleton instance) with retry logic
   */
  async boot(maxRetries: number = 3, retryDelay: number = 1000): Promise<WebContainer> {
    if (this.bootedInstance) {
      return this.bootedInstance;
    }

    // Check browser support
    const support = this.getSupportStatus();
    if (!support.supported) {
      const error = new Error(support.userMessage);
      console.error('❌ WebContainer not supported:', {
        reason: support.reason,
        hasSharedArrayBuffer: typeof window !== 'undefined' && 'SharedArrayBuffer' in window,
        crossOriginIsolated: typeof window !== 'undefined' ? (window as any).crossOriginIsolated === true : false,
        hasWebContainer: typeof WebContainer !== 'undefined',
        isMobileBrowser: support.isMobileBrowser,
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown'
      });
      throw error;
    }

    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 Booting WebContainer (attempt ${attempt}/${maxRetries})...`);
        this.bootedInstance = await WebContainer.boot({ coep: 'credentialless' });
        console.log('✅ WebContainer booted successfully');
        return this.bootedInstance;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.error(`❌ WebContainer boot attempt ${attempt} failed:`, lastError.message);
        
        // Don't retry on the last attempt
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          console.log(`⏳ Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    console.error('❌ WebContainer boot failed after all retries');
    throw lastError || new Error('WebContainer boot failed after all retries');
  }

  /**
   * Create a new WebContainer instance for a generated app
   */
  async createInstance(
    componentName: string,
    files: GeneratedFile[]
  ): Promise<WebContainerInstance> {
    const webcontainer = await this.boot();

    // Create unique instance ID
    const instanceId = `${componentName}-${Date.now()}`;

    // Mount files to WebContainer
    await this.mountFiles(webcontainer, files);

    // Install dependencies
    await this._installDependencies(webcontainer);

    // Start dev server
    const url = await this._startDevServer(webcontainer);

    const instance: WebContainerInstance = {
      id: instanceId,
      webcontainer,
      url,
      status: 'running',
      componentName,
      createdAt: new Date(),
    };

    this.instances.set(instanceId, instance);
    return instance;
  }

  /**
   * Deploy app (alias for createInstance)
   */
  async deployApp(
    componentName: string,
    files: GeneratedFile[]
  ): Promise<WebContainerInstance> {
    return this.createInstance(componentName, files);
  }

  /**
   * Mount files to WebContainer
   */
  private async mountFiles(
    webcontainer: WebContainer,
    files: GeneratedFile[]
  ): Promise<void> {
    const normalizedFiles = this.normalizePreviewFiles(files);
    const fileTree: Record<string, { file: { contents: string } }> = {};

    for (const file of normalizedFiles) {
      const pathParts = file.path.split('/');
      let current: any = fileTree;

      // Create nested structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        if (!current[part]) {
          current[part] = { directory: {} };
        }
        current = current[part].directory;
      }

      // Add file
      const fileName = pathParts[pathParts.length - 1];
      current[fileName] = { file: { contents: file.content } };
    }

    await webcontainer.mount(fileTree);
    console.log(`📁 Mounted ${normalizedFiles.length} files to WebContainer`);
  }

  /**
   * Install dependencies (internal method)
   */
  private async _installDependencies(webcontainer: WebContainer): Promise<void> {
    await this.installDependenciesForLayout(webcontainer);
  }

  /**
   * Start dev server (internal method)
   */
  private async _startDevServer(webcontainer: WebContainer): Promise<string> {
    return this.startDevServerForLayout(webcontainer);
  }

  /**
   * Get instance by ID
   */
  getInstance(instanceId: string): WebContainerInstance | undefined {
    return this.instances.get(instanceId);
  }

  /**
   * Stop and remove instance
   */
  async stopInstance(instanceId: string): Promise<void> {
    const instance = this.instances.get(instanceId);
    if (instance) {
      // WebContainer doesn't have explicit stop, but we can remove from map
      this.instances.delete(instanceId);
      console.log(`🛑 Stopped instance ${instanceId}`);
    }
  }

  /**
   * Write files to WebContainer
   * Uses filesystem API for updates, mount for initial setup
   */
  async writeFiles(files: GeneratedFile[]): Promise<void> {
    const webcontainer = await this.boot();
    const normalizedFiles = this.normalizePreviewFiles(files);
    
    // Check if filesystem is already mounted by trying to read root directory
    let isMounted = false;
    try {
      await webcontainer.fs.readdir('/');
      isMounted = true;
    } catch {
      // Not mounted yet, use mount
      isMounted = false;
    }

    if (!isMounted) {
      // First time: mount the entire filesystem
      await this.mountFiles(webcontainer, normalizedFiles);
      console.log(`📝 Mounted ${normalizedFiles.length} files to WebContainer`);
    } else {
      // Already mounted: write files individually using filesystem API
      for (const file of normalizedFiles) {
        try {
          // Ensure directory exists
          const dirPath = file.path.split('/').slice(0, -1).join('/');
          if (dirPath) {
            try {
              await webcontainer.fs.mkdir(dirPath, { recursive: true });
            } catch (err) {
              // Directory might already exist, that's fine
            }
          }
          
          // Write file
          await webcontainer.fs.writeFile(file.path, file.content);
        } catch (error) {
          console.error(`Failed to write file ${file.path}:`, error);
          // Continue with other files
        }
      }
      console.log(`📝 Updated ${normalizedFiles.length} files in WebContainer`);
    }
  }

  async listFiles(path: string = '.'): Promise<string[]> {
    const webcontainer = await this.boot();
    return webcontainer.fs.readdir(path);
  }

  async executeCommand(
    executable: string,
    args: string[] = [],
    options: {
      cwd?: string;
      onOutput?: (line: string) => void;
      env?: Record<string, string>;
    } = {}
  ): Promise<{ exitCode: number }> {
    const webcontainer = await this.boot();
    const spawnOptions = {
      ...(options.cwd ? { cwd: options.cwd } : {}),
      ...(options.env ? { env: options.env } : {}),
    };
    const process = Object.keys(spawnOptions).length > 0
      ? await webcontainer.spawn(executable, args, spawnOptions)
      : await webcontainer.spawn(executable, args);

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          const message = typeof data === 'string' ? data : new TextDecoder().decode(data);
          options.onOutput?.(message);
        },
      })
    ).catch(error => {
      console.warn(`Command output stream ended for ${executable}`, error);
    });

    const exitCode = await process.exit;
    return { exitCode };
  }

  private normalizePreviewFiles(files: GeneratedFile[]): GeneratedFile[] {
    const normalizedInput = files.map(file => ({
      ...file,
      path: file.path.replace(/\\/g, '/').replace(/^\/+/, '').replace(/^\.\//, '')
    }));
    const hasServer = normalizedInput.some(file => file.path.startsWith('server/'));
    const hasClientPackage = normalizedInput.some(file => file.path === 'client/package.json');
    const normalized = new Map<string, string>();

    for (const file of normalizedInput) {
      normalized.set(this.normalizeFullstackPath(file.path, hasServer, hasClientPackage), file.content);
    }

    return Array.from(normalized.entries()).map(([path, content]) => ({ path, content }));
  }

  private normalizeFullstackPath(path: string, hasServer: boolean, hasClientPackage: boolean): string {
    if (!hasServer || path.startsWith('client/') || path.startsWith('server/')) {
      return path;
    }

    if (path.startsWith('src/')) {
      return `client/${path}`;
    }

    const frontendRootFiles = new Set([
      'index.html',
      'vite.config.ts',
      'vite.config.js',
      'tsconfig.json',
      'tsconfig.node.json',
      'tailwind.config.js',
      'postcss.config.js',
      '.env.example'
    ]);

    if (frontendRootFiles.has(path)) {
      return `client/${path}`;
    }

    if (path === 'package.json' && !hasClientPackage) {
      return 'client/package.json';
    }

    return path;
  }

  private async fileExists(webcontainer: WebContainer, path: string): Promise<boolean> {
    try {
      await webcontainer.fs.readFile(path);
      return true;
    } catch {
      return false;
    }
  }

  private async detectPreviewLayout(webcontainer: WebContainer): Promise<PreviewLayout> {
    const hasClientPackage = await this.fileExists(webcontainer, 'client/package.json');
    const hasServerPackage = await this.fileExists(webcontainer, 'server/package.json');
    const hasRootPackage = await this.fileExists(webcontainer, 'package.json');

    return {
      isFullstack: hasServerPackage && (hasClientPackage || hasRootPackage),
      frontendCwd: hasClientPackage ? 'client' : '.',
      backendCwd: hasServerPackage ? 'server' : null,
      frontendPort: 3000,
      backendPort: 3001,
    };
  }

  private async spawnNpm(
    webcontainer: WebContainer,
    cwd: string,
    args: string[],
    label: string,
    onProgress?: (message: string) => void,
    env?: Record<string, string>
  ): Promise<any> {
    const options = cwd === '.'
      ? (env ? { env } : undefined)
      : (env ? { cwd, env } : { cwd });
    const process = options
      ? await webcontainer.spawn('npm', args, options)
      : await webcontainer.spawn('npm', args);

    process.output.pipeTo(
      new WritableStream({
        write(data) {
          const message = typeof data === 'string' ? data : new TextDecoder().decode(data);
          onProgress?.(message);
          console.log(`${label}:`, message);
        },
      })
    ).catch(error => {
      console.warn(`${label} output stream ended`, error);
    });

    return process;
  }

  private async installDependenciesForLayout(
    webcontainer: WebContainer,
    onProgress?: (message: string) => void
  ): Promise<void> {
    const layout = await this.detectPreviewLayout(webcontainer);
    const installTargets = layout.isFullstack && layout.backendCwd
      ? [layout.frontendCwd, layout.backendCwd]
      : [layout.frontendCwd];

    for (const cwd of installTargets) {
      onProgress?.(`Installing dependencies in ${cwd === '.' ? 'project root' : cwd}...\n`);
      const installProcess = await this.spawnNpm(
        webcontainer,
        cwd,
        ['install'],
        `📦 npm install (${cwd})`,
        onProgress
      );

      const code = await installProcess.exit;
      if (code !== 0) {
        throw new Error(`npm install failed in ${cwd} with code ${code}`);
      }
    }

    console.log('✅ Dependencies installed');
  }

  private waitForServerUrl(
    webcontainer: WebContainer,
    process: any,
    expectedPort: number,
    label: string,
    onProgress?: (message: string) => void,
    timeoutMs: number = 45000,
    allowAnyRemotePort: boolean = false
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      let resolved = false;

      webcontainer.on('server-ready', (serverPort: number, url: string) => {
        const matchesExpectedServer = serverPort === expectedPort || allowAnyRemotePort;
        if (!resolved && matchesExpectedServer && !this.isLocalPreviewUrl(url)) {
          resolved = true;
          resolve(url);
        }
      });

      process.output.pipeTo(
        new WritableStream({
          write: (data) => {
            const message = typeof data === 'string' ? data : new TextDecoder().decode(data);
            onProgress?.(message);
            console.log(`${label}:`, message);

            if (!resolved) {
              const remoteUrl = message.match(/https?:\/\/[^\s]+webcontainer-api\.io[^\s]*/)?.[0];
              if (remoteUrl && !this.isLocalPreviewUrl(remoteUrl)) {
                resolved = true;
                resolve(remoteUrl);
              }
            }
          },
        })
      ).catch((error: unknown) => {
        if (!resolved) {
          reject(error);
        }
      });

      process.exit.then((code: number) => {
        if (!resolved && code !== 0) {
          reject(new Error(`${label} exited with code ${code}`));
        }
      });

      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          reject(new Error(`${label} started, but WebContainer did not provide a browser-accessible preview URL.`));
        }
      }, timeoutMs);
    });
  }

  private async startDevServerForLayout(
    webcontainer: WebContainer,
    onProgress?: (message: string) => void
  ): Promise<string> {
    const layout = await this.detectPreviewLayout(webcontainer);

    if (this.devServerProcess || this.backendServerProcess) {
      await this.stopDevServer();
    }

    let backendUrl: string | null = null;

    if (layout.isFullstack && layout.backendCwd) {
      onProgress?.('Starting backend API server...\n');
      this.backendServerProcess = await webcontainer.spawn('npm', ['run', 'dev'], {
        cwd: layout.backendCwd,
        env: {
          PORT: String(layout.backendPort),
        },
      });

      backendUrl = await this.waitForServerUrl(
        webcontainer,
        this.backendServerProcess,
        layout.backendPort,
        '🚀 Backend server',
        onProgress
      );
      onProgress?.(`Backend ready at ${backendUrl}\n`);
    }

    onProgress?.('Starting frontend preview...\n');
    const frontendEnv = backendUrl ? { VITE_API_URL: backendUrl } : undefined;
    const frontendArgs = ['run', 'dev', '--', '--port', layout.frontendPort.toString(), '--host'];
    if (layout.frontendCwd === '.') {
      this.devServerProcess = frontendEnv
        ? await webcontainer.spawn('npm', frontendArgs, { env: frontendEnv })
        : await webcontainer.spawn('npm', frontendArgs);
    } else {
      this.devServerProcess = frontendEnv
        ? await webcontainer.spawn('npm', frontendArgs, { cwd: layout.frontendCwd, env: frontendEnv })
        : await webcontainer.spawn('npm', frontendArgs, { cwd: layout.frontendCwd });
    }

    const frontendUrl = await this.waitForServerUrl(
      webcontainer,
      this.devServerProcess,
      layout.frontendPort,
      '🚀 Frontend dev server',
      onProgress,
      45000,
      true
    );

    this.devServerUrl = frontendUrl;
    return frontendUrl;
  }

  /**
   * Install dependencies with progress callback
   */
  public async installDependencies(onProgress?: (message: string) => void): Promise<void> {
    const webcontainer = await this.boot();
    await this.installDependenciesForLayout(webcontainer, onProgress);
  }

  /**
   * Start dev server with progress callback
   */
  private devServerProcess: any = null;
  private devServerUrl: string | null = null;

  public async startDevServer(onProgress?: (message: string) => void): Promise<string> {
    const webcontainer = await this.boot();
    const url = await this.startDevServerForLayout(webcontainer, onProgress);
    console.log('✅ WebContainer server ready:', url);
    return url;
  }

  /**
   * Stop dev server
   */
  async stopDevServer(): Promise<void> {
    if (this.devServerProcess) {
      try {
        this.devServerProcess.kill();
        this.devServerProcess = null;
        this.devServerUrl = null;
        console.log('🛑 Dev server stopped');
      } catch (error) {
        console.warn('Failed to stop dev server:', error);
      }
    }

    if (this.backendServerProcess) {
      try {
        this.backendServerProcess.kill();
        this.backendServerProcess = null;
        console.log('🛑 Backend server stopped');
      } catch (error) {
        console.warn('Failed to stop backend server:', error);
      }
    }
  }

  /**
   * Teardown all instances
   */
  async teardown(): Promise<void> {
    // Stop dev server
    await this.stopDevServer();

    // Stop all instances
    for (const instance of this.instances.values()) {
      try {
        await instance.webcontainer.teardown();
      } catch (error) {
        console.warn('Failed to teardown instance:', error);
      }
    }
    
    // Clear all instances
    this.instances.clear();
    this.bootedInstance = null;
    console.log('🧹 WebContainer teardown complete');
  }
}

// Export singleton instance
export const webContainerService = new WebContainerServiceClass();

// Export type for convenience
export type WebContainerService = WebContainerServiceClass;
