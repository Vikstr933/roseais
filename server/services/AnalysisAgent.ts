/**
 * Analysis Agent
 * 
 * Analyzes user requirements and creates a structured generation plan
 * with phases for incremental code generation.
 */

import { MultiModelAIService } from './MultiModelAIService';
import { SimpleLogger } from '../utils/SimpleLogger';
import { GenerationPlan, GenerationPhase } from './IncrementalOrchestrator';
import { db } from '../../db';
import { agents } from '../../db/schema-pg';
import { eq, or, and } from 'drizzle-orm';

export class AnalysisAgent {
  private logger: SimpleLogger;
  private multiModelAI: MultiModelAIService;

  constructor() {
    this.logger = new SimpleLogger('AnalysisAgent');
    this.multiModelAI = new MultiModelAIService();
  }

  /**
   * Analyze user prompt and create a generation plan
   * Now supports smart agent selection based on user prompt and available agents
   */
  async analyzeAndPlan(
    userPrompt: string,
    knowledgeContext: string = '',
    existingFiles: { path: string; content: string }[] = [],
    userId?: string,
    projectId?: number | null // Optional: for project-specific API key checks
  ): Promise<GenerationPlan> {
    this.logger.info(`Analyzing requirements and creating generation plan - promptLength: ${userPrompt.length}, hasKnowledgeContext: ${!!knowledgeContext}, existingFilesCount: ${existingFiles.length}, userId: ${userId || 'none'}`);

    // Step 1: Detect if fullstack app is needed
    const { fullstackIntegrationService } = await import('./FullstackIntegrationService');
    const fullstackConfig = await fullstackIntegrationService.detectFullstackNeeds(userPrompt, existingFiles);
    this.logger.info(`Fullstack detection: needsBackend=${fullstackConfig.needsBackend}, backendType=${fullstackConfig.backendType}, endpoints=${fullstackConfig.apiEndpoints.length}, requiredApiKeys=${fullstackConfig.requiredApiKeys?.join(',') || 'none'}`);

    // Step 2: Find relevant agents (system + user-created)
    const relevantAgents = await this.findRelevantAgents(userPrompt, userId);
    this.logger.info(`Found ${relevantAgents.length} relevant agents for this prompt`);

    // Step 3: Check API key requirements for user-created agents
    const agentsWithKeys = await this.checkAgentAPIKeys(relevantAgents, userId);
    this.logger.info(`After API key check: ${agentsWithKeys.length} agents available`);
    
    // Collect all missing API keys (from agents + backend requirements)
    const allMissingKeys = new Set<string>();
    
    // Check agent API keys
    const agentsMissingKeys = agentsWithKeys.filter(agent => !agent.hasAllKeys && agent.missingKeys.length > 0);
    if (agentsMissingKeys.length > 0) {
      agentsMissingKeys.forEach(agent => {
        agent.missingKeys.forEach((key: string) => allMissingKeys.add(key));
      });
    }
    
    // Check backend API key requirements
    if (fullstackConfig.requiredApiKeys && fullstackConfig.requiredApiKeys.length > 0) {
      // Check if user has these API keys configured
      const apiKeyServiceModule = await import('./APIKeyService');
      const apiKeyService = apiKeyServiceModule.apiKeyService || apiKeyServiceModule.default;
      for (const apiKey of fullstackConfig.requiredApiKeys) {
        const hasKey = await apiKeyService.hasAPIKey(userId || 'anonymous', apiKey, projectId);
        if (!hasKey) {
          allMissingKeys.add(apiKey);
          this.logger.info(`Backend requires API key: ${apiKey} (not configured)`);
        }
      }
    }
    
    // Emit API_KEY_REQUIRED event if any API keys are missing
    if (allMissingKeys.size > 0) {
      try {
        // Lazy import to avoid circular dependency
        const { agentEventEmitter } = await import('../index');
        const emitter = agentEventEmitter;
        
        const missingKeysArray = Array.from(allMissingKeys);
        const message = agentsMissingKeys.length > 0 && fullstackConfig.requiredApiKeys && fullstackConfig.requiredApiKeys.length > 0
          ? `API keys required for ${agentsMissingKeys.length} agent(s) and backend: ${missingKeysArray.join(', ')}`
          : agentsMissingKeys.length > 0
          ? `API keys required for ${agentsMissingKeys.length} agent(s): ${missingKeysArray.join(', ')}`
          : `API keys required for backend: ${missingKeysArray.join(', ')}`;
        
        emitter.emit('agent-event', {
          type: 'API_KEY_REQUIRED',
          missingApiKeys: missingKeysArray,
          databaseType: fullstackConfig.databaseType || 'postgresql',
          message
        });
        
        this.logger.info(`Emitted API_KEY_REQUIRED event for missing keys: ${missingKeysArray.join(', ')}`);
      } catch (error) {
        this.logger.warn('Failed to emit API_KEY_REQUIRED event', error as Error);
      }
    }

    // Step 4: Build analysis prompt with agent information and fullstack config
    const analysisPrompt = this.buildAnalysisPrompt(userPrompt, knowledgeContext, existingFiles, agentsWithKeys, fullstackConfig);

    try {
      // Get agent configuration from database (system prompt, model, temperature)
      const agentConfig = await this.getAgentConfig();
      this.logger.info(`Using component-architect agent for analysis - model: ${agentConfig.model}, temperature: ${agentConfig.temperature}`);
      
      // Force Opus 4.5 for delegation/analysis tasks (highest quality reasoning)
      const preferredModel = 'claude-opus-4-5-20251101';
      const response = await this.multiModelAI.generate({
        prompt: analysisPrompt,
        systemPrompt: agentConfig.systemPrompt,
        maxTokens: 4000,
        temperature: agentConfig.temperature,
        useCase: 'code_generation',
        priority: 'quality',
        preferredModel // Request Opus 4.5 specifically for delegation
      });

      // Parse the response to extract the plan
      const plan = this.parsePlanResponse(response.content, userPrompt);

      // Step 5: Add backend phases if fullstack is needed
      if (fullstackConfig.needsBackend) {
        this.addBackendPhases(plan, fullstackConfig);
        this.logger.info(`Added backend phases to plan - total phases: ${plan.phases.length}`);
      }

      this.logger.info(`Generation plan created - appName: ${plan.appName}, phases: ${plan.phases.length}, needsBackend: ${fullstackConfig.needsBackend}`);

      return plan;
    } catch (error) {
      this.logger.error('Failed to create generation plan', error as Error);
      // Return a default plan as fallback
      return this.createDefaultPlan(userPrompt);
    }
  }

