import { Router } from 'express';
import { db } from '../../db';
import { agents, promptChains, promptTemplates } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateReactComponent } from '../utils/componentGenerator';
import { knowledgeService } from '../services/KnowledgeService';
import { apiKeyService } from '../services/APIKeyService';
import { authenticateUser, optionalAuth } from '../middleware/auth';
import { rateLimitAI, getRateLimitStatus } from '../middleware/rateLimiting';
import { validateRequest, sanitizeAIResponse } from '../middleware/validation';
import { userPromptSchema } from '../validation/schemas';
import path from 'path';
import fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const router = Router();

async function getActiveAgents() {
  const rawAgents = await db
    .select()
    .from(agents as any)
    .where(eq(agents.isActive as any, true));

  // JSONB fields are already parsed by Drizzle, no need to JSON.parse()
  return rawAgents.map((agent: any) => ({
    ...agent,
    capabilities: agent.capabilities || [],
    expertise: agent.expertise || [],
    frameworks: agent.frameworks || [],
    libraries: agent.libraries || [],
    bestPractices: agent.bestPractices || [],
    customInstructions: agent.customInstructions || null,
    isActive: Boolean(agent.isActive),
    role: agent.role || agent.type || '',
    systemPrompt: agent.systemPrompt || agent.system_prompt || '',
    model: agent.model || 'claude-3-5-sonnet-20241022',
  }));
}

interface AIResponse {
  type: 'text' | 'component';
  text: string;
  files?: {
    path: string;
    content: string;
  }[];
}

interface PromptAnalysis {
  type: 'component' | 'text' | 'workflow';
  complexity: 'simple' | 'medium' | 'complex';
  requirements: string[];
  suggestedAgents: string[];
  estimatedSteps: number;
}

// Library and Framework Mappings
const libraryMappings = {
  '0': 'React',
  '1': 'Redux',
  '2': 'Axios',
  '3': 'Jest',
  '4': 'React Testing Library',
  '5': 'Lodash',
  '6': 'date-fns',
  '7': 'Framer Motion',
};

const frameworkMappings = {
  '0': 'Next.js',
  '1': 'React',
  '2': 'Vue.js',
  '3': 'Angular',
  '4': 'Svelte',
  '5': 'Express',
  '6': 'NestJS',
};

const capabilityMappings = {
  '0': 'Frontend Development',
  '1': 'UI/UX Design',
  '2': 'API Integration',
  '3': 'State Management',
  '4': 'Testing',
  '5': 'Performance Optimization',
  '6': 'Responsive Design',
  '7': 'Accessibility',
  '8': 'SEO',
  '9': 'Security',
};

const bestPracticeMappings = {
  '0': 'Clean Code',
  '1': 'DRY',
  '2': 'SOLID',
  '3': 'Component-Based Architecture',
  '4': 'Responsive Design',
  '5': 'Performance Optimization',
  '6': 'Code Review',
  '7': 'Testing',
  '8': 'Documentation',
  '9': 'Version Control',
};

// Helper function to map numeric indices to actual names
function mapIndices(indices: string, mappings: Record<string, string>): string {
  return indices
    .split(/[,\s]+/)
    .map(idx => mappings[idx] || idx)
    .filter(Boolean)
    .join(', ');
}

// Helper function to format knowledge context for agent prompts
function formatKnowledgeContext(knowledgeContext: any): string {
  let context = '';

  if (knowledgeContext.companies && knowledgeContext.companies.length > 0) {
    context += '\nCOMPANIES:\n';
    knowledgeContext.companies.forEach((company: any) => {
      context += `- ${company.name}: ${company.description}\n`;
      if (company.data.products && company.data.products.length > 0) {
        context += `  Products: ${company.data.products.join(', ')}\n`;
      }
      if (company.data.use_cases) {
        context += `  Use Cases: ${company.data.use_cases}\n`;
      }
    });
  }

  if (knowledgeContext.frameworks && knowledgeContext.frameworks.length > 0) {
    context += '\nFRAMEWORKS:\n';
    knowledgeContext.frameworks.forEach((framework: any) => {
      context += `- ${framework.name} (${framework.data.language}): ${framework.description}\n`;
      if (framework.data.features && framework.data.features.length > 0) {
        context += `  Features: ${framework.data.features.join(', ')}\n`;
      }
      if (framework.data.use_cases) {
        context += `  Use Cases: ${framework.data.use_cases}\n`;
      }
    });
  }

  if (knowledgeContext.workspaces && knowledgeContext.workspaces.length > 0) {
    context += '\nWORKSPACE TEMPLATES:\n';
    knowledgeContext.workspaces.forEach((workspace: any) => {
      context += `- ${workspace.name}: ${workspace.description}\n`;
      if (workspace.data.use_cases) {
        context += `  Use Cases: ${workspace.data.use_cases}\n`;
      }
    });
  }

  return context || 'No relevant knowledge found.';
}

