import { db } from '../../db';
import { companies, frameworks, workspaces } from '../../db/schema';
import { eq, like, or } from 'drizzle-orm';
import { githubKnowledgeService } from './GitHubKnowledgeService';
import { apiKeyService } from './APIKeyService';

export interface KnowledgeItem {
  id: number;
  type: 'company' | 'framework' | 'workspace';
  name: string;
  description: string;
  data: any;
  relevanceScore: number;
}

export interface KnowledgeContext {
  companies: KnowledgeItem[];
  frameworks: KnowledgeItem[];
  workspaces: KnowledgeItem[];
  githubRepositories: any[];
  requiredAPIKeys: any[];
  totalItems: number;
}

export class KnowledgeService {
  /**
   * Automatically retrieve relevant knowledge based on a prompt (always includes system knowledge)
   */
  async getRelevantKnowledge(
    prompt: string,
    userId?: string
  ): Promise<KnowledgeContext> {
    const promptLower = prompt.toLowerCase();

    // Extract keywords and concepts from the prompt
    const keywords = this.extractKeywords(promptLower);
    const concepts = this.extractConcepts(promptLower);

    // Always get system knowledge first
    const [systemCompanies, systemFrameworks, systemWorkspaces] =
      await Promise.all([
        this.getTopCompanies(3),
        this.getTopFrameworks(3),
        this.getTopWorkspaces(2),
      ]);

    // Search for relevant knowledge based on prompt
    const [
      relevantCompanies,
      relevantFrameworks,
      relevantWorkspaces,
      githubRepos,
      requiredAPIKeys,
    ] = await Promise.all([
      this.searchCompanies(keywords, concepts),
      this.searchFrameworks(keywords, concepts),
      this.searchWorkspaces(keywords, concepts),
      this.searchGitHubRepositories(prompt, userId),
      this.analyzeAPIKeyRequirements(prompt),
    ]);

    // Combine system knowledge with relevant knowledge, prioritizing relevant matches
    const allCompanies = [
      ...relevantCompanies,
      ...systemCompanies.filter(
        c => !relevantCompanies.some(rc => rc.id === c.id)
      ),
    ];
    const allFrameworks = [
      ...relevantFrameworks,
      ...systemFrameworks.filter(
        f => !relevantFrameworks.some(rf => rf.id === f.id)
      ),
    ];
    const allWorkspaces = [
      ...relevantWorkspaces,
      ...systemWorkspaces.filter(
        w => !relevantWorkspaces.some(rw => rw.id === w.id)
      ),
    ];

    return {
      companies: allCompanies.slice(0, 5), // Top 5 most relevant
      frameworks: allFrameworks.slice(0, 5),
      workspaces: allWorkspaces.slice(0, 3),
      githubRepositories: githubRepos,
      requiredAPIKeys: requiredAPIKeys,
      totalItems:
        allCompanies.length +
        allFrameworks.length +
        allWorkspaces.length +
        githubRepos.length,
    };
  }

