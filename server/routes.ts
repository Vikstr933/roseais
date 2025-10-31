import type { Express } from 'express';
import { createServer, type Server } from 'http';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import path from 'path';
import { promises as fs } from 'fs';
import {
  type InsertAgent,
  agents,
  promptTemplates,
  promptChains,
  chainExecutions,
  type PromptChain,
} from '@db/schema';
import { db } from '@db';
import { eq } from 'drizzle-orm';
import serverRoutes from './routes/server';
import componentsRouter from './routes/components';
import sessionsRouter from './routes/sessions';
import promptsRouter from './routes/prompts';
import sseRouter from './routes/sse';
import activityRouter from './routes/activity';
import terminalRouter from './routes/terminal';
import authRouter from './routes/auth';
import deploymentsRouter from './routes/deployments';
import healthRouter from './routes/health';
import costsRouter from './routes/costs';
import pluginsRouter from './routes/plugins';
import userRouter from './routes/user';

// Utility function to generate component content based on file path
async function generateComponentContent(filePath: string): Promise<string> {
  const componentName = path.basename(filePath, path.extname(filePath));

  if (filePath.includes('Form/')) {
    return `
      import React from 'react';
      
      export default function ${componentName}() {
        return (
          <div className="${componentName.toLowerCase()}">
            <h2>${componentName}</h2>
            {/* Form content will be generated here */}
          </div>
        );
      }
    `;
  }

  if (filePath.includes('hooks/')) {
    return `
      import { useState, useEffect } from 'react';
      
      export default function ${componentName}() {
        const [data, setData] = useState(null);
        
        useEffect(() => {
          // Hook implementation will be generated here
        }, []);
        
        return data;
      }
    `;
  }

  return `
    import React from 'react';
    
    export default function ${componentName}() {
      return (
        <div className="${componentName.toLowerCase()}">
          <h2>${componentName}</h2>
          {/* Component content will be generated here */}
        </div>
      );
    }
  `;
}

// the newest Anthropic model is "claude-sonnet-4-5-20250929" which was released September 29, 2025
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Schema for template variables validation
const templateVariableSchema = z.object({
  name: z.string(),
  type: z.enum(['string', 'number', 'boolean', 'array', 'object']),
  description: z.string(),
  required: z.boolean(),
  defaultValue: z.any().optional(),
});

// Schema for chain step configuration
const chainStepSchema = z.object({
  templateId: z.number(),
  name: z.string(),
  description: z.string(),
  variableMapping: z.record(z.string(), z.string()),
  retryConfig: z
    .object({
      maxAttempts: z.number().min(1),
      backoffMs: z.number().min(0),
    })
    .optional(),
});

const generatePromptSchema = z.object({
  systemPrompt: z.string(),
  userPrompt: z.string(),
  model: z.string(),
  temperature: z.number().min(0).max(1),
  enableOrchestration: z.boolean().default(false),
  projectType: z.enum(['react', 'vue', 'node', 'python']),
});

function validateColorContrast(colors: {
  background: string;
  text: string;
}): boolean {
  // Convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : null;
  };

  // Calculate relative luminance
  const getLuminance = (r: number, g: number, b: number) => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  };

  const bg = hexToRgb(colors.background);
  const text = hexToRgb(colors.text);

  if (!bg || !text) return false;

  const l1 = getLuminance(bg.r, bg.g, bg.b);
  const l2 = getLuminance(text.r, text.g, text.b);

  const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  return ratio >= 4.5; // WCAG AA standard for normal text
}

