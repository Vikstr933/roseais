/**
 * GitHub Repository Analysis Service
 * Analyzes GitHub repositories to extract languages, frameworks, and metadata
 * Used for smart agent selection based on repository content
 */

import { Octokit } from '@octokit/rest';
import { SimpleLogger } from '../utils/SimpleLogger';
import { db } from '../../db';
import { agents } from '../../db/schema-pg';
import { eq, and, or, sql } from 'drizzle-orm';

const logger = new SimpleLogger('GitHubRepoAnalysisService');

export interface RepoAnalysis {
  owner: string;
  repo: string;
  languages: Record<string, number>; // Language -> percentage
  primaryLanguage: string;
  description: string;
  topics: string[];
  framework?: string;
  detectedTechStack: string[];
  readmeContent?: string;
  hasPackageJson: boolean;
  hasRequirementsTxt: boolean;
  hasCMakeLists: boolean;
  hasDockerfile: boolean;
}

export interface MatchedAgent {
  id: string;
  name: string;
  description: string;
  role: string;
  matchScore: number;
  matchReasons: string[];
  capabilities: Record<string, boolean>;
  expertise: Record<string, string>;
  frameworks: Record<string, boolean>;
}

export class GitHubRepoAnalysisService {
  private octokit: Octokit | null = null;