  /**
   * Find relevant agents based on user prompt and capabilities
   */
  private async findRelevantAgents(
    userPrompt: string,
    userId?: string
  ): Promise<Array<{
    id: string;
    name: string;
    capabilities: any;
    requiredApiKeys: any[];
    apiEndpoint?: string;
    apiConfig?: any;
  }>> {
    try {
      const promptLower = userPrompt.toLowerCase();
      
      // Build query: system agents OR user's agents
      const conditions = [
        eq(agents.isActive, true),
        or(
          eq(agents.isSystem, 1), // System agents (1 = true)
          ...(userId ? [eq(agents.userId, userId)] : []) // User's agents
        )!
      ];

      const allAgents = await db
        .select({
          id: agents.id,
          name: agents.name,
          capabilities: agents.capabilities,
          requiredApiKeys: agents.requiredApiKeys,
          apiEndpoint: agents.apiEndpoint,
          apiConfig: agents.apiConfig,
          description: agents.description,
          role: agents.role,
        })
        .from(agents)
        .where(and(...conditions));

      // Filter agents based on prompt keywords and capabilities
      const relevantAgents = allAgents.filter(agent => {
        const caps = agent.capabilities || {};
        const specialties = caps.specialties || [];
        const apiIntegrations = caps.apiIntegrations || [];

        // Check if prompt mentions agent's specialties
        const matchesSpecialty = specialties.some((spec: string) =>
          promptLower.includes(spec.toLowerCase())
        );

        // Check if prompt mentions API integrations
        const matchesAPI = apiIntegrations.some((api: string) =>
          promptLower.includes(api.toLowerCase().replace(/-/g, ' '))
        );

        // Check keywords
        const keywords = [
          'stock', 'price', 'financial', 'market',
          'product', 'catalog', 'inventory', 'ecommerce',
          'chatbot', 'chat', 'assistant',
          'api', 'integration', 'data'
        ];

        const matchesKeywords = keywords.some(keyword => {
          if (promptLower.includes(keyword)) {
            // Check if agent has related capabilities
            return matchesSpecialty || matchesAPI || 
                   (caps.canAccessAPIs && keyword.includes('api')) ||
                   (caps.specialties && JSON.stringify(caps.specialties).toLowerCase().includes(keyword));
          }
          return false;
        });

        return matchesSpecialty || matchesAPI || matchesKeywords;
      });

      return relevantAgents;
    } catch (error) {
      this.logger.error('Failed to find relevant agents', error as Error);
      return [];
    }
  }