async function analyzePrompt(prompt: string): Promise<PromptAnalysis> {
  // Initialize with default analysis
  const analysis: PromptAnalysis = {
    type: 'text',
    complexity: 'simple',
    requirements: [],
    suggestedAgents: [],
    estimatedSteps: 1,
  };

  const promptLower = prompt.toLowerCase();

  // Component Detection
  const componentKeywords = [
    'create a react component',
    'build a component',
    'make a react component',
    'generate a component',
    'calculator',
    'counter',
    'game',
    'tic tac toe',
    'component',
    'widget',
    'interface',
    'ui element',
  ];

  // Complexity Analysis
  const complexityIndicators = {
    simple: ['basic', 'simple', 'single', 'static'],
    medium: ['interactive', 'dynamic', 'state', 'api', 'fetch'],
    complex: [
      'authentication',
      'database',
      'real-time',
      'websocket',
      'complex',
    ],
  };

  // Feature Detection
  const featurePatterns = [
    { pattern: /\b(state|useState)\b/i, requirement: 'State Management' },
    { pattern: /\b(api|fetch|axios)\b/i, requirement: 'API Integration' },
    { pattern: /\b(form|input|validation)\b/i, requirement: 'Form Handling' },
    { pattern: /\b(style|css|tailwind|sass)\b/i, requirement: 'Styling' },
    { pattern: /\b(test|jest|cypress)\b/i, requirement: 'Testing' },
    { pattern: /\b(typescript|ts)\b/i, requirement: 'TypeScript' },
    {
      pattern: /\b(animation|transition|motion)\b/i,
      requirement: 'Animations',
    },
  ];

  // Determine type
  if (
    componentKeywords.some(keyword => promptLower.includes(keyword)) ||
    /create|build|make|implement|develop.*(?:component|app|interface|widget|game)/i.test(
      promptLower
    )
  ) {
    analysis.type = 'component';
  } else if (
    promptLower.includes('workflow') ||
    promptLower.includes('process')
  ) {
    analysis.type = 'workflow';
  }

  // Determine complexity
  for (const [level, indicators] of Object.entries(complexityIndicators)) {
    if (indicators.some(indicator => promptLower.includes(indicator))) {
      analysis.complexity = level as 'simple' | 'medium' | 'complex';
      break;
    }
  }

  // Extract requirements
  analysis.requirements = featurePatterns
    .filter(({ pattern }) => pattern.test(promptLower))
    .map(({ requirement }) => requirement);

  // Suggest agents based on requirements
  const agentMappings = {
    'State Management': ['componentDeveloper', 'architectureDesigner'],
    'API Integration': ['integrationSpecialist', 'componentDeveloper'],
    'Form Handling': ['componentDeveloper', 'uiSpecialist'],
    Styling: ['uiSpecialist', 'componentDeveloper'],
    Testing: ['qaEngineer', 'componentDeveloper'],
    TypeScript: ['typeScriptExpert', 'componentDeveloper'],
    Animations: ['uiSpecialist', 'componentDeveloper'],
  };

  // Get unique suggested agents based on requirements
  const suggestedAgents = new Set<string>();
  analysis.requirements.forEach(req => {
    const agents = agentMappings[req as keyof typeof agentMappings] || [];
    agents.forEach(agent => suggestedAgents.add(agent));
  });
  analysis.suggestedAgents = Array.from(suggestedAgents);

  // Estimate steps based on complexity and requirements
  analysis.estimatedSteps = Math.max(
    2,
    Math.ceil(
      (analysis.complexity === 'complex'
        ? 3
        : analysis.complexity === 'medium'
          ? 2
          : 1) +
        analysis.requirements.length * 0.5
    )
  );

  return analysis;
}

async function isComponentRequest(prompt: string): Promise<boolean> {
  const analysis = await analyzePrompt(prompt);
  return analysis.type === 'component';
}