  constructor() {
    // Initialize Octokit if GitHub token is available
    if (process.env.GITHUB_TOKEN) {
      this.octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN,
      });
    } else {
      logger.warn('GITHUB_TOKEN not set - GitHub repo analysis will be limited');
    }
  }

  /**
   * Extract GitHub repo URL from message
   */
  extractRepoUrl(message: string): { owner: string; repo: string } | null {
    // Match patterns like:
    // - https://github.com/owner/repo
    // - https://github.com/owner/repo.git
    // - github.com/owner/repo
    // - owner/repo
    const patterns = [
      /github\.com\/([^\/]+)\/([^\/\s\.]+)/i,
      /^([^\/\s]+)\/([^\/\s]+)$/,
    ];

    for (const pattern of patterns) {
      const match = message.match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2].replace(/\.git$/, ''),
        };
      }
    }

    return null;
  }

  /**
   * Analyze a GitHub repository
   */
  async analyzeRepository(owner: string, repo: string): Promise<RepoAnalysis> {
    if (!this.octokit) {
      throw new Error('GitHub token not configured');
    }

    try {
      logger.info(`Analyzing repository: ${owner}/${repo}`);

      // Fetch repository data
      const [repoData, languagesData, topicsData] = await Promise.all([
        this.octokit.repos.get({ owner, repo }),
        this.octokit.repos.listLanguages({ owner, repo }),
        this.octokit.repos.getAllTopics({ owner, repo }),
      ]);

      // Calculate language percentages
      const totalBytes = Object.values(languagesData.data).reduce(
        (sum, bytes) => sum + bytes,
        0
      );
      const languages: Record<string, number> = {};
      let primaryLanguage = 'Unknown';
      let maxBytes = 0;

      for (const [lang, bytes] of Object.entries(languagesData.data)) {
        const percentage = (bytes / totalBytes) * 100;
        languages[lang] = percentage;
        if (bytes > maxBytes) {
          maxBytes = bytes;
          primaryLanguage = lang;
        }
      }

      // Fetch README if available
      let readmeContent: string | undefined;
      try {
        const readme = await this.octokit.repos.getContent({
          owner,
          repo,
          path: 'README.md',
        });
        if ('content' in readme.data && readme.data.encoding === 'base64') {
          readmeContent = Buffer.from(readme.data.content, 'base64').toString('utf-8');
        }
      } catch {
        // README not found or not accessible
      }

      // Check for common config files
      const [packageJson, requirementsTxt, cmakeLists, dockerfile] = await Promise.all([
        this.checkFileExists(owner, repo, 'package.json'),
        this.checkFileExists(owner, repo, 'requirements.txt'),
        this.checkFileExists(owner, repo, 'CMakeLists.txt'),
        this.checkFileExists(owner, repo, 'Dockerfile'),
      ]);

      // Detect tech stack from languages and files
      const detectedTechStack = this.detectTechStack(
        languages,
        packageJson,
        requirementsTxt,
        cmakeLists,
        dockerfile,
        topicsData.data.names || []
      );

      // Detect framework
      const framework = this.detectFramework(
        languages,
        detectedTechStack,
        readmeContent
      );

      return {
        owner,
        repo,
        languages,
        primaryLanguage,
        description: repoData.data.description || '',
        topics: topicsData.data.names || [],
        framework,
        detectedTechStack,
        readmeContent,
        hasPackageJson: packageJson,
        hasRequirementsTxt: requirementsTxt,
        hasCMakeLists: cmakeLists,
        hasDockerfile: dockerfile,
      };
    } catch (error) {
      logger.error(`Failed to analyze repository ${owner}/${repo}`, error as Error);
      throw error;
    }
  }

  /**
   * Check if a file exists in the repository
   */
  private async checkFileExists(
    owner: string,
    repo: string,
    path: string
  ): Promise<boolean> {
    if (!this.octokit) return false;

    try {
      await this.octokit.repos.getContent({ owner, repo, path });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Detect tech stack from languages and files
   */
  private detectTechStack(
    languages: Record<string, number>,
    hasPackageJson: boolean,
    hasRequirementsTxt: boolean,
    hasCMakeLists: boolean,
    hasDockerfile: boolean,
    topics: string[]
  ): string[] {
    const stack: string[] = [];

    // Language-based detection
    if (languages['TypeScript'] || languages['JavaScript']) {
      stack.push('JavaScript/TypeScript');
      if (hasPackageJson) {
        stack.push('Node.js');
      }
    }
    if (languages['Python']) {
      stack.push('Python');
      if (hasRequirementsTxt) {
        stack.push('Python Package Manager');
      }
    }
    if (languages['C++'] || languages['C']) {
      stack.push('C/C++');
      if (hasCMakeLists) {
        stack.push('CMake');
      }
    }
    if (languages['Lua']) {
      stack.push('Lua');
    }
    if (languages['Java']) {
      stack.push('Java');
    }
    if (languages['Go']) {
      stack.push('Go');
    }
    if (languages['Rust']) {
      stack.push('Rust');
    }
    if (languages['PHP']) {
      stack.push('PHP');
    }
    if (languages['Ruby']) {
      stack.push('Ruby');
    }

    // Framework detection from topics
    const frameworkTopics = topics.filter(topic =>
      ['react', 'vue', 'angular', 'nextjs', 'django', 'flask', 'fastapi', 'express', 'spring', 'laravel'].includes(topic.toLowerCase())
    );
    stack.push(...frameworkTopics);

    if (hasDockerfile) {
      stack.push('Docker');
    }

    return [...new Set(stack)]; // Remove duplicates
  }

  /**
   * Detect framework from languages and tech stack
   */
  private detectFramework(
    languages: Record<string, number>,
    techStack: string[],
    readmeContent?: string
  ): string | undefined {
    const content = (readmeContent || '').toLowerCase();
    const techStackLower = techStack.map(t => t.toLowerCase());

    // React/Next.js
    if (techStackLower.includes('nextjs') || content.includes('next.js')) {
      return 'Next.js';
    }
    if (techStackLower.includes('react') || content.includes('react')) {
      return 'React';
    }

    // Vue
    if (techStackLower.includes('vue') || content.includes('vue.js')) {
      return 'Vue.js';
    }

    // Python frameworks
    if (techStackLower.includes('django') || content.includes('django')) {
      return 'Django';
    }
    if (techStackLower.includes('flask') || content.includes('flask')) {
      return 'Flask';
    }
    if (techStackLower.includes('fastapi') || content.includes('fastapi')) {
      return 'FastAPI';
    }

    // Java frameworks
    if (techStackLower.includes('spring') || content.includes('spring')) {
      return 'Spring';
    }

    // PHP frameworks
    if (techStackLower.includes('laravel') || content.includes('laravel')) {
      return 'Laravel';
    }

    // C++ projects (like OpenTibia/Forgotten Server)
    if (languages['C++'] && (content.includes('opentibia') || content.includes('tibia') || content.includes('mmorpg'))) {
      return 'C++ Game Server';
    }

    return undefined;
  }

  /**
   * Find matching agents based on repository analysis
   */
  async findMatchingAgents(
    analysis: RepoAnalysis,
    userId?: string
  ): Promise<MatchedAgent[]> {
    try {
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
          description: agents.description,
          role: agents.role,
          capabilities: agents.capabilities,
          expertise: agents.expertise,
          frameworks: agents.frameworks,
          libraries: agents.libraries,
        })
        .from(agents)
        .where(and(...conditions));

      const matchedAgents: MatchedAgent[] = [];

      for (const agent of allAgents) {
        const matchScore = this.calculateMatchScore(agent, analysis);
        if (matchScore > 0) {
          matchedAgents.push({
            id: agent.id,
            name: agent.name || 'Unknown',
            description: agent.description || '',
            role: agent.role || '',
            matchScore,
            matchReasons: this.getMatchReasons(agent, analysis),
            capabilities: (typeof agent.capabilities === 'object' && agent.capabilities !== null) 
              ? (agent.capabilities as Record<string, boolean>) 
              : {},
            expertise: (typeof agent.expertise === 'object' && agent.expertise !== null) 
              ? (agent.expertise as Record<string, string>) 
              : {},
            frameworks: (typeof agent.frameworks === 'object' && agent.frameworks !== null) 
              ? (agent.frameworks as Record<string, boolean>) 
              : {},
          });
        }
      }

      // Sort by match score (highest first)
      matchedAgents.sort((a, b) => b.matchScore - a.matchScore);

      logger.info(`Found ${matchedAgents.length} matching agents for ${analysis.owner}/${analysis.repo}`);
      return matchedAgents;
    } catch (error) {
      logger.error('Failed to find matching agents', error as Error);
      return [];
    }
  }

  /**
   * Calculate match score between agent and repository
   */
  private calculateMatchScore(
    agent: {
      capabilities: any;
      expertise: any;
      frameworks: any;
      libraries: any;
      description?: string | null;
      role?: string | null;
    },
    analysis: RepoAnalysis
  ): number {
    let score = 0;

    // Parse JSON fields if they're strings
    const capabilities = typeof agent.capabilities === 'string'
      ? JSON.parse(agent.capabilities)
      : agent.capabilities || {};
    const expertise = typeof agent.expertise === 'string'
      ? JSON.parse(agent.expertise)
      : agent.expertise || {};
    const frameworks = typeof agent.frameworks === 'string'
      ? JSON.parse(agent.frameworks)
      : agent.frameworks || {};
    const libraries = typeof agent.libraries === 'string'
      ? JSON.parse(agent.libraries)
      : agent.libraries || {};

    // Language matching (high weight)
    for (const [lang, percentage] of Object.entries(analysis.languages)) {
      if (percentage > 10) { // Only consider languages with >10% usage
        const langLower = lang.toLowerCase();
        
        // Check expertise
        for (const [expertiseKey, level] of Object.entries(expertise)) {
          if (expertiseKey.toLowerCase().includes(langLower)) {
            score += percentage * 0.5; // Weight by language percentage
          }
        }

        // Check capabilities
        for (const capability of Object.keys(capabilities)) {
          if (capability.toLowerCase().includes(langLower)) {
            score += percentage * 0.3;
          }
        }

        // Check description/role
        const description = (agent.description || '').toLowerCase();
        const role = (agent.role || '').toLowerCase();
        if (description.includes(langLower) || role.includes(langLower)) {
          score += percentage * 0.2;
        }
      }
    }

    // Framework matching (high weight)
    if (analysis.framework) {
      const frameworkLower = analysis.framework.toLowerCase();
      
      // Check frameworks
      for (const frameworkKey of Object.keys(frameworks)) {
        if (frameworkKey.toLowerCase().includes(frameworkLower)) {
          score += 30;
        }
      }

      // Check description/role
      const description = (agent.description || '').toLowerCase();
      const role = (agent.role || '').toLowerCase();
      if (description.includes(frameworkLower) || role.includes(frameworkLower)) {
        score += 20;
      }
    }

    // Tech stack matching (medium weight)
    for (const tech of analysis.detectedTechStack) {
      const techLower = tech.toLowerCase();
      
      // Check expertise
      for (const [expertiseKey, level] of Object.entries(expertise)) {
        if (expertiseKey.toLowerCase().includes(techLower)) {
          score += 10;
        }
      }

      // Check capabilities
      for (const capability of Object.keys(capabilities)) {
        if (capability.toLowerCase().includes(techLower)) {
          score += 5;
        }
      }
    }

    // Library matching (low weight)
    for (const library of Object.keys(libraries)) {
      const libraryLower = library.toLowerCase();
      
      // Check if library is mentioned in repo topics or description
      if (analysis.topics.some(t => t.toLowerCase().includes(libraryLower)) ||
          analysis.description.toLowerCase().includes(libraryLower)) {
        score += 3;
      }
    }

    return Math.round(score);
  }

  /**
   * Get reasons why an agent matches
   */
  private getMatchReasons(
    agent: {
      capabilities: any;
      expertise: any;
      frameworks: any;
      description?: string | null;
      role?: string | null;
    },
    analysis: RepoAnalysis
  ): string[] {
    const reasons: string[] = [];

    // Parse JSON fields
    const capabilities = typeof agent.capabilities === 'string'
      ? JSON.parse(agent.capabilities)
      : agent.capabilities || {};
    const expertise = typeof agent.expertise === 'string'
      ? JSON.parse(agent.expertise)
      : agent.expertise || {};
    const frameworks = typeof agent.frameworks === 'string'
      ? JSON.parse(agent.frameworks)
      : agent.frameworks || {};

    // Language reasons
    for (const [lang, percentage] of Object.entries(analysis.languages)) {
      if (percentage > 10) {
        const langLower = lang.toLowerCase();
        const description = (agent.description || '').toLowerCase();
        const role = (agent.role || '').toLowerCase();
        
        if (description.includes(langLower) || role.includes(langLower)) {
          reasons.push(`Expert in ${lang} (${percentage.toFixed(1)}% of repo)`);
        }
      }
    }

    // Framework reasons
    if (analysis.framework) {
      const frameworkLower = analysis.framework.toLowerCase();
      const description = (agent.description || '').toLowerCase();
      const role = (agent.role || '').toLowerCase();
      
      if (Object.keys(frameworks).some(f => f.toLowerCase().includes(frameworkLower)) ||
          description.includes(frameworkLower) || role.includes(frameworkLower)) {
        reasons.push(`Specialized in ${analysis.framework}`);
      }
    }

    // Tech stack reasons
    for (const tech of analysis.detectedTechStack.slice(0, 3)) { // Top 3
      const techLower = tech.toLowerCase();
      const description = (agent.description || '').toLowerCase();
      
      if (description.includes(techLower)) {
        reasons.push(`Experience with ${tech}`);
      }
    }

    return reasons;
  }
}

