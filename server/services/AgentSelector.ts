/**
 * Intelligent Agent Selection Service - FULLY AUTONOMOUS
 * Dynamically loads agents from database and uses AI to select the best ones
 * 
 * NEW: No hardcoded agent lists - completely database-driven
 * NEW: AI analyzes capabilities and expertise from database
 * NEW: Automatically adapts when new agents are added to database
 */

import { MultiModelAIService } from './MultiModelAIService';
import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { agents } from '../../db/schema-pg';
import { eq, and } from 'drizzle-orm';

const logger = new SimpleLogger('AgentSelector');

interface DatabaseAgent {
  id: string;
  name: string;
  description: string;
  role: string;
  capabilities: any; // JSONB - already parsed by Drizzle
  expertise: any; // JSONB - already parsed by Drizzle
}

export interface AgentRequirement {
  agentType: string;
  priority: 'required' | 'optional' | 'skip';
  reason: string;
}

export interface AgentSelectionResult {
  selectedAgents: string[];
  reasoning: string;
  complexity: 'simple' | 'moderate' | 'complex';
  estimatedDuration: number; // in seconds
  aiEnhanced?: boolean; // Whether AI was used for this analysis
}

export class AgentSelector {
  private multiModelAI: MultiModelAIService;
  private useAIThreshold: number = 3; // LOWERED: Use AI more often for dynamic selection
  private availableAgentsCache: DatabaseAgent[] | null = null;
  private cacheTimestamp: number = 0;
  private cacheTTL: number = 60000; // Cache agents for 60 seconds

  constructor() {
    this.multiModelAI = new MultiModelAIService();
  }

  /**
   * Analyze a prompt and determine which agents are needed
   * FULLY AUTONOMOUS: Loads agents from database and uses AI for intelligent selection
   */
  async analyzePrompt(prompt: string): Promise<AgentSelectionResult> {
    const promptLower = prompt.toLowerCase();

    // STEP 1: Load all available agents from database (cached)
    const availableAgents = await this.loadAvailableAgents();
    
    if (availableAgents.length === 0) {
      logger.warn('No agents found in database, using minimal fallback');
      return this.getMinimalFallback(prompt);
    }

    logger.info(`Loaded ${availableAgents.length} agents from database for selection`);

    // STEP 2: Calculate complexity for context
    const hardcodedComplexity = this.assessComplexity(prompt);
    const complexityScore = this.getComplexityScore(prompt);

    // STEP 3: AUTONOMOUS - Use AI to select from database agents
    const shouldUseAI = complexityScore >= this.useAIThreshold || 
                        prompt.length > 150 || // Lowered from 200
                        this.isAmbiguous(promptLower) ||
                        availableAgents.length > 5; // If many agents, let AI choose

    if (shouldUseAI) {
      try {
        logger.info(`Using AI for dynamic agent selection - analyzing ${availableAgents.length} agents`);
        return await this.analyzeWithAI(prompt, availableAgents, hardcodedComplexity);
      } catch (error) {
        logger.warn('AI analysis failed, using simple selection fallback', error as Error);
        // Fall through to simple selection
      }
    }

    // Simple selection fallback (only if AI not used or failed)
    logger.info(`Using simple agent selection - complexity: ${hardcodedComplexity}`);
    return this.simpleAgentSelection(availableAgents, hardcodedComplexity);
  }