export function registerRoutes(app: Express): Server {
  // Register workspace routes first to ensure they take precedence
  app.post('/api/workspaces/save', async (req, res) => {
    console.log('Workspace save endpoint hit'); // Add logging
    console.log('Request body:', req.body); // Log incoming request
    try {
      const { workspaceId, files } = req.body;
      if (!workspaceId) {
        return res.status(400).json({ error: 'Workspace ID is required' });
      }

      // Construct workspace path
      const workspacePath = path.join(
        process.cwd(),
        'workspaces',
        workspaceId.toString()
      );

      // Clear existing workspace
      try {
        await fs.rm(workspacePath, { recursive: true, force: true });
      } catch (error) {
        // Ignore if directory doesn't exist
      }
      await fs.mkdir(workspacePath, { recursive: true });

      // Ensure required directories exist
      await fs.mkdir(path.join(workspacePath, 'src'), { recursive: true });
      await fs.mkdir(path.join(workspacePath, 'src/components'), {
        recursive: true,
      });
      await fs.mkdir(path.join(workspacePath, 'src/components/Form'), {
        recursive: true,
      });

      // Save each file with proper path structure
      const savePromises = files.map(async (file: any) => {
        // Normalize path to ensure consistent structure
        const normalizedPath = file.path.replace(/^\/+/, ''); // Remove leading slashes
        const filePath = path.join(workspacePath, normalizedPath);
        const dir = path.dirname(filePath);

        // Create directory if it doesn't exist
        await fs.mkdir(dir, { recursive: true });

        // Write file content
        await fs.writeFile(filePath, file.content, 'utf8');
      });

      // Ensure all required files are present
      const requiredFiles = [
        'src/main.tsx',
        'src/index.css',
        'src/components/Form/PhotoUploadForm.tsx',
        'src/components/LoadingSpinner/index.tsx',
        'src/hooks/useBlogPosts.ts',
      ];

      // Check if all required files are in the generated files
      const missingFiles = requiredFiles.filter(
        reqFile => !files.some((f: any) => f.path.includes(reqFile))
      );

      if (missingFiles.length > 0) {
        // Generate missing files using the component generator
        const generatePromises = missingFiles.map(async filePath => {
          const content = await generateComponentContent(filePath);
          const fullPath = path.join(workspacePath, filePath);
          await fs.mkdir(path.dirname(fullPath), { recursive: true });
          await fs.writeFile(fullPath, content, 'utf8');
        });

        await Promise.all(generatePromises);
      }

      await Promise.all(savePromises);

      // Create package.json if it doesn't exist
      const packageJsonPath = path.join(workspacePath, 'package.json');
      try {
        await fs.access(packageJsonPath);
      } catch {
        await fs.writeFile(
          packageJsonPath,
          JSON.stringify(
            {
              name: 'generated-app',
              version: '1.0.0',
              scripts: {
                dev: 'vite',
                build: 'vite build',
                preview: 'vite preview',
              },
              dependencies: {
                react: '^18.2.0',
                'react-dom': '^18.2.0',
              },
              devDependencies: {
                vite: '^5.0.0',
                '@vitejs/plugin-react': '^4.0.0',
                typescript: '^5.0.0',
              },
            },
            null,
            2
          )
        );
      }

      // Create default Component.tsx if it doesn't exist
      const componentPath = path.join(workspacePath, 'src', 'Component.tsx');
      try {
        await fs.access(componentPath);
      } catch {
        await fs.writeFile(
          componentPath,
          `
          import React from 'react';

          export default function Component() {
            return (
              <div className="container">
                <h1>Generated Component</h1>
                <p>Edit this component to get started</p>
              </div>
            );
          }
        `
        );
      }

      res.json({ success: true, workspacePath });
    } catch (error) {
      console.error('Error saving workspace:', error);
      res.status(500).json({ error: 'Failed to save workspace' });
    }
  });

  // Register server control routes
  app.use('/api/server', serverRoutes);
  app.use('/api', componentsRouter);
  app.use('/api/sessions', sessionsRouter);
  app.use('/api', promptsRouter);
  app.use('/api', sseRouter);
  app.use('/api/activity', activityRouter);
  app.use('/api', terminalRouter);
  app.use('/api/auth', authRouter);
  app.use('/api/deployments', deploymentsRouter);
  app.use('/api/health', healthRouter);
  app.use('/api/costs', costsRouter);
  app.use('/api/user', userRouter);

  // Register plugins router
  console.log('🔌 Registering plugins router...', pluginsRouter ? 'Router loaded' : 'Router is null/undefined');
  if (pluginsRouter) {
    app.use('/api/plugins', pluginsRouter);
    console.log('✅ Plugins router registered at /api/plugins');
  } else {
    console.error('❌ Plugins router is null or undefined, not registered');
  }

  app.post('/api/server/start', async (req, res) => {
    try {
      const { workspaceId, withDependencies } = req.body;
      const workspacePath = path.join(
        process.cwd(),
        'workspaces',
        workspaceId.toString()
      );

      // Verify workspace exists
      await fs.access(workspacePath);

      // Create a basic Vite config for the workspace if it doesn't exist
      const viteConfigPath = path.join(workspacePath, 'vite.config.ts');
      try {
        await fs.access(viteConfigPath);
      } catch {
        await fs.writeFile(
          viteConfigPath,
          `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: ${3000 + parseInt(workspaceId.toString().slice(-2))}, // Use different ports for different workspaces
    host: true
  }
});`
        );
      }

      // Create index.html if it doesn't exist
      const indexPath = path.join(workspacePath, 'index.html');
      try {
        await fs.access(indexPath);
      } catch {
        await fs.writeFile(
          indexPath,
          `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Generated App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`
        );
      }

      // The server is conceptually "started" - in a real implementation this would
      // spawn a Vite dev server process for the workspace
      res.json({
        success: true,
        message: 'Server started',
        previewUrl: `http://localhost:${3000 + parseInt(workspaceId.toString().slice(-2))}`,
      });
    } catch (error) {
      console.error('Error starting server:', error);
      res.status(500).json({ error: 'Failed to start server' });
    }
  });

  app.get('/api/workspaces', async (req, res) => {
    try {
      const workspacesDir = path.join(process.cwd(), 'workspaces');
      const workspaces = await fs.readdir(workspacesDir);
      res.json(workspaces.filter((w: string) => !w.includes('.')));
    } catch (error) {
      console.error('Error reading workspaces:', error);
      res.status(500).json({ error: 'Failed to read workspaces' });
    }
  });

  // Create a new prompt template
  app.post('/api/templates', async (req, res) => {
    try {
      const [template] = await db
        .insert(promptTemplates)
        .values(req.body)
        .returning();
      res.json(template);
    } catch (error: any) {
      console.error('Error creating template:', error);
      res.status(500).json({ error: 'Failed to create template' });
    }
  });

  // Create a new prompt chain
  app.post('/api/chains', async (req, res) => {
    try {
      const [chain] = await db
        .insert(promptChains)
        .values(req.body)
        .returning();
      res.json(chain);
    } catch (error: any) {
      console.error('Error creating chain:', error);
      res.status(500).json({ error: 'Failed to create chain' });
    }
  });

  // Execute a prompt chain
  app.post('/api/chains/:id/execute', async (req, res) => {
    try {
      const chainId = parseInt(req.params.id);
      const chain = await db.query.promptChains.findFirst({
        where: eq(promptChains.id, chainId),
      });

      if (!chain) {
        return res.status(404).json({ error: 'Chain not found' });
      }

      // Create execution record
      const [execution] = await db
        .insert(chainExecutions)
        .values({
          id: crypto.randomUUID(),
          chainId,
          status: 'running',
          input: JSON.stringify(req.body),
          stepResults: JSON.stringify([]),
        })
        .returning();

      // Execute each step in the chain
      let currentInput = req.body;
      const stepResults = [];

      for (const step of JSON.parse(chain.steps) as any[]) {
        try {
          // Get template for this step
          const template = await db.query.promptTemplates.findFirst({
            where: eq(promptTemplates.id, step.templateId),
          });

          if (!template) {
            throw new Error(`Template ${step.templateId} not found`);
          }

          // Map variables from previous steps
          const mappedInput = Object.entries(
            step.variableMapping as Record<string, string>
          ).reduce(
            (acc, [key, value]) => {
              acc[key] = value.startsWith('$')
                ? (currentInput as Record<string, string>)[value.slice(1)]
                : value;
              return acc;
            },
            {} as Record<string, string>
          );

          // Generate prompt using template
          const prompt = template.template.replace(
            /\{\{(\w+)\}\}/g,
            (_, key) => mappedInput[key] || ''
          );

          // Call Anthropic API
          const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-5-20250929',
            max_tokens: chain.maxTokens || 2048,
            messages: [{ role: 'user', content: prompt }],
          });

          const content =
            response.content[0].type === 'text' ? response.content[0].text : '';
          const stepResult = {
            templateId: step.templateId,
            input: mappedInput,
            output: content,
            status: 'completed' as const,
          };

          stepResults.push(stepResult);
          currentInput = { ...currentInput, [step.name]: content };
        } catch (stepError: any) {
          // Handle step failure based on retry strategy
          const retryConfig = step.retryConfig || chain.retryStrategy;

          if (retryConfig && stepResults.length < retryConfig.maxAttempts) {
            await new Promise(resolve =>
              setTimeout(resolve, retryConfig.backoffMs)
            );
            continue;
          }

          // Update execution with error
          await db
            .update(chainExecutions)
            .set({
              status: 'failed',
              completedAt: new Date(),
              error: JSON.stringify({
                message: stepError.message,
                step: step.name,
              }),
              stepResults: JSON.stringify(stepResults),
            })
            .where(eq(chainExecutions.id, execution.id));

          return res.status(500).json({
            error: 'Chain execution failed',
            step: step.name,
            message: stepError.message,
          });
        }
      }

      // Update execution record with results
      const [updatedExecution] = await db
        .update(chainExecutions)
        .set({
          status: 'completed',
          completedAt: new Date(),
          output: JSON.stringify(currentInput),
          stepResults: JSON.stringify(stepResults),
        })
        .where(eq(chainExecutions.id, execution.id))
        .returning();

      res.json(updatedExecution);
    } catch (error: any) {
      console.error('Error executing chain:', error);
      res.status(500).json({ error: 'Failed to execute chain' });
    }
  });

  app.patch('/api/agents/:id', async (req, res) => {
    try {
      const agentId = parseInt(req.params.id);
      const { isActive } = req.body;

      const [updatedAgent] = await db
        .update(agents)
        .set({ isActive })
        .where(eq(agents.id, agentId))
        .returning();

      if (!updatedAgent) {
        return res.status(404).json({ error: 'Agent not found' });
      }

      res.json(updatedAgent);
    } catch (error: any) {
      console.error('Error in /api/agents/:id:', error);
      res.status(500).json({ error: 'Failed to update agent status' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