  /**
   * Get specific knowledge items by IDs (semi-manual mode: system knowledge + user selected)
   */
  async getKnowledgeByIds(
    companyIds: number[] = [],
    frameworkIds: number[] = [],
    workspaceIds: number[] = []
  ): Promise<KnowledgeContext> {
    // Always get system knowledge (top companies, frameworks, workspaces)
    const [systemCompanies, systemFrameworks, systemWorkspaces] =
      await Promise.all([
        this.getTopCompanies(5),
        this.getTopFrameworks(5),
        this.getTopWorkspaces(3),
      ]);

    // Get manually selected knowledge
    const [manualCompanies, manualFrameworks, manualWorkspaces] =
      await Promise.all([
        companyIds.length > 0 ? this.getCompaniesByIds(companyIds) : [],
        frameworkIds.length > 0 ? this.getFrameworksByIds(frameworkIds) : [],
        workspaceIds.length > 0 ? this.getWorkspacesByIds(workspaceIds) : [],
      ]);

    // Semi-manual mode: Combine system and manual knowledge, prioritizing manual selections
    const allCompanies = [
      ...manualCompanies,
      ...systemCompanies.filter(
        c => !manualCompanies.some(mc => mc.id === c.id)
      ),
    ];
    const allFrameworks = [
      ...manualFrameworks,
      ...systemFrameworks.filter(
        f => !manualFrameworks.some(mf => mf.id === f.id)
      ),
    ];
    const allWorkspaces = [
      ...manualWorkspaces,
      ...systemWorkspaces.filter(
        w => !manualWorkspaces.some(mw => mw.id === w.id)
      ),
    ];

    return {
      companies: allCompanies,
      frameworks: allFrameworks,
      workspaces: allWorkspaces,
      githubRepositories: [], // Will be populated by GitHub service
      requiredAPIKeys: [], // Will be populated by API key service
      totalItems:
        allCompanies.length + allFrameworks.length + allWorkspaces.length,
    };
  }

  /**
   * Get all available knowledge for selection UI
   */
  async getAllKnowledge(): Promise<KnowledgeContext> {
    const [companies, frameworks, workspaces] = await Promise.all([
      this.getAllCompanies(),
      this.getAllFrameworks(),
      this.getAllWorkspaces(),
    ]);

    return {
      companies,
      frameworks,
      workspaces,
      githubRepositories: [],
      requiredAPIKeys: [],
      totalItems: companies.length + frameworks.length + workspaces.length,
    };
  }

  /**
   * Get top companies (system knowledge)
   */
  private async getTopCompanies(limit: number): Promise<KnowledgeItem[]> {
    try {
      const result = await db.select().from(companies).limit(limit);
      return result.map(company => ({
        id: company.id,
        type: 'company' as const,
        name: company.name,
        description: company.description,
        data: JSON.parse(company.products || '[]'),
        relevanceScore: 1.0, // High relevance for system knowledge
      }));
    } catch (error) {
      console.error('Error getting top companies:', error);
      return [];
    }
  }

  /**
   * Get top frameworks (system knowledge)
   */
  private async getTopFrameworks(limit: number): Promise<KnowledgeItem[]> {
    try {
      const result = await db.select().from(frameworks).limit(limit);
      return result.map(framework => ({
        id: framework.id,
        type: 'framework' as const,
        name: framework.name,
        description: framework.description,
        data: JSON.parse(framework.features || '[]'),
        relevanceScore: 1.0, // High relevance for system knowledge
      }));
    } catch (error) {
      console.error('Error getting top frameworks:', error);
      return [];
    }
  }

  /**
   * Get top workspaces (system knowledge)
   */
  private async getTopWorkspaces(limit: number): Promise<KnowledgeItem[]> {
    try {
      const result = await db.select().from(workspaces).limit(limit);
      return result.map(workspace => ({
        id: workspace.id,
        type: 'workspace' as const,
        name: workspace.name,
        description: workspace.description,
        data: JSON.parse(workspace.agentConfig || '{}'),
        relevanceScore: 1.0, // High relevance for system knowledge
      }));
    } catch (error) {
      console.error('Error getting top workspaces:', error);
      return [];
    }
  }