  /**
   * Load available agents from database (with caching)
   * This makes the system fully dynamic - new agents added to DB are automatically available
   */
  private async loadAvailableAgents(): Promise<DatabaseAgent[]> {
    // Check cache
    const now = Date.now();
    if (this.availableAgentsCache && (now - this.cacheTimestamp) < this.cacheTTL) {
      logger.info(`Using cached agents (${this.availableAgentsCache.length} agents)`);
      return this.availableAgentsCache;
    }

    try {
      // Query database for all active system agents
      const dbAgents = await db
        .select({
          id: agents.id,
          name: agents.name,
          description: agents.description,
          role: agents.role,
          capabilities: agents.capabilities,
          expertise: agents.expertise
        })
        .from(agents)
        .where(
          and(
            eq(agents.isActive, true), // boolean in PostgreSQL
            eq(agents.isSystem, 1) // integer: 1 = system agent
          )
        );

      // Convert to our interface format
      const result: DatabaseAgent[] = dbAgents.map(agent => ({
        ...agent,
        id: agent.id.toString()
      }));

      logger.info(`Loaded ${result.length} active agents from database`);
      
      // Update cache
      this.availableAgentsCache = result;
      this.cacheTimestamp = now;
      
      return result;
    } catch (error) {
      logger.error('Failed to load agents from database', error as Error);
      return [];
    }
  }

  /**
   * Analyze prompt using AI with DYNAMIC database agents
   * This makes the system fully autonomous - AI selects from actual available agents
   */
  private async analyzeWithAI(
    prompt: string,
    availableAgents: DatabaseAgent[],
    hardcodedComplexity: 'simple' | 'moderate' | 'complex'
  ): Promise<AgentSelectionResult> {
    // Build dynamic agent list from database
    const agentDescriptions = availableAgents.map(agent => {
      // JSONB columns are already parsed by Drizzle ORM - no need to JSON.parse()
      let capabilities = agent.capabilities;
      let expertise = agent.expertise;
      
      // Ensure they're arrays/objects, handle null/undefined
      if (!capabilities || typeof capabilities === 'string') {
        try {
          capabilities = typeof capabilities === 'string' ? JSON.parse(capabilities) : [];
        } catch (e) {
          capabilities = [];
        }
      }
      
      if (!expertise || typeof expertise === 'string') {
        try {
          expertise = typeof expertise === 'string' ? JSON.parse(expertise) : [];
        } catch (e) {
          expertise = [];
        }
      }
      
      // Format for display
      const capabilitiesStr = Array.isArray(capabilities) 
        ? capabilities.join(', ') 
        : (typeof capabilities === 'object' ? Object.keys(capabilities).join(', ') : String(capabilities || ''));
      
      const expertiseStr = Array.isArray(expertise)
        ? expertise.join(', ')
        : (typeof expertise === 'object' ? Object.keys(expertise).join(', ') : String(expertise || ''));
      
      return `- ${agent.id}: ${agent.description || agent.name}
  Role: ${agent.role || 'assistant'}
  Capabilities: ${capabilitiesStr || 'None'}
  Expertise: ${expertiseStr || 'None'}`;
    }).join('\n\n');

    const systemPrompt = `You are an expert at analyzing software development requests and determining which specialized AI agents are needed.

AVAILABLE AGENTS (loaded from database):
${agentDescriptions}

Analyze the user's request and determine:
1. Complexity level: 'simple', 'moderate', or 'complex'
2. Which agents (by ID) are needed and why
3. Estimated duration in seconds

SELECTION GUIDELINES:
- For simple UI: component-developer only
- For complex features: component-architect + component-developer + component-qa
- For styling-heavy tasks: include component-stylist if available
- For backend needs: include relevant backend agents if available

Respond in JSON format:
{
  "complexity": "simple|moderate|complex",
  "selectedAgents": ["agent-id-1", "agent-id-2"],
  "reasoning": "Brief explanation of why these agents were selected",
  "estimatedDuration": 45
}`;

    try {
      const response = await this.multiModelAI.generate({
        prompt: `User request: "${prompt}"\n\nAnalyze this request and determine which agents are needed.`,
        systemPrompt,
        maxTokens: 500,
        temperature: 0.3,
        useCase: 'code_generation',
        priority: 'quality'
      });

      // Parse AI response and validate against actual database agents
      const aiResult = this.parseAIResponse(response.content, availableAgents, hardcodedComplexity);
      
      logger.info(`AI analysis complete - complexity: ${aiResult.complexity}, agents: ${aiResult.selectedAgents.length}`);
      
      return {
        ...aiResult,
        aiEnhanced: true
      };
    } catch (error) {
      logger.error('AI analysis failed', error as Error);
      throw error;
    }
  }