  /**
   * Check if user has required API keys for agents
   */
  private async checkAgentAPIKeys(
    agents: Array<{
      id: string;
      requiredApiKeys: any[];
    }>,
    userId?: string
  ): Promise<Array<{
    id: string;
    name: string;
    capabilities: any;
    requiredApiKeys: any[];
    apiEndpoint?: string;
    apiConfig?: any;
    hasAllKeys: boolean;
    missingKeys: any[];
  }>> {
    if (!userId) {
      // No user = only return agents that don't need API keys
      return agents
        .filter(agent => !agent.requiredApiKeys || agent.requiredApiKeys.length === 0)
        .map(agent => ({
          ...agent,
          hasAllKeys: true,
          missingKeys: []
        }));
    }

    try {
      const apiKeyServiceModule = await import('./APIKeyService');
      const apiKeyService = apiKeyServiceModule.apiKeyService || apiKeyServiceModule.default;
      const results = [];

      for (const agent of agents) {
        if (!agent.requiredApiKeys || agent.requiredApiKeys.length === 0) {
          // No API keys required
          results.push({
            ...agent,
            hasAllKeys: true,
            missingKeys: []
          });
        } else {
          // Check if user has required keys
          const checkResult = await apiKeyService.checkRequiredAPIKeys(
            userId,
            agent.requiredApiKeys
          );

          results.push({
            ...agent,
            hasAllKeys: checkResult.hasAllKeys,
            missingKeys: checkResult.missingKeys
          });
        }
      }

      return results;
    } catch (error) {
      this.logger.error('Failed to check agent API keys', error as Error);
      // Return agents without API key requirements
      return agents
        .filter(agent => !agent.requiredApiKeys || agent.requiredApiKeys.length === 0)
        .map(agent => ({
          ...agent,
          hasAllKeys: true,
          missingKeys: []
        }));
    }
  }

  /**
   * Add backend phases to generation plan
   */
  private addBackendPhases(
    plan: GenerationPlan,
    fullstackConfig: any
  ): void {
    // Find the last phase index
    const lastPhaseIndex = plan.phases.length;

    // Add backend foundation phase (after base phase)
    const basePhaseIndex = plan.phases.findIndex(p => p.phase === 'base');
    const insertIndex = basePhaseIndex >= 0 ? basePhaseIndex + 1 : 1;

    // Backend foundation phase
    // CRITICAL: Include client/package.json for monorepo structure to ensure vite command works
    plan.phases.splice(insertIndex, 0, {
      phase: 'backend-base',
      description: 'Backend server foundation and configuration',
      files: [
        'server/package.json',
        'server/.env.example',
        'server/index.js',
        'client/package.json', // CRITICAL: Ensure client/package.json exists for monorepo
        'client/vite.config.ts' // CRITICAL: Ensure vite config exists in client/
      ],
      dependencies: ['base'],
      agentId: 'component-developer'
    });

    // Backend routes phase
    plan.phases.splice(insertIndex + 1, 0, {
      phase: 'backend-routes',
      description: 'Backend API routes and endpoints',
      files: [
        'server/routes.js'
      ],
      dependencies: ['backend-base'],
      agentId: 'component-developer'
    });

    // Frontend API integration phase (after core frontend)
    const corePhaseIndex = plan.phases.findIndex(p => p.phase === 'core');
    if (corePhaseIndex >= 0) {
      plan.phases.splice(corePhaseIndex + 1, 0, {
        phase: 'frontend-api',
        description: 'Frontend API integration and configuration',
        files: [
          'src/lib/api.ts',
          '.env.example'
        ],
        dependencies: ['core', 'backend-routes'],
        agentId: 'component-developer'
      });
    }

    plan.totalPhases = plan.phases.length;
  }

