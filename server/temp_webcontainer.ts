import { WebContainer } from '@webcontainer/api';

/**
 * WebContainer Service
 * Manages browser-based Node.js runtime using StackBlitz WebContainer API
 * 
 * Key Features:
 * - Run Node.js directly in browser (no server needed)
 * - npm install packages in browser
 * - Run Vite dev server for instant HMR
 * - Virtual filesystem for generated code
 */

export class WebContainerService {
  private static instance: WebContainerService;
  private webcontainer: WebContainer | null = null;
  private isBooting = false;
  private devServerUrl: string | null = null;
  private devServerProcess: any = null;

  private constructor() {}

  static getInstance(): WebContainerService {
    if (!WebContainerService.instance) {
      WebContainerService.instance = new WebContainerService();
    }
    return WebContainerService.instance;
  }

  /**
   * Initialize WebContainer instance
   * This boots the Node.js runtime in the browser
   */
  async boot(): Promise<WebContainer> {
    if (this.webcontainer) {
      return this.webcontainer;
    }

    if (this.isBooting) {
      // Wait for existing boot to complete
      while (this.isBooting) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      if (this.webcontainer) {
        return this.webcontainer;
      }
    }

    try {
      this.isBooting = true;
      console.log('🚀 Booting WebContainer...');
      
      this.webcontainer = await WebContainer.boot();
      
      console.log('✅ WebContainer booted successfully');
      return this.webcontainer;
    } catch (error) {
      console.error('❌ Failed to boot WebContainer:', error);
      throw error;
    } finally {
      this.isBooting = false;
    }
  }

  /**
   * Write files to the virtual filesystem
   */
  async writeFiles(files: Array<{ path: string; content: string }>): Promise<void> {
    const container = await this.boot();

    console.log(`📝 Writing ${files.length} files to WebContainer...`);

    for (const file of files) {
      const pathParts = file.path.split('/');
      const filename = pathParts.pop()!;
      const directory = pathParts.join('/') || '.';

      // Create directory if needed
      if (directory !== '.') {
        await container.fs.mkdir(directory, { recursive: true });
      }

      // Write file
      // Handle data URIs for binary files (images, etc.)
      let contentToWrite: string | Uint8Array = file.content;
      if (file.content.startsWith('data:')) {
        try {
          // Extract base64 data from data URI
          const base64Match = file.content.match(/^data:[^;]+;base64,(.+)$/);
          if (base64Match) {
            // Convert base64 to binary
            const binaryString = atob(base64Match[1]);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            contentToWrite = bytes;
          }
        } catch (error) {
          console.warn(`Failed to convert data URI for ${file.path}, writing as text:`, error);
          // Fallback: write as text (might not work for binary files)
        }
      }

      await container.fs.writeFile(file.path, contentToWrite);
      console.log(`  ✓ ${file.path}`);
    }

    // Create placeholder images for missing image files
    await this.createMissingPlaceholderImages(container, files);

    console.log('✅ All files written');
  }

