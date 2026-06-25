import { SimpleLogger } from '../utils/SimpleLogger';
import Anthropic from '@anthropic-ai/sdk';

const logger = new SimpleLogger('FullstackIntegrationService');

export interface FullstackConfig {
  needsBackend: boolean;
  backendType: 'express' | 'fastify' | 'none';
  apiEndpoints: string[];
  frontendApiUrl: string;
  backendPort: number;
  corsEnabled: boolean;
  databaseType?: 'mongodb' | 'postgresql' | 'mysql' | 'none';
  requiredApiKeys?: string[]; // API keys required by the backend (e.g., ['OPENAI_API_KEY', 'ANTHROPIC_API_KEY'])
  features?: {
    auth: boolean;
    uploads: boolean;
    persistence: boolean;
  };
}

export interface IntegrationCheck {
  isValid: boolean;
  issues: string[];
  fixes: string[];
  config: FullstackConfig;
}

export class FullstackIntegrationService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY || ''
    });
  }

  /**
   * Detect if a fullstack application is needed based on user prompt
   */
  public async detectFullstackNeeds(
    userPrompt: string,
    files: Array<{ path: string; content: string }>
  ): Promise<FullstackConfig> {
    const promptLower = userPrompt.toLowerCase();
    const features = this.detectFeatureFlags(promptLower);
    
    // Keywords that indicate backend is needed
    const backendKeywords = [
      'backend', 'server', 'api', 'database', 'db', 'mongodb', 'postgres', 'mysql',
      'express', 'node', 'rest', 'endpoint', 'route', 'authentication', 'auth',
      'login', 'register', 'user', 'save', 'store', 'persist', 'fetch data',
      'crud', 'create', 'read', 'update', 'delete', 'fullstack', 'full stack',
      'mern', 'mean', 'mevn', 'serverless', 'lambda', 'firebase', 'supabase',
      'upload', 'uploads', 'file', 'files', 'image', 'images', 'photo', 'photos',
      'media', 'attachment', 'avatar', 'storage', 'account', 'profile', 'member',
      'backend', 'databas', 'server', 'api', 'autentisering', 'inloggning',
      'logga in', 'registrera', 'skapa konto', 'användare', 'anvandare',
      'konto', 'profil', 'medlem', 'spara', 'lagra', 'ladda upp', 'uppladdning',
      'fil', 'filer', 'bild', 'bilder', 'foto', 'foton', 'bilaga'
    ];

    const needsBackend =
      backendKeywords.some(keyword => promptLower.includes(keyword)) ||
      features.auth ||
      features.uploads ||
      features.persistence;

    // Check existing files for backend indicators
    const hasBackendFiles = files.some(f => 
      f.path.includes('server') ||
      f.path.includes('backend') ||
      f.path.includes('api') ||
      f.path.includes('routes') ||
      f.path.includes('express') ||
      f.path.includes('app.js') ||
      f.path.includes('server.js') ||
      f.path.includes('index.js') && f.content.includes('express')
    );

    // Use AI to analyze if backend is needed
    let aiAnalysis: { needsBackend: boolean; backendType: 'express' | 'fastify' | 'none' } = { 
      needsBackend: false, 
      backendType: 'none' 
    };
    if (needsBackend || hasBackendFiles) {
      aiAnalysis = await this.analyzeWithAI(userPrompt, files);
    }

    const detectedNeedsBackend = needsBackend || hasBackendFiles || aiAnalysis.needsBackend;

    // Detect API endpoints from prompt
    const apiEndpoints = this.detectAPIEndpoints(userPrompt, files);

    // Detect database type
    const databaseType = this.detectDatabaseType(files, userPrompt);

    // Detect required API keys from prompt
    const requiredApiKeys = this.detectRequiredAPIKeys(userPrompt);

    return {
      needsBackend: detectedNeedsBackend,
      backendType: detectedNeedsBackend ? (aiAnalysis.backendType || 'express') : 'none',
      apiEndpoints,
      frontendApiUrl: 'http://localhost:3001', // Default backend URL
      backendPort: 3001,
      corsEnabled: true,
      databaseType,
      requiredApiKeys,
      features
    };
  }

  private detectFeatureFlags(promptLower: string): NonNullable<FullstackConfig['features']> {
    const hasAny = (terms: string[]) => terms.some(term => promptLower.includes(term));

    const auth = hasAny([
      'auth', 'authentication', 'login', 'log in', 'sign in', 'signin',
      'register', 'sign up', 'signup', 'account', 'profile', 'member', 'user',
      'inloggning', 'logga in', 'registrera', 'skapa konto', 'konto', 'profil',
      'medlem', 'användare', 'anvandare'
    ]);

    const uploads = hasAny([
      'upload', 'uploads', 'file upload', 'file', 'files', 'image', 'images',
      'photo', 'photos', 'media', 'attachment', 'avatar', 'storage',
      'ladda upp', 'uppladdning', 'fil', 'filer', 'bild', 'bilder', 'foto',
      'foton', 'media', 'bilaga', 'lagring'
    ]);

    const persistence = hasAny([
      'database', 'db', 'save', 'store', 'persist', 'crud', 'create', 'read',
      'update', 'delete', 'mongodb', 'postgres', 'mysql', 'firebase', 'supabase',
      'databas', 'spara', 'lagra', 'beständig', 'permanent'
    ]);

    return { auth, uploads, persistence };
  }

  /**
   * Detect required API keys from user prompt
   */
  private detectRequiredAPIKeys(prompt: string): string[] {
    const promptLower = prompt.toLowerCase();
    const requiredKeys: string[] = [];

    // OpenAI
    if (promptLower.includes('openai') || promptLower.includes('gpt') || 
        (promptLower.includes('chatbot') && promptLower.includes('openai')) ||
        (promptLower.includes('chat') && promptLower.includes('gpt'))) {
      requiredKeys.push('OPENAI_API_KEY');
    }

    // Anthropic/Claude
    if (promptLower.includes('anthropic') || promptLower.includes('claude') ||
        (promptLower.includes('chatbot') && promptLower.includes('claude'))) {
      requiredKeys.push('ANTHROPIC_API_KEY');
    }

    // Hugging Face
    if (promptLower.includes('hugging face') || promptLower.includes('huggingface') ||
        promptLower.includes('transformers')) {
      requiredKeys.push('HUGGINGFACE_API_KEY');
    }

    // Stripe
    if (promptLower.includes('stripe') || promptLower.includes('payment')) {
      requiredKeys.push('STRIPE_SECRET_KEY');
    }

    // GitHub
    if (promptLower.includes('github') && (promptLower.includes('api') || promptLower.includes('integration'))) {
      requiredKeys.push('GITHUB_TOKEN');
    }

    return [...new Set(requiredKeys)]; // Remove duplicates
  }

  /**
   * Use AI to analyze if backend is needed
   */
  private async analyzeWithAI(
    userPrompt: string,
    files: Array<{ path: string; content: string }>
  ): Promise<{ needsBackend: boolean; backendType: 'express' | 'fastify' | 'none' }> {
    try {
      const relevantFiles = files
        .slice(0, 5)
        .map(f => `${f.path}: ${f.content.substring(0, 500)}`)
        .join('\n\n');

      const prompt = `Analyze this user request and determine if a backend server is needed:

User Request: "${userPrompt}"

Existing Files:
${relevantFiles || 'No files yet'}

Does this application need:
1. A backend server (Express/Node.js)?
2. API endpoints?
3. Database integration?
4. User authentication?
5. Data persistence beyond localStorage?
6. File/image uploads, media storage, or user-generated files?

Treat Swedish requests such as "skapa användare", "logga in", "ladda upp bilder",
"ladda upp filer", "spara", and "databas" as backend signals.

Respond with JSON:
{
  "needsBackend": true/false,
  "backendType": "express" | "fastify" | "none",
  "reason": "brief explanation"
}`;

      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 300,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const text = response.content[0]?.type === 'text' ? response.content[0].text : '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const analysis = JSON.parse(jsonMatch[0]);
        return {
          needsBackend: analysis.needsBackend || false,
          backendType: analysis.backendType || 'express'
        };
      }
    } catch (error) {
      logger.warn('AI fullstack analysis failed', error as Error);
    }

    return { needsBackend: false, backendType: 'none' };
  }

  /**
   * Detect API endpoints from prompt and files
   */
  private detectAPIEndpoints(
    userPrompt: string,
    files: Array<{ path: string; content: string }>
  ): string[] {
    const endpoints: string[] = [];
    const promptLower = userPrompt.toLowerCase();
    const features = this.detectFeatureFlags(promptLower);

    // Common endpoint patterns
    if (promptLower.includes('todo') || promptLower.includes('task')) {
      endpoints.push('/api/todos', '/api/todos/:id');
    }
    if (features.auth) {
      endpoints.push('/api/auth/login', '/api/auth/register', '/api/auth/me', '/api/users');
    }
    if (features.uploads) {
      endpoints.push('/api/uploads', '/api/uploads/:id');
    }
    if (promptLower.includes('product') || promptLower.includes('shop') || promptLower.includes('ecommerce')) {
      endpoints.push('/api/products', '/api/products/:id', '/api/cart');
    }
    if (promptLower.includes('post') || promptLower.includes('blog')) {
      endpoints.push('/api/posts', '/api/posts/:id');
    }

    // Extract from existing files
    for (const file of files) {
      if (file.path.includes('server') || file.path.includes('api') || file.path.includes('routes')) {
        const content = file.content;
        const routeMatches = content.matchAll(/app\.(get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g);
        for (const match of routeMatches) {
          endpoints.push(match[2]);
        }
      }
    }

    return [...new Set(endpoints)]; // Remove duplicates
  }

  /**
   * Detect database type from files
   */
  private detectDatabaseType(
    files: Array<{ path: string; content: string }>,
    userPrompt: string = ''
  ): 'mongodb' | 'postgresql' | 'mysql' | 'none' {
    const promptLower = userPrompt.toLowerCase();
    if (promptLower.includes('mongodb') || promptLower.includes('mongo')) {
      return 'mongodb';
    }
    if (promptLower.includes('postgres') || promptLower.includes('postgresql')) {
      return 'postgresql';
    }
    if (promptLower.includes('mysql')) {
      return 'mysql';
    }

    for (const file of files) {
      const content = file.content.toLowerCase();
      if (content.includes('mongoose') || content.includes('mongodb')) {
        return 'mongodb';
      }
      if (content.includes('pg') || content.includes('postgres') || content.includes('sequelize')) {
        return 'postgresql';
      }
      if (content.includes('mysql') || content.includes('mysql2')) {
        return 'mysql';
      }
    }
    return 'none';
  }

  /**
   * Validate integration between frontend and backend
   */
  public validateIntegration(
    frontendFiles: Array<{ path: string; content: string }>,
    backendFiles: Array<{ path: string; content: string }>,
    config: FullstackConfig
  ): IntegrationCheck {
    const issues: string[] = [];
    const fixes: string[] = [];

    if (!config.needsBackend) {
      return {
        isValid: true,
        issues: [],
        fixes: [],
        config
      };
    }

    // Check if backend files exist
    const hasBackendFiles = backendFiles.some(f => 
      f.path.includes('server') || 
      f.path.includes('backend') ||
      f.path.includes('api') ||
      f.path.includes('express')
    );

    if (!hasBackendFiles) {
      issues.push('Backend files are missing');
      fixes.push('Generate backend server files (server/index.js, server/routes.js)');
    }

    // Check if frontend has API calls
    const frontendHasApiCalls = frontendFiles.some(f => {
      const content = f.content.toLowerCase();
      return content.includes('fetch(') || 
             content.includes('axios') || 
             content.includes('api.') ||
             content.includes('api/') ||
             content.includes('localhost:');
    });

    if (!frontendHasApiCalls && config.apiEndpoints.length > 0) {
      issues.push('Frontend is not calling backend API endpoints');
      fixes.push('Add fetch/axios calls in frontend to connect to backend');
    }

    // Check CORS configuration
    const hasCors = backendFiles.some(f => {
      const content = f.content.toLowerCase();
      return content.includes('cors') || 
             content.includes('access-control-allow-origin');
    });

    if (!hasCors) {
      issues.push('CORS is not configured in backend');
      fixes.push('Add CORS middleware to backend (app.use(cors()))');
    }

    // Check API URL configuration
    const hasApiUrl = frontendFiles.some(f => {
      const content = f.content;
      return content.includes('API_URL') || 
             content.includes('apiUrl') ||
             content.includes('localhost:3001') ||
             content.includes('VITE_API_URL');
    });

    if (!hasApiUrl) {
      issues.push('Frontend does not have API URL configured');
      fixes.push('Add API_URL constant in frontend (use environment variable VITE_API_URL)');
    }

    // Check if endpoints match
    const backendEndpoints = this.extractBackendEndpoints(backendFiles);
    
    const missingEndpoints = config.apiEndpoints.filter(endpoint => 
      !backendEndpoints.some(be => be.includes(endpoint.replace('/api/', '')))
    );

    if (missingEndpoints.length > 0) {
      issues.push(`Backend is missing endpoints: ${missingEndpoints.join(', ')}`);
      fixes.push(`Generate backend routes for: ${missingEndpoints.join(', ')}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      fixes,
      config
    };
  }

  /**
   * Extract API endpoints from frontend files
   */
  private extractFrontendEndpoints(files: Array<{ path: string; content: string }>): string[] {
    const endpoints: string[] = [];
    
    for (const file of files) {
      const content = file.content;
      // Match fetch('/api/...') or axios.get('/api/...')
      const matches = content.matchAll(/(?:fetch|axios\.(?:get|post|put|delete|patch))\(['"`]([^'"`]+)['"`]/g);
      for (const match of matches) {
        endpoints.push(match[1]);
      }
    }

    return [...new Set(endpoints)];
  }

  /**
   * Extract API endpoints from backend files
   */
  private extractBackendEndpoints(files: Array<{ path: string; content: string }>): string[] {
    const endpoints: string[] = [];
    
    for (const file of files) {
      const content = file.content;
      // Match app.get('/api/...') or router.post('/api/...')
      const matches = content.matchAll(/(?:app|router)\.(?:get|post|put|delete|patch)\(['"`]([^'"`]+)['"`]/g);
      for (const match of matches) {
        endpoints.push(match[1]);
      }
    }

    return [...new Set(endpoints)];
  }

  /**
   * Generate backend server files
   * Also ensures client/package.json exists for monorepo structure
   */
  public generateBackendFiles(
    config: FullstackConfig,
    existingFiles: Array<{ path: string; content: string }> = []
  ): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];

    // Generate server/index.js
    const serverContent = this.generateServerFile(config);
    files.push({
      path: 'server/index.js',
      content: serverContent
    });

    // Generate server/routes.js with API endpoints
    const routesContent = this.generateRoutesFile(config);
    files.push({
      path: 'server/routes.js',
      content: routesContent
    });

    // Generate package.json for backend
    const packageJson = this.generateBackendPackageJson(config);
    files.push({
      path: 'server/package.json',
      content: packageJson
    });

    // Generate .env.example for backend
    const envExample = this.generateBackendEnvExample(config);
    files.push({
      path: 'server/.env.example',
      content: envExample
    });

    // CRITICAL: Ensure client/package.json exists for monorepo structure
    // This ensures vite command works in WebContainer
    const hasClientPackageJson = existingFiles.some(f => f.path === 'client/package.json');
    const hasRootPackageJson = existingFiles.some(f => f.path === 'package.json' && !f.path.includes('/'));
    
    if (!hasClientPackageJson) {
      // Check if root package.json exists - if so, we'll move it to client/ or create a new one
      let clientPackageJson: string;
      
      if (hasRootPackageJson) {
        // Try to use root package.json as base, but ensure it has vite config
        const rootPackageJsonFile = existingFiles.find(f => f.path === 'package.json');
        if (rootPackageJsonFile) {
          try {
            const rootPkg = JSON.parse(rootPackageJsonFile.content);
            // Ensure it has vite in devDependencies and dev script
            if (!rootPkg.devDependencies) rootPkg.devDependencies = {};
            if (!rootPkg.devDependencies.vite) rootPkg.devDependencies.vite = '^7.1.7';
            if (!rootPkg.devDependencies['@vitejs/plugin-react']) {
              rootPkg.devDependencies['@vitejs/plugin-react'] = '^5.0.0';
            }
            if (!rootPkg.scripts) rootPkg.scripts = {};
            if (!rootPkg.scripts.dev) rootPkg.scripts.dev = 'vite';
            if (!rootPkg.scripts.build) rootPkg.scripts.build = 'vite build';
            if (!rootPkg.scripts.preview) rootPkg.scripts.preview = 'vite preview';
            clientPackageJson = JSON.stringify(rootPkg, null, 2);
          } catch {
            // If parsing fails, create new one
            clientPackageJson = this.generateClientPackageJson();
          }
        } else {
          clientPackageJson = this.generateClientPackageJson();
        }
      } else {
        // Create new client/package.json
        clientPackageJson = this.generateClientPackageJson();
      }
      
      files.push({
        path: 'client/package.json',
        content: clientPackageJson
      });
      
      logger.info('Generated client/package.json for monorepo structure');
    }

    // Also ensure client/vite.config.ts exists
    const hasClientViteConfig = existingFiles.some(f => f.path === 'client/vite.config.ts');
    if (!hasClientViteConfig) {
      files.push({
        path: 'client/vite.config.ts',
        content: this.generateClientViteConfig()
      });
    }

    return files;
  }

  /**
   * Generate client/package.json for monorepo structure
   */
  private generateClientPackageJson(): string {
    return JSON.stringify({
      name: 'client',
      version: '0.1.0',
      type: 'module',
      private: true,
      scripts: {
        dev: 'vite',
        build: 'vite build',
        preview: 'vite preview'
      },
      dependencies: {
        react: '^18.3.1',
        'react-dom': '^18.3.1'
      },
      devDependencies: {
        '@types/react': '^18.3.18',
        '@types/react-dom': '^18.3.5',
        '@vitejs/plugin-react': '^5.0.0',
        typescript: '^5.7.2',
        vite: '^7.1.7'
      }
    }, null, 2);
  }

  /**
   * Generate client/vite.config.ts for monorepo structure
   */
  private generateClientViteConfig(): string {
    return `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true
  }
});
`;
  }

  /**
   * Generate server/index.js
   */
  private generateServerFile(config: FullstackConfig): string {
    const hasUploads = this.hasUploadEndpoints(config);

    return `import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
${hasUploads ? `import { fileURLToPath } from 'url';
import path from 'path';
` : ''}import routes from './routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || ${config.backendPort};
${hasUploads ? `const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, 'uploads');
` : ''}

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:5173',
  'http://127.0.0.1:5173'
].filter(Boolean);

// Middleware
app.use(cors({
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin) || origin.endsWith('.webcontainer-api.io')) {
      return callback(null, true);
    }
    return callback(null, true);
  },
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
${hasUploads ? `app.use('/uploads', express.static(uploadDir));
` : ''}

// Routes
app.use('/api', routes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(\`🚀 Server running on http://localhost:\${PORT}\`);
  console.log(\`📡 API available at http://localhost:\${PORT}/api\`);
});

export default app;`;
  }

  /**
   * Generate server/routes.js
   */
  private generateRoutesFile(config: FullstackConfig): string {
    const hasAuth = this.hasAuthEndpoints(config);
    const hasUploads = this.hasUploadEndpoints(config);
    const handledPaths = new Set<string>();
    const imports = [`import express from 'express';`];

    if (hasAuth || hasUploads) {
      imports.push(`import crypto from 'crypto';`);
    }

    if (hasAuth) {
      ['/auth/login', '/auth/register', '/auth/me', '/users'].forEach(path => handledPaths.add(path));
    }

    if (hasUploads) {
      imports.push(`import multer from 'multer';`);
      imports.push(`import fs from 'fs';`);
      imports.push(`import path from 'path';`);
      imports.push(`import { fileURLToPath } from 'url';`);
      ['/uploads', '/uploads/:id'].forEach(path => handledPaths.add(path));
    }

    const sections: string[] = [`const router = express.Router();`];

    if (hasAuth) {
      sections.push(`const users = [];
const sessions = new Map();

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return \`\${salt}:\${hash}\`;
}

function verifyPassword(password, storedHash) {
  const [salt, hash] = storedHash.split(':');
  const candidate = hashPassword(password, salt).split(':')[1];
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(candidate));
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  sessions.set(token, userId);
  return token;
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

function getAuthUser(req) {
  const token = req.headers.authorization?.replace(/^Bearer\\s+/i, '');
  const userId = token ? sessions.get(token) : null;
  return userId ? users.find(user => user.id === userId) : null;
}

router.post('/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  if (users.some(user => user.email === normalizedEmail)) {
    return res.status(409).json({ error: 'A user with this email already exists' });
  }

  const user = {
    id: crypto.randomUUID(),
    name: name || normalizedEmail.split('@')[0],
    email: normalizedEmail,
    passwordHash: hashPassword(String(password)),
    createdAt: new Date().toISOString()
  };
  users.push(user);

  res.status(201).json({ user: publicUser(user), token: createSession(user.id) });
});

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  const user = users.find(candidate => candidate.email === normalizedEmail);

  if (!user || !password || !verifyPassword(String(password), user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  res.json({ user: publicUser(user), token: createSession(user.id) });
});

router.get('/auth/me', async (req, res) => {
  const user = getAuthUser(req);
  if (!user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  res.json({ user: publicUser(user) });
});

router.get('/users', async (_req, res) => {
  res.json({ users: users.map(publicUser) });
});`);
    }

    if (hasUploads) {
      sections.push(`const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, 'uploads');
const uploadedFiles = [];

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-z0-9_.-]/gi, '-').toLowerCase();
    cb(null, \`\${Date.now()}-\${Math.round(Math.random() * 1e9)}-\${safeName}\`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = file.mimetype.startsWith('image/') || file.mimetype === 'application/pdf';
    cb(allowed ? null : new Error('Only images and PDF files are allowed'), allowed);
  }
});

router.get('/uploads', async (_req, res) => {
  res.json({ files: uploadedFiles });
});

router.post('/uploads', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'A file field named "file" is required' });
  }

  const file = {
    id: crypto.randomUUID?.() || \`\${Date.now()}\`,
    originalName: req.file.originalname,
    fileName: req.file.filename,
    mimeType: req.file.mimetype,
    size: req.file.size,
    url: \`/uploads/\${req.file.filename}\`,
    metadata: req.body || {},
    createdAt: new Date().toISOString()
  };

  uploadedFiles.unshift(file);
  res.status(201).json({ file });
});

router.get('/uploads/:id', async (req, res) => {
  const file = uploadedFiles.find(candidate => candidate.id === req.params.id);
  if (!file) {
    return res.status(404).json({ error: 'File not found' });
  }

  res.json({ file });
});`);
    }

    const genericRoutes = this.generateGenericRoutes(config, handledPaths);
    if (genericRoutes) {
      sections.push(genericRoutes);
    }

    return `${imports.join('\n')}

${sections.join('\n\n')}

export default router;`;
  }

  private hasAuthEndpoints(config: FullstackConfig): boolean {
    return Boolean(config.features?.auth) ||
      config.apiEndpoints.some(endpoint => /auth|login|register|users?/i.test(endpoint));
  }

  private hasUploadEndpoints(config: FullstackConfig): boolean {
    return Boolean(config.features?.uploads) ||
      config.apiEndpoints.some(endpoint => /upload|file|image|media|photo|storage/i.test(endpoint));
  }

  private generateGenericRoutes(config: FullstackConfig, handledPaths: Set<string>): string {
    const genericEndpoints = config.apiEndpoints
      .map(endpoint => endpoint.replace('/api', '') || '/')
      .filter(routePath => !handledPaths.has(routePath));

    if (genericEndpoints.length === 0) {
      return '';
    }

    const stores = new Set(
      genericEndpoints.map(routePath => routePath.replace(/\/:id$/, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'items')
    );

    const storeDeclarations = Array.from(stores)
      .map(storeName => `const ${storeName}Store = [];`)
      .join('\n');

    const routes = genericEndpoints.map(routePath => {
      const storeName = routePath.replace(/\/:id$/, '').replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'items';

      if (routePath.includes(':id')) {
        return `router.get('${routePath}', async (req, res) => {
  const item = ${storeName}Store.find(candidate => candidate.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  res.json({ data: item });
});

router.put('${routePath}', async (req, res) => {
  const index = ${storeName}Store.findIndex(candidate => candidate.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  ${storeName}Store[index] = { ...${storeName}Store[index], ...req.body, updatedAt: new Date().toISOString() };
  res.json({ data: ${storeName}Store[index] });
});

router.delete('${routePath}', async (req, res) => {
  const index = ${storeName}Store.findIndex(candidate => candidate.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: 'Not found' });
  const [deleted] = ${storeName}Store.splice(index, 1);
  res.json({ data: deleted });
});`;
      }

      return `router.get('${routePath}', async (_req, res) => {
  res.json({ data: ${storeName}Store });
});

router.post('${routePath}', async (req, res) => {
  const item = {
    id: \`\${Date.now()}-\${Math.round(Math.random() * 1e9)}\`,
    ...req.body,
    createdAt: new Date().toISOString()
  };
  ${storeName}Store.unshift(item);
  res.status(201).json({ data: item });
});`;
    }).join('\n\n');

    return `${storeDeclarations}

${routes}`;
  }

  /**
   * Generate backend package.json
   */
  private generateBackendPackageJson(config: FullstackConfig): string {
    const dependencies: Record<string, string> = {
      'express': '^4.18.2',
      'cors': '^2.8.5',
      'dotenv': '^16.3.1'
    };

    if (this.hasUploadEndpoints(config)) {
      dependencies['multer'] = '^1.4.5-lts.1';
    }

    // Add API client dependencies if API keys are required
    if (config.requiredApiKeys?.includes('OPENAI_API_KEY') || 
        config.requiredApiKeys?.includes('ANTHROPIC_API_KEY') ||
        config.requiredApiKeys?.includes('HUGGINGFACE_API_KEY')) {
      // Node.js 18+ has built-in fetch, but we can add axios as fallback
      // dependencies['axios'] = '^1.6.2';
    }

    if (config.databaseType === 'mongodb') {
      dependencies['mongoose'] = '^8.0.0';
    } else if (config.databaseType === 'postgresql') {
      dependencies['pg'] = '^8.11.3';
      dependencies['pg-hstore'] = '^2.3.4';
    } else if (config.databaseType === 'mysql') {
      dependencies['mysql2'] = '^3.6.5';
    }

    return JSON.stringify({
      name: 'backend-server',
      version: '1.0.0',
      type: 'module',
      main: 'index.js',
      scripts: {
        start: 'node index.js',
        dev: 'node --watch index.js'
      },
      dependencies,
      engines: {
        node: '>=18.0.0' // Required for built-in fetch
      }
    }, null, 2);
  }

  /**
   * Generate backend .env.example
   */
  private generateBackendEnvExample(config: FullstackConfig): string {
    const lines = [
      '# Backend Server Configuration',
      `PORT=${config.backendPort}`,
      `FRONTEND_URL=http://localhost:5173`,
      ''
    ];

    // Add required API keys
    if (config.requiredApiKeys && config.requiredApiKeys.length > 0) {
      lines.push('# API Keys (Required)');
      lines.push('# Get these API keys from the respective service providers:');
      config.requiredApiKeys.forEach(key => {
        if (key === 'OPENAI_API_KEY') {
          lines.push('# OpenAI: https://platform.openai.com/api-keys');
          lines.push('OPENAI_API_KEY=your-openai-api-key-here');
        } else if (key === 'ANTHROPIC_API_KEY') {
          lines.push('# Anthropic: https://console.anthropic.com/settings/keys');
          lines.push('ANTHROPIC_API_KEY=your-anthropic-api-key-here');
        } else if (key === 'HUGGINGFACE_API_KEY') {
          lines.push('# Hugging Face: https://huggingface.co/settings/tokens');
          lines.push('HUGGINGFACE_API_KEY=your-huggingface-api-key-here');
        } else if (key === 'STRIPE_SECRET_KEY') {
          lines.push('# Stripe: https://dashboard.stripe.com/apikeys');
          lines.push('STRIPE_SECRET_KEY=your-stripe-secret-key-here');
        } else if (key === 'GITHUB_TOKEN') {
          lines.push('# GitHub: https://github.com/settings/tokens');
          lines.push('GITHUB_TOKEN=your-github-token-here');
        } else {
          lines.push(`${key}=your-${key.toLowerCase().replace(/_/g, '-')}-here`);
        }
      });
      lines.push('');
    }

    if (config.databaseType === 'mongodb') {
      lines.push('# MongoDB Configuration');
      lines.push('MONGODB_URI=mongodb://localhost:27017/your-database-name');
    } else if (config.databaseType === 'postgresql') {
      lines.push('# PostgreSQL Configuration');
      lines.push('# Use PROJECT_DATABASE_URL to avoid conflict with platform DATABASE_URL');
      lines.push('PROJECT_DATABASE_URL=postgresql://user:password@localhost:5432/your-database-name');
      lines.push('# If your framework requires DATABASE_URL, you can alias it:');
      lines.push('# DATABASE_URL=${PROJECT_DATABASE_URL}');
    } else if (config.databaseType === 'mysql') {
      lines.push('# MySQL Configuration');
      lines.push('MYSQL_HOST=localhost');
      lines.push('MYSQL_USER=root');
      lines.push('MYSQL_PASSWORD=password');
      lines.push('MYSQL_DATABASE=your-database-name');
    }

    if (this.hasUploadEndpoints(config)) {
      if (lines[lines.length - 1] !== '') {
        lines.push('');
      }
      lines.push('# Uploads');
      lines.push('# Preview mode stores uploaded files on the local server filesystem.');
      lines.push('# For production, connect this to durable object storage such as S3, R2, or Supabase Storage.');
      lines.push('MAX_UPLOAD_SIZE_MB=10');
    }

    return lines.join('\n');
  }

  /**
   * Generate frontend API configuration
   */
  public generateFrontendApiConfig(config: FullstackConfig): Array<{ path: string; content: string }> {
    const files: Array<{ path: string; content: string }> = [];

    // Generate client/src/lib/api.ts for fullstack monorepo projects
    const apiConfig = `/**
 * API Configuration
 * 
 * This file handles all API calls to the backend server.
 * The API URL is automatically configured based on environment.
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:${config.backendPort}';

export const api = {
  async get(endpoint: string) {
    const response = await fetch(\`\${API_BASE_URL}/api\${endpoint}\`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(\`API error: \${response.statusText}\`);
    }
    
    return response.json();
  },

  async post(endpoint: string, data: any) {
    const response = await fetch(\`\${API_BASE_URL}/api\${endpoint}\`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(\`API error: \${response.statusText}\`);
    }
    
    return response.json();
  },

  async put(endpoint: string, data: any) {
    const response = await fetch(\`\${API_BASE_URL}/api\${endpoint}\`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      throw new Error(\`API error: \${response.statusText}\`);
    }
    
    return response.json();
  },

  async delete(endpoint: string) {
    const response = await fetch(\`\${API_BASE_URL}/api\${endpoint}\`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      throw new Error(\`API error: \${response.statusText}\`);
    }
    
    return response.json();
  },

  async uploadFile(endpoint: string, file: File, metadata: Record<string, string> = {}) {
    const formData = new FormData();
    formData.append('file', file);
    Object.entries(metadata).forEach(([key, value]) => formData.append(key, value));

    const response = await fetch(\`\${API_BASE_URL}/api\${endpoint}\`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(\`API error: \${response.statusText}\`);
    }

    return response.json();
  },
};

export default api;`;

    files.push({
      path: 'client/src/lib/api.ts',
      content: apiConfig
    });

    // Generate .env.example for frontend
    const envExample = `# Frontend Environment Variables
VITE_API_URL=http://localhost:${config.backendPort}`;

    files.push({
      path: 'client/.env.example',
      content: envExample
    });

    return files;
  }

  /**
   * Fix integration issues by updating files
   */
  public async fixIntegrationIssues(
    frontendFiles: Array<{ path: string; content: string }>,
    backendFiles: Array<{ path: string; content: string }>,
    check: IntegrationCheck
  ): Promise<{
    frontendFiles: Array<{ path: string; content: string }>;
    backendFiles: Array<{ path: string; content: string }>;
  }> {
    const updatedFrontend = [...frontendFiles];
    const updatedBackend = [...backendFiles];

    // Fix: Add CORS to backend
    if (check.issues.includes('CORS is not configured in backend')) {
      const serverFile = updatedBackend.find(f => f.path.includes('server/index.js') || f.path.includes('server.js'));
      if (serverFile) {
        const content = serverFile.content;
        if (!content.includes('cors')) {
          // Add cors import and middleware
          const updatedContent = content
            .replace(/import express from 'express';/, `import express from 'express';\nimport cors from 'cors';`)
            .replace(/app\.use\(express\.json\(\)\);/, `app.use(cors({\n  origin: process.env.FRONTEND_URL || 'http://localhost:5173',\n  credentials: true\n}));\napp.use(express.json());`);
          
          serverFile.content = updatedContent;
        }
      }
    }

    // Fix: Add API URL to frontend
    if (check.issues.includes('Frontend does not have API URL configured')) {
      const hasApiFile = updatedFrontend.some(f => f.path.includes('lib/api.ts') || f.path.includes('utils/api.ts'));
      if (!hasApiFile) {
        const apiFiles = this.generateFrontendApiConfig(check.config);
        updatedFrontend.push(...apiFiles);
      }
    }

    // Fix: Add API calls to frontend
    if (check.issues.includes('Frontend is not calling backend API endpoints')) {
      // This would require AI to update frontend files - handled in orchestrator
      logger.info('Frontend API calls need to be added - will be handled by code generator');
    }

    return {
      frontendFiles: updatedFrontend,
      backendFiles: updatedBackend
    };
  }
}

export const fullstackIntegrationService = new FullstackIntegrationService();
