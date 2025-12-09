import { BaseAgent } from './BaseAgent';
import { AgentResult } from '../utils/types';
import { AICodeGenerator } from '../services/AICodeGenerator';
import { SharedMemory } from '../utils/SharedMemory';
import { SimpleLogger } from '../utils/SimpleLogger';
import { PromptBuilder } from '../prompts/UltimateAgentPrompts';

export interface RequirementAnalysis {
  functionalRequirements: string[];
  nonFunctionalRequirements: string[];
  components: string[];
  features: string[];
  dataModels: string[];
  complexity: number;
  estimatedComponents: number;
  recommendedApproach?: string;
}

export interface RequirementsTask {
  prompt: string;
  sharedMemory: SharedMemory;
}

export class RequirementsAgent extends BaseAgent {
  private readonly logger = new SimpleLogger('RequirementsAgent');
  private readonly aiGenerator = new AICodeGenerator();

  constructor() {
    super('requirements-agent');
  }

  async executeTask(task: RequirementsTask | string): Promise<AgentResult> {
    const prompt = typeof task === 'string' ? task : task.prompt;
    const sharedMemory = typeof task === 'string' ? new SharedMemory('requirements') : task.sharedMemory;

    console.log('🔍 RequirementsAgent: Starting executeTask');
    console.log('📝 RequirementsAgent: Prompt length:', prompt.length);

    // Apply ultimate requirements analyst prompt for enhanced intelligence
    // Now with dynamic database prompts + coding guidelines!
    const enhancedPrompt = await PromptBuilder.buildAgentPrompt('REQUIREMENTS_ANALYST', prompt);
    console.log('✨ RequirementsAgent: Enhanced prompt created (with coding guidelines)');

    this.logger.info('Analyzing requirements with enhanced intelligence');
    const start = Date.now();

    try {
      console.log('🏗️ RequirementsAgent: Building analysis prompt');
      const analysisPrompt = this.buildPrompt(enhancedPrompt);
      console.log('📊 RequirementsAgent: Analysis prompt length:', analysisPrompt.length);

      console.log('🤖 RequirementsAgent: Calling AI generator...');
      const response = await this.aiGenerator.generateComponent({
        prompt: analysisPrompt,
        componentName: 'RequirementsAnalysis',
        features: [],
      });
      console.log('✅ RequirementsAgent: AI generator responded');
      console.log('📦 RequirementsAgent: Response received, code length:', response.code?.length || 0);

      const analysis = this.parseResponse(response.code ?? '');
      console.log('🔍 RequirementsAgent: Parsed analysis:', {
        components: analysis.components.length,
        complexity: analysis.complexity,
        estimatedComponents: analysis.estimatedComponents
      });

      sharedMemory.set('requirements', analysis);
      sharedMemory.set('complexity', analysis.complexity);
      sharedMemory.set('estimatedComponents', analysis.estimatedComponents);
      console.log('💾 RequirementsAgent: Stored in shared memory');

      console.log('✅ RequirementsAgent: Task completed successfully');
      return {
        success: true,
        content: JSON.stringify(analysis, null, 2),
        metadata: {
          executionTime: Date.now() - start,
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('❌ RequirementsAgent: Error occurred:', message);
      console.error('Stack trace:', error);
      this.logger.error('Requirement analysis failed', error as Error);
      return {
        success: false,
        errors: [message],
      };
    }
  }

  private buildPrompt(prompt: string): string {
    return `# Role
You are a senior Requirements Analyst AI agent with expertise in breaking down user requests into structured technical specifications for React/TypeScript applications.

# Identity
You are a Requirements Agent that excels at:
- Analyzing user requests for clarity and completeness
- Identifying functional and non-functional requirements
- Breaking down complex features into implementable components
- Estimating technical complexity and development effort
- Defining data models and architecture needs

# Primary Task
Analyze the following user request and extract comprehensive technical requirements:

## User Request:
"${prompt}"

# Analysis Framework

## 1. Functional Requirements Analysis
- What specific features does the user want?
- What user interactions are needed?
- What business logic is required?
- What data processing is needed?

## 2. Component Architecture
- What React components will be needed?
- How should components be structured?
- What reusable components can be identified?
- What component relationships exist?

## 3. Data & State Management
- What data needs to be stored/managed?
- What state management approach is needed?
- What APIs or external services are required?
- What data validation is needed?

## 4. Technical Complexity Assessment
- Rate complexity from 1-10 based on:
  - Number of features (1-3: simple, 4-6: medium, 7-10: complex)
  - Data complexity (simple forms vs complex state)
  - Integration requirements
  - UI/UX sophistication

# Output Requirements

Return ONLY valid JSON with this exact structure:
{
  "functionalRequirements": [
    "Clear, actionable functional requirements"
  ],
  "nonFunctionalRequirements": [
    "Performance, security, usability requirements"
  ],
  "components": [
    "List of React components needed"
  ],
  "features": [
    "High-level feature descriptions"
  ],
  "dataModels": [
    "Data structures and models needed"
  ],
  "complexity": <number from 1-10>,
  "estimatedComponents": <number of components>,
  "recommendedApproach": "Brief technical approach recommendation"
}

# Quality Standards
- Be specific and actionable in requirements
- Consider user experience and accessibility
- Think about error handling and edge cases
- Consider responsive design needs
- Plan for maintainability and scalability`;
  }

  private parseResponse(response: string): RequirementAnalysis {
    const cleaned = response.replace(/```json\s*/g, '').replace(/```/g, '').trim();
    try {
      const parsed = JSON.parse(cleaned);
      return {
        functionalRequirements: parsed.functionalRequirements ?? [],
        nonFunctionalRequirements: parsed.nonFunctionalRequirements ?? [],
        components: parsed.components ?? [],
        features: parsed.features ?? [],
        dataModels: parsed.dataModels ?? [],
        complexity: typeof parsed.complexity === 'number' ? parsed.complexity : 5,
        estimatedComponents:
          typeof parsed.estimatedComponents === 'number'
            ? parsed.estimatedComponents
            : parsed.components?.length ?? 1,
        recommendedApproach: parsed.recommendedApproach || 'Standard React component approach',
      };
    } catch (error) {
      this.logger.error('Failed to parse requirements JSON', error as Error);
      return {
        functionalRequirements: [],
        nonFunctionalRequirements: [],
        components: ['App'],
        features: [],
        dataModels: [],
        complexity: 5,
        estimatedComponents: 1,
      };
    }
  }
}


