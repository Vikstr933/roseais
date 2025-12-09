import { Octokit } from '@octokit/rest';
import { db } from '../../db';
import { companies, frameworks, workspaces } from '../../db/schema-pg';
import { eq, like, or } from 'drizzle-orm';

export interface GitHubRepository {
  id: string;
  name: string;
  fullName: string;
  description: string;
  url: string;
  language: string;
  topics: string[];
  readme: string;
  functions: GitHubFunction[];
  classes: GitHubClass[];
  constants: GitHubConstant[];
  lastUpdated: string;
}

export interface GitHubFunction {
  name: string;
  file: string;
  line: number;
  signature: string;
  description: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
  }>;
  returnType: string;
  examples: string[];
}

export interface GitHubClass {
  name: string;
  file: string;
  line: number;
  description: string;
  methods: GitHubFunction[];
  properties: Array<{
    name: string;
    type: string;
    description: string;
  }>;
}

export interface GitHubConstant {
  name: string;
  file: string;
  line: number;
  value: string;
  description: string;
}

export class GitHubKnowledgeService {
  private octokit: Octokit;

  constructor() {
    this.octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN, // Optional, for higher rate limits
    });
  }

  /**
   * Add a GitHub repository as knowledge
   */
  async addRepositoryKnowledge(
    repoUrl: string,
    userId?: string
  ): Promise<GitHubRepository> {
    try {
      const repoInfo = this.parseGitHubUrl(repoUrl);
      if (!repoInfo) {
        throw new Error('Invalid GitHub repository URL');
      }

      // Fetch repository information
      const { data: repo } = await this.octokit.repos.get({
        owner: repoInfo.owner,
        repo: repoInfo.repo,
      });

      // Fetch README
      let readme = '';
      try {
        const { data: readmeData } = await this.octokit.repos.getReadme({
          owner: repoInfo.owner,
          repo: repoInfo.repo,
        });
        readme = Buffer.from(readmeData.content, 'base64').toString('utf-8');
      } catch (error) {
        console.log('No README found for repository');
      }

      // Fetch repository contents and analyze code
      const { functions, classes, constants } =
        await this.analyzeRepositoryCode(repoInfo.owner, repoInfo.repo);

      const repositoryKnowledge: GitHubRepository = {
        id: `${repoInfo.owner}/${repoInfo.repo}`,
        name: repo.name,
        fullName: repo.full_name,
        description: repo.description || '',
        url: repo.html_url,
        language: repo.language || 'Unknown',
        topics: repo.topics || [],
        readme,
        functions,
        classes,
        constants,
        lastUpdated: repo.updated_at,
      };

      // Store in database as a special "framework" entry
      await this.storeRepositoryKnowledge(repositoryKnowledge, userId);

      return repositoryKnowledge;
    } catch (error) {
      console.error('Error adding GitHub repository knowledge:', error);
      throw new Error(
        `Failed to add repository knowledge: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Search for relevant functions/classes in GitHub repositories
   */
  async searchRepositoryKnowledge(
    query: string,
    userId?: string
  ): Promise<{
    repositories: GitHubRepository[];
    functions: GitHubFunction[];
    classes: GitHubClass[];
    constants: GitHubConstant[];
  }> {
    try {
      // Get all stored repository knowledge for the user
      const repositories = await this.getUserRepositoryKnowledge(userId);

      const results = {
        repositories: [] as GitHubRepository[],
        functions: [] as GitHubFunction[],
        classes: [] as GitHubClass[],
        constants: [] as GitHubConstant[],
      };

      const queryLower = query.toLowerCase();

      for (const repo of repositories) {
        let repoRelevance = 0;

        // Check repository name and description
        if (
          repo.name.toLowerCase().includes(queryLower) ||
          repo.description.toLowerCase().includes(queryLower) ||
          repo.topics.some(topic => topic.toLowerCase().includes(queryLower))
        ) {
          repoRelevance += 3;
        }

        // Check functions
        for (const func of repo.functions) {
          if (
            func.name.toLowerCase().includes(queryLower) ||
            func.description.toLowerCase().includes(queryLower) ||
            func.signature.toLowerCase().includes(queryLower)
          ) {
            results.functions.push(func);
            repoRelevance += 2;
          }
        }

        // Check classes
        for (const cls of repo.classes) {
          if (
            cls.name.toLowerCase().includes(queryLower) ||
            cls.description.toLowerCase().includes(queryLower)
          ) {
            results.classes.push(cls);
            repoRelevance += 2;
          }
        }

        // Check constants
        for (const constant of repo.constants) {
          if (
            constant.name.toLowerCase().includes(queryLower) ||
            constant.description.toLowerCase().includes(queryLower)
          ) {
            results.constants.push(constant);
            repoRelevance += 1;
          }
        }

        if (repoRelevance > 0) {
          results.repositories.push(repo);
        }
      }

      // Sort by relevance
      results.functions.sort((a, b) => b.name.length - a.name.length);
      results.classes.sort((a, b) => b.name.length - a.name.length);
      results.constants.sort((a, b) => b.name.length - a.name.length);

      return results;
    } catch (error) {
      console.error('Error searching repository knowledge:', error);
      return {
        repositories: [],
        functions: [],
        classes: [],
        constants: [],
      };
    }
  }

  /**
   * Analyze repository code to extract functions, classes, and constants
   */
  private async analyzeRepositoryCode(
    owner: string,
    repo: string
  ): Promise<{
    functions: GitHubFunction[];
    classes: GitHubClass[];
    constants: GitHubConstant[];
  }> {
    const functions: GitHubFunction[] = [];
    const classes: GitHubClass[] = [];
    const constants: GitHubConstant[] = [];

    try {
      // Get repository contents
      const { data: contents } = await this.octokit.repos.getContent({
        owner,
        repo,
        path: '',
      });

      if (Array.isArray(contents)) {
        for (const item of contents) {
          if (item.type === 'file' && this.isCodeFile(item.name)) {
            try {
              const { data: fileContent } = await this.octokit.repos.getContent(
                {
                  owner,
                  repo,
                  path: item.path,
                }
              );

              if ('content' in fileContent) {
                const content = Buffer.from(
                  fileContent.content,
                  'base64'
                ).toString('utf-8');
                const analysis = this.analyzeCodeFile(content, item.path);

                functions.push(...analysis.functions);
                classes.push(...analysis.classes);
                constants.push(...analysis.constants);
              }
            } catch (error) {
              console.log(
                `Error analyzing file ${item.path}:`,
                error instanceof Error ? error.message : 'Unknown error'
              );
            }
          }
        }
      }
    } catch (error) {
      console.error(
        'Error analyzing repository code:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    return { functions, classes, constants };
  }

  /**
   * Analyze a single code file
   */
  private analyzeCodeFile(
    content: string,
    filePath: string
  ): {
    functions: GitHubFunction[];
    classes: GitHubClass[];
    constants: GitHubConstant[];
  } {
    const functions: GitHubFunction[] = [];
    const classes: GitHubClass[] = [];
    const constants: GitHubConstant[] = [];

    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Detect functions (Lua/TFS specific patterns)
      const functionMatch = line.match(
        /function\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)/
      );
      if (functionMatch) {
        const [, name, params] = functionMatch;
        const parameters = this.parseParameters(params);

        functions.push({
          name,
          file: filePath,
          line: lineNumber,
          signature: line,
          description: this.extractDescription(lines, i),
          parameters,
          returnType: 'unknown',
          examples: this.extractExamples(lines, i),
        });
      }

      // Detect classes (Lua table-based classes)
      const classMatch = line.match(/([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*\{\s*$/);
      if (classMatch) {
        const [, name] = classMatch;

        classes.push({
          name,
          file: filePath,
          line: lineNumber,
          description: this.extractDescription(lines, i),
          methods: [],
          properties: [],
        });
      }

      // Detect constants
      const constantMatch = line.match(/([A-Z_][A-Z0-9_]*)\s*=\s*([^;]+)/);
      if (constantMatch) {
        const [, name, value] = constantMatch;

        constants.push({
          name,
          file: filePath,
          line: lineNumber,
          value: value.trim(),
          description: this.extractDescription(lines, i),
        });
      }
    }

    return { functions, classes, constants };
  }

  /**
   * Parse function parameters
   */
  private parseParameters(
    paramsString: string
  ): Array<{ name: string; type: string; description: string }> {
    if (!paramsString.trim()) return [];

    return paramsString.split(',').map(param => ({
      name: param.trim(),
      type: 'unknown',
      description: '',
    }));
  }

  /**
   * Extract description from comments above the code
   */
  private extractDescription(lines: string[], currentLine: number): string {
    let description = '';

    // Look for comments above the current line
    for (let i = currentLine - 1; i >= 0; i--) {
      const line = lines[i].trim();
      if (
        line.startsWith('--') ||
        line.startsWith('//') ||
        line.startsWith('/*')
      ) {
        description = line.replace(/^[-/*\s]+/, '') + ' ' + description;
      } else if (line === '') {
        continue;
      } else {
        break;
      }
    }

    return description.trim();
  }

  /**
   * Extract usage examples from comments
   */
  private extractExamples(lines: string[], currentLine: number): string[] {
    const examples: string[] = [];

    // Look for example comments
    for (
      let i = currentLine + 1;
      i < Math.min(currentLine + 10, lines.length);
      i++
    ) {
      const line = lines[i].trim();
      if (line.includes('example') || line.includes('usage')) {
        examples.push(line);
      }
    }

    return examples;
  }

  /**
   * Check if file is a code file
   */
  private isCodeFile(filename: string): boolean {
    const codeExtensions = [
      '.lua',
      '.cpp',
      '.c',
      '.h',
      '.hpp',
      '.js',
      '.ts',
      '.py',
      '.java',
      '.php',
    ];
    return codeExtensions.some(ext => filename.toLowerCase().endsWith(ext));
  }

  /**
   * Parse GitHub URL
   */
  private parseGitHubUrl(url: string): { owner: string; repo: string } | null {
    const match = url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
    if (match) {
      return {
        owner: match[1],
        repo: match[2].replace(/\.git$/, ''),
      };
    }
    return null;
  }

  /**
   * Store repository knowledge in database
   */
  private async storeRepositoryKnowledge(
    repository: GitHubRepository,
    userId?: string
  ): Promise<void> {
    try {
      // Store as a special framework entry
      const frameworkData = {
        name: `GitHub: ${repository.name}`,
        description:
          repository.description ||
          `GitHub repository: ${repository.fullName}. Contains ${repository.functions.length} functions, ${repository.classes.length} classes, and ${repository.constants.length} constants. Last updated: ${repository.lastUpdated}`,
        language: repository.language,
        githubUrl: repository.url,
        documentation: repository.readme,
        features: JSON.stringify([
          `${repository.functions.length} functions`,
          `${repository.classes.length} classes`,
          `${repository.constants.length} constants`,
          ...repository.topics,
          `TFS Version: ${repository.name}`,
          `Repository: ${repository.fullName}`,
          `Added: ${new Date().toISOString()}`,
          `User: ${userId || 'anonymous'}`,
        ]),
      };

      await db.insert(frameworks).values(frameworkData);

      console.log(`Stored GitHub repository knowledge: ${repository.fullName}`);
    } catch (error) {
      console.error('Error storing repository knowledge:', error);
      throw error;
    }
  }

  /**
   * Get user's repository knowledge
   */
  private async getUserRepositoryKnowledge(
    userId?: string
  ): Promise<GitHubRepository[]> {
    try {
      const frameworkResults = await db
        .select()
        .from(frameworks)
        .where(like(frameworks.name, 'GitHub:%'));

      const repositories: GitHubRepository[] = [];

      for (const framework of frameworkResults) {
        try {
          // Parse features to extract repository information
          const features = JSON.parse(framework.features || '[]');
          const repositoryInfo = features.find((f: string) =>
            f.startsWith('Repository: ')
          );
          const tfsInfo = features.find((f: string) =>
            f.startsWith('TFS Version: ')
          );
          const addedInfo = features.find((f: string) =>
            f.startsWith('Added: ')
          );
          const userInfo = features.find((f: string) => f.startsWith('User: '));

          if (repositoryInfo && tfsInfo) {
            const repositoryName = repositoryInfo.replace('Repository: ', '');
            const tfsVersion = tfsInfo.replace('TFS Version: ', '');

            // Create a basic repository object from stored data
            const repository: GitHubRepository = {
              id: repositoryName,
              name: tfsVersion,
              fullName: repositoryName,
              description: framework.description,
              url: framework.githubUrl || '',
              language: framework.language,
              topics: features.filter(
                (f: string) =>
                  !f.includes(':') &&
                  !f.includes('functions') &&
                  !f.includes('classes') &&
                  !f.includes('constants')
              ),
              readme: framework.documentation || '',
              functions: [],
              classes: [],
              constants: [],
              lastUpdated: addedInfo
                ? addedInfo.replace('Added: ', '')
                : new Date().toISOString(),
            };

            repositories.push(repository);
          }
        } catch (error) {
          console.log('Error parsing framework data:', error);
        }
      }

      return repositories;
    } catch (error) {
      console.error('Error getting user repository knowledge:', error);
      return [];
    }
  }
}

export const githubKnowledgeService = new GitHubKnowledgeService();