  /**
   * Build the analysis prompt
   */
  private buildAnalysisPrompt(
    userPrompt: string,
    knowledgeContext: string,
    existingFiles: { path: string; content: string }[],
    availableAgents?: Array<{
      id: string;
      name: string;
      capabilities: any;
      hasAllKeys: boolean;
      missingKeys: any[];
    }>,
    fullstackConfig?: any
  ): string {
    const isModification = existingFiles.length > 0;
    const modificationKeywords = ['fix', 'change', 'update', 'modify', 'edit', 'add', 'remove', 'delete', 'improve', 'enhance'];
    const isModifyRequest = modificationKeywords.some(keyword => userPrompt.toLowerCase().includes(keyword));
    
    const existingFilesSection = existingFiles.length > 0 ? `
🔄 EXISTING PROJECT FILES (${existingFiles.length} files):
${existingFiles.map(f => `- ${f.path}`).join('\n')}

${isModifyRequest ? '⚠️ MODIFICATION REQUEST DETECTED ⚠️' : '📦 PROJECT CONTINUATION'}
` : '';

    const modificationInstructions = isModification ? `
CRITICAL: This is a MODIFICATION request for an existing project.

IMPORTANT RULES FOR MODIFICATIONS:
1. **PRESERVE UNCHANGED FILES**: Only modify files that need changes based on the user's request
2. **MAINTAIN CONSISTENCY**: Keep the same coding style, patterns, and structure as existing files
3. **INCREMENTAL CHANGES**: Make minimal changes - only what's requested
4. **PRESERVE IMPORTS**: Keep existing imports unless they're no longer needed
5. **FILE STRUCTURE**: Don't reorganize files unless explicitly requested
6. **DEPENDENCIES**: Maintain compatibility with existing code
7. **READ EXISTING CODE FIRST**: Before modifying, understand the existing code structure, patterns, and logic
8. **AVOID BREAKING CHANGES**: Don't change function signatures, component props, or data structures unless necessary
9. **PRESERVE EXISTING FUNCTIONALITY**: Don't remove or break existing features unless explicitly requested
10. **VALIDATE LOGIC**: Ensure any new code doesn't introduce logical errors (e.g., comparisons that are always true/false)

When creating phases:
- Only include files that NEED to be modified or added
- Skip phases for files that don't need changes
- If a file needs a small change, include it in the appropriate phase
- If adding new features, create new files but keep existing ones intact
- When modifying existing files, provide the COMPLETE updated file content (not just diffs)
- Ensure modified code maintains the same structure and patterns as the original

CODE QUALITY REQUIREMENTS:
- **NO LOGICAL ERRORS**: Avoid comparisons that are always true/false (e.g., \`x !== (() => null)\` is always true)
- **PROPER TYPE CHECKING**: Use proper TypeScript types and null checks
- **VALIDATE COMPARISONS**: When checking if something is null/undefined, use proper checks: \`x !== null && x !== undefined\` or \`x != null\`
- **AVOID REDUNDANT CHECKS**: Don't compare functions to other functions - compare to null/undefined instead
- **TEST LOGIC**: Think through conditional logic to ensure it makes sense
` : '';

    return `Analyze the following user request and create a detailed generation plan for ${isModification ? 'modifying' : 'building'} the application incrementally.

USER REQUEST:
${userPrompt}

${knowledgeContext ? `RELEVANT KNOWLEDGE:\n${knowledgeContext}\n` : ''}

${existingFilesSection}

${modificationInstructions}

Your task is to create a generation plan that breaks down the ${isModification ? 'modification' : 'application'} into phases. Each phase should:
1. Build on previous phases
2. Include only related files
3. Be independently validatable
${isModification ? '4. Preserve files that don\'t need changes' : ''}

CRITICAL REQUIREMENTS FOR LANDING PAGES:
- **ALWAYS include CSS/styling files** for every component that needs visual design
- For landing pages: **MUST generate comprehensive, modern, visually appealing CSS** with:
  * **Modern color schemes**: Use gradients, vibrant colors, or sophisticated color palettes (not just basic blue/gray)
  * **Typography**: Large, bold headings (48px+ for hero), readable body text (16-18px), proper font weights and line heights
  * **Spacing**: Generous whitespace, proper padding (40-80px for sections), consistent margins
  * **Visual hierarchy**: Clear distinction between sections, proper heading sizes, visual separation
  * **Modern design elements**: Subtle shadows, rounded corners, smooth transitions, hover effects
  * **Layout**: Proper containers (max-width: 1200px), centered content, flexbox/grid for responsive layouts
  * **Buttons**: Prominent, well-styled CTAs with hover effects, proper sizing (min-height: 48px), rounded corners
  * **Responsive design**: Mobile-first approach with breakpoints at 640px, 768px, 1024px
  * **Animations**: Smooth transitions (0.2s-0.3s), subtle hover effects, fade-ins if appropriate
- If the user requests a "landing page", "nice landing page", or mentions "design", the CSS MUST be production-ready and visually impressive
- Do NOT generate minimal or basic CSS - landing pages need full, comprehensive styling

Create a plan with the following structure:

PHASE 1: BASE FOUNDATION
- Files: package.json, tsconfig.json, index.html, src/main.tsx
- Purpose: Set up project configuration and entry points
- Dependencies: None

PHASE 2: CORE COMPONENT WITH STYLING
- Files: src/App.tsx, src/index.css (with FULL, MODERN styling)
- Purpose: Create main application component and comprehensive, visually appealing styling
- Dependencies: Phase 1
- **CRITICAL FOR LANDING PAGES**: The CSS file MUST include:
  * **Modern color palette**: CSS variables for primary/secondary/accent colors, gradients for hero sections
  * **Typography system**: Large hero headings (3-4rem), readable body text (1rem), proper font weights (400, 600, 700)
  * **Layout system**: Max-width containers (1200px), proper padding (2-4rem), flexbox/grid for responsive layouts
  * **Component styles**: Styled buttons (primary/secondary variants), navigation bars, hero sections, feature cards
  * **Spacing system**: Consistent spacing scale (0.5rem, 1rem, 1.5rem, 2rem, 3rem, 4rem)
  * **Responsive breakpoints**: @media queries for mobile (<640px), tablet (640-1024px), desktop (>1024px)
  * **Modern effects**: Box shadows, border-radius (8-16px), smooth transitions (0.2s ease), hover states
  * **Visual polish**: Proper contrast ratios, smooth animations, professional appearance

PHASE 3+: ADDITIONAL FEATURES WITH STYLING
- Add phases for types, hooks, utilities, additional components
- **Each component phase MUST include its CSS/styling file** if the component needs visual design
- Each phase should depend on previous phases

${fullstackConfig?.needsBackend ? `
🚨 CRITICAL: FULLSTACK APPLICATION DETECTED 🚨

This application requires a BACKEND SERVER. You MUST include backend phases in your plan:

BACKEND PHASES (Add these after base phase):
1. **backend-base** phase:
   - Files: server/package.json, server/.env.example, server/index.js, client/package.json, client/vite.config.ts
   - Purpose: Set up Express server with CORS, middleware, and basic configuration
   - **CRITICAL FOR MONOREPO**: This creates a monorepo structure with client/ and server/ directories
   - **CRITICAL**: client/package.json MUST include:
     * "dev": "vite" script
     * vite in devDependencies (^7.1.7)
     * @vitejs/plugin-react in devDependencies (^5.0.0)
     * react and react-dom in dependencies
   - **CRITICAL**: client/vite.config.ts MUST exist with proper Vite configuration
   - Dependencies: ["base"]
   - **CRITICAL**: server/index.js MUST include:
     * Express setup with CORS enabled (origin: http://localhost:5173)
     * JSON body parser middleware
     * Health check endpoint (/health)
     * Server listening on port 3001 (or from env)
     * Import and use routes from ./routes.js

2. **backend-routes** phase:
   - Files: server/routes.js
   - Purpose: Create API endpoints that frontend will call
   - Dependencies: ["backend-base"]
   - **CRITICAL**: server/routes.js MUST include:
     * Express router setup
     * All API endpoints: ${fullstackConfig.apiEndpoints.join(', ')}
     * Proper error handling (try/catch)
     * JSON responses
     * ${fullstackConfig.databaseType !== 'none' ? `Database connection setup (${fullstackConfig.databaseType})` : 'Mock data for now (can be connected to database later)'}

3. **frontend-api** phase (Add after core phase):
   - Files: src/lib/api.ts, .env.example
   - Purpose: Configure frontend to call backend API
   - Dependencies: ["core", "backend-routes"]
   - **CRITICAL**: src/lib/api.ts MUST include:
     * API_BASE_URL constant (use VITE_API_URL env var or default to http://localhost:3001)
     * Helper functions: api.get(), api.post(), api.put(), api.delete()
     * Proper error handling
     * Content-Type headers
   - **CRITICAL**: .env.example MUST include:
     * VITE_API_URL=http://localhost:3001

**INTEGRATION REQUIREMENTS:**
- Frontend components MUST use the api helper from src/lib/api.ts
- All API calls MUST use the correct endpoints: ${fullstackConfig.apiEndpoints.join(', ')}
- CORS MUST be configured in backend to allow requests from http://localhost:5173
- Backend and frontend MUST be properly connected - no manual configuration needed
- Environment variables MUST be set up correctly in both frontend and backend
` : ''}

Respond with a JSON object in this format:
{
  "appName": "Snake Game",
  "appType": "game",
  "techStack": {
    "framework": "React",
    "buildTool": "Vite",
    "language": "TypeScript"
  },
  "phases": [
    {
      "phase": "base",
      "description": "Project foundation and configuration",
      "files": ["package.json", "tsconfig.json", "index.html", "src/main.tsx"],
      "dependencies": [],
      "agentId": "component-developer"
    },
    {
      "phase": "core",
      "description": "Main application component",
      "files": ["src/App.tsx", "src/index.css"],
      "dependencies": ["base"],
      "agentId": "component-developer"
    }
  ]
}

IMPORTANT - SEQUENTIAL DEPENDENCIES:
- Keep phases small and focused (one concern per phase)
- **CRITICAL: Each phase MUST depend on the PREVIOUS phase, not just "base"**
  - Good: types → hooks (depends on types) → core (depends on hooks)
  - Bad: types, hooks, core all depending only on "base" (causes parallel execution issues!)
- Phases that import from other phases MUST list those phases as dependencies
- Example correct dependencies for a timer app:
  - base: [] (no dependencies)
  - types: ["base"] (types only need config files)
  - hooks: ["types"] (hooks import types, so depends on types)
  - core: ["hooks"] (App.tsx imports hooks and types, depends on hooks which chains to types)
- Include all necessary files
- Use "component-developer" as agentId for code generation phases`;
  }

  /**
   * Parse the AI response to extract the generation plan
   */
  private parsePlanResponse(response: string, userPrompt: string): GenerationPlan {
    try {
      // Try to extract JSON from the response
      let jsonStr = response.trim();

      // Remove markdown code blocks if present
      if (jsonStr.startsWith('```')) {
        jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/i, '');
        jsonStr = jsonStr.replace(/\n?```\s*$/i, '');
        jsonStr = jsonStr.trim();
      }

      // Try to find JSON object
      const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        jsonStr = jsonMatch[0];
      }

      const planData = JSON.parse(jsonStr);

      // Validate and normalize the plan
      return this.normalizePlan(planData, userPrompt);
    } catch (error) {
      this.logger.warn(`Failed to parse plan response, using default plan: ${error instanceof Error ? error.message : String(error)}`);
      return this.createDefaultPlan(userPrompt);
    }
  }

  /**
   * Normalize and validate the plan
   * CRITICAL: Enforces sequential execution by ensuring proper dependency chains
   */
  private normalizePlan(planData: any, userPrompt: string): GenerationPlan {
    // Extract app name from prompt or use default
    const appName = planData.appName || this.extractAppName(userPrompt) || 'GeneratedApp';
    const appType = planData.appType || this.detectAppType(userPrompt) || 'app';

    // Normalize phases
    let phases: GenerationPhase[] = (planData.phases || []).map((p: any, index: number) => ({
      phase: p.phase || `phase-${index + 1}`,
      description: p.description || `Phase ${index + 1}`,
      files: Array.isArray(p.files) ? p.files : [],
      dependencies: Array.isArray(p.dependencies) ? p.dependencies : [],
      agentId: p.agentId || 'component-developer'
    }));

    // Ensure we have at least base and core phases
    if (phases.length === 0) {
      phases.push(
        {
          phase: 'base',
          description: 'Project foundation',
          files: ['package.json', 'tsconfig.json', 'index.html', 'src/main.tsx'],
          dependencies: [],
          agentId: 'component-developer'
        },
        {
          phase: 'core',
          description: 'Main application component',
          files: ['src/App.tsx', 'src/index.css'],
          dependencies: ['base'],
          agentId: 'component-developer'
        }
      );
    }

    // CRITICAL FIX: Enforce sequential execution by chaining dependencies
    // This ensures each phase sees ALL previous phases' output, not just its declared dependencies
    // Parallel execution was causing context loss (e.g., hooks phase didn't see types phase output)
    phases = this.enforceSequentialDependencies(phases);

    return {
      appName,
      appType,
      techStack: {
        framework: planData.techStack?.framework || 'React',
        buildTool: planData.techStack?.buildTool || 'Vite',
        language: planData.techStack?.language || 'TypeScript'
      },
      phases,
      totalPhases: phases.length
    };
  }

  /**
   * Enforce sequential dependencies to prevent parallel execution issues
   * 
   * Problem: AI generates plans like:
   *   - base: []
   *   - types: ["base"]
   *   - hooks: ["base"]   ← Can run parallel with types, doesn't see types output!
   *   - core: ["base"]    ← Can run parallel, doesn't see hooks or types!
   * 
   * Fix: Chain dependencies so each phase depends on ALL previous phases:
   *   - base: []
   *   - types: ["base"]
   *   - hooks: ["types"]  ← Now waits for types, sees its output
   *   - core: ["hooks"]   ← Now waits for hooks, sees all previous output
   */
  private enforceSequentialDependencies(phases: GenerationPhase[]): GenerationPhase[] {
    if (phases.length <= 1) return phases;

    const result: GenerationPhase[] = [];
    
    for (let i = 0; i < phases.length; i++) {
      const phase = { ...phases[i] };
      
      if (i === 0) {
        // First phase has no dependencies
        phase.dependencies = [];
      } else {
        // Each subsequent phase depends on the previous phase
        // This creates a chain: base -> types -> hooks -> core
        const previousPhase = phases[i - 1].phase;
        
        // Keep existing dependencies but ensure the previous phase is included
        const existingDeps = new Set(phase.dependencies);
        existingDeps.add(previousPhase);
        phase.dependencies = Array.from(existingDeps);
      }
      
      result.push(phase);
    }

    this.logger.info(`Enforced sequential dependencies: ${result.map(p => `${p.phase}:[${p.dependencies.join(',')}]`).join(' -> ')}`);
    
    return result;
  }

  /**
   * Create a default plan when analysis fails
   */
  private createDefaultPlan(userPrompt: string): GenerationPlan {
    const appName = this.extractAppName(userPrompt) || 'GeneratedApp';
    const appType = this.detectAppType(userPrompt) || 'app';

    return {
      appName,
      appType,
      techStack: {
        framework: 'React',
        buildTool: 'Vite',
        language: 'TypeScript'
      },
      phases: [
        {
          phase: 'base',
          description: 'Project foundation and configuration',
          files: ['package.json', 'tsconfig.json', 'index.html', 'src/main.tsx'],
          dependencies: [],
          agentId: 'component-developer'
        },
        {
          phase: 'core',
          description: 'Main application component and styling',
          files: ['src/App.tsx', 'src/index.css'],
          dependencies: ['base'],
          agentId: 'component-developer'
        }
      ],
      totalPhases: 2
    };
  }

  /**
   * Extract app name from prompt
   */
  private extractAppName(prompt: string): string {
    // Try to find app name patterns
    const patterns = [
      /(?:create|build|make|generate)\s+(?:a|an|the)?\s+([A-Z][a-zA-Z\s]+?)(?:\s+app|game|component|tool)/i,
      /([A-Z][a-zA-Z\s]+?)(?:\s+app|game|component|tool)/i,
      /"([^"]+)"/,
      /'([^']+)'/
    ];

    for (const pattern of patterns) {
      const match = prompt.match(pattern);
      if (match && match[1]) {
        return match[1].trim().replace(/\s+/g, ' ');
      }
    }

    return '';
  }

  /**
   * Detect app type from prompt
   */
  private detectAppType(prompt: string): string {
    const lowerPrompt = prompt.toLowerCase();

    if (lowerPrompt.includes('game')) return 'game';
    if (lowerPrompt.includes('todo') || lowerPrompt.includes('task')) return 'todo';
    if (lowerPrompt.includes('calculator')) return 'calculator';
    if (lowerPrompt.includes('dashboard')) return 'dashboard';
    if (lowerPrompt.includes('chat') || lowerPrompt.includes('messenger')) return 'chat';
    if (lowerPrompt.includes('blog')) return 'blog';
    if (lowerPrompt.includes('ecommerce') || lowerPrompt.includes('shop')) return 'ecommerce';

    return 'app';
  }

  /**
   * Get agent configuration from database
   * Uses component-architect agent if available, otherwise falls back to default
   */
  private async getAgentConfig(): Promise<{
    systemPrompt: string;
    model: string;
    temperature: number;
  }> {
    try {
      // Try to load component-architect agent from database
      const agentResults = await db
        .select()
        .from(agents)
        .where(eq(agents.id, 'component-architect'));

      if (agentResults.length > 0) {
        const agent = agentResults[0];
        this.logger.info(`Using component-architect agent from database for analysis - model: ${agent.model}, temperature: ${agent.temperature}`);
        
        return {
          systemPrompt: agent.systemPrompt || this.getDefaultPrompt(),
          model: agent.model || 'claude-sonnet-4-5-20250929',
          temperature: agent.temperature || 0.3
        };
      }

      // Fallback to default if agent not found
      this.logger.warn('component-architect agent not found in database, using defaults');
      return {
        systemPrompt: this.getDefaultPrompt(),
        model: 'claude-opus-4-5-20251101', // Use Opus 4.5 as default for delegation
        temperature: 0.3
      };
    } catch (error) {
      this.logger.error('Failed to load component-architect agent from database', error as Error);
      return {
        systemPrompt: this.getDefaultPrompt(),
        model: 'claude-opus-4-5-20251101', // Use Opus 4.5 as default for delegation
        temperature: 0.3
      };
    }
  }

  /**
   * Get usage guidance for an agent
   */
  private getAgentUsageGuidance(agentId: string, capabilities: any): string {
    if (agentId.includes('stylist') || agentId.includes('style') || capabilities?.canGenerateStyles) {
      return 'CSS/styling phases';
    }
    if (agentId.includes('qa') || agentId.includes('test') || capabilities?.canGenerateTests) {
      return 'Test generation phases';
    }
    if (agentId.includes('stock') || agentId.includes('price')) {
      return 'Phases that need stock price data';
    }
    if (agentId.includes('product') || agentId.includes('catalog')) {
      return 'Phases that need product catalog data';
    }
    if (capabilities?.canAccessAPIs) {
      return 'Phases that need API data integration';
    }
    return 'General code generation';
  }

  /**
   * Get default prompt for analysis
   */
  private getDefaultPrompt(): string {
    return `You are an expert software architect. Your task is to analyze user requirements and create a detailed, incremental generation plan for building applications.

Key principles:
1. Break down the application into logical phases
2. Each phase should build on previous phases
3. Keep phases small and focused
4. **CRITICAL: Ensure SEQUENTIAL dependencies** - each phase depends on the PREVIOUS phase
5. Include all necessary files

## 🚨 CRITICAL: Sequential Phase Dependencies 🚨
Phases MUST be chained sequentially so each phase sees all previous output:
- base: [] (no dependencies, generates config files)
- types: ["base"] (generates TypeScript interfaces)
- hooks: ["types"] (generates hooks that import types) ← NOT ["base"]!
- core: ["hooks"] (generates App.tsx that imports hooks and types) ← NOT ["base"]!

WHY: Phases with the same dependencies run in PARALLEL and don't see each other's output!
If types, hooks, and core all depend on ["base"], they run simultaneously and can't import from each other.

## 🚨 CRITICAL: Component Export/Import Structure 🚨
When planning component structure, ensure:
- Components in \`src/components/*.tsx\` use NAMED exports: \`export function ComponentName() { ... }\`
- Main App (\`src/App.tsx\`) uses DEFAULT export: \`export default function App() { ... }\`
- Import statements match export types (named import → named export, default import → default export)
- All components in \`src/components/\` should use named exports for consistency

Always respond with valid JSON in the specified format.`;
  }
}