  /**
   * Search companies based on keywords and concepts
   */
  private async searchCompanies(
    keywords: string[],
    concepts: string[]
  ): Promise<KnowledgeItem[]> {
    try {
      const allCompanies = await db.select().from(companies);

      return allCompanies
        .map(company => {
          const companyData = {
            id: company.id,
            name: company.name,
            description: company.description,
            website: company.website,
            products:
              typeof company.products === 'string'
                ? JSON.parse(company.products)
                : company.products,
            use_cases: 'General AI and technology applications',
          };

          const relevanceScore = this.calculateRelevanceScore(
            companyData,
            keywords,
            concepts,
            ['name', 'description', 'products', 'use_cases']
          );

          return {
            id: company.id,
            type: 'company' as const,
            name: company.name,
            description: company.description,
            data: companyData,
            relevanceScore,
          };
        })
        .filter(item => item.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error('Error searching companies:', error);
      return [];
    }
  }

  /**
   * Search frameworks based on keywords and concepts
   */
  private async searchFrameworks(
    keywords: string[],
    concepts: string[]
  ): Promise<KnowledgeItem[]> {
    try {
      const allFrameworks = await db.select().from(frameworks);

      return allFrameworks
        .map(framework => {
          const frameworkData = {
            id: framework.id,
            name: framework.name,
            description: framework.description,
            language: framework.language,
            githubUrl: framework.githubUrl,
            documentation: framework.documentation,
            features:
              typeof framework.features === 'string'
                ? JSON.parse(framework.features)
                : framework.features,
            use_cases: 'Development and application building',
          };

          const relevanceScore = this.calculateRelevanceScore(
            frameworkData,
            keywords,
            concepts,
            ['name', 'description', 'language', 'features', 'use_cases']
          );

          return {
            id: framework.id,
            type: 'framework' as const,
            name: framework.name,
            description: framework.description,
            data: frameworkData,
            relevanceScore,
          };
        })
        .filter(item => item.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error('Error searching frameworks:', error);
      return [];
    }
  }

  /**
   * Search workspaces based on keywords and concepts
   */
  private async searchWorkspaces(
    keywords: string[],
    concepts: string[]
  ): Promise<KnowledgeItem[]> {
    try {
      const allWorkspaces = await db.select().from(workspaces);

      return allWorkspaces
        .map(workspace => {
          const workspaceData = {
            id: workspace.id,
            name: workspace.name,
            description: workspace.description,
            agentConfig:
              typeof workspace.agentConfig === 'string'
                ? JSON.parse(workspace.agentConfig)
                : workspace.agentConfig,
            testCases: workspace.testCases
              ? typeof workspace.testCases === 'string'
                ? JSON.parse(workspace.testCases)
                : workspace.testCases
              : [],
            collaborators:
              typeof workspace.collaborators === 'string'
                ? JSON.parse(workspace.collaborators)
                : workspace.collaborators,
            use_cases: 'Project development and collaboration',
          };

          const relevanceScore = this.calculateRelevanceScore(
            workspaceData,
            keywords,
            concepts,
            ['name', 'description', 'use_cases']
          );

          return {
            id: workspace.id,
            type: 'workspace' as const,
            name: workspace.name,
            description: workspace.description,
            data: workspaceData,
            relevanceScore,
          };
        })
        .filter(item => item.relevanceScore > 0)
        .sort((a, b) => b.relevanceScore - a.relevanceScore);
    } catch (error) {
      console.error('Error searching workspaces:', error);
      return [];
    }
  }

  /**
   * Get companies by specific IDs
   */
  private async getCompaniesByIds(ids: number[]): Promise<KnowledgeItem[]> {
    try {
      const companiesData = await db
        .select()
        .from(companies)
        .where(or(...ids.map(id => eq(companies.id, id))));

      return companiesData.map(company => ({
        id: company.id,
        type: 'company' as const,
        name: company.name,
        description: company.description,
        data: {
          id: company.id,
          name: company.name,
          description: company.description,
          website: company.website,
          products:
            typeof company.products === 'string'
              ? JSON.parse(company.products)
              : company.products,
          use_cases: 'General AI and technology applications',
        },
        relevanceScore: 1.0,
      }));
    } catch (error) {
      console.error('Error getting companies by IDs:', error);
      return [];
    }
  }

  /**
   * Get frameworks by specific IDs
   */
  private async getFrameworksByIds(ids: number[]): Promise<KnowledgeItem[]> {
    try {
      const frameworksData = await db
        .select()
        .from(frameworks)
        .where(or(...ids.map(id => eq(frameworks.id, id))));

      return frameworksData.map(framework => ({
        id: framework.id,
        type: 'framework' as const,
        name: framework.name,
        description: framework.description,
        data: {
          id: framework.id,
          name: framework.name,
          description: framework.description,
          language: framework.language,
          githubUrl: framework.githubUrl,
          documentation: framework.documentation,
          features:
            typeof framework.features === 'string'
              ? JSON.parse(framework.features)
              : framework.features,
          use_cases: 'Development and application building',
        },
        relevanceScore: 1.0,
      }));
    } catch (error) {
      console.error('Error getting frameworks by IDs:', error);
      return [];
    }
  }

  /**
   * Get workspaces by specific IDs
   */
  private async getWorkspacesByIds(ids: number[]): Promise<KnowledgeItem[]> {
    try {
      const workspacesData = await db
        .select()
        .from(workspaces)
        .where(or(...ids.map(id => eq(workspaces.id, id))));

      return workspacesData.map(workspace => ({
        id: workspace.id,
        type: 'workspace' as const,
        name: workspace.name,
        description: workspace.description,
        data: {
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
          agentConfig:
            typeof workspace.agentConfig === 'string'
              ? JSON.parse(workspace.agentConfig)
              : workspace.agentConfig,
          testCases: workspace.testCases
            ? typeof workspace.testCases === 'string'
              ? JSON.parse(workspace.testCases)
              : workspace.testCases
            : [],
          collaborators:
            typeof workspace.collaborators === 'string'
              ? JSON.parse(workspace.collaborators)
              : workspace.collaborators,
          use_cases: 'Project development and collaboration',
        },
        relevanceScore: 1.0,
      }));
    } catch (error) {
      console.error('Error getting workspaces by IDs:', error);
      return [];
    }
  }

  /**
   * Get all companies
   */
  private async getAllCompanies(): Promise<KnowledgeItem[]> {
    try {
      const allCompanies = await db.select().from(companies);

      return allCompanies.map(company => ({
        id: company.id,
        type: 'company' as const,
        name: company.name,
        description: company.description,
        data: {
          id: company.id,
          name: company.name,
          description: company.description,
          website: company.website,
          products:
            typeof company.products === 'string'
              ? JSON.parse(company.products)
              : company.products,
          use_cases: 'General AI and technology applications',
        },
        relevanceScore: 0.5,
      }));
    } catch (error) {
      console.error('Error getting all companies:', error);
      return [];
    }
  }

  /**
   * Get all frameworks
   */
  private async getAllFrameworks(): Promise<KnowledgeItem[]> {
    try {
      const allFrameworks = await db.select().from(frameworks);

      return allFrameworks.map(framework => ({
        id: framework.id,
        type: 'framework' as const,
        name: framework.name,
        description: framework.description,
        data: {
          id: framework.id,
          name: framework.name,
          description: framework.description,
          language: framework.language,
          githubUrl: framework.githubUrl,
          documentation: framework.documentation,
          features:
            typeof framework.features === 'string'
              ? JSON.parse(framework.features)
              : framework.features,
          use_cases: 'Development and application building',
        },
        relevanceScore: 0.5,
      }));
    } catch (error) {
      console.error('Error getting all frameworks:', error);
      return [];
    }
  }

  /**
   * Get all workspaces
   */
  private async getAllWorkspaces(): Promise<KnowledgeItem[]> {
    try {
      const allWorkspaces = await db.select().from(workspaces);

      return allWorkspaces.map(workspace => ({
        id: workspace.id,
        type: 'workspace' as const,
        name: workspace.name,
        description: workspace.description,
        data: {
          id: workspace.id,
          name: workspace.name,
          description: workspace.description,
          agentConfig:
            typeof workspace.agentConfig === 'string'
              ? JSON.parse(workspace.agentConfig)
              : workspace.agentConfig,
          testCases: workspace.testCases
            ? typeof workspace.testCases === 'string'
              ? JSON.parse(workspace.testCases)
              : workspace.testCases
            : [],
          collaborators:
            typeof workspace.collaborators === 'string'
              ? JSON.parse(workspace.collaborators)
              : workspace.collaborators,
          use_cases: 'Project development and collaboration',
        },
        relevanceScore: 0.5,
      }));
    } catch (error) {
      console.error('Error getting all workspaces:', error);
      return [];
    }
  }

  /**
   * Extract keywords from prompt
   */
  private extractKeywords(prompt: string): string[] {
    const commonWords = [
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'with',
      'by',
      'is',
      'are',
      'was',
      'were',
      'be',
      'been',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'can',
      'create',
      'build',
      'make',
      'generate',
      'develop',
      'app',
      'application',
      'component',
      'page',
      'website',
      'site',
    ];

    return prompt
      .split(/\s+/)
      .map(word => word.toLowerCase().replace(/[^\w]/g, ''))
      .filter(word => word.length > 2 && !commonWords.includes(word));
  }

  /**
   * Extract concepts from prompt
   */
  private extractConcepts(prompt: string): string[] {
    const conceptPatterns = [
      /\b(react|vue|angular|svelte)\b/gi,
      /\b(node|express|fastapi|django|laravel)\b/gi,
      /\b(mongodb|postgresql|mysql|redis)\b/gi,
      /\b(ai|ml|machine learning|artificial intelligence)\b/gi,
      /\b(api|rest|graphql|websocket)\b/gi,
      /\b(auth|authentication|login|security)\b/gi,
      /\b(real-time|realtime|live|websocket)\b/gi,
      /\b(mobile|ios|android|flutter|react native)\b/gi,
      /\b(chat|messaging|communication)\b/gi,
      /\b(ecommerce|shopping|payment|stripe)\b/gi,
      /\b(dashboard|admin|management)\b/gi,
      /\b(game|gaming|entertainment)\b/gi,
    ];

    const concepts: string[] = [];
    conceptPatterns.forEach(pattern => {
      const matches = prompt.match(pattern);
      if (matches) {
        concepts.push(...matches.map(match => match.toLowerCase()));
      }
    });

    return [...new Set(concepts)];
  }

  /**
   * Search GitHub repositories for relevant knowledge
   */
  private async searchGitHubRepositories(
    prompt: string,
    userId?: string
  ): Promise<any[]> {
    try {
      const results = await githubKnowledgeService.searchRepositoryKnowledge(
        prompt,
        userId
      );
      return results.repositories.slice(0, 2); // Top 2 most relevant repositories
    } catch (error) {
      console.error('Error searching GitHub repositories:', error);
      return [];
    }
  }

  /**
   * Analyze prompt for required API keys
   */
  private async analyzeAPIKeyRequirements(prompt: string): Promise<any[]> {
    try {
      const requirements = apiKeyService.analyzePromptForAPIKeys(prompt);
      return requirements;
    } catch (error) {
      console.error('Error analyzing API key requirements:', error);
      return [];
    }
  }

  /**
   * Calculate relevance score for a knowledge item
   */
  private calculateRelevanceScore(
    item: any,
    keywords: string[],
    concepts: string[],
    searchFields: string[]
  ): number {
    let score = 0;
    const itemText = searchFields
      .map(field => {
        const value = item[field];
        if (typeof value === 'string') return value;
        if (Array.isArray(value)) return value.join(' ');
        if (typeof value === 'object') return JSON.stringify(value);
        return '';
      })
      .join(' ')
      .toLowerCase();

    // Score based on keyword matches
    keywords.forEach(keyword => {
      if (itemText.includes(keyword)) {
        score += 1;
      }
    });

    // Score based on concept matches (higher weight)
    concepts.forEach(concept => {
      if (itemText.includes(concept)) {
        score += 2;
      }
    });

    // Bonus for exact name matches
    if (
      item.name &&
      keywords.some(keyword => item.name.toLowerCase().includes(keyword))
    ) {
      score += 3;
    }

    return score;
  }
}

export const knowledgeService = new KnowledgeService();