  /**
   * Parse AI response and validate against ACTUAL database agents (fully dynamic)
   */
  private parseAIResponse(
    aiContent: string,
    availableAgents: DatabaseAgent[],
    fallbackComplexity: 'simple' | 'moderate' | 'complex'
  ): AgentSelectionResult {
    try {
      // Try to extract JSON from response
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        
        // Validate and sanitize
        const complexity = ['simple', 'moderate', 'complex'].includes(parsed.complexity) 
          ? parsed.complexity 
          : fallbackComplexity;
        
        // DYNAMIC VALIDATION: Filter against actual database agents (not hardcoded list)
        const validAgentIds = new Set(availableAgents.map(a => a.id));
        const selectedAgents = Array.isArray(parsed.selectedAgents)
          ? parsed.selectedAgents.filter((id: string) => validAgentIds.has(id))
          : [];
        
        // Ensure at least one developer agent is included
        if (selectedAgents.length === 0) {
          const developer = availableAgents.find(a => 
            a.role.toLowerCase().includes('developer') || 
            a.role.toLowerCase().includes('code')
          );
          if (developer) {
            selectedAgents.push(developer.id);
            logger.info(`No valid agents selected by AI, defaulting to ${developer.id}`);
          }
        }

        return {
          selectedAgents,
          reasoning: parsed.reasoning || 'AI-determined agent selection',
          complexity,
          estimatedDuration: parsed.estimatedDuration || selectedAgents.length * 15,
          aiEnhanced: true
        };
      }
    } catch (error) {
      logger.warn('Failed to parse AI response, using fallback', error as Error);
    }