interface ChainStep {
  name: string;
  description: string;
  agent_role: string;
  template: string;
  input_mapping: Record<string, string>;
  output_mapping: Record<string, string>;
  validation?: {
    required_fields: string[];
  };
  dependencies?: string[];
}

function sendSSEUpdate(req: any, type: string, data: any) {
  if (req.app.locals.sseClients) {
    req.app.locals.sseClients.forEach((client: any) => {
      client.write(`data: ${JSON.stringify({ type, data })}\n\n`);
    });
  }
}

async function generateWithAI(
  prompt: string,
  systemPrompt: string,
  model: string
): Promise<AIResponse> {
  try {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set');
    }

    // For Claude-3 and other models
    // Check if this is a component generation request
    if (await isComponentRequest(prompt)) {
      // First get the AI response
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Api-Key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: model,
          max_tokens: 4000,
          system: `${systemPrompt}\n\nWhen providing React component code and configurations, use the following guidelines:

1. For file formatting:
   - Each file should be preceded by its filename in bold, followed by the language
   - Example format:
   **src/Component.tsx**
   \`\`\`typescript
   // component code here
   \`\`\`
   **src/styles.css**
   \`\`\`css
   // styles here
   \`\`\`

2. For libraries, frameworks, capabilities, and best practices, use the actual names instead of indices:
   - Libraries: React, Redux, Axios, Jest, React Testing Library, Lodash, date-fns, Framer Motion
   - Frameworks: Next.js, React, Vue.js, Angular, Svelte, Express, NestJS
   - Capabilities: Frontend Development, UI/UX Design, API Integration, State Management, Testing, Performance Optimization, Responsive Design, Accessibility, SEO, Security
   - Best Practices: Clean Code, DRY, SOLID, Component-Based Architecture, Responsive Design, Performance Optimization, Code Review, Testing, Documentation, Version Control`,
          messages: [
            {
              role: 'user',
              content: prompt,
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('AI API error details:', errorData);
        throw new Error(
          `AI API error: ${response.statusText} - ${JSON.stringify(errorData)}`
        );
      }

      const data = await response.json();
      if (!data.content || !data.content[0] || !data.content[0].text) {
        throw new Error('Invalid response format from Claude-3');
      }

      // Create unique workspace directory for this generation
      const workspaceId = Date.now().toString();
      const workspaceDir = path.join(process.cwd(), 'workspaces', workspaceId);
      await fs.mkdir(workspaceDir, { recursive: true });

      // Generate component in new workspace
      const result = await generateReactComponent(prompt, data.content[0].text);

      // Update file paths to use new workspace
      result.files = result.files.map(file => ({
        ...file,
        path: file.path.replace(
          /^workspaces\/[^\/]+\//,
          `workspaces/${workspaceId}/`
        ),
      }));

      // Check for existing files and merge changes
      const existingFiles = await fs.readdir(workspaceDir, { recursive: true });
      result.files = result.files.map(file => {
        const existingPath = existingFiles.find(f => f === file.path);
        if (existingPath) {
          // Add version suffix to avoid overwriting
          const ext = path.extname(file.path);
          const base = path.basename(file.path, ext);
          file.path = `${path.dirname(file.path)}/${base}_v${Date.now()}${ext}`;
        }
        return file;
      });

      // Write all generated files
      await Promise.all(
        result.files.map(async (file: { path: string; content: string }) => {
          const filePath = path.join(workspaceDir, file.path);
          const fileDir = path.dirname(filePath);
          await fs.mkdir(fileDir, { recursive: true });
          await fs.writeFile(filePath, file.content);
        })
      );

      return {
        type: 'component',
        text: result.text || data.content[0].text,
        files: result.files,
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('AI API error details:', errorData);
      throw new Error(
        `AI API error: ${response.statusText} - ${JSON.stringify(errorData)}`
      );
    }

    const data = await response.json();
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response format from Claude-3');
    }

    return {
      type: 'text',
      text: data.content[0].text,
    };
  } catch (error) {
    console.error('Error generating with AI:', error);
    if (error instanceof Error) {
      throw new Error(`AI generation failed: ${error.message}`);
    }
    throw error;
  }
}

