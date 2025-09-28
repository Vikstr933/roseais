import { Router } from 'express';
import { db } from '../../db';
import { agents, promptChains, promptTemplates } from '../../db/schema';
import { eq } from 'drizzle-orm';
import { generateReactComponent } from '../utils/componentGenerator';
import path from 'path';
import fs from 'fs/promises';
import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const router = Router();

async function getActiveAgents() {
  const rawAgents = await db.select().from(agents).where(eq(agents.isActive, 1));
  
  // Transform the data to parse JSON fields
  return rawAgents.map(agent => ({
    ...agent,
    capabilities: JSON.parse(agent.capabilities),
    expertise: JSON.parse(agent.expertise),
    frameworks: JSON.parse(agent.frameworks),
    libraries: JSON.parse(agent.libraries),
    bestPractices: JSON.parse(agent.bestPractices),
    customInstructions: agent.customInstructions ? JSON.parse(agent.customInstructions) : null,
    isActive: Boolean(agent.isActive)
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
  '7': 'Framer Motion'
};

const frameworkMappings = {
  '0': 'Next.js',
  '1': 'React',
  '2': 'Vue.js',
  '3': 'Angular',
  '4': 'Svelte',
  '5': 'Express',
  '6': 'NestJS'
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
  '9': 'Security'
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
  '9': 'Version Control'
};

// Helper function to map numeric indices to actual names
function mapIndices(indices: string, mappings: Record<string, string>): string {
  return indices
    .split(/[,\s]+/)
    .map(idx => mappings[idx] || idx)
    .filter(Boolean)
    .join(', ');
}

async function analyzePrompt(prompt: string): Promise<PromptAnalysis> {
  // Initialize with default analysis
  const analysis: PromptAnalysis = {
    type: 'text',
    complexity: 'simple',
    requirements: [],
    suggestedAgents: [],
    estimatedSteps: 1
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
    'ui element'
  ];

  // Complexity Analysis
  const complexityIndicators = {
    simple: ['basic', 'simple', 'single', 'static'],
    medium: ['interactive', 'dynamic', 'state', 'api', 'fetch'],
    complex: ['authentication', 'database', 'real-time', 'websocket', 'complex']
  };

  // Feature Detection
  const featurePatterns = [
    { pattern: /\b(state|useState)\b/i, requirement: 'State Management' },
    { pattern: /\b(api|fetch|axios)\b/i, requirement: 'API Integration' },
    { pattern: /\b(form|input|validation)\b/i, requirement: 'Form Handling' },
    { pattern: /\b(style|css|tailwind|sass)\b/i, requirement: 'Styling' },
    { pattern: /\b(test|jest|cypress)\b/i, requirement: 'Testing' },
    { pattern: /\b(typescript|ts)\b/i, requirement: 'TypeScript' },
    { pattern: /\b(animation|transition|motion)\b/i, requirement: 'Animations' }
  ];

  // Determine type
  if (componentKeywords.some(keyword => promptLower.includes(keyword)) ||
      /create|build|make|implement|develop.*(?:component|app|interface|widget|game)/i.test(promptLower)) {
    analysis.type = 'component';
  } else if (promptLower.includes('workflow') || promptLower.includes('process')) {
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
    'Styling': ['uiSpecialist', 'componentDeveloper'],
    'Testing': ['qaEngineer', 'componentDeveloper'],
    'TypeScript': ['typeScriptExpert', 'componentDeveloper'],
    'Animations': ['uiSpecialist', 'componentDeveloper']
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
      (analysis.complexity === 'complex' ? 3 : analysis.complexity === 'medium' ? 2 : 1) +
      (analysis.requirements.length * 0.5)
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

async function generateWithAI(prompt: string, systemPrompt: string, model: string): Promise<AIResponse> {
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
          'anthropic-version': '2023-06-01'
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
          messages: [{
            role: 'user',
            content: prompt
          }]
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('AI API error details:', errorData);
        throw new Error(`AI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
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
        path: file.path.replace(/^workspaces\/[^\/]+\//, `workspaces/${workspaceId}/`)
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
      await Promise.all(result.files.map(async (file: { path: string; content: string }) => {
        const filePath = path.join(workspaceDir, file.path);
        const fileDir = path.dirname(filePath);
        await fs.mkdir(fileDir, { recursive: true });
        await fs.writeFile(filePath, file.content);
      }));
      
      return {
        type: 'component',
        text: result.text || data.content[0].text,
        files: result.files
      };
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('AI API error details:', errorData);
      throw new Error(`AI API error: ${response.statusText} - ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    if (!data.content || !data.content[0] || !data.content[0].text) {
      throw new Error('Invalid response format from Claude-3');
    }
    
    return {
      type: 'text',
      text: data.content[0].text
    };
  } catch (error) {
    console.error('Error generating with AI:', error);
    if (error instanceof Error) {
      throw new Error(`AI generation failed: ${error.message}`);
    }
    throw error;
  }
}

router.post('/prompts/generate', async (req, res) => {
  try {
    const { systemPrompt, userPrompt, model = 'claude-3-5-sonnet-20241022', temperature = 0.7, orchestration = true } = req.body;
    
    // Send initial status
    sendSSEUpdate(req, 'GENERATION_START', { message: 'Starting multi-agent orchestration process' });

    // Get active agents for orchestration (always used now)
    const activeAgents = await getActiveAgents();
    
    // Initialize the orchestration plan
    const orchestrationPlan = {
      subtasks: [] as any[]
    };
    
    let finalResponse: AIResponse;

    // Always use orchestration now
      // Send orchestration start update
      sendSSEUpdate(req, 'ORCHESTRATION_START', { message: 'Starting AI orchestration process' });

      if (!activeAgents.length) {
        // Fallback to direct generation if no agents are active
        finalResponse = await generateWithAI(
          userPrompt,
          systemPrompt || 'You are a helpful AI that generates React applications.',
          model || 'claude-3-5-sonnet-20241022'
        );
      } else {
        // Use agent orchestration
        const orchestrationSteps = [];

        // Step 1: Requirements Analysis
        sendSSEUpdate(req, 'STEP_START', {
          agent: 'Requirements Analyst',
          task: 'Analyzing user requirements'
        });

        const analysisAgent = activeAgents.find(a => a.role?.includes('analyst') || a.role?.includes('requirement'))
                              || activeAgents[0];

        const requirementsPrompt = `Analyze the following user request and break it down into technical requirements:
"${userPrompt}"

Please provide:
1. Component structure needed
2. Features to implement
3. Dependencies required
4. UI/UX considerations

Keep your response detailed but concise.`;

        const requirementsAnalysis = await generateWithAI(
          requirementsPrompt,
          analysisAgent.systemPrompt,
          analysisAgent.model
        );

        orchestrationSteps.push({
          agent: 'Requirements Analyst',
          task: 'Analyzing user requirements',
          status: 'completed',
          dependencies: []
        });

        // Step 2: UI Design
        sendSSEUpdate(req, 'STEP_START', {
          agent: 'UI Designer',
          task: 'Designing user interface'
        });

        const uiAgent = activeAgents.find(a => a.role?.includes('ui') || a.role?.includes('designer'))
                        || activeAgents[0];

        const uiPrompt = `Based on these requirements: ${requirementsAnalysis.text}

Design a React component with the following specifications:
- Modern, clean UI design
- Proper component structure
- Include all necessary interactive elements
- Use contemporary styling patterns

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

        orchestrationSteps.push({
          agent: 'UI Designer',
          task: 'Designing user interface',
          status: 'completed',
          dependencies: ['Requirements Analyst']
        });

        // Step 3: Code Generation
        sendSSEUpdate(req, 'STEP_START', {
          agent: 'Code Generator',
          task: 'Generating application code'
        });

        const codeAgent = activeAgents.find(a => a.role?.includes('developer') || a.role?.includes('coder'))
                          || activeAgents[0];

        const codePrompt = `Based on the UI design: ${uiDesign.text}

Generate a complete React application with the following files:

**src/App.tsx** - Main component
**src/main.tsx** - Entry point
**src/index.css** - Styles
**package.json** - Dependencies (if needed)

Requirements:
- Functional, working React code
- Modern React patterns (hooks, functional components)
- TypeScript support
- Clean, readable code
- Proper error handling
- Responsive design

Format each file as:
**filename**
\`\`\`language
code here
\`\`\``;

        const generatedCode = await generateWithAI(
          codePrompt,
          codeAgent.systemPrompt,
          codeAgent.model
        );

        orchestrationSteps.push({
          agent: 'Code Generator',
          task: 'Generating application code',
          status: 'completed',
          dependencies: ['UI Designer']
        });

        // Update orchestration plan
        orchestrationPlan.subtasks = orchestrationSteps;

        // Send final orchestration update
        sendSSEUpdate(req, 'ORCHESTRATION_UPDATE', {
          plan: orchestrationPlan
        });

        // Generate the final component
        const workspaceId = Date.now().toString();
        const workspaceDir = path.join(process.cwd(), 'workspaces', workspaceId);
        await fs.mkdir(workspaceDir, { recursive: true });

        const generatedComponent = await generateReactComponent(userPrompt, generatedCode.text);
        finalResponse = {
          type: 'component',
          text: generatedCode.text,
          files: generatedComponent.files
        };
      }

      // Send completion update
      sendSSEUpdate(req, 'GENERATION_COMPLETE', {
        message: 'Multi-agent orchestration completed successfully'
      });

    const response = {
      response: finalResponse,
      orchestrationPlan: {
        subtasks: orchestrationPlan.subtasks
      }
    };

    res.json(response);
  } catch (error) {
    console.error('Error generating prompt response:', error);
    let errorMessage = 'Failed to generate response';
    let suggestion = 'Please try again with a different prompt or check your input parameters';
    
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded';
        suggestion = 'Please wait a moment before trying again';
      } else if (msg.includes('invalid_api_key') || msg.includes('anthropic_api_key')) {
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
            suggestion = 'The AI service is experiencing issues. Please try again in a few moments.';
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
      suggestion
    });
    
    res.status(500).json({ 
      error: errorMessage,
      suggestion: suggestion
    });
  }
});

export default router;