    // Fallback if parsing fails
    return {
      selectedAgents: ['component-developer'],
      reasoning: 'AI analysis unavailable, using default agent',
      complexity: fallbackComplexity,
      estimatedDuration: 15,
      aiEnhanced: false
    };
  }

  /**
   * Check if prompt is ambiguous (benefits from AI)
   */
  private isAmbiguous(promptLower: string): boolean {
    // Ambiguous indicators
    const vagueWords = ['something', 'maybe', 'perhaps', 'kind of', 'sort of', 'like', 'similar to'];
    const hasVagueWords = vagueWords.some(word => promptLower.includes(word));
    
    // Very short prompts might be ambiguous
    const isVeryShort = promptLower.split(/\s+/).length < 5;
    
    // Questions are often ambiguous
    const isQuestion = promptLower.includes('?') || 
                      promptLower.startsWith('can') || 
                      promptLower.startsWith('should') ||
                      promptLower.startsWith('how');

    return hasVagueWords || (isVeryShort && isQuestion);
  }

  /**
   * Get numeric complexity score (for AI threshold)
   */
  private getComplexityScore(prompt: string): number {
    const promptLower = prompt.toLowerCase();
    let score = 0;

    const appWords = ['app', 'application', 'system', 'platform', 'website', 'site'];
    appWords.forEach(word => {
      if (new RegExp(`\\b${word}\\b`).test(promptLower)) score += 4;
    });

    const domainWords = ['economy', 'finance', 'budget', 'expense', 'invoice', 'payment', 'transaction', 'savings', 'spending'];
    domainWords.forEach(word => {
      if (new RegExp(`\\b${word}\\b`).test(promptLower)) score += 3;
    });

    const stateWords = ['state', 'data', 'store', 'persist', 'save', 'database', 'api', 'backend'];
    stateWords.forEach(word => {
      if (new RegExp(`\\b${word}\\b`).test(promptLower)) score += 2;
    });

    const uiWords = ['dashboard', 'chart', 'graph', 'visualization', 'animation', '3d', 'analytics'];
    uiWords.forEach(word => {
      if (new RegExp(`\\b${word}\\b`).test(promptLower)) score += 2;
    });

    const interactionWords = ['form', 'input', 'submit', 'validation', 'upload', 'drag', 'filter', 'search'];
    interactionWords.forEach(word => {
      if (new RegExp(`\\b${word}\\b`).test(promptLower)) score += 1;
    });

    return score;
  }

  /**
   * Simple agent selection based on complexity
   * Used as fallback if AI selection fails or for very simple prompts
   */
  private simpleAgentSelection(
    availableAgents: DatabaseAgent[],
    complexity: 'simple' | 'moderate' | 'complex'
  ): AgentSelectionResult {
    const selectedAgents: string[] = [];
    const reasons: string[] = [];

    // Find agents by role (dynamic lookup from database)
    const architect = availableAgents.find(a => a.role.toLowerCase().includes('architect'));
    const developer = availableAgents.find(a => a.role.toLowerCase().includes('developer') || a.role.toLowerCase().includes('code'));
    const qa = availableAgents.find(a => a.role.toLowerCase().includes('qa') || a.role.toLowerCase().includes('quality'));

    // Select based on complexity
    if (complexity !== 'simple' && architect) {
      selectedAgents.push(architect.id);
      reasons.push(`${architect.name} for architecture planning`);
    }

    if (developer) {
      selectedAgents.push(developer.id);
      reasons.push(`${developer.name} for code generation`);
    }

    if (complexity !== 'simple' && qa) {
      selectedAgents.push(qa.id);
      reasons.push(`${qa.name} for quality assurance`);
    }

    // Fallback: if no agents matched, use first 2-3 agents
    if (selectedAgents.length === 0 && availableAgents.length > 0) {
      logger.warn('No agents matched roles, using first available agents');
      selectedAgents.push(...availableAgents.slice(0, Math.min(3, availableAgents.length)).map(a => a.id));
      reasons.push('Using available agents from database');
    }

    const estimatedDuration = selectedAgents.length * 15; // ~15s per agent

    return {
      selectedAgents,
      reasoning: reasons.join('. '),
      complexity,
      estimatedDuration,
      aiEnhanced: false
    };
  }

  /**
   * Minimal fallback when no agents are available in database
   */
  private getMinimalFallback(prompt: string): AgentSelectionResult {
    logger.error('CRITICAL: No agents in database, returning empty selection');
    return {
      selectedAgents: [],
      reasoning: 'No agents available in database - please add agents to the system',
      complexity: 'moderate',
      estimatedDuration: 0,
      aiEnhanced: false
    };
  }

  /**
   * Assess the complexity of the prompt
   */
  private assessComplexity(prompt: string): 'simple' | 'moderate' | 'complex' {
    const promptLower = prompt.toLowerCase();

    // Count complexity indicators
    let complexityScore = 0;

    // App/System keywords - indicates full application (high weight)
    const appWords = ['app', 'application', 'system', 'platform', 'website', 'site'];
    appWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`);
      if (regex.test(promptLower)) complexityScore += 4; // Increased from 3 to 4
    });

    // Business domain complexity (high weight)
    const domainWords = ['economy', 'finance', 'budget', 'expense', 'invoice', 'payment', 'transaction', 'savings', 'spending', 'accounting', 'billing', 'tracking', 'tracker'];
    domainWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`);
      if (regex.test(promptLower)) complexityScore += 3; // Increased from 2 to 3
    });

    // Multiple features/sections
    const featureWords = ['and', 'also', 'with', 'including', 'plus'];
    featureWords.forEach(word => {
      if (promptLower.includes(word)) complexityScore += 1;
    });

    // State management keywords
    const stateWords = ['state', 'data', 'store', 'persist', 'save', 'database', 'api', 'backend'];
    stateWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`);
      if (regex.test(promptLower)) complexityScore += 2;
    });

    // Complex UI keywords
    const uiWords = ['dashboard', 'chart', 'graph', 'visualization', 'animation', '3d', 'analytics'];
    uiWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`);
      if (regex.test(promptLower)) complexityScore += 2;
    });

    // User interaction complexity
    const interactionWords = ['form', 'input', 'submit', 'validation', 'upload', 'drag', 'filter', 'search'];
    interactionWords.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`);
      if (regex.test(promptLower)) complexityScore += 1;
    });

    // Determine complexity level with adjusted thresholds
    if (complexityScore <= 3) return 'simple';      // Slightly increased from 2
    if (complexityScore <= 8) return 'moderate';    // Slightly increased from 7
    return 'complex';                               // 9+ is complex
  }

  /**
   * Determine if Requirements Agent is needed
   */
  private needsRequirementsAgent(promptLower: string, complexity: 'simple' | 'moderate' | 'complex'): boolean {
    // Always needed for complex tasks
    if (complexity === 'complex') return true;

    // Needed if prompt mentions multiple features
    const hasMultipleFeatures =
      promptLower.split(/and|with|including|also|plus/).length > 2;

    // Needed if prompt is vague or open-ended
    const vagueIndicators = ['app', 'system', 'platform', 'tool', 'solution'];
    const isVague = vagueIndicators.some(word => promptLower.includes(word));

    return hasMultipleFeatures || (isVague && complexity === 'moderate');
  }

  /**
   * Determine if UI Designer is needed
   */
  private needsUIDesigner(promptLower: string, complexity: 'simple' | 'moderate' | 'complex'): boolean {
    // Skip for very simple components or logic-only tasks
    const isLogicOnly =
      promptLower.includes('function') ||
      promptLower.includes('utility') ||
      promptLower.includes('helper') ||
      promptLower.includes('calculate');

    if (isLogicOnly && complexity === 'simple') return false;

    // Always needed for UI-focused tasks
    const uiKeywords = [
      'ui', 'interface', 'design', 'layout', 'page', 'screen',
      'dashboard', 'form', 'modal', 'dialog', 'menu', 'nav'
    ];

    const hasUIFocus = uiKeywords.some(word => promptLower.includes(word));

    return hasUIFocus || complexity !== 'simple';
  }

  /**
   * Determine if Architect is needed
   */
  private needsArchitect(promptLower: string, complexity: 'simple' | 'moderate' | 'complex'): boolean {
    // Always needed for complex apps
    if (complexity === 'complex') return true;

    // Needed if state management is mentioned
    const needsState =
      promptLower.includes('state') ||
      promptLower.includes('data') ||
      promptLower.includes('store') ||
      promptLower.includes('context');

    // Needed if multiple components/pages mentioned
    const hasMultipleComponents =
      promptLower.includes('components') ||
      promptLower.includes('pages') ||
      promptLower.split(/component|page|section/).length > 2;

    return needsState || hasMultipleComponents;
  }

  /**
   * Determine if Styling is needed
   */
  private needsStyling(promptLower: string, complexity: 'simple' | 'moderate' | 'complex'): boolean {
    // Skip for headless/logic-only components
    const isHeadless =
      promptLower.includes('headless') ||
      promptLower.includes('api') ||
      promptLower.includes('service') ||
      promptLower.includes('utility');

    if (isHeadless) return false;

    // Always needed if styling is explicitly mentioned
    const stylingKeywords = [
      'style', 'styled', 'css', 'tailwind', 'design',
      'beautiful', 'modern', 'animated', '3d', 'gradient'
    ];

    const explicitStyling = stylingKeywords.some(word => promptLower.includes(word));

    // Needed for most UI components
    return explicitStyling || complexity !== 'simple';
  }
}

export const agentSelector = new AgentSelector();