router.post(
  '/prompts/generate',
  authenticateUser,
  validateRequest(userPromptSchema), // Validate input FIRST
  rateLimitAI, // Add rate limiting BEFORE expensive AI calls
  async (req, res) => {
    try {
      const {
        systemPrompt,
        userPrompt,
        model = 'claude-3-5-sonnet-20241022',
        temperature = 0.7,
        orchestration = true,
        selectedKnowledge = null, // New parameter for manual knowledge selection
        userId = 'anonymous', // User ID for API key management
        projectId = null, // Project ID for context continuation
      } = req.body;

      // Send initial status
      sendSSEUpdate(req, 'GENERATION_START', {
        message: 'Starting multi-agent orchestration process',
      });

      // Load existing project files if projectId is provided (for context continuation)
      let existingProjectFiles: { path: string; content: string }[] = [];
      if (projectId) {
        try {
          const { projectFiles } = await import('../../db/schema');
          const { eq, and } = await import('drizzle-orm');
          
          const files = await db
            .select()
            .from(projectFiles as any)
            .where(
              and(
                eq((projectFiles as any).projectId, projectId),
                eq((projectFiles as any).isActive, 1)
              )
            );
          
          existingProjectFiles = files.map((f: any) => ({
            path: f.filePath,
            content: f.fileContent
          }));
          
          console.log(`📂 Loaded ${existingProjectFiles.length} existing files for project ${projectId}`);
          
          sendSSEUpdate(req, 'PROJECT_CONTEXT_LOADED', {
            message: `Loading ${existingProjectFiles.length} existing files for context...`,
            fileCount: existingProjectFiles.length
          });
        } catch (error) {
          console.error('Failed to load project files:', error);
          // Continue without project context if loading fails
        }
      }

      // Check for required API keys first (skip if system ANTHROPIC_API_KEY is set)
      if (!process.env.ANTHROPIC_API_KEY) {
        const apiKeyRequirements =
          apiKeyService.analyzePromptForAPIKeys(userPrompt);
        const apiKeyCheck = await apiKeyService.checkRequiredAPIKeys(
          userId,
          apiKeyRequirements
        );

        if (!apiKeyCheck.hasAllKeys && apiKeyCheck.missingKeys.length > 0) {
          // Send API key request via SSE
          sendSSEUpdate(req, 'API_KEY_REQUIRED', {
            message: 'API keys required for this request',
            missingKeys: apiKeyCheck.missingKeys,
          prompt: userPrompt,
        });

        return res.status(400).json({
          error: 'API keys required',
          missingKeys: apiKeyCheck.missingKeys,
          message: 'Please provide the required API keys to continue',
        });
        }
      }

      // Get knowledge context (automatic or manual selection)
      let knowledgeContext;
      if (selectedKnowledge) {
        // Use manually selected knowledge
        console.log('Using manually selected knowledge:', selectedKnowledge);
        knowledgeContext = await knowledgeService.getKnowledgeByIds(
          selectedKnowledge.companyIds || [],
          selectedKnowledge.frameworkIds || [],
          selectedKnowledge.workspaceIds || []
        );
      } else {
        // Automatically retrieve relevant knowledge
        console.log(
          'Automatically retrieving relevant knowledge for prompt:',
          userPrompt
        );
        knowledgeContext = await knowledgeService.getRelevantKnowledge(
          userPrompt,
          userId
        );
      }

      console.log(
        `Knowledge context loaded: ${knowledgeContext.totalItems} items`
      );
      sendSSEUpdate(req, 'KNOWLEDGE_LOADED', {
        message: `Loaded ${knowledgeContext.totalItems} relevant knowledge items`,
        knowledge: knowledgeContext,
      });

      // Get active agents for orchestration (always used now)
      const activeAgents = await getActiveAgents();

      // Initialize the orchestration plan
      const orchestrationPlan = {
        subtasks: [] as any[],
      };

      let finalResponse: AIResponse;

      // Always use orchestration now
      // Send orchestration start update
      sendSSEUpdate(req, 'ORCHESTRATION_START', {
        message: 'Starting AI orchestration process',
      });

      if (!activeAgents.length) {
        // Fallback to direct generation if no agents are active
        finalResponse = await generateWithAI(
          userPrompt,
          systemPrompt ||
            'You are a helpful AI that generates React applications.',
          model || 'claude-3-5-sonnet-20241022'
        );
      } else {
        // Use agent orchestration
        const orchestrationSteps = [];

        // Step 1: Requirements Analysis
        sendSSEUpdate(req, 'STEP_START', {
          agent: 'Requirements Analyst',
          task: 'Analyzing user requirements and extracting features',
          details: 'Breaking down your idea into technical specifications, identifying core features, data structures, and user flows',
          progress: 0,
          totalSteps: 4,
          currentStep: 1
        });

        const analysisAgent =
          activeAgents.find(
            a => a.role?.includes('analyst') || a.role?.includes('requirement')
          ) || activeAgents[0];

        // Format existing project files for context
        const formatExistingFiles = (files: { path: string; content: string }[]) => {
          if (!files || files.length === 0) return 'No existing files (new project)';
          
          return files.map(f => `
File: ${f.path}
\`\`\`
${f.content.substring(0, 500)}${f.content.length > 500 ? '...(truncated)' : ''}
\`\`\`
`).join('\n');
        };

        const requirementsPrompt = `Analyze the following user request and break it down into technical requirements:
"${userPrompt}"

${existingProjectFiles.length > 0 ? `
🔄 EXISTING PROJECT CONTEXT:
This is a continuation of an existing project with ${existingProjectFiles.length} files:
${formatExistingFiles(existingProjectFiles)}

IMPORTANT: The user wants to MODIFY or ENHANCE this existing project, not create a new one from scratch.
You should:
- Keep all existing files unless the user explicitly asks to remove them
- Only modify the files that need changes based on the user's request
- Maintain the existing architecture and patterns
- Add new files only if needed for new features
` : 'This is a NEW project - no existing files.'}

RELEVANT KNOWLEDGE CONTEXT:
${formatKnowledgeContext(knowledgeContext)}

Please provide:
1. Component structure needed (existing + new)
2. Features to implement or modify
3. Dependencies required
4. UI/UX considerations
5. Recommended technologies from the knowledge base

Keep your response detailed but concise.`;

        const requirementsAnalysis = await generateWithAI(
          requirementsPrompt,
          analysisAgent.systemPrompt,
          analysisAgent.model
        );

        sendSSEUpdate(req, 'STEP_COMPLETE', {
          agent: 'Requirements Analyst',
          task: 'Analyzing user requirements and extracting features',
          result: 'Successfully identified core features, user stories, and technical requirements',
          progress: 25,
          currentStep: 1,
          totalSteps: 4
        });

        orchestrationSteps.push({
          agent: 'Requirements Analyst',
          task: 'Analyzing user requirements',
          status: 'completed',
          dependencies: [],
        });

        // Step 2: UI Design
        sendSSEUpdate(req, 'STEP_START', {
          agent: 'UI Designer',
          task: 'Crafting beautiful and intuitive user interface',
          details: 'Designing component layouts, color schemes, typography, and interactive elements for optimal user experience',
          progress: 25,
          totalSteps: 4,
          currentStep: 2
        });

        const uiAgent =
          activeAgents.find(
            a => a.role?.includes('ui') || a.role?.includes('designer')
          ) || activeAgents[0];

        const uiPrompt = `Based on these requirements: ${requirementsAnalysis.text}

${existingProjectFiles.length > 0 ? `
🔄 EXISTING PROJECT FILES (maintain compatibility):
${formatExistingFiles(existingProjectFiles)}
` : ''}

RELEVANT KNOWLEDGE CONTEXT:
${formatKnowledgeContext(knowledgeContext)}

Design a React component with the following specifications:
- Modern, clean UI design
- Proper component structure
- Include all necessary interactive elements
- Use contemporary styling patterns
- Leverage recommended frameworks and libraries from the knowledge base
${existingProjectFiles.length > 0 ? '- Maintain consistency with existing UI patterns and styles' : ''}

Provide the component code in this format:
**src/ComponentName.tsx**
\`\`\`typescript
// component code here
\`\`\``;

        const uiDesign = await generateWithAI(
          uiPrompt,
          uiAgent.systemPrompt,
          uiAgent.model
        );

        sendSSEUpdate(req, 'STEP_COMPLETE', {
          agent: 'UI Designer',
          task: 'Crafting beautiful and intuitive user interface',
          result: 'UI design completed with modern components, responsive layouts, and accessibility features',
          progress: 50,
          currentStep: 2,
          totalSteps: 4
        });

        orchestrationSteps.push({
          agent: 'UI Designer',
          task: 'Designing user interface',
          status: 'completed',
          dependencies: ['Requirements Analyst'],
        });

        // Step 3: Code Generation
        sendSSEUpdate(req, 'STEP_START', {
          agent: 'Code Generator',
          task: 'Writing clean, production-ready code',
          details: 'Generating React components, implementing business logic, state management, API integrations, and ensuring type safety with TypeScript',
          progress: 50,
          totalSteps: 4,
          currentStep: 3
        });

        const codeAgent =
          activeAgents.find(
            a => a.role?.includes('developer') || a.role?.includes('coder')
          ) || activeAgents[0];

        const codePrompt = `Based on the UI design: ${uiDesign.text}

${existingProjectFiles.length > 0 ? `
🔄 EXISTING PROJECT FILES:
${existingProjectFiles.map(f => `- ${f.path}`).join('\n')}

IMPORTANT INSTRUCTIONS FOR ITERATIVE DEVELOPMENT:
1. Include ALL existing files in your response, even if they don't need changes
2. For files that don't need modification, return them with their original content
3. For files that need changes, apply ONLY the requested modifications
4. Add new files only if the user's request requires new functionality
5. Maintain the existing project structure and patterns

Full existing files:
${formatExistingFiles(existingProjectFiles)}
` : ''}

RELEVANT KNOWLEDGE CONTEXT:
${formatKnowledgeContext(knowledgeContext)}

🎯 CRITICAL: Generate a COMPLETE, PRODUCTION-READY Vite + React + TypeScript application.

📁 REQUIRED FILE STRUCTURE (you MUST include ALL of these):

1. **index.html** at root level - The Vite entry point
2. **src/package.json** - Dependencies (will be moved to root)
3. **src/tsconfig.json** - TypeScript config (will be moved to root)
4. **src/main.tsx** - React entry point
5. **src/App.tsx** - Main application component
6. **src/index.css** - Global styles

🚨 CRITICAL: You MUST start your response with index.html like this:

**index.html**
\`\`\`html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Your App Title</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
\`\`\`

Then include:

**src/package.json**
- Include ALL necessary dependencies (react, react-dom, typescript, vite, @types/react, @types/react-dom, @vitejs/plugin-react)
- Add any additional libraries needed for the specific app

**src/tsconfig.json**
- Standard React + TypeScript configuration for Vite

**src/main.tsx** - React entry point that renders App

**src/App.tsx** - Main application component with full logic
**src/main.tsx** - Entry point (React 18 createRoot)
**src/index.css** - Complete styling (use Tailwind-style utility classes or CSS)

📋 REQUIREMENTS FOR EACH FILE:
1. **App.tsx**: Must contain ALL business logic, state management, effects, and UI
   - Use React hooks (useState, useEffect, etc.)
   - Implement the COMPLETE feature set described in the user's request
   - Include proper error handling and loading states
   - Make it fully functional, not a placeholder

2. **main.tsx**: Must properly initialize React 18 with createRoot
   - Import and render the App component
   - Include index.css import

3. **index.css**: Must include ALL styling needed
   - Define colors, layouts, responsive breakpoints
   - Include hover states, animations, transitions
   - Make it visually appealing

4. **package.json**: Must include:
   - Correct package name (based on the app idea)
   - React 18+ and dependencies
   - Vite 4+ as dev dependency
   - TypeScript and type definitions
   - Any additional libraries the app needs (date-fns, chart.js, etc.)
   - Proper scripts: "dev": "vite", "build": "tsc && vite build"

5. **tsconfig.json**: Standard Vite + React config

🎨 CODE QUALITY STANDARDS:
- Write PRODUCTION-READY code (not TODO comments or placeholders)
- Implement REAL functionality (actual calculations, data processing, API calls if needed)
- Use modern ES6+ syntax (arrow functions, destructuring, async/await)
- Add proper TypeScript types (interfaces, type annotations)
- Include error boundaries and validation
- Make UI responsive (mobile, tablet, desktop)
- Add animations and smooth transitions
- Use semantic HTML and accessibility attributes

🚀 FUNCTIONALITY CHECKLIST:
- [ ] All features from the user's request are FULLY implemented
- [ ] State management is complete and working
- [ ] User interactions trigger actual logic (not console.logs)
- [ ] Forms have validation and submission handling
- [ ] API calls (if needed) use fetch/axios with error handling
- [ ] Loading and error states are shown to users
- [ ] Data persists appropriately (localStorage, state, etc.)

Format each file as:
**filepath**
\`\`\`language
complete code here
\`\`\`

REMEMBER: This app must work immediately when deployed to WebContainer. No missing files, no incomplete features!`;

        const generatedCode = await generateWithAI(
          codePrompt,
          codeAgent.systemPrompt,
          codeAgent.model
        );

        sendSSEUpdate(req, 'STEP_COMPLETE', {
          agent: 'Code Generator',
          task: 'Writing clean, production-ready code',
          result: 'Generated complete application with all components, hooks, styling, and configuration files',
          progress: 75,
          currentStep: 3,
          totalSteps: 4
        });

        orchestrationSteps.push({
          agent: 'Code Generator',
          task: 'Generating application code',
          status: 'completed',
          dependencies: ['UI Designer'],
        });

        // Step 4: Finalization
        sendSSEUpdate(req, 'STEP_START', {
          agent: 'Completion Agent',
          task: 'Finalizing and optimizing your application',
          details: 'Polishing code, ensuring quality standards, validating all features, and preparing for deployment',
          progress: 75,
          totalSteps: 4,
          currentStep: 4
        });

        // Update orchestration plan
        orchestrationPlan.subtasks = orchestrationSteps;

        // Send final orchestration update
        sendSSEUpdate(req, 'ORCHESTRATION_UPDATE', {
          plan: orchestrationPlan,
        });

        // Generate the final component
        const workspaceId = Date.now().toString();
        const workspaceDir = path.join(
          process.cwd(),
          'workspaces',
          workspaceId
        );
        await fs.mkdir(workspaceDir, { recursive: true });

        const generatedComponent = await generateReactComponent(
          userPrompt,
          generatedCode.text,
          (file, index, total) => {
            // Stream each file to the client in real-time
            sendSSEUpdate(req, 'FILE_GENERATED', {
              file: {
                path: file.path,
                content: file.content
              },
              index,
              total,
              progress: Math.round((index / total) * 100)
            });
          }
        );
        finalResponse = {
          type: 'component',
          text: generatedCode.text,
          files: generatedComponent.files,
        };
      }

      // Send final completion
      sendSSEUpdate(req, 'STEP_COMPLETE', {
        agent: 'Completion Agent',
        task: 'Finalizing and optimizing your application',
        result: `✅ Application complete! Generated ${finalResponse.files?.length || 0} files with full functionality`,
        progress: 100,
        currentStep: 4,
        totalSteps: 4
      });

      // Send completion update
      sendSSEUpdate(req, 'GENERATION_COMPLETE', {
        message: 'Multi-agent orchestration completed successfully',
        filesGenerated: finalResponse.files?.length || 0
      });

      const response = {
        response: finalResponse,
        orchestrationPlan: {
          subtasks: orchestrationPlan.subtasks,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Error generating prompt response:', error);
      let errorMessage = 'Failed to generate response';
      let suggestion =
        'Please try again with a different prompt or check your input parameters';

      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        if (msg.includes('rate limit')) {
          errorMessage = 'Rate limit exceeded';
          suggestion = 'Please wait a moment before trying again';
        } else if (
          msg.includes('invalid_api_key') ||
          msg.includes('anthropic_api_key')
        ) {
          errorMessage = 'API configuration error';
          suggestion = 'Please check the server configuration';
        } else if (msg.includes('bad request')) {
          errorMessage = 'Invalid request format';
          suggestion = 'Please check your input and try again';
        } else if (msg.includes('ai api error')) {
          const errorJson = msg.split(' - ')[1];
          try {
            const parsedError = JSON.parse(errorJson);
            if (parsedError.error?.type === 'api_error') {
              errorMessage = 'AI service error';
              suggestion =
                'The AI service is experiencing issues. Please try again in a few moments.';
            }
          } catch {
            errorMessage = 'AI service is temporarily unavailable';
            suggestion = 'Please try again in a few moments';
          }
        }
      }

      // Send error update via SSE
      sendSSEUpdate(req, 'GENERATION_ERROR', {
        error: errorMessage,
        suggestion,
      });

      res.status(500).json({
        error: errorMessage,
        suggestion: suggestion,
      });
    }
  }
);

// GET endpoint to check rate limit status
router.get('/prompts/rate-limit-status', authenticateUser, getRateLimitStatus);

export default router;
