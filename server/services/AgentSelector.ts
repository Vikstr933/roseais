/**
 * Intelligent Agent Selection Service
 * Analyzes prompts and determines which agents are needed for the task
 */

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
}

export class AgentSelector {
  /**
   * Analyze a prompt and determine which agents are needed
   */
  async analyzePrompt(prompt: string): Promise<AgentSelectionResult> {
    const promptLower = prompt.toLowerCase();

    // Determine task complexity
    const complexity = this.assessComplexity(prompt);

    // Define agent selection criteria
    const needsRequirements = this.needsRequirementsAgent(promptLower, complexity);
    const needsUIDesign = this.needsUIDesigner(promptLower, complexity);
    const needsArchitect = this.needsArchitect(promptLower, complexity);
    const needsStyling = this.needsStyling(promptLower, complexity);
    const needsCodeGen = true; // Always need code generation
    const needsQA = complexity !== 'simple'; // Skip QA for very simple tasks

    const selectedAgents: string[] = [];
    const reasons: string[] = [];

    // Component Architect - Plans architecture (maps to old requirements/ui-designer/architect)
    if (needsArchitect || needsRequirements || needsUIDesign) {
      selectedAgents.push('component-architect');
      reasons.push('Architecture planning needed for component structure');
    }

    // Component Developer - Writes code (maps to old code-generator/style-generator)
    selectedAgents.push('component-developer');
    reasons.push('Code generation required');

    // Component QA - Tests and validates (maps to old completion)
    if (needsQA) {
      selectedAgents.push('component-qa');
      reasons.push('Quality assurance needed for verification');
    }

    // Estimate duration based on number of agents
    const estimatedDuration = selectedAgents.length * 15; // ~15 seconds per agent

    return {
      selectedAgents,
      reasoning: reasons.join('. '),
      complexity,
      estimatedDuration
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