  /**
   * Ensure required files exist (index.html, main.tsx, etc.)
   */
  private async ensureRequiredFiles(container: WebContainer, structure: any): Promise<void> {
    const cwd = (structure.isMonorepo && structure.hasClient) ? 'client' : '.';
    
    try {
      // Check for index.html
      let hasIndexHtml = false;
      try {
        await container.fs.readFile(`${cwd}/index.html`, 'utf-8');
        hasIndexHtml = true;
        console.log('✅ index.html found');
      } catch {
        console.warn('⚠️ index.html missing - creating default');
        const defaultIndexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`;
        await container.fs.writeFile(`${cwd}/index.html`, defaultIndexHtml);
        console.log('✅ Created default index.html');
      }
      
      // Check for src/main.tsx
      let hasMainTsx = false;
      try {
        await container.fs.readFile(`${cwd}/src/main.tsx`, 'utf-8');
        hasMainTsx = true;
        console.log('✅ src/main.tsx found');
      } catch {
        console.warn('⚠️ src/main.tsx missing - creating default');
        // Ensure src directory exists
        try {
          await container.fs.mkdir(`${cwd}/src`, { recursive: true });
        } catch {
          // Directory might already exist
        }
        
        // Check if App.tsx exists to import it
        let appImport = "import App from './App';";
        try {
          await container.fs.readFile(`${cwd}/src/App.tsx`, 'utf-8');
        } catch {
          // App.tsx doesn't exist, create a simple one
          appImport = '';
          const defaultApp = `import React from 'react';

export default function App() {
  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>Welcome to your app</h1>
      <p>Edit src/App.tsx to get started.</p>
    </div>
  );
}`;
          await container.fs.writeFile(`${cwd}/src/App.tsx`, defaultApp);
          console.log('✅ Created default src/App.tsx');
        }
        
        const defaultMainTsx = `import React from 'react';
import ReactDOM from 'react-dom/client';
${appImport}
import './index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element not found!');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    ${appImport ? '<App />' : '<div>App component not found. Please create src/App.tsx</div>'}
  </React.StrictMode>
);`;
        await container.fs.writeFile(`${cwd}/src/main.tsx`, defaultMainTsx);
        console.log('✅ Created default src/main.tsx');
      }
      
      // Check for src/index.css
      try {
        await container.fs.readFile(`${cwd}/src/index.css`, 'utf-8');
        console.log('✅ src/index.css found');
      } catch {
        console.warn('⚠️ src/index.css missing - creating default');
        const defaultCss = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: system-ui, -apple-system, sans-serif;
  line-height: 1.5;
}`;
        await container.fs.writeFile(`${cwd}/src/index.css`, defaultCss);
        console.log('✅ Created default src/index.css');
      }
      
    } catch (error) {
      console.error('Failed to ensure required files:', error);
      // Don't throw - let the server start anyway and show errors
    }
  }

  /**
   * Create placeholder images for missing image files referenced in code
   */
  private async createMissingPlaceholderImages(
    container: WebContainer,
    files: Array<{ path: string; content: string }>
  ): Promise<void> {
    try {
      // Collect all image imports from code files
      const imageImports = new Set<string>();
      for (const file of files) {
        if (file.path.endsWith('.jsx') || file.path.endsWith('.js') || file.path.endsWith('.tsx') || file.path.endsWith('.ts')) {
          // Extract image imports using regex
          const imageImportRegex = /import\s+[\w\s,{}]+\s+from\s+['"]([^'"]+\.(jpg|jpeg|png|webp|gif|svg))['"]/gi;
          let match;
          while ((match = imageImportRegex.exec(file.content)) !== null) {
            const importPath = match[1];
            // Resolve relative paths
            const fileDir = file.path.substring(0, file.path.lastIndexOf('/')) || '.';
            const resolvedPath = this.resolveImportPath(importPath, fileDir);
            imageImports.add(resolvedPath);
          }
        }
      }

      // Check which images are missing and create placeholders
      const existingFiles = new Set(files.map(f => f.path));
      for (const imagePath of imageImports) {
        if (!existingFiles.has(imagePath)) {
          await this.createPlaceholderImage(container, imagePath);
          console.log(`  📷 Created placeholder: ${imagePath}`);
        }
      }
    } catch (error) {
      console.warn('Failed to create placeholder images:', error);
    }
  }

  /**
   * Resolve relative import paths to absolute paths
   */
  private resolveImportPath(importPath: string, fromDir: string): string {
    // Remove leading ./
    let path = importPath.replace(/^\.\//, '');
    
    // Handle ../ paths
    if (path.startsWith('../')) {
      const fromParts = fromDir.split('/').filter(p => p && p !== '.');
      const pathParts = path.split('/').filter(p => p);
      
      for (const part of pathParts) {
        if (part === '..') {
          fromParts.pop();
        } else {
          fromParts.push(part);
        }
      }
      
      return fromParts.join('/');
    }
    
    // If fromDir is not root, prepend it
    if (fromDir !== '.' && !path.startsWith(fromDir)) {
      return `${fromDir}/${path}`;
    }
    
    return path;
  }

  /**
   * Create a placeholder image file
   */
  private async createPlaceholderImage(container: WebContainer, imagePath: string): Promise<void> {
    try {
      // Create directory if needed
      const pathParts = imagePath.split('/');
      pathParts.pop(); // Remove filename
      const directory = pathParts.join('/');
      
      if (directory) {
        await container.fs.mkdir(directory, { recursive: true });
      }

      // Generate a simple 1x1 transparent PNG as placeholder
      // PNG header + minimal valid PNG data
      const pngPlaceholder = new Uint8Array([
        0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
        0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, // Width: 1
        0x00, 0x00, 0x00, 0x01, // Height: 1
        0x08, 0x06, 0x00, 0x00, 0x00, // Bit depth, color type, compression, filter, interlace
        0x1F, 0x15, 0xC4, 0x89, // CRC
        0x00, 0x00, 0x00, 0x0A, // IDAT chunk length
        0x49, 0x44, 0x41, 0x54, // IDAT
        0x78, 0x9C, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01, // Compressed data
        0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, // IEND
        0xAE, 0x42, 0x60, 0x82  // CRC
      ]);

      // For other formats, create a minimal valid file
      const ext = imagePath.split('.').pop()?.toLowerCase();
      let placeholderData: Uint8Array;
      
      if (ext === 'svg') {
        // Create a minimal SVG
        const svgContent = '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"></svg>';
        placeholderData = new TextEncoder().encode(svgContent);
      } else if (ext === 'jpg' || ext === 'jpeg') {
        // Minimal valid JPEG (1x1 pixel)
        placeholderData = new Uint8Array([
          0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
          0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
          0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
          0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
          0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
          0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
          0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
          0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
          0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x14, 0x00, 0x01,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x08, 0xFF, 0xC4, 0x00, 0x14, 0x10, 0x01, 0x00, 0x00,
          0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
          0x00, 0x00, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01, 0x00, 0x00, 0x3F, 0x00,
          0x3F, 0xFF, 0xD9
        ]);
      } else {
        // Default to PNG for webp, gif, etc.
        placeholderData = pngPlaceholder;
      }

      await container.fs.writeFile(imagePath, placeholderData);
    } catch (error) {
      console.warn(`Failed to create placeholder image for ${imagePath}:`, error);
    }
  }

  /**
   * Check if client directory exists (helper for structure detection)
   */
  private async checkIfClientDirExists(container: WebContainer): Promise<boolean> {
    try {
      const rootFiles = await container.fs.readdir('.');
      if (rootFiles.includes('client')) {
        const clientFiles = await container.fs.readdir('client');
        return clientFiles.includes('package.json');
      }
      return false;
    } catch {
      return false;
    }
  }

  /**
   * Detect project structure (monorepo vs single package)
   * Uses readdir and readFile with try-catch since WebContainer doesn't have fs.exists()
   */
  private async detectProjectStructure(container: WebContainer): Promise<{
    isMonorepo: boolean;
    hasClient: boolean;
    hasServer: boolean;
    hasRootPackage: boolean;
  }> {
    try {
      // Check root directory for files
      const rootFiles = await container.fs.readdir('.');
      const hasRootPackage = rootFiles.includes('package.json');
      const hasClientDir = rootFiles.includes('client');
      const hasServerDir = rootFiles.includes('server');
      
      // Check if client/package.json exists
      let clientHasPackage = false;
      if (hasClientDir) {
        try {
          const clientFiles = await container.fs.readdir('client');
          clientHasPackage = clientFiles.includes('package.json');
        } catch (error) {
          // client directory might not be readable or doesn't exist
          console.warn('Could not read client directory:', error);
        }
      }
      
      // Check if server/package.json exists
      let serverHasPackage = false;
      if (hasServerDir) {
        try {
          const serverFiles = await container.fs.readdir('server');
          serverHasPackage = serverFiles.includes('package.json');
        } catch (error) {
          // server directory might not be readable or doesn't exist
          console.warn('Could not read server directory:', error);
        }
      }
      
      console.log('📋 Structure detection:', {
        hasRootPackage,
        hasClientDir,
        clientHasPackage,
        hasServerDir,
        serverHasPackage
      });

      // It's a monorepo if:
      // 1. Has client/package.json OR server/package.json (even if root package.json exists)
      // 2. OR has both client/ and server/ directories (typical MERN structure)
      // 3. OR has client/ or server/ directory without root package.json
      // CRITICAL: If both root package.json AND client/package.json exist, it's still a monorepo
      // (root package.json might be for workspace management, but we need client/ for vite)
      const isMonorepo = (hasClientDir && clientHasPackage) || 
                        (hasServerDir && serverHasPackage) ||
                        (hasClientDir && hasServerDir) ||
                        ((hasClientDir || hasServerDir) && !hasRootPackage);
      
      // If we have both root and client/package.json, prioritize client/ for vite
      // This handles cases where root package.json exists but client/ is the actual frontend
      if (hasRootPackage && hasClientDir && clientHasPackage) {
        console.log('📋 Detected: Root package.json exists, but client/package.json also exists - treating as monorepo');
      }

      console.log('📋 Detected structure:', {
        isMonorepo,
        hasClient: hasClientDir && clientHasPackage,
        hasServer: hasServerDir && serverHasPackage,
        hasRootPackage
      });

      return {
        isMonorepo,
        hasClient: hasClientDir && clientHasPackage,
        hasServer: hasServerDir && serverHasPackage,
        hasRootPackage
      };
    } catch (error) {
      console.warn('Failed to detect project structure:', error);
      return {
        isMonorepo: false,
        hasClient: false,
        hasServer: false,
        hasRootPackage: false
      };
    }
  }

  /**
   * Install npm dependencies
   * Handles both single-package and monorepo structures
   */
  async installDependencies(onProgress?: (message: string) => void): Promise<void> {
    const container = await this.boot();

    console.log('📦 Installing npm dependencies...');
    onProgress?.('Detecting project structure...');

    // Detect project structure
    const structure = await this.detectProjectStructure(container);
    console.log('📋 Project structure:', structure);

    if (structure.isMonorepo) {
      // For monorepo, ALWAYS install client dependencies first (frontend is critical for preview)
      // Even if hasClient is false, if we detected client/ directory, try to install anyway
      const shouldInstallClient = structure.hasClient || (structure.isMonorepo && await this.checkIfClientDirExists(container));
      
      if (shouldInstallClient) {
        console.log('📦 Installing client dependencies...');
        onProgress?.('Installing client dependencies...');

        const clientInstall = await container.spawn('npm', ['install'], {
          cwd: 'client'
        });

        let errorOutput = '';

        clientInstall.output.pipeTo(
          new WritableStream({
            write(data) {
              const text = data.trim();
              if (text) {
                console.log(`  [client] ${text}`);
                onProgress?.(text);
                if (text.includes('ERR') || text.includes('error')) {
                  errorOutput += text + '\n';
                }
              }
            },
          })
        );

        const clientExitCode = await clientInstall.exit;

        if (clientExitCode !== 0) {
          const errorMsg = errorOutput || 'Client npm install failed';
          console.error('❌ Client npm install error:', errorMsg);
          throw new Error(`Client npm install failed: ${errorMsg.slice(0, 200)}`);
        }

        console.log('✅ Client dependencies installed');
        onProgress?.('✅ Client dependencies installed');
      }

      // For MERN projects, we typically only need client for WebContainer preview
      // Server can run separately if needed, but we can optionally install server deps too
      if (structure.hasServer) {
        console.log('📦 Installing server dependencies...');
        onProgress?.('Installing server dependencies...');

        const serverInstall = await container.spawn('npm', ['install'], {
          cwd: 'server'
        });

        let errorOutput = '';

        serverInstall.output.pipeTo(
          new WritableStream({
            write(data) {
              const text = data.trim();
              if (text) {
                console.log(`  [server] ${text}`);
                onProgress?.(text);
                if (text.includes('ERR') || text.includes('error')) {
                  errorOutput += text + '\n';
                }
              }
            },
          })
        );

        const serverExitCode = await serverInstall.exit;

        if (serverExitCode !== 0) {
          // Don't fail completely if server install fails - client is more important for preview
          console.warn('⚠️ Server npm install had errors (non-critical for preview):', errorOutput);
          onProgress?.('⚠️ Server dependencies had issues (non-critical)');
        } else {
          console.log('✅ Server dependencies installed');
          onProgress?.('✅ Server dependencies installed');
        }
      }

      console.log('✅ Monorepo dependencies installed');
      onProgress?.('✅ Dependencies installed');
    } else {
      // Single package.json in root
      console.log('📦 Installing root dependencies...');
      onProgress?.('Installing npm dependencies...');

      const installProcess = await container.spawn('npm', ['install']);

      let errorOutput = '';

      // Stream stdout and stderr
      installProcess.output.pipeTo(
        new WritableStream({
          write(data) {
            const text = data.trim();
            if (text) {
              console.log(`  ${text}`);
              onProgress?.(text);
              if (text.includes('ERR') || text.includes('error')) {
                errorOutput += text + '\n';
              }
            }
          },
        })
      );

      const exitCode = await installProcess.exit;

      if (exitCode !== 0) {
        const errorMsg = errorOutput || 'npm install failed (check console for details)';
        console.error('❌ npm install error:', errorMsg);
        throw new Error(`npm install failed: ${errorMsg.slice(0, 200)}`);
      }

      console.log('✅ Dependencies installed');
      onProgress?.('✅ Dependencies installed');
    }
  }

  /**
   * Start Vite dev server
   * Handles both single-package and monorepo structures
   */
  async startDevServer(onProgress?: (message: string) => void): Promise<string> {
    const container = await this.boot();

    // Stop existing server if running
    if (this.devServerProcess) {
      console.log('🛑 Stopping existing dev server...');
      this.devServerProcess.kill();
      this.devServerProcess = null;
      this.devServerUrl = null;
    }

    // Detect project structure
    const structure = await this.detectProjectStructure(container);
    
    // Verify and create required files before starting server
    await this.ensureRequiredFiles(container, structure);
    
    // Check if client/package.json exists (even if structure detection didn't find it)
    let hasClientPackage = structure.hasClient;
    if (!hasClientPackage && structure.isMonorepo) {
      try {
        const clientFiles = await container.fs.readdir('client');
        hasClientPackage = clientFiles.includes('package.json');
        if (hasClientPackage) {
          console.log('📋 Found client/package.json - will use client/ for vite');
        }
      } catch {
        // client directory doesn't exist or can't be read
      }
    }
    
    // Determine working directory and command
    let cwd = '.';
    // CRITICAL: Use npx vite directly instead of npm run dev
    // This ensures vite is found even if node_modules/.bin is not in PATH
    // npx will automatically find vite in node_modules/.bin
    let command: string[] = [];
    let useNpx = false;
    
    // For monorepo, prioritize client/ directory for vite
    if (structure.isMonorepo && hasClientPackage) {
      // For monorepo, run dev server from client/ directory
      cwd = 'client';
      console.log('🚀 Starting Vite dev server in client/...');
      onProgress?.('Starting dev server in client/...');
      // Use npx vite directly - more reliable than npm run dev
      command = ['npx', 'vite'];
      useNpx = true;
    } else if (structure.isMonorepo && !hasClientPackage) {
      // Monorepo but no client/package.json - check if root has vite
      console.log('⚠️ Monorepo detected but no client/package.json - trying root package.json');
      cwd = '.';
      console.log('🚀 Starting Vite dev server from root...');
      onProgress?.('Starting dev server from root...');
      // Use npx vite directly
      command = ['npx', 'vite'];
      useNpx = true;
    } else {
      console.log('🚀 Starting Vite dev server...');
      onProgress?.('Starting dev server...');
      // For single-package, try npx vite first, fallback to npm run dev
      command = ['npx', 'vite'];
      useNpx = true;
    }
    
    // Verify package.json exists and has dev script
    try {
      const packageJsonPath = (structure.isMonorepo && hasClientPackage)
        ? 'client/package.json' 
        : 'package.json';
      const packageJsonContent = await container.fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);
      
      if (!packageJson.scripts || !packageJson.scripts.dev) {
        throw new Error(`No "dev" script found in ${packageJsonPath}`);
      }
      
      // Check if vite is in dependencies or devDependencies
      const hasVite = packageJson.dependencies?.vite || packageJson.devDependencies?.vite;
      if (!hasVite) {
        console.warn('⚠️ Vite not found in package.json dependencies. Make sure dependencies are installed.');
        onProgress?.('⚠️ Vite not found in package.json - attempting to install...');
        
        // Try to install vite if missing
        try {
          const installVite = await container.spawn('npm', ['install', 'vite', '@vitejs/plugin-react', '--save-dev'], { cwd });
          let installOutput = '';
          installVite.output.pipeTo(
            new WritableStream({
              write: (data) => {
                const text = data.trim();
                if (text) {
                  installOutput += text + '\n';
                  console.log(`  [vite-install] ${text}`);
                }
              },
            })
          );
          const installExitCode = await installVite.exit;
          
          if (installExitCode !== 0) {
            console.warn('⚠️ Failed to auto-install vite:', installOutput);
          } else {
            console.log('✅ Installed vite and @vitejs/plugin-react');
            onProgress?.('✅ Installed vite dependencies');
          }
        } catch (installError) {
          console.warn('Failed to auto-install vite:', installError);
        }
      } else {
        // Verify vite is actually installed in node_modules
        const nodeModulesPath = (structure.isMonorepo && hasClientPackage)
          ? 'client/node_modules/vite/package.json' 
          : 'node_modules/vite/package.json';
        
        try {
          await container.fs.readFile(nodeModulesPath, 'utf-8');
          console.log('✅ Vite is installed in node_modules');
        } catch {
          console.warn('⚠️ Vite not found in node_modules, dependencies may not be installed. Running npm install...');
          onProgress?.('⚠️ Vite missing from node_modules - reinstalling dependencies...');
          
          // Re-run npm install to ensure vite is installed
          const reinstall = await container.spawn('npm', ['install'], { cwd });
          let reinstallOutput = '';
          reinstall.output.pipeTo(
            new WritableStream({
              write: (data) => {
                const text = data.trim();
                if (text) {
                  reinstallOutput += text + '\n';
                  console.log(`  [reinstall] ${text}`);
                }
              },
            })
          );
          const reinstallExitCode = await reinstall.exit;
          
          if (reinstallExitCode !== 0) {
            console.error('❌ Reinstall failed:', reinstallOutput);
            throw new Error('Failed to install dependencies. Please check package.json and try again.');
          }
          
          console.log('✅ Dependencies reinstalled');
          onProgress?.('✅ Dependencies reinstalled');
        }
      }
    } catch (error) {
      console.warn('Could not verify package.json:', error);
      // Continue anyway - npm will show the error
    }

    // Use WebContainer's server-ready event (more reliable than parsing output)
    // Track if we've already captured the frontend URL to avoid backend overwriting it
    let frontendUrlCaptured = false;
    const serverReadyPromise = new Promise<string>((resolve) => {
      container.on('server-ready', (port, url) => {
        console.log(`🌐 Server listening on port ${port}: ${url}`);
        
        // Only capture first server-ready (frontend on port 5173 or similar)
        // Backend typically runs on 3001, 3000, etc.
        // Frontend (vite) runs on 5173, 5174, etc.
        const isFrontendPort = port >= 5000 && port <= 6000;
        const isBackendPort = port >= 3000 && port < 5000;
        
        if (!frontendUrlCaptured) {
          if (isFrontendPort || !isBackendPort) {
            // This is the frontend server
            this.devServerUrl = url;
            frontendUrlCaptured = true;
            onProgress?.(`✅ Dev server ready: ${url}`);
            resolve(url);
          } else {
            // This might be backend starting before frontend, wait for frontend
            console.log(`⏳ Server on port ${port} detected (likely backend) - waiting for frontend...`);
          }
        } else {
          // Frontend already captured, this is the backend
          console.log(`📡 Backend server detected on port ${port}`);
          onProgress?.(`📡 Backend running on port ${port}`);
        }
      });
    });

    // Start dev server
    // Use npx vite directly for better reliability, or npm run dev as fallback
    if (useNpx) {
      console.log(`📦 Running: npx vite in ${cwd}`);
      this.devServerProcess = await container.spawn('npx', ['vite'], {
        cwd
      });
    } else {
      console.log(`📦 Running: npm run dev in ${cwd}`);
      this.devServerProcess = await container.spawn('npm', ['run', 'dev'], {
        cwd
      });
    }

    // Stream output for debugging
    this.devServerProcess.output.pipeTo(
      new WritableStream({
        write: (data) => {
          const text = data.trim();
          if (text) {
            console.log(`  [vite] ${text}`);
            onProgress?.(text);
          }
        },
      })
    );

    // Wait for server to be ready (with increased timeout for slower systems)
    // Increased to 120 seconds to account for:
    // - npm install may take time
    // - Vite compilation on first start
    // - WebContainer initialization overhead
    const timeoutPromise = new Promise<string>((_, reject) => {
      setTimeout(() => reject(new Error('Dev server failed to start within 120 seconds. This may indicate that dependencies are not installed correctly or vite is missing from node_modules.')), 120000);
    });

    this.devServerUrl = await Promise.race([serverReadyPromise, timeoutPromise]);
    
    // After frontend server starts, check if backend exists and start it automatically
    await this.startBackendServerIfExists(onProgress);
    
    return this.devServerUrl;
  }

  /**
   * Start backend server if server/ directory exists
   */
  private async startBackendServerIfExists(onProgress?: (message: string) => void): Promise<void> {
    const container = await this.boot();
    const structure = await this.detectProjectStructure(container);
    
    if (!structure.hasServer) {
      console.log('📋 No backend server detected - skipping backend startup');
      return;
    }
    
    try {
      // Check if server/index.js exists
      const serverFiles = await container.fs.readdir('server');
      const hasServerIndex = serverFiles.includes('index.js') || serverFiles.includes('server.js');
      
      if (!hasServerIndex) {
        console.log('📋 No server/index.js found - skipping backend startup');
        return;
      }
      
      // Check if server/package.json has dev script
      const serverPackageJsonPath = 'server/package.json';
      let hasDevScript = false;
      try {
        const serverPackageJsonContent = await container.fs.readFile(serverPackageJsonPath, 'utf-8');
        const serverPackageJson = JSON.parse(serverPackageJsonContent);
        hasDevScript = serverPackageJson.scripts?.dev || serverPackageJson.scripts?.start;
      } catch {
        console.warn('Could not read server/package.json');
      }
      
      if (!hasDevScript) {
        console.log('📋 No dev/start script in server/package.json - skipping backend startup');
        return;
      }
      
      console.log('🚀 Starting backend server in server/...');
      onProgress?.('Starting backend server...');
      
      // Start backend server
      const backendProcess = await container.spawn('npm', ['run', 'dev'], {
        cwd: 'server'
      });
      
      // Stream output for debugging
      backendProcess.output.pipeTo(
        new WritableStream({
          write: (data) => {
            const text = data.trim();
            if (text) {
              console.log(`  [server] ${text}`);
              onProgress?.(`[Backend] ${text}`);
            }
          },
        })
      );
      
      // Wait a bit for server to start (backend doesn't emit server-ready event)
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('✅ Backend server started');
      onProgress?.('✅ Backend server running');
    } catch (error) {
      console.warn('⚠️ Failed to start backend server:', error);
      onProgress?.('⚠️ Backend server startup failed (non-critical)');
      // Non-critical - frontend can still work without backend
    }
  }

  /**
   * Get current dev server URL
   */
  getDevServerUrl(): string | null {
    return this.devServerUrl;
  }

  /**
   * Stop dev server
   */
  async stopDevServer(): Promise<void> {
    if (this.devServerProcess) {
      console.log('🛑 Stopping dev server...');
      this.devServerProcess.kill();
      this.devServerProcess = null;
      this.devServerUrl = null;
      console.log('✅ Dev server stopped');
    }
  }

  /**
   * Read a file from the virtual filesystem
   */
  async readFile(path: string): Promise<string> {
    const container = await this.boot();
    const content = await container.fs.readFile(path, 'utf-8');
    return content;
  }

  /**
   * List files in a directory
   */
  async listFiles(path: string = '.'): Promise<string[]> {
    const container = await this.boot();
    const files = await container.fs.readdir(path);
    return files;
  }

  /**
   * Check if WebContainer is supported
   */
  static isSupported(): boolean {
    try {
      // WebContainer requires SharedArrayBuffer and cross-origin isolation
      return typeof SharedArrayBuffer !== 'undefined';
    } catch {
      return false;
    }
  }

  /**
   * Get WebContainer instance (if booted)
   */
  getContainer(): WebContainer | null {
    return this.webcontainer;
  }

  /**
   * Execute a command in WebContainer
   * Returns output lines as they come in via callback
   */
  async executeCommand(
    command: string,
    args: string[] = [],
    options: { cwd?: string; onOutput?: (line: string) => void } = {}
  ): Promise<{ exitCode: number; output: string[] }> {
    const container = await this.boot();
    const output: string[] = [];

    console.log(`📦 Executing: ${command} ${args.join(' ')} in ${options.cwd || '.'}`);

    const process = await container.spawn(command, args, {
      cwd: options.cwd || '.',
    });

    // Collect output
    const outputPromise = new Promise<void>((resolve) => {
      process.output.pipeTo(
        new WritableStream({
          write: (data) => {
            const lines = data.split('\n').filter((l: string) => l.trim());
            lines.forEach((line: string) => {
              output.push(line);
              options.onOutput?.(line);
            });
          },
          close: () => resolve(),
        })
      );
    });

    // Wait for process to complete
    const exitCode = await process.exit;
    await outputPromise;

    console.log(`✅ Command completed with exit code: ${exitCode}`);
    return { exitCode, output };
  }

  /**
   * Check if WebContainer is booted
   */
  isBooted(): boolean {
    return this.webcontainer !== null;
  }

  /**
   * Teardown WebContainer
   */
  async teardown(): Promise<void> {
    if (this.devServerProcess) {
      await this.stopDevServer();
    }
    
    if (this.webcontainer) {
      console.log('🧹 Tearing down WebContainer...');
      await this.webcontainer.teardown();
      this.webcontainer = null;
      console.log('✅ WebContainer torn down');
    }
  }
}

// Export singleton instance
export const webContainerService = WebContainerService.getInstance();

// Check support on module load
if (!WebContainerService.isSupported()) {
  console.warn('⚠️ WebContainer is not supported in this browser');
  console.warn('   Required: SharedArrayBuffer and cross-origin isolation');
  console.warn('   See: https://webcontainers.io/guides/browser-support');
}
